/**
 * Runtime environment detection helpers.
 */

export function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

/**
 * True only during Vite dev (npm run dev) on localhost.
 * A production build served on localhost will NOT trigger this,
 * preventing accidental unlocking of tier gates in deployed previews.
 */
export function isLocalDev(dev = import.meta.env?.DEV): boolean {
  return isLocalhost() && !!dev;
}