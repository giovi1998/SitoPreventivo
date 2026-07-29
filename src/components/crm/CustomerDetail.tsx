import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dataService from '../../utils/dataService';
import { formatAiStatsCompact } from '../../utils/aiStats';
import { useAIPalette } from '../../hooks/useAIPalette';
import { palettePreviewDataUrl } from '../../utils/palettePreview';
import { AI_IMAGE_MODELS, setAiImageModelDefault } from '../../utils/uiPrefs';
import type { PaletteConcept } from '../../ai/PaletteOrchestrator';
import { providerRegistry } from '../../ai/providers/registry';

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
  placeData?: Record<string, unknown> | null;
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

interface LogEntry {
  ts: string;
  type: 'info' | 'success' | 'error';
  msg: string;
  cost?: string;
  detail?: unknown;
}

const LOG_KEY = (id: string) => `pq_crm_log:${id}`;
const MAX_LOG = 50;

const DOC_EDITOR_VIEW: Record<string, string> = {
  logo: 'logo',
  businessCard: 'card',
  flyer: 'flyer',
};

function asStr(v: unknown): string {
  return v == null ? '' : String(v);
}

function loadLog(customerId: string): LogEntry[] {
  try {
    const raw = sessionStorage.getItem(LOG_KEY(customerId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLog(customerId: string, entries: LogEntry[]) {
  try {
    sessionStorage.setItem(LOG_KEY(customerId), JSON.stringify(entries.slice(-MAX_LOG)));
  } catch { /* quota */ }
}

export default function CustomerDetail({ customerId, onBack, onRefresh }: Props) {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [paletteCost, setPaletteCost] = useState<number | null>(null);
  const [paletteProvider, setPaletteProvider] = useState<string>('deepseek-chat');
  const [placesApiKey, setPlacesApiKey] = useState<string>('');
  const [savedKey, setSavedKey] = useState<string>('');
  const [showKey, setShowKey] = useState(false);
  const [imageGenModel, setImageGenModel] = useState<string>('gemini-3.1-flash-image');
  const palette = useAIPalette();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const providers = providerRegistry.listProviders();
  const logoStatus = customer?.logoUrl ? 'manual' : customer?.detectedLogoUrl ? 'detected' : customer?.researchStatus?.logo || 'no_logo';

  const appendLog = useCallback((type: LogEntry['type'], msg: string, cost?: string, detail?: unknown) => {
    const ts = new Date().toLocaleTimeString('it-IT');
    setLog((prev) => {
      const next = [...prev.slice(-MAX_LOG + 1), { ts, type, msg, cost, detail }];
      saveLog(customerId, next);
      return next;
    });
  }, [customerId]);

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
    setLog(loadLog(customerId));
    void load();
    void dataService.getUserSettings('admin@gmail.com').then((res) => {
      const k = (res.placesApiKey || '') as string;
      setPlacesApiKey(k);
      setSavedKey(k);
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
      appendLog('info', 'Caricamento logo manuale…', undefined, { fileName: file.name, sizeBytes: file.size, mime: file.type });
      try {
        await dataService.updateCustomer(customer.id, { logoUrl: dataUrl });
        appendLog('success', 'Logo caricato', undefined, { logoUrl: dataUrl.slice(0, 60) + '...' });
        flashSaved('logoUrl');
        await load();
        onRefresh();
        await propagateLogoToDrafts(customer.id, dataUrl);
      } catch (err) {
        appendLog('error', 'Caricamento logo fallito', undefined, { error: String(err) });
      }
    };
    reader.readAsDataURL(file);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handlePhotosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!customer) return;
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    appendLog('info', `Caricamento ${files.length} foto…`);
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
    appendLog('success', `${files.length} foto caricate (${newPhotos.length} totali)`);
    flashSaved('customerPhotos');
    await load();
    onRefresh();
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const runAction = async (key: string, fn: () => Promise<{ error?: unknown }>, logStart: string, logOk: string) => {
    setBusy(key);
    setError(null);
    appendLog('info', logStart, undefined, { action: key, customerId });
    const res = await fn();
    if (res.error) {
      setError(String(res.error));
      appendLog('error', `${logOk} fallito: ${res.error}`, undefined, { action: key, error: String(res.error) });
    } else {
      appendLog('success', logOk, undefined, { action: key });
    }
    await load();
    setBusy(null);
    onRefresh();
  };

  const handleGeneratePalettes = async () => {
    if (!customer) return;
    setBusy('palette');
    setError(null);
    const req = { businessName: customer.businessName, sector: customer.sector, mood: customer.mood, target: customer.target, activity: customer.activity, provider: paletteProvider };
    appendLog('info', `Generazione 3 palette AI (provider: ${paletteProvider})…`, undefined, { request: req });
    try {
      const result = await palette.generate({
        businessName: customer.businessName,
        sector: customer.sector,
        mood: customer.mood,
        target: customer.target,
        activity: customer.activity,
      }, { modelId: paletteProvider });
      setPaletteCost(result.costUsd);
      appendLog('success', '3 palette generate', `$${result.costUsd.toFixed(4)}`, { concepts: palette.concepts?.length, costUsd: result.costUsd });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      appendLog('error', `Palette fallita: ${msg}`, undefined, { provider: paletteProvider, error: msg });
    }
    setBusy(null);
  };

  // Applica palette ai documenti: patcha style.accentColor + decorations.palette
  const handleApplyPalette = async (concept: PaletteConcept) => {
    if (!customer) return;
    setBusy('apply-palette');
    const colorSummary = `${concept.name} · ${concept.primary} ${concept.secondary} ${concept.accent}`;
    appendLog('info', `Applico palette "${concept.name}" a cliente + documenti…`, undefined, { concept, docsCount: docs.length });
    await dataService.updateCustomer(customer.id, { preferredColors: colorSummary });
    // Patch ai documenti esistenti: card + flyer + logo
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
        await dataService.saveDocument('admin@gmail.com', { id: doc.id, documentType: doc.documentType, title: doc.title, data: updated, status: 'BOZZA' } as Record<string, unknown>);
      } else if (doc.documentType === 'logo') {
        const data = (doc.data || {}) as Record<string, unknown>;
        const builder = (data.builder || {}) as Record<string, unknown>;
        const updated = { ...data, builder: { ...builder, primaryColor: concept.primary, secondaryColor: concept.secondary } };
        await dataService.saveDocument('admin@gmail.com', { id: doc.id, documentType: doc.documentType, title: doc.title, data: updated, status: 'BOZZA' } as Record<string, unknown>);
      }
    }
    appendLog('success', `Palette "${concept.name}" applicata a ${docs.length} documenti`, undefined, { appliedTo: docs.map((d) => d.documentType) });
    await load();
    onRefresh();
    setBusy(null);
  };

  const savePlacesKey = async (value: string) => {
    const trimmed = value.trim();
    if (trimmed === savedKey) return;
    appendLog('info', trimmed ? 'Salvataggio API key Google Places…' : 'Rimozione API key Google Places…', undefined, { length: trimmed.length });
    const res = await dataService.saveUserSettings('admin@gmail.com', { placesApiKey: trimmed });
    if (res.success) {
      setSavedKey(trimmed);
      setPlacesApiKey(trimmed);
      appendLog('success', trimmed ? 'API key Google Places salvata' : 'API key Google Places rimossa', undefined, { saved: !!trimmed });
    } else {
      appendLog('error', `Errore salvataggio API key: ${res.error}`, undefined, { error: String(res.error) });
    }
  };

  const propagateLogoToDrafts = async (cid: string, logoUrl: string) => {
    const rel = docs.filter((d) => d.documentType === 'businessCard' || d.documentType === 'flyer' || d.documentType === 'logo');
    if (rel.length === 0) return;
    appendLog('info', `Propago logo caricato a ${rel.length} draft…`, undefined, { docs: rel.map((d) => d.documentType) });
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
      } else {
        continue;
      }
      await dataService.saveDocument('admin@gmail.com', { id: doc.id, documentType: doc.documentType, title: doc.title, data: updated, status: 'BOZZA' } as Record<string, unknown>);
      patched++;
    }
    appendLog('success', `Logo propagato a ${patched} draft`, undefined, { patched });
    await load();
  };

  const openDocInEditor = (doc: Doc) => {
    const view = DOC_EDITOR_VIEW[doc.documentType] || 'collection';
    navigate(`/app/${view}/${doc.id}`);
  };

  if (loading) return <div className="crm-detail"><p>Caricamento…</p></div>;
  if (error && !customer) return <div className="crm-detail"><p className="crm-error">{error}</p><button onClick={onBack}>Indietro</button></div>;
  if (!customer) return null;

  const contacts = (customer.contacts || {}) as Record<string, unknown>;
  const placeData = (customer.placeData || {}) as Record<string, unknown>;
  const photos = Array.isArray(customer.customerPhotos) ? customer.customerPhotos : [];
  const aiFields = customer.aiSuggestedFields || {};
  const hasAiFields = Object.keys(aiFields).length > 0;
  const logoPreview = customer.logoUrl || customer.detectedLogoUrl || null;

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

      <section className="crm-ai-log" data-testid="crm-ai-log">
        <div className="crm-ai-log-head">Registro operazioni AI</div>
        {log.length === 0 ? (
          <div className="crm-ai-log-empty">Nessuna operazione. Lancia research / AI fill / auto-build per vedere qui.</div>
        ) : (
          <div className="crm-ai-log-body">
            {log.map((e, i) => (
              <div key={i} className={`crm-ai-log-row crm-log-${e.type}`} onClick={() => setExpandedLog(expandedLog === i ? null : i)} style={{ cursor: e.detail ? 'pointer' : 'default' }} data-testid={`crm-log-row-${i}`}>
                <span className="crm-log-ts">{e.ts}</span>
                <span className="crm-log-icon">{e.type === 'success' ? '✓' : e.type === 'error' ? '✗' : '▶'}</span>
                <span className="crm-log-msg">{e.msg}</span>
                {e.cost && <span className="crm-log-cost">{e.cost}</span>}
                {expandedLog === i && e.detail ? (
                  <pre className="crm-log-detail" data-testid="crm-log-detail">{JSON.stringify(e.detail, null, 2)}</pre>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {customer.researchStatus && (
        <section className="crm-section" data-testid="crm-research-section">
          <h3>Research</h3>
          <div className="crm-timeline">
            <div className="crm-timeline-row">
              <span className="crm-timeline-label">Google Places</span>
              <span className={`crm-status-pill crm-status-${customer.researchStatus.places === 'ok' ? 'ok' : 'warn'}`}>
                {customer.researchStatus.places}
              </span>
            </div>
            <div className="crm-timeline-row">
              <span className="crm-timeline-label">Logo detection</span>
              <span className={`crm-status-pill crm-status-${logoStatus === 'ok' || logoStatus === 'manual' || logoStatus === 'detected' ? 'ok' : 'warn'}`} data-testid="crm-logo-status">
                {logoStatus}
              </span>
            </div>
          </div>
        </section>
      )}

      {placeData.name || placeData.formatted_address || placeData.formatted_phone_number ? (
        <section className="crm-section" data-testid="crm-nap-section">
          <h3>NAP (da Places)</h3>
          <Field label="Nome" value={placeData.name} />
          <Field label="Indirizzo" value={placeData.formatted_address} />
          <Field label="Telefono" value={placeData.formatted_phone_number} />
          <Field label="Sito" value={placeData.website} />
          <Field label="Rating" value={placeData.rating != null ? `${placeData.rating} ★` : null} />
        </section>
      ) : null}

      {hasAiFields && (
        <section className="crm-section" data-testid="crm-ai-fields-section">
          <h3>Campi suggeriti da AI <span className="crm-badge-ai">AI · $0</span></h3>
          <p className="crm-note">Lookup locale (zero costo AI). Quando integreremo DeepSeek copy, il costo sarà tracciato qui.</p>
          {Object.entries(aiFields).map(([k, v]) => (
            <Field key={k} label={k} value={v} />
          ))}
        </section>
      )}

      <section className="crm-section">
        <h3>Chiave API Google Places</h3>
        <p className="crm-note">Server-side, non esposta al browser. Salvata per admin in user settings (locale) o DB (prod). Senza chiave, research usa solo lookup locale.</p>
        <div className="crm-key-row">
          <input
            type={showKey ? 'text' : 'password'}
            value={placesApiKey}
            onChange={(e) => setPlacesApiKey(e.target.value)}
            onBlur={(e) => savePlacesKey(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') savePlacesKey((e.target as HTMLInputElement).value); }}
            placeholder="Incolla qui la tua Google Places API key"
            data-testid="crm-places-api-key"
            className="crm-key-input"
          />
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={() => setShowKey((s) => !s)}
            aria-label={showKey ? 'Nascondi chiave' : 'Mostra chiave'}
          >
            {showKey ? '🙈' : '👁️'}
          </button>
        </div>
      </section>

      <section className="crm-actions-row">
        <button onClick={() => runAction('research', () => dataService.researchCustomer(customerId), 'Lanciata auto-research', 'Research completata')} disabled={busy !== null} data-testid="crm-research-btn">
          {busy === 'research' ? 'Ricerca…' : 'Lancia research'}
        </button>
        <button onClick={() => runAction('ai-fill', () => dataService.aiFillCustomer(customerId), 'AI fill gap in corso…', 'AI fill completato (lookup locale, $0.00)')} disabled={busy !== null} data-testid="crm-ai-fill-btn">
          {busy === 'ai-fill' ? 'AI fill…' : 'AI fill gap'}
        </button>
        <button onClick={() => runAction('auto-build', () => dataService.autoBuildCustomer(customerId, false), 'Auto-build draft in corso…', 'Auto-build: draft creati')} disabled={busy !== null} data-testid="crm-auto-build-btn">
          {busy === 'auto-build' ? 'Costruzione…' : 'Auto-build draft'}
        </button>
        <button onClick={handleGeneratePalettes} disabled={busy !== null} data-testid="crm-palette-btn">
          {busy === 'palette' || palette.isProcessing ? 'Generando…' : 'Genera 3 palette'}
        </button>
      </section>

      <section className="crm-section">
        <h3>Provider AI per palette</h3>
        <select value={paletteProvider} onChange={(e) => setPaletteProvider(e.target.value)} data-testid="crm-palette-provider" className="crm-provider-select">
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.model})</option>
          ))}
        </select>
        <p className="crm-note">Seleziona il provider per la generazione palette. Gemini è solo per immagini, non disponibile qui.</p>
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
        <p className="crm-note">Apri il draft nell'editor e click “Genera” per lanciare l'AI (CON-001 quality check).</p>
        {docs.length === 0 ? (
          <p>Nessun documento. Usa “Auto-build draft” per crearli.</p>
        ) : (
          <ul className="crm-doc-list" data-testid="crm-doc-list">
            {docs.map((d) => {
              const aiStats = (d.data as Record<string, unknown> | undefined)?.aiStats as Record<string, unknown> | undefined;
              const costLabel = aiStats ? formatAiStatsCompact(aiStats as never) : null;
              return (
                <li key={d.id} className="crm-doc-row">
                  <div className="crm-doc-info">
                    <strong>{d.documentType}</strong> — {d.title || d.id}
                    {costLabel && <span className="crm-doc-cost">{costLabel}</span>}
                  </div>
                  <button onClick={() => openDocInEditor(d)} className="crm-btn-secondary crm-doc-open" data-testid={`crm-open-doc-${d.id}`}>
                    Apri editor →
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