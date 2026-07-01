import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './CardEditor.css';
import CardEditorTabs from './CardEditorTabs';
import MobileGridEditor from './MobileGridEditor';
import CardAIFab from './CardAIFab';
import CardAIBottomSheet from './CardAIBottomSheet';
import CardPreviewSurface from './card/CardPreviewSurface';
import type {
  BusinessCard,
  CardGrid,
} from '../utils/documentSchemas';
import {
  createEmptyCard,
  createGiovanniCardTemplate,
  gridPresetLeft,
  gridPresetCentered,
  gridPresetFrontSplit,
  gridPresetBackDefault,
  deriveGridFromLayout,
  hasGridElements,
} from '../utils/documentSchemas';
import { CardGridControls, type GridSide } from './card/CardGridControls';
import CardAIControls from './card/CardAIControls';
import {
  CardFrontFields,
  CardBackFields,
  CardMediaFields,
  CardServicesFields,
  CardSocialsFields,
  CardQrAdvanced,
  CardStyleFields,
} from './card/CardFormFields';
import { compressImage } from '../utils/cardGenerator';
import { useCardExport } from '../hooks/useCardExport';
import { isAllowedLogoMime, isHttpUrl } from '../utils/qrGenerator';
import dataService from '../utils/dataService';
import { useToast } from '../hooks/useToast';
import { useAICard } from '../hooks/useAICard';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useCardPreviewZoom } from '../hooks/useCardPreviewZoom';
import { CardAIFloatingProvider, useCardAIFloating } from '../hooks/useCardAIFloating';
import { logger } from '../utils/logger';
import { useDocumentSave } from '../hooks/useDocumentSave';

const MAX_RAW_BYTES = 5_000_000;
const AUTO_SAVE_DELAY_MS = 30_000;

// Phase 2.2: label/costanti UI sono in `card/CardFormFields.tsx`;
// gli handler di export sono in `hooks/useCardExport.ts`.

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
  const { save: saveDocumentGuarded } = useDocumentSave();
  const [card, setCard] = useState<BusinessCard>(initialCard || createEmptyCard());
  const [showTemplateBanner, setShowTemplateBanner] = useState<boolean>(() => !initialCard);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiModel, setAiModel] = useState('deepseek-chat');
  const [showAi, setShowAi] = useState(true);
  // Phase 2.2 REQ-E01: `showGrid` è il master switch unico del grid-mode.
  // Quando è OFF la preview è in flexbox, l'overlay è nascosto, e i
  // controlli del grid editor sono disabilitati. `card.front.useGrid` /
  // `card.back.useGrid` restano persistiti (per reload/export) ma non
  // governano più il rendering: isGridMode = showGrid && hasGridElements.
  const [showGrid, setShowGrid] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobile = useMediaQuery('(max-width: 900px)');
  const aiFloating = useCardAIFloating();
  // Phase 2.2 REQ-C02: il default dello zoom si adegua al breakpoint
  // corrente a runtime (vedi useEffect sotto). Passiamo 1 come initial;
  // l'effect lo corregge dopo il primo render.
  const previewZoom = useCardPreviewZoom(1);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const { addToast } = useToast();
  const { processCardPrompt, resetCardChat, cardAiLogs, isCardProcessing, availableModels } = useAICard(userEmail);

  // Phase 2.2 REQ-C02: adegua lo zoom di default al breakpoint mobile/desktop.
  useEffect(() => {
    const defaultZoom = isMobile ? 0.7 : 1;
    // Solo se l'utente non l'ha cambiato manualmente (zoom ancora al default
    // precedente). Per semplicità: se l'utente è già a un valore ≠ 1 su
    // desktop, rispettiamo la sua scelta. Su mobile, se >0.9, portiamo a 0.7.
    if (isMobile && previewZoom.zoom > 0.9) {
      previewZoom.setZoom(defaultZoom);
    } else if (!isMobile && previewZoom.zoom < 0.9) {
      previewZoom.setZoom(defaultZoom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

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
    setCard((prev) => {
      const next = { ...prev.front, ...patch };
      // Phase 2.2 REQ-A03: cambiare `layout` mentre si è in grid-mode può
      // rompere il layout (la grid-mode ignora `front.layout` ma elementi
      // posizionati per un preset potrebbero non adattarsi al cambio).
      // Disattiviamo `useGrid` con un toast.
      if (patch.layout && patch.layout !== prev.front.layout && prev.front.useGrid) {
        addToast('info', 'Layout griglia disattivato sul fronte. Riapplica un preset per riattivare.', 5000);
        return { ...prev, front: { ...next, useGrid: false }, updatedAt: new Date().toISOString() };
      }
      return { ...prev, front: next, updatedAt: new Date().toISOString() };
    });
  }, [addToast]);

  const patchBack = useCallback((patch: Partial<BusinessCard['back']>) => {
    setCard((prev) => ({ ...prev, back: { ...prev.back, ...patch }, updatedAt: new Date().toISOString() }));
  }, []);

  const patchStyle = useCallback((patch: Partial<BusinessCard['style']>) => {
    setCard((prev) => {
      // Phase 2.2 REQ-A03: cambiare `sizePreset` cambia l'aspect-ratio
      // della preview; gli elementi posizionati via grid potrebbero non
      // adattarsi (es. preset 4×4 su card quadrata). Disattiviamo
      // `useGrid` su entrambi i lati per evitare overflow.
      if (patch.sizePreset && patch.sizePreset !== prev.style.sizePreset) {
        const wasFrontGrid = prev.front.useGrid;
        const wasBackGrid = prev.back.useGrid;
        if (wasFrontGrid || wasBackGrid) {
          addToast('info', 'Layout griglia disattivato: il formato è cambiato. Riapplica un preset per riattivare.', 5000);
          return {
            ...prev,
            style: { ...prev.style, ...patch },
            front: { ...prev.front, useGrid: false },
            back: { ...prev.back, useGrid: false },
            updatedAt: new Date().toISOString(),
          };
        }
      }
      return { ...prev, style: { ...prev.style, ...patch }, updatedAt: new Date().toISOString() };
    });
  }, [addToast]);

  // ─── B2: Grid editor state ─────────────────────────────────
  const [selectedGridElement, setSelectedGridElement] = useState<keyof CardGrid['elements'] | ''>('');
  // Phase 2.1: il grid editor è per lato (front o back). Non si possono
  // spostare elementi del front nel back e viceversa.
  const [gridEditorSide, setGridEditorSide] = useState<GridSide>('front');

  // Phase 2.2 REQ-E01: applica una grid al lato corrente. NON attiviamo
  // più automaticamente `useGrid`: la sorgente di verità per il rendering
  // è `showGrid` (master switch). `useGrid` viene impostato a true
  // SOLO quando l'utente conferma il grid-mode dal master switch.
  const patchGrid = useCallback((grid: CardGrid, persist?: { useGrid: boolean }) => {
    setCard((prev) => {
      if (gridEditorSide === 'back') {
        return {
          ...prev,
          backGrid: grid,
          back: { ...prev.back, useGrid: persist?.useGrid ?? prev.back.useGrid },
          updatedAt: new Date().toISOString(),
        };
      }
      return {
        ...prev,
        grid,
        front: { ...prev.front, useGrid: persist?.useGrid ?? prev.front.useGrid },
        updatedAt: new Date().toISOString(),
      };
    });
  }, [gridEditorSide]);

  // Phase 2.2 REQ-E01: applica un preset di griglia al lato corrente.
  // Imposta `useGrid: true` perché applicare un preset è azione
  // esplicita dell'utente.
  const applyGridPreset = useCallback((preset: 'left' | 'centered' | 'split') => {
    if (gridEditorSide === 'back') {
      // SOSTITUISCI completamente la grid: un preset non è un merge
      // (altrimenti elementi vecchi come `logo` rimangono in posizioni
      // precedenti, generando duplicati).
      setCard((prev) => {
        const next: BusinessCard = { ...prev, updatedAt: new Date().toISOString() };
        next.backGrid = gridPresetBackDefault();
        next.back = { ...prev.back, useGrid: true };
        return next;
      });
      return;
    }
    const frontGrid =
      preset === 'left' ? gridPresetLeft() :
      preset === 'centered' ? gridPresetCentered() :
      gridPresetFrontSplit();
    setCard((prev) => {
      const next: BusinessCard = { ...prev, updatedAt: new Date().toISOString() };
      next.grid = frontGrid;
      next.front = { ...prev.front, useGrid: true };
      return next;
    });
  }, [gridEditorSide]);

  // Phase 2.2 REQ-G01: handler invocato dopo una mossa (successo o blocco).
  // Mostra un toast coerente con la mossa. Restituisce true se applicata.
  const handleAfterMove = useCallback((info: { element: string; dx: number; dy: number; applied: boolean; reason?: 'collision' | 'border' }) => {
    if (info.applied) {
      const dir = (() => {
        if (info.dx > 0) return 'a destra';
        if (info.dx < 0) return 'a sinistra';
        if (info.dy > 0) return 'in basso';
        return 'in alto';
      })();
      addToast('success', `${info.element} spostato ${dir}`, 2500);
    } else if (info.reason === 'collision') {
      addToast('info', `Bloccato: ${info.element} collide con un altro elemento`, 3000);
    } else if (info.reason === 'border') {
      addToast('info', `Bloccato: bordo della griglia raggiunto`, 3000);
    }
  }, [addToast]);

  // Phase 2.2 REQ-G01: analogo per resize.
  const handleAfterResize = useCallback((info: { element: string; dw: number; dh: number; applied: boolean; reason?: 'collision' | 'border' }) => {
    if (info.applied) {
      addToast('success', `${info.element} ridimensionato`, 2500);
    } else if (info.reason === 'collision') {
      addToast('info', `Bloccato: resize causa collisione`, 3000);
    } else if (info.reason === 'border') {
      addToast('info', `Bloccato: bordo della griglia raggiunto`, 3000);
    }
  }, [addToast]);

  // Phase 2.2 REQ-E01: gestione master switch. Quando l'utente attiva
  // `showGrid` (OFF→ON) e il lato non ha ancora una grid, inizializziamo
  // la grid dal layout corrente (init-from-layout) e impostiamo useGrid
  // sul lato. Quando disattiva (ON→OFF), lasciamo la grid persistita
  // (verrà ricaricata al prossimo ON).
  const handleToggleShowGrid = useCallback(() => {
    setShowGrid((prev) => {
      const next = !prev;
      if (next) {
        // OFF → ON: init-from-layout per i lati che non hanno ancora grid.
        setCard((c) => {
          let mutated = false;
          let nextCard: BusinessCard = c;
          if (!c.grid || !hasGridElements('front', c)) {
            const initGrid = deriveGridFromLayout(c, 'front');
            nextCard = {
              ...nextCard,
              grid: initGrid,
              front: { ...nextCard.front, useGrid: true },
            };
            mutated = true;
          }
          if (!c.backGrid || !hasGridElements('back', c)) {
            const initGrid = deriveGridFromLayout(c, 'back');
            nextCard = {
              ...nextCard,
              backGrid: initGrid,
              back: { ...nextCard.back, useGrid: true },
            };
            mutated = true;
          }
          if (mutated) {
            addToast('info', 'Griglia attiva, ora puoi spostare gli elementi', 3000);
          } else {
            addToast('info', 'Griglia attiva', 2500);
          }
          return nextCard;
        });
      } else {
        addToast('info', 'Griglia disattivata', 2500);
      }
      return next;
    });
  }, [addToast]);

  // Phase 2.2 REQ-E03: deriva la griglia corrente per bounds/UI.
  const activeGrid: CardGrid = useMemo(() => {
    if (gridEditorSide === 'back') {
      return card.backGrid ?? deriveGridFromLayout(card, 'back');
    }
    return card.grid ?? deriveGridFromLayout(card, 'front');
  }, [gridEditorSide, card.grid, card.backGrid, card]);

  // Phase 2.2: elementi disponibili nel grid editor in base al contenuto
  // effettivo della card. Mostra solo gli elementi che hanno qualcosa da
  // posizionare (es. se non c'è un QR code, non mostrare "QR" nella select).
  const availableGridElements = useMemo<Array<{ value: keyof CardGrid['elements']; label: string }>>(() => {
    if (gridEditorSide === 'front') {
      const els: Array<{ value: keyof CardGrid['elements']; label: string }> = [];
      if (card.front.photoUrl) els.push({ value: 'photo', label: 'Foto' });
      if (card.front.logoUrl) els.push({ value: 'logo', label: 'Logo' });
      if (card.front.name.trim()) els.push({ value: 'name', label: 'Nome' });
      if (card.front.title.trim()) els.push({ value: 'title', label: 'Ruolo' });
      if (card.front.company.trim()) els.push({ value: 'company', label: 'Azienda' });
      return els;
    }
    const els: Array<{ value: keyof CardGrid['elements']; label: string }> = [];
    const hasContacts = card.back.phone.trim() || card.back.email.trim() ||
      card.back.website.trim() || card.back.address.trim() || card.back.vatNumber.trim();
    if (hasContacts) els.push({ value: 'contacts', label: 'Contatti' });
    if (card.back.qrPayload.trim() || card.back.website.trim()) {
      els.push({ value: 'qr', label: 'QR' });
    }
    if (card.back.socials.some((s) => s.platform && s.url)) {
      els.push({ value: 'socials', label: 'Social' });
    }
    return els;
  }, [gridEditorSide, card.front, card.back]);

  const patchTitle = useCallback((title: string) => {
    setCard((prev) => ({ ...prev, title, updatedAt: new Date().toISOString() }));
  }, []);

  // ─── TEMPLATE ─────────────────────────────────────────
  const applyGiovanniTemplate = useCallback(() => {
    setCard(createGiovanniCardTemplate());
    setShowTemplateBanner(false);
    addToast('info', 'Template personale Giovanni caricato');
  }, [addToast]);

  const resetCard = useCallback(() => {
    setCard(createEmptyCard());
    setShowTemplateBanner(true);
    setShowGrid(false);
    setSelectedGridElement('');
    setGridEditorSide('front');
    setUploadError(null);
    setAiText('');
    setExportMenuOpen(false);
    addToast('info', 'Nuovo bigliettino vuoto pronto');
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
      if (field === 'logoUrl' && file.type === 'image/svg+xml') {
        // Fix qualità logo: SVG deve restare vettoriale. Prima passava da
        // canvas→PNG e diventava raster, quindi se ingrandito in grid-mode
        // risultava sgranato. Come <img src="data:image/svg+xml..."> gli
        // script SVG non vengono eseguiti dai browser moderni.
        const svg = await file.text();
        patchFront({ logoUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` });
        return;
      }
      // Logo → PNG per preservare la trasparenza (altrimenti JPEG riempe
      // lo sfondo trasparente di nero). Foto → JPEG per file più leggero.
      const dataUri = await compressImage(file, undefined, undefined, {
        format: field === 'logoUrl' ? 'png' : 'jpeg',
      });
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

  // ─── EXPORT (PDF/PNG/SVG/JSON), hook dedicato (Phase 2.2 refactor) ──
  const { exporting, exportPdf, exportPng, exportSvg, exportJson } = useCardExport(card, tier, addToast);

  // ─── SAVE (manual) ────────────────────────────────────
  const handleSave = useCallback(async () => {
    const sanitized: BusinessCard = { ...card, userEmail, updatedAt: new Date().toISOString() };
    // Phase 5: use guarded save which checks the free-tier doc limit
    // and triggers the TierLimitModal if reached.
    const result = await saveDocumentGuarded(userEmail, sanitized);
    if (result.blocked) {
      addToast('info', 'Limite piano free raggiunto. Sblocca per continuare.');
      return;
    }
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
      const gridChanged = realChanges.some((c: string) => c.startsWith('Griglia:')) ||
        result.card.front.useGrid || result.card.back.useGrid;
      if (gridChanged) {
        // Phase 2.2 fix: se l'AI modifica la griglia, la preview deve
        // entrare subito in grid-mode. Prima i dati cambiavano ma
        // `showGrid` restava OFF, quindi visivamente non succedeva nulla.
        setShowGrid(true);
      }
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
      // Phase 5: use guarded save
      saveDocumentGuarded(userEmail, sanitized).then((result) => {
        if (result.blocked) {
          addToast('info', 'Limite piano free raggiunto. Sblocca per continuare.');
        } else if (result.error) {
          logger.error('Card auto-save failed', { err: result.error });
        }
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

  // ─── Services (lista servizi offerti sul retro bigliettino) ────────
  const addService = useCallback(() => {
    setCard((prev) => {
      const current = prev.back.services ?? [];
      if (current.length >= 8) return prev;
      return {
        ...prev,
        back: { ...prev.back, services: [...current, ''] },
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const updateService = useCallback((idx: number, value: string) => {
    setCard((prev) => {
      const services = [...(prev.back.services ?? [])];
      services[idx] = value.slice(0, 80);
      return { ...prev, back: { ...prev.back, services }, updatedAt: new Date().toISOString() };
    });
  }, []);

  const removeService = useCallback((idx: number) => {
    setCard((prev) => ({
      ...prev,
      back: { ...prev.back, services: (prev.back.services ?? []).filter((_, i) => i !== idx) },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const websiteValid = useMemo(() => !card.back.website || isHttpUrl(card.back.website), [card.back.website]);

  // ─── Form content (shared between desktop 3-col and mobile tabs) ───
  // Phase 2.2 REQ-B02: set UNICO di componenti condivisi (vedi
  // src/components/card/CardFormFields.tsx). Niente più JSX duplicato
  // desktop/mobile. Le sezioni sono: Fronte, Foto/Logo, Retro,
  // Servizi, Social, Opzioni QR, Stile.
  const formAndActionsContent = useMemo(() => (
    <>
      <CardFrontFields card={card} patchFront={patchFront} patchBack={patchBack} patchStyle={patchStyle} />
      <CardMediaFields
        card={card}
        patchFront={patchFront}
        patchBack={patchBack}
        patchStyle={patchStyle}
        onUpload={handleUpload}
        onRemovePhoto={removePhoto}
        onRemoveLogo={removeLogo}
        uploadError={uploadError}
      />
      <CardBackFields card={card} patchFront={patchFront} patchBack={patchBack} patchStyle={patchStyle} />
      <fieldset className="card-fieldset">
        <legend>Servizi e social</legend>
        <CardServicesFields
          services={card.back.services ?? []}
          servicesLabel={card.back.servicesLabel ?? ''}
          updateService={updateService}
          addService={addService}
          removeService={removeService}
          patchBack={patchBack}
          socials={card.back.socials}
          updateSocial={updateSocial}
          addSocial={addSocial}
          removeSocial={removeSocial}
        />
        <CardSocialsFields
          services={card.back.services ?? []}
          servicesLabel={card.back.servicesLabel ?? ''}
          socials={card.back.socials}
          updateSocial={updateSocial}
          addSocial={addSocial}
          removeSocial={removeSocial}
          updateService={updateService}
          addService={addService}
          removeService={removeService}
          patchBack={patchBack}
        />
      </fieldset>
      <CardQrAdvanced card={card} patchFront={patchFront} patchBack={patchBack} patchStyle={patchStyle} />
      <CardStyleFields card={card} patchFront={patchFront} patchBack={patchBack} patchStyle={patchStyle} />
    </>
  ), [card, patchFront, patchBack, patchStyle, handleUpload, removePhoto, removeLogo, uploadError, updateService, addService, removeService, updateSocial, addSocial, removeSocial]);

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
        <button type="button" className="card-reset-btn" onClick={resetCard}>
          Nuovo / reset
        </button>
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
                  <CardPreviewSurface
                    card={card}
                    tier={tier}
                    showGrid={showGrid}
                    onToggleGrid={handleToggleShowGrid}
                    zoom={previewZoom}
                    heading="Anteprima"
                  />
                  <MobileGridEditor
                    card={card}
                    side={gridEditorSide}
                    gridEnabled={showGrid}
                    selected={selectedGridElement}
                    onSelect={setSelectedGridElement}
                    onChangeSide={(s) => { setGridEditorSide(s); setSelectedGridElement(''); }}
                    onChangeGrid={patchGrid}
                    onAfterMove={handleAfterMove}
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
                  <CardAIControls
                    variant="mobile"
                    aiModel={aiModel}
                    onModelChange={setAiModel}
                    aiText={aiText}
                    onTextChange={setAiText}
                    availableModels={availableModels}
                    isProcessing={isCardProcessing}
                    onRun={runCardAI}
                    onReset={resetCardChat}
                    logs={cardAiLogs}
                  />
                </div>
              ),
            },
          ]}
        />
      ) : null}

      {!isMobile && (
      <div className="card-editor-3col">
        {/* COLONNA 1: FORM (Phase 2.2 REQ-B02: riusa lo stesso set di
         * componenti della tab mobile "Modifica", zero duplicazione). */}
        <section className="card-editor-form" aria-label="Configurazione bigliettino">
          {formAndActionsContent}

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
                  <li><button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); void exportPdf(); }}>PDF 10-up (A4, pronto tipografia)</button></li>
                  <li><button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); void exportPng('front'); }}>PNG fronte (300 DPI)</button></li>
                  <li><button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); void exportPng('back'); }}>PNG retro (300 DPI)</button></li>
                  <li><button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); exportSvg('front'); }}>SVG fronte (vettoriale, editabile)</button></li>
                  <li><button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); exportSvg('back'); }}>SVG retro (vettoriale, editabile)</button></li>
                  <li><button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); exportJson(); }}>JSON (backup card data)</button></li>
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
          <CardPreviewSurface
            card={card}
            tier={tier}
            showGrid={showGrid}
            onToggleGrid={handleToggleShowGrid}
            zoom={previewZoom}
            heading="Anteprima"
          />

          {/* Phase 2.2 REQ-B02: grid editor condiviso (vedi card/CardGridControls).
           * Sostituisce l'inline duplicato (lato + elemento + preset + frecce
           * + resize) e gestisce: gating del master switch, filtro per
           * contenuto, cols/rows, clamp graduale, toast feedback via onAfterMove. */}
          <CardGridControls
            card={card}
            side={gridEditorSide}
            gridEnabled={showGrid}
            onSideChange={(s) => {
              setGridEditorSide(s);
              setSelectedGridElement('');
            }}
            onChangeGrid={patchGrid}
            onApplyPreset={applyGridPreset}
            selected={selectedGridElement}
            onSelect={setSelectedGridElement}
            onAfterMove={handleAfterMove}
            onAfterResize={handleAfterResize}
          />
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
            <CardAIControls
              variant="desktop"
              aiModel={aiModel}
              onModelChange={setAiModel}
              aiText={aiText}
              onTextChange={setAiText}
              availableModels={availableModels}
              isProcessing={isCardProcessing}
              onRun={runCardAI}
              onReset={resetCardChat}
              logs={cardAiLogs}
            />
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
                  <li><button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); void exportPdf(); }}>{exporting === 'pdf' ? 'Esportando…' : 'PDF 10-up (tipografia)'}</button></li>
                  <li><button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); void exportPng('front'); }}>{exporting === 'png-front' ? 'Esportando…' : 'PNG fronte'}</button></li>
                  <li><button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); void exportPng('back'); }}>PNG retro</button></li>
                  <li><button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); exportSvg('front'); }}>SVG fronte (vettoriale, editabile)</button></li>
                  <li><button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); exportSvg('back'); }}>SVG retro (vettoriale, editabile)</button></li>
                  <li><button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); exportJson(); }}>JSON (backup card data)</button></li>
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
              <CardAIControls
                variant="mobile"
                aiModel={aiModel}
                onModelChange={setAiModel}
                aiText={aiText}
                onTextChange={setAiText}
                availableModels={availableModels}
                isProcessing={isCardProcessing}
                onRun={runCardAI}
                onReset={resetCardChat}
                logs={cardAiLogs}
              />
            </div>
          </CardAIBottomSheet>
        </>
      )}
    </div>
  );
}
