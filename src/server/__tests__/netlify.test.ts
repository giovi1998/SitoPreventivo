import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'node:crypto';

const mockState = {
  responses: [] as Array<{ status: number; body: string }>,
  calls: [] as Array<{ path: string; options: any; body?: Buffer }>,
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
      mockState.calls.push({ path: options.path, options });
      return {
        on: vi.fn(),
        write: vi.fn((data: any) => {
          const last = mockState.calls[mockState.calls.length - 1];
          if (last) last.body = data;
          return true;
        }),
        end: vi.fn(),
      };
    }),
  },
}));

import { sanitizeNetlifyName, deployLandingHtml } from '../netlify';

function sha1(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex');
}

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

describe('deployLandingHtml (file digest)', () => {
  it('site non esistente: lista → create → digest → upload → poll; ritorna urls', async () => {
    const html = '<h1>Ciao</h1>';
    mockState.responses = [
      { status: 404, body: 'not found' },
      { status: 201, body: JSON.stringify({ id: 'site_abc', name: 'quickbrand-panetteria-rossi' }) },
      { status: 200, body: JSON.stringify({ id: 'dep_1', required: [sha1(html)], state: 'preparing', deploy_url: 'https://preview.x.netlify.app', url: 'https://x.netlify.app' }) },
      { status: 200, body: '' },
      { status: 200, body: JSON.stringify({ id: 'dep_1', state: 'ready' }) },
    ];
    const res = await deployLandingHtml('nt-123', 'quickbrand-panetteria-rossi', html, 'index.html', 1, 4);
    expect(res.deployUrl).toBe('https://preview.x.netlify.app');
    expect(res.siteUrl).toBe('https://x.netlify.app');
    expect(res.siteId).toBe('site_abc');
    expect(res.fileName).toBe('index.html');
    expect(mockState.calls.length).toBe(5);
    expect(mockState.calls[2].path).toBe('/api/v1/sites/site_abc/deploys');
    const createBody = JSON.parse(String(mockState.calls[2].body));
    expect(createBody.files['/index.html']).toBe(sha1(html));
    expect(mockState.calls[3].path).toBe('/api/v1/deploys/dep_1/files/index.html');
    expect(mockState.calls[3].options.headers['Content-Type']).toBe('application/octet-stream');
    expect(String(mockState.calls[3].body)).toBe(html);
  });

  it('file già noto a Netlify: required vuoto → nessun upload file', async () => {
    const html = '<h1>X</h1>';
    mockState.responses = [
      { status: 200, body: JSON.stringify([{ id: 'site_ex', name: 'quickbrand-panetteria-rossi' }]) },
      { status: 200, body: JSON.stringify({ id: 'dep_1', required: [], state: 'ready', deploy_url: 'https://preview.x.netlify.app' }) },
    ];
    const res = await deployLandingHtml('nt-123', 'quickbrand-panetteria-rossi', html, 'index.html', 1, 2);
    expect(res.deployUrl).toBe('https://preview.x.netlify.app');
    const uploads = mockState.calls.filter((c) => c.path.includes('/files/'));
    expect(uploads).toHaveLength(0);
  });

  it('site esistente: nessun create, deploy diretto con digest', async () => {
    mockState.responses = [
      { status: 200, body: JSON.stringify([{ id: 'site_ex', name: 'quickbrand-panetteria-rossi' }]) },
      { status: 200, body: JSON.stringify({ id: 'dep_1', required: [], state: 'ready', deploy_url: 'https://preview.x.netlify.app' }) },
    ];
    const res = await deployLandingHtml('nt-123', 'quickbrand-panetteria-rossi', '<h1>X</h1>', 'index.html', 1, 2);
    expect(res.siteId).toBe('site_ex');
    expect(mockState.calls.length).toBe(2);
    expect(mockState.calls[1].path).toBe('/api/v1/sites/site_ex/deploys');
  });

  it('errore deploy → throw con status Netlify', async () => {
    mockState.responses = [
      { status: 200, body: JSON.stringify([{ id: 'site_ex', name: 'quickbrand-x' }]) },
      { status: 422, body: '{"msg":"bad request"}' },
    ];
    await expect(deployLandingHtml('nt-123', 'quickbrand-x', '<h1>X</h1>', 'index.html', 1, 2)).rejects.toThrow('422');
  });

  it('list 404 → procede comunque alla creazione', async () => {
    mockState.responses = [
      { status: 404, body: '' },
      { status: 201, body: JSON.stringify({ id: 'site_new' }) },
      { status: 200, body: JSON.stringify({ id: 'dep_1', required: [], state: 'ready', deploy_url: 'https://preview.x.netlify.app' }) },
    ];
    const res = await deployLandingHtml('nt-123', 'quickbrand-nuovo', '<h1>X</h1>', 'index.html', 1, 2);
    expect(res.siteId).toBe('site_new');
  });

  it('deploy non ready: polla finché state ready', async () => {
    const html = '<h1>X</h1>';
    mockState.responses = [
      { status: 200, body: JSON.stringify([{ id: 'site_ex', name: 'quickbrand-panetteria-rossi' }]) },
      { status: 200, body: JSON.stringify({ id: 'dep_1', required: [], state: 'uploading', deploy_url: 'https://preview.x.netlify.app' }) },
      { status: 200, body: JSON.stringify({ id: 'dep_1', state: 'uploading' }) },
      { status: 200, body: JSON.stringify({ id: 'dep_1', state: 'ready' }) },
    ];
    const res = await deployLandingHtml('nt-123', 'quickbrand-panetteria-rossi', html, 'index.html', 1, 4);
    expect(res.deployUrl).toBe('https://preview.x.netlify.app');
    const getPaths = mockState.calls.map((c) => c.path).filter((p) => p.startsWith('/api/v1/deploys/'));
    expect(getPaths).toEqual(['/api/v1/deploys/dep_1', '/api/v1/deploys/dep_1']);
  });

  it('deploy già ready: nessun poll', async () => {
    mockState.responses = [
      { status: 200, body: JSON.stringify([{ id: 'site_ex', name: 'quickbrand-panetteria-rossi' }]) },
      { status: 200, body: JSON.stringify({ id: 'dep_1', required: [], state: 'ready', deploy_url: 'https://preview.x.netlify.app' }) },
    ];
    const res = await deployLandingHtml('nt-123', 'quickbrand-panetteria-rossi', '<h1>X</h1>', 'index.html', 1, 2);
    expect(res.deployUrl).toBe('https://preview.x.netlify.app');
    const getPaths = mockState.calls.map((c) => c.path).filter((p) => p.startsWith('/api/v1/deploys/'));
    expect(getPaths).toEqual([]);
  });
});
