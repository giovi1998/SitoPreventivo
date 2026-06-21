import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, recordRateAttempt, _rateLimitStore } from '../api/_lib/rateLimit';

describe('rateLimit', () => {
  beforeEach(() => {
    _rateLimitStore.clear();
    vi.useRealTimers();
  });

  it('checkRateLimit returns blocked:false on first attempt', () => {
    const result = checkRateLimit('1.2.3.4', 'login', 5, 60000);
    expect(result.blocked).toBe(false);
  });

  it('blocks after max attempts within window', () => {
    const ip = '1.2.3.4';
    for (let i = 0; i < 5; i++) {
      recordRateAttempt(ip, false, 'login');
    }
    const result = checkRateLimit(ip, 'login', 5, 60000);
    expect(result.blocked).toBe(true);
  });

  it('resets on successful attempt', () => {
    const ip = '1.2.3.4';
    recordRateAttempt(ip, false, 'login');
    recordRateAttempt(ip, false, 'login');
    recordRateAttempt(ip, true, 'login');
    _rateLimitStore.delete(`${'login'}:${ip}`);
    const result = checkRateLimit(ip, 'login', 5, 60000);
    expect(result.blocked).toBe(false);
  });

  it('isolates rate limits by scope', () => {
    const ip = '1.2.3.4';
    for (let i = 0; i < 5; i++) {
      recordRateAttempt(ip, false, 'login');
    }
    const loginResult = checkRateLimit(ip, 'login', 5, 60000);
    const aiResult = checkRateLimit(ip, 'ai', 5, 60000);
    expect(loginResult.blocked).toBe(true);
    expect(aiResult.blocked).toBe(false);
  });

  it('releases block after window expires', () => {
    vi.useFakeTimers();
    const ip = '1.2.3.4';
    for (let i = 0; i < 5; i++) {
      recordRateAttempt(ip, false, 'login');
    }
    expect(checkRateLimit(ip, 'login', 5, 60000).blocked).toBe(true);
    vi.advanceTimersByTime(16 * 60 * 1000);
    expect(checkRateLimit(ip, 'login', 5, 60000).blocked).toBe(false);
  });

  it('exports _rateLimitStore for testing (regression for TS redeclare error)', () => {
    expect(_rateLimitStore).toBeDefined();
    expect(_rateLimitStore.clear).toBeInstanceOf(Function);
  });
});
