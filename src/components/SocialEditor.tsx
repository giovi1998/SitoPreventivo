import React, { useState, useMemo } from 'react';
import type { BusinessCard, Flyer } from '../utils/documentSchemas';
import { useAISocial } from '../hooks/useAISocial';
import type { SocialSource, SocialTone } from '../ai/prompts/socialSystem';
import { useToast } from '../hooks/useToast';
import AILogPanel from './AILogPanel';

interface Props {
  userEmail: string;
  cardDocuments: BusinessCard[];
  flyerDocuments: Flyer[];
}

const TONES: SocialTone[] = ['professional', 'casual', 'promotional'];

export default function SocialEditor({ userEmail, cardDocuments, flyerDocuments }: Props) {
  const { generate, posts, isProcessing, logs, reset } = useAISocial(userEmail);
  const { addToast } = useToast();
  const [sourceType, setSourceType] = useState<'card' | 'flyer'>('card');
  const [sourceId, setSourceId] = useState<string>('');
  const [tone, setTone] = useState<SocialTone>('promotional');

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
        <h1>Social AI</h1>
        <p>Genera 3 post coordinati (Instagram, Facebook, LinkedIn) a partire da un bigliettino o volantino.</p>
      </header>

      {cardDocuments.length === 0 && flyerDocuments.length === 0 && (
        <div className="social-empty" role="status">
          <p>Nessun bigliettino o volantino salvato nella tua Collection.</p>
          <p>Crea prima un bigliettino (tab Bigliettini) o un volantino (tab Volantini), poi torna qui per generare post social coordinati.</p>
        </div>
      )}

      {(cardDocuments.length > 0 || flyerDocuments.length > 0) && (
        <div className="social-editor-form">
        <label>
          Tipo sorgente
          <select value={sourceType} onChange={(e) => { setSourceType(e.target.value as 'card' | 'flyer'); setSourceId(''); }}>
            <option value="card">Bigliettino</option>
            <option value="flyer">Volantino</option>
          </select>
        </label>
        <label>
          Documento sorgente
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            <option value="">— Seleziona —</option>
            {availableSources.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
        <label>
          Tono
          <select value={tone} onChange={(e) => setTone(e.target.value as SocialTone)}>
            {TONES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <div className="social-editor-actions">
          <button type="button" onClick={handleGenerate} disabled={isProcessing || !sourceId}>
            {isProcessing ? 'Generando…' : 'Genera 3 post'}
          </button>
          <button type="button" onClick={reset} disabled={isProcessing}>
            Reset
          </button>
        </div>
      </div>
      )}

      {posts.length === 3 && (
        <div className="social-posts-grid">
          {posts.map((post, i) => (
            <div key={i} className={`social-post-card platform-${post.platform}`}>
              <h3>{post.platform}</h3>
              <p className="social-post-caption">{post.caption}</p>
              {post.hashtags.length > 0 && (
                <p className="social-post-hashtags">{post.hashtags.join(' ')}</p>
              )}
              <p className="social-post-tone">Tono: {post.tone}</p>
              <button type="button" onClick={() => copyPost(post.caption)}>
                Copia caption
              </button>
            </div>
          ))}
        </div>
      )}

      <AILogPanel logs={logs} isProcessing={isProcessing} />
    </div>
  );
}