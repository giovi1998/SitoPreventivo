type Level = 'debug' | 'info' | 'warn' | 'error';

const COLORS: Record<Level, string> = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

const IS_PROD = process.env.VERCEL_ENV === 'production';

function fmt(level: Level, msg: string, meta?: Record<string, unknown>): string {
  const entry = {
    t: new Date().toISOString(),
    level,
    msg,
    ...meta,
  };

  if (IS_PROD) {
    return JSON.stringify(entry);
  }

  const color = COLORS[level];
  const metaStr = meta && Object.keys(meta).length > 0
    ? ` ${DIM}${JSON.stringify(meta)}${RESET}`
    : '';
  return `${color}[${level.toUpperCase()}]${RESET} ${msg}${metaStr}`;
}

export const log = {
  debug: (msg: string, meta?: Record<string, unknown>) => console.debug(fmt('debug', msg, meta)),
  info: (msg: string, meta?: Record<string, unknown>) => console.info(fmt('info', msg, meta)),
  warn: (msg: string, meta?: Record<string, unknown>) => console.warn(fmt('warn', msg, meta)),
  error: (msg: string, meta?: Record<string, unknown>) => console.error(fmt('error', msg, meta)),
};

export type { Level };
