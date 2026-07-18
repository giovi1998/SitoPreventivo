import React, { useCallback, useState } from 'react';
import AILogPanel from '../AILogPanel';
import type { AILogEntry } from '../../ai/types';
import './AIConsole.css';

export interface AIConsoleProps {
  /** Header title. Defaults to "AI Assist" */
  title?: string;
  /** True while the AI is generating/streaming */
  isProcessing: boolean;
  /** AI log entries */
  logs: AILogEntry[];
  /** User tier: free users see the AiTierGuard prompt */
  tier: 'free' | 'unlocked';
  /** Called when the user submits the prompt textarea */
  onSubmitPrompt: (text: string) => void;
  /** Optional quick-action chips/buttons rendered under the prompt */
  quickActions?: React.ReactNode;
  /** Module-specific AI sections (e.g. "Sfondo AI") */
  children?: React.ReactNode;
  /** Expand the console by default on desktop */
  defaultExpanded?: boolean;
  /** Optional className for the host */
  className?: string;
}

export default function AIConsole({
  title = 'AI Assist',
  isProcessing,
  logs,
  tier,
  onSubmitPrompt,
  quickActions,
  children,
  defaultExpanded = true,
  className = '',
}: AIConsoleProps): React.ReactElement {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [prompt, setPrompt] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = prompt.trim();
      if (!trimmed) return;
      onSubmitPrompt(trimmed);
      setPrompt('');
    },
    [prompt, onSubmitPrompt]
  );

  return (
    <div className={`ai-console ${expanded ? 'ai-console--expanded' : 'ai-console--collapsed'} ${className}`}>
      <button
        type="button"
        className="ai-console__toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? 'Comprimi AI Assist' : 'Espandi AI Assist'}
        aria-expanded={expanded}
      >
        {!expanded && (
          <span className="ai-console__toggle-label">
            {title}
            {isProcessing && <span className="ai-console__pulse" />}
          </span>
        )}
        <span className={`ai-console__chevron ${expanded ? 'ai-console__chevron--left' : ''}`}>›</span>
      </button>

      {expanded && (
        <div className="ai-console__panel">
          <header className="ai-console__header">
            <span className="ai-console__title">{title}</span>
            {isProcessing && <span className="ai-console__status">AI in elaborazione…</span>}
          </header>

          <form className="ai-console__prompt" onSubmit={handleSubmit}>
            <textarea
              className="ai-console__textarea"
              placeholder={
                tier === 'free'
                  ? 'Passa a Pro per generare con l\'AI…'
                  : 'Descrivi cosa vuoi creare, l\'AI costruisce tutto.'
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              disabled={tier === 'free'}
            />
            {tier === 'free' && (
              <p className="ai-console__guard">
                L'AI richiede il piano Pro. {" "}
                <a href="mailto:info@quickbrand.it?subject=Sblocca%20Quickbrand%20Pro">Sblocca ora</a>
              </p>
            )}
            <button
              type="submit"
              className="ai-console__submit"
              disabled={!prompt.trim() || isProcessing || tier === 'free'}
            >
              Genera
            </button>
          </form>

          {quickActions && <div className="ai-console__quick">{quickActions}</div>}

          {children}

          <div className="ai-console__log">
            <AILogPanel logs={logs} isProcessing={isProcessing} />
          </div>

          <footer className="ai-console__footer">
            <span className="ai-console__badge">Powered by DeepSeek · Gemini</span>
          </footer>
        </div>
      )}
    </div>
  );
}
