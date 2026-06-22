import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './CardEditor.css';
import CardPreview from './CardPreview';
import AILogPanel from './AILogPanel';
import CardEditorTabs from './CardEditorTabs';
import MobileGridEditor from './MobileGridEditor';
import CardAIFab from './CardAIFab';
import CardAIBottomSheet from './CardAIBottomSheet';
import type {
  BusinessCard,
  BusinessCardLayout,
  BusinessCardBorderStyle,
  BusinessCardSizePreset,
  CardGrid,
} from '../utils/documentSchemas';
import { createEmptyCard, createGiovanniCardTemplate, gridPresetLeft, gridPresetCentered, gridPresetSplit } from '../utils/documentSchemas';
import { compressImage, generateCardPDF, generateCardPng, buildCardSvg } from '../utils/cardGenerator';
import { isAllowedLogoMime, isHttpUrl } from '../utils/qrGenerator';
import dataService from '../utils/dataService';
import { useToast } from '../hooks/useToast';
import { useAICard } from '../hooks/useAICard';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useCardPreviewZoom } from '../hooks/useCardPreviewZoom';
import { CardAIFloatingProvider, useCardAIFloating } from '../hooks/useCardAIFloating';
import CardPreviewZoomControls from './CardPreviewZoomControls';
import { logger } from '../utils/logger';

const MAX_RAW_BYTES = 5_000_000;
const AUTO_SAVE_DELAY_MS = 30_000;

const LAYOUT_LABELS: Record<BusinessCardLayout, string> = {
  centered: 'Centrato',
  left: 'Sinistra',
  split: 'Split (foto a sinistra)',
};

const SIZE_PRESET_LABELS: Record<BusinessCardSizePreset, string> = {
  'eu-85x55': 'EU 85×55mm',
  'us-89x51': 'US 89×51mm',
  'square-65x65': 'Quadrato 65×65mm',
};

const BORDER_LABELS: Record<BusinessCardBorderStyle, string> = {
  none: 'Nessuno',
  thin: 'Bordo sottile',
  'accent-strip-left': 'Striscia accento a sinistra',
  'accent-strip-bottom': 'Striscia accento in basso',
};

const SOCIAL_PLATFORMS = [
  { value: '', label: '—' },
  { value: 'LinkedIn', label: 'LinkedIn' },
  { value: 'GitHub', label: 'GitHub' },
  { value: 'X', label: 'X (Twitter)' },
  { value: 'Instagram', label: 'Instagram' },
  { value: 'Facebook', label: 'Facebook' },
  { value: 'YouTube', label: 'YouTube' },
  { value: 'Behance', label: 'Behance' },
  { value: 'Dribbble', label: 'Dribbble' },
] as const;

const SIZE_PRESETS = {
  'eu-85x55': { w: 85, h: 55 },
  'us-89x51': { w: 89, h: 51 },
  'square-65x65': { w: 65, h: 65 },
} as const;

interface CardEditorProps {
  userEmail: string;
  initialCard?: BusinessCard;
  documentTheme: 'corporate' | 'minimal' | 'creative' | 'legal' | 'luxury';
  tier: 'free' | 'unlocked';
}

export default function CardEditorWrapper(props: CardEditorProps) {
  return (
    <CardAIFloatingProvider>
      <CardEditor {...props} />
    </CardAIFloatingProvider>
  );
}

function CardEditor({ userEmail, initialCard, documentTheme, tier }: CardEditorProps) {
  const [card, setCard] = useState<BusinessCard>(initialCard || createEmptyCard());
  const [showTemplateBanner, setShowTemplateBanner] = useState<boolean>(() => !initialCard);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'png-front' | 'png-back' | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiModel, setAiModel] = useState('deepseek-chat');
  const [showAi, setShowAi] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobile = useMediaQuery('(max-width: 900px)');
  const aiFloating = useCardAIFloating();
  const previewZoom = useCardPreviewZoom(isMobile ? 0.7 : 1);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const { addToast } = useToast();
  const { processCardPrompt, resetCardChat, cardAiLogs, isCardProcessing, availableModels } = useAICard(userEmail);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exportMenuOpen]);

  // ─── PATCH HELPERS ──────────────────────────────────────
  const patchFront = useCallback((patch: Partial<BusinessCard['front']>) => {
    setCard((prev) => ({ ...prev, front: { ...prev.front, ...patch }, updatedAt: new Date().toISOString() }));
  }, []);

  const patchBack = useCallback((patch: Partial<BusinessCard['back']>) => {
    setCard((prev) => ({ ...prev, back: { ...prev.back, ...patch }, updatedAt: new Date().toISOString() }));
  }, []);

  const patchStyle = useCallback((patch: Partial<BusinessCard['style']>) => {
    setCard((prev) => ({ ...prev, style: { ...prev.style, ...patch }, updatedAt: new Date().toISOString() }));
  }, []);

  // ─── B2: Grid editor state ─────────────────────────────────
  const [selectedGridElement, setSelectedGridElement] = useState<keyof CardGrid['elements'] | ''>('');
  const [gridPresetChoice, setGridPresetChoice] = useState<'left' | 'centered' | 'split'>('left');

  const patchGrid = useCallback((grid: CardGrid) => {
    setCard((prev) => ({ ...prev, grid, updatedAt: new Date().toISOString() }));
  }, []);

  const applyGridPreset = useCallback((preset: 'left' | 'centered' | 'split') => {
    if (preset === 'left') patchGrid(gridPresetLeft());
    else if (preset === 'centered') patchGrid(gridPresetCentered());
    else patchGrid(gridPresetSplit());
  }, [patchGrid]);

  const moveSelectedElement = useCallback((dx: number, dy: number) => {
    if (!selectedGridElement) return;
    setCard((prev) => {
      const current = prev.grid ?? gridPresetLeft();
      const el = current.elements[selectedGridElement];
      if (!el) return prev;
      const newX = Math.max(0, Math.min(current.cols - el.w, el.x + dx));
      const newY = Math.max(0, Math.min(current.rows - el.h, el.y + dy));
      return {
        ...prev,
        grid: {
          ...current,
          elements: { ...current.elements, [selectedGridElement]: { ...el, x: newX, y: newY } },
        },
        updatedAt: new Date().toISOString(),
      };
    });
  }, [selectedGridElement]);

  const resizeSelectedElement = useCallback((dw: number, dh: number) => {
    if (!selectedGridElement) return;
    setCard((prev) => {
      const current = prev.grid ?? gridPresetLeft();
      const el = current.elements[selectedGridElement];
      if (!el) return prev;
      const newW = Math.max(1, Math.min(current.cols - el.x, el.w + dw));
      const newH = Math.max(1, Math.min(current.rows - el.y, el.h + dh));
      return {
        ...prev,
        grid: {
          ...current,
          elements: { ...current.elements, [selectedGridElement]: { ...el, w: newW, h: newH } },
        },
        updatedAt: new Date().toISOString(),
      };
    });
  }, [selectedGridElement]);

  const patchTitle = useCallback((title: string) => {
    setCard((prev) => ({ ...prev, title, updatedAt: new Date().toISOString() }));
  }, []);

  // ─── TEMPLATE ─────────────────────────────────────────
  const applyGiovanniTemplate = useCallback(() => {
    setCard(createGiovanniCardTemplate());
    setShowTemplateBanner(false);
    addToast('info', 'Template personale Giovanni caricato');
  }, [addToast]);

  // ─── FILE UPLOAD (photo + logo) ────────────────────────
  const handleUpload = useCallback(async (file: File, field: 'photoUrl' | 'logoUrl') => {
    setUploadError(null);
    if (!isAllowedLogoMime(file.type)) {
      setUploadError('Formato non supportato. Usa PNG, JPEG o SVG.');
      return;
    }
    if (file.size > MAX_RAW_BYTES) {
      setUploadError('File troppo grande (max 5MB)');
      return;
    }
    try {
      const dataUri = await compressImage(file);
      patchFront({ [field]: dataUri } as any);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore upload immagine';
      setUploadError(message);
    }
  }, [patchFront]);

  const removePhoto = useCallback(() => {
    patchFront({ photoUrl: null });
    setUploadError(null);
  }, [patchFront]);

  const removeLogo = useCallback(() => {
    patchFront({ logoUrl: null });
    setUploadError(null);
  }, [patchFront]);

  // ─── EXPORT PDF (AC-009) ──────────────────────────────
  const exportPdf = useCallback(async () => {
    setExporting('pdf');
    try {
      const bytes = await generateCardPDF(card, { tier });
      const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `card_${card.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', 'PDF 10-up scaricato (pronto per la tipografia)');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore export PDF';
      addToast('error', message);
    } finally {
      setExporting(null);
    }
  }, [card, tier, addToast]);

  // ─── EXPORT PNG (AC-010) ──────────────────────────────
  const exportPng = useCallback(async (side: 'front' | 'back') => {
    setExporting(side === 'front' ? 'png-front' : 'png-back');
    try {
      const bytes = await generateCardPng(card, side, { tier, dpi: 300 });
      const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `card_${card.id}_${side}.png`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', `PNG ${side} scaricato (300 DPI)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore export PNG';
      addToast('error', message);
    } finally {
      setExporting(null);
    }
  }, [card, tier, addToast]);

  // ─── EXPORT SVG ────────────────────────────────────────
  const exportSvg = useCallback((side: 'front' | 'back') => {
    try {
      const dims = SIZE_PRESETS[card.style.sizePreset];
      const pxW = Math.round(dims.w * 20);
      const pxH = Math.round(dims.h * 20);
      const svg = buildCardSvg(card, side, pxW, pxH);
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `card_${card.id}_${side}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', `SVG ${side} scaricato (vettoriale, editabile)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore export SVG';
      addToast('error', message);
    }
  }, [card, addToast]);

  // ─── EXPORT JSON ───────────────────────────────────────
  const exportJson = useCallback(() => {
    try {
      const json = JSON.stringify(card, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `card_${card.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', 'JSON scaricato (backup card data)');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore export JSON';
      addToast('error', message);
    }
  }, [card, addToast]);

  // ─── SAVE (manual) ────────────────────────────────────
  const handleSave = useCallback(async () => {
    const sanitized: BusinessCard = { ...card, userEmail, updatedAt: new Date().toISOString() };
    const result = await dataService.saveDocument(userEmail, sanitized);
    if (result.error) {
      addToast('error', result.error);
      return;
    }
    addToast('success', 'Bigliettino salvato in locale. Visibile in Collection dalla prossima release.');
  }, [card, userEmail, addToast]);

  // ─── AI (quick actions + custom prompt) ──────────────
  const runCardAI = useCallback(async (mode: string = 'custom') => {
    const prompts: Record<string, string> = {
      premium: 'Rendi questo bigliettino più elegante e professionale: scegli un accent color sofisticato (navy #1e3a5f, bordeaux #8b0000, o teal #01696F), usa layout "split" se c\'è foto o "centered" se non c\'è, font Inter, borderStyle "accent-strip-left".',
      minimal: 'Pulisci il bigliettino: rimuovi i social con URL vuoto o "XXXXX", svuota i campi non compilati, accent color neutro #333333, layout "left", borderStyle "thin". Mantieni solo nome, titolo, telefono, email, website.',
      fill: `Dai nome "${card.front.name}", genera un titolo professionale plausibile (es. "Sviluppatore Web", "Designer", "Consulente"), suggerisci un'azienda se rintracciabile, aggiungi social placeholder con URL "XXXXX" per LinkedIn.`,
      palette: 'Cambia la palette con una predefinita: teal (#01696F accent, #1a1a2e text, #FFFFFF bg), navy (#1e3a5f accent, #f8f9fa text, #ffffff bg), bordeaux (#8b0000 accent, #fff8f0 text, #ffffff bg), o monochrome (#333333 accent, #ffffff text, #f5f5f5 bg). Mantieni contrasto WCAG AA.',
      print: 'Verifica e ottimizza per stampa: contrasto textColor/bgColor >= 4.5:1, font leggibili (Inter, Roboto, Open Sans), evita borderStyle "none" se accent è chiaro.',
      moveQr: 'Sposta il QR più a sinistra: imposta grid.elements.qr.x = 0 (se non lo è già). Se il QR è già a x=0, puoi ridurre grid.elements.qr.w leggermente.',
      growPhoto: 'Allarga la foto: aumenta grid.elements.photo.w di 1.',
      custom: aiText.trim(),
    };
    const userPrompt = prompts[mode] || aiText.trim();
    if (!userPrompt) { addToast('info', 'Scrivi un prompt per l\'AI.'); return; }

    try {
      const result = await processCardPrompt(card, userPrompt, {
        modelId: aiModel,
        onProgress: () => {},
        onStream: () => {},
      });
      setCard(result.card);
      const realChanges = result.changes.filter((c: string) => !c.startsWith('error:'));
      if (realChanges.length > 0) {
        addToast('success', `AI: ${realChanges.length} modifica${realChanges.length > 1 ? 'e' : ''} applicata${realChanges.length > 1 ? 'e' : ''}`, 5000);
      } else {
        addToast('info', 'AI: nessuna modifica riconosciuta. Vedi log per dettagli.', 5000);
      }
    } catch (err: any) {
      addToast('error', err.message || 'Errore AI', 5000);
    }
  }, [card, aiText, aiModel, processCardPrompt, addToast]);

  // ─── AUTO-SAVE (silent, every 30s when dirty) ─────────
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const sanitized: BusinessCard = { ...card, userEmail, updatedAt: new Date().toISOString() };
      dataService.saveDocument(userEmail, sanitized).catch((err) => {
        logger.error('Card auto-save failed', { err: (err as Error).message });
      });
    }, AUTO_SAVE_DELAY_MS);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [card, userEmail]);

  // ─── SOCIALS CRUD ─────────────────────────────────────
  const updateSocial = useCallback((idx: number, key: 'platform' | 'url', value: string) => {
    setCard((prev) => {
      const socials = [...prev.back.socials];
      socials[idx] = { ...socials[idx], [key]: value };
      return { ...prev, back: { ...prev.back, socials }, updatedAt: new Date().toISOString() };
    });
  }, []);

  const addSocial = useCallback(() => {
    setCard((prev) => ({
      ...prev,
      back: { ...prev.back, socials: [...prev.back.socials, { platform: '', url: '' }] },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const removeSocial = useCallback((idx: number) => {
    setCard((prev) => ({
      ...prev,
      back: { ...prev.back, socials: prev.back.socials.filter((_, i) => i !== idx) },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const websiteValid = useMemo(() => !card.back.website || isHttpUrl(card.back.website), [card.back.website]);

  // ─── Form content (shared between desktop 3-col and mobile tabs) ───
  const formAndActionsContent = useMemo(() => (
    <>
      <fieldset className="card-fieldset">
        <legend>Fronte</legend>
        <label className="card-field">
          <span>Nome (fronte)</span>
          <input
            type="text"
            value={card.front.name}
            onChange={(e) => patchFront({ name: e.target.value })}
            aria-label="Nome (fronte)"
          />
        </label>
        <label className="card-field">
          <span>Ruolo (fronte)</span>
          <input
            type="text"
            value={card.front.title}
            onChange={(e) => patchFront({ title: e.target.value })}
            aria-label="Ruolo (fronte)"
          />
        </label>
        <label className="card-field">
          <span>Azienda (fronte)</span>
          <input
            type="text"
            value={card.front.company}
            onChange={(e) => patchFront({ company: e.target.value })}
            aria-label="Azienda (fronte)"
          />
        </label>
        <label className="card-field">
          <span>Layout fronte</span>
          <select
            value={card.front.layout}
            onChange={(e) => patchFront({ layout: e.target.value as BusinessCardLayout })}
            aria-label="Layout fronte"
          >
            {Object.entries(LAYOUT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
      </fieldset>
      <fieldset className="card-fieldset">
        <legend>Retro</legend>
        <label className="card-field">
          <span>Telefono (retro)</span>
          <input
            type="text"
            value={card.back.phone}
            onChange={(e) => patchBack({ phone: e.target.value })}
            aria-label="Telefono (retro)"
          />
        </label>
        <label className="card-field">
          <span>Email (retro)</span>
          <input
            type="text"
            value={card.back.email}
            onChange={(e) => patchBack({ email: e.target.value })}
            aria-label="Email (retro)"
          />
        </label>
        <label className="card-field">
          <span>Sito web (http:// o https://)</span>
          <input
            type="text"
            value={card.back.website}
            onChange={(e) => patchBack({ website: e.target.value })}
            aria-label="Sito web"
            placeholder="https://..."
          />
        </label>
        <label className="card-field">
          <span>Indirizzo</span>
          <input
            type="text"
            value={card.back.address}
            onChange={(e) => patchBack({ address: e.target.value })}
            aria-label="Indirizzo"
          />
        </label>
        <label className="card-field">
          <span>P.IVA</span>
          <input
            type="text"
            value={card.back.vatNumber}
            onChange={(e) => patchBack({ vatNumber: e.target.value })}
            aria-label="P.IVA"
          />
        </label>
      </fieldset>
    </>
  ), [card.front, card.back, patchFront, patchBack]);

  return (
    <div className="card-editor">
      <header className="card-editor-header">
        <h1>Bigliettino da visita</h1>
        <input
          className="card-title-input"
          value={card.title}
          onChange={(e) => patchTitle(e.target.value)}
          placeholder="Titolo del bigliettino"
          aria-label="Titolo del bigliettino"
        />
      </header>

      {showTemplateBanner && (
        <div className="card-template-banner" role="status">
          <span>Usa template personale di Giovanni (precompilato con https://webdeveloperca.netlify.app/, telefono/email = XXXXX)</span>
          <button type="button" onClick={applyGiovanniTemplate}>Applica template</button>
          <button type="button" onClick={() => setShowTemplateBanner(false)} aria-label="Chiudi banner">×</button>
        </div>
      )}

      {isMobile ? (
        <CardEditorTabs
          defaultTab="preview"
          tabs={[
            {
              id: 'preview',
              label: 'Anteprima',
              content: (
                <div className="card-editor-preview" aria-label="Anteprima bigliettino">
                  <div className="card-editor-preview-header">
                    <h2>Anteprima</h2>
                    <div className="card-editor-preview-toolbar">
                      <CardPreviewZoomControls
                        zoom={previewZoom.zoom}
                        canZoomIn={previewZoom.canZoomIn()}
                        canZoomOut={previewZoom.canZoomOut()}
                        onZoomIn={previewZoom.zoomIn}
                        onZoomOut={previewZoom.zoomOut}
                        onReset={previewZoom.reset}
                      />
                      <button
                        type="button"
                        className={`card-grid-toggle ${showGrid ? 'active' : ''}`}
                        onClick={() => setShowGrid((v) => !v)}
                        title={showGrid ? 'Nascondi griglia' : 'Mostra griglia'}
                        aria-label={showGrid ? 'Nascondi griglia' : 'Mostra griglia'}
                        aria-pressed={showGrid}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="7" height="7" />
                          <rect x="14" y="3" width="7" height="7" />
                          <rect x="3" y="14" width="7" height="7" />
                          <rect x="14" y="14" width="7" height="7" />
                        </svg>
                        <span>{showGrid ? 'Griglia ON' : 'Griglia OFF'}</span>
                      </button>
                    </div>
                  </div>
                  <div
                    className="card-previews"
                    style={{
                      transform: `scale(${previewZoom.zoom})`,
                      transformOrigin: 'top center',
                    }}
                  >
                    <div className="card-preview-wrap">
                      <h3>Fronte</h3>
                      <CardPreview side="front" card={card} showGrid={showGrid} />
                    </div>
                    <div className="card-preview-wrap">
                      <h3>Retro</h3>
                      <CardPreview side="back" card={card} showGrid={showGrid} />
                    </div>
                  </div>
                  <MobileGridEditor
                    grid={card.grid ?? gridPresetLeft()}
                    onChange={(g) => patchGrid(g)}
                  />
                </div>
              ),
            },
            {
              id: 'edit',
              label: 'Modifica',
              content: (
                <div className="card-editor-form" aria-label="Configurazione bigliettino">
                  {formAndActionsContent}
                </div>
              ),
            },
            {
              id: 'ai',
              label: 'AI',
              content: (
                <div className="card-ai-mobile-content">
                  <label className="card-field">
                    <span>Modello AI</span>
                    <select
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      aria-label="Modello AI"
                    >
                      {availableModels.map((m) => (
                        <option key={m.id} value={m.id}>{m.name} — {m.model}</option>
                      ))}
                    </select>
                  </label>
                  <label className="card-field card-ai-textarea">
                    <span>Prompt AI personalizzato</span>
                    <textarea
                      value={aiText}
                      onChange={(e) => setAiText(e.target.value)}
                      rows={4}
                      placeholder="Es. Rendi premium..."
                      aria-label="Prompt AI personalizzato"
                    />
                  </label>
                  <div className="card-ai-actions">
                    <button type="button" onClick={() => runCardAI('premium')} disabled={isCardProcessing}>Rendi premium</button>
                    <button type="button" onClick={() => runCardAI('minimal')} disabled={isCardProcessing}>Minimal</button>
                    <button type="button" onClick={() => runCardAI('fillName')} disabled={isCardProcessing}>Compila da nome</button>
                    <button type="button" onClick={() => runCardAI('palette')} disabled={isCardProcessing}>Cambia palette</button>
                    <button type="button" onClick={() => runCardAI('print')} disabled={isCardProcessing}>Ottimizza per stampa</button>
                    <button type="button" onClick={() => runCardAI('moveQr')} disabled={isCardProcessing}>← Sposta QR</button>
                    <button type="button" onClick={() => runCardAI('growPhoto')} disabled={isCardProcessing}>↔ Allarga foto</button>
                  </div>
                  <button
                    type="button"
                    className="card-ai-apply"
                    onClick={() => runCardAI('custom')}
                    disabled={isCardProcessing || !aiText.trim()}
                  >
                    Applica prompt personalizzato
                  </button>
                  <button
                    type="button"
                    className="card-ai-reset"
                    onClick={resetCardChat}
                    disabled={isCardProcessing}
                  >
                    Nuova conversazione
                  </button>
                  <AILogPanel logs={cardAiLogs} isProcessing={isCardProcessing} />
                </div>
              ),
            },
          ]}
        />
      ) : null}

      {!isMobile && (
      <div className="card-editor-3col">
        {/* COLONNA 1: FORM */}
        <section className="card-editor-form" aria-label="Configurazione bigliettino">
          <fieldset className="card-fieldset">
            <legend>Fronte</legend>
            <label className="card-field">
              <span>Nome (fronte)</span>
              <input
                type="text"
                value={card.front.name}
                onChange={(e) => patchFront({ name: e.target.value })}
                aria-label="Nome (fronte)"
              />
            </label>
            <label className="card-field">
              <span>Ruolo (fronte)</span>
              <input
                type="text"
                value={card.front.title}
                onChange={(e) => patchFront({ title: e.target.value })}
                aria-label="Ruolo (fronte)"
              />
            </label>
            <label className="card-field">
              <span>Azienda (fronte)</span>
              <input
                type="text"
                value={card.front.company}
                onChange={(e) => patchFront({ company: e.target.value })}
                aria-label="Azienda (fronte)"
              />
            </label>
            <label className="card-field">
              <span>Layout fronte</span>
              <select
                value={card.front.layout}
                onChange={(e) => patchFront({ layout: e.target.value as BusinessCardLayout })}
                aria-label="Layout fronte"
              >
                {Object.entries(LAYOUT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>

            <div className="card-field">
              <span>Foto (fronte)</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file, 'photoUrl');
                }}
                aria-label="Carica foto (fronte)"
              />
              {card.front.photoUrl && (
                <button type="button" className="card-remove-image" onClick={removePhoto}>Rimuovi foto</button>
              )}
            </div>

            <div className="card-field">
              <span>Logo (fronte)</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file, 'logoUrl');
                }}
                aria-label="Carica logo (fronte)"
              />
              {card.front.logoUrl && (
                <button type="button" className="card-remove-image" onClick={removeLogo}>Rimuovi logo</button>
              )}
            </div>

            {uploadError && <p className="card-warning" role="alert">{uploadError}</p>}
          </fieldset>

          <fieldset className="card-fieldset">
            <legend>Retro</legend>
            <label className="card-field">
              <span>Telefono (retro)</span>
              <input
                type="tel"
                value={card.back.phone}
                onChange={(e) => patchBack({ phone: e.target.value })}
                aria-label="Telefono (retro)"
              />
            </label>
            <label className="card-field">
              <span>Email (retro)</span>
              <input
                type="email"
                value={card.back.email}
                onChange={(e) => patchBack({ email: e.target.value })}
                aria-label="Email (retro)"
              />
            </label>
            <label className="card-field">
              <span>Sito web (http:// o https://)</span>
              <input
                type="url"
                value={card.back.website}
                onChange={(e) => patchBack({ website: e.target.value })}
                aria-invalid={!websiteValid}
                aria-label="Sito web"
              />
              {!websiteValid && <small className="card-warning">URL non valido. Includi http:// o https://</small>}
            </label>
            <label className="card-field">
              <span>Indirizzo</span>
              <input
                type="text"
                value={card.back.address}
                onChange={(e) => patchBack({ address: e.target.value })}
                aria-label="Indirizzo"
              />
            </label>
            <label className="card-field">
              <span>P.IVA</span>
              <input
                type="text"
                value={card.back.vatNumber}
                onChange={(e) => patchBack({ vatNumber: e.target.value })}
                aria-label="P.IVA"
              />
            </label>

            <div className="card-field">
              <span>Social (opzionali)</span>
              {card.back.socials.map((s, idx) => {
                const knownPlatform = SOCIAL_PLATFORMS.find((p) => p.value === s.platform);
                const isAltro = !knownPlatform;
                return (
                  <div key={idx} className="card-social-row">
                    <select
                      value={knownPlatform ? knownPlatform.value : '__altro__'}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '__altro__') {
                          updateSocial(idx, 'platform', '__altro__');
                        } else {
                          updateSocial(idx, 'platform', v);
                        }
                      }}
                      aria-label={`Social ${idx + 1} piattaforma`}
                    >
                      {SOCIAL_PLATFORMS.map((p) => (
                        <option key={p.value || 'empty'} value={p.value}>{p.label}</option>
                      ))}
                      <option value="__altro__">Altro</option>
                    </select>
                    {isAltro ? (
                      <input
                        type="text"
                        value={s.platform === '__altro__' ? '' : s.platform}
                        onChange={(e) => updateSocial(idx, 'platform', e.target.value || '__altro__')}
                        placeholder="Nome piattaforma (es. Mastodon)"
                        aria-label={`Altra piattaforma ${idx + 1}`}
                      />
                    ) : (
                      <input
                        type="text"
                        value={s.url}
                        onChange={(e) => updateSocial(idx, 'url', e.target.value)}
                        placeholder="@username o URL"
                        aria-label={`Social ${idx + 1} URL`}
                      />
                    )}
                    <button type="button" onClick={() => removeSocial(idx)} aria-label={`Rimuovi social ${idx + 1}`}>×</button>
                  </div>
                );
              })}
              <button type="button" onClick={addSocial} className="card-add-social">+ Aggiungi social</button>
            </div>
          </fieldset>

          <details className="card-advanced-qr" data-testid="qr-advanced-details">
            <summary>Opzioni QR avanzate</summary>
            <label className="card-field">
              <span>Payload QR (override manuale)</span>
              <input
                type="text"
                name="qrPayload"
                value={card.back.qrPayload}
                onChange={(e) => patchBack({ qrPayload: e.target.value })}
                placeholder="Lascia vuoto per usare il sito web"
                aria-label="Payload QR"
              />
            </label>
            <label className="card-field">
              <span>Etichetta sotto il QR</span>
              <input
                type="text"
                name="qrLabel"
                value={card.back.qrLabel}
                onChange={(e) => patchBack({ qrLabel: e.target.value })}
                placeholder="Es. Scansiona per visitare il sito"
                aria-label="Etichetta QR"
              />
            </label>
          </details>

          <fieldset className="card-fieldset">
            <legend>Stile</legend>
            <div className="card-row-2">
              <label className="card-field">
                <span>Formato bigliettino</span>
                <select
                  value={card.style.sizePreset}
                  onChange={(e) => patchStyle({ sizePreset: e.target.value as BusinessCardSizePreset })}
                  aria-label="Formato bigliettino"
                >
                  {Object.entries(SIZE_PRESET_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="card-field">
                <span>Stile bordo</span>
                <select
                  value={card.style.borderStyle}
                  onChange={(e) => patchStyle({ borderStyle: e.target.value as BusinessCardBorderStyle })}
                  aria-label="Stile bordo"
                >
                  {Object.entries(BORDER_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="card-color-row">
              <label className="card-color-cell">
                <span>Sfondo</span>
                <div className="card-color-pill">
                  <input
                    type="color"
                    value={card.style.bgColor}
                    onChange={(e) => patchStyle({ bgColor: e.target.value })}
                    aria-label="Colore sfondo"
                  />
                  <code>{card.style.bgColor.toUpperCase()}</code>
                </div>
              </label>
              <label className="card-color-cell">
                <span>Testo</span>
                <div className="card-color-pill">
                  <input
                    type="color"
                    value={card.style.textColor}
                    onChange={(e) => patchStyle({ textColor: e.target.value })}
                    aria-label="Colore testo"
                  />
                  <code>{card.style.textColor.toUpperCase()}</code>
                </div>
              </label>
              <label className="card-color-cell">
                <span>Accento</span>
                <div className="card-color-pill">
                  <input
                    type="color"
                    value={card.style.accentColor}
                    onChange={(e) => patchStyle({ accentColor: e.target.value })}
                    aria-label="Colore accento"
                  />
                  <code>{card.style.accentColor.toUpperCase()}</code>
                </div>
              </label>
            </div>
          </fieldset>

          <div className="card-actions">
            <button type="button" onClick={handleSave} className="card-action-primary">Salva</button>
            <div className="card-export-menu" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setExportMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
              >
                {exporting ? 'Esportando…' : 'Esporta ▾'}
              </button>
              {exportMenuOpen && (
                <ul className="card-export-list" role="menu">
                  <li role="menuitem" onClick={() => { setExportMenuOpen(false); exportPdf(); }}>PDF 10-up (A4, pronto tipografia)</li>
                  <li role="menuitem" onClick={() => { setExportMenuOpen(false); exportPng('front'); }}>PNG fronte (300 DPI)</li>
                  <li role="menuitem" onClick={() => { setExportMenuOpen(false); exportPng('back'); }}>PNG retro (300 DPI)</li>
                  <li role="menuitem" onClick={() => { setExportMenuOpen(false); exportSvg('front'); }}>SVG fronte (vettoriale, editabile)</li>
                  <li role="menuitem" onClick={() => { setExportMenuOpen(false); exportSvg('back'); }}>SVG retro (vettoriale, editabile)</li>
                  <li role="menuitem" onClick={() => { setExportMenuOpen(false); exportJson(); }}>JSON (backup card data)</li>
                </ul>
              )}
            </div>
          </div>
          <p className="card-export-hint">
            Esporta subito PDF/PNG/SVG. Le card salvate appariranno in <em>Collection</em> dalla prossima release.
          </p>
        </section>

        {/* COLONNA 2: PREVIEW */}
        <section className="card-editor-preview" aria-label="Anteprima bigliettino">
          <div className="card-editor-preview-header">
            <h2>Anteprima</h2>
            <div className="card-editor-preview-toolbar">
              <CardPreviewZoomControls
                zoom={previewZoom.zoom}
                canZoomIn={previewZoom.canZoomIn()}
                canZoomOut={previewZoom.canZoomOut()}
                onZoomIn={previewZoom.zoomIn}
                onZoomOut={previewZoom.zoomOut}
                onReset={previewZoom.reset}
              />
              <button
                type="button"
                className={`card-grid-toggle ${showGrid ? 'active' : ''}`}
                onClick={() => setShowGrid((v) => !v)}
                title={showGrid ? 'Nascondi griglia' : 'Mostra griglia'}
                aria-label={showGrid ? 'Nascondi griglia' : 'Mostra griglia'}
                aria-pressed={showGrid}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
                <span>{showGrid ? 'Griglia ON' : 'Griglia OFF'}</span>
              </button>
            </div>
          </div>
          <div
            className="card-previews"
            style={{
              transform: `scale(${previewZoom.zoom})`,
              transformOrigin: 'top center',
            }}
          >
            <div className="card-preview-wrap">
              <h3>Fronte</h3>
              <CardPreview side="front" card={card} showGrid={showGrid} />
            </div>
            <div className="card-preview-wrap">
              <h3>Retro</h3>
              <CardPreview side="back" card={card} showGrid={showGrid} />
            </div>
          </div>

          {/* B2: Grid editor manuale */}
          <div className="card-grid-editor" data-testid="card-grid-editor">
            <div className="card-grid-editor-title">Sposta elementi sulla griglia</div>
            <label className="card-field">
              <span>Elemento selezionato</span>
              <select
                value={selectedGridElement}
                onChange={(e) => setSelectedGridElement(e.target.value as keyof CardGrid['elements'])}
                aria-label="Elemento selezionato"
              >
                <option value="">—</option>
                <option value="photo">Foto</option>
                <option value="name">Nome</option>
                <option value="title">Ruolo</option>
                <option value="company">Azienda</option>
                <option value="contacts">Contatti</option>
                <option value="qr">QR</option>
                <option value="socials">Social</option>
              </select>
            </label>
            <label className="card-field">
              <span>Preset griglia</span>
              <select
                value={gridPresetChoice}
                onChange={(e) => {
                  const v = e.target.value as 'left' | 'centered' | 'split';
                  setGridPresetChoice(v);
                  applyGridPreset(v);
                }}
                aria-label="Preset griglia"
              >
                <option value="left">Sinistra (foto a sx)</option>
                <option value="centered">Centrato</option>
                <option value="split">Diviso (contatti + QR)</option>
              </select>
            </label>
            <div className="card-grid-arrows" role="group" aria-label="Sposta elemento">
              <button type="button" onClick={() => moveSelectedElement(-1, 0)} disabled={!selectedGridElement} aria-label="Sposta a sinistra" title="Sposta a sinistra"><span aria-hidden="true">←</span></button>
              <button type="button" onClick={() => moveSelectedElement(0, -1)} disabled={!selectedGridElement} aria-label="Sposta su" title="Sposta su"><span aria-hidden="true">↑</span></button>
              <button type="button" onClick={() => moveSelectedElement(0, 1)} disabled={!selectedGridElement} aria-label="Sposta giù" title="Sposta giù"><span aria-hidden="true">↓</span></button>
              <button type="button" onClick={() => moveSelectedElement(1, 0)} disabled={!selectedGridElement} aria-label="Sposta a destra" title="Sposta a destra"><span aria-hidden="true">→</span></button>
            </div>
            <div className="card-grid-resize" role="group" aria-label="Ridimensiona elemento">
              <button type="button" onClick={() => resizeSelectedElement(-1, 0)} disabled={!selectedGridElement} aria-label="Riduci larghezza" title="Riduci larghezza"><span aria-hidden="true">−↔</span></button>
              <button type="button" onClick={() => resizeSelectedElement(1, 0)} disabled={!selectedGridElement} aria-label="Aumenta larghezza" title="Aumenta larghezza"><span aria-hidden="true">+↔</span></button>
              <button type="button" onClick={() => resizeSelectedElement(0, -1)} disabled={!selectedGridElement} aria-label="Riduci altezza" title="Riduci altezza"><span aria-hidden="true">−↕</span></button>
              <button type="button" onClick={() => resizeSelectedElement(0, 1)} disabled={!selectedGridElement} aria-label="Aumenta altezza" title="Aumenta altezza"><span aria-hidden="true">+↕</span></button>
            </div>
          </div>
        </section>

        {/* COLONNA 3: AI PANEL (collapsible) */}
        {showAi ? (
          <section className="card-editor-ai" aria-label="AI che modifica il bigliettino">
            <div className="panel-kicker">
              <span>AI Design Mode</span>
              <button
                className="panel-toggle"
                onClick={() => setShowAi(false)}
                title="Collassa pannello AI"
                aria-label="Collassa AI"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
            </div>
            <div className="card-ai-model-row">
              <label className="card-field">
                <span>Modello AI</span>
                <select value={aiModel} onChange={(e) => setAiModel(e.target.value)} aria-label="Modello AI">
                  {availableModels.length > 0 ? availableModels.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} — {m.model}</option>
                  )) : (
                    <option value="deepseek-chat">DeepSeek Chat</option>
                  )}
                </select>
              </label>
            </div>
            <textarea
              className="card-ai-textarea"
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              aria-label="Prompt AI personalizzato"
              placeholder="Es. Rendi premium, cambia palette in navy, sposta il QR a sinistra..."
              rows={2}
            />
            <div className="card-ai-actions">
              <button type="button" onClick={() => runCardAI('premium')} disabled={isCardProcessing}>Rendi premium</button>
              <button type="button" onClick={() => runCardAI('minimal')} disabled={isCardProcessing}>Minimal</button>
              <button type="button" onClick={() => runCardAI('fill')} disabled={isCardProcessing}>Compila da nome</button>
              <button type="button" onClick={() => runCardAI('palette')} disabled={isCardProcessing}>Cambia palette</button>
              <button type="button" onClick={() => runCardAI('print')} disabled={isCardProcessing}>Ottimizza per stampa</button>
              <button type="button" onClick={() => runCardAI('moveQr')} disabled={isCardProcessing} title="Sposta il QR a sinistra">← Sposta QR</button>
              <button type="button" onClick={() => runCardAI('growPhoto')} disabled={isCardProcessing} title="Allarga la foto">↔ Allarga foto</button>
            </div>
            <div className="card-ai-extra">
              <button type="button" className="card-action-primary" onClick={() => runCardAI('custom')} disabled={isCardProcessing}>
                {isCardProcessing ? 'Elaborazione...' : 'Applica prompt personalizzato'}
              </button>
              <button type="button" className="card-ai-reset" onClick={resetCardChat} disabled={isCardProcessing}>
                Nuova conversazione
              </button>
            </div>
            <AILogPanel logs={cardAiLogs} isProcessing={isCardProcessing} />
          </section>
        ) : (
          <button
            className="card-ai-expand"
            onClick={() => setShowAi(true)}
            title="Espandi pannello AI"
            aria-label="Espandi AI"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
            <span>AI</span>
          </button>
        )}
      </div>
      )}

      {isMobile && (
        <>
          <div className="card-mobile-toolbar" data-testid="mobile-toolbar">
            <button
              type="button"
              className="card-mobile-save-btn"
              data-testid="mobile-save-btn"
              onClick={handleSave}
              title="Salva nel cloud"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              <span>Salva</span>
            </button>
            <div className="card-mobile-export-wrap" ref={exportMenuRef}>
              <button
                type="button"
                className="card-mobile-export-btn"
                data-testid="mobile-export-btn"
                onClick={() => setExportMenuOpen((v) => !v)}
                title="Esporta in vari formati"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Esporta ▾</span>
              </button>
              {exportMenuOpen && (
                <ul className="card-mobile-export-menu" role="menu">
                  <li role="menuitem" onClick={() => { setExportMenuOpen(false); exportPdf(); }}>
                    {exporting === 'pdf' ? 'Esportando…' : 'PDF 10-up (tipografia)'}
                  </li>
                  <li role="menuitem" onClick={() => { setExportMenuOpen(false); exportPng('front'); }}>
                    {exporting === 'png-front' ? 'Esportando…' : 'PNG fronte'}
                  </li>
                  <li role="menuitem" onClick={() => { setExportMenuOpen(false); exportPng('back'); }}>
                    PNG retro
                  </li>
                  <li role="menuitem" onClick={() => { setExportMenuOpen(false); exportSvg('front'); }}>
                    SVG fronte (vettoriale, editabile)
                  </li>
                  <li role="menuitem" onClick={() => { setExportMenuOpen(false); exportSvg('back'); }}>
                    SVG retro (vettoriale, editabile)
                  </li>
                  <li role="menuitem" onClick={() => { setExportMenuOpen(false); exportJson(); }}>
                    JSON (backup card data)
                  </li>
                </ul>
              )}
            </div>
          </div>
          <CardAIFab
            onClick={aiFloating.toggle}
            unreadCount={aiFloating.hasUnread ? cardAiLogs.length : 0}
          />
          <CardAIBottomSheet
            isOpen={aiFloating.isOpen}
            onClose={aiFloating.close}
            ariaLabel="Pannello AI"
          >
            <div className="card-ai-mobile-content">
              <div className="panel-kicker">
                <span>AI Design Mode</span>
                <button
                  type="button"
                  onClick={aiFloating.close}
                  aria-label="Chiudi pannello AI"
                  title="Chiudi"
                >×</button>
              </div>
              <label className="card-field">
                <span>Modello AI</span>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  aria-label="Modello AI"
                >
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} — {m.model}</option>
                  ))}
                </select>
              </label>
              <label className="card-field card-ai-textarea">
                <span>Prompt AI personalizzato</span>
                <textarea
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  rows={4}
                  placeholder="Es. Rendi premium, cambia palette in navy, sposta il QR a sinistra..."
                  aria-label="Prompt AI personalizzato"
                />
              </label>
              <div className="card-ai-actions">
                <button type="button" onClick={() => runCardAI('premium')} disabled={isCardProcessing}>Rendi premium</button>
                <button type="button" onClick={() => runCardAI('minimal')} disabled={isCardProcessing}>Minimal</button>
                <button type="button" onClick={() => runCardAI('fillName')} disabled={isCardProcessing}>Compila da nome</button>
                <button type="button" onClick={() => runCardAI('palette')} disabled={isCardProcessing}>Cambia palette</button>
                <button type="button" onClick={() => runCardAI('print')} disabled={isCardProcessing}>Ottimizza per stampa</button>
                <button type="button" onClick={() => runCardAI('moveQr')} disabled={isCardProcessing} title="Sposta il QR a sinistra">← Sposta QR</button>
                <button type="button" onClick={() => runCardAI('growPhoto')} disabled={isCardProcessing} title="Allarga la foto">↔ Allarga foto</button>
              </div>
              <button
                type="button"
                className="card-ai-apply"
                onClick={() => runCardAI('custom')}
                disabled={isCardProcessing || !aiText.trim()}
              >
                Applica prompt personalizzato
              </button>
              <button
                type="button"
                className="card-ai-reset"
                onClick={resetCardChat}
                disabled={isCardProcessing}
              >
                Nuova conversazione
              </button>
              <AILogPanel logs={cardAiLogs} isProcessing={isCardProcessing} />
            </div>
          </CardAIBottomSheet>
        </>
      )}
    </div>
  );
}
