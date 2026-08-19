import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockState = {
  responses: [] as Array<{ status: number; body: string }>,
  calls: [] as Array<{ path: string; options: any; body: string }>,
  reset() {
    this.responses = [];
    this.calls = [];
  },
};

vi.mock('node:https', () => ({
  default: {
    request: vi.fn((options: any, cb: any) => {
      const next = mockState.responses.shift() ?? { status: 200, body: '' };
      const res = {
        statusCode: next.status,
        on: (ev: string, handler: any) => {
          if (ev === 'data') handler(Buffer.from(next.body));
          if (ev === 'end') handler();
          return res;
        },
      };
      cb(res);
      return {
        on: vi.fn(),
        write: vi.fn((data: any) => {
          mockState.calls.push({ path: options.path, options, body: String(data) });
          return true;
        }),
        end: vi.fn(),
      };
    }),
  },
}));

import { sanitizeNetlifyName, deployLandingHtml } from '../netlify';

beforeEach(() => {
  mockState.reset();
});

describe('sanitizeNetlifyName', () => {
  it('slug minuscolo con trattini', () => {
    expect(sanitizeNetlifyName('Panetteria Rossi')).toBe('panetteria-rossi');
  });

  it('rimuove caratteri non alfanumerici', () => {
    expect(sanitizeNetlifyName("Bar Da' Mario & Figli")).toBe('bar-da-mario-figli');
  });

  it('tronca a 39 caratteri', () => {
    expect(sanitizeNetlifyName('a'.repeat(60))).toHaveLength(39);
  });

  it('fallback a cliente se vuoto', () => {
    expect(sanitizeNetlifyName('')).toBe('cliente');
    expect(sanitizeNetlifyName('!!!')).toBe('cliente');
  });
});

describe('deployLandingHtml', () => {
  it('site non esistente: lista → create → deploy; ritorna urls', async () => {
    mockState.responses = [
      { status: 404, body: 'not found' },
      { status: 201, body: JSON.stringify({ id: 'site_abc', name: 'quickbrand-panetteria-rossi' }) },
      { status: 200, body: JSON.stringify({ state: 'ready', deploy_url: 'https://preview.x.netlify.app', url: 'https://x.netlify.app' }) },
    ];
    const res = await deployLandingHtml('nt-123', 'quickbrand-panetteria-rossi', '<h1>Ciao</h1>', 'index.html');
    expect(res.deployUrl).toBe('https://preview.x.netlify.app');
    expect(res.siteUrl).toBe('https://x.netlify.app');
    expect(res.siteId).toBe('site_abc');
    expect(mockState.calls.length).toBe(2);
    expect(mockState.calls[0].path).toBe('/api/v1/sites');
    expect(String(mockState.calls[0].body)).toContain('quickbrand-panetteria-rossi');
    expect(mockState.calls[1].path).toBe('/api/v1/sites/site_abc/deploys');
    expect(String(mockState.calls[1].body)).toContain('index.html');
    expect(String(mockState.calls[1].body)).toContain('<h1>Ciao</h1>');
  });

  it('site esistente: deploy diretto senza create', async () => {
    mockState.responses = [
      { status: 200, body: JSON.stringify([{ id: 'site_ex', name: 'quickbrand-panetteria-rossi' }]) },
      { status: 200, body: JSON.stringify({ state: 'ready', deploy_url: 'https://preview.x.netlify.app', url: 'https://x.netlify.app' }) },
    ];
    const res = await deployLandingHtml('nt-123', 'quickbrand-panetteria-rossi', '<h1>X</h1>', 'index.html');
    expect(res.siteId).toBe('site_ex');
    expect(mockState.calls.length).toBe(1);
    expect(mockState.calls[0].path).toBe('/api/v1/sites/site_ex/deploys');
  });

  it('errore deploy → throw con status Netlify', async () => {
    mockState.responses = [
      { status: 200, body: JSON.stringify([{ id: 'site_ex', name: 'quickbrand-x' }]) },
      { status: 422, body: '{"msg":"bad request"}' },
    ];
    await expect(deployLandingHtml('nt-123', 'quickbrand-x', '<h1>X</h1>', 'index.html')).rejects.toThrow('422');
  });

  it('list 404 → procede comunque alla creazione', async () => {
    mockState.responses = [
      { status: 404, body: '' },
      { status: 201, body: JSON.stringify({ id: 'site_new' }) },
      { status: 200, body: JSON.stringify({ state: 'ready', deploy_url: 'https://preview.x.netlify.app' }) },
    ];
    const res = await deployLandingHtml('nt-123', 'quickbrand-nuovo', '<h1>X</h1>', 'index.html');
    expect(res.siteId).toBe('site_new');
  });
});
