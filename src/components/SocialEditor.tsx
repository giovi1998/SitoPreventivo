import React, { useState, useMemo, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import type { BusinessCard, Flyer, Website } from '../utils/documentSchemas';
import { useAISocial } from '../hooks/useAISocial';
import type { SocialSource, SocialSourceType, SocialTone, SocialPlatform } from '../ai/prompts/socialSystem';
import type { SocialPost } from '../ai/socialOrchestrator';
import { useToast } from '../hooks/useToast';
import AIConsole from './ai/AIHarnessConsole';
import { AiSelect, AiGenerateButton } from './ai-ui';
import { AuthContext } from '../contexts';
import dataService from '../utils/dataService';
import CardAIFab from './CardAIFab';
import CardAIBottomSheet from './CardAIBottomSheet';
import { useIsMobileWorkspace } from '../hooks/useMediaQuery';
import { AI_IMAGE_MODELS, getAiImageModelDefault, setAiImageModelDefault } from '../utils/uiPrefs';
import './SocialEditor.css';
import './aiFabSheet.css';

interface Props {
  userEmail: string;
  cardDocuments: BusinessCard[];
  flyerDocuments: Flyer[];
  websiteDocuments?: Website[];
}

const TONES: { value: SocialTone; label: string }[] = [
  { value: 'professional', label: 'Professionale' },
  { value: 'casual', label: 'Informale' },
  { value: 'promotional', label: 'Promozionale' },
];

// Fallback concreto quando l'AI non emette imagePrompt: Gemini rifiuta
// prompt vaghi/meta ("visual coerente col brand" → GEMINI_NO_IMAGE_IN_RESPONSE).
// Il soggetto deve venire dai dati sorgente (servizi/headline), in inglese.
export function buildFallbackImagePrompt(source: SocialSource | null, platform: SocialPlatform): string {
  const subject = source
    ? source.type === 'card'
      ? [source.data.services?.[0], source.data.title, source.data.company].filter(Boolean).join(', ')
      : source.type === 'flyer'
        ? [source.data.headline, source.data.subheadline].filter(Boolean).join(', ')
        : [source.data.businessName, source.data.sector, source.data.features].filter(Boolean).join(', ')
    : '';
  const base = subject
    ? `Professional social media photo for a business: ${subject}. Clean composition, natural light, high quality photography`
    : 'Professional social media photo, clean modern composition, natural light, high quality photography';
  return `${base}. No text, no logos, no watermarks. Platform: ${platform}.`;
}

export default function SocialEditor({ userEmail, cardDocuments, flyerDocuments, websiteDocuments = [] }: Props) {
  const { generate, generatePostImage, posts, postImages, isProcessing, logs, reset, lastCostUsd, setPosts } = useAISocial(userEmail);
  const { addToast } = useToast();
  const { user } = useContext(AuthContext);
  const [tier, setTier] = useState<'free' | 'unlocked'>('free');
  const [imageLoading, setImageLoading] = useState<string | null>(null);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [imageModel, setImageModel] = useState<string>(() => getAiImageModelDefault());
  const isMobileWorkspace = useIsMobileWorkspace();

  useEffect(() => {
    if (user?.role === 'admin') {
      setTier('unlocked');
      return;
    }
    let active = true;
    dataService.getUserSettings(userEmail)
      .then((s: any) => { if (active) setTier(s?.tier === 'unlocked' ? 'unlocked' : 'free'); })
      .catch(() => { if (active) setTier('free'); });
    return () => { active = false; };
  }, [userEmail, user?.role]);
  const [sourceType, setSourceType] = useState<SocialSourceType>('card');
  const [sourceId, setSourceId] = useState<string>('');
  const [tone, setTone] = useState<SocialTone>('promotional');
  const [lastSource, setLastSource] = useState<SocialSource | null>(null);

  const hasSources = cardDocuments.length > 0 || flyerDocuments.length > 0 || websiteDocuments.length > 0;

  const availableSources = useMemo(() => {
    if (sourceType === 'card') {
      return cardDocuments.filter(Boolean).map((c) => ({ id: c?.id, label: c?.title || c?.front?.company || c?.front?.name || c?.id }));
    }
    if (sourceType === 'flyer') {
      return flyerDocuments.filter(Boolean).map((f) => ({ id: f?.id, label: f?.title || f?.content?.headline || f?.id }));
    }
    return websiteDocuments.filter(Boolean).map((w) => ({ id: w?.id, label: w?.title || w?.brief?.businessName || w?.id }));
  }, [sourceType, cardDocuments, flyerDocuments, websiteDocuments]);

  const handleGenerate = async (promptOverride?: string) => {
    if (!sourceId) {
      addToast('info', 'Seleziona un documento sorgente dalla collection.');
      return;
    }
    const promptText = promptOverride?.trim() || '';
    const doc =
      sourceType === 'card'
        ? cardDocuments.find((c) => c.id === sourceId)
        : sourceType === 'flyer'
          ? flyerDocuments.find((f) => f.id === sourceId)
          : websiteDocuments.find((w) => w.id === sourceId);
    if (!doc) {
      addToast('error', 'Documento non trovato.');
      return;
    }
    const source: SocialSource = sourceType === 'card'
      ? {
          type: 'card',
          sourceId: doc.id,
          data: {
            name: (doc as BusinessCard).front?.name,
            title: (doc as BusinessCard).front?.title,
            company: (doc as BusinessCard).front?.company,
            accentColor: (doc as BusinessCard).style?.accentColor,
            services: (doc as BusinessCard).back?.services,
          },
        }
      : sourceType === 'flyer'
        ? {
            type: 'flyer',
            sourceId: doc.id,
            data: {
              headline: (doc as Flyer).content?.headline,
              subheadline: (doc as Flyer).content?.subheadline,
              body: (doc as Flyer).content?.body,
              ctaLabel: (doc as Flyer).content?.cta?.label,
            },
          }
        : {
            type: 'website',
            sourceId: doc.id,
            data: {
              businessName: (doc as Website).brief?.businessName,
              sector: (doc as Website).brief?.sector,
              description: (doc as Website).brief?.description,
              target: (doc as Website).brief?.target,
              cta: (doc as Website).brief?.cta,
              features: (doc as Website).brief?.features,
              contact: (doc as Website).brief?.contacts,
            },
          };
    try {
      const result = await generate(source, tone, { userPrompt: promptText });
      if (result.applied) {
        setLastSource(source);
        addToast('success', `3 post generati per ${result.posts.length} piattaforme.`);
      } else {
        addToast('error', 'AI non ha generato post validi. Riprova.');
      }
    } catch (err) {
      addToast('error', 'Errore AI: ' + ((err as Error)?.message ?? 'unknown'));
    }
  };

  const copyPost = (caption: string) => {
    navigator.clipboard.writeText(caption).then(() => addToast('success', 'Caption copiata.'));
  };

  const updatePost = (platform: string, patch: Partial<SocialPost>) => {
    setPosts((prev) => prev.map((p) => (p.platform === platform ? { ...p, ...patch } : p)));
  };

  const handleGenerateImage = async (platform: SocialPlatform, imagePrompt?: string) => {
    const prompt = imagePrompt?.trim() || buildFallbackImagePrompt(lastSource, platform);
    setImageLoading(platform);
    try {
      await generatePostImage(platform, prompt, imageModel);
      addToast('success', `Immagine ${platform} generata.`);
    } catch (err) {
      addToast('error', 'Errore immagine: ' + ((err as Error)?.message ?? 'unknown'));
    } finally {
      setImageLoading(null);
    }
  };

  const downloadImage = (platform: string, dataUrl: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `social-${platform}.jpg`;
    a.click();
  };

  const aiConsolePanel = (
    <AIConsole
      editorKind="social"
      isProcessing={isProcessing}
      logs={logs}
      tier={tier}
      onSubmitPrompt={(text) => { void handleGenerate(text); }}
      onClearLogs={reset}
      forceExpanded={isMobileWorkspace}
    >
      <section className="social-editor-form" aria-label="Configurazione post">
        <h2 className="social-form-title">Configura generazione</h2>
        <p className="social-form-hint">L'AI legge il contenuto del documento scelto e scrive 3 caption ottimizzate per piattaforma.</p>
        <AiSelect
          label="Tipo sorgente"
          value={sourceType}
          onChange={(e) => { setSourceType(e.target.value as SocialSourceType); setSourceId(''); }}
          options={[
            { value: 'card', label: 'Bigliettino' },
            { value: 'flyer', label: 'Volantino' },
            { value: 'website', label: 'Sito web' },
          ]}
        />
        <AiSelect
          label="Documento sorgente"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          options={[
            { value: '', label: '— Seleziona —' },
            ...availableSources.map((s) => ({ value: s.id, label: s.label })),
          ]}
        />
        <AiSelect
          label="Tono"
          value={tone}
          onChange={(e) => setTone(e.target.value as SocialTone)}
          options={TONES.map((t) => ({ value: t.value, label: t.label }))}
        />
        <AiSelect
          label="Modello immagine"
          value={imageModel}
          onChange={(e) => { setImageModel(e.target.value); setAiImageModelDefault(e.target.value); }}
          options={AI_IMAGE_MODELS.map((m) => ({ value: m.id, label: m.name }))}
          hint={AI_IMAGE_MODELS.find((m) => m.id === imageModel)?.description}
        />
        <div className="social-editor-actions">
          <AiGenerateButton
            isProcessing={isProcessing}
            loadingText="Generando…"
            onClick={() => { void handleGenerate(); }}
            disabled={!sourceId}
          >
            Genera 3 post
          </AiGenerateButton>
          <button type="button" className="social-reset-btn" onClick={reset} disabled={isProcessing}>
            Reset
          </button>
        </div>
      </section>
    </AIConsole>
  );

  return (
    <div className="social-editor">
      <header className="social-editor-header">
        <h1>Generatore post social</h1>
        <p>Genera 3 post coordinati (Instagram, Facebook, LinkedIn) a partire da un bigliettino, un volantino o un sito web della tua Collection.</p>
      </header>

      {!hasSources && (
        <div className="social-empty" role="status">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <p className="social-empty-title">Nessun documento sorgente</p>
          <p className="social-empty-text">
            Non hai ancora bigliettini, volantini o siti web salvati nella Collection. Creane uno, poi torna qui per generare post social coordinati a partire dal suo contenuto.
          </p>
          <div className="social-empty-ctas">
            <Link to="/app/card" className="social-empty-cta">Crea bigliettino</Link>
            <Link to="/app/flyer" className="social-empty-cta secondary">Crea volantino</Link>
            <Link to="/app/website" className="social-empty-cta secondary">Crea sito web</Link>
          </div>
        </div>
      )}

      {hasSources && (
        <div className={`social-editor-grid ${isMobileWorkspace ? '' : 'social-editor-grid--with-rail'}`}>
          <div className="social-results">
            {posts.length === 3 ? (
              <div className="social-posts-grid">
                {posts.map((post, i) => (
                  <article key={i} className={`social-post-card platform-${post.platform}`}>
                    <header className="social-post-head">
                      <span className="social-platform-badge">
                        <span className="social-platform-dot" aria-hidden="true" />
                        {post.platform}
                      </span>
                    </header>
                    {postImages[post.platform] ? (
                      <div className="social-post-image">
                        <img src={postImages[post.platform]} alt={`Immagine post ${post.platform}`} />
                        <button
                          type="button"
                          className="social-image-download"
                          onClick={() => downloadImage(post.platform, postImages[post.platform]!)}
                        >
                          Scarica immagine
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="social-image-btn"
                        onClick={() => handleGenerateImage(post.platform, post.imagePrompt)}
                        disabled={isProcessing || imageLoading !== null}
                      >
                        {imageLoading === post.platform ? 'Generazione immagine…' : 'Genera immagine'}
                      </button>
                    )}
                    <textarea
                      className="social-post-caption"
                      aria-label={`Modifica caption ${post.platform}`}
                      value={post.caption}
                      onChange={(e) => updatePost(post.platform, { caption: e.target.value })}
                      rows={Math.max(2, Math.ceil(post.caption.length / 60))}
                    />
                    {post.hashtags.length > 0 && (
                      <p className="social-post-hashtags">{post.hashtags.join(' ')}</p>
                    )}
                    <input
                      type="text"
                      className="social-post-image-prompt"
                      aria-label={`Prompt immagine ${post.platform}`}
                      placeholder="Prompt immagine (modifica per un visual diverso)"
                      value={post.imagePrompt ?? ''}
                      onChange={(e) => updatePost(post.platform, { imagePrompt: e.target.value })}
                    />
                    <footer className="social-post-foot">
                      <p className="social-post-tone">Tono: {post.tone}</p>
                      <button type="button" className="social-copy-btn" onClick={() => copyPost(post.caption)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Copia caption
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
            ) : (
              <p className="social-results-hint">
                {isMobileWorkspace
                  ? "Configura la generazione dal pannello AI in basso: l'AI legge il documento scelto e scrive 3 caption ottimizzate per piattaforma."
                  : "Configura la generazione dalla rail AI Assist a destra: l'AI legge il documento scelto e scrive 3 caption ottimizzate per piattaforma."}
              </p>
            )}
          </div>

          {/* Phase 14 (REQ-AI-002): rail a destra su desktop, FAB+bottom sheet su mobile (pattern card/website) */}
          {!isMobileWorkspace && aiConsolePanel}
        </div>
      )}

      {hasSources && isMobileWorkspace && (
        <>
          <CardAIFab
            onClick={() => setAiSheetOpen((v) => !v)}
            unreadCount={!aiSheetOpen && logs.length > 0 ? logs.length : 0}
          />
          <CardAIBottomSheet
            isOpen={aiSheetOpen}
            onClose={() => setAiSheetOpen(false)}
            ariaLabel="Pannello AI"
          >
            {aiConsolePanel}
          </CardAIBottomSheet>
        </>
      )}
    </div>
  );
}
