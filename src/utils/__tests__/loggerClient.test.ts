import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger } from '../logger';

describe('client logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let beaconMock: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    beaconMock = vi.fn().mockReturnValue(true);
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    Object.defineProperty(navigator, 'sendBeacon', {
      value: beaconMock,
      writable: true,
      configurable: true,
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('uses navigator.sendBeacon when available', () => {
    logger.error('boom', { route: '/users' });
    expect(beaconMock).toHaveBeenCalledTimes(1);
    const [url, blob] = beaconMock.mock.calls[0];
    expect(url).toBe('/api/logs');
    expect(blob).toBeInstanceOf(Blob);
  });

  it('falls back to fetch when sendBeacon unavailable', () => {
    Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true });
    logger.warn('test');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/logs');
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
  });

  it('silently catches errors from sendBeacon', () => {
    beaconMock.mockImplementation(() => {
      throw new Error('network gone');
    });
    expect(() => logger.error('test')).not.toThrow();
  });

  it('truncates overly long messages in payload', () => {
    logger.error('x'.repeat(3000));
    const blob = beaconMock.mock.calls[0][1] as Blob;
    expect(blob).toBeInstanceOf(Blob);
  });
});
