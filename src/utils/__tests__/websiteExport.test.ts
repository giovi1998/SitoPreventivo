import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildWebsiteFullDocument, exportWebsiteZip } from '../websiteExport';
import type { Website } from '../schemas/website';

const saveAsMock = vi.fn();
vi.mock('file-saver', () => ({ saveAs: (blob: Blob, name: string) => saveAsMock(blob, name) }));

const zipState = vi.hoisted(() => ({
  files: [] as Array<{ name: string; content: unknown }>,
  folders: [] as string[],
  reset() {
    this.files = [];
    this.folders = [];
  },
}));

vi.mock('jszip', () => ({
  default: class MockZip {
    folder(name: string) {
      zipState.folders.push(name);
      return this;
    }
    file(name: string, content: unknown) {
      zipState.files.push({ name, content });
      return this;
    }
    async generateAsync() {
      return new Blob(['zip'], { type: 'application/zip' });
    }
  },
}));

function makeWebsite(overrides: Partial<Website> = {}): Partial<Website> {
  const now = new Date().toISOString();
  return {
    documentType: 'website',
    id: 'website_test',
    title: '',
    brief: {
      businessName: 'Panetteria',
      sector: '',
      description: '',
      tone: '',
      target: '',
      pages: 'index',
      preferredColors: '',
      font: '',
      cta: '',
      sections: 'hero',
      features: '',
      contacts: '',
      socials: [],
      mapsUrl: '',
      notes: '',
    },
    html: '<h1>Home</h1>',
    css: '',
    js: '',
    pages: ['index'],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  zipState.reset();
  saveAsMock.mockClear();
});

describe('buildWebsiteFullDocument', () => {
  it('wraps html/css/js in a complete document', () => {
    const doc = buildWebsiteFullDocument('<h1>Ciao</h1>', 'h1{color:red}', 'console.log(1)');
    expect(doc).toContain('<!DOCTYPE html>');
    expect(doc).toContain('<style>h1{color:red}</style>');
    expect(doc).toContain('<h1>Ciao</h1>');
    expect(doc).toContain('<script>console.log(1)</script>');
  });
});

describe('exportWebsiteZip', () => {
  it('creates zip with index.html and triggers saveAs', async () => {
    const res = await exportWebsiteZip(makeWebsite());
    expect(saveAsMock).toHaveBeenCalledWith(expect.any(Blob), 'sito-Panetteria.zip');
    expect(zipState.files.some((f) => f.name === 'index.html')).toBe(true);
    expect(res.fileName).toBe('sito-Panetteria.zip');
  });

  it('creates separate html files for multi-page sites', async () => {
    await exportWebsiteZip(makeWebsite({ pages: ['index', 'about'] }));
    const names = zipState.files.map((f) => f.name);
    expect(names).toContain('index.html');
    expect(names).toContain('about.html');
  });

  it('moves base64 images to assets/ as separate files', async () => {
    const logo = 'data:image/png;base64,QUJDRA==';
    await exportWebsiteZip(
      makeWebsite({
        logoUrl: logo,
        html: '<img src="data:image/png;base64,QUJDRA==">',
        images: [logo],
      }),
    );
    expect(zipState.folders).toContain('sito-Panetteria/assets');
    expect(zipState.files.some((f) => f.name === 'logo.jpg')).toBe(true);
  });

  it('falls back to title when businessName empty', async () => {
    await exportWebsiteZip(makeWebsite({ title: 'Sito Cliente', brief: { ...makeWebsite().brief!, businessName: '' } }));
    expect(saveAsMock).toHaveBeenCalledWith(expect.any(Blob), 'sito-Sito Cliente.zip');
  });
});
