type Level = 'debug' | 'info' | 'warn' | 'error';

interface LogMeta {
  route?: string;
  sessionId?: string;
  toolName?: string;
  modelId?: string;
  [key: string]: unknown;
}

const IS_PROD = import.meta.env.PROD;
const ENDPOINT = '/api/logs';

function send(level: Level, msg: string, meta: LogMeta = {}): void {
  if (typeof window === 'undefined') return;
  if (IS_PROD && level === 'debug') return;
  if (level === 'error' || level === 'warn' || !IS_PROD) {
    const ts = new Date().toISOString();
    const line = `[${level.toUpperCase()}] ${msg}`;
    const tag = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[tag](line, Object.keys(meta).length ? meta : '');
  }
  const payload = JSON.stringify({
    level,
    msg,
    meta,
    url: window.location.pathname,
    ua: navigator.userAgent.slice(0, 120),
    t: Date.now(),
    ts: new Date().toISOString(),
  });
  try {
    const blob = new Blob([payload], { type: 'application/json' });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, blob);
    } else {
      fetch(ENDPOINT, { method: 'POST', body: payload, keepalive: true }).catch(() => {});
    }
  } catch {}
}

export const logger = {
  debug: (msg: string, meta?: LogMeta) => send('debug', msg, meta),
  info: (msg: string, meta?: LogMeta) => send('info', msg, meta),
  warn: (msg: string, meta?: LogMeta) => send('warn', msg, meta),
  error: (msg: string, meta?: LogMeta) => send('error', msg, meta),
};
