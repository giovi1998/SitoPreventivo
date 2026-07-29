import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('TB-027 dataService.getConfig LOCAL (VITE_REGISTRATION_ENABLED)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('ritorna registrationEnabled=true quando VITE_REGISTRATION_ENABLED=true', async () => {
    vi.stubEnv('VITE_REGISTRATION_ENABLED', 'true');
    const ds = (await import('../dataService')).default;
    const res = await ds.getConfig();
    expect(res.data.registrationEnabled).toBe(true);
    vi.unstubAllEnvs();
  });

  it('ritorna registrationEnabled=false quando VITE_REGISTRATION_ENABLED=false', async () => {
    vi.stubEnv('VITE_REGISTRATION_ENABLED', 'false');
    const ds = (await import('../dataService')).default;
    const res = await ds.getConfig();
    expect(res.data.registrationEnabled).toBe(false);
    vi.unstubAllEnvs();
  });

  it('default false con env vuoto', async () => {
    vi.stubEnv('VITE_REGISTRATION_ENABLED', '');
    const ds = (await import('../dataService')).default;
    const res = await ds.getConfig();
    expect(res.data.registrationEnabled).toBe(false);
    vi.unstubAllEnvs();
  });
});