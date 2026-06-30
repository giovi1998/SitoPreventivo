import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Logo, LogoSector, LogoBuilder } from '../utils/documentSchemas';
import { createEmptyLogo, createLogoTemplate } from '../utils/documentSchemas';
import { builderToSvg, sanitizeSvg, svgToPng } from '../utils/logoGenerator';
import dataService from '../utils/dataService';
import SaveDialog from './SaveDialog';
import BuilderPanel from './BuilderPanel';
import { useToast } from '../hooks/useToast';
import { logger } from '../utils/logger';
import './LogoEditor.css';
import { useDocumentSave } from '../hooks/useDocumentSave';

interface LogoEditorProps {
  userEmail: string;
  initialLogo?: Logo;
  tier?: 'free' | 'unlocked';
}

function deepSetBuilder(logo: Logo, patch: Partial<LogoBuilder>): Logo {
  return { ...logo, builder: { ...logo.builder, ...patch }, updatedAt: new Date().toISOString() };
}

function logoHasContent(logo: Logo): boolean {
  const b = logo.builder;
  return !!(b.primaryText || b.tagline || b.iconGlyph);
}

export default function LogoEditor({ userEmail, initialLogo, tier = 'unlocked' }: LogoEditorProps) {
  const { save: saveDocumentGuarded } = useDocumentSave();
  const [logo, setLogo] = useState<Logo>(initialLogo || createEmptyLogo());
  const [tab, setTab] = useState<'builder' | 'ai'>('builder');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [exporting, setExporting] = useState<'svg' | 'png-512' | 'png-1024' | 'png-2048' | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { addToast } = useToast();

  // Auto-save ogni 30s se c'è contenuto
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      if (!logoHasContent(logo)) return;
      const sanitized: Logo = { ...logo, userEmail, updatedAt: new Date().toISOString() };
      dataService.saveDocument(userEmail, sanitized).catch((err) => {
        logger.error('Logo auto-save failed', { err: (err as Error).message });
      });
    }, 30000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [logo, userEmail]);

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
      });
  }, [logo, userEmail, addToast, saveDocumentGuarded]);

  const openSaveDialog = useCallback(() => {
    if (!logoHasContent(logo)) {
      addToast('info', 'Compila almeno il testo o l\'icona prima di salvare.');
      return;
    }
    setShowSaveDialog(true);
  }, [logo, addToast]);

  const aiPanelMessage = useMemo(() => (
    'AI generation non disponibile nella v1. Configura REPLICATE_API_TOKEN su Vercel e upgrada a Pro. Vedi docs.'
  ), []);

  return (
    <div className="logo-editor">
      <header className="logo-editor-header">
        <h1>Logo</h1>
        <div className="logo-editor-actions">
          <button
            type="button"
            onClick={openSaveDialog}
            aria-label="Salva"
            title="Salva logo in Collection"
          >
            Salva
          </button>
          <button
            type="button"
            onClick={exportSvg}
            disabled={exporting !== null}
            aria-label="Esporta SVG"
            title="Esporta come file SVG vettoriale"
          >
            {exporting === 'svg' ? 'Esportando…' : 'Esporta SVG'}
          </button>
          <button
            type="button"
            onClick={() => exportPng(512)}
            disabled={exporting !== null}
            aria-label="Esporta PNG 512"
            title="Esporta PNG 512×512"
          >
            Esporta PNG 512
          </button>
          <button
            type="button"
            onClick={() => exportPng(1024)}
            disabled={exporting !== null}
            aria-label="Esporta PNG 1024"
            title="Esporta PNG 1024×1024"
          >
            Esporta PNG 1024
          </button>
          <button
            type="button"
            onClick={() => exportPng(2048)}
            disabled={exporting !== null}
            aria-label="Esporta PNG 2048"
            title="Esporta PNG 2048×2048"
          >
            Esporta PNG 2048
          </button>
        </div>
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
          AI Generation
        </button>
      </div>

      <div id="logo-tab-panel" role="tabpanel" aria-labelledby={tab === 'builder' ? 'tab-builder' : 'tab-ai'}>
        {tab === 'builder' ? (
          <BuilderPanel logo={logo} onPatch={onPatch} onTemplate={onTemplate} tier={tier} />
        ) : (
          <section className="logo-ai-disabled" aria-label="AI Generation disabilitata">
            <div className="logo-ai-card" role="status">
              <h2>AI Generation</h2>
              <p>{aiPanelMessage}</p>
              <p>
                <a href="/docs/logo-ai" rel="noopener">
                  Vedi documentazione
                </a>
              </p>
            </div>
          </section>
        )}
      </div>

      <SaveDialog
        open={showSaveDialog}
        defaultName={logo.title || 'Logo'}
        onSave={handleSave}
        onCancel={() => setShowSaveDialog(false)}
      />
    </div>
  );
}
