import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Website, WebsiteBrief, WebsiteStyle } from '../utils/documentSchemas';
import { createEmptyWebsite, mergeWebsiteWithDefaults } from '../utils/documentSchemas';
import dataService from '../utils/dataService';
import SaveDialog from './SaveDialog';
import ActionBar from './ActionBar';
import { useToast } from '../hooks/useToast';
import { useDocumentSave } from '../hooks/useDocumentSave';
import { useAIWebsite } from '../hooks/useAIWebsite';
import { withAiCall } from '../utils/aiStats';
import { DocumentAiStats } from './DocumentAiStats';
import AIProviderBadge from './ai/AIProviderBadge';
import { getAiProviderDefault, setAiProviderDefault } from '../utils/uiPrefs';
import { compressDataUrl } from '../utils/card/imageCompress';
import { logger } from '../utils/logger';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import './WebsiteEditor.css';

interface WebsiteEditorProps {
  userEmail: string;
  initialWebsite?: Website;
  tier?: 'free' | 'unlocked';
  onReset?: () => void;
  onSaved?: (doc: any) => void;
}

const STYLE_OPTIONS: { value: WebsiteStyle; label: string }[] = [
  { value: 'modern', label: 'Moderno' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'creative', label: 'Creativo' },
  { value: 'brutalist', label: 'Brutalista' },
];

const VIEWPORT_OPTIONS = [
  { value: '100%', label: 'Desktop', icon: '🖥' },
  { value: '768px', label: 'Tablet', icon: '📱' },
  { value: '375px', label: 'Mobile', icon: '📱' },
];

type CodeTab = 'html' | 'css' | 'js';

function websiteHasContent(w: Website): boolean {
  return !!(w.html || w.css || w.js);
}

function buildFullDocument(html: string, css: string, js: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${css}</style>
</head>
<body>
${html}
<script>${js}</script>
</body>
</html>`;
}

function injectLogoIntoHtml(html: string, logoUrl: string | null): string {
  if (!logoUrl) return html;
  const logoHtml = `<div class="site-logo-wrapper" style="display:flex;align-items:center;padding:8px 16px;"><img src="${logoUrl}" alt="Logo" class="site-logo" style="height:40px;width:auto;" /></div>`;
  const headerContent = html.match(/(<header[^>]*>)([\s\S]*?)(<\/header>)/i);
  if (headerContent) {
    return html.replace(headerContent[0], `${headerContent[1]}${logoHtml}${headerContent[2]}${headerContent[3]}`);
  }
  const bodyMatch = html.match(/<body[^>]*>/i);
  if (bodyMatch) {
    return html.replace(bodyMatch[0], bodyMatch[0] + '\n' + logoHtml);
  }
  return html;
}

export default function WebsiteEditor({ userEmail, initialWebsite, tier = 'unlocked', onReset, onSaved }: WebsiteEditorProps) {
  const { save: saveDocumentGuarded } = useDocumentSave();
  const [website, setWebsite] = useState<Website>(() => mergeWebsiteWithDefaults(initialWebsite));
  const [tab, setTab] = useState<'brief' | 'code' | 'preview'>('brief');
  const [codeTab, setCodeTab] = useState<CodeTab>('html');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [viewport, setViewport] = useState('100%');
  const [refinePrompt, setRefinePrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [aiModel, setAiModel] = useState(() => getAiProviderDefault() || '');
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProcessingRef = useRef(false);
  const loadedIdRef = useRef<string | undefined>(initialWebsite?.id);
  const loadedUpdatedAtRef = useRef<string | undefined>(initialWebsite?.updatedAt);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { addToast } = useToast();

  const {
    generate,
    refine,
    reset: resetAI,
    logs,
    isProcessing,
    availableModels,
    lastCostUsd,
  } = useAIWebsite(userEmail);

  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  useEffect(() => {
    if (!initialWebsite?.id) return;
    const isNewDoc = initialWebsite.id !== loadedIdRef.current;
    const isUpdated = initialWebsite.updatedAt !== loadedUpdatedAtRef.current;
    if (!isNewDoc && !isUpdated) return;
    loadedIdRef.current = initialWebsite.id;
    loadedUpdatedAtRef.current = initialWebsite.updatedAt;
    setWebsite(mergeWebsiteWithDefaults(initialWebsite));
  }, [initialWebsite]);

  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      if (isProcessingRef.current) return;
      if (!websiteHasContent(website)) return;
      const toSave: Website = { ...website, userEmail, updatedAt: new Date().toISOString() };
      dataService.saveDocument(userEmail, toSave).then((result) => {
        if (result?.error) logger.error('Website auto-save failed', { err: result.error });
        else if (onSaved) onSaved(toSave);
      }).catch((err) => {
        logger.error('Website auto-save failed', { err: (err as Error).message });
      });
    }, 30000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [website, userEmail, onSaved]);

  const updateBrief = useCallback((field: keyof WebsiteBrief, value: string) => {
    setWebsite((prev) => ({
      ...prev,
      brief: { ...prev.brief, [field]: value },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const updateStyle = useCallback(async (style: WebsiteStyle) => {
    setWebsite((prev) => ({ ...prev, style, updatedAt: new Date().toISOString() }));
    if (!websiteHasContent(website)) return;
    setIsRefining(true);
    try {
      const result = await refine(
        { html: website.html, css: website.css, js: website.js, pages: website.pages },
        `Applica lo stile visivo "${style}" al sito. Cambia SOLO i colori, i font, i bordi, gli sfondi e le decorazioni CSS per adattarli allo stile ${style}. NON cambiare la struttura HTML, i contenuti, il layout o il JavaScript. Mantieni tutto il resto identico.`,
        { modelId: aiModel || undefined },
      );
      setWebsite((prev) => ({
        ...prev,
        html: result.site.html,
        css: result.site.css,
        js: result.site.js,
        pages: result.site.pages,
        updatedAt: new Date().toISOString(),
      }));
      addToast('success', `Stile ${style} applicato`);
    } catch (err) {
      addToast('error', (err as Error)?.message || 'Errore cambio stile');
    } finally {
      setIsRefining(false);
    }
  }, [website, refine, addToast]);

  const updateCode = useCallback((field: 'html' | 'css' | 'js', value: string) => {
    setWebsite((prev) => ({ ...prev, [field]: value, updatedAt: new Date().toISOString() }));
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      setWebsite((prev) => ({ ...prev }));
    }, 500);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!website.brief.businessName.trim()) {
      addToast('error', 'Inserisci il nome dell\'attività');
      return;
    }
    if (!website.brief.description.trim()) {
      addToast('error', 'Inserisci una descrizione dell\'attività');
      return;
    }
    try {
      let scrapedRef = '';
      const urlMatch = website.brief.notes.match(/(https?:\/\/[^\s]+)/i);
      if (urlMatch) {
        try {
          const res = await fetch(`/api/ai/scrape?url=${encodeURIComponent(urlMatch[1])}`, { signal: AbortSignal.timeout(8000) });
          if (res.ok) {
            const body = await res.json() as { text?: string };
            scrapedRef = body.text?.slice(0, 3000) || '';
          }
        } catch { /* scrape fallisce silenziosamente */ }
      }
      const result = await generate(website.brief, {
        style: website.style,
        briefContext: website.briefContext,
        modelId: aiModel || undefined,
        logoBase64: website.logoUrl || undefined,
        scrapedReference: scrapedRef || undefined,
      });
      const merged = {
        ...website,
        html: injectLogoIntoHtml(result.site.html, website.logoUrl),
        css: result.site.css,
        js: result.site.js,
        pages: result.site.pages,
        source: 'ai' as const,
        updatedAt: new Date().toISOString(),
      };
      const withCost = result.aiCall ? withAiCall(merged, result.aiCall.kind, result.aiCall.costUsd) : merged;
      setWebsite(withCost);
      setTab('preview');
      addToast('success', `Sito generato: ${result.site.pages.length} pagine`);
    } catch (err) {
      addToast('error', (err as Error)?.message || 'Errore generazione sito');
    }
  }, [website, generate, addToast]);

  const handleRefine = useCallback(async () => {
    if (!refinePrompt.trim()) {
      addToast('info', 'Scrivi cosa vuoi modificare');
      return;
    }
    setIsRefining(true);
    try {
      const result = await refine(
        { html: website.html, css: website.css, js: website.js, pages: website.pages },
        refinePrompt,
        { modelId: aiModel || undefined },
      );
      setWebsite((prev) => ({
        ...prev,
        html: result.site.html,
        css: result.site.css,
        js: result.site.js,
        pages: result.site.pages,
        updatedAt: new Date().toISOString(),
      }));
      setRefinePrompt('');
      addToast('success', 'Sito raffinato');
    } catch (err) {
      addToast('error', (err as Error)?.message || 'Errore raffinamento');
    } finally {
      setIsRefining(false);
    }
  }, [refinePrompt, website, refine, addToast]);

  const handleSave = useCallback(async (customName: string) => {
    const title = customName || website.title || 'Sito Web';
    const toSave: Website = {
      ...website,
      userEmail,
      title,
      updatedAt: new Date().toISOString(),
    };
    saveDocumentGuarded(userEmail, toSave)
      .then((result) => {
        if (result.blocked) {
          addToast('info', 'Limite piano free raggiunto. Sblocca per continuare.');
          return;
        }
        if (result.error) { addToast('error', result.error); return; }
        setWebsite(toSave);
        addToast('success', `«${title}» salvato`);
        setShowSaveDialog(false);
        if (onSaved) onSaved(toSave);
      })
      .catch((err) => {
        logger.error('Website save failed', { err: (err as Error)?.message });
        addToast('error', (err as Error)?.message || 'Errore salvataggio');
      });
  }, [website, userEmail, addToast, saveDocumentGuarded, onSaved]);

  const openSaveDialog = useCallback(() => {
    if (!websiteHasContent(website)) {
      addToast('info', 'Genera il sito con AI prima di salvare.');
      return;
    }
    setShowSaveDialog(true);
  }, [website, addToast]);

  const handleNew = useCallback(() => {
    if (websiteHasContent(website)) {
      const ok = window.confirm('Creare un nuovo sito? Le modifiche non salvate andranno perse.');
      if (!ok) return;
    }
    setWebsite(createEmptyWebsite());
    setTab('brief');
    resetAI();
    if (onReset) onReset();
    else addToast('info', 'Nuovo sito creato.');
  }, [website, addToast, onReset, resetAI]);

  const handleExportZip = useCallback(async () => {
    setExporting(true);
    try {
      const zip = new JSZip();
      const name = website.brief.businessName || website.title || 'sito-web';
      const folder = zip.folder(`sito-${name}`)!;
      const pages = website.pages.length > 0 ? website.pages : ['index'];

      for (const page of pages) {
        const pageHtml = page === 'index'
          ? website.html
          : website.html.replace(/<section[^>]*id="[^"]*"[^>]*>[\s\S]*?<\/section>/g, '')
              .replace(/<header>[\s\S]*?<\/header>/, '')
              .replace(/<footer>[\s\S]*?<\/footer>/, '');
        const doc = buildFullDocument(pageHtml, website.css, website.js);
        folder.file(`${page}.html`, doc);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `sito-${name}.zip`);
      addToast('success', 'ZIP scaricato');
    } catch (err) {
      addToast('error', (err as Error)?.message || 'Errore export ZIP');
    } finally {
      setExporting(false);
    }
  }, [website, addToast]);

  const handleOpenInNewTab = useCallback(() => {
    const doc = buildFullDocument(website.html, website.css, website.js);
    const blob = new Blob([doc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }, [website]);

  const handleProviderChange = useCallback((providerId: string) => {
    setAiProviderDefault(providerId);
    setAiModel(providerId);
  }, []);

  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = String(reader.result || '');
      compressDataUrl(dataUri).then((compressed) => {
        setWebsite((prev) => ({ ...prev, logoUrl: compressed || dataUri, updatedAt: new Date().toISOString() }));
      });
    };
    reader.readAsDataURL(file);
  }, []);

  const removeLogo = useCallback(() => {
    setWebsite((prev) => ({ ...prev, logoUrl: null, updatedAt: new Date().toISOString() }));
  }, []);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    Promise.all(files.map((file) => new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUri = String(reader.result || '');
        compressDataUrl(dataUri).then((compressed) => resolve(compressed || dataUri));
      };
      reader.readAsDataURL(file);
    }))).then((compressed) => {
      setWebsite((prev) => ({ ...prev, images: [...prev.images, ...compressed], updatedAt: new Date().toISOString() }));
    });
  }, []);

  const removeImage = useCallback((index: number) => {
    setWebsite((prev) => {
      const next = [...prev.images];
      next.splice(index, 1);
      return { ...prev, images: next, updatedAt: new Date().toISOString() };
    });
  }, []);

  const fullDocument = useMemo(
    () => buildFullDocument(website.html, website.css, website.js),
    [website.html, website.css, website.js],
  );

  return (
    <div className="website-editor">
      <header className="website-editor-header">
        <h1>Sito Web</h1>
        <DocumentAiStats aiStats={website.aiStats} />
        <ActionBar
          onNew={handleNew}
          onSave={openSaveDialog}
          exportItems={[
            { id: 'zip', label: exporting ? 'Esportando…' : 'ZIP (HTML+CSS+JS)' },
          ]}
          onExport={(id) => { if (id === 'zip') handleExportZip(); }}
          exportDisabled={exporting || !websiteHasContent(website)}
        />
      </header>

      <div className="website-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'brief'} className={`website-tab${tab === 'brief' ? ' active' : ''}`} onClick={() => setTab('brief')}>Brief</button>
        <button role="tab" aria-selected={tab === 'preview'} className={`website-tab${tab === 'preview' ? ' active' : ''}`} onClick={() => setTab('preview')} disabled={!websiteHasContent(website)}>Preview</button>
        <button role="tab" aria-selected={tab === 'code'} className={`website-tab${tab === 'code' ? ' active' : ''}`} onClick={() => setTab('code')} disabled={!websiteHasContent(website)}>Codice</button>
      </div>

      <div className="website-content">
        {tab === 'brief' && (
          <div className="website-brief-panel">
            <div className="brief-form">
              <div className="brief-field">
                <label>Nome attività *</label>
                <input type="text" value={website.brief.businessName} onChange={(e) => updateBrief('businessName', e.target.value)} placeholder="Es. Panetteria Artigianale" maxLength={100} />
              </div>
              <div className="brief-field">
                <label>Settore</label>
                <input type="text" value={website.brief.sector} onChange={(e) => updateBrief('sector', e.target.value)} placeholder="Es. tech, food, fashion..." maxLength={50} />
              </div>
              <div className="brief-field brief-field-full">
                <label>Descrizione *</label>
                <textarea value={website.brief.description} onChange={(e) => updateBrief('description', e.target.value)} placeholder="Descrivi l'attività, cosa offre, cosa vende..." maxLength={1000} rows={4} />
              </div>
              <div className="brief-field">
                <label>Tono comunicativo</label>
                <input type="text" value={website.brief.tone} onChange={(e) => updateBrief('tone', e.target.value)} placeholder="Es. professionale, amichevole, lussuoso..." maxLength={50} />
              </div>
              <div className="brief-field">
                <label>Target audience</label>
                <input type="text" value={website.brief.target} onChange={(e) => updateBrief('target', e.target.value)} placeholder="Es. Giovani professionisti 25-40 anni" maxLength={200} />
              </div>
              <div className="brief-field">
                <label>Pagine richieste</label>
                <input type="text" value={website.brief.pages} onChange={(e) => updateBrief('pages', e.target.value)} placeholder="index, about, contact..." maxLength={300} />
              </div>
              <div className="brief-field">
                <label>Colori preferiti</label>
                <input type="text" value={website.brief.preferredColors} onChange={(e) => updateBrief('preferredColors', e.target.value)} placeholder="Es. Blu scuro e oro, #01696F" maxLength={200} />
              </div>
              <div className="brief-field">
                <label>Font preferito</label>
                <input type="text" value={website.brief.font} onChange={(e) => updateBrief('font', e.target.value)} placeholder="Es. Inter, Georgia, Playfair Display..." maxLength={50} />
              </div>
              <div className="brief-field">
                <label>Call-to-action principale</label>
                <input type="text" value={website.brief.cta} onChange={(e) => updateBrief('cta', e.target.value)} placeholder="Es. Richiedi un preventivo gratuito" maxLength={100} />
              </div>
              <div className="brief-field">
                <label>Sezioni desiderate</label>
                <input type="text" value={website.brief.sections} onChange={(e) => updateBrief('sections', e.target.value)} placeholder="hero, chi_siamo, servizi, contatti..." maxLength={300} />
              </div>
              <div className="brief-field">
                <label>Feature speciali</label>
                <input type="text" value={website.brief.features} onChange={(e) => updateBrief('features', e.target.value)} placeholder="Es. Galleria foto, form contatto..." maxLength={300} />
              </div>
              <div className="brief-field">
                <label>Contatti</label>
                <input type="text" value={website.brief.contacts} onChange={(e) => updateBrief('contacts', e.target.value)} placeholder="Via Roma 1, 00100 Roma, info@..." maxLength={300} />
              </div>
              <div className="brief-field">
                <label>Social link</label>
                <input type="text" value={website.brief.social} onChange={(e) => updateBrief('social', e.target.value)} placeholder="Instagram: @..., Facebook: /..." maxLength={300} />
              </div>
              <div className="brief-field brief-field-full">
                <label>Note extra</label>
                <textarea value={website.brief.notes} onChange={(e) => updateBrief('notes', e.target.value)} placeholder="Es. Il cliente vuole design simile a www.esempio.com" maxLength={500} rows={3} />
              </div>
            </div>

            <div className="brief-sidebar">
              <div className="brief-style-select">
                <label>Stile visivo</label>
                <div className="style-pills">
                  {STYLE_OPTIONS.map((opt) => (
                    <button key={opt.value} className={`style-pill${website.style === opt.value ? ' active' : ''}`} onClick={() => updateStyle(opt.value)}>{opt.label}</button>
                  ))}
                </div>
              </div>

              <div className="brief-logo-section">
                <label>Logo / Immagine</label>
                {website.logoUrl ? (
                  <div className="brief-logo-preview">
                    <img src={website.logoUrl} alt="Logo" />
                    <button className="brief-logo-remove" onClick={removeLogo} title="Rimuovi logo">✕</button>
                  </div>
                ) : (
                  <label className="brief-logo-upload">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    <span>Carica logo</span>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} hidden />
                  </label>
                )}
              </div>

              <div className="brief-images-section">
                <label>Immagini per sezioni</label>
                {website.images.length > 0 && (
                  <div className="brief-image-list">
                    {website.images.map((img, i) => (
                      <div key={i} className="brief-image-item">
                        <img src={img} alt={`Immagine ${i + 1}`} />
                        <button className="brief-logo-remove" onClick={() => removeImage(i)} title="Rimuovi">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="brief-logo-upload">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span>Aggiungi immagini</span>
                  <input type="file" accept="image/*" multiple onChange={handleImageUpload} hidden />
                </label>
              </div>

              <div className="brief-ai-provider">
                <AIProviderBadge lastCostUsd={lastCostUsd} onProviderChange={handleProviderChange} />
              </div>

              <button className="btn-generate" onClick={handleGenerate} disabled={isProcessing}>
                {isProcessing ? 'Generando…' : 'Genera sito con AI'}
              </button>

              {websiteHasContent(website) && (
                <div className="refine-section">
                  <label>Raffina con AI</label>
                  <textarea value={refinePrompt} onChange={(e) => setRefinePrompt(e.target.value)} placeholder="Es. Rendi i colori più scuri, cambia il font in Inter..." rows={3} />
                  <button className="btn-refine" onClick={handleRefine} disabled={isRefining || !refinePrompt.trim()}>
                    {isRefining ? 'Raffinando…' : 'Raffina'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'preview' && (
          <div className="website-preview-panel">
            <div className="viewport-controls">
              {VIEWPORT_OPTIONS.map((opt) => (
                <button key={opt.value} className={`viewport-btn${viewport === opt.value ? ' active' : ''}`} onClick={() => setViewport(opt.value)}>
                  {opt.icon} {opt.label}
                </button>
              ))}
              <button className="btn-open-tab" onClick={handleOpenInNewTab} title="Apri in nuova tab">↗ Nuova tab</button>
            </div>
            <div className="preview-wrapper" style={{ width: viewport }}>
              <iframe
                sandbox="allow-scripts"
                srcDoc={fullDocument}
                title="Anteprima sito"
                className="preview-iframe"
              />
            </div>
          </div>
        )}

        {tab === 'code' && (
          <div className="website-code-panel">
            <div className="code-tabs" role="tablist">
              {(['html', 'css', 'js'] as CodeTab[]).map((ct) => (
                <button key={ct} role="tab" aria-selected={codeTab === ct} className={`code-tab${codeTab === ct ? ' active' : ''}`} onClick={() => setCodeTab(ct)}>
                  {ct.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="code-editor-container">
              {codeTab === 'html' && (
                <textarea className="code-textarea" value={website.html} onChange={(e) => updateCode('html', e.target.value)} spellCheck={false} />
              )}
              {codeTab === 'css' && (
                <textarea className="code-textarea" value={website.css} onChange={(e) => updateCode('css', e.target.value)} spellCheck={false} />
              )}
              {codeTab === 'js' && (
                <textarea className="code-textarea" value={website.js} onChange={(e) => updateCode('js', e.target.value)} spellCheck={false} />
              )}
            </div>
          </div>
        )}
      </div>

      <SaveDialog
        open={showSaveDialog}
        defaultName={website.title || website.brief.businessName || 'Sito Web'}
        documentLabel="sito web"
        placeholder="Es. Sito - Panetteria Artigianale"
        onSave={handleSave}
        onCancel={() => setShowSaveDialog(false)}
      />
    </div>
  );
}
