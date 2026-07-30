import { useState, useCallback, useEffect } from 'react';

export interface LogEntry {
  ts: string;
  type: 'info' | 'success' | 'error';
  msg: string;
  cost?: string;
  detail?: unknown;
}

const LOG_KEY = (id: string) => `pq_crm_log:${id}`;
const MAX_LOG = 50;

async function copyTextToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* noop */ }
    document.body.removeChild(ta);
  }
}

function loadLog(customerId: string): LogEntry[] {
  try {
    const raw = sessionStorage.getItem(LOG_KEY(customerId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLog(customerId: string, entries: LogEntry[]) {
  try {
    sessionStorage.setItem(LOG_KEY(customerId), JSON.stringify(entries.slice(-MAX_LOG)));
  } catch { /* quota */ }
}

export function useCustomerLogger(customerId: string) {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [logCopied, setLogCopied] = useState(false);

  useEffect(() => {
    setLog(loadLog(customerId));
  }, [customerId]);

  const appendLog = useCallback((type: LogEntry['type'], msg: string, cost?: string, detail?: unknown) => {
    const ts = new Date().toLocaleTimeString('it-IT');
    setLog((prev) => {
      const next = [...prev.slice(-MAX_LOG + 1), { ts, type, msg, cost, detail }];
      saveLog(customerId, next);
      return next;
    });
  }, [customerId]);

  const formatLogText = useCallback(() => {
    return log
      .map((e) => {
        const icon = e.type === 'success' ? '✓' : e.type === 'error' ? '✗' : '▶';
        let line = `[${e.ts}] ${icon} ${e.msg}${e.cost ? ` ${e.cost}` : ''}`;
        if (e.detail) line += `\n  ${JSON.stringify(e.detail, null, 2).split('\n').join('\n  ')}`;
        return line;
      })
      .join('\n');
  }, [log]);

  const copyLog = useCallback(async () => {
    await copyTextToClipboard(formatLogText());
    setLogCopied(true);
    setTimeout(() => setLogCopied(false), 2000);
  }, [formatLogText]);

  const clearLog = useCallback(() => {
    setLog([]);
    setExpandedLog(null);
    try { sessionStorage.removeItem(LOG_KEY(customerId)); } catch { /* quota */ }
  }, [customerId]);

  return {
    log,
    expandedLog,
    setExpandedLog,
    logCopied,
    appendLog,
    copyLog,
    clearLog,
  };
}
