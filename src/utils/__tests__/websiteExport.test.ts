import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildWebsiteFullDocument, exportWebsiteZip, sanitizeZipName } from '../websiteExport';
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
      address: '',
      phone: '',
      email: '',
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
    expect(doc).toContain('console.log(1)');
    expect(doc).toContain('try{');
  });

  it('inietta link Google Fonts se fontFamily è un font Google', () => {
    const doc = buildWebsiteFullDocument('<h1>X</h1>', 'h1{}', '', 'Poppins');
    expect(doc).toContain('fonts.googleapis.com/css2?family=Poppins');
  });

  it('nessun link font per system fonts o vuoto', () => {
    expect(buildWebsiteFullDocument('<h1>X</h1>', '', '', 'Georgia')).not.toContain('fonts.googleapis.com');
    expect(buildWebsiteFullDocument('<h1>X</h1>', '', '', '')).not.toContain('fonts.googleapis.com');
  });

  it('html già documento completo: nessun doppio wrap, css/js iniettati', () => {
    const full = '<!DOCTYPE html>\n<html lang="it">\n<head>\n<meta charset="UTF-8">\n<title>X</title>\n</head>\n<body>\n<h1>Ciao</h1>\n</body>\n</html>';
    const doc = buildWebsiteFullDocument(full, 'h1{color:red}', 'console.log(1)');
    expect(doc.match(/<!DOCTYPE html>/g)).toHaveLength(1);
    expect(doc.indexOf('<style>h1{color:red}</style>')).toBeLessThan(doc.indexOf('</head>'));
    expect(doc.indexOf('console.log(1)')).toBeGreaterThan(doc.indexOf('<h1>Ciao</h1>'));
  });

  it('html completo senza css/js: solo font link aggiunto', () => {
    const full = '<html><head><title>T</title></head><body>ok</body></html>';
    const doc = buildWebsiteFullDocument(full, '', '', 'Poppins');
    expect(doc.match(/<html>/g)).toHaveLength(1);
    expect(doc).toContain('fonts.googleapis.com/css2?family=Poppins');
  });

  it('js con SyntaxError → sostituito da fallback menu (preview navigabile)', () => {
    const broken = "if (nav.classList) { nav.classList.toggle('open'); }\nelse { console.log('x')";
    const doc = buildWebsiteFullDocument('<nav><button class="menu-toggle"></button></nav>', 'h1{}', broken);
    expect(doc).not.toContain("console.log('x')");
    expect(doc).toContain('menu-toggle');
    expect(doc).toContain('nav-open');
  });

  it('js con sintassi valida ma ReferenceError a runtime → fallback attivo via __qbSiteJsFailed', () => {
    const runtimeBroken = `document.querySelector('.menu-toggle').addEventListener('click', function(){ initMenu(); });`;
    const doc = buildWebsiteFullDocument('<h1>X</h1>', 'h1{}', runtimeBroken);
    // Il js generato viaggia in try/catch + fallback condizionato.
    expect(doc).toContain('__qbSiteJsFailed');
    expect(doc).toContain('initMenu()');
  });

  it('js valido → wrapped in try/catch, nessun doppio binding di fallback', () => {
    const ok = "document.querySelector('.menu-toggle').addEventListener('click',function(){document.querySelector('.nav').classList.toggle('nav-open')});";
    const doc = buildWebsiteFullDocument('<h1>X</h1>', '', ok);
    expect(doc).toContain(ok);
    expect(doc).toContain('__qbSiteJsFailed');
    // Il flag compare 2 volte: set nel try/catch + check del fallback condizionato.
    expect(doc.match(/__qbSiteJsFailed/g)?.length).toBe(2);
  });

  it('js vuoto → fallback menu iniettato (idempotente)', () => {
    const doc = buildWebsiteFullDocument('<h1>X</h1>', '', '');
    expect(doc).toContain('menu-toggle');
    expect(doc).toContain('nav-open');
    expect(doc).not.toContain('__qbSiteJsFailed');
  });
});

describe('sanitizeZipName', () => {
  it('rimuove caratteri illegali Windows (pipe, slash, colonne)', () => {
    expect(sanitizeZipName('A | B')).toBe('A - B');
    expect(sanitizeZipName('a/b:c')).toBe('a-b-c');
    expect(sanitizeZipName('x?y*')).toBe('x-y');
  });

  it('fallback a sito-web se vuoto o solo caratteri illegali', () => {
    expect(sanitizeZipName('')).toBe('sito-web');
    expect(sanitizeZipName('||||')).toBe('sito-web');
  });

  it('tronca a 60 caratteri', () => {
    expect(sanitizeZipName('a'.repeat(100))).toHaveLength(60);
  });
});

describe('exportWebsiteZip', () => {
  it('usa nome file sanitizzato quando businessName ha caratteri illegali', async () => {
    const web = makeWebsite({ brief: { ...makeWebsite().brief!, businessName: 'Gelateria | Chiccheria' } });
    await exportWebsiteZip(web);
    expect(saveAsMock).toHaveBeenCalledWith(expect.any(Blob), 'sito-Gelateria - Chiccheria.zip');
  });

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

  it("multi-pagina: about.html usa il pagesHtml dedicato, non l'index", async () => {
    await exportWebsiteZip(
      makeWebsite({
        pages: ['index', 'about'],
        pagesHtml: { about: '<h1>Chi siamo</h1>' },
      }),
    );
    const about = zipState.files.find((f) => f.name === 'about.html');
    const index = zipState.files.find((f) => f.name === 'index.html');
    expect(String(about?.content)).toContain('<h1>Chi siamo</h1>');
    expect(String(about?.content)).not.toContain('<h1>Home</h1>');
    expect(String(index?.content)).toContain('<h1>Home</h1>');
  });

  it("multi-pagina senza pagesHtml: fallback all'html index", async () => {
    await exportWebsiteZip(makeWebsite({ pages: ['index', 'contact'] }));
    const contact = zipState.files.find((f) => f.name === 'contact.html');
    expect(String(contact?.content)).toContain('<h1>Home</h1>');
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
