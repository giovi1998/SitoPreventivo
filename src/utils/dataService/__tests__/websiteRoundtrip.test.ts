import { describe, it, expect, beforeEach, vi } from 'vitest';
import dataService from '../../dataService';
import { exportWebsiteZip } from '../../websiteExport';
import JSZip from 'jszip';
import type { Website } from '../../schemas/website';

// Forza storage locale (hostname localhost in jsdom).
Object.defineProperty(window, 'location', {
  value: { hostname: 'localhost' },
  writable: true,
  configurable: true,
});

// saveAs: cattura blob per ispezione invece di scaricare.
const savedBlobs: { blob: Blob; name: string }[] = [];
vi.mock('file-saver', () => ({
  saveAs: (blob: Blob, name: string) => { savedBlobs.push({ blob, name }); },
}));

function makeWebsite(overrides: Partial<Website> & Record<string, unknown> = {}): Partial<Website> & Record<string, unknown> {
  return {
    documentType: 'website',
    id: 'website_save_test',
    title: 'Sito Test',
    userEmail: 'user@test.com',
    brief: {
      businessName: 'Panetteria Test',
      sector: 'food',
      description: 'Panetteria artigianale',
      tone: 'caldo',
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
    html: '<h1>Home</h1><p>Benvenuti</p>',
    css: 'h1 { color: #B45309; }',
    js: '',
    pages: ['index'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  savedBlobs.length = 0;
});

describe('website save roundtrip (IS_LOCAL)', () => {
  it('saves website flat and reloads with same html/css/js', async () => {
    const res = await dataService.saveDocument('user@test.com', makeWebsite());
    expect(res.error).toBeFalsy();

    const loaded = await dataService.getDocument('user@test.com', 'website_save_test', 'website');
    expect(loaded).toBeTruthy();
    expect(loaded.html).toContain('<h1>Home</h1>');
    expect(loaded.css).toContain('#B45309');
    expect(loaded.pages).toEqual(['index']);
  });

  it('saves multi-page website and returns it in getDocuments', async () => {
    await dataService.saveDocument('user@test.com', makeWebsite({
      id: 'website_mp',
      pages: ['index', 'about'],
      html: '<h1>Home</h1><a href="about.html">Chi</a>',
      pagesHtml: { about: '<h1>Chi siamo</h1>' },
    }));
    const { documents } = await dataService.getDocuments('user@test.com', 'website');
    const found = documents.find((d: any) => d.id === 'website_mp');
    expect(found).toBeTruthy();
    expect(found.pages).toEqual(['index', 'about']);
    expect(found.pagesHtml?.about).toContain('Chi siamo');
  });

  it('multi-page export: about.html contiene il contenuto dedicato', async () => {
    await exportWebsiteZip(makeWebsite({
      pages: ['index', 'about'],
      pagesHtml: { about: '<h1>Chi siamo</h1>' },
    }));
    const zip = await JSZip.loadAsync(await savedBlobs[0].blob.arrayBuffer());
    const aboutEntry = Object.values(zip.files).find((f: any) => f.name.endsWith('about.html'));
    expect(aboutEntry).toBeTruthy();
    const content = await (aboutEntry as any).async('string');
    expect(content).toContain('<h1>Chi siamo</h1>');
    expect(content).not.toContain('<h1>Home</h1>');
  });

  it('does not crash with html containing base64 images', async () => {
    const img = 'data:image/jpeg;base64,' + 'A'.repeat(50_000);
    const res = await dataService.saveDocument('user@test.com', makeWebsite({
      html: `<img src="${img}">`,
    }));
    // Se la quota lo permette salva; se quota errata → errore strutturato, no crash
    expect(res).toBeTruthy();
  });
});

describe('website export ZIP (real jszip)', () => {
  it('produces a non-empty zip with index.html', async () => {
    await exportWebsiteZip(makeWebsite());
    expect(savedBlobs.length).toBe(1);
    const buf = await savedBlobs[0].blob.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(50);
    const zip = await JSZip.loadAsync(buf);
    const names = Object.keys(zip.files);
    expect(names.some((n) => n.endsWith('index.html'))).toBe(true);
  });

  it('multi-page export contains separate html files', async () => {
    await exportWebsiteZip(makeWebsite({ pages: ['index', 'about', 'contact'] }));
    const zip = await JSZip.loadAsync(await savedBlobs[0].blob.arrayBuffer());
    const names = Object.keys(zip.files);
    expect(names.some((n) => n.endsWith('index.html'))).toBe(true);
    expect(names.some((n) => n.endsWith('about.html'))).toBe(true);
    expect(names.some((n) => n.endsWith('contact.html'))).toBe(true);
  });

  it('export from hydrated Collection doc (flat) works', async () => {
    const doc = makeWebsite({ id: 'website_coll', pages: ['index'] });
    await dataService.saveDocument('user@test.com', doc);
    const loaded = await dataService.getDocument('user@test.com', 'website_coll', 'website');
    await exportWebsiteZip(loaded);
    expect(savedBlobs.length).toBe(1);
    const zip = await JSZip.loadAsync(await savedBlobs[0].blob.arrayBuffer());
    const indexEntry = Object.values(zip.files).find((f: any) => f.name.endsWith('index.html'));
    expect(indexEntry).toBeTruthy();
    const content = await (indexEntry as any).async('string');
    expect(content).toContain('<h1>Home</h1>');
  });
});
