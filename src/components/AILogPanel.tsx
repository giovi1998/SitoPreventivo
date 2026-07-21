import React from 'react';
import type { AILogEntry } from '../ai/types';
import { formatCostUsd } from '../ai/providerPricing';
import './AILogPanel.css';

interface AILogPanelProps {
  logs: AILogEntry[];
  isProcessing: boolean;
  /**
   * Phase 13b (REQ-DS-007): 'dark' (default) = terminale scuro, usato nella
   * AI Console rail (signature element, resta scuro anche in light mode).
   * 'themed' = segue il tema globale (surface/ink/line), per usi fuori rail.
   */
  theme?: 'dark' | 'themed';
  /** TB-023: costo USD totale cumulato (mostrato nell'header). */
  totalCostUsd?: number;
}

const TYPE_ICONS: Record<AILogEntry['type'], string> = {
  info: 'ℹ',
  success: '✨',
  error: '⚠',
  tool: '⚙',
  stream: '🤖',
};

const TYPE_LABELS: Record<AILogEntry['type'], string> = {
  info: 'Info',
  success: 'OK',
  error: 'Errore',
  tool: 'Tool',
  stream: 'Stream',
};

export default function AILogPanel({ logs, isProcessing, theme = 'dark', totalCostUsd }: AILogPanelProps): React.ReactElement {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [fullscreenOpen, setFullscreenOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const visibleLogs = logs.slice(-30);

  const handleCopy = React.useCallback(async () => {
    const text = logs
      .map((l) => {
        let line = `[${l.time}] ${TYPE_ICONS[l.type]} ${l.msg}${l.durationMs ? ` (${l.durationMs}ms)` : ''}`;
        if (l.detail) line += `\n  ${l.detail.split('\n').join('\n  ')}`;
        return line;
      })
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }, [logs]);

  React.useEffect(() => {
    if (!fullscreenOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreenOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreenOpen]);

  return (
    <>
      <div className={`ai-log-panel${theme === 'themed' ? ' ai-log-panel--themed' : ''}`} role="log" aria-label="Log attività AI" aria-live="polite">
        <div className="ai-log-header">
          <span className="ai-log-count">
            {logs.length === 0 ? 'Nessuna attività' : `${logs.length} eventi`}
            {isProcessing && <span className="ai-log-pulse" aria-label="In elaborazione" />}
            {totalCostUsd !== undefined && totalCostUsd >= 0 && (
              <span className="ai-log-cost" aria-label={`Costo totale ${formatCostUsd(totalCostUsd)}`}>
                {formatCostUsd(totalCostUsd)}
              </span>
            )}
          </span>
          <div className="ai-log-actions">
            <button
              type="button"
              className="ai-log-btn"
              onClick={handleCopy}
              disabled={logs.length === 0}
              title="Copia log"
              aria-label="Copia log"
            >
              {copied ? '✓' : '⧉'}
            </button>
            <button
              type="button"
              className="ai-log-btn"
              onClick={() => setFullscreenOpen(true)}
              disabled={logs.length === 0}
              title="Apri log completo"
              aria-label="Apri log completo"
            >
              ⤢
            </button>
          </div>
        </div>

        <div className="ai-log-list">
          {logs.length === 0 && (
            <div className="ai-log-empty">Nessuna attività ancora...</div>
          )}
          {visibleLogs.map((log) => {
            const isOpen = expandedId === log.id;
            return (
              <div
                key={log.id}
                className={`ai-log-entry ai-log-${log.type}${log.status === 'pending' ? ' pending' : ''}`}
              >
                <button
                  type="button"
                  className="ai-log-row"
                  onClick={() => setExpandedId(isOpen ? null : log.id)}
                  aria-expanded={isOpen}
                >
                  <span className="ai-log-time">{log.time}</span>
                  <span className="ai-log-icon" aria-hidden="true">
                    {TYPE_ICONS[log.type]}
                  </span>
                  <span className="ai-log-msg">{log.msg}</span>
                  {log.durationMs !== undefined && (
                    <span className="ai-log-duration">{log.durationMs}ms</span>
                  )}
                  {log.tokens !== undefined && (
                    <span className="ai-log-tokens">{log.tokens.total} tk</span>
                  )}
                  {log.costUsd !== undefined && log.costUsd >= 0 && (
                    <span className="ai-log-cost-inline">{formatCostUsd(log.costUsd)}</span>
                  )}
                  {log.hasImage && <span className="ai-log-image" aria-label="include immagine">🖼️</span>}
                  {(log.detail || log.imagePreviewBase64) && (
                    <span className="ai-log-expand" aria-hidden="true">
                      {isOpen ? '▾' : '▸'}
                    </span>
                  )}
                </button>
                  {isOpen && (log.detail || log.imagePreviewBase64) && (
                    <pre className="ai-log-detail">
                      {log.modelId && <div className="ai-log-detail-meta">Model: {log.modelId}</div>}
                      {log.costUsd !== undefined && log.costUsd >= 0 && <div className='ai-log-detail-meta'>Cost: {formatCostUsd(log.costUsd)}</div>}
                      {log.requestId && <div className="ai-log-detail-meta">Request: {log.requestId}</div>}
                      {log.imagePreviewBase64 && (
                        <div className="ai-log-preview">
                          <img
                            src={log.imagePreviewBase64}
                            alt="Anteprima allegata al prompt"
                            className="ai-log-preview-img"
                            loading="lazy"
                          />
                        </div>
                      )}
                      {log.detail}
                    </pre>
                  )}
              </div>
            );
          })}
        </div>
      </div>

      {fullscreenOpen && (
        <div
          className="ai-log-fullscreen-backdrop"
          onClick={() => setFullscreenOpen(false)}
          role="presentation"
        >
          <div
            className="ai-log-fullscreen"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Log completo"
          >
            <div className="ai-log-fullscreen-head">
              <h3>Log AI completo</h3>
              <div className="ai-log-actions">
                <button
                  type="button"
                  className="ai-log-btn"
                  onClick={handleCopy}
                  title="Copia log"
                  aria-label="Copia log"
                >
                  {copied ? '✓ Copiato' : '⧉ Copia'}
                </button>
                <button
                  type="button"
                  className="ai-log-btn"
                  onClick={() => setFullscreenOpen(false)}
                  title="Chiudi (Esc)"
                  aria-label="Chiudi"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="ai-log-list ai-log-list-fullscreen">
              {logs.map((log) => {
                const isOpen = expandedId === log.id;
                return (
                  <div
                    key={log.id}
                    className={`ai-log-entry ai-log-${log.type}${log.status === 'pending' ? ' pending' : ''}`}
                  >
                    <button
                      type="button"
                      className="ai-log-row"
                      onClick={() => setExpandedId(isOpen ? null : log.id)}
                      aria-expanded={isOpen}
                    >
                      <span className="ai-log-time">{log.time}</span>
                      <span className="ai-log-type-label">{TYPE_LABELS[log.type]}</span>
                      <span className="ai-log-icon" aria-hidden="true">
                        {TYPE_ICONS[log.type]}
                      </span>
                      <span className="ai-log-msg">{log.msg}</span>
                      {log.durationMs !== undefined && (
                        <span className="ai-log-duration">{log.durationMs}ms</span>
                      )}
                      {(log.detail || log.imagePreviewBase64) && (
                        <span className="ai-log-expand" aria-hidden="true">
                          {isOpen ? '▾' : '▸'}
                        </span>
                      )}
                    </button>
                    {isOpen && (log.detail || log.imagePreviewBase64) && (
                      <pre className="ai-log-detail">
                        {log.modelId && <div className="ai-log-detail-meta">Model: {log.modelId}</div>}
                      {log.costUsd !== undefined && log.costUsd >= 0 && <div className='ai-log-detail-meta'>Cost: {formatCostUsd(log.costUsd)}</div>}
                        {log.requestId && <div className="ai-log-detail-meta">Request: {log.requestId}</div>}
                        {log.imagePreviewBase64 && (
                          <div className="ai-log-preview">
                            <img
                              src={log.imagePreviewBase64}
                              alt="Anteprima allegata al prompt"
                              className="ai-log-preview-img"
                              loading="lazy"
                            />
                          </div>
                        )}
                        {log.detail}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
