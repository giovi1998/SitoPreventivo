import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './QREditor.css';
import PreviewWatermark from './PreviewWatermark';
import AILogPanel from './AILogPanel';
import { useDocumentSave } from '../hooks/useDocumentSave';
import { useAIFlyer } from '../hooks/useAIFlyer';
import type { Flyer, FlyerSize, FlyerOrientation, FlyerLayout, FlyerContent } from '../utils/documentSchemas';
import { createEmptyFlyer, createFlyerTemplate, mergeFlyerWithDefaults, FLYER_SIZES, FLYER_LAYOUTS, FLYER_SECTORS, FLYER_SECTOR_DEFAULT_LAYOUT, FLYER_BRIEF_MAX, FLYER_HEADLINE_MAX, FLYER_SUBHEADLINE_MAX, FLYER_BODY_MAX, FLYER_CTA_LABEL_MAX, FLYER_HERO_MAX_RAW_BYTES, FLYER_HERO_MAX_DIMENSION, FLYER_HERO_MAX_AFTER_COMPRESS, getFlyerDimensions } from '../utils/documentSchemas';
import { generateFlyerPdf, generateFlyerPng, buildFlyerSvg } from '../utils/flyerGenerator';
import { isHttpUrl } from '../utils/qrGenerator';
import dataService from '../utils/dataService';
import SaveDialog from './SaveDialog';
import { useToast } from '../hooks/useToast';
import { logger } from '../utils/logger';

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

const SIZE_LABELS: Record<FlyerSize, string> = {
  A6: 'A6 (105×148mm)',
  A5: 'A5 (148×210mm)',
  A4: 'A4 (210×297mm)',
  Letter: 'Letter (216×279mm)',
  Square: 'Square (210×210mm)',
};

const LAYOUT_LABELS: Record<FlyerLayout, string> = {
  classic: 'Classico',
  centered: 'Centrato',
  split: 'Diviso',
  magazine: 'Magazine',
};

// Phase 3 AI: brief suggeriti come "chip" cliccabili. Cliccare un chip
// pre-popola la textarea, l'utente poi clicca "Genera copy". Lista
// tenuta corta (5 entry) per non sopraffare la UI.
const SUGGESTED_PROMPTS: string[] = [
  'Sagra del paese, 15-17 agosto, ingresso gratis, musica dal vivo, cucina tipica',
  'Cena di degustazione, 5 portate, venerdì 20:30, posti limitati',
  'Apertura nuovo negozio, via Roma 23, sconto 10% il giorno dell\'inaugurazione',
  'Salone bellezza, promo taglio+piega -20%, valido solo questo weekend',
  'Notte bianca in centro, negozi aperti fino a mezzanotte, musica dal vivo',
];

// Phase 3 AI: azioni rapide di raffinamento. Ciascuna ha un'icona, un
// label corto e una descrizione one-liner per rendere il pulsante
// auto-esplicativo (no need to hover per capire cosa fa).
const QUICK_REFINE: Array<{ action: 'simplify' | 'formal' | 'young' | 'urgent'; label: string; icon: string; description: string }> = [
  { action: 'simplify', label: 'Semplifica',     icon: '✂️', description: 'Riduci il body, mantieni headline' },
  { action: 'formal',   label: 'Più formale',   icon: '🎩', description: 'Riformula in tono professionale' },
  { action: 'young',    label: 'Più giovanile', icon: '⚡', description: 'Riformula in tono diretto e fresco' },
  { action: 'urgent',   label: 'Più urgenza',   icon: '⏰', description: 'Aggiungi scarsità nel body e nella CTA' },
];

// Phase 3: lista curata di font safe (no CORS issues, no font-loading
// ritardato in export). Stessa filosofia del bigliettino: select con
// 9 opzioni verificate + fallback "Personalizzato" per chi vuole
// digitare un font custom (es. caricato via Google Fonts).
const FLYER_FONTS: Array<{ value: string; label: string }> = [
  { value: 'Inter, sans-serif',       label: 'Inter (sans-serif, moderno)' },
  { value: 'Roboto, sans-serif',      label: 'Roboto (sans-serif, Android)' },
  { value: 'Open Sans, sans-serif',   label: 'Open Sans (sans-serif, leggibile)' },
  { value: 'Lato, sans-serif',        label: 'Lato (sans-serif, elegante)' },
  { value: 'Montserrat, sans-serif',  label: 'Montserrat (sans-serif, geometrico)' },
  { value: 'Poppins, sans-serif',     label: 'Poppins (sans-serif, arrotondato)' },
  { value: 'Georgia, serif',          label: 'Georgia (serif, classico)' },
  { value: 'Times New Roman, serif',  label: 'Times New Roman (serif, tradizionale)' },
  { value: 'Courier New, monospace',  label: 'Courier New (monospace)' },
];

// Section: identica al preventivo (EditorView). Riusa le classi
// globali .collapsible, .collapsible-head, .collapsible-body.
function Section({ title, defaultOpen = true, children, extra, badge }: {
  title: string; defaultOpen?: boolean; children: React.ReactNode; extra?: React.ReactNode; badge?: string | number;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className={`collapsible ${open ? 'open' : ''}`}>
      <div className="collapsible-head" onClick={() => setOpen(!open)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } }}>
        <span className="collapsible-title">
          {title}
          {badge !== undefined && <span className="collapsible-badge">{badge}</span>}
        </span>
        <div className="collapsible-head-right">
          {extra && <span onClick={(e) => e.stopPropagation()}>{extra}</span>}
          <svg className="collapsible-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
        </div>
      </div>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

const SECTOR_LABELS: Record<typeof FLYER_SECTORS[number], string> = {
  ristorante: 'Ristorante',
  evento: 'Evento',
  salone: 'Salone',
  negozio: 'Negozio',
};

function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

async function compressHeroImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > FLYER_HERO_MAX_DIMENSION || height > FLYER_HERO_MAX_DIMENSION) {
          const ratio = FLYER_HERO_MAX_DIMENSION / Math.max(width, height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas non disponibile'));
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.85;
        const tryCompress = () => {
          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error('Compressione fallita'));
            if (blob.size <= FLYER_HERO_MAX_AFTER_COMPRESS || quality <= 0.3) {
              const fr = new FileReader();
              fr.onload = () => resolve(String(fr.result || ''));
              fr.onerror = () => reject(new Error('Lettura fallita'));
              fr.readAsDataURL(blob);
            } else {
              quality -= 0.1;
              tryCompress();
            }
          }, 'image/jpeg', quality);
        };
        tryCompress();
      };
      img.onerror = () => reject(new Error('Immagine non valida'));
      img.src = dataUri;
    };
    reader.onerror = () => reject(new Error('Lettura file fallita'));
    reader.readAsDataURL(file);
  });
}

interface FlyerEditorProps {
  userEmail: string;
  initialFlyer?: Flyer;
  tier?: 'free' | 'unlocked';
}

export default function FlyerEditor({ userEmail, initialFlyer, tier = 'unlocked' }: FlyerEditorProps) {
  const { save: saveDocumentGuarded, documentCount, documentLimit } = useDocumentSave();
  const { addToast } = useToast();
  const [flyer, setFlyer] = useState<Flyer>(() => mergeFlyerWithDefaults(initialFlyer));
  // Free tier: il salvataggio e l'export sono disabilitati quando
  // l'utente ha raggiunto il limite. L'unlock resta possibile via
  // redeem code (TierLimitModal) o admin (admin/unlock-user). Per
  // gli utenti unlocked il limite è null e il check passa sempre.
  const limitReached = tier === 'free' && documentLimit !== null && documentCount >= documentLimit;
  const [showTemplateBanner, setShowTemplateBanner] = useState<boolean>(() => !initialFlyer);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  // Mostra l'input custom font se il volantino caricato ha un font che
  // non è nella lista safe (es. legacy Google Fonts, o salvato
  // prima di questa UI). Così l'utente non perde il font selezionato.
  useEffect(() => {
    if (initialFlyer && !FLYER_FONTS.some((f) => f.value === flyer.style.fontFamily)) {
      setShowCustomFont(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Phase 3 AI: state is inlined (model CardAIControls) instead of a
  // modal. The textarea holds the brief; the 4 quick actions pass a
  // hardcoded prompt + call generate/refine. AILogPanel surfaces the
  // stream/result so the user can see what the AI is doing.
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiModel, setAiModel] = useState('deepseek-chat');
  const [aiTone, setAiTone] = useState<'formale' | 'giovanile' | 'tecnico'>('formale');
// Layout pattern identico al preventivo: 3 colonne (AI | Form | Preview)
  // con pannelli collassabili. Mobile: bottom bar con tab. Focus mode
  // nasconde AI e Form, mostra solo il preview a tutta larghezza.
  const [showAi, setShowAi] = useState(true);
  const [showManual, setShowManual] = useState(true);
  const [previewFocus, setPreviewFocus] = useState(false);
  const [mobileTab, setMobileTab] = useState<'ai' | 'manual' | null>(null);
  const [heroError, setHeroError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'png' | null>(null);
  const [showCustomFont, setShowCustomFont] = useState<boolean>(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ai = useAIFlyer(userEmail);

  const debouncedFlyer = useDebouncedValue(flyer, 300);

  // Auto-save every 30s when there's content
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      if (!flyerHasContent(flyer)) return;
      const sanitized = sanitizeForSave(flyer, userEmail);
      saveDocumentGuarded(userEmail, sanitized).then((result) => {
        if (result.blocked) {
          addToast('info', 'Limite piano free raggiunto. Sblocca per continuare.');
        } else if (result.error) {
          logger.error('Flyer auto-save failed', { err: result.error });
        }
      });
    }, 30000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [flyer, userEmail, saveDocumentGuarded, addToast]);

  const updateContent = useCallback((patch: Partial<FlyerContent>) => {
    setFlyer((prev) => ({
      ...prev,
      content: { ...prev.content, ...patch, cta: { ...prev.content.cta, ...(patch.cta || {}) } },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const updateStyle = useCallback(<K extends keyof Flyer['style']>(key: K, value: Flyer['style'][K]) => {
    setFlyer((prev) => ({ ...prev, style: { ...prev.style, [key]: value }, updatedAt: new Date().toISOString() }));
  }, []);

  const updateSize = useCallback((size: FlyerSize) => {
    setFlyer((prev) => {
      const next: Flyer = { ...prev, size, updatedAt: new Date().toISOString() };
      // Square is always 210×210, ignore orientation; keep current for other sizes.
      return next;
    });
  }, []);

  const updateOrientation = useCallback((orientation: FlyerOrientation) => {
    setFlyer((prev) => {
      if (prev.size === 'Square') return prev; // Square ignores orientation
      return { ...prev, orientation, updatedAt: new Date().toISOString() };
    });
  }, []);

  const updateLayout = useCallback((layout: FlyerLayout) => updateStyle('layout', layout), [updateStyle]);

  const updateTitle = useCallback((title: string) => {
    setFlyer((prev) => ({ ...prev, title, updatedAt: new Date().toISOString() }));
  }, []);

  const [activeSector, setActiveSector] = useState<typeof FLYER_SECTORS[number]>('ristorante');

  const applySector = useCallback((sector: typeof FLYER_SECTORS[number]) => {
    setActiveSector(sector);
    setFlyer(createFlyerTemplate(sector));
    setShowTemplateBanner(false);
    addToast('info', `Template ${SECTOR_LABELS[sector]} caricato`);
  }, [addToast]);

  const applySectorLayout = useCallback(
    (layout: FlyerLayout) => {
      setFlyer(createFlyerTemplate(activeSector, layout));
      addToast('info', `${SECTOR_LABELS[activeSector]} · ${LAYOUT_LABELS[layout]}`);
    },
    [activeSector, addToast]
  );

  // Reset to a brand-new empty flyer (mirrors the card's "Nuovo / reset"
  // button). Re-opens the sector template banner so the user can either
  // start from a template or click the X to write from scratch. The AI
  // session is preserved across resets (different from a hard page
  // reload): the user keeps the conversation history if they restart.
  const resetFlyer = useCallback(() => {
    setFlyer(createEmptyFlyer());
    setShowTemplateBanner(true);
    setActiveSector('ristorante');
    setHeroError(null);
    addToast('info', 'Nuovo volantino vuoto pronto');
  }, [addToast]);

  const handleHeroUpload = useCallback(async (file: File) => {
    setHeroError(null);
    if (!/^image\/(png|jpeg|jpg|webp|svg\+xml)$/.test(file.type)) {
      setHeroError('Formato non supportato. Usa PNG, JPEG, WebP o SVG.');
      return;
    }
    if (file.size > FLYER_HERO_MAX_RAW_BYTES) {
      setHeroError('File troppo grande. Max 5MB.');
      return;
    }
    try {
      const dataUri = await compressHeroImage(file);
      updateContent({ heroImage: dataUri });
    } catch (err) {
      setHeroError((err as Error).message || 'Errore compressione');
    }
  }, [updateContent]);

  const removeHero = useCallback(() => {
    updateContent({ heroImage: null });
    setHeroError(null);
  }, [updateContent]);

  // Phase 3 AI inline panel (model CardAIControls). The brief is taken
  // from the aiPrompt textarea; a hardcoded prompt is used for each
  // quick action. The tone is appended to the prompt for "Genera".
  // The orchestrator returns a fully merged Flyer that we set as state;
  // the user sees the result in the live preview + form immediately.
  const handleGenerate = useCallback(async () => {
    const brief = aiPrompt.trim();
    if (!brief) {
      addToast('info', 'Scrivi un brief nel campo AI prima di generare.');
      return;
    }
    try {
      const result = await ai.generate(debouncedFlyer, brief, aiTone, { modelId: aiModel });
      if (result.applied) {
        setFlyer(result.flyer);
        addToast('success', 'Copy generato e applicato');
        setAiPrompt('');
      } else {
        addToast('error', "L'AI non ha restituito un risultato valido. Riprova o riformula il brief.");
      }
    } catch (err) {
      addToast('error', (err as Error).message);
    }
  }, [ai, aiPrompt, aiTone, aiModel, debouncedFlyer, addToast]);

  const handleRefine = useCallback(async (action: 'simplify' | 'formal' | 'young' | 'urgent') => {
    if (!flyerHasCopy(flyer)) {
      addToast('info', 'Compila prima il copy per poterlo rifinire.');
      return;
    }
    try {
      const result = await ai.refine(flyer, action, { modelId: aiModel });
      if (result.applied) {
        setFlyer(result.flyer);
        addToast('success', `Copy aggiornato: ${action}`);
      } else {
        addToast('error', "L'AI non ha restituito un risultato valido. Riprova.");
      }
    } catch (err) {
      addToast('error', (err as Error).message);
    }
  }, [ai, aiModel, flyer, addToast]);

  const handleAiReset = useCallback(() => {
    ai.reset();
    addToast('info', 'Sessione AI azzerata');
  }, [ai, addToast]);

  const exportPdf = useCallback(async () => {
    setExporting('pdf');
    try {
      const bytes = await generateFlyerPdf(flyer, { tier });
      const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${flyer.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', 'PDF scaricato');
    } catch (err) {
      addToast('error', (err as Error).message);
    } finally {
      setExporting(null);
    }
  }, [flyer, tier, addToast]);

  const exportPng = useCallback(async () => {
    setExporting('png');
    try {
      const bytes = await generateFlyerPng(flyer, { tier });
      const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${flyer.id}.png`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', 'PNG scaricato');
    } catch (err) {
      addToast('error', (err as Error).message);
    } finally {
      setExporting(null);
    }
  }, [flyer, tier, addToast]);

  const handleSave = useCallback((customName: string) => {
    const title = customName || flyer.title || 'Volantino';
    const toSave: Flyer = sanitizeForSave({ ...flyer, title }, userEmail);
    dataService.saveDocument(userEmail, toSave)
      .then((result) => {
        if (result.error) {
          addToast('error', result.error);
          return;
        }
        setFlyer(toSave);
        addToast('success', `«${title}» salvato`);
      })
      .catch((err) => addToast('error', (err as Error).message || 'Errore salvataggio'));
  }, [flyer, userEmail, addToast]);

  const openSaveDialog = useCallback(() => {
    if (!flyerHasContent(flyer)) {
      addToast('info', 'Compila almeno il titolo o il copy prima di salvare.');
      return;
    }
    setShowSaveDialog(true);
  }, [flyer, addToast]);

  const ctaUrlValid = !flyer.content.cta.url || isHttpUrl(flyer.content.cta.url);

  // ─── AI PANEL (colonna sinistra, come il preventivo) ───────
  const aiPanel = (
    <section className="panel ai-panel" aria-label="AI copy del volantino">
      <div className="panel-kicker">
        <span>✨ AI copy</span>
        <button className="panel-toggle" onClick={() => setShowAi(false)} title="Collassa" aria-label="Collassa AI">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
      </div>
      <Section title="Genera copy" defaultOpen={true}>
        <div className="stack">
          <label>Modello
            <select value={aiModel} onChange={(e) => setAiModel(e.target.value)}>
              {ai.availableModels.length > 0 ? ai.availableModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>) : <option value="deepseek-chat">DeepSeek Chat</option>}
            </select>
          </label>
          <label>Tono
            <select value={aiTone} onChange={(e) => setAiTone(e.target.value as 'formale' | 'giovanile' | 'tecnico')}>
              <option value="formale">Formale</option>
              <option value="giovanile">Giovanile</option>
              <option value="tecnico">Tecnico</option>
            </select>
          </label>
          <label>Brief ({FLYER_BRIEF_MAX - aiPrompt.length} caratteri)
            <textarea className="card-ai-textarea" value={aiPrompt} maxLength={FLYER_BRIEF_MAX} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Es. Sagra del paese, 15-17 agosto, ingresso gratis, musica dal vivo" rows={3} aria-label="Brief AI" />
          </label>
          <button type="button" className="card-action-primary" onClick={handleGenerate} disabled={ai.isProcessing || !aiPrompt.trim()}>
            {ai.isProcessing ? 'Generazione…' : '✨ Genera copy'}
          </button>
        </div>
      </Section>
      <Section title="Suggerimenti" defaultOpen={true}>
        <div className="stack" style={{ gap: 4 }}>
          {SUGGESTED_PROMPTS.map((p) => (
            <button key={p} type="button" className="flyer-ai-chip" onClick={() => setAiPrompt(p)} disabled={ai.isProcessing}>{p}</button>
          ))}
        </div>
      </Section>
      <Section title="Raffina copy" defaultOpen={true}>
        <div className="flyer-ai-quick-grid-inner">
          {QUICK_REFINE.map((q) => (
            <button key={q.action} type="button" className="flyer-ai-quick-card" onClick={() => handleRefine(q.action)} disabled={ai.isProcessing || !flyerHasCopy(flyer)} aria-label={`${q.label}: ${q.description}`} title={q.description}>
              <span className="flyer-ai-quick-icon" aria-hidden="true">{q.icon}</span>
              <span className="flyer-ai-quick-label">{q.label}</span>
            </button>
          ))}
        </div>
        {!flyerHasCopy(flyer) && <p style={{ fontSize: '.78rem', color: 'var(--muted)', margin: '6px 0 0' }}>ℹ️ Genera prima il copy o compila manualmente i campi.</p>}
      </Section>
      <Section title="Log AI" defaultOpen={true} extra={<button type="button" className="card-ai-reset" onClick={handleAiReset} disabled={ai.isProcessing}>↻ Nuova sessione</button>}>
        <AILogPanel logs={ai.logs} isProcessing={ai.isProcessing} />
      </Section>
    </section>
  );

  // ─── MANUAL PANEL (colonna centrale, come il preventivo) ────
  const manualPanel = (
    <section className="panel manual-panel" aria-label="Controllo manuale volantino">
      <div className="panel-kicker">
        <span>Controllo manuale</span>
        <button className="panel-toggle" onClick={() => setShowManual(false)} title="Collassa" aria-label="Collassa manuale">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
      </div>
      <input value={flyer.title} onChange={(e) => updateTitle(e.target.value)} placeholder="Titolo del volantino" className="option-title-input" aria-label="Titolo del volantino" />
      {showTemplateBanner && (
        <div className="qr-template-banner" role="status" style={{ flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '.8rem', flex: '1 1 150px' }}>Template per settore:</span>
            {FLYER_SECTORS.map((s) => <button key={s} type="button" onClick={() => applySector(s)} style={{ fontSize: '.74rem', padding: '3px 8px' }}>{SECTOR_LABELS[s]}</button>)}
            <button type="button" onClick={() => setShowTemplateBanner(false)} aria-label="Chiudi">×</button>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '.72rem', color: 'var(--muted)' }}>Layout per {SECTOR_LABELS[activeSector]}:</span>
            {FLYER_LAYOUTS.map((l) => <button key={l} type="button" onClick={() => applySectorLayout(l)} style={{ fontSize: '.72rem', padding: '2px 7px' }}>{LAYOUT_LABELS[l]}</button>)}
          </div>
        </div>
      )}
      <Section title="Formato" defaultOpen={false} badge={`${flyer.size}`}>
        <div className="form-grid">
          <label>Dimensione
            <select value={flyer.size} onChange={(e) => updateSize(e.target.value as FlyerSize)}>
              {FLYER_SIZES.map((s) => <option key={s} value={s}>{SIZE_LABELS[s]}</option>)}
            </select>
          </label>
          {flyer.size !== 'Square' && (
            <label>Orientamento
              <select value={flyer.orientation} onChange={(e) => updateOrientation(e.target.value as FlyerOrientation)}>
                <option value="portrait">Verticale</option>
                <option value="landscape">Orizzontale</option>
              </select>
            </label>
          )}
        </div>
      </Section>
      <Section title="Layout" defaultOpen={true}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FLYER_LAYOUTS.map((l) => (
            <button key={l} type="button" onClick={() => updateLayout(l)} aria-pressed={flyer.style.layout === l}
              style={{ padding: '5px 12px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', background: flyer.style.layout === l ? 'var(--accent)' : 'var(--surface)', color: flyer.style.layout === l ? '#fff' : 'var(--ink)', cursor: 'pointer', fontWeight: 500, fontSize: '.82rem' }}>
              {LAYOUT_LABELS[l]}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Contenuto" defaultOpen={true}>
        <div className="stack">
          <label>Titolo ({FLYER_HEADLINE_MAX - flyer.content.headline.length} car.)
            <input value={flyer.content.headline} maxLength={FLYER_HEADLINE_MAX} onChange={(e) => updateContent({ headline: e.target.value })} placeholder="Es. Sagra del paese" />
          </label>
          <label>Sottotitolo ({FLYER_SUBHEADLINE_MAX - flyer.content.subheadline.length} car.)
            <input value={flyer.content.subheadline} maxLength={FLYER_SUBHEADLINE_MAX} onChange={(e) => updateContent({ subheadline: e.target.value })} placeholder="Es. 15 agosto, ingresso gratis" />
          </label>
          <label>Corpo ({FLYER_BODY_MAX - flyer.content.body.length} car.)
            <textarea value={flyer.content.body} maxLength={FLYER_BODY_MAX} onChange={(e) => updateContent({ body: e.target.value })} rows={4} placeholder="Es. Cibo tipico, musica dal vivo, ingresso gratuito." />
          </label>
          <div className="mini-row">
            <label>CTA (bottone stampato)
              <input value={flyer.content.cta.label} maxLength={FLYER_CTA_LABEL_MAX} onChange={(e) => updateContent({ cta: { ...flyer.content.cta, label: e.target.value } })} placeholder="Prenota ora" />
            </label>
            <label>URL (per QR code)
              <input type="url" value={flyer.content.qrPayload} onChange={(e) => updateContent({ qrPayload: e.target.value })} placeholder="https://example.com" aria-invalid={!!flyer.content.qrPayload && !ctaUrlValid} />
            </label>
          </div>
          <label>Etichetta QR (opzionale)
            <input value={flyer.content.qrLabel} onChange={(e) => updateContent({ qrLabel: e.target.value })} placeholder="Scansiona per..." />
          </label>
        </div>
      </Section>
      <Section title="Immagine hero" defaultOpen={false} badge={flyer.content.heroImage ? '1' : undefined}>
        <div className="stack">
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleHeroUpload(f); }} />
          {flyer.content.heroImage && <button type="button" className="btn-remove" onClick={removeHero}>Rimuovi immagine</button>}
          {heroError && <p style={{ color: 'var(--red)', fontSize: '.78rem' }} role="alert">{heroError}</p>}
        </div>
      </Section>
      <Section title="Stile" defaultOpen={false}>
        <div className="stack">
          <div className="swatches" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {['#FFFFFF', '#FFFBF2', '#FFF1F2', '#0F172A', '#1a1a2e', '#FFFFFF'].slice(0, 5).map((c) => (
              <button key={c} className={flyer.style.bgColor === c ? 'selected' : ''} style={{ background: c, width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--line)' }} onClick={() => updateStyle('bgColor', c)} aria-label={c} />
            ))}
          </div>
          <div className="form-grid">
            <label>Testo<input type="color" value={flyer.style.textColor} onChange={(e) => updateStyle('textColor', e.target.value)} /></label>
            <label>Accento<input type="color" value={flyer.style.accentColor} onChange={(e) => updateStyle('accentColor', e.target.value)} /></label>
          </div>
          <label>Font
            <select value={FLYER_FONTS.some((f) => f.value === flyer.style.fontFamily) ? flyer.style.fontFamily : '__custom__'}
              onChange={(e) => { const v = e.target.value; if (v === '__custom__') { setShowCustomFont(true); } else { setShowCustomFont(false); updateStyle('fontFamily', v); } }}>
              {FLYER_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              <option value="__custom__">Personalizzato…</option>
            </select>
          </label>
          {showCustomFont && <label>Nome font<input value={flyer.style.fontFamily} onChange={(e) => updateStyle('fontFamily', e.target.value)} placeholder="Es. Playfair Display, sans-serif" /></label>}
        </div>
      </Section>
      <div className="editor-actions-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" className="btn-secondary" onClick={resetFlyer}>Nuovo</button>
        <button type="button" className="btn-primary" onClick={openSaveDialog} disabled={limitReached}>Salva</button>
        <button type="button" onClick={exportPdf} disabled={exporting !== null || !flyerHasCopy(flyer) || limitReached}>{exporting === 'pdf' ? '…' : 'PDF'}</button>
        <button type="button" onClick={exportPng} disabled={exporting !== null || !flyerHasCopy(flyer) || limitReached}>{exporting === 'png' ? '…' : 'PNG'}</button>
      </div>
      {limitReached && <p className="qr-warning" role="status" style={{ fontSize: '.78rem' }}>🔒 Limite free raggiunto. Sblocca per salvare ed esportare.</p>}
    </section>
  );

  // ─── RETURN: editor-grid (3 colonne come il preventivo) ─────
  return (
    <div className={`editor-grid ${previewFocus ? 'focus-mode' : ''} ${!showAi && !showManual ? 'both-collapsed' : ''} ${!showAi || !showManual ? 'one-collapsed' : ''}`}>
      {/* Colonna 1: AI */}
      <div className={`editor-col ai-col ${showAi ? '' : 'collapsed'}`}>
        {showAi ? aiPanel : (
          <div className="panel-tab" onClick={() => setShowAi(true)} title="Mostra AI" aria-label="Mostra AI">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
            <span>AI</span>
          </div>
        )}
      </div>

      {/* Colonna 2: Manual/Form */}
      <div className={`editor-col manual-col ${showManual ? '' : 'collapsed'}`}>
        {showManual ? manualPanel : (
          <div className="panel-tab" onClick={() => setShowManual(true)} title="Mostra controllo manuale" aria-label="Mostra manuale">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
            <span>Form</span>
          </div>
        )}
      </div>

      {/* Mobile actions */}
      <div className="editor-mobile-actions">
        <div className="editor-mobile-actions-buttons" style={{ display: 'flex', gap: 4 }}>
          <button onClick={openSaveDialog} className="mobile-action-btn mobile-action-btn-save" title="Salva" aria-label="Salva" disabled={limitReached}>💾</button>
          <button onClick={exportPdf} className="mobile-action-btn mobile-action-btn-export" title="PDF" aria-label="PDF" disabled={exporting !== null || !flyerHasCopy(flyer) || limitReached}>📄</button>
          <button onClick={exportPng} className="mobile-action-btn" title="PNG" aria-label="PNG" disabled={exporting !== null || !flyerHasCopy(flyer) || limitReached}>🖼</button>
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div className="editor-mobile-bar">
        <button className={mobileTab === 'ai' ? 'active' : ''} onClick={() => setMobileTab(mobileTab === 'ai' ? null : 'ai')}>✨ AI</button>
        <button className={mobileTab === 'manual' ? 'active' : ''} onClick={() => setMobileTab(mobileTab === 'manual' ? null : 'manual')}>✏️ Form</button>
        <button onClick={() => setPreviewFocus(!previewFocus)} aria-pressed={previewFocus}>{previewFocus ? '✕ Esci' : '🎯 Focus'}</button>
      </div>

      {/* Mobile panel overlay */}
      {mobileTab && (
        <div className="editor-mobile-panel">
          {mobileTab === 'ai' ? aiPanel : manualPanel}
        </div>
      )}

      {/* Colonna 3: Preview (focus mode nasconde AI e Form) */}
      <section className={`preview-wrap ${!showAi && !showManual ? 'full' : !showAi || !showManual ? 'wide' : ''} ${previewFocus ? 'preview-focus' : ''}`} aria-label="Anteprima volantino">
        <div className="preview-toolbar" style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
          <button data-testid="focus-toggle" className="focus-toggle" onClick={() => setPreviewFocus(!previewFocus)} title={previewFocus ? 'Esci da focus' : 'Focus anteprima'} aria-label={previewFocus ? 'Esci da focus' : 'Focus anteprima'}>
            <span style={{ fontSize: '.72rem', fontWeight: 600 }}>{previewFocus ? '✕' : '🎯'}</span>
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', position: 'relative' }}>
          <FlyerPreview flyer={flyer} />
          <PreviewWatermark tier={tier} className="flyer-preview-watermark" />
        </div>
        <p style={{ fontSize: '.78rem', color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>
          {flyer.size}{flyer.size === 'Square' ? '' : ` · ${flyer.orientation === 'portrait' ? 'Verticale' : 'Orizzontale'}`} · {LAYOUT_LABELS[flyer.style.layout]}
          {tier === 'free' && <span style={{ marginLeft: 4 }}>· Watermark QUICKBRAND</span>}
        </p>
      </section>

      <SaveDialog
        open={showSaveDialog}
        defaultName={flyer.title || 'Volantino'}
        documentLabel="volantino"
        placeholder="Es. Volantino - Sagra del paese"
        onSave={(name: string) => { setShowSaveDialog(false); handleSave(name); }}
        onCancel={() => setShowSaveDialog(false)}
      />
    </div>
  );
}

function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const valid = isHexColor(value);
  return (
    <label className="qr-field qr-color-field">
      <span>{label}</span>
      <div className="qr-color-row">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} selettore colore`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!valid}
          aria-label={`${label} esadecimale`}
        />
      </div>
    </label>
  );
}

function FlyerPreview({ flyer }: { flyer: Flyer }) {
  const dims = getFlyerDimensions(flyer);
  // Phase 3 preview = export: usa buildFlyerSvg come SINGLE SOURCE OF
  // TRUTH. L'SVG viene scalato per stare in un box max. Le proporzioni
  // sono identiche a PDF e PNG. La ratio mm/px è fissa, così cambiano
  // insieme al formato.
  const totalWmm = dims.w + 6; // include bleed
  const totalHmm = dims.h + 6;
  const maxPreviewPx = 420;
  const scale = Math.min(1, maxPreviewPx / totalHmm) * 4;
  const previewW = totalWmm * scale;
  const previewH = totalHmm * scale;
  const svg = buildFlyerSvg(flyer);

  return (
    <div
      style={{
        width: previewW,
        height: previewH,
        position: 'relative',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
      aria-label="Anteprima volantino"
      data-testid="flyer-preview"
    >
      <div
        // L'SVG ha viewBox in mm, lo riscalo in px con preserveAspectRatio
        // per non distorcere. Così preview = export.
        style={{ width: '100%', height: '100%' }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

function CtaPreview({ label, accent, small }: { label: string; accent: string; small?: boolean }) {
  return (
    <div style={{
      alignSelf: 'flex-start',
      padding: small ? '2px 8px' : '4px 10px',
      background: accent,
      color: '#fff',
      borderRadius: 4,
      fontSize: small ? 9 : 11,
      fontWeight: 700,
      textTransform: 'uppercase',
    }}>
      {label}
    </div>
  );
}

function flyerHasContent(flyer: Flyer): boolean {
  return flyerHasCopy(flyer) || !!flyer.title || !!flyer.content.heroImage;
}

function flyerHasCopy(flyer: Flyer): boolean {
  return !!(flyer.content.headline || flyer.content.subheadline || flyer.content.body);
}

function sanitizeForSave(flyer: Flyer, userEmail: string): Flyer {
  const base = createEmptyFlyer();
  return {
    ...base,
    ...flyer,
    userEmail,
    content: {
      ...base.content,
      ...flyer.content,
      cta: { ...base.content.cta, ...flyer.content.cta },
    },
    style: { ...base.style, ...flyer.style },
    updatedAt: new Date().toISOString(),
  };
}

// Modal fullscreen per l'anteprima del volantino. Nasconde tutto il
// resto dell'editor e mostra solo il preview al centro, scalato per
// riempire lo spazio disponibile. Esc per chiudere, click sull'overlay
// per chiudere, click sul preview per non chiudere.
function FlyerFullPreviewModal({ flyer, tier, onClose }: { flyer: Flyer; tier: 'free' | 'unlocked'; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Anteprima volantino a schermo intero"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.92)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative', maxWidth: '95vw', maxHeight: '95vh' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi anteprima a schermo intero"
          title="Chiudi (Esc)"
          style={{
            position: 'absolute', top: -40, right: 0,
            background: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 14px', fontWeight: 600, cursor: 'pointer',
            color: '#0f172a',
          }}
        >
          ✕ Chiudi
        </button>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <FlyerPreview flyer={flyer} />
          <PreviewWatermark tier={tier} className="flyer-preview-watermark" />
        </div>
      </div>
    </div>
  );
}
