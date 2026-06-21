import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('server logger', () => {
  const originalEnv = process.env.VERCEL_ENV;
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    debugSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    process.env.VERCEL_ENV = originalEnv;
  });

  it('includes msg and meta in dev (non-JSON)', async () => {
    process.env.VERCEL_ENV = 'development';
    vi.resetModules();
    const { log } = await import('../../../server/lib/logger');
    log.info('test message', { user: 'a@b.com', count: 3 });
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const arg = infoSpy.mock.calls[0][0] as string;
    expect(arg).toContain('test message');
    expect(arg).toContain('"user":"a@b.com"');
  });

  it('emits single-line JSON in production', async () => {
    process.env.VERCEL_ENV = 'production';
    vi.resetModules();
    const { log } = await import('../../../server/lib/logger');
    log.warn('something', { route: '/users', code: 401 });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const arg = warnSpy.mock.calls[0][0] as string;
    expect(arg).not.toContain('\n');
    const parsed = JSON.parse(arg);
    expect(parsed.level).toBe('warn');
    expect(parsed.msg).toBe('something');
    expect(parsed.route).toBe('/users');
    expect(parsed.code).toBe(401);
    expect(parsed.t).toBeDefined();
  });

  it('respects log levels', async () => {
    process.env.VERCEL_ENV = 'development';
    vi.resetModules();
    const { log } = await import('../../../server/lib/logger');
    log.debug('dbg');
    log.error('err', { stack: 'x' });
    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('omits meta block when not provided', async () => {
    process.env.VERCEL_ENV = 'production';
    vi.resetModules();
    const { log } = await import('../../../server/lib/logger');
    log.info('plain');
    const parsed = JSON.parse(infoSpy.mock.calls[0][0] as string);
    expect(parsed.msg).toBe('plain');
    expect(parsed.level).toBe('info');
    expect(Object.keys(parsed)).toEqual(expect.arrayContaining(['t', 'level', 'msg']));
  });
});
