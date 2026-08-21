import { useCallback, useRef, useState } from 'react';
import dataService from '../utils/dataService';
import { LogoAIOrchestrator } from '../ai/logoOrchestrator';
import { CardAIOrchestrator, buildCardDraftPrompt } from '../ai/cardOrchestrator';
import { FlyerAIOrchestrator } from '../ai/flyerOrchestrator';
import { WebsiteOrchestrator } from '../ai/websiteOrchestrator';
import { builderToSvg, svgToPng } from '../utils/logoGenerator';
import { buildCardPhotoBrief } from '../utils/card/photoBrief';
import { compressDataUrl } from '../utils/card/imageCompress';
import { getAiImageModelDefault, getAiVisionEnabled } from '../utils/uiPrefs';
import { calculateCostUsd, geminiImagePricingId } from '../ai/providerPricing';
import { resolveProviderId, providerSupportsVision } from '../utils/resolveProviderId';
import { incrementAiStats, type AiStats } from '../utils/aiStats';
import { logger } from '../utils/logger';
import { injectLogoIntoHtml } from '../utils/website/logoInjection';
import { enforceMapIframe, sanitizeGeneratedJs, ensureHamburgerCss } from '../utils/website/sanitizeGenerated';
import { newRunId, newSpanId } from '../ai/runTrace';
import { type RunTraceOptions } from '../ai/types';
import { loadRunState, saveRunState, clearRunState } from '../utils/runState';
import { AgentOrchestrator } from '../ai/agentOrchestrator';
import { VerifyOrchestrator } from '../ai/verifyOrchestrator';
import { renderDraftPreviews } from '../utils/verifyRender';
import { cohereDrafts } from '../ai/coherenceOrchestrator';
import { buildAgentBrief, agentResultData, agentTypeOfDoc, docTypeOfTool } from '../ai/agentSave';
import type { BusinessCard, Flyer, FlyerTone, Logo, LogoBuilder } from '../utils/documentSchemas';
import { createEmptyCard, createEmptyFlyer, createEmptyLogo, ensureCardGrid } from '../utils/documentSchemas';

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
  /** TB-029: customerId per attribuzione Langfuse delle chiamate AI. */
  customerId?: string;
  /** TB-032: override reasoning per gli orchestratori (badge Clienti).
   *  Assente → il provider usa la preferenza utente (getAiReasoningEffort). */
  reasoningEffort?: 'low' | 'high' | 'max';
  /** T7: trace gerarchica agente — se assenti, il hook genera runId/rootSpanId. */
  runTrace?: RunTraceOptions;
  /** T11: usa l'agente orchestratore (harness tools) invece della sequenza fissa. */
  agentMode?: boolean;
  /** t18: focus aggiuntivo per il retry post-verifica (verdetto motivazione). */
  userPrompt?: string;
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
    compressed = await compressDraftImages(data, { maxDim: 1024, maxBytes: 200_000 });
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

// Persistenza path-aware (gotcha §2.5): background/hero a 1536px (le aree
// di stampa grandi — card full-bleed 1004px@300dpi, hero A5 ~1748px —
// altrimenti escono sfocate), il resto a 1024px. Prima era 768px piatto
// per tutto → immagini AI 1K declassate sotto la soglia di qualità
// (verifica live 2026-08-13: 768×429 persistiti).
const DRAFT_IMAGE_PATHS: ReadonlyArray<readonly [string, string, number, number]> = [
  ['front', 'photoUrl', 1024, 400_000],
  ['front', 'logoUrl', 1024, 400_000],
  ['front', 'coverImageUrl', 1536, 400_000],
  ['back', 'coverImageUrl', 1536, 400_000],
  ['builder', 'backgroundImage', 1536, 400_000],
  ['content', 'heroImage', 1536, 400_000],
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
  override?: { maxDim: number; maxBytes: number },
): Promise<Record<string, unknown>> {
  let out = data;
  for (const [parent, field, maxDim, maxBytes] of DRAFT_IMAGE_PATHS) {
    const node = out[parent] as Record<string, unknown> | undefined;
    const value = node?.[field];
    if (typeof value === 'string' && value.startsWith('data:') && value.length > B64_COMPRESS_MIN_CHARS) {
      const compressed = await compressDataUrl(value, override?.maxDim ?? maxDim, override?.maxBytes ?? maxBytes);
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
  const sizes = ['1K', '512'] as const;
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
      const pricingId = geminiImagePricingId(imageModel);
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

async function generateLogoDraft(doc: AutoBuildDoc, brief: string, options?: AutoBuildGenerateOptions, referenceImage?: string | null): Promise<LogoBuilder> {
  const orchestrator = new LogoAIOrchestrator();
  const result = await orchestrator.generateLogo(doc.data as unknown as Logo, brief, {
    modelId: options?.providerId,
    customerId: options?.customerId,
    sessionId: doc.id,
    reasoningEffort: options?.reasoningEffort,
    referenceImageBase64: referenceImage || undefined,
    ...options?.runTrace,
  });
  const selected = result.selected >= 0 ? result.concepts[result.selected] : result.concepts[0];
  if (!result.applied || !selected) {
    logger.warn('Auto-build: logo AI nessun concept valido', {
      route: 'useAutoBuildGenerate', docId: doc.id, applied: result.applied, concepts: result.concepts.length, changes: result.changes, raw: result.rawResponse?.slice(0, 300),
    });
    throw new Error('Logo AI: nessun concept valido');
  }
  // Parse AI fallito → l'orchestratore ripiega su concept placeholder
  // ("Brand"): mai salvarlo come successo, l'utente deve poter riprovare.
  if (result.changes?.includes('logo:fallback_concepts')) {
    logger.warn('Auto-build: logo AI fallback placeholder, output non valido', {
      route: 'useAutoBuildGenerate', docId: doc.id, raw: result.rawResponse?.slice(0, 300),
    });
    throw new Error('Logo AI: output non valido (placeholder), riprova');
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
      // Comprimi subito come per flyer hero: Gemini 2K → ~1-2MB base64,
      // supera quota localStorage e saveDraft falliva silenziosamente.
      const compressed = await compressDataUrl(bgResult.logo.builder.backgroundImage, 1400, 400_000);
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
  // Wordmark bianco su sfondo AI: attiva lo scrim di default (design-criteria:
  // contrasto su backgroundImage). Un textBackdrop esplicito del concept vince.
  if (builder.backgroundImage && (!builder.textBackdrop || builder.textBackdrop === 'none')) {
    builder = { ...builder, textBackdrop: 'pill' };
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
    costUsd: calculateCostUsd(geminiImagePricingId(getAiImageModelDefault()), undefined, 1),
  };
}

function resolveCardLogoUrl(logoBuilder: LogoBuilder | null, customer: AutoBuildCustomer): string | null {
  if (logoBuilder) return `data:image/svg+xml;utf8,${encodeURIComponent(builderToSvg(logoBuilder))}`;
  return customer.detectedLogoUrl ?? null;
}

// T6: il path agente salva il testo dei tool; le immagini (logo bg, card
// cover+photo, flyer hero) vengono arricchite qui con lo stesso stack del
// path non-agente. lean-code: logo bg via image-flash (come il fallback
// di generateLogoDraft); upgrade al endpoint dedicato se la qualità lagga.
async function enrichAgentDocWithImages(
  docType: string,
  data: Record<string, unknown>,
  brief: string,
): Promise<Record<string, unknown>> {
  let aiStats = data.aiStats as AiStats | undefined;
  if (docType === 'logo') {
    const builder = data.builder as LogoBuilder | undefined;
    if (!builder?.primaryText || builder.backgroundImage) return data;
    const bg = await generateFlashImage(`Logo emblem background. ${brief.slice(0, 300)}`, 'hero', {
      primaryColor: builder.primaryColor,
      secondaryColor: builder.secondaryColor,
    });
    if (!bg) return data;
    aiStats = incrementAiStats(aiStats, 'background', bg.costUsd);
    const needsBackdrop = !builder.textBackdrop || builder.textBackdrop === 'none';
    return { ...data, builder: { ...builder, backgroundImage: bg.dataUrl, ...(needsBackdrop ? { textBackdrop: 'pill' as const } : {}) }, aiStats };
  }
  if (docType === 'businessCard') {
    const merged = { ...data };
    let front = (merged.front ?? {}) as Record<string, unknown>;
    if (!front.photoUrl) {
      try {
        // CON-IS-001: l'icona AI va in photoUrl, logoUrl mai toccato.
        const icon = await generateCardIcon(merged as unknown as BusinessCard);
        if (icon) {
          front = { ...front, photoUrl: icon.dataUrl };
          merged.front = front;
          aiStats = incrementAiStats(aiStats, 'photo', icon.costUsd);
        }
      } catch { /* immagini best-effort, mai fatali */ }
    }
    if (!front.coverImageUrl) {
      const style = (merged.style ?? {}) as { bgColor?: string; accentColor?: string };
      const cover = await generateFlashImage(`Cover di sfondo per biglietto da visita professionale. ${brief}. Astratta, elegante, coerente col settore, senza testo né loghi.`, 'hero', {
        primaryColor: style.accentColor,
        secondaryColor: style.bgColor,
      });
      if (cover) {
        merged.front = { ...front, coverImageUrl: cover.dataUrl };
        aiStats = incrementAiStats(aiStats, 'cover', cover.costUsd);
      }
    }
    return { ...merged, aiStats };
  }
  if (docType === 'flyer') {
    const content = (data.content ?? {}) as Record<string, unknown>;
    if (content.heroImage) return data;
    const style = (data.style ?? {}) as { bgColor?: string; accentColor?: string };
    const hero = await generateFlashImage(`Hero image per volantino pubblicitario. ${brief}. Fotorealistica o illustrata, coerente col settore, senza testo.`, 'hero', {
      primaryColor: style.accentColor,
      secondaryColor: style.bgColor,
    });
    if (!hero) return data;
    aiStats = incrementAiStats(aiStats, 'hero', hero.costUsd);
    return { ...data, content: { ...content, heroImage: hero.dataUrl }, aiStats };
  }
  return data;
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
  const prompt = buildCardDraftPrompt(brief);
  const imagePreviewBase64 = await logoVisionBase64(visionLogoBuilder);
  const result = await new CardAIOrchestrator().processPrompt(base as unknown as BusinessCard, prompt, {
    imagePreviewBase64,
    modelId: options?.providerId,
    customerId: options?.customerId,
    sessionId: doc.id,
    reasoningEffort: options?.reasoningEffort,
    ...options?.runTrace,
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
  await saveDraft(doc, { ...ensureCardGrid(merged as unknown as BusinessCard), aiStats });
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
    { modelId: options?.providerId, customerId: options?.customerId, sessionId: doc.id, reasoningEffort: options?.reasoningEffort, ...options?.runTrace },
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
  customer: AutoBuildCustomer,
  options?: AutoBuildGenerateOptions,
): Promise<void> {
  const briefData = (doc.data?.brief ?? {}) as Record<string, unknown>;
  const logoBase64 = (doc.data?.logoUrl as string | undefined) || customer.logoUrl || undefined;
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
      logoBase64,
      customerId: options?.customerId,
      sessionId: doc.id,
      generateHeroImages: async (prompt) => {
        const hero = await generateFlashImage(prompt, 'hero', {});
        return hero?.dataUrl ?? null;
      },
      ...options?.runTrace,
    },
  );
  const aiStats = incrementAiStats(doc.data?.aiStats as AiStats | undefined, 'websiteCode', result.aiCall?.costUsd ?? textCost(result.response?.usage));
  const contacts = String(briefData.contacts || '');
  await saveDraft(doc, {
    ...(doc.data as Record<string, unknown>),
    html: enforceMapIframe(injectLogoIntoHtml(result.site.html, logoBase64 || null), contacts),
    css: ensureHamburgerCss(result.site.css),
    js: sanitizeGeneratedJs(result.site.js),
    pages: result.site.pages,
    pagesHtml: result.site.pagesHtml,
    source: 'ai',
    aiStats,
    logoUrl: logoBase64 || (doc.data?.logoUrl as string | undefined) || null,
  });
}

export function useAutoBuildGenerate() {
  const [state, setState] = useState<AutoBuildGenerateState>({ statuses: {}, errors: {}, currentStep: null, running: false });
  const logoBuilderRef = useRef<LogoBuilder | null>(null);
  const cardDataRef = useRef<Record<string, unknown> | null>(null);
  const lastDataByTypeRef = useRef<Record<string, Record<string, unknown>>>({});

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
      const baseBrief = briefOf(doc);
      const brief = options?.userPrompt ? `${baseBrief}. ${options.userPrompt}` : baseBrief;
      if (doc.documentType === 'logo') {
        // TB-033: logo del cliente come riferimento visivo (stile simile,
        // testo nuovo). Comprimiamo per vision quando c'è.
        let reference: string | null = null;
        const rawLogo = customer.logoUrl || customer.detectedLogoUrl || null;
        if (rawLogo) {
          try {
            reference = (await compressDataUrl(rawLogo, 1024, 400_000)) || rawLogo;
          } catch {
            reference = rawLogo;
          }
        }
        logoBuilderRef.current = await generateLogoDraft(doc, brief, options, reference);
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
      // t17: resume del run precedente per questo cliente se lo stato
      // è ancora valido — i done si saltano, gli error riprovano.
      const prevRun = options?.customerId ? loadRunState(options.customerId) : null;
      let resumedSkip = 0;
      const steps = prevRun?.steps ?? [];

      targets.forEach((d) => {
        const prev = steps.find((s) => s.step === d.documentType);
        if (prev?.status === 'done') resumedSkip++;
      });
      // t17: il resume salta gli step già done nel run precedente;
      // gli error/pending ripartono.
      const resumed = targets.filter((d) => {
        const prev = steps.find((s) => s.step === d.documentType);
        return prev?.status !== 'done';
      });

      // T7: un run agente = una trace Langfuse (runId condiviso). Il primo
      // step emette lo span root; ogni step ha stepSpanId nuovo.
      const runId = options?.runTrace?.runId ?? prevRun?.runId ?? newRunId();
      const rootSpanId = options?.runTrace?.rootSpanId ?? newSpanId();
      const statuses: Record<string, DraftGenStatus> = {};
      const errors: Record<string, string> = {};
      setState((prev) => ({ ...prev, running: true }));

      // t17: salva lo stato del run corrente per un eventuale resume.
      const persistRunState = (extraStatuses: Record<string, DraftGenStatus>) => {
        if (!options?.customerId) return;
        const merged: Record<string, DraftGenStatus> = { ...extraStatuses };
        saveRunState({
          runId,
          customerId: options.customerId,
          startedAt: Date.now(),
          steps: targets.map((d) => {
            const prev = steps.find((s) => s.step === d.documentType);
            return { step: d.documentType, status: merged[d.id] ?? prev?.status ?? 'pending' };
          }),
        });
      };

      // T11: modalità agente — l'AI pianifica e delega ai sub-orchestratori
      // via tool; ogni tool result viene salvato sul doc corrispondente.
      const workList = resumed;
      // t18: verifica visione post-loop. 1 call AI con preview dei 3 draft;
      // per ogni "retry" rigenera quello solo (max 1 volta) con la motivazione come focus.
      const runVerifyAfterAgent = async () => {
        if (!getAiVisionEnabled()) return;
        const modelId = resolveProviderId();
        if (!providerSupportsVision(modelId)) return;
        const lastData = lastDataByTypeRef.current;
        const drafts: {
          logo?: { draft: Logo; preview: string };
          card?: { draft: BusinessCard; preview: string };
          flyer?: { draft: Flyer; preview: string };
        } = {};
        if (lastData.logo) drafts.logo = { draft: lastData.logo as unknown as Logo, preview: '' };
        if (lastData.businessCard) drafts.card = { draft: lastData.businessCard as unknown as BusinessCard, preview: '' };
        if (lastData.flyer) drafts.flyer = { draft: lastData.flyer as unknown as Flyer, preview: '' };
        if (!drafts.logo && !drafts.card && !drafts.flyer) return;
        setState((prev) => ({ ...prev, currentStep: 'Verifica visione delle bozze…' }));
        const previews = await renderDraftPreviews({
          logo: drafts.logo?.draft,
          card: drafts.card?.draft,
          flyer: drafts.flyer?.draft,
        });
        if (drafts.logo) drafts.logo.preview = previews.logo ?? '';
        if (drafts.card) drafts.card.preview = previews.card ?? '';
        if (drafts.flyer) drafts.flyer.preview = previews.flyer ?? '';
        const verdict = await new VerifyOrchestrator().verifyDrafts({
          brief: options?.customerId ? `Cliente ${options.customerId}` : '',
          drafts: {
            logo: drafts.logo,
            card: drafts.card,
            flyer: drafts.flyer,
          },
        });
        const retries: Array<'logo' | 'businessCard' | 'flyer'> = [];
        if (verdict.logo?.verdict === 'retry') retries.push('logo');
        if (verdict.card?.verdict === 'retry') retries.push('businessCard');
        if (verdict.flyer?.verdict === 'retry') retries.push('flyer');
        if (retries.length === 0) return;
        for (const targetType of retries) {
          const doc = targets.find((d) => d.documentType === targetType);
          if (!doc) continue;
          setState((prev) => ({ ...prev, currentStep: `Reverifica: ${STEP_LABEL[targetType] ?? targetType}` }));
          try {
            await runDoc(doc, customer, docs, {
              ...options,
              runTrace: { runId, runName: 'auto-build', stepName: `${targetType}-reverify` },
              userPrompt: verdict[targetType === 'businessCard' ? 'card' : (targetType as 'logo' | 'flyer')]?.reason
                ? `Focus post-verifica: ${verdict[targetType === 'businessCard' ? 'card' : (targetType as 'logo' | 'flyer')]?.reason}`
                : undefined,
            });
          } catch (err) {
            logger.warn('t18: retry fallito', { route: 'useAutoBuildGenerate', targetType, err: String(err) });
          }
        }
      };
      // t21: coherence pass — palette/font unificati (solo agentMode, 1 patch deterministico).
      const runCoherenceAfterAgent = async () => {
        const lastData = lastDataByTypeRef.current;
        const patch = cohereDrafts({
          logo: lastData.logo as unknown as Logo | undefined,
          card: lastData.businessCard as unknown as BusinessCard | undefined,
          flyer: lastData.flyer as unknown as Flyer | undefined,
          website: lastData.website as unknown as { brief?: { preferredColors?: string }; style?: string } | undefined,
        });
        if (!patch.card && !patch.flyer && !patch.website) return;
        setState((prev) => ({ ...prev, currentStep: 'Coerenza palette…' }));
        for (const [docType, patchData] of Object.entries(patch) as Array<[string, Record<string, unknown>]>) {
          const targetType = docType === 'card' ? 'businessCard' : docType;
          const doc = targets.find((d) => d.documentType === targetType);
          if (!doc || !patchData) continue;
          try {
            const current = (lastData[targetType] ?? doc.data ?? {}) as Record<string, unknown>;
            // Website: patch preferredColors va in data.brief.preferredColors
            let merged: Record<string, unknown>;
            if (targetType === 'website' && patchData.preferredColors) {
              const brief = (current.brief ?? {}) as Record<string, unknown>;
              merged = { ...current, brief: { ...brief, preferredColors: patchData.preferredColors } };
            } else {
              merged = { ...current, ...patchData };
              // Card/flyer: merge style/decorations shallow
              if (patchData.style) merged.style = { ...(current.style as Record<string, unknown>), ...(patchData.style as Record<string, unknown>) };
              if (patchData.decorations) merged.decorations = { ...(current.decorations as Record<string, unknown>), ...(patchData.decorations as Record<string, unknown>) };
            }
            lastData[targetType] = merged;
            await saveDraft(doc, merged);
            logger.info('t21: coherence patch applicata', { route: 'useAutoBuildGenerate', docType: targetType });
          } catch (err) {
            logger.warn('t21: coherence patch fallita', { route: 'useAutoBuildGenerate', docType: targetType, err: String(err) });
          }
        }
      };
      if (options?.agentMode && workList.length > 0) {
        let toolCount = 0;
        setState((prev) => ({ ...prev, currentStep: 'Agente: pianifico la generazione…' }));
        try {
          const agent = new AgentOrchestrator();
          const runTrace: RunTraceOptions = { runId, runName: 'auto-build', startRun: true, rootSpanId };
          // TB-033: reference logo del cliente compresso per vision.
          let logoReference: string | undefined;
          const rawLogo = customer.logoUrl || customer.detectedLogoUrl || null;
          if (rawLogo) {
            try {
              logoReference = (await compressDataUrl(rawLogo, 1024, 400_000)) || rawLogo;
            } catch {
              logoReference = rawLogo;
            }
          }
          // I tool ricevono i draft REALI (con default per i parziali):
          // `{}` rompeva generateCopy (size/style mancanti → TypeError
          // "reading 'undefined'" in scaledFontBounds, bug live 2026-08-13).
          const draftData = (type: string) =>
            resumed.find((d) => d.documentType === type)?.data as Record<string, unknown> | undefined;
          const agentBrief = buildAgentBrief(docs, customer);
          await agent.run(
            agentBrief,
            {
              logo: { ...createEmptyLogo(), ...draftData('logo') } as any,
              card: { ...createEmptyCard(), ...draftData('businessCard') } as any,
              flyer: { ...createEmptyFlyer(), ...draftData('flyer') } as any,
            },
            {
              modelId: options.providerId,
              customerId: options.customerId,
              runTrace,
              logoReference,
            },
            {
              include: resumed.map((t) => agentTypeOfDoc(t.documentType)).filter((t): t is NonNullable<typeof t> => t != null),
              onToolResult: async (result) => {
                toolCount++;
                const docType = docTypeOfTool(result.name);
                const doc = targets.find((d) => d.documentType === docType);
                if (!doc) return;
                setState((prev) => ({
                  ...prev,
                  currentStep: `Agente: ${result.ok ? '✓' : '✗'} ${result.name} (${toolCount} tools)`,
                }));
                if (result.ok) {
                  const data = agentResultData(docType, result);
                  if (data) {
                    let enriched = data;
                    try {
                      enriched = await enrichAgentDocWithImages(docType, data, agentBrief.description || agentBrief.businessName);
                    } catch { /* immagini best-effort: salva comunque il testo */ }
                    lastDataByTypeRef.current[docType] = { ...(doc.data as Record<string, unknown>), ...enriched };
                    await saveDraft(doc, lastDataByTypeRef.current[docType]);
                    statuses[doc.id] = 'done';
                    setStatus(doc.id, 'done');
                  }
                } else {
                  statuses[doc.id] = 'error';
                  errors[doc.id] = result.summary;
                  setStatus(doc.id, 'error');
                  setDocError(doc.id, result.summary);
                }
                persistRunState(statuses);
              },
            },
          );
          // t18: verifica visione post-loop (1 call con preview dei 3 draft).
          await runVerifyAfterAgent();
          // t21: coherence palette/fonte unificata
          await runCoherenceAfterAgent();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error('Auto-build agente fallito', { route: 'useAutoBuildGenerate', err: msg });
          for (const d of targets) {
            if (statuses[d.id] !== 'done') {
              statuses[d.id] = 'error';
              errors[d.id] = msg;
              setStatus(d.id, 'error');
              setDocError(d.id, msg);
            }
          }
          persistRunState(statuses);
        }
        // t17: tutti fatti → pulisci lo stato run.
        if (Object.values(statuses).every((s) => s === 'done')) clearRunState();
        setState((prev) => ({ ...prev, running: false, currentStep: null }));
        return { statuses, errors };
      }

      for (let i = 0; i < resumed.length; i++) {
        const doc = resumed[i];
        setStatus(doc.id, 'running');
        setDocError(doc.id, null);
        setState((prev) => ({
          ...prev,
          currentStep: `Genero ${STEP_LABEL[doc.documentType] ?? doc.documentType}… (${resumedSkip + i + 1}/${targets.length})`,
        }));
        const runTrace: RunTraceOptions = {
          runId,
          runName: 'auto-build',
          startRun: i === 0,
          rootSpanId,
          stepName: doc.documentType,
          stepSpanId: newSpanId(),
        };
        try {
          await runDoc(doc, customer, docs, { ...options, runTrace });
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
        // t17: salva dopo ogni step → resume salta i done anche se crasha a metà.
        persistRunState(statuses);
      }
      // t17: tutti fatti → pulisci lo stato run.
      if (Object.values(statuses).every((s) => s === 'done')) clearRunState();
      setState((prev) => ({ ...prev, running: false, currentStep: null }));
      return { statuses, errors };
    },
    [runDoc, setStatus, setDocError],
  );

  const generateOne = useCallback(
    async (doc: AutoBuildDoc, customer: AutoBuildCustomer, options?: AutoBuildGenerateOptions): Promise<string | null> => {
      setStatus(doc.id, 'running');
      setDocError(doc.id, null);
      setState((prev) => ({ ...prev, running: true, currentStep: `Genero ${STEP_LABEL[doc.documentType] ?? doc.documentType}…` }));
      const runTrace: RunTraceOptions = {
        runId: options?.runTrace?.runId ?? newRunId(),
        runName: 'auto-build',
        startRun: true,
        rootSpanId: options?.runTrace?.rootSpanId ?? newSpanId(),
        stepName: doc.documentType,
        stepSpanId: newSpanId(),
      };
      let genError: string | null = null;
      try {
        await runDoc(doc, customer, undefined, { ...options, runTrace });
        setStatus(doc.id, 'done');
      } catch (err) {
        genError = err instanceof Error ? err.message : String(err);
        logger.error('Auto-build draft AI fallito', { route: 'useAutoBuildGenerate', docId: doc.id, err: genError });
        setStatus(doc.id, 'error');
        setDocError(doc.id, genError);
      }
      setState((prev) => ({ ...prev, running: false, currentStep: null }));
      return genError;
    },
    [runDoc, setStatus, setDocError],
  );

  return { state, generateAll, generateOne };
}
