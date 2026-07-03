import React from 'react';
import AILogPanel from '../AILogPanel';
import type { Flyer, FlyerTone } from '../../utils/documentSchemas';
import { FLYER_BRIEF_MAX } from '../../utils/documentSchemas';
import type { useAIFlyer } from '../../hooks/useAIFlyer';

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  extra?: React.ReactNode;
  badge?: string | number;
  className?: string;
}

function Section({ title, defaultOpen = true, children, extra, badge, className }: SectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className={`collapsible ${open ? 'open' : ''} ${className || ''}`}>
      <div className="collapsible-head" onClick={() => setOpen(!open)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open); } }}>
        <span className="collapsible-title">
          {title}
          {badge !== undefined && <span className="collapsible-badge">{badge}</span>}
        </span>
        <div className="collapsible-head-right">
          {extra && <span onClick={(e) => e.stopPropagation()}>{extra}</span>}
          <svg className="collapsible-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
        </div>
      </div>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

const SUGGESTED_PROMPTS: string[] = [
  'Sagra del paese, 15-17 agosto, ingresso gratis, musica dal vivo, cucina tipica',
  'Cena di degustazione, 5 portate, venerdì 20:30, posti limitati',
  'Apertura nuovo negozio, via Roma 23, sconto 10% il giorno dell\'inaugurazione',
  'Salone bellezza, promo taglio+piega -20%, valido solo questo weekend',
  'Notte bianca in centro, negozi aperti fino a mezzanotte, musica dal vivo',
];

const QUICK_REFINE: Array<{ action: 'simplify' | 'formal' | 'young' | 'urgent'; label: string; icon: string; description: string }> = [
  { action: 'simplify', label: 'Semplifica', icon: '✂️', description: 'Riduci il body, mantieni headline' },
  { action: 'formal', label: 'Più formale', icon: '🎩', description: 'Riformula in tono professionale' },
  { action: 'young', label: 'Più giovanile', icon: '⚡', description: 'Riformula in tono diretto e fresco' },
  { action: 'urgent', label: 'Più urgenza', icon: '⏰', description: 'Aggiungi scarsità nel body e nella CTA' },
];

interface FlyerAiPanelProps {
  aiPrompt: string;
  setAiPrompt: (v: string) => void;
  aiModel: string;
  setAiModel: (v: string) => void;
  aiTone: FlyerTone;
  setAiTone: (v: FlyerTone) => void;
  ai: ReturnType<typeof useAIFlyer>;
  flyer: Flyer;
  debouncedFlyer: Flyer;
  hasCopy: boolean;
  onGenerate: () => void;
  onRefine: (action: 'simplify' | 'formal' | 'young' | 'urgent') => void;
  onReset: () => void;
  onCollapse: () => void;
}

export function FlyerAiPanel({
  aiPrompt, setAiPrompt, aiModel, setAiModel, aiTone, setAiTone, ai,
  onGenerate, onRefine, onReset, hasCopy, onCollapse,
}: FlyerAiPanelProps): React.ReactElement {
  return (
    <section className="panel ai-panel" aria-label="AI copy del volantino">
      <div className="panel-kicker">
        <span>✨ AI copy</span>
        <button className="panel-toggle" onClick={onCollapse} title="Collassa" aria-label="Collassa AI">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
      </div>
      <Section title="Genera copy" defaultOpen={true}>
        <div className="stack">
          <label>Modello
            <select value={aiModel} onChange={(e) => setAiModel(e.target.value)}>
              {ai.availableModels.length > 0 ? ai.availableModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>) : <option value="deepseek-chat">DeepSeek Chat</option>}
            </select>
          </label>
          <label>Tono
            <select value={aiTone} onChange={(e) => setAiTone(e.target.value as FlyerTone)}>
              <option value="formale">Formale</option>
              <option value="giovanile">Giovanile</option>
              <option value="tecnico">Tecnico</option>
            </select>
          </label>
          <label>Brief ({FLYER_BRIEF_MAX - aiPrompt.length} caratteri)
            <textarea className="card-ai-textarea" value={aiPrompt} maxLength={FLYER_BRIEF_MAX} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Es. Sagra del paese, 15-17 agosto, ingresso gratis, musica dal vivo" rows={3} aria-label="Brief AI" />
          </label>
          <button type="button" className="card-action-primary" onClick={onGenerate} disabled={ai.isProcessing || !aiPrompt.trim()}>
            {ai.isProcessing ? 'Generazione…' : '✨ Genera copy'}
          </button>
        </div>
      </Section>
      <Section title="Suggerimenti" defaultOpen={true}>
        <div className="stack" style={{ gap: 4 }}>
          {SUGGESTED_PROMPTS.map((p) => (
            <button key={p} type="button" className="flyer-ai-chip" onClick={() => setAiPrompt(p)} disabled={ai.isProcessing}>{p}</button>
          ))}
        </div>
      </Section>
      <Section title="Raffina copy" defaultOpen={true}>
        <div className="flyer-ai-quick-grid-inner">
          {QUICK_REFINE.map((q) => (
            <button key={q.action} type="button" className="flyer-ai-quick-card" onClick={() => onRefine(q.action)} disabled={ai.isProcessing || !hasCopy} aria-label={`${q.label}: ${q.description}`} title={q.description}>
              <span className="flyer-ai-quick-icon" aria-hidden="true">{q.icon}</span>
              <span className="flyer-ai-quick-label">{q.label}</span>
            </button>
          ))}
        </div>
        {!hasCopy && <p style={{ fontSize: '.78rem', color: 'var(--muted)', margin: '6px 0 0' }}>ℹ️ Genera prima il copy o compila manualmente i campi.</p>}
      </Section>
      <Section title="Log AI" defaultOpen={true} extra={<button type="button" className="card-ai-reset" onClick={onReset} disabled={ai.isProcessing}>↻ Nuova sessione</button>}>
        <AILogPanel logs={ai.logs} isProcessing={ai.isProcessing} />
      </Section>
    </section>
  );
}

export default FlyerAiPanel;
