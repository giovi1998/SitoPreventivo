const rateLimitStore = new Map<string, { count: number; firstAttempt: number }>();

export function checkRateLimit(
  ip: string,
  scope: string = 'login',
  max: number = 5,
  windowMs: number = 15 * 60 * 1000
): { blocked: boolean } {
  const key = `${scope}:${ip}`;
  const record = rateLimitStore.get(key);
  const now = Date.now();
  if (record) {
    if (now - record.firstAttempt < windowMs) {
      if (record.count >= max) return { blocked: true };
      return { blocked: false };
    }
    rateLimitStore.delete(key);
  }
  return { blocked: false };
}

export function recordRateAttempt(ip: string, success: boolean, scope: string = 'login'): void {
  const key = `${scope}:${ip}`;
  if (success) {
    rateLimitStore.delete(key);
  } else {
    const record = rateLimitStore.get(key);
    const now = Date.now();
    if (record && now - record.firstAttempt < 15 * 60 * 1000) {
      record.count++;
      rateLimitStore.set(key, record);
    } else {
      rateLimitStore.set(key, { count: 1, firstAttempt: now });
    }
  }
}

export type { rateLimitStore as _rateLimitStore };
export const _rateLimitStore = rateLimitStore;
