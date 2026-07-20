import React, { useState, useMemo, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import type { BusinessCard, Flyer } from '../utils/documentSchemas';
import { useAISocial } from '../hooks/useAISocial';
import type { SocialSource, SocialTone } from '../ai/prompts/socialSystem';
import { useToast } from '../hooks/useToast';
import AIConsole from './ai/AIConsole';
import { AiSelect, AiGenerateButton } from './ai-ui';
import { AuthContext } from '../contexts';
import dataService from '../utils/dataService';
import './SocialEditor.css';

interface Props {
  userEmail: string;
  cardDocuments: BusinessCard[];
  flyerDocuments: Flyer[];
}

const TONES: { value: SocialTone; label: string }[] = [
  { value: 'professional', label: 'Professionale' },
  { value: 'casual', label: 'Informale' },
  { value: 'promotional', label: 'Promozionale' },
];

export default function SocialEditor({ userEmail, cardDocuments, flyerDocuments }: Props) {
  const { generate, posts, isProcessing, logs, reset, lastCostUsd } = useAISocial(userEmail);
  const { addToast } = useToast();
  const { user } = useContext(AuthContext);
  const [tier, setTier] = useState<'free' | 'unlocked'>('free');

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
  const [sourceType, setSourceType] = useState<'card' | 'flyer'>('card');
  const [sourceId, setSourceId] = useState<string>('');
  const [tone, setTone] = useState<SocialTone>('promotional');

  const hasSources = cardDocuments.length > 0 || flyerDocuments.length > 0;

  const availableSources = useMemo(() => {
    return sourceType === 'card'
      ? cardDocuments.map((c) => ({ id: c.id, label: c.title || c.front.company || c.front.name || c.id }))
      : flyerDocuments.map((f) => ({ id: f.id, label: f.title || f.content.headline || f.id }));
  }, [sourceType, cardDocuments, flyerDocuments]);

  const handleGenerate = async () => {
    if (!sourceId) {
      addToast('info', 'Seleziona un documento sorgente dalla collection.');
      return;
    }
    const doc = sourceType === 'card'
      ? cardDocuments.find((c) => c.id === sourceId)
      : flyerDocuments.find((f) => f.id === sourceId);
    if (!doc) {
      addToast('error', 'Documento non trovato.');
      return;
    }
    const source: SocialSource = sourceType === 'card'
      ? {
          type: 'card',
          sourceId: doc.id,
          data: {
            name: (doc as BusinessCard).front.name,
            title: (doc as BusinessCard).front.title,
            company: (doc as BusinessCard).front.company,
            accentColor: (doc as BusinessCard).style.accentColor,
            services: (doc as BusinessCard).back.services,
          },
        }
      : {
          type: 'flyer',
          sourceId: doc.id,
          data: {
            headline: (doc as Flyer).content.headline,
            subheadline: (doc as Flyer).content.subheadline,
            body: (doc as Flyer).content.body,
            ctaLabel: (doc as Flyer).content.cta.label,
          },
        };
    try {
      const result = await generate(source, tone);
      if (result.applied) {
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

  return (
    <div className="social-editor">
      <header className="social-editor-header">
        <h1>Generatore post social</h1>
        <p>Genera 3 post coordinati (Instagram, Facebook, LinkedIn) a partire da un bigliettino o un volantino della tua Collection.</p>
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
            Non hai ancora bigliettini o volantini salvati nella Collection. Creane uno, poi torna qui per generare post social coordinati a partire dal suo contenuto.
          </p>
          <div className="social-empty-ctas">
            <Link to="/app/card" className="social-empty-cta">Crea bigliettino</Link>
            <Link to="/app/flyer" className="social-empty-cta secondary">Crea volantino</Link>
          </div>
        </div>
      )}

      {hasSources && (
        <div className="social-editor-grid social-editor-grid--with-rail">
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
                    <p className="social-post-caption">{post.caption}</p>
                    {post.hashtags.length > 0 && (
                      <p className="social-post-hashtags">{post.hashtags.join(' ')}</p>
                    )}
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
                Configura la generazione dalla rail AI Assist a destra: l'AI legge il documento scelto e scrive 3 caption ottimizzate per piattaforma.
              </p>
            )}
          </div>

          {/* Phase 14 (REQ-AI-002): un solo modello — l'AI sta nella rail a destra */}
          <AIConsole
            editorKind="social"
            isProcessing={isProcessing}
            logs={logs}
            tier={tier}
            onSubmitPrompt={() => {}}
            hidePrompt
            lastCostUsd={lastCostUsd}
          >
            <section className="social-editor-form" aria-label="Configurazione post">
              <h2 className="social-form-title">Configura generazione</h2>
              <p className="social-form-hint">L'AI legge il contenuto del documento scelto e scrive 3 caption ottimizzate per piattaforma.</p>
              <AiSelect
                label="Tipo sorgente"
                value={sourceType}
                onChange={(e) => { setSourceType(e.target.value as 'card' | 'flyer'); setSourceId(''); }}
                options={[
                  { value: 'card', label: 'Bigliettino' },
                  { value: 'flyer', label: 'Volantino' },
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
              <div className="social-editor-actions">
                <AiGenerateButton
                  isProcessing={isProcessing}
                  loadingText="Generando…"
                  onClick={handleGenerate}
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
        </div>
      )}
    </div>
  );
}
