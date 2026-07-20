import React from 'react';
import FlyerAiPanel from './FlyerAiPanel';
import AIConsole from '../ai/AIConsole';
import FlyerManualPanel from './FlyerManualPanel';
import FlyerPreviewPanel from './FlyerPreviewPanel';
import type { Flyer, FlyerSize, FlyerOrientation, FlyerLayout, FlyerContent, FlyerTone } from '../../utils/documentSchemas';
import { createEmptyFlyer, createFlyerTemplate, mergeFlyerWithDefaults, FLYER_SECTORS, FLYER_SECTOR_DEFAULT_LAYOUT } from '../../utils/documentSchemas';
import { getDefaultHeroImage } from '../../utils/flyer';
import { useAIFlyer } from '../../hooks/useAIFlyer';
import { useToast } from '../../hooks/useToast';
import { useDocumentSave } from '../../hooks/useDocumentSave';
import { computeFlyerLayout, getFlyerCopyBudget } from '../../utils/flyer';
import { generateFlyerPdf, generateFlyerPng } from '../../utils/flyerGenerator';
import SaveDialog from '../SaveDialog';
import { logger } from '../../utils/logger';
import {
  loadPromptLibrary,
  addPromptEntry,
  removePromptEntry,
  PROMPT_LIBRARY_KEYS,
  type PromptLibraryEntry,
} from '../../utils/promptLibrary';

const FLYER_HERO_MAX_RAW_BYTES = 5_000_000;
const FLYER_HERO_MAX_DIMENSION = 4000;
const FLYER_HERO_MAX_AFTER_COMPRESS = 500_000;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

function flyerHasCopy(flyer: Flyer): boolean {
  return !!(flyer.content.headline || flyer.content.subheadline || flyer.content.body);
}

function flyerHasContent(flyer: Flyer): boolean {
  return flyerHasCopy(flyer) || !!flyer.title || !!flyer.content.heroImage;
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

interface FlyerEditorShellProps {
  userEmail: string;
  initialFlyer?: Flyer;
  tier?: 'free' | 'unlocked';
  onReset?: () => void;
  onSaved?: (doc: any) => void;
}

export function FlyerEditorShell({ userEmail, initialFlyer, tier = 'unlocked', onReset, onSaved }: FlyerEditorShellProps): React.ReactElement {
  const { save: saveDocumentGuarded, documentCount, documentLimit } = useDocumentSave();
  const { addToast } = useToast();
  const [flyer, setFlyer] = React.useState<Flyer>(() => mergeFlyerWithDefaults(initialFlyer));
  const limitReached = tier === 'free' && documentLimit !== null && documentCount >= documentLimit;
  const [showTemplateBanner, setShowTemplateBanner] = React.useState(() => !initialFlyer);
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [isGeneratingHero, setIsGeneratingHero] = React.useState(false);
  const [showCustomFont, setShowCustomFont] = React.useState(() => {
    if (!initialFlyer) return false;
    const safeFonts = ['Inter, sans-serif', 'Roboto, sans-serif', 'Open Sans, sans-serif', 'Lato, sans-serif', 'Montserrat, sans-serif', 'Poppins, sans-serif', 'Georgia, serif', 'Times New Roman, serif', 'Courier New, monospace'];
    return !safeFonts.includes(initialFlyer.style.fontFamily);
  });
  const [heroError, setHeroError] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState<'pdf' | 'png' | null>(null);
  const [showAi, setShowAi] = React.useState(true);
  const [showManual, setShowManual] = React.useState(true);
  const [previewFocus, setPreviewFocus] = React.useState(false);
  const [showDebug, setShowDebug] = React.useState(false);
  const [mobileTab, setMobileTab] = React.useState<'ai' | 'manual' | null>(null);
  const loadedIdRef = React.useRef<string | undefined>(initialFlyer?.id);
  const [aiPrompt, setAiPrompt] = React.useState('');
  const [aiModel, setAiModel] = React.useState('deepseek-chat');
  const [aiTone, setAiTone] = React.useState<FlyerTone>('formale');
  const [activeSector, setActiveSector] = React.useState<typeof FLYER_SECTORS[number]>('ristorante');
  // Hero AI prompt editor (v2.4): user can override the auto-built
  // prompt and pick sector/tone for the hero generation.
  const [heroPrompt, setHeroPrompt] = React.useState('');
  const [heroSector, setHeroSector] = React.useState<typeof FLYER_SECTORS[number]>('ristorante');
  const [heroTone, setHeroTone] = React.useState<FlyerTone>('formale');
  const [showHeroPromptEditor, setShowHeroPromptEditor] = React.useState(false);
  const [heroLibrary, setHeroLibrary] = React.useState(() => loadPromptLibrary(PROMPT_LIBRARY_KEYS.flyerHero));
  const ai = useAIFlyer(userEmail);
  const lastCostUsd = ai.lastCostUsd;
  const debouncedFlyer = useDebouncedValue(flyer, 300);

  // When the URL-driven document changes, reset local state to the new flyer.
  React.useEffect(() => {
    if (!initialFlyer?.id) return;
    if (initialFlyer.id === loadedIdRef.current) return;
    loadedIdRef.current = initialFlyer.id;
    setFlyer(mergeFlyerWithDefaults(initialFlyer));
    setShowTemplateBanner(false);
  }, [initialFlyer]);
  const layoutPlan = React.useMemo(() => computeFlyerLayout(flyer), [flyer]);
  const copyBudget = React.useMemo(() => getFlyerCopyBudget(flyer), [flyer]);
  const budgetWarning = React.useMemo(() => {
    if (copyBudget.warning) return copyBudget.warning;
    if (layoutPlan.density === 'overflow') return 'Troppo testo per il formato/layout attuale: riduci il corpo o scegli un formato più grande.';
    return null;
  }, [copyBudget, layoutPlan]);
  const autoSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save every 30s when there's content
  React.useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      if (!flyerHasContent(flyer)) return;
      const sanitized = sanitizeForSave(flyer, userEmail);
      saveDocumentGuarded(userEmail, sanitized).then((result) => {
        if (result.blocked) {
          addToast('info', 'Limite piano free raggiunto. Sblocca per continuare.');
        } else if (result.error) {
          logger.error('Flyer auto-save failed', { err: result.error });
        } else if (onSaved) {
          onSaved(sanitized);
        }
      });
    }, 30000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [flyer, userEmail, saveDocumentGuarded, addToast, onSaved]);

  // Export PDF/PNG
  React.useEffect(() => {
    if (!exporting) return;
    let cancelled = false;
    const run = async () => {
      try {
        const bytes = exporting === 'pdf'
          ? await generateFlyerPdf(flyer, { tier })
          : await generateFlyerPng(flyer, { tier });
        if (cancelled) return;
        const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
        const blob = new Blob([arrayBuffer], { type: exporting === 'pdf' ? 'application/pdf' : 'image/png' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${flyer.id}.${exporting}`;
        a.click();
        URL.revokeObjectURL(url);
        addToast('success', exporting === 'pdf' ? 'PDF scaricato' : 'PNG scaricato');
      } catch (err) {
        if (!cancelled) addToast('error', (err as Error).message);
      } finally {
        if (!cancelled) setExporting(null);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [exporting, flyer, tier, addToast]);

  const updateContent = React.useCallback((patch: Partial<FlyerContent>) => {
    setFlyer((prev) => ({
      ...prev,
      content: { ...prev.content, ...patch, cta: { ...prev.content.cta, ...(patch.cta || {}) } },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const updateStyle = React.useCallback(<K extends keyof Flyer['style']>(key: K, value: Flyer['style'][K]) => {
    setFlyer((prev) => ({ ...prev, style: { ...prev.style, [key]: value }, updatedAt: new Date().toISOString() }));
  }, []);

  const updateSize = React.useCallback((size: FlyerSize) => {
    setFlyer((prev) => ({ ...prev, size, updatedAt: new Date().toISOString() }));
  }, []);

  const updateOrientation = React.useCallback((orientation: FlyerOrientation) => {
    setFlyer((prev) => (prev.size === 'Square' ? prev : { ...prev, orientation, updatedAt: new Date().toISOString() }));
  }, []);

  const updateLayout = React.useCallback((layout: FlyerLayout) => updateStyle('layout', layout), [updateStyle]);
  const updateTitle = React.useCallback((title: string) => setFlyer((prev) => ({ ...prev, title, updatedAt: new Date().toISOString() })), []);

  const applySector = React.useCallback((sector: typeof FLYER_SECTORS[number]) => {
    setActiveSector(sector);
    setFlyer(createFlyerTemplate(sector));
    setShowTemplateBanner(false);
    addToast('info', `Template ${sector} caricato`);
  }, [addToast]);

  const applySectorLayout = React.useCallback((layout: FlyerLayout) => {
    setFlyer(createFlyerTemplate(activeSector, layout));
    addToast('info', `${activeSector} · ${layout}`);
  }, [activeSector, addToast]);

  const resetFlyer = React.useCallback(() => {
    setFlyer(createEmptyFlyer());
    setShowTemplateBanner(true);
    setActiveSector('ristorante');
    setHeroError(null);
    if (onReset) onReset();
    else addToast('info', 'Nuovo volantino vuoto pronto');
  }, [addToast, onReset]);

  const handleHeroUpload = React.useCallback(async (file: File) => {
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

  const removeHero = React.useCallback(() => {
    updateContent({ heroImage: null });
    setHeroError(null);
  }, [updateContent]);

  const handleGenerate = React.useCallback(async () => {
    const brief = aiPrompt.trim();
    if (!brief) { addToast('info', 'Scrivi un brief nel campo AI prima di generare.'); return; }
    try {
      const result = await ai.generate(debouncedFlyer, brief, aiTone, { modelId: aiModel });
      if (result.applied) { setFlyer(result.flyer); addToast('success', 'Copy generato e applicato'); setAiPrompt(''); }
      else {
        const reason = result.changes.find((c) => c.startsWith('error:')) || 'risposta non valida';
        addToast('error', `Copy non generato: ${reason}. Verifica la chiave DeepSeek in Impostazioni o il credito residuo.`);
      }
    } catch (err) { addToast('error', (err as Error).message); }
  }, [ai, aiPrompt, aiTone, aiModel, debouncedFlyer, addToast]);

  const handleRefine = React.useCallback(async (action: 'simplify' | 'formal' | 'young' | 'urgent') => {
    if (!flyerHasCopy(flyer)) { addToast('info', 'Compila prima il copy.'); return; }
    try {
      const result = await ai.refine(flyer, action, { modelId: aiModel });
      if (result.applied) { setFlyer(result.flyer); addToast('success', `Copy aggiornato: ${action}`); }
      else { addToast('error', "L'AI non ha restituito un risultato valido."); }
    } catch (err) { addToast('error', (err as Error).message); }
  }, [ai, aiModel, flyer, addToast]);

  const handleAiReset = React.useCallback(() => { ai.reset(); addToast('info', 'Sessione AI azzerata'); }, [ai, addToast]);

  const handleSaveHeroPrompt = React.useCallback(() => {
    const text = heroPrompt.trim();
    if (!text) { addToast('info', 'Scrivi un prompt hero prima di salvarlo.'); return; }
    const label = window.prompt('Nome del prompt', text.slice(0, 40)) || text.slice(0, 40);
    setHeroLibrary(addPromptEntry(PROMPT_LIBRARY_KEYS.flyerHero, {
      label: label.trim() || 'Prompt hero',
      prompt: text,
      sector: heroSector,
      tone: heroTone,
      module: 'flyer-hero',
    }));
    addToast('success', 'Prompt hero salvato.');
  }, [heroPrompt, heroSector, heroTone, addToast]);

  const handleApplyHeroPrompt = React.useCallback((entry: PromptLibraryEntry) => {
    if (entry.prompt) {
      setHeroPrompt(entry.prompt);
      setShowHeroPromptEditor(true);
      if (entry.sector && FLYER_SECTORS.includes(entry.sector as typeof FLYER_SECTORS[number])) {
        setHeroSector(entry.sector as typeof FLYER_SECTORS[number]);
      }
      if (entry.tone === 'formale' || entry.tone === 'giovanile' || entry.tone === 'tecnico') {
        setHeroTone(entry.tone);
      }
      addToast('info', `Prompt «${entry.label}» applicato.`);
    }
  }, [addToast]);

  const handleDeleteHeroPrompt = React.useCallback((id: string) => {
    setHeroLibrary(removePromptEntry(PROMPT_LIBRARY_KEYS.flyerHero, id));
  }, []);

  const handleGenerateHero = React.useCallback(async (imageModel?: string) => {
    if (flyer.style.layout === 'centered') { addToast('info', 'Il layout centrato non ha un box hero.'); return; }
    setIsGeneratingHero(true);
    try {
      const trimmedPrompt = heroPrompt.trim();
      const result = await ai.generateHero(flyer, {
        sector: heroSector,
        tone: heroTone,
        promptOverride: trimmedPrompt.length > 0 ? trimmedPrompt.slice(0, 1500) : undefined,
        imageModel,
      });
      if (result.applied && result.flyer) {
        setFlyer(result.flyer);
        addToast('success', 'Hero AI generato');
      } else {
        addToast('error', result.error || "L'AI non ha restituito un'immagine.");
      }
    } catch (err) { addToast('error', (err as Error).message); }
    finally { setIsGeneratingHero(false); }
  }, [ai, flyer, heroSector, heroTone, heroPrompt, addToast]);

  const handleResetHero = React.useCallback(() => {
    if (flyer.style.layout === 'centered') { updateContent({ heroImage: null }); return; }
    const defaultHero = getDefaultHeroImage(activeSector, flyer.style.layout, flyer.size, flyer.orientation);
    updateContent({ heroImage: defaultHero });
    addToast('info', 'Immagine hero predefinita ripristinata');
  }, [flyer, activeSector, updateContent, addToast]);

  const handleSave = React.useCallback((customName: string) => {
    const title = customName || flyer.title || 'Volantino';
    const toSave = sanitizeForSave({ ...flyer, title }, userEmail);
    saveDocumentGuarded(userEmail, toSave).then((result) => {
      if (result.blocked) {
        addToast('info', 'Limite piano free raggiunto. Sblocca per continuare.');
        return;
      }
      if (result.error) { addToast('error', result.error); return; }
      setFlyer(toSave);
      addToast('success', `«${title}» salvato`);
      if (onSaved) onSaved(toSave);
    }).catch((err) => addToast('error', (err as Error).message || 'Errore salvataggio'));
  }, [flyer, userEmail, addToast, saveDocumentGuarded, onSaved]);

  const openSaveDialog = React.useCallback(() => {
    if (!flyerHasContent(flyer)) { addToast('info', 'Compila almeno il titolo o il copy prima di salvare.'); return; }
    setShowSaveDialog(true);
  }, [flyer, addToast]);

  const aiPanelProps = {
    aiPrompt, setAiPrompt,
    aiModel, setAiModel,
    aiTone, setAiTone,
    ai, flyer, debouncedFlyer,
    hasCopy: flyerHasCopy(flyer),
    onGenerate: handleGenerate, onRefine: handleRefine, onReset: handleAiReset,
    tier,
    onGenerateHero: handleGenerateHero,
    onRemoveHero: removeHero,
    onResetHero: handleResetHero,
    isGeneratingHero,
    heroPrompt,
    setHeroPrompt,
    heroSector,
    setHeroSector,
    heroTone,
    setHeroTone,
    showHeroPromptEditor,
    setShowHeroPromptEditor,
    heroLibrary,
    onSaveHeroPrompt: handleSaveHeroPrompt,
    onApplyHeroPrompt: handleApplyHeroPrompt,
    onDeleteHeroPrompt: handleDeleteHeroPrompt,
  } as const;

  const aiPanel = (
    <FlyerAiPanel
      {...aiPanelProps}
      onCollapse={() => setShowAi(false)}
    />
  );

  // Phase 14 (REQ-AI-002): su desktop l'AI vive nella rail AIConsole a
  // destra (un solo modello mentale). La console fornisce rail, collapse
  // persistito (pq_ui:v1), header, AILogPanel e provider badge; il pannello
  // volantino ci entra in modalità `bare` (senza header/log duplicati).
  const aiConsoleRail = (
    <AIConsole
      editorKind="flyer"
      isProcessing={ai.isProcessing || isGeneratingHero}
      logs={ai.logs}
      tier={tier}
      onSubmitPrompt={(text) => { setAiPrompt(text); }}
      hidePrompt
      lastCostUsd={lastCostUsd}
      // REQ-AI-003: su volantino vuoto la rail propone un prompt contestuale
      // con focus; l'expanded resta default true (o pq_ui:v1 se persistito).
      suggestedPrompt={!flyerHasContent(flyer) ? "Descrivi l'evento o la promo: scrivo il copy del volantino." : undefined}
      quickActions={
        <button type="button" className="card-ai-reset" onClick={handleAiReset} disabled={ai.isProcessing}>
          ↻ Nuova sessione
        </button>
      }
    >
      <FlyerAiPanel {...aiPanelProps} bare onCollapse={() => {}} />
    </AIConsole>
  );

  const manualPanel = (
    <FlyerManualPanel
      flyer={flyer} showTemplateBanner={showTemplateBanner} activeSector={activeSector}
      showCustomFont={showCustomFont} setShowCustomFont={setShowCustomFont}
      limitReached={limitReached} exporting={exporting}
      onCollapse={() => setShowManual(false)}
      onTitleChange={updateTitle} onUpdateContent={updateContent} onUpdateStyle={updateStyle}
      onUpdateSize={updateSize} onUpdateOrientation={updateOrientation} onUpdateLayout={updateLayout}
      onApplySector={applySector}
      onApplySectorLayout={applySectorLayout}
      onCloseTemplateBanner={() => setShowTemplateBanner(false)}
      onHeroUpload={handleHeroUpload} onRemoveHero={removeHero}
      onReset={resetFlyer} onSave={openSaveDialog}
      onExportPdf={() => setExporting('pdf')} onExportPng={() => setExporting('png')}
      flyerHasContent={flyerHasContent}
      budgetWarning={budgetWarning}
      copyBudget={copyBudget}
    />
  );

  return (
    <div className={`flyer-editor-shell editor-grid ${previewFocus ? 'focus-mode' : ''} ${!showAi && !showManual ? 'both-collapsed' : ''} ${!showAi || !showManual ? 'one-collapsed' : ''}`}>
      <div className={`editor-col ai-col ${showAi ? '' : 'collapsed'}`}>
        {showAi ? aiConsoleRail : (
          <div className="panel-tab" onClick={() => setShowAi(true)} title="Mostra AI" role="button" aria-label="Mostra AI">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
            <span>AI</span>
          </div>
        )}
      </div>

      <div className={`editor-col manual-col ${showManual ? '' : 'collapsed'}`}>
        {showManual ? manualPanel : (
          <div className="panel-tab" onClick={() => setShowManual(true)} title="Mostra controllo manuale" role="button" aria-label="Mostra manuale">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
            <span>Form</span>
          </div>
        )}
      </div>

      {/* Mobile actions */}
      <div className="editor-mobile-actions">
        <div className="editor-mobile-actions-buttons" style={{ display: 'flex', gap: 4 }}>
          <button onClick={openSaveDialog} className="mobile-action-btn mobile-action-btn-save" title="Salva" aria-label="Salva" disabled={limitReached}>💾</button>
          <button onClick={() => setExporting('pdf')} className="mobile-action-btn mobile-action-btn-export" title="PDF" aria-label="PDF" disabled={exporting !== null || !flyerHasContent(flyer) || limitReached}>📄</button>
          <button onClick={() => setExporting('png')} className="mobile-action-btn" title="PNG" aria-label="PNG" disabled={exporting !== null || !flyerHasContent(flyer) || limitReached}>🖼</button>
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

      {/* Preview column */}
      <FlyerPreviewPanel
        flyer={flyer} plan={layoutPlan} tier={tier} previewFocus={previewFocus}
        showDebug={showDebug} setShowDebug={setShowDebug}
        setPreviewFocus={setPreviewFocus}
        onCollapse={() => {}}
      />

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

export default FlyerEditorShell;
