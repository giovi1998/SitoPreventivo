import React from 'react';
import type { LogEntry } from '../../hooks/useCustomerLogger';

interface CustomerAiLogPanelProps {
  log: LogEntry[];
  expandedLog: number | null;
  setExpandedLog: (idx: number | null) => void;
  logCopied: boolean;
  copyLog: () => void;
  clearLog: () => void;
}

export function CustomerAiLogPanel({
  log,
  expandedLog,
  setExpandedLog,
  logCopied,
  copyLog,
  clearLog,
}: CustomerAiLogPanelProps): React.ReactElement {
  return (
    <section className="crm-ai-log" data-testid="crm-ai-log">
      <div className="crm-ai-log-head">
        <span>Registro operazioni AI</span>
        {log.length > 0 && (
          <div className="crm-ai-log-actions">
            <button type="button" className="crm-ai-log-btn" onClick={copyLog} data-testid="crm-log-copy">
              {logCopied ? '✓ Copiato' : 'Copia'}
            </button>
            <button type="button" className="crm-ai-log-btn" onClick={clearLog} data-testid="crm-log-clear">
              Cancella
            </button>
          </div>
        )}
      </div>
      {log.length === 0 ? (
        <div className="crm-ai-log-empty">Nessuna operazione. Lancia research / AI fill / auto-build per vedere qui.</div>
      ) : (
        <div className="crm-ai-log-body">
          {log.map((e, i) => (
            <div
              key={i}
              className={`crm-ai-log-row crm-log-${e.type}`}
              onClick={() => setExpandedLog(expandedLog === i ? null : i)}
              style={{ cursor: e.detail ? 'pointer' : 'default' }}
              data-testid={`crm-log-row-${i}`}
            >
              <span className="crm-log-ts">{e.ts}</span>
              <span className="crm-log-icon">{e.type === 'success' ? '✓' : e.type === 'error' ? '✗' : '▶'}</span>
              <span className="crm-log-msg">{e.msg}</span>
              {e.cost && <span className="crm-log-cost">{e.cost}</span>}
              {expandedLog === i && e.detail ? (
                <pre className="crm-log-detail" data-testid="crm-log-detail">{JSON.stringify(e.detail, null, 2)}</pre>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default CustomerAiLogPanel;
