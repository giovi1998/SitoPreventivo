import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dataService from '../../utils/dataService';
import { formatAiStatsCompact } from '../../utils/aiStats';
import { useAIPalette } from '../../hooks/useAIPalette';
import { useAutoBuildGenerate } from '../../hooks/useAutoBuildGenerate';
import { buildPreviewSvg } from '../../utils/docPreviewSvg';
import { palettePreviewDataUrl } from '../../utils/palettePreview';
import { AI_IMAGE_MODELS, setAiImageModelDefault } from '../../utils/uiPrefs';
import type { PaletteConcept } from '../../ai/PaletteOrchestrator';
import { providerRegistry } from '../../ai/providers/registry';
import { useCustomerLogger } from '../../hooks/useCustomerLogger';
import CustomerAiLogPanel from './CustomerAiLogPanel';
import CustomerResearchSection from './CustomerResearchSection';
import CustomerWebDataPanel from './CustomerWebDataPanel';

type Customer = Record<string, unknown> & {
  id: string;
  businessName: string;
  ownerName?: string | null;
  sector?: string | null;
  activity?: string | null;
  mood?: string | null;
  target?: string | null;
  preferredColors?: string | null;
  contacts?: Record<string, unknown> | null;
  package?: string | null;
  status?: string;
  notes?: string | null;
  webData?: Record<string, unknown> | null;
  webAnswers?: Record<string, unknown> | null;
  customerPhotos?: string[] | null;
  logoUrl?: string | null;
  googleMapsUrl?: string | null;
  detectedLogoUrl?: string | null;
  researchStatus?: Record<string, string> | null;
  aiSuggestedFields?: Record<string, unknown> | null;
  updatedAt?: string | null;
};

type Doc = Record<string, unknown> & {
  id: string;
  documentType: string;
  title?: string;
  data?: Record<string, unknown> | null;
};

interface Props {
  customerId: string;
  onBack: () => void;
  onRefresh: () => void;
}

const DOC_EDITOR_VIEW: Record<string, string> = {
  logo: 'logo',
  businessCard: 'card',
  flyer: 'flyer',
  website: 'website',
};

function asStr(v: unknown): string {
  return v == null ? '' : String(v);
}

function normalizeColors(colors: unknown): string[] {
  if (Array.isArray(colors)) return colors.filter((c): c is string => typeof c === 'string');
  if (colors && typeof colors === 'object') return Object.values(colors).filter((c): c is string => typeof c === 'string');
  return [];
}

function normalizeImages(images: unknown): string[] {
  return Array.isArray(images) ? images.filter((u): u is string => typeof u === 'string') : [];
}

function normalizeLinks(links: unknown): string[] {
  if (!Array.isArray(links)) return [];
  return links.filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u));
}

function truncateDataUrl(url: string): string {
  return url.length > 60 ? `${url.slice(0, 60)}…(${url.length} bytes)` : url;
}

export default function CustomerDetail({ customerId, onBack, onRefresh }: Props) {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [paletteCost, setPaletteCost] = useState<number | null>(null);
  const [aiProvider, setAiProvider] = useState<string>(() => providerRegistry.getDefaultId());
  const [aiFillCost, setAiFillCost] = useState<number | null>(null);

  const [imageGenModel, setImageGenModel] = useState<string>('gemini-3.1-flash-image');
  const palette = useAIPalette();
  const autoGen = useAutoBuildGenerate();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const providers = providerRegistry.listProviders();
  const logoStatus = customer?.logoUrl ? 'manual' : customer?.detectedLogoUrl ? 'detected' : customer?.researchStatus?.logo || 'no_logo';

  const logger = useCustomerLogger(customerId);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await dataService.getCustomer(customerId);
    if (res.error) {
      setError(res.error);
      setCustomer(null);
    } else {
      const d = res.data as Customer & { documents?: Doc[] };
      setCustomer(d);
      setDocs(d.documents || []);
    }
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    void load();
    void dataService.getUserSettings('admin@gmail.com').then((res) => {
      const img = (res.imageGenModel || 'gemini-flash-image') as string;
      setImageGenModel(img);
      setAiImageModelDefault(img);
    });
  }, [load, customerId]);

  const flashSaved = (field: string) => {
    setSavedFlash(field);
    setTimeout(() => setSavedFlash(null), 1500);
  };

  const saveField = async (field: string, value: string) => {
    if (!customer) return;
    setEditing(null);
    if (value === asStr(customer[field as keyof Customer])) return;
    await dataService.updateCustomer(customer.id, { [field]: value });
    flashSaved(field);
    await load();
    onRefresh();
  };

  const saveContact = async (key: string, value: string) => {
    if (!customer) return;
    setEditing(null);
    const contacts = { ...(customer.contacts || {}), [key]: value };
    if (value === asStr((customer.contacts || {})[key])) return;
    await dataService.updateCustomer(customer.id, { contacts });
    flashSaved(`contact_${key}`);
    await load();
    onRefresh();
  };

  const startEdit = (field: string, current: string) => {
    setEditing(field);
    setEditValue(current);
  };

  const commitEdit = () => {
    if (!editing) return;
    if (editing.startsWith('contact_')) {
      void saveContact(editing.slice(8), editValue);
    } else {
      void saveField(editing, editValue);
    }
  };

  const onEditKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && editing !== 'activity' && editing !== 'target') {
      commitEdit();
    } else if (e.key === 'Escape') {
      setEditing(null);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!customer) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      logger.appendLog('info', 'Caricamento logo manuale…', undefined, { fileName: file.name, sizeBytes: file.size, mime: file.type });
      try {
        await dataService.updateCustomer(customer.id, { logoUrl: dataUrl });
        logger.appendLog('success', 'Logo caricato', undefined, { logoUrl: truncateDataUrl(dataUrl) });
        flashSaved('logoUrl');
        await load();
        onRefresh();
        await propagateLogoToDrafts(customer.id, dataUrl);
      } catch (err) {
        logger.appendLog('error', 'Caricamento logo fallito', undefined, { error: String(err) });
      }
    };
    reader.readAsDataURL(file);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handlePhotosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!customer) return;
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    logger.appendLog('info', `Caricamento ${files.length} foto…`);
    const existing = Array.isArray(customer.customerPhotos) ? customer.customerPhotos : [];
    const newPhotos: string[] = [...existing];
    for (const file of files.slice(0, 5 - existing.length)) {
      const dataUrl = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.readAsDataURL(file);
      });
      newPhotos.push(dataUrl);
    }
    await dataService.updateCustomer(customer.id, { customerPhotos: newPhotos });
    logger.appendLog('success', `${files.length} foto caricate (${newPhotos.length} totali)`);
    flashSaved('customerPhotos');
    await load();
    onRefresh();
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  interface ActionResult {
    error?: unknown;
    data?: Record<string, unknown>;
  }

  interface ActionLogExtra {
    msg?: string;
    detail?: unknown;
    cost?: string;
  }

  const runAction = async (key: string, fn: () => Promise<ActionResult>, logStart: string, logOk: string, buildExtra?: (res: ActionResult) => ActionLogExtra) => {
    setBusy(key);
    setError(null);
    logger.appendLog('info', logStart, undefined, { action: key, customerId });
    const res = await fn();
    const extra = buildExtra?.(res) ?? {};
    if (res.error) {
      setError(String(res.error));
      const base = typeof extra.detail === 'object' && extra.detail !== null ? extra.detail as Record<string, unknown> : {};
      logger.appendLog('error', `${logOk} fallito: ${res.error}`, undefined, { action: key, ...base, error: String(res.error) });
    } else {
      logger.appendLog('success', extra.msg ?? logOk, extra.cost, extra.detail);
    }
    await load();
    setBusy(null);
    onRefresh();
  };

  const researchExtra = (res: ActionResult): ActionLogExtra => {
    const data = res.data ?? {};
    const wd = (data.webData ?? {}) as Record<string, unknown>;
    const researchStatus = (data.researchStatus ?? null) as Record<string, string> | null;
    const webStatus = researchStatus?.web ?? 'unknown';
    const hasError = webStatus !== 'ok';
    const json = (wd.json || {}) as Record<string, unknown>;
    const colorsCount = normalizeColors(wd.colors || (wd.branding as Record<string, unknown>)?.colors).length;
    const imagesCount = normalizeImages(wd.images).length;
    const linksCount = normalizeLinks(wd.links).length;
    const markdownChars = typeof wd.markdownFull === 'string' ? wd.markdownFull.length : 0;
    const title = asStr(wd.title);
    const knowledgeCount = typeof data.knowledgeCount === 'number' ? data.knowledgeCount : 0;
    const msg = hasError
      ? `Research fallita (${webStatus})`
      : `Research completata: ${title || 'sito'} · ${knowledgeCount} chunk · ${colorsCount} colori · ${imagesCount} immagini`;
    return {
      msg,
      detail: {
        title,
        description: asStr(wd.description || json.company_description),
        knowledgeCount,
        logoStatus: researchStatus?.logo ?? 'no_logo',
        colors: colorsCount,
        images: imagesCount,
        links: linksCount,
        screenshot: Boolean(wd.screenshot),
        markdownChars,
        jsonFields: Object.keys(json),
        researchStatus,
      },
    };
  };

  const aiFillExtra = (res: ActionResult): ActionLogExtra => {
    const cost = Number(res.data?.costUsd ?? 0);
    if (res.error) return {};
    setAiFillCost(cost);
    const fromAI = Boolean(res.data?.fromAI);
    const fields = Object.keys((res.data?.aiSuggestedFields ?? {}) as Record<string, unknown>);
    return fromAI
      ? { msg: 'AI fill completato via AI', cost: `$${cost.toFixed(4)}`, detail: { costUsd: cost, fields, fromAI } }
      : { msg: 'AI fill completato (lookup locale, $0.00)', detail: { costUsd: 0, fields, fromAI } };
  };

  const handleAutoBuild = async () => {
    if (!customer) return;
    setBusy('auto-build');
    setError(null);
    logger.appendLog('info', 'Auto-build draft in corso…', undefined, { action: 'auto-build', customerId });
    const prevIds = new Set(docs.map((d) => d.id));
    const res = await dataService.autoBuildCustomer(customerId, true);
    if (res.error) {
      setError(String(res.error));
      logger.appendLog('error', `Auto-build fallito: ${res.error}`, undefined, { action: 'auto-build', error: String(res.error) });
      setBusy(null);
      return;
    }
    const createdIds = new Set(((res.data as Record<string, unknown> | undefined)?.createdDocuments ?? []) as string[]);
    const fresh = await dataService.getCustomer(customerId);
    const freshDocs = (((fresh.data as (Customer & { documents?: Doc[] }) | undefined)?.documents) ?? []) as Doc[];
    const created = freshDocs.filter((d) => createdIds.has(d.id) || !prevIds.has(d.id)).map((d) => d.documentType);
    const replaced = freshDocs.filter((d) => prevIds.has(d.id) && !createdIds.has(d.id) && DOC_EDITOR_VIEW[d.documentType]).length;
    logger.appendLog('success', 'Auto-build: draft creati', undefined, { created, replaced });
    if (fresh.data) {
      setCustomer(fresh.data as Customer);
      setDocs(freshDocs);
    } else {
      await load();
    }
    setBusy(null);
    onRefresh();
  };

  const handleGeneratePalettes = async () => {
    if (!customer) return;
    setBusy('palette');
    setError(null);
    const req = { businessName: customer.businessName, sector: customer.sector, mood: customer.mood, target: customer.target, activity: customer.activity, provider: aiProvider };
    logger.appendLog('info', `Generazione 3 palette AI (provider: ${aiProvider})…`, undefined, { request: req });
    try {
      const result = await palette.generate({
        businessName: customer.businessName,
        sector: customer.sector,
        mood: customer.mood,
        target: customer.target,
        activity: customer.activity,
      }, { modelId: aiProvider });
      setPaletteCost(result.costUsd);
      logger.appendLog('success', '3 palette generate', `$${result.costUsd.toFixed(4)}`, { provider: aiProvider, concepts: palette.concepts?.length, costUsd: result.costUsd });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      logger.appendLog('error', `Palette fallita: ${msg}`, undefined, { provider: aiProvider, error: msg });
    }
    setBusy(null);
  };

  const handleApplyPalette = async (concept: PaletteConcept) => {
    if (!customer) return;
    setBusy('apply-palette');
    const colorSummary = `${concept.name} · ${concept.primary} ${concept.secondary} ${concept.accent}`;
    logger.appendLog('info', `Applico palette "${concept.name}" a cliente + documenti…`, undefined, { concept, docsCount: docs.length });
    await dataService.updateCustomer(customer.id, { preferredColors: colorSummary });
    for (const doc of docs) {
      if (doc.documentType === 'businessCard' || doc.documentType === 'flyer') {
        const data = (doc.data || {}) as Record<string, unknown>;
        const style = (data.style || {}) as Record<string, unknown>;
        const decorations = (data.decorations || {}) as Record<string, unknown>;
        const paletteObj = (decorations.palette || {}) as Record<string, unknown>;
        const updated = {
          ...data,
          style: { ...style, accentColor: concept.accent, textColor: concept.text, bgColor: concept.bg },
          decorations: { ...decorations, palette: { ...paletteObj, primary: concept.primary, secondary: concept.secondary, accent: concept.accent } },
        };
        await dataService.saveDocument('admin@gmail.com', { id: doc.id, documentType: doc.documentType, title: doc.title, customerId: customer.id, data: updated, status: 'BOZZA' } as Record<string, unknown>);
      } else if (doc.documentType === 'logo') {
        const data = (doc.data || {}) as Record<string, unknown>;
        const builder = (data.builder || {}) as Record<string, unknown>;
        const updated = { ...data, builder: { ...builder, primaryColor: concept.primary, secondaryColor: concept.secondary } };
        await dataService.saveDocument('admin@gmail.com', { id: doc.id, documentType: doc.documentType, title: doc.title, customerId: customer.id, data: updated, status: 'BOZZA' } as Record<string, unknown>);
      }
    }
    logger.appendLog('success', `Palette "${concept.name}" applicata a ${docs.length} documenti`, undefined, { appliedTo: docs.map((d) => d.documentType) });
    await load();
    onRefresh();
    setBusy(null);
  };

  const propagateLogoToDrafts = async (cid: string, logoUrl: string) => {
    const rel = docs.filter((d) => d.documentType === 'businessCard' || d.documentType === 'flyer' || d.documentType === 'logo' || d.documentType === 'website');
    if (rel.length === 0) return;
    logger.appendLog('info', `Propago logo caricato a ${rel.length} draft…`, undefined, { docs: rel.map((d) => d.documentType) });
    let patched = 0;
    for (const doc of rel) {
      const data = (doc.data || {}) as Record<string, unknown>;
      let updated: Record<string, unknown>;
      if (doc.documentType === 'businessCard') {
        const front = (data.front || {}) as Record<string, unknown>;
        updated = { ...data, front: { ...front, logoUrl } };
      } else if (doc.documentType === 'flyer') {
        updated = { ...data };
      } else if (doc.documentType === 'logo') {
        const builder = (data.builder || {}) as Record<string, unknown>;
        updated = { ...data, builder: { ...builder, backgroundImage: logoUrl }, autoGeneratePending: false };
      } else if (doc.documentType === 'website') {
        updated = { ...data, logoUrl };
      } else {
        continue;
      }
      await dataService.saveDocument('admin@gmail.com', { id: doc.id, documentType: doc.documentType, title: doc.title, customerId: cid, data: updated, status: 'BOZZA' } as Record<string, unknown>);
      patched++;
    }
    logger.appendLog('success', `Logo propagato a ${patched} draft`, undefined, { patched });
    await load();
  };

  const openDocInEditor = (doc: Doc) => {
    const view = DOC_EDITOR_VIEW[doc.documentType] || 'collection';
    navigate(`/app/${view}/${doc.id}`);
  };

  const handleGenerateAll = async () => {
    if (!customer) return;
    logger.appendLog('info', `Generazione bozze AI in corso (provider: ${aiProvider})…`, undefined, { docs: docs.length, provider: aiProvider });
    const summary = await autoGen.generateAll(docs, customer, { providerId: aiProvider });
    const fresh = await dataService.getCustomer(customerId);
    const freshDocs = (((fresh.data as (Customer & { documents?: Doc[] }) | undefined)?.documents) ?? []) as Doc[];
    const perDoc = docs
      .filter((d) => DOC_EDITOR_VIEW[d.documentType])
      .map((d) => {
        const status = summary?.statuses?.[d.id] ?? autoGen.state.statuses[d.id];
        const docError = summary?.errors?.[d.id] ?? autoGen.state.errors?.[d.id];
        const freshDoc = freshDocs.find((x) => x.id === d.id);
        const aiStats = (freshDoc?.data as Record<string, unknown> | undefined)?.aiStats as { totalCostUsd?: string } | undefined;
        const costUsd = parseFloat(String(aiStats?.totalCostUsd ?? '0')) || 0;
        return {
          title: d.title || d.id,
          status: status ?? 'skipped',
          provider: aiProvider,
          ...(costUsd > 0 ? { costUsd } : {}),
          ...(docError ? { error: docError } : {}),
        };
      });
    const hasError = perDoc.some((p) => p.status === 'error');
    logger.appendLog(hasError ? 'error' : 'success', hasError ? 'Generazione bozze AI completata con errori' : 'Generazione bozze AI completata', undefined, perDoc);
    if (fresh.data) {
      setCustomer(fresh.data as Customer);
      setDocs(freshDocs);
    } else {
      await load();
    }
    onRefresh();
  };

  const handleGenerateOne = async (doc: Doc) => {
    if (!customer) return;
    logger.appendLog('info', `Rigenero bozza ${doc.documentType} (provider: ${aiProvider})…`, undefined, { docId: doc.id, provider: aiProvider });
    await autoGen.generateOne(doc, customer, { providerId: aiProvider });
    const fresh = await dataService.getCustomer(customerId);
    const freshDocs = (((fresh.data as (Customer & { documents?: Doc[] }) | undefined)?.documents) ?? []) as Doc[];
    const freshDoc = freshDocs.find((x) => x.id === doc.id);
    const aiStats = (freshDoc?.data as Record<string, unknown> | undefined)?.aiStats as { totalCostUsd?: string } | undefined;
    const costUsd = parseFloat(String(aiStats?.totalCostUsd ?? '0')) || 0;
    const genError = autoGen.state.errors?.[doc.id] ?? null;
    logger.appendLog(
      genError ? 'error' : 'success',
      genError ? `Rigenerazione ${doc.documentType} fallita: ${genError}` : `Bozza ${doc.documentType} rigenerata`,
      costUsd > 0 ? `$${costUsd.toFixed(4)}` : undefined,
      { docId: doc.id, provider: aiProvider, ...(costUsd > 0 ? { costUsd } : {}), ...(genError ? { error: genError } : {}) },
    );
    if (fresh.data) {
      setCustomer(fresh.data as Customer);
      setDocs(freshDocs);
    } else {
      await load();
    }
    onRefresh();
  };

  if (loading) return <div className="crm-detail"><p>Caricamento…</p></div>;
  if (error && !customer) return <div className="crm-detail"><p className="crm-error">{error}</p><button onClick={onBack}>Indietro</button></div>;
  if (!customer) return null;

  const contacts = (customer.contacts || {}) as Record<string, unknown>;
  const photos = Array.isArray(customer.customerPhotos) ? customer.customerPhotos : [];
  const aiFields = customer.aiSuggestedFields || {};
  const hasAiFields = Object.keys(aiFields).length > 0;
  const logoPreview = customer.logoUrl || customer.detectedLogoUrl || null;
  const pendingDrafts = docs.filter((d) => DOC_EDITOR_VIEW[d.documentType] && (d.data as Record<string, unknown> | undefined)?.autoGeneratePending);
  const webData = (customer.webData || {}) as Record<string, unknown>;
  const markdownFull = typeof webData.markdownFull === 'string' && webData.markdownFull ? webData.markdownFull : null;
  const siteColors = normalizeColors(webData.colors);
  const siteImages = normalizeImages(webData.images);
  const siteScreenshot = typeof webData.screenshot === 'string' ? webData.screenshot : null;
  const siteLinks = normalizeLinks(webData.links);
  const siteJson = (webData.json || null) as Record<string, unknown> | null;
  const hasWebData = Boolean(
    webData.title || webData.description || webData.markdownPreview || markdownFull || siteColors.length || siteImages.length || siteScreenshot || siteLinks.length || siteJson,
  );

  // TB-019+ landing: risposte form per futura landing page (webAnswers).
  const webAnswers = (customer.webAnswers || {}) as Record<string, string | undefined>;
  const webAnswerEntries = Object.entries(webAnswers).filter(([, v]) => typeof v === 'string' && v.trim());
  const hasWebAnswers = webAnswerEntries.length > 0;
  const webAnswerLabels: Record<string, string> = {
    wantsPage: 'Vuole pagina web',
    headline: 'Testo principale',
    offer: 'Cosa offre',
    cta: 'CTA',
    tone: 'Tono',
  };

  const renderField = (field: string, label: string, value: unknown, textarea = false) => {
    const v = asStr(value);
    const isEditing = editing === field;
    const isSaved = savedFlash === field;
    return (
      <div className="crm-field">
        <span className="crm-field-label">{label}</span>
        {isEditing ? (
          textarea ? (
            <textarea
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={onEditKey}
              rows={2}
              data-testid={`crm-edit-${field}`}
            />
          ) : (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={onEditKey}
              data-testid={`crm-edit-${field}`}
            />
          )
        ) : (
          <span
            className={`crm-field-value crm-editable ${isSaved ? 'crm-saved' : ''}`}
            onClick={() => startEdit(field, v)}
            title="Click per modificare"
          >
            {v || '—'}
            {isSaved && <span className="crm-saved-badge">✓</span>}
          </span>
        )}
      </div>
    );
  };

  const renderContact = (key: string, label: string) => {
    const v = asStr(contacts[key]);
    const field = `contact_${key}`;
    const isEditing = editing === field;
    const isSaved = savedFlash === field;
    return (
      <div className="crm-field">
        <span className="crm-field-label">{label}</span>
        {isEditing ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={onEditKey}
            data-testid={`crm-edit-${field}`}
          />
        ) : (
          <span
            className={`crm-field-value crm-editable ${isSaved ? 'crm-saved' : ''}`}
            onClick={() => startEdit(field, v)}
            title="Click per modificare"
          >
            {v || '—'}
            {isSaved && <span className="crm-saved-badge">✓</span>}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="crm-detail" data-testid="crm-detail">
      <button onClick={onBack} className="crm-btn-secondary" data-testid="crm-back">← Indietro</button>
      <h2 data-testid="crm-detail-title">{customer.businessName}</h2>
      <p className="crm-detail-status">Status: <strong>{customer.status || 'new'}</strong>{customer.updatedAt && ` · aggiornato ${new Date(customer.updatedAt as string).toLocaleString('it-IT')}`}</p>

      {error && <p className="crm-error">{error}</p>}

      <section className="crm-section">
        <h3>Brief</h3>
        {renderField('businessName', 'Nome attività', customer.businessName)}
        {renderField('ownerName', 'Referente', customer.ownerName)}
        {renderField('sector', 'Settore', customer.sector)}
        {renderField('activity', 'Attività', customer.activity, true)}
        {renderField('mood', 'Mood', customer.mood)}
        {renderField('target', 'Target', customer.target, true)}
        {renderField('preferredColors', 'Colori preferiti', customer.preferredColors)}
      </section>

      <section className="crm-section">
        <h3>Contatti</h3>
        {renderContact('email', 'Email')}
        {renderContact('phone', 'Telefono')}
        {renderContact('address', 'Indirizzo')}
        {renderContact('website', 'Sito')}
        {renderField('googleMapsUrl', 'Google Maps', customer.googleMapsUrl)}
      </section>

      <section className="crm-section">
        <h3>Materiali (manuali)</h3>
        <p className="crm-note">Carica logo/foto se hai già materiali. Auto-research userà questi prima di cercare online. Se carichi un logo, il draft logo verrà saltato in auto-build.</p>
        <div className="crm-upload-row">
          <div className="crm-upload-block">
            <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} id="crm-logo-upload" hidden data-testid="crm-logo-upload" />
            <label htmlFor="crm-logo-upload" className="crm-btn-secondary">Carica logo</label>
            {logoPreview && (
              <div className="crm-logo-preview-wrap" data-testid="crm-logo-preview">
                <img src={logoPreview} alt="Logo caricato" className="crm-logo-preview" />
                <span className="crm-logo-check">✓</span>
              </div>
            )}
          </div>
          <div className="crm-upload-block">
            <input ref={photoInputRef} type="file" accept="image/*" multiple onChange={handlePhotosUpload} id="crm-photos-upload" hidden data-testid="crm-photos-upload" />
            <label htmlFor="crm-photos-upload" className="crm-btn-secondary">Carica foto (max 5)</label>
          </div>
        </div>
        {photos.length > 0 && (
          <div className="crm-photo-grid" data-testid="crm-photos-section">
            {photos.map((p, i) => (
              <img key={i} src={p} alt={`Foto ${i + 1}`} className="crm-photo-thumb" />
            ))}
          </div>
        )}
      </section>

      <CustomerAiLogPanel
        log={logger.log}
        expandedLog={logger.expandedLog}
        setExpandedLog={logger.setExpandedLog}
        logCopied={logger.logCopied}
        copyLog={logger.copyLog}
        clearLog={logger.clearLog}
      />

      {customer.researchStatus && (
        <CustomerResearchSection researchStatus={customer.researchStatus} logoStatus={logoStatus} />
      )}

      {hasWebData && (
        <CustomerWebDataPanel webData={webData} />
      )}

      {hasWebAnswers && (
        <section className="crm-section" data-testid="crm-web-answers-section">
          <h3>Risposte form pagina web</h3>
          <p className="crm-note">Brief landing page dal form intake (generazione non ancora attiva).</p>
          {webAnswerEntries.map(([k, v]) => (
            <Field key={k} label={webAnswerLabels[k] || k} value={v} />
          ))}
        </section>
      )}

      {hasAiFields && (
        <section className="crm-section" data-testid="crm-ai-fields-section">
          <h3>Campi suggeriti da AI <span className="crm-badge-ai" data-testid="crm-ai-fields-badge">{aiFillCost != null && aiFillCost > 0 ? `AI · $${aiFillCost.toFixed(4)}` : 'AI · $0'}</span></h3>
          <p className="crm-note">Suggerimenti generati da AI (MiniMax M3). Fallback lookup locale se AI non disponibile.</p>
          {Object.entries(aiFields).map(([k, v]) => (
            <Field key={k} label={k} value={v} />
          ))}
        </section>
      )}

      <section className="crm-actions-row">
        <button onClick={() => runAction('research', () => dataService.researchCustomer(customerId), 'Lanciata auto-research', 'Research completata', researchExtra)} disabled={busy !== null} data-testid="crm-research-btn" title="Scarica dati dal sito cliente (Firecrawl) e rileva il logo (zero AI)">
          {busy === 'research' ? 'Ricerca…' : 'Lancia research'}
        </button>
        <button onClick={() => runAction('ai-fill', () => dataService.aiFillCustomer(customerId), 'AI fill gap in corso…', 'AI fill completato', aiFillExtra)} disabled={busy !== null} data-testid="crm-ai-fill-btn" title="Compila i campi mancanti con AI (MiniMax M3); fallback lookup locale a costo zero">
          {busy === 'ai-fill' ? 'AI fill…' : 'AI fill gap'}
        </button>
        <button onClick={handleAutoBuild} disabled={busy !== null} data-testid="crm-auto-build-btn" title="Crea/aggiorna bozze statiche dai dati cliente (zero AI)">
          {busy === 'auto-build' ? 'Costruzione…' : 'Auto-build draft'}
        </button>
        <button onClick={handleGenerateAll} disabled={busy !== null || autoGen.state.running || pendingDrafts.length === 0} data-testid="crm-generate-drafts-btn" title="Genera contenuti reali con AI sui draft (costo AI)">
          {autoGen.state.running ? (autoGen.state.currentStep || 'Generazione…') : 'Genera bozze AI'}
        </button>
        <button onClick={handleGeneratePalettes} disabled={busy !== null} data-testid="crm-palette-btn" title="Suggerisce 3 palette colori coerenti col brief via AI (costo AI)">
          {busy === 'palette' || palette.isProcessing ? 'Generando…' : 'Genera 3 palette'}
        </button>
      </section>

      <section className="crm-section">
        <h3>Provider AI</h3>
        <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value)} data-testid="crm-ai-provider" className="crm-provider-select">
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.model})</option>
          ))}
        </select>
        <p className="crm-note">Provider usato per palette e "Genera bozze AI". Gemini è solo per immagini, non disponibile qui.</p>
      </section>

      <section className="crm-section">
        <h3>Modello AI per immagini</h3>
        <select value={imageGenModel} onChange={(e) => { const v = e.target.value; setImageGenModel(v); setAiImageModelDefault(v); void dataService.saveUserSettings('admin@gmail.com', { imageGenModel: v }); }} data-testid="crm-image-model" className="crm-provider-select">
          {AI_IMAGE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <p className="crm-note">Modello usato per generare background logo, cover card, hero flyer. Salvato in user settings e sincronizzato con i pannelli AI.</p>
      </section>

      {palette.error && <p className="crm-error">Palette: {palette.error}</p>}

      {palette.concepts.length > 0 && (
        <section className="crm-section" data-testid="crm-palette-section">
          <h3>3 palette suggerite <span className="crm-badge-ai">AI{paletteCost != null ? ` · $${paletteCost.toFixed(4)}` : ''}</span></h3>
          <div className="crm-palette-grid" data-testid="crm-palette-grid">
            {palette.concepts.map((c, i) => (
              <div key={i} className="crm-palette-card">
                <img src={palettePreviewDataUrl(c)} alt={c.name} className="crm-palette-preview" />
                <div className="crm-palette-actions">
                  <button onClick={() => handleApplyPalette(c)} disabled={busy !== null} data-testid={`crm-apply-palette-${i}`}>
                    Applica a documenti
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="crm-section" data-testid="crm-docs-section">
        <h3>Documenti collegati ({docs.length})</h3>
        <p className="crm-note">Usa “Genera bozze AI” per generare i contenuti dei draft in sequenza (logo → card → flyer), oppure apri il singolo draft nell'editor.</p>
        {docs.length === 0 ? (
          <p>Nessun documento. Usa “Auto-build draft” per crearli.</p>
        ) : (
          <ul className="crm-doc-list" data-testid="crm-doc-list">
            {docs.map((d) => {
              const aiStats = (d.data as Record<string, unknown> | undefined)?.aiStats as Record<string, unknown> | undefined;
              const costLabel = aiStats ? formatAiStatsCompact(aiStats as never) : null;
              const genStatus = autoGen.state.statuses[d.id];
              const previewSvg = DOC_EDITOR_VIEW[d.documentType]
                ? buildPreviewSvg({ ...(d.data || {}), documentType: d.documentType })
                : '';
              return (
                <li key={d.id} className="crm-doc-row">
                  {previewSvg && (
                    <div className="crm-doc-thumb" data-testid={`crm-doc-preview-${d.id}`} dangerouslySetInnerHTML={{ __html: previewSvg }} />
                  )}
                  <div className="crm-doc-info">
                    <strong>{d.documentType}</strong> — {d.title || d.id}
                    {costLabel && <span className="crm-doc-cost">{costLabel}</span>}
                    {genStatus && (
                      <span className={`crm-doc-gen crm-doc-gen-${genStatus}`} data-testid={`crm-doc-gen-${d.id}`} title={autoGen.state.errors?.[d.id] || undefined}>
                        {genStatus === 'running' ? '⏳ generazione…' : genStatus === 'done' ? '✓ generato' : genStatus === 'error' ? '✗ errore' : 'in coda'}
                      </span>
                    )}
                  </div>
                  <button onClick={() => handleGenerateOne(d)} className="crm-btn-secondary crm-doc-regen" disabled={autoGen.state.running} data-testid={`crm-regen-doc-${d.id}`}>
                    Rigenera
                  </button>
                  <button
                    onClick={() => openDocInEditor(d)}
                    className="crm-btn-secondary crm-doc-open"
                    disabled={genStatus === 'running'}
                    title={genStatus === 'running' ? 'Attendi il completamento della generazione AI' : undefined}
                    data-testid={`crm-open-doc-${d.id}`}
                  >
                    {genStatus === 'running' ? 'Generazione…' : 'Apri editor →'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  const text = value == null || value === '' ? '—' : String(value);
  return (
    <div className="crm-field">
      <span className="crm-field-label">{label}</span>
      <span className="crm-field-value">{text}</span>
    </div>
  );
}