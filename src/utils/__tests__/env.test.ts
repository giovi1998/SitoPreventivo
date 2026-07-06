import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isLocalhost, isLocalDev } from '../env';

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

describe('isLocalDev', () => {
  it('returns true when hostname is localhost and dev=true', () => {
    window.location.hostname = 'localhost';
    expect(isLocalDev(true)).toBe(true);
  });

  it('returns false when hostname is localhost but dev=false (production build)', () => {
    window.location.hostname = 'localhost';
    expect(isLocalDev(false)).toBe(false);
  });

  it('returns false on production domain even if dev=true', () => {
    window.location.hostname = 'quickbrand.vercel.app';
    expect(isLocalDev(true)).toBe(false);
  });
});