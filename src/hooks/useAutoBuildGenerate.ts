import { useCallback, useRef, useState } from 'react';
import dataService from '../utils/dataService';
import { LogoAIOrchestrator } from '../ai/logoOrchestrator';
import { CardAIOrchestrator } from '../ai/cardOrchestrator';
import { FlyerAIOrchestrator } from '../ai/flyerOrchestrator';
import { WebsiteOrchestrator } from '../ai/websiteOrchestrator';
import { builderToSvg, svgToPng } from '../utils/logoGenerator';
import { buildCardPhotoBrief } from '../utils/card/photoBrief';
import { compressDataUrl } from '../utils/card/imageCompress';
import { getAiImageModelDefault, getAiVisionEnabled } from '../utils/uiPrefs';
import { calculateCostUsd } from '../ai/providerPricing';
import { resolveProviderId, providerSupportsVision } from '../utils/resolveProviderId';
import { incrementAiStats, type AiStats } from '../utils/aiStats';
import { logger } from '../utils/logger';
import type { BusinessCard, Flyer, FlyerTone, Logo, LogoBuilder } from '../utils/documentSchemas';
import { createEmptyFlyer } from '../utils/documentSchemas';

export type DraftGenStatus = 'pending' | 'running' | 'done' | 'error';

export interface AutoBuildGenerateState {
  statuses: Record<string, DraftGenStatus>;
  errors: Record<string, string>;
  currentStep: string | null;
  running: boolean;
}

export interface AutoBuildGenerateSummary {
  statuses: Record<string, DraftGenStatus>;
  errors: Record<string, string>;
}

export interface AutoBuildDoc {
  id: string;
  documentType: string;
  title?: string;
  customerId?: string;
  data?: Record<string, unknown> | null;
}

export interface AutoBuildCustomer {
  businessName?: string;
  logoUrl?: string | null;
  detectedLogoUrl?: string | null;
  aiSuggestedFields?: Record<string, unknown> | null;
}

export interface AutoBuildGenerateOptions {
  /** Provider testuale da usare per gli orchestratori (modelId). */
  providerId?: string;
}

const GENERATABLE_ORDER = ['logo', 'businessCard', 'flyer', 'website'] as const;

const STEP_LABEL: Record<string, string> = {
  logo: 'logo',
  businessCard: 'card',
  flyer: 'flyer',
  website: 'sito web',
};

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

function briefOf(doc: AutoBuildDoc): string {
  const brief = doc.data?.briefContext;
  return typeof brief === 'string' ? brief : '';
}

function textCost(usage: TokenUsage | undefined): number {
  if (!usage) return 0;
  return calculateCostUsd(resolveProviderId(undefined), usage);
}

function moodToTone(mood: unknown): FlyerTone {
  const m = String(mood ?? '').toLowerCase();
  if (/giovan|young|dinamic|energic/.test(m)) return 'giovanile';
  if (/tecnic|professionale-tecnico/.test(m)) return 'tecnico';
  return 'formale';
}

// CON-MM-002: stessa gating di useAICard — vision solo se il toggle è attivo
// E il provider risolto supporta input immagini (default registry: M3).
function visionAllowed(): boolean {
  return getAiVisionEnabled() && providerSupportsVision(resolveProviderId(undefined));
}



function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Rasterizza un SVG in base64 raw (senza prefix data URL). Mai fatale:
// un fallimento vision non deve bloccare lo step di generazione.
async function rasterizeSvgBase64(svg: string): Promise<string | undefined> {
  try {
    return uint8ToBase64(await svgToPng(svg, 512));
  } catch (err) {
    logger.warn('Auto-build: rasterizzazione vision fallita', { route: 'useAutoBuildGenerate', err: String(err) });
    return undefined;
  }
}

async function logoVisionBase64(builder: LogoBuilder | null): Promise<string | undefined> {
  if (!builder || !visionAllowed()) return undefined;
  return rasterizeSvgBase64(builderToSvg(builder));
}

async function saveDraft(doc: AutoBuildDoc, data: Record<string, unknown>): Promise<void> {
  const basePayload = {
    id: doc.id,
    documentType: doc.documentType,
    title: doc.title,
    customerId: doc.customerId,
    status: 'BOZZA',
  } as Record<string, unknown>;
  let compressed = await compressDraftImages(data);
  let res = await dataService.saveDocument('admin@gmail.com', {
    id: basePayload.id,
    documentType: basePayload.documentType,
    title: basePayload.title,
    // customerId a top-level per getCustomer (filtra d.customerId), non solo in data
    customerId: basePayload.customerId,
    status: basePayload.status,
    data: { ...compressed, autoGeneratePending: false },
  });
  // Retry con compressione più aggressiva se quota superata.
  if (res?.error && /spazio|quota/i.test(String(res.error))) {
    logger.warn('Auto-build: quota superata, riprovo con compressione più aggressiva', { route: 'useAutoBuildGenerate', docId: doc.id });
    compressed = await compressDraftImages(data, 512, 100_000);
    res = await dataService.saveDocument('admin@gmail.com', {
      id: basePayload.id,
      documentType: basePayload.documentType,
      title: basePayload.title,
      customerId: basePayload.customerId,
      status: basePayload.status,
      data: { ...compressed, autoGeneratePending: false },
    });
  }
  // Se quota: errore esplicito, non corrompere il documento.
  if (res?.error) {
    logger.error('Auto-build: save document fallita', { route: 'useAutoBuildGenerate', docId: doc.id, error: res.error });
    throw new Error(String(res.error));
  }
}

// ~225KB raw in caratteri base64: oltre questa soglia comprimiamo prima del
// save per evitare QuotaExceededError su localStorage (gotcha §2.12).
const B64_COMPRESS_MIN_CHARS = 300_000;

const DRAFT_IMAGE_PATHS: ReadonlyArray<readonly [string, string]> = [
  ['front', 'photoUrl'],
  ['front', 'logoUrl'],
  ['front', 'coverImageUrl'],
  ['back', 'coverImageUrl'],
  ['builder', 'backgroundImage'],
  ['content', 'heroImage'],
];

// Immagini opzionali che possiamo sacrificare se lo storage è pieno.
// NON includiamo `builder.backgroundImage`: per il logo è il contenuto
// principale atteso dall'utente, rimuoverlo silenziosamente produce
// un logo diverso (bug: CRM preview senza sfondo). Se quota, fallisce
// e logga errore, non corrompe il documento.
const STRIPPABLE_IMAGE_PATHS: ReadonlyArray<readonly [string, string]> = [
  ['front', 'coverImageUrl'],
  ['back', 'coverImageUrl'],
  ['content', 'heroImage'],
];

function stripOptionalImages(data: Record<string, unknown>): Record<string, unknown> {
  let out = data;
  for (const [parent, field] of STRIPPABLE_IMAGE_PATHS) {
    const node = out[parent] as Record<string, unknown> | undefined;
    if (node && node[field] != null) {
      out = { ...out, [parent]: { ...node, [field]: null } };
    }
  }
  return out;
}

async function compressDraftImages(
  data: Record<string, unknown>,
  maxDim = 768,
  maxBytes = 200_000,
): Promise<Record<string, unknown>> {
  let out = data;
  for (const [parent, field] of DRAFT_IMAGE_PATHS) {
    const node = out[parent] as Record<string, unknown> | undefined;
    const value = node?.[field];
    if (typeof value === 'string' && value.startsWith('data:') && value.length > B64_COMPRESS_MIN_CHARS) {
      const compressed = await compressDataUrl(value, maxDim, maxBytes);
      if (compressed && compressed !== value) {
        out = { ...out, [parent]: { ...node, [field]: compressed } };
      }
    }
  }
  return out;
}

interface FlashImageResult {
  dataUrl: string;
  costUsd: number;
}

// Gemini Flash image via proxy server-side. Mai fatale: se l'endpoint
// fallisce il draft resta valido senza immagine.
async function generateFlashImage(
  prompt: string,
  kind: 'icon' | 'hero',
  palette: { primaryColor?: string; secondaryColor?: string },
): Promise<FlashImageResult | null> {
  const sizes = ['512', '256'] as const;
  for (const size of sizes) {
    try {
      const apiBase = import.meta.env?.VITE_API_BASE || '';
      const imageModel = getAiImageModelDefault();
      const res = await fetch(`${apiBase}/api/ai/image-flash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.slice(0, 800),
          kind,
          aspectRatio: kind === 'hero' ? '16:9' : '1:1',
          size,
          primaryColor: palette.primaryColor,
          secondaryColor: palette.secondaryColor,
          style: 'minimalist',
          imageModel,
          userEmail: 'admin@gmail.com',
        }),
      });
      if (!res.ok) {
        if (res.status === 413) continue;
        return null;
      }
      const { data } = (await res.json()) as { data: { imageBase64: string; mimeType: string } };
      const pricingId = imageModel === 'gemini-2.0-flash-preview-image-generation'
        ? 'gemini-flash-image'
        : 'gemini-nano-banana';
      return {
        dataUrl: `data:${data.mimeType};base64,${data.imageBase64}`,
        costUsd: calculateCostUsd(pricingId, undefined, 1),
      };
    } catch (err) {
      logger.warn(`Auto-build: immagine ${kind} non generata`, { route: 'useAutoBuildGenerate', err: String(err) });
      return null;
    }
  }
  return null;
}

async function generateLogoDraft(doc: AutoBuildDoc, brief: string, options?: AutoBuildGenerateOptions): Promise<LogoBuilder> {
  const orchestrator = new LogoAIOrchestrator();
  const result = await orchestrator.generateLogo(doc.data as unknown as Logo, brief, { modelId: options?.providerId });
  const selected = result.selected >= 0 ? result.concepts[result.selected] : result.concepts[0];
  if (!result.applied || !selected) {
    logger.warn('Auto-build: logo AI nessun concept valido', {
      route: 'useAutoBuildGenerate', docId: doc.id, applied: result.applied, concepts: result.concepts.length, changes: result.changes, raw: result.rawResponse?.slice(0, 300),
    });
    throw new Error('Logo AI: nessun concept valido');
  }
  let builder = selected;
  // Immagine AI di sfondo per il logo (Gemini). Mai fatale: se fallisce resta l'icona SVG.
  // Non c'è guard spazio qui: se il save supera quota, saveDraft farà strip del background.
  try {
    const imagePrompt = `Professional artistic logo emblem/background. ${brief.slice(0, 300)}`;
    const bgResult = await orchestrator.generateBackground(
      { ...(doc.data as unknown as Logo), builder },
      { activity: '', mood: '', target: '', imagePrompt },
      { userEmail: 'admin@gmail.com', imageModel: getAiImageModelDefault() },
    );
    if (bgResult.applied && bgResult.logo.builder.backgroundImage) {
      // Comprimi subito come per flyer hero: Gemini 1024px → ~1-2MB base64,
      // supera quota localStorage e saveDraft falliva silenziosamente.
      const compressed = await compressDataUrl(bgResult.logo.builder.backgroundImage, 512, 150_000);
      builder = { ...builder, backgroundImage: compressed ?? bgResult.logo.builder.backgroundImage };
      logger.info('Auto-build: background logo generato', { route: 'useAutoBuildGenerate', docId: doc.id });
    } else {
      logger.warn('Auto-build: background logo non applicato', { route: 'useAutoBuildGenerate', docId: doc.id, error: bgResult.error });
    }
  } catch (err) {
    logger.warn('Auto-build: background logo non generato', { route: 'useAutoBuildGenerate', docId: doc.id, err: String(err) });
  }
  // Fallback: se il background dedicato non è stato applicato, prova image-flash.
  if (!builder.backgroundImage) {
    const bg = await generateFlashImage(`Logo emblem background. ${brief.slice(0, 300)}`, 'hero', {
      primaryColor: builder.primaryColor,
      secondaryColor: builder.secondaryColor,
    });
    if (bg) {
      builder = { ...builder, backgroundImage: bg.dataUrl };
      logger.info('Auto-build: background logo generato via image-flash fallback', { route: 'useAutoBuildGenerate', docId: doc.id });
    }
  }
  const data = {
    ...doc.data,
    builder,
    concepts: result.concepts,
    aiStats: incrementAiStats(doc.data?.aiStats as AiStats | undefined, 'logoConcept', textCost(result.response?.usage)),
  };
  await saveDraft(doc, data);
  return builder;
}

async function generateCardIcon(card: BusinessCard): Promise<{ dataUrl: string; costUsd: number } | null> {
  const brief = buildCardPhotoBrief(card);
  const apiBase = import.meta.env?.VITE_API_BASE || '';
  const res = await fetch(`${apiBase}/api/ai/card-photo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: brief.prompt,
      context: brief.context || undefined,
      userEmail: 'admin@gmail.com',
      imageModel: getAiImageModelDefault(),
    }),
  });
  if (!res.ok) return null;
  const { data } = (await res.json()) as { data: { imageBase64: string; mimeType: string } };
  return {
    dataUrl: `data:${data.mimeType};base64,${data.imageBase64}`,
    costUsd: calculateCostUsd('gemini-nano-banana', undefined, 1),
  };
}

function resolveCardLogoUrl(logoBuilder: LogoBuilder | null, customer: AutoBuildCustomer): string | null {
  if (logoBuilder) return `data:image/svg+xml;utf8,${encodeURIComponent(builderToSvg(logoBuilder))}`;
  return customer.detectedLogoUrl ?? null;
}

async function generateCardDraft(
  doc: AutoBuildDoc,
  brief: string,
  customer: AutoBuildCustomer,
  logoBuilder: LogoBuilder | null,
  visionLogoBuilder: LogoBuilder | null = logoBuilder,
  options?: AutoBuildGenerateOptions,
): Promise<Record<string, unknown>> {
  const base = { ...doc.data } as Record<string, unknown>;
  const logoUrl = resolveCardLogoUrl(logoBuilder, customer);
  if (logoUrl) base.front = { ...(base.front as Record<string, unknown>), logoUrl };
  const prompt = [
    'Crea il biglietto da visita completo per questa attività partendo dal brief.',
    'Definisci TUTTI e tre gli aspetti:',
    '- STRUTTURA: layout fronte più adatto e disposizione elementi (grid) senza sovrapposizioni;',
    '- TESTI: nome, titolo/ruolo, servizi (back.services) plausibili per il settore;',
    '- STILE: palette coerente (bgColor, textColor, accentColor in #RRGGBB), fontFamily, eventuale decorazione.',
    `Brief: ${brief}`,
  ].join('\n');
  const imagePreviewBase64 = await logoVisionBase64(visionLogoBuilder);
  const result = await new CardAIOrchestrator().processPrompt(base as unknown as BusinessCard, prompt, {
    imagePreviewBase64,
    modelId: options?.providerId,
  });
  const cost = result.costUsd ?? textCost(result.response?.usage as TokenUsage | undefined);
  let aiStats = incrementAiStats(doc.data?.aiStats as AiStats | undefined, 'text', cost);
  const resultCard = result.card as unknown as Record<string, unknown>;
  // Merge front/back per non perdere le patch locali (logoUrl, contatti)
  // se l'orchestratore ritorna un oggetto parziale.
  const merged: Record<string, unknown> = {
    ...base,
    ...resultCard,
    front: { ...(base.front as Record<string, unknown>), ...(resultCard.front as Record<string, unknown>) },
    back: { ...(base.back as Record<string, unknown>), ...(resultCard.back as Record<string, unknown>) },
  };
  if (!(merged.front as Record<string, unknown>)?.photoUrl) {
    try {
      // CON-IS-001: l'icona AI va in photoUrl, logoUrl mai toccato.
      // Usa merged (non result.card): se l'AI risponde parziale senza `style`,
      // merged eredita `style` da base → buildCardPhotoBrief non crasha.
      const icon = await generateCardIcon(merged as unknown as BusinessCard);
      if (icon) {
        merged.front = { ...(merged.front as Record<string, unknown>), photoUrl: icon.dataUrl };
        aiStats = incrementAiStats(aiStats, 'photo', icon.costUsd);
      }
    } catch (err) {
      logger.warn('Auto-build: icona card non generata', { route: 'useAutoBuildGenerate', err: String(err) });
    }
  }
  if (!(merged.front as Record<string, unknown>)?.coverImageUrl) {
    const style = (merged.style ?? {}) as { bgColor?: string; accentColor?: string };
    const coverPrompt = `Cover di sfondo per biglietto da visita professionale. ${brief}. Astratta, elegante, coerente col settore, senza testo né loghi.`;
    const cover = await generateFlashImage(coverPrompt, 'hero', {
      primaryColor: style.accentColor,
      secondaryColor: style.bgColor,
    });
    if (cover) {
      merged.front = { ...(merged.front as Record<string, unknown>), coverImageUrl: cover.dataUrl };
      aiStats = incrementAiStats(aiStats, 'cover', cover.costUsd);
    }
  }
  await saveDraft(doc, { ...merged, aiStats });
  return merged;
}

async function generateFlyerDraft(
  doc: AutoBuildDoc,
  brief: string,
  tone: FlyerTone,
  _cardData: Record<string, unknown> | null,
  options?: AutoBuildGenerateOptions,
): Promise<void> {
  // Flyer copy è testo-only: vision disabilitata per affidabilità JSON/output.
  // Il card preview è utile ma M3 tende a non rispettare lo schema con immagini grandi.
  const fallbackFlyer = createEmptyFlyer();
  const flyerInput = { ...(doc.data as unknown as Flyer) };
  if (!flyerInput.size) flyerInput.size = fallbackFlyer.size;
  if (!flyerInput.style) flyerInput.style = fallbackFlyer.style;
  if (!flyerInput.content) flyerInput.content = fallbackFlyer.content;
  const result = await new FlyerAIOrchestrator().generateCopy(
    flyerInput,
    brief,
    tone,
    { modelId: options?.providerId },
  );
  if (!result.applied) throw new Error('Flyer AI: copy non valido');
  let aiStats = incrementAiStats(doc.data?.aiStats as AiStats | undefined, 'flyerCopy', textCost(result.response?.usage));
  const data = {
    ...flyerInput,
    ...(result.flyer as unknown as Record<string, unknown>),
  };
  const content = (data.content ?? {}) as Record<string, unknown>;
  if (!content.heroImage) {
    const style = (data.style ?? {}) as { bgColor?: string; accentColor?: string };
    const heroPrompt = `Hero image per volantino pubblicitario. ${brief}. Fotorealistica o illustrata, coerente col settore, senza testo.`;
    const hero = await generateFlashImage(heroPrompt, 'hero', {
      primaryColor: style.accentColor,
      secondaryColor: style.bgColor,
    });
    if (hero) {
      data.content = { ...content, heroImage: hero.dataUrl } as Flyer['content'];
      aiStats = incrementAiStats(aiStats, 'hero', hero.costUsd);
    }
  }
  await saveDraft(doc, { ...data, aiStats });
}

async function generateWebsiteDraft(
  doc: AutoBuildDoc,
  brief: string,
  _customer: AutoBuildCustomer,
  options?: AutoBuildGenerateOptions,
): Promise<void> {
  const briefData = (doc.data?.brief ?? {}) as Record<string, unknown>;
  const result = await new WebsiteOrchestrator().generateSite(
    {
      businessName: String(briefData.businessName || ''),
      sector: String(briefData.sector || ''),
      description: brief || String(briefData.description || ''),
      tone: String(briefData.tone || ''),
      target: String(briefData.target || ''),
      pages: String(briefData.pages || 'index'),
      preferredColors: String(briefData.preferredColors || ''),
      font: String(briefData.font || ''),
      cta: String(briefData.cta || ''),
      sections: String(briefData.sections || 'hero, chi_siamo, contatti'),
      features: String(briefData.features || ''),
      contacts: String(briefData.contacts || ''),
      socials: Array.isArray(briefData.socials) ? briefData.socials : [],
      mapsUrl: String(briefData.mapsUrl || ''),
      notes: String(briefData.notes || ''),
    },
    {
      style: String(doc.data?.style || 'modern'),
      briefContext: briefOf(doc),
      modelId: options?.providerId,
    },
  );
  const aiStats = incrementAiStats(doc.data?.aiStats as AiStats | undefined, 'websiteCode', textCost(result.response?.usage));
  await saveDraft(doc, {
    ...(doc.data as Record<string, unknown>),
    html: result.site.html,
    css: result.site.css,
    js: result.site.js,
    pages: result.site.pages,
    source: 'ai',
    aiStats,
  });
}

export function useAutoBuildGenerate() {
  const [state, setState] = useState<AutoBuildGenerateState>({ statuses: {}, errors: {}, currentStep: null, running: false });
  const logoBuilderRef = useRef<LogoBuilder | null>(null);
  const cardDataRef = useRef<Record<string, unknown> | null>(null);

  const setStatus = useCallback((id: string, status: DraftGenStatus) => {
    setState((prev) => ({ ...prev, statuses: { ...prev.statuses, [id]: status } }));
  }, []);

  const setDocError = useCallback((id: string, msg: string | null) => {
    setState((prev) => {
      const errors = { ...prev.errors };
      if (msg == null) delete errors[id];
      else errors[id] = msg;
      return { ...prev, errors };
    });
  }, []);

  const runDoc = useCallback(
    async (doc: AutoBuildDoc, customer: AutoBuildCustomer, allDocs?: AutoBuildDoc[], options?: AutoBuildGenerateOptions): Promise<void> => {
      const brief = briefOf(doc);
      if (doc.documentType === 'logo') {
        logoBuilderRef.current = await generateLogoDraft(doc, brief, options);
      } else if (doc.documentType === 'businessCard') {
        // Vision: logo generato in questo run, altrimenti builder del draft logo esistente.
        const existingBuilder = allDocs?.find((d) => d.documentType === 'logo')?.data?.builder as LogoBuilder | undefined;
        const visionBuilder = logoBuilderRef.current ?? existingBuilder ?? null;
        cardDataRef.current = await generateCardDraft(doc, brief, customer, logoBuilderRef.current, visionBuilder, options);
      } else if (doc.documentType === 'flyer') {
        await generateFlyerDraft(doc, brief, moodToTone(customer.aiSuggestedFields?.mood), cardDataRef.current, options);
      } else if (doc.documentType === 'website') {
        await generateWebsiteDraft(doc, brief, customer, options);
      }
    },
    [],
  );

  const generateAll = useCallback(
    async (docs: AutoBuildDoc[], customer: AutoBuildCustomer, options?: AutoBuildGenerateOptions): Promise<AutoBuildGenerateSummary> => {
      const targets = GENERATABLE_ORDER.flatMap((type) =>
        docs.filter((d) => d.documentType === type && d.data?.autoGeneratePending),
      );
      logoBuilderRef.current = null;
      cardDataRef.current = null;
      const statuses: Record<string, DraftGenStatus> = {};
      const errors: Record<string, string> = {};
      setState((prev) => ({ ...prev, running: true }));
      for (let i = 0; i < targets.length; i++) {
        const doc = targets[i];
        setStatus(doc.id, 'running');
        setDocError(doc.id, null);
        setState((prev) => ({
          ...prev,
          currentStep: `Genero ${STEP_LABEL[doc.documentType] ?? doc.documentType}… (${i + 1}/${targets.length})`,
        }));
        try {
          await runDoc(doc, customer, docs, options);
          statuses[doc.id] = 'done';
          setStatus(doc.id, 'done');
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error('Auto-build draft AI fallito', { route: 'useAutoBuildGenerate', docId: doc.id, err: String(err) });
          statuses[doc.id] = 'error';
          errors[doc.id] = msg;
          setStatus(doc.id, 'error');
          setDocError(doc.id, msg);
        }
      }
      setState((prev) => ({ ...prev, running: false, currentStep: null }));
      return { statuses, errors };
    },
    [runDoc, setStatus, setDocError],
  );

  const generateOne = useCallback(
    async (doc: AutoBuildDoc, customer: AutoBuildCustomer, options?: AutoBuildGenerateOptions): Promise<void> => {
      setStatus(doc.id, 'running');
      setDocError(doc.id, null);
      setState((prev) => ({ ...prev, running: true, currentStep: `Genero ${STEP_LABEL[doc.documentType] ?? doc.documentType}…` }));
      try {
        await runDoc(doc, customer, undefined, options);
        setStatus(doc.id, 'done');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('Auto-build draft AI fallito', { route: 'useAutoBuildGenerate', docId: doc.id, err: String(err) });
        setStatus(doc.id, 'error');
        setDocError(doc.id, msg);
      }
      setState((prev) => ({ ...prev, running: false, currentStep: null }));
    },
    [runDoc, setStatus, setDocError],
  );

  return { state, generateAll, generateOne };
}
