import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  BusinessCard,
  BusinessCardLayout,
  CardGrid,
} from '../../utils/documentSchemas';
import {
  createEmptyCard,
  createGiovanniCardTemplate,
  gridPresetBackDefault,
  deriveGridFromLayout,
  hasGridElements,
  mergeCardWithDefaults,
} from '../../utils/documentSchemas';
import { CardGridControls, type GridSide } from './CardGridControls';
import CardAIControls from './CardAIControls';
import {
  CardFrontFields,
  CardBackFields,
  CardMediaFields,
  CardServicesFields,
  CardSocialsFields,
  CardQrAdvanced,
  CardStyleFields,
} from './CardFormFields';
import { compressImage } from '../../utils/cardGenerator';
import { useCardExport } from '../../hooks/useCardExport';
import { isAllowedLogoMime, isHttpUrl } from '../../utils/qrGenerator';
import { useToast } from '../../hooks/useToast';
import { useAICard } from '../../hooks/useAICard';
import { findCardQuickAction } from '../../ai/prompts/cardQuickActions';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useCardPreviewZoom } from '../../hooks/useCardPreviewZoom';
import { useCardAIFloating } from '../../hooks/useCardAIFloating';
import { logger } from '../../utils/logger';
import { useDocumentSave } from '../../hooks/useDocumentSave';
import CardSaveAction from './CardSaveAction';
import CardExportMenu from './CardExportMenu';
import CardPreviewSurface from './CardPreviewSurface';
import CardEditorTabs from './CardEditorTabs';
import MobileGridEditor from '../MobileGridEditor';
import CardAIFab from '../CardAIFab';
import CardAIBottomSheet from '../CardAIBottomSheet';
import SaveDialog from '../SaveDialog';
import {
  loadPromptLibrary,
  addPromptEntry,
  removePromptEntry,
  PROMPT_LIBRARY_KEYS,
  type PromptLibraryEntry,
} from '../../utils/promptLibrary';
import { buildCardPhotoBrief } from '../../utils/card/photoBrief';
import { pruneCardGrids } from '../../utils/card/gridElements';
import {
  pushLayoutEvent,
  attachLayoutEventsToWindow,
} from '../../utils/card/layoutEvents';

const MAX_RAW_BYTES = 5_000_000;
const AUTO_SAVE_DELAY_MS = 30_000;

function cardHasContent(c: BusinessCard): boolean {
  return !!(
    c.title?.trim()
    || c.front.name?.trim()
    || c.front.title?.trim()
    || c.front.company?.trim()
    || c.front.photoUrl
    || c.front.logoUrl
    || c.back.phone?.trim()
    || c.back.email?.trim()
    || c.back.website?.trim()
  );
}

function defaultCardTitle(c: BusinessCard): string {
  if (c.title?.trim()) return c.title.trim();
  if (c.front.name?.trim()) return `Bigliettino ${c.front.name.trim()}`;
  return 'Bigliettino';
}

export interface CardEditorShellProps {
  userEmail: string;
  initialCard?: BusinessCard;
  documentTheme: 'corporate' | 'minimal' | 'creative' | 'legal' | 'luxury';
  tier: 'free' | 'unlocked';
}

export default function CardEditorShell({ userEmail, initialCard, documentTheme, tier }: CardEditorShellProps) {
  const { save: saveDocumentGuarded } = useDocumentSave();
  const [card, setCard] = useState<BusinessCard>(() => mergeCardWithDefaults(initialCard));
  const [showTemplateBanner, setShowTemplateBanner] = useState<boolean>(() => !initialCard);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiModel, setAiModel] = useState('deepseek-chat');
  const [showAi, setShowAi] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [isCoverGenerating, setIsCoverGenerating] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedIdRef = useRef<string | undefined>(initialCard?.id);

  // Test/debug introspection for layout events.
  useEffect(() => {
    if (import.meta.env.MODE === 'test' || import.meta.env.DEV || localStorage.getItem('pq_card_layout_debug') === '1') {
      attachLayoutEventsToWindow();
    }
  }, []);

  // When Collection opens a different card, replace local state.
  useEffect(() => {
    if (!initialCard?.id) return;
    if (initialCard.id === loadedIdRef.current) return;
    loadedIdRef.current = initialCard.id;
    setCard(mergeCardWithDefaults(initialCard));
    setShowTemplateBanner(false);
  }, [initialCard]);
  const isMobile = useMediaQuery('(max-width: 900px)');
  const aiFloating = useCardAIFloating();
  const previewZoom = useCardPreviewZoom(1);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const { addToast } = useToast();
  const { processCardPrompt, generateCover, generatePhoto, resetCardChat, cardAiLogs, isCardProcessing, availableModels } = useAICard(userEmail);
  const [isPhotoGenerating, setIsPhotoGenerating] = useState(false);
  const [photoPrompt, setPhotoPrompt] = useState('');
  const [showPhotoPromptEditor, setShowPhotoPromptEditor] = useState(false);
  const [photoLibrary, setPhotoLibrary] = useState(() => loadPromptLibrary(PROMPT_LIBRARY_KEYS.cardPhoto));

  useEffect(() => {
    const defaultZoom = isMobile ? 0.7 : 1;
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

  const patchFront = useCallback((patch: Partial<BusinessCard['front']>) => {
    setCard((prev) => {
      const next = { ...prev.front, ...patch };
      if (patch.layout && patch.layout !== prev.front.layout) {
        const newGrid = deriveGridFromLayout({ ...prev, front: next }, 'front');
        return { ...prev, front: { ...next }, grid: newGrid, updatedAt: new Date().toISOString() };
      }
      return { ...prev, front: next, updatedAt: new Date().toISOString() };
    });
  }, [addToast]);

  const patchBack = useCallback((patch: Partial<BusinessCard['back']>) => {
    setCard((prev) => ({ ...prev, back: { ...prev.back, ...patch }, updatedAt: new Date().toISOString() }));
  }, []);

  const patchStyle = useCallback((patch: Partial<BusinessCard['style']>) => {
    setCard((prev) => {
      if (patch.sizePreset && patch.sizePreset !== prev.style.sizePreset) {
        return {
          ...prev,
          style: { ...prev.style, ...patch },
          updatedAt: new Date().toISOString(),
        };
      }
      return { ...prev, style: { ...prev.style, ...patch }, updatedAt: new Date().toISOString() };
    });
  }, [addToast]);

  const [selectedGridElement, setSelectedGridElement] = useState<keyof CardGrid['elements'] | ''>('');
  const [gridEditorSide, setGridEditorSide] = useState<GridSide>('front');

  const setGridEditorSideLogged = useCallback((s: GridSide) => {
    setGridEditorSide(s);
    pushLayoutEvent({ type: 'grid.side', side: s, result: 'ok' });
  }, []);

  const setSelectedGridElementLogged = useCallback((k: keyof CardGrid['elements'] | '') => {
    setSelectedGridElement(k);
    pushLayoutEvent({ type: 'grid.select', side: gridEditorSide, element: k || undefined, result: 'ok' });
  }, [gridEditorSide]);

  const patchGrid = useCallback((grid: CardGrid) => {
    setCard((prev) => {
      if (gridEditorSide === 'back') {
        return {
          ...prev,
          backGrid: grid,
          updatedAt: new Date().toISOString(),
        };
      }
      return {
        ...prev,
        grid,
        updatedAt: new Date().toISOString(),
      };
    });
  }, [gridEditorSide]);

  const logGridChange = useCallback((type: 'move' | 'resize' | 'align', info: { element: string; applied: boolean; reason?: 'collision' | 'border'; payload?: Record<string, unknown> }) => {
    pushLayoutEvent({
      type: type === 'move' ? 'grid.move' : type === 'resize' ? 'grid.resize' : 'grid.align',
      side: gridEditorSide,
      element: info.element,
      result: info.applied ? 'ok' : info.reason === 'collision' || info.reason === 'border' ? 'blocked' : 'error',
      reason: info.reason,
      payload: info.payload,
    });
  }, [gridEditorSide]);

  const applyGridPreset = useCallback((preset: BusinessCardLayout) => {
    pushLayoutEvent({ type: 'grid.preset', side: gridEditorSide, result: 'ok', payload: { preset } });
    if (gridEditorSide === 'back') {
      setCard((prev) => ({
        ...prev,
        backGrid: gridPresetBackDefault(),
        updatedAt: new Date().toISOString(),
      }));
      return;
    }
    const frontGrid = deriveGridFromLayout({ ...card, front: { ...card.front, layout: preset } }, 'front');
    setCard((prev) => ({
      ...prev,
      grid: frontGrid,
      updatedAt: new Date().toISOString(),
    }));
  }, [gridEditorSide, card]);

  const handleAfterMove = useCallback((info: { element: string; dx: number; dy: number; applied: boolean; reason?: 'collision' | 'border' }) => {
    logGridChange('move', { element: info.element, applied: info.applied, reason: info.reason, payload: { dx: info.dx, dy: info.dy } });
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
  }, [addToast, logGridChange]);

  const handleAfterResize = useCallback((info: { element: string; dw: number; dh: number; applied: boolean; reason?: 'collision' | 'border' }) => {
    logGridChange('resize', { element: info.element, applied: info.applied, reason: info.reason, payload: { dw: info.dw, dh: info.dh } });
    if (info.applied) {
      addToast('success', `${info.element} ridimensionato`, 2500);
    } else if (info.reason === 'collision') {
      addToast('info', `Bloccato: resize causa collisione`, 3000);
    } else if (info.reason === 'border') {
      addToast('info', `Bloccato: bordo della griglia raggiunto`, 3000);
    }
  }, [addToast, logGridChange]);

  const handleToggleShowGrid = useCallback(() => {
    setShowGrid((prev) => {
      const next = !prev;
      pushLayoutEvent({ type: 'grid.toggle', side: gridEditorSide, result: 'ok', payload: { showGrid: next } });
      return next;
    });
    setCard((c) => {
      const next = !showGrid;
      if (!next) {
        addToast('info', 'Griglia disattivata', 2500);
        // v2.8.1: turning the grid OFF only hides the overlay/controls;
        // we keep useGrid=true so the persisted grid layout is still used
        // by both preview and export (REQ-E01: OFF hides overlay, not layout).
        return { ...c, updatedAt: new Date().toISOString() };
      }
      let mutated = false;
      let nextCard: BusinessCard = c;
      const frontHasGrid = hasGridElements('front', c);
      const backHasGrid = hasGridElements('back', c);
      if (!c.grid || !frontHasGrid) {
        const initGrid = deriveGridFromLayout(c, 'front');
        nextCard = { ...nextCard, grid: initGrid };
        mutated = true;
      }
      if (!c.backGrid || !backHasGrid) {
        const initGrid = deriveGridFromLayout(c, 'back');
        nextCard = { ...nextCard, backGrid: initGrid };
        mutated = true;
      }
      if (mutated) {
        addToast('info', 'Griglia attiva, ora puoi spostare gli elementi', 3000);
      } else {
        addToast('info', 'Griglia attiva', 2500);
      }
      // v2.8.1: when the user turns grid ON, persist useGrid=true so the
      // persisted grids become the single source of truth for preview AND
      // export. Otherwise the export would keep deriving from flexbox layout.
      nextCard = {
        ...nextCard,
        front: { ...nextCard.front, useGrid: true },
        back: { ...nextCard.back, useGrid: true },
      };
      return { ...nextCard, updatedAt: new Date().toISOString() };
    });
  }, [addToast, showGrid]);

  const patchTitle = useCallback((title: string) => {
    setCard((prev) => ({ ...prev, title, updatedAt: new Date().toISOString() }));
  }, []);

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

  const removeCoverImage = useCallback(() => {
    patchFront({ coverImageUrl: null });
    addToast('info', 'Cover AI rimossa');
  }, [patchFront, addToast]);

  const removeBackCoverImage = useCallback(() => {
    patchBack({ coverImageUrl: null });
    addToast('info', 'Cover AI retro rimossa');
  }, [patchBack, addToast]);

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
        const svg = await file.text();
        patchFront({ logoUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` });
        return;
      }
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

  const { exporting, exportPdf, exportPng, exportSvg, exportJson } = useCardExport(card, tier, addToast);

  const handleExportAction = useCallback((action: string) => {
    setExportMenuOpen(false);
    pushLayoutEvent({ type: 'export.start', result: 'ok', payload: { action } });
    switch (action) {
      case 'pdf':
        void exportPdf({ cropMarks: true });
        break;
      case 'pdf-clean':
        void exportPdf({ cropMarks: false });
        break;
      case 'png-front':
        void exportPng('front');
        break;
      case 'png-back':
        void exportPng('back');
        break;
      case 'svg-front':
        void exportSvg('front');
        break;
      case 'svg-back':
        void exportSvg('back');
        break;
      case 'json':
        exportJson();
        break;
    }
    pushLayoutEvent({ type: 'export.success', result: 'ok', payload: { action } });
  }, [exportPdf, exportPng, exportSvg, exportJson]);

  const openSaveDialog = useCallback(() => {
    if (!userEmail) {
      addToast('error', 'Devi essere loggato per salvare.');
      return;
    }
    if (!cardHasContent(card)) {
      addToast('info', 'Compila almeno nome o contatti prima di salvare.');
      return;
    }
    setShowSaveDialog(true);
  }, [card, userEmail, addToast]);

  const handleSave = useCallback(async (customName?: string) => {
    if (!userEmail) {
      addToast('error', 'Devi essere loggato per salvare.');
      return;
    }
    const title = (customName?.trim() || defaultCardTitle(card));
    const sanitized: BusinessCard = {
      ...pruneCardGrids(card),
      title,
      userEmail,
      updatedAt: new Date().toISOString(),
    };
    const result = await saveDocumentGuarded(userEmail, sanitized);
    if (result.blocked) {
      addToast('info', 'Limite piano free raggiunto. Sblocca per continuare.');
      return;
    }
    if (result.error) {
      addToast('error', result.error);
      return;
    }
    setCard(sanitized);
    loadedIdRef.current = sanitized.id;
    setShowSaveDialog(false);
    addToast('success', `«${title}» salvato. Visibile in Collection.`);
  }, [card, userEmail, addToast, saveDocumentGuarded]);

  const runCardAI = useCallback(async (mode: string = 'custom') => {
    const quick = findCardQuickAction(mode);
    let userPrompt = quick?.prompt ?? aiText.trim();
    // Personalizza il prompt "fill" con il nome attuale.
    if (mode === 'fill') {
      userPrompt = `Dai nome "${card.front.name}", ${userPrompt}`;
    }
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

  const handleGenerateCover = useCallback(async (side: 'front' | 'back' | 'both' = 'front') => {
    if (tier !== 'unlocked') {
      addToast('info', 'Sblocca il piano per generare cover AI.', 4000);
      return;
    }
    setIsCoverGenerating(true);
    try {
      if (side === 'both') {
        // Serializziamo fronte e retro: due chiamate Gemini in parallelo
        // possono sovraccaricare il dev proxy / l'upstream e ritornare 502.
        const frontCover = await generateCover(card, 'front');
        const backCover = await generateCover(card, 'back');
        patchFront({ coverImageUrl: frontCover });
        patchBack({ coverImageUrl: backCover });
        addToast('success', 'Cover AI generate per fronte e retro.', 4000);
      } else {
        const coverDataUrl = await generateCover(card, side);
        if (side === 'front') {
          patchFront({ coverImageUrl: coverDataUrl });
        } else {
          patchBack({ coverImageUrl: coverDataUrl });
        }
        addToast('success', `Cover AI generata e applicata al ${side === 'front' ? 'fronte' : 'retro'}.`, 4000);
      }
    } catch (err: any) {
      addToast('error', err.message || 'Errore generazione cover AI', 5000);
    } finally {
      setIsCoverGenerating(false);
    }
  }, [card, tier, generateCover, patchFront, patchBack, addToast]);

  const handleGeneratePhoto = useCallback(async () => {
    if (tier !== 'unlocked') {
      addToast('info', 'Sblocca il piano per generare la foto AI.', 4000);
      return;
    }
    setIsPhotoGenerating(true);
    try {
      const photoUrl = await generatePhoto(card, {
        promptOverride: photoPrompt.trim() || undefined,
      });
      patchFront({ photoUrl });
      addToast('success', 'Foto AI generata e applicata al bigliettino.', 4000);
    } catch (err: any) {
      addToast('error', err.message || 'Errore generazione foto AI', 5000);
    } finally {
      setIsPhotoGenerating(false);
    }
  }, [card, tier, generatePhoto, patchFront, addToast, photoPrompt]);

  const handleFillAutoPhotoPrompt = useCallback(() => {
    setPhotoPrompt(buildCardPhotoBrief(card).prompt);
    setShowPhotoPromptEditor(true);
  }, [card]);

  const handleSavePhotoPrompt = useCallback(() => {
    const text = photoPrompt.trim();
    if (!text) {
      addToast('info', 'Scrivi un prompt prima di salvarlo.');
      return;
    }
    const label = window.prompt('Nome del prompt', text.slice(0, 40)) || text.slice(0, 40);
    setPhotoLibrary(addPromptEntry(PROMPT_LIBRARY_KEYS.cardPhoto, {
      label: label.trim() || 'Prompt foto',
      prompt: text,
      module: 'card-photo',
    }));
    addToast('success', 'Prompt salvato nella libreria.');
  }, [photoPrompt, addToast]);

  const handleApplyPhotoPrompt = useCallback((entry: PromptLibraryEntry) => {
    if (entry.prompt) {
      setPhotoPrompt(entry.prompt);
      setShowPhotoPromptEditor(true);
      addToast('info', `Prompt «${entry.label}» applicato.`);
    }
  }, [addToast]);

  const handleDeletePhotoPrompt = useCallback((id: string) => {
    setPhotoLibrary(removePromptEntry(PROMPT_LIBRARY_KEYS.cardPhoto, id));
  }, []);

  const handleRemoveCover = useCallback(
    (side: 'front' | 'back') => {
      if (side === 'front') {
        patchFront({ coverImageUrl: null });
        addToast('info', 'Cover AI del fronte rimossa.', 2500);
      } else {
        patchBack({ coverImageUrl: null });
        addToast('info', 'Cover AI del retro rimossa.', 2500);
      }
    },
    [patchFront, patchBack, addToast],
  );

  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (!userEmail || !cardHasContent(card)) return;
    autoSaveTimerRef.current = setTimeout(() => {
      const title = defaultCardTitle(card);
      const sanitized: BusinessCard = {
        ...pruneCardGrids(card),
        title,
        userEmail,
        updatedAt: new Date().toISOString(),
      };
      saveDocumentGuarded(userEmail, sanitized).then((result) => {
        if (result.blocked) {
          addToast('info', 'Limite piano free raggiunto. Sblocca per continuare.');
        } else if (result.error) {
          logger.error('Card auto-save failed', { err: result.error });
        } else {
          // Keep title in sync if auto-derived (no toast noise).
          if (card.title !== title) setCard((prev) => (prev.title === title ? prev : { ...prev, title }));
        }
      });
    }, AUTO_SAVE_DELAY_MS);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [card, userEmail, saveDocumentGuarded, addToast]);

  const updateSocial = useCallback((idx: number, key: 'platform' | 'url', value: string) => {
    setCard((prev) => {
      const socials = [...prev.back.socials];
      socials[idx] = { ...socials[idx], [key]: value };
      return { ...prev, back: { ...prev.back, socials }, updatedAt: new Date().toISOString() };
    });
  }, []);

  // v2.9.1: helper that ensures a back-grid element exists when the user adds
  // content that should render in its own cell (services/socials). Without this,
  // a card created before v2.5 keeps a backGrid without services/socials cells,
  // and newly-added services/socials disappear from the SVG export.
  const ensureBackGridElement = useCallback(
    (prev: BusinessCard, key: 'services' | 'socials'): BusinessCard['backGrid'] => {
      const backGrid = prev.backGrid;
      if (!backGrid) return backGrid;
      if (backGrid.elements[key]) return backGrid;
      const preset = gridPresetBackDefault();
      const presetEl = preset.elements[key];
      if (!presetEl) return backGrid;
      return {
        ...backGrid,
        elements: { ...backGrid.elements, [key]: presetEl },
      };
    },
    [],
  );

  const addSocial = useCallback(() => {
    setCard((prev) => ({
      ...prev,
      back: { ...prev.back, socials: [...prev.back.socials, { platform: '', url: '' }] },
      backGrid: ensureBackGridElement(prev, 'socials'),
      updatedAt: new Date().toISOString(),
    }));
  }, [ensureBackGridElement]);

  const removeSocial = useCallback((idx: number) => {
    setCard((prev) => ({
      ...prev,
      back: { ...prev.back, socials: prev.back.socials.filter((_, i) => i !== idx) },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const addService = useCallback(() => {
    setCard((prev) => {
      const current = prev.back.services ?? [];
      if (current.length >= 8) return prev;
      return {
        ...prev,
        back: { ...prev.back, services: [...current, ''] },
        backGrid: ensureBackGridElement(prev, 'services'),
        updatedAt: new Date().toISOString(),
      };
    });
  }, [ensureBackGridElement]);

  const updateService = useCallback((idx: number, value: string) => {
    setCard((prev) => {
      const services = [...(prev.back.services ?? [])];
      services[idx] = value.slice(0, 80);
      return {
        ...prev,
        back: { ...prev.back, services },
        backGrid: value.trim() ? ensureBackGridElement(prev, 'services') : prev.backGrid,
        updatedAt: new Date().toISOString(),
      };
    });
  }, [ensureBackGridElement]);

  const removeService = useCallback((idx: number) => {
    setCard((prev) => ({
      ...prev,
      back: { ...prev.back, services: (prev.back.services ?? []).filter((_, i) => i !== idx) },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const websiteValid = useMemo(() => !card.back.website || isHttpUrl(card.back.website), [card.back.website]);

  const formContent = useMemo(() => (
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
        onRemoveCover={removeCoverImage}
        onRemoveBackCover={removeBackCoverImage}
        uploadError={uploadError}
        tier={tier}
        onGeneratePhoto={handleGeneratePhoto}
        isGeneratingPhoto={isPhotoGenerating}
        photoPrompt={photoPrompt}
        setPhotoPrompt={setPhotoPrompt}
        showPhotoPromptEditor={showPhotoPromptEditor}
        setShowPhotoPromptEditor={setShowPhotoPromptEditor}
        photoLibrary={photoLibrary}
        onSavePhotoPrompt={handleSavePhotoPrompt}
        onApplyPhotoPrompt={handleApplyPhotoPrompt}
        onDeletePhotoPrompt={handleDeletePhotoPrompt}
        onFillAutoPhotoPrompt={handleFillAutoPhotoPrompt}
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
  ), [card, patchFront, patchBack, patchStyle, handleUpload, removePhoto, removeLogo, uploadError, updateService, addService, removeService, updateSocial, addSocial, removeSocial, tier, handleGeneratePhoto, isPhotoGenerating, photoPrompt, showPhotoPromptEditor, photoLibrary, handleSavePhotoPrompt, handleApplyPhotoPrompt, handleDeletePhotoPrompt, handleFillAutoPhotoPrompt]);

  const aiPanel = useMemo(() => (
    <CardAIControls
      variant={isMobile ? 'mobile' : 'desktop'}
      aiModel={aiModel}
      onModelChange={setAiModel}
      aiText={aiText}
      onTextChange={setAiText}
      availableModels={availableModels}
      isProcessing={isCardProcessing || isCoverGenerating}
      onRun={runCardAI}
      onReset={resetCardChat}
      logs={cardAiLogs}
      tier={tier}
      onGenerateCover={handleGenerateCover}
      onRemoveCover={handleRemoveCover}
      card={card}
    />
  ), [isMobile, aiModel, aiText, availableModels, isCardProcessing, isCoverGenerating, runCardAI, resetCardChat, cardAiLogs, tier, handleGenerateCover, handleRemoveCover, card]);

  const previewPanel = useMemo(() => (
    <CardPreviewSurface
      card={card}
      tier={tier}
      showGrid={showGrid}
      onToggleGrid={handleToggleShowGrid}
      zoom={previewZoom}
      heading="Anteprima"
    />
  ), [card, tier, showGrid, handleToggleShowGrid, previewZoom]);

  const gridControls = useMemo(() => (
    <CardGridControls
      card={card}
      side={gridEditorSide}
      gridEnabled={showGrid}
      onSideChange={(s) => {
        setGridEditorSideLogged(s);
        setSelectedGridElementLogged('');
      }}
      onChangeGrid={patchGrid}
      onApplyPreset={applyGridPreset}
      selected={selectedGridElement}
      onSelect={setSelectedGridElementLogged}
      onAfterMove={handleAfterMove}
      onAfterResize={handleAfterResize}
    />
  ), [card, gridEditorSide, showGrid, patchGrid, applyGridPreset, selectedGridElement, handleAfterMove, handleAfterResize, setGridEditorSideLogged, setSelectedGridElementLogged]);

  const desktopActions = (
    <div className="card-actions">
      <CardSaveAction variant="desktop" onClick={openSaveDialog} />
      <CardExportMenu
        variant="desktop"
        open={exportMenuOpen}
        exporting={exporting}
        onToggle={() => setExportMenuOpen((v) => !v)}
        onAction={handleExportAction}
        menuRef={exportMenuRef}
      />
    </div>
  );

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
          <span>Usa template personale di Giovanni (precompilato con https://giovannicidu.vercel.app, telefono/email = XXXXX)</span>
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
                  {previewPanel}
                  <MobileGridEditor
                    card={card}
                    side={gridEditorSide}
                    gridEnabled={showGrid}
                    selected={selectedGridElement}
                    onSelect={setSelectedGridElementLogged}
                    onChangeSide={(s) => { setGridEditorSideLogged(s); setSelectedGridElementLogged(''); }}
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
                  {formContent}
                </div>
              ),
            },
            {
              id: 'ai',
              label: 'AI',
              content: (
                <div className="card-ai-mobile-content">
                  {aiPanel}
                </div>
              ),
            },
          ]}
        />
      ) : null}

      {!isMobile && (
        <div className="card-editor-3col">
          <section className="card-editor-form" aria-label="Configurazione bigliettino">
            {formContent}
            {desktopActions}
            <p className="card-export-hint">
              Esporta PDF/PNG/SVG. I bigliettini salvati compaiono in <em>Collection</em>.
              In Stile → «Stile bordo» scegli <em>Nessuno</em> per rimuovere strisce/bordi sul bigliettino.
            </p>
          </section>

          <section className="card-editor-preview" aria-label="Anteprima bigliettino">
            {previewPanel}
            {gridControls}
          </section>

          {showAi ? (
            <section className="card-editor-ai" aria-label="AI che modifica il bigliettino">
              <div className="panel-kicker">
                <span>AI Assist</span>
                <button
                  className="panel-toggle"
                  onClick={() => setShowAi(false)}
                  title="Collassa pannello AI"
                  aria-label="Collassa AI"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
              </div>
              {aiPanel}
            </section>
          ) : (
            <button
              className="card-ai-expand"
              onClick={() => setShowAi(true)}
              title="Espandi pannello AI"
              aria-label="Espandi AI"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span>AI</span>
            </button>
          )}
        </div>
      )}

      {isMobile && (
        <>
          <div className="card-mobile-toolbar" data-testid="mobile-toolbar">
            <CardSaveAction variant="mobile" onClick={openSaveDialog} />
            <CardExportMenu
              variant="mobile"
              open={exportMenuOpen}
              exporting={exporting}
              onToggle={() => setExportMenuOpen((v) => !v)}
              onAction={handleExportAction}
              menuRef={exportMenuRef}
            />
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
                <span>AI Assist</span>
                <button
                  type="button"
                  onClick={aiFloating.close}
                  aria-label="Chiudi pannello AI"
                  title="Chiudi"
                >×</button>
              </div>
              {aiPanel}
            </div>
          </CardAIBottomSheet>
        </>
      )}

      <SaveDialog
        open={showSaveDialog}
        defaultName={defaultCardTitle(card)}
        documentLabel="bigliettino"
        placeholder="Es. Bigliettino Mario Rossi"
        onSave={(name) => { void handleSave(name); }}
        onCancel={() => setShowSaveDialog(false)}
      />
    </div>
  );
}
