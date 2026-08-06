import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  BusinessCard,
  CardGrid,
} from '../../utils/documentSchemas';
import {
  createEmptyCard,
  createGiovanniCardTemplate,
  deriveGridFromLayout,
  mergeCardWithDefaults,
} from '../../utils/documentSchemas';
import { CardGridControls } from './CardGridControls';
import CardAIControls from './CardAIControls';
import AIConsole from '../ai/AIHarnessConsole';
import { useAIIconHero } from '../../hooks/useAIIconHero';
import { CardFormSections } from './form/CardFormSections';
import { compressImage } from '../../utils/cardGenerator';
import { useCardExport } from '../../hooks/useCardExport';
import { isAllowedLogoMime } from '../../utils/qrGenerator';
import { useToast } from '../../hooks/useToast';
import { useAICard } from '../../hooks/useAICard';
import { withAiCall } from '../../utils/aiStats';
import { useCardPromptLibrary } from '../../hooks/useCardPromptLibrary';
import { useCardAiImages } from '../../hooks/useCardAiImages';
import { useCardGridEditor } from '../../hooks/useCardGridEditor';
import { useCardBackContent } from '../../hooks/useCardBackContent';
import { useCardAutoSave, cardHasContent, defaultCardTitle } from '../../hooks/useCardAutoSave';

import { findCardQuickAction } from '../../ai/prompts/cardQuickActions';
import { useIsMobileWorkspace } from '../../hooks/useMediaQuery';
import { useCardPreviewZoom } from '../../hooks/useCardPreviewZoom';
import { useCardAIFloating } from '../../hooks/useCardAIFloating';
import { useDocumentSave } from '../../hooks/useDocumentSave';
import { getValidatedProviderDefault } from '../../utils/uiPrefs';
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
import {
  pushLayoutEvent,
  attachLayoutEventsToWindow,
} from '../../utils/card/layoutEvents';

const MAX_RAW_BYTES = 5_000_000;

export interface CardEditorShellProps {
  userEmail: string;
  initialCard?: BusinessCard;
  documentTheme: 'corporate' | 'minimal' | 'creative' | 'legal' | 'luxury';
  tier: 'free' | 'unlocked';
  onReset?: () => void;
  onSaved?: (doc: any) => void;
}

export default function CardEditorShell({ userEmail, initialCard, tier, onReset, onSaved }: CardEditorShellProps) {
  const { save: saveDocumentGuarded } = useDocumentSave();
  const [card, setCard] = useState<BusinessCard>(() => mergeCardWithDefaults(initialCard));
  const [showTemplateBanner, setShowTemplateBanner] = useState<boolean>(() => !initialCard);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiModel, setAiModel] = useState(() => getValidatedProviderDefault(providerRegistry));
  const loadedIdRef = useRef<string | undefined>(initialCard?.id);

  // Always attach layout events on the card editor (localhost + prod).
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

  const isMobile = useIsMobileWorkspace();
  const aiFloating = useCardAIFloating();
  const previewZoom = useCardPreviewZoom(1);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const { addToast } = useToast();
  const { processCardPrompt, generateCover, generatePhoto, resetCardChat, cardAiLogs, isCardProcessing, availableModels, totalCostUsd, lastCostUsd } = useAICard(userEmail);
  const { generate: generateIconHero, isProcessing: isIconHeroProcessing, logs: iconHeroLogs, clear: clearIconHeroLogs } = useAIIconHero(userEmail);

  const gridEditor = useCardGridEditor({ card, setCard, addToast });
  const backContent = useCardBackContent({ card, setCard });
  const autoSave = useCardAutoSave({ card, setCard, userEmail, saveDocumentGuarded, loadedIdRef, addToast, onSaved });

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
    gridEditor.resetGridState();
    setUploadError(null);
    setAiText('');
    setExportMenuOpen(false);
    if (onReset) onReset();
    else addToast('info', 'Nuovo bigliettino vuoto pronto');
  }, [addToast, onReset, gridEditor]);

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

  const runCardAI = useCallback(async (mode: string = 'custom') => {
    const quick = findCardQuickAction(mode);
    let userPrompt = quick?.prompt ?? aiText.trim();
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
        gridEditor.setShowGrid(true);
      }
      if (realChanges.length > 0) {
        addToast('success', `AI: ${realChanges.length} modifica${realChanges.length > 1 ? 'e' : ''} applicata${realChanges.length > 1 ? 'e' : ''}`, 5000);
      } else {
        addToast('info', 'AI: nessuna modifica riconosciuta. Vedi log per dettagli.', 5000);
      }
    } catch (err: any) {
      addToast('error', err.message || 'Errore AI', 5000);
    }
  }, [card, aiText, aiModel, processCardPrompt, addToast, gridEditor]);

  const formContent = useMemo(() => (
    <CardFormSections
      card={card}
      patchFront={patchFront}
      patchBack={patchBack}
      patchStyle={patchStyle}
      patchDecorations={backContent.patchDecorations}
      handleUpload={handleUpload}
      removePhoto={removePhoto}
      removeLogo={removeLogo}
      removeCoverImage={removeCoverImage}
      removeBackCoverImage={removeBackCoverImage}
      uploadError={uploadError}
      updateService={backContent.updateService}
      addService={backContent.addService}
      removeService={backContent.removeService}
      updateSocial={backContent.updateSocial}
      addSocial={backContent.addSocial}
      removeSocial={backContent.removeSocial}
      tier={tier}
    />
  ), [card, patchFront, patchBack, patchStyle, backContent, handleUpload, removePhoto, removeLogo, removeCoverImage, removeBackCoverImage, uploadError, tier]);

  const mergedLogs = useMemo(() => {
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
    onPatchDecorations: backContent.patchDecorations,
    lastCostUsd,
    totalCostUsd,
  } as const;

  const aiPanel = useMemo(() => (
    <CardAIControls
      variant={isMobile ? 'mobile' : 'desktop'}
      {...aiPanelProps}
    />
  ), [isMobile, aiModel, aiText, availableModels, isCardProcessing, isCoverGenerating, isPhotoGenerating, isIconHeroProcessing, runCardAI, handleResetCardChat, mergedLogs, tier, handleGenerateCover, handleRemoveCover, handleGeneratePhoto, card, photoPrompt, showPhotoPromptEditor, photoLibrary, handleSavePhotoPrompt, handleApplyPhotoPrompt, handleDeletePhotoPrompt, handleFillAutoPhotoPrompt, iconPrompt, showIconPromptEditor, iconLibrary, handleSaveIconPrompt, handleApplyIconPrompt, handleDeleteIconPrompt, handleFillAutoIconPrompt, handleGenerateIcon, coverPrompt, showCoverPromptEditor, coverLibrary, handleSaveCoverPrompt, handleApplyCoverPrompt, handleDeleteCoverPrompt, handleFillAutoCoverPrompt, backContent.patchDecorations, lastCostUsd, totalCostUsd]);

  const aiPanelBare = useMemo(() => (
    <CardAIControls variant="desktop" bare {...aiPanelProps} />
  ), [aiModel, aiText, availableModels, isCardProcessing, isCoverGenerating, isPhotoGenerating, isIconHeroProcessing, runCardAI, handleResetCardChat, mergedLogs, tier, handleGenerateCover, handleRemoveCover, handleGeneratePhoto, card, photoPrompt, showPhotoPromptEditor, photoLibrary, handleSavePhotoPrompt, handleApplyPhotoPrompt, handleDeletePhotoPrompt, handleFillAutoPhotoPrompt, iconPrompt, showIconPromptEditor, iconLibrary, handleSaveIconPrompt, handleApplyIconPrompt, handleDeleteIconPrompt, handleFillAutoIconPrompt, handleGenerateIcon, coverPrompt, showCoverPromptEditor, coverLibrary, handleSaveCoverPrompt, handleApplyCoverPrompt, handleDeleteCoverPrompt, handleFillAutoCoverPrompt, backContent.patchDecorations, lastCostUsd, totalCostUsd]);

  const selectedElementForPreview = useMemo(() => ({
    side: gridEditor.gridEditorSide,
    key: gridEditor.selectedGridElement,
  }), [gridEditor.gridEditorSide, gridEditor.selectedGridElement]);

  const previewPanel = useMemo(() => (
    <CardPreviewSurface
      card={card}
      tier={tier}
      showGrid={gridEditor.showGrid}
      onToggleGrid={gridEditor.handleToggleShowGrid}
      zoom={previewZoom}
      heading="Anteprima"
      selectedElement={selectedElementForPreview}
      onPatchPlacement={(key, patch) => gridEditor.patchElementPlacement(key as keyof CardGrid['elements'], patch)}
    />
  ), [card, tier, gridEditor, previewZoom, selectedElementForPreview]);

  const gridControls = useMemo(() => (
    <CardGridControls
      card={card}
      side={gridEditor.gridEditorSide}
      gridEnabled={gridEditor.showGrid}
      onSideChange={gridEditor.setGridEditorSideLogged}
      onChangeGrid={gridEditor.patchGrid}
      onApplyPreset={gridEditor.applyGridPreset}
      selected={gridEditor.selectedGridElement}
      onSelect={gridEditor.setSelectedGridElementLogged}
      onAfterMove={gridEditor.handleAfterMove}
      onAfterResize={gridEditor.handleAfterResize}
      onAfterAlign={gridEditor.handleAfterAlign}
      onPatchPlacement={gridEditor.patchElementPlacement}
      onRequestEnableGrid={gridEditor.handleToggleShowGrid}
    />
  ), [card, gridEditor]);

  const desktopActions = (
    <div className="card-actions">
      <CardSaveAction variant="desktop" onClick={autoSave.openSaveDialog} isSaved={autoSave.isSaved} />
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
                    side={gridEditor.gridEditorSide}
                    gridEnabled={gridEditor.showGrid}
                    selected={gridEditor.selectedGridElement}
                    onSelect={gridEditor.setSelectedGridElementLogged}
                    onChangeSide={gridEditor.setGridEditorSideLogged}
                    onChangeGrid={gridEditor.patchGrid}
                    onApplyPreset={gridEditor.applyGridPreset}
                    onAfterMove={gridEditor.handleAfterMove}
                    onAfterResize={gridEditor.handleAfterResize}
                    onAfterAlign={gridEditor.handleAfterAlign}
                    onPatchPlacement={gridEditor.patchElementPlacement}
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

          <section className="card-editor-ai" aria-label="AI che modifica il bigliettino">
            <AIConsole
              editorKind="card"
              isProcessing={isCardProcessing || isCoverGenerating || isPhotoGenerating || isIconHeroProcessing}
              logs={mergedLogs}
              tier={tier}
              onSubmitPrompt={(text: string) => setAiText(text)}
              hidePrompt
              onProviderChange={(id: string) => setAiModel(id)}
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
            <CardSaveAction variant="mobile" onClick={autoSave.openSaveDialog} isSaved={autoSave.isSaved} />
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
        open={autoSave.showSaveDialog}
        defaultName={defaultCardTitle(card)}
        documentLabel="bigliettino"
        placeholder="Es. Bigliettino Mario Rossi"
        onSave={(name) => { autoSave.handleSave(name).catch((err) => { addToast('error', 'Errore salvataggio'); }); }}
        onCancel={() => autoSave.setShowSaveDialog(false)}
      />
    </div>
  );
}
