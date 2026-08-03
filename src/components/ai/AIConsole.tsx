import React, { useCallback, useEffect, useRef, useState } from 'react';
import AILogPanel from '../AILogPanel';
import AIProviderBadge from './AIProviderBadge';
import type { AILogEntry } from '../../ai/types';
import { getAiConsoleExpanded, setAiConsoleExpanded, type EditorKind } from '../../utils/uiPrefs';
import './AIConsole.css';

export type { AILogEntry };

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
  /**
   * Expand the console by default on desktop. Ignored when `editorKind` is
   * set and the user has a persisted preference in pq_ui:v1.
   */
  defaultExpanded?: boolean;
  /**
   * Editor identity: persiste lo stato expanded in pq_ui:v1 (REQ-AI-003).
   * Senza editorKind lo stato è solo in memoria.
   */
  editorKind?: EditorKind;
  /**
   * Prompt suggerito contestuale (REQ-AI-003): precompila la textarea e le
   * dà focus quando la console è espansa. Usato per l'AI-first entry su
   * documento vuoto.
   */
  suggestedPrompt?: string;
  /**
   * Nasconde la prompt textarea built-in (es. Social AI: la generazione non
   * ha prompt libero, i controlli stanno nei children). onSubmitPrompt non
   * viene mai chiamato in questo modo.
   */
  hidePrompt?: boolean;
  /** Optional className for the host */
  className?: string;
  /** TB-023: costo USD ultima operazione AI */
  lastCostUsd?: number;
  /** TB-023: costo USD totale cumulato AI */
  totalCostUsd?: number;
  /** TB-023: callback when provider changes via the badge */
  onProviderChange?: (providerId: string) => void;
  /** TB-023: vision toggle state */
  visionEnabled?: boolean;
  /** TB-023: selected provider/model id; used to decide if vision is available */
  providerId?: string;
  /** TB-023: toggle vision callback */
  onVisionToggle?: () => void;
  /** TB-023: auto-fallback toggle state */
  autoFallbackEnabled?: boolean;
  /** TB-023: toggle auto-fallback callback */
  onAutoFallbackToggle?: () => void;
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
  editorKind,
  suggestedPrompt,
  hidePrompt = false,
  className = '',
  lastCostUsd,
  totalCostUsd,
  onProviderChange,
  visionEnabled,
  providerId,
  onVisionToggle,
  onAutoFallbackToggle,
  autoFallbackEnabled,
}: AIConsoleProps): React.ReactElement {
  const [expanded, setExpanded] = useState<boolean>(() => {
    if (editorKind) {
      const persisted = getAiConsoleExpanded(editorKind);
      if (persisted !== undefined) return persisted;
    }
    return defaultExpanded;
  });
  const [prompt, setPrompt] = useState(suggestedPrompt ?? '');
  const [logOpen, setLogOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevLogsLength = useRef(0);

  // Auto-apri log panel quando arrivano nuovi log
  useEffect(() => {
    if (logs.length > prevLogsLength.current && logs.length > 0) {
      setLogOpen(true);
    }
    prevLogsLength.current = logs.length;
  }, [logs.length]);

  // AI-first entry (REQ-AI-003): prompt suggerito + focus quando espansa.
  useEffect(() => {
    if (expanded && suggestedPrompt && textareaRef.current) {
      setPrompt((current) => (current.trim() ? current : suggestedPrompt));
      textareaRef.current.focus();
    }
    // solo al mount / cambio suggestedPrompt
  }, [suggestedPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpanded = useCallback(() => {
    setExpanded((v) => {
      const next = !v;
      if (editorKind) setAiConsoleExpanded(editorKind, next);
      return next;
    });
  }, [editorKind]);

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
        onClick={toggleExpanded}
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
            <div className="ai-console__header-left">
              <span className="ai-console__title">{title}</span>
              {isProcessing && <span className="ai-console__status">AI in elaborazione…</span>}
            </div>
            <div className="ai-console__header-right">
              {onVisionToggle != null && providerIdSupportsVision(providerId) && (
                <button
                  type="button"
                  className={`ai-console__header-btn ${visionEnabled ? 'is-active' : ''}`}
                  onClick={onVisionToggle}
                  title={visionEnabled ? 'Vision AI attiva: screenshot inviato al modello' : 'Vision AI spenta'}
                  aria-pressed={visionEnabled}
                >
                  {visionEnabled ? 'Vision ✓' : 'Vision ✕'}
                </button>
              )}
              <AIProviderBadge lastCostUsd={lastCostUsd} totalCostUsd={totalCostUsd} onProviderChange={onProviderChange} />
            </div>
          </header>

          {quickActions && <div className="ai-console__quick">{quickActions}</div>}

          {onAutoFallbackToggle != null && (
            <div className="ai-console__toggles">
              <label className="ai-console__toggle-row" title="Se Ollama fallisce, riprova automaticamente con DeepSeek">
                <input
                  type="checkbox"
                  checked={autoFallbackEnabled}
                  onChange={onAutoFallbackToggle}
                  aria-label="Fallback automatico"
                />
                <span>Auto-fallback</span>
              </label>
            </div>
          )}

          {!hidePrompt && (
            <form className="ai-console__prompt" onSubmit={handleSubmit}>
              <textarea
                ref={textareaRef}
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
          )}

          {children && <div className="ai-console__children">{children}</div>}

          <div className={`ai-console__log ${logOpen ? 'ai-console__log--open' : ''}`}>
            <button
              type="button"
              className="ai-console__log-toggle"
              onClick={() => setLogOpen((v) => !v)}
              aria-expanded={logOpen}
            >
              <span>Log AI</span>
              <span className="ai-console__log-count">{logs.length}</span>
              <span className={`ai-console__log-chevron ${logOpen ? 'ai-console__log-chevron--open' : ''}`}>▾</span>
            </button>
            {logOpen && <AILogPanel logs={logs} isProcessing={isProcessing} totalCostUsd={totalCostUsd} />}
          </div>
        </div>
      )}
    </div>
  );
}

function providerIdSupportsVision(providerId?: string): boolean {
  if (!providerId) return false;
  return providerId === 'ollama-minimax-m3' || providerId.startsWith('gemini-');
}
