import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isLocalhost } from '../env';

const originalLocation = window.location;

beforeEach(() => {
  vi.stubGlobal('location', { ...originalLocation, hostname: 'localhost' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isLocalhost', () => {
  it('returns true for localhost', () => {
    window.location.hostname = 'localhost';
    expect(isLocalhost()).toBe(true);
  });

  it('returns true for 127.0.0.1', () => {
    window.location.hostname = '127.0.0.1';
    expect(isLocalhost()).toBe(true);
  });

  it('returns false for production domain', () => {
    window.location.hostname = 'quickbrand.vercel.app';
    expect(isLocalhost()).toBe(false);
  });
});