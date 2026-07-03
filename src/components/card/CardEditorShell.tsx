import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  BusinessCard,
  CardGrid,
} from '../../utils/documentSchemas';
import {
  createEmptyCard,
  createGiovanniCardTemplate,
  gridPresetLeft,
  gridPresetCentered,
  gridPresetFrontSplit,
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
import dataService from '../../utils/dataService';
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

const MAX_RAW_BYTES = 5_000_000;
const AUTO_SAVE_DELAY_MS = 30_000;

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
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiModel, setAiModel] = useState('deepseek-chat');
  const [showAi, setShowAi] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobile = useMediaQuery('(max-width: 900px)');
  const aiFloating = useCardAIFloating();
  const previewZoom = useCardPreviewZoom(1);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const { addToast } = useToast();
  const { processCardPrompt, resetCardChat, cardAiLogs, isCardProcessing, availableModels } = useAICard(userEmail);

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

  const applyGridPreset = useCallback((preset: 'left' | 'centered' | 'split') => {
    if (gridEditorSide === 'back') {
      setCard((prev) => ({
        ...prev,
        backGrid: gridPresetBackDefault(),
        updatedAt: new Date().toISOString(),
      }));
      return;
    }
    const frontGrid =
      preset === 'left' ? gridPresetLeft() :
      preset === 'centered' ? gridPresetCentered() :
      gridPresetFrontSplit();
    setCard((prev) => ({
      ...prev,
      grid: frontGrid,
      updatedAt: new Date().toISOString(),
    }));
  }, [gridEditorSide]);

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

  const handleAfterResize = useCallback((info: { element: string; dw: number; dh: number; applied: boolean; reason?: 'collision' | 'border' }) => {
    if (info.applied) {
      addToast('success', `${info.element} ridimensionato`, 2500);
    } else if (info.reason === 'collision') {
      addToast('info', `Bloccato: resize causa collisione`, 3000);
    } else if (info.reason === 'border') {
      addToast('info', `Bloccato: bordo della griglia raggiunto`, 3000);
    }
  }, [addToast]);

  const handleToggleShowGrid = useCallback(() => {
    setShowGrid((prev) => !prev);
    setCard((c) => {
      const next = !showGrid;
      if (!next) {
        addToast('info', 'Griglia disattivata', 2500);
        return c;
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
    switch (action) {
      case 'pdf':
        void exportPdf();
        break;
      case 'png-front':
        void exportPng('front');
        break;
      case 'png-back':
        void exportPng('back');
        break;
      case 'svg-front':
        exportSvg('front');
        break;
      case 'svg-back':
        exportSvg('back');
        break;
      case 'json':
        exportJson();
        break;
    }
  }, [exportPdf, exportPng, exportSvg, exportJson]);

  const handleSave = useCallback(async () => {
    const sanitized: BusinessCard = { ...card, userEmail, updatedAt: new Date().toISOString() };
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

  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const sanitized: BusinessCard = { ...card, userEmail, updatedAt: new Date().toISOString() };
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

  const aiPanel = useMemo(() => (
    <CardAIControls
      variant={isMobile ? 'mobile' : 'desktop'}
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
  ), [isMobile, aiModel, aiText, availableModels, isCardProcessing, runCardAI, resetCardChat, cardAiLogs]);

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
  ), [card, gridEditorSide, showGrid, patchGrid, applyGridPreset, selectedGridElement, handleAfterMove, handleAfterResize]);

  const desktopActions = (
    <div className="card-actions">
      <CardSaveAction variant="desktop" onClick={handleSave} />
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
                  {previewPanel}
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
              Esporta subito PDF/PNG/SVG. Le card salvate appariranno in <em>Collection</em> dalla prossima release.
            </p>
          </section>

          <section className="card-editor-preview" aria-label="Anteprima bigliettino">
            {previewPanel}
            {gridControls}
          </section>

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
            <CardSaveAction variant="mobile" onClick={handleSave} />
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
                <span>AI Design Mode</span>
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
    </div>
  );
}
