import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compileClientPrompt, getRemoteSystemPrompt, RESOLVED_LABEL } from '../remotePrompt';

beforeEach(() => {
  vi.stubGlobal('fetch', undefined as unknown as typeof fetch);
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('compileClientPrompt', () => {
  it('substitutes {{vars}}', () => {
    expect(compileClientPrompt('Ciao {{nome}}', { nome: 'Mario' })).toBe('Ciao Mario');
  });
  it('keeps unknown vars literal', () => {
    expect(compileClientPrompt('Ciao {{nome}}', {})).toBe('Ciao {{nome}}');
  });
});

describe('getRemoteSystemPrompt (prod=production, local=staging)', () => {
  it('uses label staging when running on localhost', async () => {
    // window.location.hostname = 'localhost' già in jsdom
    const calls: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(String(url));
      return { ok: true, json: async () => ({ data: { name: 'card-system', version: 1, prompt: [{ role: 'system', content: 'REMOTO {{stile}}' }], fallback: false } }) };
    }));
    const out = await getRemoteSystemPrompt('card-system', { stile: 'premium' });
    expect(calls[0]).toContain('/api/ai/prompt?name=card-system&label=staging');
    expect(out).toBe('REMOTO premium');
  });

  it('uses label production when not on localhost', async () => {
    const original = Object.getOwnPropertyDescriptor(window, 'location')!;
    Object.defineProperty(window, 'location', {
      value: { ...original!.value, hostname: 'app.vercel.app' },
      writable: true,
    });
    const calls: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(String(url));
      return { ok: true, json: async () => ({ data: { name: 'card-system', version: 2, prompt: [{ role: 'system', content: 'PROD' }], fallback: false } }) };
    }));
    // re-import: RESOLVED_LABEL è valutata al module load (hostname già cambiato)
    const mod = await import('../remotePrompt');
    const out = await mod.getRemoteSystemPrompt('card-system');
    expect(calls[0]).toContain('/api/ai/prompt?name=card-system&label=production');
    expect(out).toBe('PROD');
    Object.defineProperty(window, 'location', original);
  });

  it('falls back to local builder when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
    const out = await getRemoteSystemPrompt('card-system');
    expect(out).toContain('bigliettini da visita');
  });

  it('uses server-provided content when Langfuse returns fallback flag (local template)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: { name: 'card-system', version: 0, prompt: [{ role: 'system', content: 'Locale {{x}}' }], fallback: true } }) })));
    const out = await getRemoteSystemPrompt('card-system', { x: 'v' });
    expect(out).toBe('Locale v');
  });

  it('returns null for unknown prompt ids (no local builder)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
    expect(await getRemoteSystemPrompt('inesistente')).toBeNull();
  });

  it('exposes resolved label per environment', () => {
    expect(['staging', 'production']).toContain(RESOLVED_LABEL);
  });

  it('prefetch registra l\u2019override nel promptRegistry (il sito usa il prompt remoto)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/api/ai/prompt')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              name: 'card-system',
              version: 7,
              prompt: [{ role: 'system', content: 'PROMPT MODIFICATO SU LANGFUSE' }],
              fallback: false,
            },
          }),
        };
      }
      return { ok: false, status: 404 };
    }));
    const { prefetchRemotePrompts } = await import('../remotePrompt');
    const { promptRegistry } = await import('../../../ai/prompts/registry');
    await prefetchRemotePrompts();

    // getPrompt è usato dall'orchestratore card → deve dare il remoto.
    const got = promptRegistry.getPrompt('card-system');
    expect(got).toBe('PROMPT MODIFICATO SU LANGFUSE');
  });
});
