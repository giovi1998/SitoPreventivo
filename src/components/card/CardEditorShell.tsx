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
import AIConsole from '../ai/AIHarnessConsole';
import { useAIIconHero } from '../../hooks/useAIIconHero';
import {
  CardFrontFields,
  CardBackFields,
  CardMediaFields,
  CardServicesFields,
  CardSocialsFields,
  CardQrAdvanced,
  CardStyleFields,
} from './form';
import { compressImage } from '../../utils/cardGenerator';
import { useCardExport } from '../../hooks/useCardExport';
import { isAllowedLogoMime, isHttpUrl } from '../../utils/qrGenerator';
import { useToast } from '../../hooks/useToast';
import { useAICard } from '../../hooks/useAICard';
import { withAiCall } from '../../utils/aiStats';
import { useCardPromptLibrary } from '../../hooks/useCardPromptLibrary';
import { useCardAiImages } from '../../hooks/useCardAiImages';

import { findCardQuickAction } from '../../ai/prompts/cardQuickActions';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useCardPreviewZoom } from '../../hooks/useCardPreviewZoom';
import { useCardAIFloating } from '../../hooks/useCardAIFloating';
import { logger } from '../../utils/logger';
import { useDocumentSave } from '../../hooks/useDocumentSave';
import { getAiProviderDefault } from '../../utils/uiPrefs';
import { providerRegistry } from '../../ai/providers/registry';
import CardSaveAction from './CardSaveAction';
import CardExportMenu from './CardExportMenu';
import CardPreviewSurface from './CardPreviewSurface';
import CardEditorTabs from './CardEditorTabs';
import MobileGridEditor from '../MobileGridEditor';
import CardAIFab from '../CardAIFab';
import CardAIBottomSheet from '../CardAIBottomSheet';
import { DocumentAiStats } from '../DocumentAiStats';
import SaveDialog from '../SaveDialog';
import { pruneCardGrids } from '../../utils/card/gridElements';
import { compressCardImages } from '../../utils/card/saveCompression';
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
    || c.front.coverImageUrl
    || c.back.phone?.trim()
    || c.back.email?.trim()
    || c.back.website?.trim()
    || c.back.address?.trim()
    || c.back.vatNumber?.trim()
    || (c.back.services ?? []).some((s) => s.trim())
    || c.back.socials.some((s) => s.url?.trim())
    || c.back.qrPayload?.trim()
    || c.back.coverImageUrl
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
  onReset?: () => void;
  onSaved?: (doc: any) => void;
}

export default function CardEditorShell({ userEmail, initialCard, documentTheme, tier, onReset, onSaved }: CardEditorShellProps) {
  const { save: saveDocumentGuarded } = useDocumentSave();
  const [card, setCard] = useState<BusinessCard>(() => mergeCardWithDefaults(initialCard));
  const [showTemplateBanner, setShowTemplateBanner] = useState<boolean>(() => !initialCard);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiModel, setAiModel] = useState(() => getAiProviderDefault() || providerRegistry.getDefaultId());
  // Phase 14: lo stato expanded della rail AI è gestito da AIConsole in
  // pq_ui:v1 (editorKind='card'), non più da useState locale.
  const [showGrid, setShowGrid] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedIdRef = useRef<string | undefined>(initialCard?.id);
  const [isSaved, setIsSaved] = useState(false);
  // Snapshot dell'auto-save pendente: letto dal flush on unmount, che gira
  // con deps [] e non può chiudere sullo stato (sarebbe stale).
  const pendingAutoSaveRef = useRef<{ email: string; card: BusinessCard } | null>(null);
  const saveFnRef = useRef(saveDocumentGuarded);
  // Settato prima di un setCard innescato dal save stesso, così il dirty
  // tracker non rimette subito isSaved a false.
  const justSavedRef = useRef(false);

  // Always attach layout events on the card editor (localhost + prod).
  // pushLayoutEvent still gates console output; window.__cardLayoutEvents is free.
  useEffect(() => {
    attachLayoutEventsToWindow();
    pushLayoutEvent({ type: 'card.edit', result: 'ok', payload: { boot: true } });
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
  const { processCardPrompt, generateCover, generatePhoto, resetCardChat, cardAiLogs, isCardProcessing, availableModels, totalCostUsd, lastCostUsd } = useAICard(userEmail);
  const { generate: generateIconHero, isProcessing: isIconHeroProcessing, logs: iconHeroLogs, clear: clearIconHeroLogs } = useAIIconHero(userEmail);

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
    const keys = Object.keys(patch);
    pushLayoutEvent({
      type: 'card.edit',
      side: 'front',
      element: keys[0],
      result: 'ok',
      payload: { fields: keys },
    });
    setCard((prev) => {
      const next = { ...prev.front, ...patch };
      if (patch.layout && patch.layout !== prev.front.layout) {
        const newGrid = deriveGridFromLayout({ ...prev, front: next }, 'front');
        return { ...prev, front: { ...next }, grid: newGrid, updatedAt: new Date().toISOString() };
      }
      return { ...prev, front: next, updatedAt: new Date().toISOString() };
    });
  }, []);

  const patchBack = useCallback((patch: Partial<BusinessCard['back']>) => {
    const keys = Object.keys(patch);
    pushLayoutEvent({
      type: 'card.edit',
      side: 'back',
      element: keys[0],
      result: 'ok',
      payload: { fields: keys },
    });
    setCard((prev) => ({ ...prev, back: { ...prev.back, ...patch }, updatedAt: new Date().toISOString() }));
  }, []);

  const {
    photoPrompt,
    setPhotoPrompt,
    showPhotoPromptEditor,
    setShowPhotoPromptEditor,
    photoLibrary,
    handleSavePhotoPrompt,
    handleApplyPhotoPrompt,
    handleDeletePhotoPrompt,
    handleFillAutoPhotoPrompt,
    iconPrompt,
    setIconPrompt,
    showIconPromptEditor,
    setShowIconPromptEditor,
    iconLibrary,
    handleSaveIconPrompt,
    handleApplyIconPrompt,
    handleDeleteIconPrompt,
    handleFillAutoIconPrompt,
    coverPrompt,
    setCoverPrompt,
    showCoverPromptEditor,
    setShowCoverPromptEditor,
    coverLibrary,
    handleSaveCoverPrompt,
    handleApplyCoverPrompt,
    handleDeleteCoverPrompt,
    handleFillAutoCoverPrompt,
    autoIconPrompt,
  } = useCardPromptLibrary(card, addToast);

  const {
    isCoverGenerating,
    isPhotoGenerating,
    handleGenerateCover,
    handleGeneratePhoto,
    handleGenerateIcon,
    handleRemoveCover,
  } = useCardAiImages({
    card,
    tier,
    setCard,
    patchFront,
    patchBack,
    addToast,
    generateCover,
    generatePhoto,
    generateIconHero,
    photoPrompt,
    iconPrompt,
    autoIconPrompt,
  });

  const patchStyle = useCallback((patch: Partial<BusinessCard['style']>) => {
    const keys = Object.keys(patch);
    pushLayoutEvent({
      type: 'card.edit',
      element: keys[0],
      result: 'ok',
      payload: { fields: keys, side: 'style' },
    });
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
  }, []);

  const [selectedFrontElement, setSelectedFrontElement] = useState<keyof CardGrid['elements'] | ''>('');
  const [selectedBackElement, setSelectedBackElement] = useState<keyof CardGrid['elements'] | ''>('');
  const [gridEditorSide, setGridEditorSide] = useState<GridSide>('front');

  const selectedGridElement = gridEditorSide === 'back' ? selectedBackElement : selectedFrontElement;

  const setGridEditorSideLogged = useCallback((s: GridSide) => {
    setGridEditorSide(s);
    pushLayoutEvent({ type: 'grid.side', side: s, result: 'ok' });
  }, []);

  const setSelectedGridElementLogged = useCallback((k: keyof CardGrid['elements'] | '') => {
    if (gridEditorSide === 'back') {
      setSelectedBackElement(k);
    } else {
      setSelectedFrontElement(k);
    }
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

  const patchElementPlacement = useCallback((element: keyof CardGrid['elements'], patch: { x?: number; y?: number; scale?: number }) => {
    const targetGrid = gridEditorSide === 'back' ? (card.backGrid ?? deriveGridFromLayout(card, 'back')) : (card.grid ?? deriveGridFromLayout(card, 'front'));
    const el = targetGrid.elements[element];
    if (!el) return;
    const prevPlacement = el.placement ?? el.photoPlacement ?? { x: 0, y: 0, scale: 1 };
    const next: typeof prevPlacement = {
      x: patch.x ?? prevPlacement.x,
      y: patch.y ?? prevPlacement.y,
      scale: patch.scale ?? prevPlacement.scale,
    };
    patchGrid({ ...targetGrid, elements: { ...targetGrid.elements, [element]: { ...el, placement: next } } });
  }, [card, gridEditorSide, patchGrid]);

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

  const handleAfterAlign = useCallback((info: { element: string; alignH: 'left' | 'center' | 'right'; alignV: 'top' | 'center' | 'bottom' }) => {
    logGridChange('align', {
      element: info.element,
      applied: true,
      payload: { alignH: info.alignH, alignV: info.alignV },
    });
    addToast('success', `${info.element}: allineamento ${info.alignH}/${info.alignV}`, 2000);
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
    pushLayoutEvent({ type: 'card.template', result: 'ok', payload: { template: 'giovanni' } });
    setCard(createGiovanniCardTemplate());
    setShowTemplateBanner(false);
    addToast('info', 'Template personale Giovanni caricato');
  }, [addToast]);

  const resetCard = useCallback(() => {
    pushLayoutEvent({ type: 'card.reset', result: 'ok' });
    setCard(createEmptyCard());
    setShowTemplateBanner(true);
    setShowGrid(false);
    setSelectedFrontElement('');
    setSelectedBackElement('');
    setGridEditorSide('front');
    setUploadError(null);
    setAiText('');
    setExportMenuOpen(false);
    if (onReset) onReset();
    else addToast('info', 'Nuovo bigliettino vuoto pronto');
  }, [addToast, onReset]);

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
    pushLayoutEvent({
      type: 'card.media',
      element: field,
      result: 'ok',
      payload: { mime: file.type, size: file.size },
    });
    if (!isAllowedLogoMime(file.type)) {
      setUploadError('Formato non supportato. Usa PNG, JPEG o SVG.');
      pushLayoutEvent({ type: 'card.media', element: field, result: 'error', reason: 'mime' });
      return;
    }
    if (file.size > MAX_RAW_BYTES) {
      setUploadError('File troppo grande (max 5MB)');
      pushLayoutEvent({ type: 'card.media', element: field, result: 'error', reason: 'size' });
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
    try {
      if (!userEmail) {
        addToast('error', 'Devi essere loggato per salvare.');
        return;
      }
      const title = (customName?.trim() || defaultCardTitle(card));
      const pruned = pruneCardGrids(card);
      const sanitized: BusinessCard = {
        ...(await compressCardImages(pruned)),
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
      justSavedRef.current = true;
      setCard(sanitized);
      setIsSaved(true);
      loadedIdRef.current = sanitized.id;
      setShowSaveDialog(false);
      addToast('success', `«${title}» salvato. Visibile in Collection.`);
      if (onSaved) onSaved(sanitized);
    } catch (err: any) {
      logger.error('Card save failed', { err: err?.message || String(err) });
      addToast('error', `Errore durante il salvataggio: ${err?.message || 'sconosciuto'}`);
    }
  }, [card, userEmail, addToast, saveDocumentGuarded, onSaved]);

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
      const aiCall = result.aiCall;
      const merged = result.card;
      if (aiCall) {
        setCard(withAiCall(merged, aiCall.kind, aiCall.costUsd));
      } else {
        setCard(merged);
      }
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

  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    pendingAutoSaveRef.current = null;
    if (!userEmail || !cardHasContent(card)) return;
    pendingAutoSaveRef.current = { email: userEmail, card };
    autoSaveTimerRef.current = setTimeout(() => {
      pendingAutoSaveRef.current = null;
      const title = defaultCardTitle(card);
      const pruned = pruneCardGrids(card);
      compressCardImages(pruned).then((compressed) => {
        const sanitized: BusinessCard = {
          ...compressed,
          title,
          userEmail,
          updatedAt: new Date().toISOString(),
        };
        saveDocumentGuarded(userEmail, sanitized).then((result) => {
          if (result.blocked) {
            addToast('info', 'Limite piano free raggiunto. Sblocca per continuare.');
          } else if (result.error) {
            logger.error('Card auto-save failed', { err: result.error });
            addToast('error', `Salvataggio automatico non riuscito: ${result.error}`);
          } else {
            if (card.title !== title) {
              justSavedRef.current = true;
              setCard((prev) => (prev.title === title ? prev : { ...prev, title }));
            }
            setIsSaved(true);
            if (onSaved && sanitized.id) onSaved(sanitized);
          }
        });
      });
    }, AUTO_SAVE_DELAY_MS);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [card, userEmail, saveDocumentGuarded, addToast, onSaved]);

  // saveFnRef punta sempre all'ultima save: il flush on unmount sotto ha
  // deps [] e non può chiudere sul valore dell'hook.
  useEffect(() => {
    saveFnRef.current = saveDocumentGuarded;
  }, [saveDocumentGuarded]);

  // Dirty tracking: ogni modifica alla card che non arriva da un save
  // riporta l'indicatore da "Salvato" a "Salva".
  useEffect(() => {
    if (justSavedRef.current) {
      justSavedRef.current = false;
      return;
    }
    setIsSaved(false);
  }, [card]);

  // Flush on unmount (cambio route dentro l'app): se un save è ancora nel
  // debounce di 30s, eseguilo ora invece di perdere le modifiche in silenzio.
  // pendingAutoSaveRef è azzerato quando il timer schedulato scatta, quindi
  // niente doppi save. Nessun setState/toast qui: il componente è smontato.
  useEffect(() => {
    return () => {
      const pending = pendingAutoSaveRef.current;
      pendingAutoSaveRef.current = null;
      if (!pending) return;
      const title = defaultCardTitle(pending.card);
      const sanitized: BusinessCard = {
        ...pruneCardGrids(pending.card),
        title,
        userEmail: pending.email,
        updatedAt: new Date().toISOString(),
      };
      void saveFnRef.current(pending.email, sanitized).then((result) => {
        if (result?.error) logger.error('Card flush-save on unmount failed', { err: result.error });
      });
    };
  }, []);

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

  const patchDecorations = useCallback((patch: Partial<BusinessCard['decorations']>) => {
    pushLayoutEvent({ type: 'card.edit', element: 'decorations', result: 'ok', payload: { fields: Object.keys(patch) } });
    setCard((prev) => ({
      ...prev,
      decorations: { ...(prev.decorations ?? { pattern: null, opacity: 0.2 }), ...patch },
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
      <CardStyleFields card={card} patchFront={patchFront} patchBack={patchBack} patchStyle={patchStyle} onPatchDecorations={patchDecorations} />
    </>
  ), [card, patchFront, patchBack, patchStyle, patchDecorations, handleUpload, removePhoto, removeLogo, removeCoverImage, removeBackCoverImage, uploadError, updateService, addService, removeService, updateSocial, addSocial, removeSocial, tier]);

  // Merge logs di tutte le sorgenti immagine in ordine cronologico
  const mergedLogs = React.useMemo(() => {
    const combined = [...cardAiLogs, ...iconHeroLogs];
    combined.sort((a, b) => a.time.localeCompare(b.time));
    return combined;
  }, [cardAiLogs, iconHeroLogs]);

  const handleResetCardChat = useCallback(() => {
    resetCardChat();
    clearIconHeroLogs();
  }, [resetCardChat, clearIconHeroLogs]);

  const aiPanelProps = {
    aiModel,
    onModelChange: setAiModel,
    aiText,
    onTextChange: setAiText,
    availableModels,
    isProcessing: isCardProcessing || isCoverGenerating || isPhotoGenerating || isIconHeroProcessing,
    onRun: runCardAI,
    onReset: handleResetCardChat,
    logs: mergedLogs,
    tier,
    onGenerateCover: handleGenerateCover,
    onRemoveCover: handleRemoveCover,
    onGeneratePhoto: handleGeneratePhoto,
    card,
    photoPrompt,
    setPhotoPrompt,
    showPhotoPromptEditor,
    setShowPhotoPromptEditor,
    photoLibrary,
    onSavePhotoPrompt: handleSavePhotoPrompt,
    onApplyPhotoPrompt: handleApplyPhotoPrompt,
    onDeletePhotoPrompt: handleDeletePhotoPrompt,
    onFillAutoPhotoPrompt: handleFillAutoPhotoPrompt,
    iconPrompt,
    setIconPrompt,
    showIconPromptEditor,
    setShowIconPromptEditor,
    onGenerateIcon: handleGenerateIcon,
    onFillAutoIconPrompt: handleFillAutoIconPrompt,
    iconLibrary,
    onSaveIconPrompt: handleSaveIconPrompt,
    onApplyIconPrompt: handleApplyIconPrompt,
    onDeleteIconPrompt: handleDeleteIconPrompt,
    iconHeroLogs,
    coverPrompt,
    setCoverPrompt,
    showCoverPromptEditor,
    setShowCoverPromptEditor,
    coverLibrary,
    onSaveCoverPrompt: handleSaveCoverPrompt,
    onApplyCoverPrompt: handleApplyCoverPrompt,
    onDeleteCoverPrompt: handleDeleteCoverPrompt,
    onFillAutoCoverPrompt: handleFillAutoCoverPrompt,
    onPatchDecorations: patchDecorations,
    lastCostUsd,
    totalCostUsd,
  } as const;

  const aiPanel = useMemo(() => (
    <CardAIControls
      variant={isMobile ? 'mobile' : 'desktop'}
      {...aiPanelProps}
    />
  ), [isMobile, aiModel, aiText, availableModels, isCardProcessing, isCoverGenerating, isPhotoGenerating, isIconHeroProcessing, runCardAI, handleResetCardChat, mergedLogs, tier, handleGenerateCover, handleRemoveCover, handleGeneratePhoto, card, photoPrompt, showPhotoPromptEditor, photoLibrary, handleSavePhotoPrompt, handleApplyPhotoPrompt, handleDeletePhotoPrompt, handleFillAutoPhotoPrompt, iconPrompt, showIconPromptEditor, iconLibrary, handleSaveIconPrompt, handleApplyIconPrompt, handleDeleteIconPrompt, handleFillAutoIconPrompt, handleGenerateIcon, coverPrompt, showCoverPromptEditor, coverLibrary, handleSaveCoverPrompt, handleApplyCoverPrompt, handleDeleteCoverPrompt, handleFillAutoCoverPrompt, patchDecorations, lastCostUsd, totalCostUsd]);

  // Phase 14: variante bare per la AIConsole rail (niente AILogPanel doppio)
  const aiPanelBare = useMemo(() => (
    <CardAIControls variant="desktop" bare {...aiPanelProps} />
  ), [aiModel, aiText, availableModels, isCardProcessing, isCoverGenerating, isPhotoGenerating, isIconHeroProcessing, runCardAI, handleResetCardChat, mergedLogs, tier, handleGenerateCover, handleRemoveCover, handleGeneratePhoto, card, photoPrompt, showPhotoPromptEditor, photoLibrary, handleSavePhotoPrompt, handleApplyPhotoPrompt, handleDeletePhotoPrompt, handleFillAutoPhotoPrompt, iconPrompt, showIconPromptEditor, iconLibrary, handleSaveIconPrompt, handleApplyIconPrompt, handleDeleteIconPrompt, handleFillAutoIconPrompt, handleGenerateIcon, coverPrompt, showCoverPromptEditor, coverLibrary, handleSaveCoverPrompt, handleApplyCoverPrompt, handleDeleteCoverPrompt, handleFillAutoCoverPrompt, patchDecorations, lastCostUsd, totalCostUsd]);

  const selectedElementForPreview = useMemo(() => ({
    side: gridEditorSide,
    key: selectedGridElement,
  }), [gridEditorSide, selectedGridElement]);

  const previewPanel = useMemo(() => (
    <CardPreviewSurface
      card={card}
      tier={tier}
      showGrid={showGrid}
      onToggleGrid={handleToggleShowGrid}
      zoom={previewZoom}
      heading="Anteprima"
      selectedElement={selectedElementForPreview}
      onPatchPlacement={(key, patch) => patchElementPlacement(key as keyof CardGrid['elements'], patch)}
    />
  ), [card, tier, showGrid, handleToggleShowGrid, previewZoom, selectedElementForPreview, patchElementPlacement]);

  const gridControls = useMemo(() => (
    <CardGridControls
      card={card}
      side={gridEditorSide}
      gridEnabled={showGrid}
      onSideChange={(s) => {
        setGridEditorSideLogged(s);
      }}
      onChangeGrid={patchGrid}
      onApplyPreset={applyGridPreset}
      selected={selectedGridElement}
      onSelect={setSelectedGridElementLogged}
      onAfterMove={handleAfterMove}
      onAfterResize={handleAfterResize}
      onAfterAlign={handleAfterAlign}
      onPatchPlacement={patchElementPlacement}
      onRequestEnableGrid={handleToggleShowGrid}
    />
  ), [card, gridEditorSide, showGrid, patchGrid, applyGridPreset, selectedGridElement, handleAfterMove, handleAfterResize, handleAfterAlign, setGridEditorSideLogged, setSelectedGridElementLogged, handleToggleShowGrid]);

  const desktopActions = (
    <div className="card-actions">
      <CardSaveAction variant="desktop" onClick={openSaveDialog} isSaved={isSaved} />
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
        <DocumentAiStats aiStats={card.aiStats} />
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
                    onChangeSide={(s) => setGridEditorSideLogged(s)}
                    onChangeGrid={patchGrid}
                    onApplyPreset={applyGridPreset}
                    onAfterMove={handleAfterMove}
                    onAfterResize={handleAfterResize}
                    onAfterAlign={handleAfterAlign}
                    onPatchPlacement={patchElementPlacement}
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

          {/* Phase 14 (REQ-AI-002): la colonna AI usa la AIConsole rail
              condivisa (collapse persistito in pq_ui:v1, badge provider,
              AILogPanel integrato). CardAIControls ci entra in bare mode. */}
          <section className="card-editor-ai" aria-label="AI che modifica il bigliettino">
            <AIConsole
              editorKind="card"
              isProcessing={isCardProcessing || isCoverGenerating || isPhotoGenerating || isIconHeroProcessing}
              logs={mergedLogs}
              tier={tier}
              onSubmitPrompt={(text: string) => setAiText(text)}
              hidePrompt
              onProviderChange={(id: string) => setAiModel(id)}
              // REQ-AI-003: su card vuota la rail propone un prompt contestuale
              // con focus; l'expanded resta default true (o pq_ui:v1 se persistito).
              suggestedPrompt={!cardHasContent(card) ? 'Descrivi la tua attività, creo il bigliettino.' : undefined}
            >
              {aiPanelBare}
            </AIConsole>
          </section>
        </div>
      )}

      {isMobile && (
        <>
          <div className="card-mobile-toolbar" data-testid="mobile-toolbar">
            <CardSaveAction variant="mobile" onClick={openSaveDialog} isSaved={isSaved} />
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
        onSave={(name) => { handleSave(name).catch((err) => { logger.error('Card save unhandled', { err: err?.message || String(err) }); addToast('error', 'Errore salvataggio'); }); }}
        onCancel={() => setShowSaveDialog(false)}
      />
    </div>
  );
}
