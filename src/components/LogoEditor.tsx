import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Logo, LogoSector, LogoBuilder } from '../utils/documentSchemas';
import { createEmptyLogo, createLogoTemplate, mergeLogoWithDefaults } from '../utils/documentSchemas';
import { builderToSvg, sanitizeSvg, svgToPng } from '../utils/logoGenerator';
import dataService from '../utils/dataService';
import SaveDialog from './SaveDialog';
import ActionBar from './ActionBar';
import BuilderPanel from './BuilderPanel';
import LogoAiPanel, { type LogoAiState } from './LogoAiPanel';
import { useToast } from '../hooks/useToast';
import { logger } from '../utils/logger';
import './LogoEditor.css';
import { useDocumentSave } from '../hooks/useDocumentSave';

interface LogoEditorProps {
  userEmail: string;
  initialLogo?: Logo;
  tier?: 'free' | 'unlocked';
  onReset?: () => void;
  onSaved?: (doc: any) => void;
}

function deepSetBuilder(logo: Logo, patch: Partial<LogoBuilder>): Logo {
  return { ...logo, builder: { ...logo.builder, ...patch }, updatedAt: new Date().toISOString() };
}

function logoHasContent(logo: Logo): boolean {
  const b = logo.builder;
  return !!(b.primaryText || b.tagline || b.iconGlyph);
}

export default function LogoEditor({ userEmail, initialLogo, tier = 'unlocked', onReset, onSaved }: LogoEditorProps) {
  const { save: saveDocumentGuarded } = useDocumentSave();
  // Deep-merge with createEmptyLogo() defaults: a saved logo from
  // the Collection might be missing the builder field (legacy save
  // / partial data). Without this guard the editor crashed at the
  // first read of logo.builder.X (layout, primaryText, ...). Same
  // pattern as the QR / Card mergeQr / mergeCard helpers.
  const [logo, setLogo] = useState<Logo>(() => mergeLogoWithDefaults(initialLogo));
  // Phase 14 (REQ-AI-003): su logo vuoto l'entry è AI-first (tab AI attivo);
  // su logo con contenuto resta il builder (lo stato AI della chat è in
  // aiStateRef, sopravvive al cambio tab senza localStorage, v2.3 fix).
  const [tab, setTab] = useState<'builder' | 'ai'>(() =>
    logoHasContent(mergeLogoWithDefaults(initialLogo)) ? 'builder' : 'ai'
  );
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [exporting, setExporting] = useState<'svg' | 'png-512' | 'png-1024' | 'png-2048' | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedIdRef = useRef<string | undefined>(initialLogo?.id);
  const { addToast } = useToast();

  // When the URL-driven document changes, reset local state to the new logo.
  useEffect(() => {
    if (!initialLogo?.id) return;
    if (initialLogo.id === loadedIdRef.current) return;
    loadedIdRef.current = initialLogo.id;
    setLogo(mergeLogoWithDefaults(initialLogo));
  }, [initialLogo]);

  // Auto-save ogni 30s se c'è contenuto
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      if (!logoHasContent(logo)) return;
      const sanitized: Logo = { ...logo, userEmail, updatedAt: new Date().toISOString() };
      dataService.saveDocument(userEmail, sanitized).then((result) => {
        if (result?.error) {
          logger.error('Logo auto-save failed', { err: result.error });
        } else if (onSaved) {
          onSaved(sanitized);
        }
      }).catch((err) => {
        logger.error('Logo auto-save failed', { err: (err as Error).message });
      });
    }, 30000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [logo, userEmail, onSaved]);

  const onPatch = useCallback((path: string, value: any) => {
    setLogo((prev) => {
      if (path.startsWith('builder.')) {
        const key = path.slice('builder.'.length) as keyof LogoBuilder;
        return deepSetBuilder(prev, { [key]: value } as Partial<LogoBuilder>);
      }
      return prev;
    });
  }, []);

  const onTemplate = useCallback((sector: LogoSector) => {
    const tpl = createLogoTemplate(sector);
    setLogo(tpl);
    addToast('info', `Template ${sector} caricato`);
  }, [addToast]);

  const exportSvg = useCallback(async () => {
    setExporting('svg');
    try {
      const svg = sanitizeSvg(builderToSvg(logo.builder));
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${logo.id}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', 'SVG scaricato');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore export SVG';
      addToast('error', message);
    } finally {
      setExporting(null);
    }
  }, [logo, addToast]);

  const exportPng = useCallback(async (size: 512 | 1024 | 2048) => {
    setExporting(`png-${size}` as any);
    try {
      const svg = sanitizeSvg(builderToSvg(logo.builder));
      const bytes = await svgToPng(svg, size, { tier });
      const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${logo.id}_${size}.png`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', `PNG ${size} scaricato`);
    } catch (err) {
      const message = err instanceof Error ? err.message : `Errore export PNG ${size}`;
      addToast('error', message);
    } finally {
      setExporting(null);
    }
  }, [logo, tier, addToast]);

  const handleSave = useCallback((customName: string) => {
    const title = customName || logo.title || 'Logo';
    const toSave: Logo = { ...logo, userEmail, title, updatedAt: new Date().toISOString() };
    // Phase 5: use guarded save which checks the free-tier doc limit
    // and triggers the TierLimitModal if reached.
    saveDocumentGuarded(userEmail, toSave)
      .then((result) => {
        if (result.blocked) {
          addToast('info', 'Limite piano free raggiunto. Sblocca per continuare.');
          return;
        }
        if (result.error) {
          addToast('error', result.error);
          return;
        }
        setLogo(toSave);
        addToast('success', `«${title}» salvato`);
        setShowSaveDialog(false);
        if (onSaved) onSaved(toSave);
      })
      .catch((err) => {
        logger.error('Logo save failed', { err: (err as Error)?.message });
        addToast('error', (err as Error)?.message || 'Errore salvataggio');
      });
  }, [logo, userEmail, addToast, saveDocumentGuarded, onSaved]);

  const openSaveDialog = useCallback(() => {
    if (!logoHasContent(logo)) {
      addToast('info', 'Compila almeno il testo o l\'icona prima di salvare.');
      return;
    }
    setShowSaveDialog(true);
  }, [logo, addToast]);

  const [aiPanelResetKey, setAiPanelResetKey] = useState(0);

  // Stato del pannello AI (chat, concept, immagini generate) sollevato
  // qui in un useRef: `LogoAiPanel` viene smontato/rimontato ogni
  // volta che l'utente cambia tab (Builder <-> AI, vedi il rendering
  // condizionale sotto), perdendo il proprio stato interno React. Un
  // useRef in questo componente (che non si smonta mai cambiando tab)
  // sopravvive al ciclo di smontaggio/rimontaggio, quindi le immagini
  // AI generate (costose, chiamata Gemini a pagamento) non vengono più
  // perse. Non serve useState: non deve triggerare un re-render di
  // LogoEditor, solo fornire il valore più recente al momento in cui
  // LogoAiPanel rimonta.
  const aiStateRef = useRef<LogoAiState | undefined>(undefined);
  const handleAiStateChange = useCallback((s: LogoAiState) => {
    aiStateRef.current = s;
  }, []);

  const handleNew = useCallback(() => {
    if (logoHasContent(logo)) {
      const ok = window.confirm('Creare un nuovo logo? Le modifiche non salvate andranno perse.');
      if (!ok) return;
    }
    setLogo(createEmptyLogo());
    setTab('builder');
    localStorage.removeItem('logoAiChat:v1');
    aiStateRef.current = undefined;
    setAiPanelResetKey((k) => k + 1);
    if (onReset) onReset();
    else addToast('info', 'Nuovo logo creato.');
  }, [logo, addToast, onReset]);

  // Phase 13b (REQ-UX-004/005): cluster azioni uniforme — Salva primary,
  // Esporta secondary con menu (SVG/PNG 512/1024/2048), Nuovo ghost.
  const handleExportAction = useCallback((id: string) => {
    if (id === 'svg') exportSvg();
    else if (id === 'png-512') exportPng(512);
    else if (id === 'png-1024') exportPng(1024);
    else if (id === 'png-2048') exportPng(2048);
  }, [exportSvg, exportPng]);

  return (
    <div className="logo-editor">
      <header className="logo-editor-header">
        <h1>Logo</h1>
        <ActionBar
          onNew={handleNew}
          onSave={openSaveDialog}
          exportItems={[
            { id: 'svg', label: exporting === 'svg' ? 'Esportando…' : 'SVG vettoriale' },
            { id: 'png-512', label: 'PNG 512×512' },
            { id: 'png-1024', label: 'PNG 1024×1024' },
            { id: 'png-2048', label: 'PNG 2048×2048' },
          ]}
          onExport={handleExportAction}
          exportDisabled={exporting !== null}
        />
      </header>

      <div className="logo-tabs" role="tablist" aria-label="Modalità di creazione logo">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'builder'}
          aria-controls="logo-tab-panel"
          className={`logo-tab${tab === 'builder' ? ' active' : ''}`}
          onClick={() => setTab('builder')}
        >
          Builder
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'ai'}
          aria-controls="logo-tab-panel"
          className={`logo-tab${tab === 'ai' ? ' active' : ''}`}
          onClick={() => setTab('ai')}
        >
          AI Assist
          {logo.builder.backgroundImage && (
            <span className="logo-tab-ai-badge" aria-label="Background AI attivo" title="Background AI attivo" />
          )}
        </button>
      </div>

      <div id="logo-tab-panel" role="tabpanel" aria-labelledby={tab === 'builder' ? 'tab-builder' : 'tab-ai'}>
        {tab === 'builder' ? (
          <BuilderPanel logo={logo} onPatch={onPatch} onTemplate={onTemplate} tier={tier} userEmail={userEmail} />
        ) : (
          <LogoAiPanel
            key={aiPanelResetKey}
            logo={logo}
            onPatch={(patch) => {
              for (const [k, v] of Object.entries(patch)) onPatch(`builder.${k}`, v);
            }}
            tier={tier}
            userEmail={userEmail}
            initialState={aiStateRef.current}
            onStateChange={handleAiStateChange}
          />
        )}
      </div>

      <SaveDialog
        open={showSaveDialog}
        defaultName={logo.title || 'Logo'}
        documentLabel="logo"
        placeholder="Es. Logo - Acme Srl"
        onSave={handleSave}
        onCancel={() => setShowSaveDialog(false)}
      />
    </div>
  );
}
