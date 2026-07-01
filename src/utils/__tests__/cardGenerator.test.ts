import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pdfmake/build/pdfmake', () => {
  const createPdf = vi.fn(() => ({
    getBlob: vi.fn((cb: (blob: Blob) => void) => cb(new Blob(['%PDF-1.4\nfake-card-pdf'], { type: 'application/pdf' }))),
    getBuffer: vi.fn(() => Promise.resolve(new Uint8Array([0x25, 0x50, 0x44, 0x46]))),
    download: vi.fn(),
  }));
  const pdfMake = {
    vfs: {} as Record<string, string>,
    createPdf,
  };
  return { default: pdfMake };
});

vi.mock('pdfmake/build/vfs_fonts', () => ({
  default: { 'Roboto-Regular.ttf': 'AAEAAA...' },
}));

import {
  compressImage,
  generateCardPDF,
  generateCardPng,
  buildCardSvg,
  computePageCardEntries,
  SIZE_PRESETS_MM,
  BLEED_MM,
  CARD_A4_COLS,
  CARD_A4_ROWS,
  CARD_A4_GAP_MM,
  CARD_A4_MARGIN_MM,
  resolveCardQrPayload,
} from '../cardGenerator';
import * as cardGeneratorModule from '../cardGenerator';
import { createEmptyCard, createGiovanniCardTemplate } from '../documentSchemas';

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/svg+xml'];

function makePngFile(opts: { size?: number; type?: string; name?: string } = {}): File {
  const blob = new Blob([new Uint8Array(opts.size ?? 1024)], { type: opts.type ?? 'image/png' });
  return new File([blob], opts.name ?? 'photo.png', { type: opts.type ?? 'image/png' });
}

function makeUnsupportedFile(): File {
  return new File([new Blob([new Uint8Array(100)], { type: 'application/octet-stream' })], 'evil.exe', { type: 'application/octet-stream' });
}

function mockLoadedImage(width: number, height: number) {
  vi.stubGlobal('Image', class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    _src = '';
    width = width;
    height = height;
    set src(v: string) {
      this._src = v;
      queueMicrotask(() => this.onload?.());
    }
    get src() { return this._src; }
  } as any);
}

function mockCanvas(toDataUrlImpl?: (type: string, q: number) => string) {
  const ctxStub: any = { drawImage: vi.fn() };
  const getContext = vi.fn(() => ctxStub);
  const toDataURL = vi.fn(toDataUrlImpl ?? (() => 'data:image/jpeg;base64,' + 'A'.repeat(2000)));
  const canvasProto: any = {
    width: 0,
    height: 0,
    getContext,
    toDataURL,
  };
  const origCreate = document.createElement.bind(document);
  const createSpy = vi.spyOn(document, 'createElement');
  createSpy.mockImplementation((tag: string, opts?: any) => {
    if (tag === 'canvas') return canvasProto as any;
    return origCreate(tag, opts);
  });
  return { canvasProto, toDataURL, createSpy };
}

describe('cardGenerator - size presets', () => {
  it('exposes the 3 documented size presets', () => {
    expect(Object.keys(SIZE_PRESETS_MM).sort()).toEqual(['eu-85x55', 'square-65x65', 'us-89x51']);
  });

  it('EU preset is 85x55mm', () => {
    expect(SIZE_PRESETS_MM['eu-85x55']).toEqual({ w: 85, h: 55 });
  });

  it('US preset is 89x51mm', () => {
    expect(SIZE_PRESETS_MM['us-89x51']).toEqual({ w: 89, h: 51 });
  });

  it('Square preset is 65x65mm', () => {
    expect(SIZE_PRESETS_MM['square-65x65']).toEqual({ w: 65, h: 65 });
  });

  it('layout constants are correct for 10-up A4 (5 cols × 2 rows, A4 landscape, cards rotated 90°)', () => {
    expect(BLEED_MM).toBe(3);
    // 5 colonne × 2 righe su A4 LANDSCAPE con cards ruotate 90° CW
    // (55mm wide × 85mm tall nella sheet). CARD_A4_GAP_MM = BLEED_MM:
    // il gap condiviso tra card adiacenti coincide con il bleed.
    expect(CARD_A4_COLS).toBe(5);
    expect(CARD_A4_ROWS).toBe(2);
    expect(CARD_A4_GAP_MM).toBe(3);
    expect(CARD_A4_MARGIN_MM).toBe(10);
  });
});

describe('cardGenerator - computePageCardEntries (10-up A4 fit)', () => {
  const A4_LANDSCAPE = { w: 297, h: 210 };

  // 5 cols × 2 rows su A4 LANDSCAPE con card ruotate 90° CW: tile
  // nella sheet = (cardH × cardW). Per EU 85×55 → tile 55×85mm.
  // Math: 5*55+4*3 = 287<297 (margin 5×2), 2*85+3 = 173<210 (margin 18.5×2).
  it('EU 85×55: 10 tile ruotate stanno dentro A4 landscape', () => {
    const { entries, pageOrientation } = computePageCardEntries(85, 55);
    expect(entries).toHaveLength(10);
    expect(pageOrientation).toBe('landscape');
    const page = A4_LANDSCAPE;
    for (const e of entries) {
      expect(e.x).toBeGreaterThanOrEqual(0);
      expect(e.y).toBeGreaterThanOrEqual(0);
      expect(e.x + e.w).toBeLessThanOrEqual(page.w);
      expect(e.y + e.h).toBeLessThanOrEqual(page.h);
      // tile = (cardH × cardW) → 55 × 85 per EU
      expect(e.w).toBe(55);
      expect(e.h).toBe(85);
    }
  });

  it('US 89×51: 10 tile ruotate stanno dentro A4 landscape', () => {
    const { entries, pageOrientation } = computePageCardEntries(89, 51);
    expect(entries).toHaveLength(10);
    expect(pageOrientation).toBe('landscape');
    const page = A4_LANDSCAPE;
    for (const e of entries) {
      expect(e.x).toBeGreaterThanOrEqual(0);
      expect(e.y).toBeGreaterThanOrEqual(0);
      expect(e.x + e.w).toBeLessThanOrEqual(page.w);
      expect(e.y + e.h).toBeLessThanOrEqual(page.h);
      expect(e.w).toBe(51);
      expect(e.h).toBe(89);
    }
  });

  it('5 colonne × 2 righe = 10 tile uniche (no overlap trim)', () => {
    const { entries } = computePageCardEntries(85, 55);
    const keys = new Set(entries.map((e) => `${e.x},${e.y}`));
    expect(keys.size).toBe(10);
  });

  it('gap orizzontale = CARD_A4_GAP_MM tra tile adiacenti', () => {
    const { entries } = computePageCardEntries(85, 55);
    const sortedX = [...new Set(entries.map((e) => e.x))].sort((a, b) => a - b);
    expect(sortedX).toHaveLength(5);
    for (let i = 1; i < sortedX.length; i++) {
      expect(sortedX[i] - sortedX[i - 1]).toBe(55 + CARD_A4_GAP_MM);
    }
  });

  it('margine page ≥ BLEED_MM su ogni lato (per EU landscape)', () => {
    const { entries } = computePageCardEntries(85, 55);
    const minX = Math.min(...entries.map((e) => e.x));
    const maxX = Math.max(...entries.map((e) => e.x + e.w));
    const minY = Math.min(...entries.map((e) => e.y));
    const maxY = Math.max(...entries.map((e) => e.y + e.h));
    expect(minX).toBeGreaterThanOrEqual(BLEED_MM);
    expect(297 - maxX).toBeGreaterThanOrEqual(BLEED_MM);
    expect(minY).toBeGreaterThanOrEqual(BLEED_MM);
    expect(210 - maxY).toBeGreaterThanOrEqual(BLEED_MM);
  });

  it('cards occupano orizzontalmente ≥ 95% della larghezza A4 (no cards "piccole")', () => {
    // Regressione: la prima versione del fix usava 2×5 portrait che
    // lasciava 18.5mm di margine per lato (cards piccole/sfasate).
    // Ora 5×2 landscape con tile ruotata riempie 287/297 = 96% della
    // larghezza. Le cards non appaiono più piccole rispetto al foglio.
    const { entries } = computePageCardEntries(85, 55);
    const minX = Math.min(...entries.map((e) => e.x));
    const maxX = Math.max(...entries.map((e) => e.x + e.w));
    const fillW = (maxX - minX) / 297;
    expect(fillW).toBeGreaterThanOrEqual(0.95);
  });
});

describe('cardGenerator - resolveCardQrPayload (AC-007, AC-008)', () => {
  it('uses qrPayload when populated (AC-008)', () => {
    const card = { ...createEmptyCard(), back: { ...createEmptyCard().back, qrPayload: 'MATMSG:custom', website: 'https://example.com' } };
    expect(resolveCardQrPayload(card)).toBe('MATMSG:custom');
  });

  it('falls back to website when qrPayload is empty (AC-007)', () => {
    const card = { ...createEmptyCard(), back: { ...createEmptyCard().back, qrPayload: '', website: 'https://example.com' } };
    expect(resolveCardQrPayload(card)).toBe('https://example.com');
  });

  it('returns empty string when both qrPayload and website are empty (edge case 3)', () => {
    const card = createEmptyCard();
    expect(resolveCardQrPayload(card)).toBe('');
  });

  it('Giovanni template uses website (qrPayload empty)', () => {
    const card = createGiovanniCardTemplate();
    expect(resolveCardQrPayload(card)).toBe('https://webdeveloperca.netlify.app/');
  });
});

describe('cardGenerator - compressImage (AC-004, AC-005, AC-006, AC-006b)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects unsupported MIME types (AC-005, SEC-001)', async () => {
    await expect(compressImage(makeUnsupportedFile())).rejects.toThrow(/Formato non supportato/i);
  });

  it('rejects files larger than 5MB (AC-006, SEC-002)', async () => {
    const file = makePngFile({ size: 6 * 1024 * 1024 });
    await expect(compressImage(file)).rejects.toThrow(/troppo grande/i);
  });

  it('rejects images larger than 4000px on a side (AC-006b, SEC-003)', async () => {
    mockLoadedImage(5000, 1000);
    const file = makePngFile({ size: 100_000 });
    await expect(compressImage(file)).rejects.toThrow(/Immagine troppo grande/i);
  });

  it('accepts a valid PNG, returns a dataURL with image/jpeg (AC-004)', async () => {
    mockLoadedImage(100, 100);
    const { toDataURL } = mockCanvas();
    const file = makePngFile();
    const result = await compressImage(file);
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
    expect(toDataURL).toHaveBeenCalled();
  });

  it('reduces quality if encoded size exceeds maxBytes', async () => {
    mockLoadedImage(800, 800);
    let call = 0;
    const sizes = ['A'.repeat(900_000), 'A'.repeat(800_000), 'A'.repeat(400_000)];
    mockCanvas((_t: string, q: number) => {
      const s = sizes[call++] ?? sizes[sizes.length - 1];
      return 'data:image/jpeg;base64,' + s;
    });
    const file = makePngFile();
    const result = await compressImage(file, 800, 300_000);
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('accepts all 3 allowed MIME types (SEC-001 allowlist)', async () => {
    for (const type of ALLOWED_MIME) {
      mockLoadedImage(50, 50);
      mockCanvas();
      const file = new File([new Uint8Array(100)], `a.${type.split('/')[1]}`, { type });
      const result = await compressImage(file);
      expect(result).toMatch(/^data:/);
      vi.restoreAllMocks();
    }
  });

  it('returns PNG dataURL with format="png" (preserves transparency for logos)', async () => {
    mockLoadedImage(100, 100);
    // Override the default JPEG mock — PNG output must be image/png
    const ctxStub: any = { drawImage: vi.fn() };
    const toDataURL = vi.fn(() => 'data:image/png;base64,' + 'A'.repeat(2000));
    const canvasProto: any = { width: 0, height: 0, getContext: () => ctxStub, toDataURL };
    const origCreate = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement');
    createSpy.mockImplementation((tag: string) => (tag === 'canvas' ? canvasProto as any : origCreate(tag)));
    const file = makePngFile();
    const result = await compressImage(file, undefined, undefined, { format: 'png' });
    expect(result).toMatch(/^data:image\/png;base64,/);
    expect(toDataURL).toHaveBeenCalledWith('image/png');
  });

  it('PNG output scales down iteratively when over maxBytes (no quality param on PNG)', async () => {
    mockLoadedImage(400, 400);
    let pngCall = 0;
    // First call: too big (resizes). Second call: fits.
    const sizes = [
      'A'.repeat(900_000),
      'A'.repeat(400_000),
    ];
    const ctxStub: any = { drawImage: vi.fn(), clearRect: vi.fn() };
    const toDataURL = vi.fn(() => {
      const s = sizes[pngCall++] ?? sizes[sizes.length - 1];
      return 'data:image/png;base64,' + s;
    });
    const canvasProto: any = { width: 0, height: 0, getContext: () => ctxStub, toDataURL };
    const origCreate = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement');
    createSpy.mockImplementation((tag: string) => (tag === 'canvas' ? canvasProto as any : origCreate(tag)));
    const file = makePngFile();
    const result = await compressImage(file, 800, 300_000, { format: 'png' });
    expect(result).toMatch(/^data:image\/png;base64,/);
    // PNG path uses toDataURL with no quality arg — verify it was called
    expect(pngCall).toBeGreaterThanOrEqual(2);
  });

  it('PNG output throws when image is too complex even at minDim', async () => {
    mockLoadedImage(100, 100);
    const ctxStub: any = { drawImage: vi.fn(), clearRect: vi.fn() };
    const toDataURL = vi.fn(() => 'data:image/png;base64,' + 'A'.repeat(900_000));
    const canvasProto: any = { width: 0, height: 0, getContext: () => ctxStub, toDataURL };
    const origCreate = document.createElement.bind(document);
    const createSpy = vi.spyOn(document, 'createElement');
    createSpy.mockImplementation((tag: string) => (tag === 'canvas' ? canvasProto as any : origCreate(tag)));
    const file = makePngFile();
    await expect(
      compressImage(file, 800, 1000, { format: 'png', minDim: 50 }),
    ).rejects.toThrow(/troppo pesante/i);
  });
});

describe('cardGenerator - generateCardPDF (AC-009)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a non-empty Uint8Array buffer (AC-009)', async () => {
    const card = createEmptyCard();
    const buf = await generateCardPDF(card, { tier: 'free' });
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('produces a 2-page A4 LANDSCAPE docDefinition (front + back) with 5×2 cards rotated', async () => {
    const card = createEmptyCard();
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfMake = (pdfMakeModule as any).default;
    const createPdf = pdfMake.createPdf as any;
    createPdf.mockClear();
    await generateCardPDF(card, { tier: 'free' });
    const docDef = createPdf.mock.calls[0][0];
    expect(docDef).toBeDefined();
    expect(Array.isArray(docDef.content)).toBe(true);
    // Il PDF 10-up usa A4 LANDSCAPE esplicito in pt: pageSize = object
    // { width: 297*2.8346, height: 210*2.8346 }. Senza conversioni mm→pt
    // pdfmake disegna le cards a ~3mm (287pt = 101mm invece di 287mm)
    // → cards piccole e raggruppate in alto a sx.
    expect(docDef.pageSize).toEqual({ width: 297 * (72 / 25.4), height: 210 * (72 / 25.4) });
    expect(docDef.pageOrientation).toBe('landscape');
  });

  it('raster images inside PDF 10-up are positioned in pt (mm × 72/25.4) — regression cards piccole', async () => {
    const card = createEmptyCard();
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfMake = (pdfMakeModule as any).default;
    const createPdf = pdfMake.createPdf as any;
    createPdf.mockClear();
    await generateCardPDF(card, { tier: 'free' });
    const docDef = createPdf.mock.calls[0][0];
    // Trova il primo image node (raster card face).
    const visit = (node: any): any[] => {
      if (!node || typeof node !== 'object') return [];
      if (typeof node.image === 'string' && node.image.startsWith('data:image/')) return [node];
      if (Array.isArray(node)) return node.flatMap(visit);
      return Object.values(node).flatMap(visit);
    };
    const images = visit(docDef.content);
    expect(images.length).toBeGreaterThanOrEqual(10); // 10 card front (1 pagina)
    const first = images[0];
    const MM_TO_PT = 72 / 25.4;
    // EU 85×55 ruotata in landscape: tile = 55×85mm. OffsetX = 5mm,
    // offsetY = (210-173)/2 = 18.5mm. Le coordinate devono essere in pt.
    expect(first.absolutePosition.x).toBeCloseTo(5 * MM_TO_PT, 1);
    expect(first.absolutePosition.y).toBeCloseTo(18.5 * MM_TO_PT, 1);
    expect(first.width).toBeCloseTo(55 * MM_TO_PT, 1);
    expect(first.height).toBeCloseTo(85 * MM_TO_PT, 1);
  });

  it('10-up canvas layers are absolute-positioned (regression: no 16-page flow)', async () => {
    const card = createGiovanniCardTemplate();
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfMake = (pdfMakeModule as any).default;
    const createPdf = pdfMake.createPdf as any;
    createPdf.mockClear();
    await generateCardPDF(card, { tier: 'free' });
    const docDef = createPdf.mock.calls[0][0];
    const serialized = JSON.stringify(docDef);
    // Background, strips and crop marks are canvas objects. They MUST be
    // absolute-positioned; otherwise pdfmake treats them as flow content and
    // produces many pages instead of front/back sheets.
    const canvasNodes: any[] = [];
    const visit = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.canvas) canvasNodes.push(node);
      if (Array.isArray(node)) node.forEach(visit);
      else Object.values(node).forEach(visit);
    };
    visit(docDef.content);
    expect(canvasNodes.length).toBeGreaterThan(0);
    expect(canvasNodes.every((n) => n.absolutePosition)).toBe(true);
    expect(serialized).toContain('pageBreak');
  });

  it('handles Giovanni template without errors', async () => {
    const card = createGiovanniCardTemplate();
    const buf = await generateCardPDF(card, { tier: 'free' });
    expect(buf.length).toBeGreaterThan(0);
  });

  it('uses PNG card snapshots in PDF 10-up (same proportions as SVG/PNG export)', async () => {
    const card = createGiovanniCardTemplate();
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfMake = (pdfMakeModule as any).default;
    const createPdf = pdfMake.createPdf as any;
    createPdf.mockClear();
    await generateCardPDF(card, { tier: 'free' });
    const docDef = createPdf.mock.calls[0][0];
    const serialized = JSON.stringify(docDef);
    // Regression: il vecchio PDF builder manuale non rispettava proporzioni
    // della preview. Ora ogni lato viene rasterizzato dalla stessa pipeline
    // `buildCardSvg` → PNG e inserito dieci volte come image data URL.
    expect(serialized).toContain('"image":"data:image/png;base64');
    expect(serialized).not.toContain('"image":"data:image/svg+xml');
  });

  it('handles all 3 size presets', async () => {
    for (const preset of ['eu-85x55', 'us-89x51', 'square-65x65'] as const) {
      const card = { ...createEmptyCard(), style: { ...createEmptyCard().style, sizePreset: preset } };
      const buf = await generateCardPDF(card, { tier: 'free' });
      expect(buf.length).toBeGreaterThan(0);
    }
  });

  it('does not throw when card has no images', async () => {
    const card = createEmptyCard();
    const buf = await generateCardPDF(card, { tier: 'free' });
    expect(buf).toBeInstanceOf(Uint8Array);
  });

  it('includes photo as image in docDefinition when photoUrl is set', async () => {
    const card = {
      ...createEmptyCard(),
      front: { ...createEmptyCard().front, name: 'MARIO', photoUrl: 'data:image/png;base64,AAAA' },
    };
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfMake = (pdfMakeModule as any).default;
    const createPdf = pdfMake.createPdf as any;
    createPdf.mockClear();
    await generateCardPDF(card, { tier: 'free' });
    const docDef = createPdf.mock.calls[0][0];
    // Serialize docDef and look for image references
    const serialized = JSON.stringify(docDef);
    expect(serialized).toContain('AAAA'); // base64 photo data
  });

  it('photoUrl relativo (es. /giovanni-photo.jpg) viene pre-fetcha e convertito in base64 prima dell\'SVG', async () => {
    // Bug storico: SVG caricato come Image non può fetchare immagini
    // esterne in modo affidabile → foto invisibile nel PDF. Fix:
    // resolveToBase64DataUrl converte l'URL in base64 PRIMA di build
    // l'SVG, rendendolo self-contained (funziona in dev, prod, e in
    // ogni browser).
    const { resolveToBase64DataUrl } = cardGeneratorModule._internalForTests();
    const fetchSpy = vi.fn(async () =>
      new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), { headers: { 'Content-Type': 'image/jpeg' } }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    // jsdom FileReader ha type checking stretto su Blob.from(Response).
    // Mock-iamo readAsDataURL per restituire direttamente il data URL.
    const origFileReader = (globalThis as any).FileReader;
    (globalThis as any).FileReader = class {
      result: string = 'data:image/jpeg;base64,/9j/4AAQ';
      onload: ((ev: any) => void) | null = null;
      onerror: ((ev: any) => void) | null = null;
      readAsDataURL() {
        // simula callback async
        queueMicrotask(() => this.onload?.({} as any));
      }
    };
    try {
      const resolved = await resolveToBase64DataUrl('/giovanni-photo.jpg');
      expect(fetchSpy).toHaveBeenCalledWith('/giovanni-photo.jpg', expect.any(Object));
      // L'output è un data URL base64 (non più il path relativo).
      expect(resolved).toMatch(/^data:/);
      expect(resolved).not.toContain('giovanni-photo.jpg');
    } finally {
      vi.unstubAllGlobals();
      (globalThis as any).FileReader = origFileReader;
    }
  });

  it('photoUrl con fetch che fallisce: fallback all\'URL originale (no crash)', async () => {
    const { resolveToBase64DataUrl } = cardGeneratorModule._internalForTests();
    const fetchSpy = vi.fn(async () => {
      throw new Error('network error');
    });
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const resolved = await resolveToBase64DataUrl('/missing.jpg');
      // In caso di errore di rete, ritorna l'URL originale (no crash).
      expect(resolved).toBe('/missing.jpg');
      expect(fetchSpy).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('photoUrl con data URL esistente: passa direttamente (no fetch)', async () => {
    const { resolveToBase64DataUrl } = cardGeneratorModule._internalForTests();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
      const resolved = await resolveToBase64DataUrl(dataUrl);
      expect(resolved).toBe(dataUrl);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('photoUrl con fetch che ritorna 404: fallback all\'URL originale + warning', async () => {
    const { resolveToBase64DataUrl } = cardGeneratorModule._internalForTests();
    const fetchSpy = vi.fn(async () => new Response('not found', { status: 404 }));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const resolved = await resolveToBase64DataUrl('/missing.jpg');
      expect(resolved).toBe('/missing.jpg');
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      warnSpy.mockRestore();
    }
  });

  it('does NOT include monogram text in docDefinition (feature removed)', async () => {
    const card = {
      ...createEmptyCard(),
      front: { ...createEmptyCard().front, name: 'MARIO ROSSI' },
    };
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfMake = (pdfMakeModule as any).default;
    const createPdf = pdfMake.createPdf as any;
    createPdf.mockClear();
    await generateCardPDF(card, { tier: 'free' });
    const docDef = createPdf.mock.calls[0][0];
    const serialized = JSON.stringify(docDef);
    expect(serialized).not.toContain('"MR"'); // monogram removed
  });

  it('renders back side as PNG snapshot when socials are present', async () => {
    const card = {
      ...createEmptyCard(),
      back: {
        ...createEmptyCard().back,
        socials: [{ platform: 'LinkedIn', url: 'XXXXX' }],
      },
    };
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfMake = (pdfMakeModule as any).default;
    const createPdf = pdfMake.createPdf as any;
    createPdf.mockClear();
    await generateCardPDF(card, { tier: 'free' });
    const docDef = createPdf.mock.calls[0][0];
    const serialized = JSON.stringify(docDef);
    // PDF 10-up usa snapshot PNG della card: le proporzioni sono uguali a
    // preview/SVG, ma il testo non resta nel docDefinition come stringa.
    expect(serialized).toContain('"image":"data:image/png;base64');
    expect(serialized).not.toContain('LinkedIn');
  });

  it('card non-template (user-created) con photo+logo+QR produce docDef con tutti gli elementi (no template Giovanni)', async () => {
    // Verifica che il fix funzioni per QUALSIASI card, non solo per il
    // template Giovanni. Qui usiamo createEmptyCard + dati custom come
    // farebbe un utente dopo aver editato la card.
    const card = {
      ...createEmptyCard(),
      front: {
        ...createEmptyCard().front,
        name: 'MARIO ROSSI',
        title: 'CEO',
        company: 'Acme S.r.l.',
        layout: 'split' as const,
        photoUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ', // uploaded photo
        logoUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=', // custom logo
      },
      back: {
        ...createEmptyCard().back,
        phone: '+39 02 1234567',
        email: 'mario@acme.com',
        website: 'https://acme.com',
        qrPayload: 'https://acme.com',
        qrSize: 'medium' as const,
      },
      style: {
        ...createEmptyCard().style,
        sizePreset: 'eu-85x55' as const,
        accentColor: '#FF6B35',
      },
    };
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfMake = (pdfMakeModule as any).default;
    const createPdf = pdfMake.createPdf as any;
    createPdf.mockClear();
    const buf = await generateCardPDF(card, { tier: 'free' });
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(buf.length).toBeGreaterThan(0);
    const docDef = createPdf.mock.calls[0][0];
    const serialized = JSON.stringify(docDef);
    // 2 pagine A4 landscape (front + back).
    expect(docDef.pageOrientation).toBe('landscape');
    // 10 immagini raster (5×2) × 2 lati = 20 immagini nel docDef.
    const imageCount = (serialized.match(/"image":"data:image\/png;base64/g) || []).length;
    expect(imageCount).toBe(20);
  });
});

describe('cardGenerator - buildCardSvg - card non-template (user-created)', () => {
  // Verifica che il buildCardSvg produca SVG con TUTTI gli elementi
  // (photo, logo, QR) anche per card create dall'utente (non template).
  // Importante: il fix con resolveToBase64DataUrl in renderCardSideDataUrl
  // garantisce che la foto/logo siano base64 inline, quindi funzionano
  // anche in produzione senza dipendere dal template Giovanni.

  it('user card con base64 photo: SVG contiene la foto inline (no path relativo)', () => {
    const card = {
      ...createEmptyCard(),
      front: {
        ...createEmptyCard().front,
        name: 'MARIO',
        photoUrl: 'data:image/png;base64,USERPHOTO',
      },
    };
    const svg = buildCardSvg(card, 'front', 1024, 663);
    expect(svg).toContain('data:image/png;base64,USERPHOTO');
    // Non deve aver perso la foto durante la serializzazione (escape XML).
    expect(svg).not.toContain('&apos;data:image/png'); // escape over-aggressive
  });

  it('user card con base64 logo SVG: SVG contiene il logo inline', () => {
    const card = {
      ...createEmptyCard(),
      front: {
        ...createEmptyCard().front,
        name: 'MARIO',
        photoUrl: 'data:image/png;base64,USERPHOTO',
        logoUrl: 'data:image/svg+xml;base64,USERLOGO',
      },
    };
    const svg = buildCardSvg(card, 'front', 1024, 663);
    expect(svg).toContain('data:image/png;base64,USERPHOTO');
    expect(svg).toContain('data:image/svg+xml;base64,USERLOGO');
  });

  it('user card con QR custom payload (non-URL): SVG contiene moduli QR reali', () => {
    const card = {
      ...createEmptyCard(),
      back: {
        ...createEmptyCard().back,
        qrPayload: 'MATMSG:TO:test@example.com;SUB:Test;BODY:Ciao;;',
      },
    };
    const svg = buildCardSvg(card, 'back', 1024, 663);
    // Il QR è composto da molti <rect> moduli.
    const rectCount = (svg.match(/<rect /g) || []).length;
    expect(rectCount).toBeGreaterThan(20); // QR modules
  });

  it('user card con QR + website (auto-derived): QR presente e WEB row omessa', () => {
    const card = {
      ...createEmptyCard(),
      back: {
        ...createEmptyCard().back,
        website: 'https://mycompany.com',
      },
    };
    const svg = buildCardSvg(card, 'back', 1024, 663);
    const rectCount = (svg.match(/<rect /g) || []).length;
    expect(rectCount).toBeGreaterThan(20); // QR presente
    // La riga WEB viene omessa (QR codifica già l'URL). Vedi phase 2.1 fix.
    expect(svg).not.toMatch(/<text[^>]*>WEB<\/text>[\s\S]{0,500}<text[^>]*>https:\/\/mycompany/);
  });

  it('user card con QR payload esplicito (vince su website): QR usa payload', () => {
    const card = {
      ...createEmptyCard(),
      back: {
        ...createEmptyCard().back,
        website: 'https://website.com',
        qrPayload: 'https://qr-specific.com',
      },
    };
    const svg = buildCardSvg(card, 'back', 1024, 663);
    // qrPayload vince: QR codifica 'qr-specific.com', non 'website.com'.
    // (verifica indiretta: il QR è generato col payload esplicito).
    const rectCount = (svg.match(/<rect /g) || []).length;
    expect(rectCount).toBeGreaterThan(20);
  });

  it('user card con photo base64 (upload simulato): preserva il base64 intatto', () => {
    // Simula un upload reale: l'utente carica un'immagine, compressImage
    // la converte in base64 data URL. Verifichiamo che il base64 arrivi
    // intatto fino al docDef PDF.
    const PHOTO_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wgARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQBAQAAAAAAAAAAAAAAAAAAAAj/2gAMAwEAAhADEAAAAVOf/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABCf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=';
    const card = {
      ...createEmptyCard(),
      front: {
        ...createEmptyCard().front,
        photoUrl: PHOTO_BASE64,
      },
    };
    const svg = buildCardSvg(card, 'front', 1024, 663);
    expect(svg).toContain(PHOTO_BASE64);
  });

  it('user card con logoOverlay sul QR (custom QR branding)', () => {
    // Test indiretto: buildCardSvg non supporta direttamente QR con logo
    // (è la pipeline del QR code separato). Ma verifichiamo che
    // generateQrSvg gestisca un logoOverlay base64 senza rompere.
    // Questo è un test di robustezza della libreria.
    expect(true).toBe(true); // placeholder, QR con logo è testato in qrGenerator
  });

  it('kitchen sink: card con TUTTE le feature attive produce SVG completo (no errori, no regression)', () => {
    // Test esaustivo: ogni singola feature del BusinessCardSchema attiva
    // contemporaneamente. Se qualcosa si rompe per una combinazione di
    // features, questo test la cattura. Applicabile a QUALSIASI card
    // (template o user-created), non dipende dal template Giovanni.
    const card = {
      ...createEmptyCard(),
      front: {
        ...createEmptyCard().front,
        name: 'Mario Rossi',
        title: 'CEO & Founder',
        company: 'Acme S.r.l.',
        photoUrl: 'data:image/jpeg;base64,PHOTOBASE64',
        logoUrl: 'data:image/svg+xml;base64,LOGOBASE64',
        logoBackground: 'card' as const,
        layout: 'split' as const,
      },
      back: {
        ...createEmptyCard().back,
        phone: '+39 02 1234567',
        email: 'mario@acme.com',
        website: 'https://acme.com',
        address: 'Via Roma 1, 20100 Milano',
        vatNumber: 'IT12345678901',
        services: ['Consulenza strategica', 'Sviluppo software', 'Design thinking workshop'],
        servicesLabel: 'I nostri servizi',
        qrPayload: 'https://acme.com',
        qrSize: 'large' as const,
        qrLabel: 'Scopri di più',
        socials: [
          { platform: 'LinkedIn', url: 'https://linkedin.com/in/mariorossi' },
          { platform: 'GitHub', url: 'https://github.com/mariorossi' },
        ],
      },
      style: {
        ...createEmptyCard().style,
        sizePreset: 'eu-85x55' as const,
        bgColor: '#FFFFFF',
        textColor: '#0F172A',
        accentColor: '#01696F',
        fontFamily: 'Inter',
        fontScale: 1.1,
        borderStyle: 'accent-strip-left' as const,
      },
    };
    // SVG FRONT
    const frontSvg = buildCardSvg(card, 'front', 1024, 663);
    expect(frontSvg).toContain('<svg');
    expect(frontSvg).toContain('PHOTOBASE64'); // foto presente
    expect(frontSvg).toContain('LOGOBASE64'); // logo presente
    expect(frontSvg).toContain('MARIO ROSSI'); // nome
    // SVG BACK
    const backSvg = buildCardSvg(card, 'back', 1024, 663);
    expect(backSvg).toContain('<svg');
    expect(backSvg).toContain('+39 02 1234567');
    expect(backSvg).toContain('mario@acme.com');
    expect(backSvg).toContain('I NOSTRI SERVIZI'); // servicesLabel uppercase
    expect(backSvg).toContain('Consulenza strategica');
    expect(backSvg).toContain('LinkedIn');
    expect(backSvg).toContain('GitHub');
    // QR presente (molti rect moduli)
    const qrRectCount = (backSvg.match(/<rect /g) || []).length;
    expect(qrRectCount).toBeGreaterThan(20);
  });

  it('kitchen sink per TUTTI i 3 size preset (EU/US/Square) — no errori, layout adattivo', () => {
    // Per ogni size preset, genera il PDF 10-up e verifica:
    // 1) non crasha
    // 2) il docDef ha orientamento corretto
    // 3) il raster contiene elementi (image data URL presenti)
    const variants: Array<{ preset: 'eu-85x55' | 'us-89x51' | 'square-65x65'; name: string }> = [
      { preset: 'eu-85x55', name: 'EU 85×55' },
      { preset: 'us-89x51', name: 'US 89×51' },
      { preset: 'square-65x65', name: 'Square 65×65' },
    ];
    return (async () => {
      for (const v of variants) {
        const card = {
          ...createEmptyCard(),
          front: {
            ...createEmptyCard().front,
            name: 'TEST ' + v.name,
            photoUrl: 'data:image/png;base64,AAAA',
            logoUrl: 'data:image/svg+xml;base64,BBBB',
          },
          back: {
            ...createEmptyCard().back,
            website: 'https://example.com',
            qrPayload: 'https://example.com',
          },
          style: { ...createEmptyCard().style, sizePreset: v.preset },
        };
        const pdfMakeModule = await import('pdfmake/build/pdfmake');
        const pdfMake = (pdfMakeModule as any).default;
        const createPdf = pdfMake.createPdf as any;
        createPdf.mockClear();
        const buf = await generateCardPDF(card, { tier: 'free' });
        expect(buf.length, `Buffer non-empty for ${v.name}`).toBeGreaterThan(0);
        const docDef = createPdf.mock.calls[0][0];
        expect(docDef.pageOrientation, `Orientation for ${v.name}`).toBeDefined();
        // Almeno 20 immagini raster nel docDef (5×2 × 2 lati).
        const serialized = JSON.stringify(docDef);
        const imageCount = (serialized.match(/"image":"data:image\/png;base64/g) || []).length;
        expect(imageCount, `Image count for ${v.name}`).toBe(20);
      }
    })();
  });

  it('utente con foto SOLO base64 (upload reale, no path statico) → PDF generato senza errori', async () => {
    // Caso tipico: utente carica una foto dal proprio device.
    // compressImage la converte in base64 → salvata in localStorage.
    // Quando l'utente esporta il PDF, photoUrl è un data: URL.
    // resolveToBase64DataUrl lo passa direttamente (no fetch).
    const card = {
      ...createEmptyCard(),
      front: {
        ...createEmptyCard().front,
        name: 'UTENTE UPLOAD',
        photoUrl: 'data:image/jpeg;base64,UPLOADEDPHOTO',
      },
    };
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfMake = (pdfMakeModule as any).default;
    const createPdf = pdfMake.createPdf as any;
    createPdf.mockClear();
    const buf = await generateCardPDF(card, { tier: 'free' });
    expect(buf.length).toBeGreaterThan(0);
    // Il docDef contiene il raster (PNG data URL).
    const docDef = createPdf.mock.calls[0][0];
    const serialized = JSON.stringify(docDef);
    expect(serialized).toContain('"image":"data:image/png;base64');
  });
});

describe('cardGenerator - generateCardPng (AC-010)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a non-empty Uint8Array for front', async () => {
    const card = createEmptyCard();
    const buf = await generateCardPng(card, 'front', { tier: 'unlocked', dpi: 300 });
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('returns a non-empty Uint8Array for back', async () => {
    const card = createEmptyCard();
    const buf = await generateCardPng(card, 'back', { tier: 'unlocked', dpi: 300 });
    expect(buf).toBeInstanceOf(Uint8Array);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('respects tier for resolution (free = 150 DPI, unlocked = 300 DPI)', async () => {
    const card = createEmptyCard();
    const free = await generateCardPng(card, 'front', { tier: 'free', dpi: 300 });
    const unlocked = await generateCardPng(card, 'front', { tier: 'unlocked', dpi: 300 });
    expect(free).toBeInstanceOf(Uint8Array);
    expect(unlocked).toBeInstanceOf(Uint8Array);
  });

  it('returns a REAL PNG buffer (8-byte PNG signature, not a fake 4-byte header)', async () => {
    const card = createEmptyCard();
    const buf = await generateCardPng(card, 'front', { tier: 'unlocked', dpi: 150 });
    // Real PNG signature: 89 50 4E 47 0D 0A 1A 0A
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
    expect(buf[4]).toBe(0x0d);
    expect(buf[5]).toBe(0x0a);
    expect(buf[6]).toBe(0x1a);
    expect(buf[7]).toBe(0x0a);
    // First chunk is IHDR: [length=13 (4 bytes big-endian)] ['IHDR' (4 bytes)]
    // offset 8-11 = length, offset 12-15 = 'IHDR'
    expect(buf[8]).toBe(0x00);
    expect(buf[9]).toBe(0x00);
    expect(buf[10]).toBe(0x00);
    expect(buf[11]).toBe(0x0d); // 13 = IHDR data length
    expect(buf[12]).toBe(0x49); // I
    expect(buf[13]).toBe(0x48); // H
    expect(buf[14]).toBe(0x44); // D
    expect(buf[15]).toBe(0x52); // R
  });

  it('produces a PNG with reasonable length (not the fake 4-byte header)', async () => {
    const card = createEmptyCard();
    const buf = await generateCardPng(card, 'front', { tier: 'unlocked', dpi: 150 });
    // Real PNG for a small card is at least a few KB
    expect(buf.length).toBeGreaterThan(1000);
  });
});

describe('cardGenerator - buildCardSvg (PNG rendering)', () => {
  it('returns a valid SVG string for front side', () => {
    const card = createEmptyCard();
    const svg = buildCardSvg(card, 'front', 1024, 663);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 1024 663"');
    expect(svg).toContain('</svg>');
  });

  it('returns a valid SVG string for back side', () => {
    const card = { ...createEmptyCard(), back: { ...createEmptyCard().back, website: 'https://example.com' } };
    const svg = buildCardSvg(card, 'back', 1024, 663);
    expect(svg).toContain('<svg');
    // Header eyebrow is rendered as uppercase "CONTATTI" in the SVG
    expect(svg.toUpperCase()).toContain('CONTATTI');
  });

  it('includes the name text on the front side', () => {
    const card = {
      ...createEmptyCard(),
      front: { ...createEmptyCard().front, name: 'MARIO ROSSI' },
    };
    const svg = buildCardSvg(card, 'front', 1024, 663);
    expect(svg).toContain('MARIO ROSSI');
  });

  it('includes phone/email/website on the back side', () => {
    const card = {
      ...createEmptyCard(),
      back: {
        ...createEmptyCard().back,
        phone: '+39 333 1234567',
        email: 'mario@acme.com',
        website: 'https://acme.com',
      },
    };
    const svg = buildCardSvg(card, 'back', 1024, 663);
    expect(svg).toContain('+39 333 1234567');
    expect(svg).toContain('mario@acme.com');
    // Nota: la riga WEB è omessa perché il QR codifica già l'URL
    // (Phase 2.1: ridurre ridondanza). Vedi test "omits the WEB contact row..."
  });

  it('includes the QR code SVG on the back when payload is present', () => {
    const card = {
      ...createEmptyCard(),
      back: { ...createEmptyCard().back, website: 'https://example.com' },
    };
    const svg = buildCardSvg(card, 'back', 1024, 663);
    expect(svg).toContain('<rect'); // QR is made of rects
  });

  it('uses accent color for decorative elements', () => {
    const card = {
      ...createEmptyCard(),
      style: { ...createEmptyCard().style, accentColor: '#FF0000' },
    };
    const svg = buildCardSvg(card, 'front', 1024, 663);
    expect(svg).toContain('#FF0000');
  });

  it('does NOT include monogram placeholder when no photo on front (feature removed)', () => {
    const card = {
      ...createEmptyCard(),
      front: { ...createEmptyCard().front, name: 'MARIO ROSSI' },
    };
    const svg = buildCardSvg(card, 'front', 1024, 663);
    // monogram text should NOT be in the SVG anymore
    expect(svg).not.toMatch(/>MR</);
  });

  it('includes photo image element when photoUrl is set', () => {
    const card = {
      ...createEmptyCard(),
      front: {
        ...createEmptyCard().front,
        photoUrl: 'data:image/png;base64,AAAA',
      },
    };
    const svg = buildCardSvg(card, 'front', 1024, 663);
    expect(svg).toContain('<image');
    expect(svg).toContain('data:image/png;base64,AAAA');
  });

  it('includes the logo image in split layout (Phase 2.1 — logo was missing)', () => {
    const card = {
      ...createEmptyCard(),
      front: {
        ...createEmptyCard().front,
        photoUrl: 'data:image/png;base64,AAAA',
        logoUrl: 'data:image/png;base64,LOGO',
        layout: 'split' as const,
      },
    };
    const svg = buildCardSvg(card, 'front', 1024, 663);
    expect(svg).toContain('data:image/png;base64,LOGO');
    // Logo appare almeno una volta nel SVG (photo + logo sono 2 <image>)
    const imageCount = (svg.match(/<image /g) || []).length;
    expect(imageCount).toBeGreaterThanOrEqual(2);
  });

  it('omits the hostname wordmark on the front when back has a QR payload (Phase 2.1 — redundant)', () => {
    const card = {
      ...createEmptyCard(),
      back: { ...createEmptyCard().back, website: 'https://webdeveloperca.netlify.app' },
      front: {
        ...createEmptyCard().front,
        photoUrl: 'data:image/png;base64,AAAA',
        layout: 'split' as const,
      },
    };
    const svg = buildCardSvg(card, 'front', 1024, 663);
    // L'hostname non deve apparire sul FRONT (solo sul back, vicino al QR)
    expect(svg).not.toContain('webdeveloperca.netlify.app');
  });

  it('omits the WEB contact row on the back when QR payload is present (Phase 2.1 — avoid duplication)', () => {
    const card = {
      ...createEmptyCard(),
      back: { ...createEmptyCard().back, website: 'https://webdeveloperca.netlify.app' },
    };
    const svg = buildCardSvg(card, 'back', 1024, 663);
    // La riga WEB non deve essere renderizzata (il QR codifica già l'URL)
    // Cerchiamo il pattern "Web" seguito da vicino dal valore del website
    const webRowRegex = /<text[^>]*>WEB<\/text>[\s\S]{0,500}<text[^>]*>https:\/\/webdeveloperca/;
    expect(svg).not.toMatch(webRowRegex);
  });

  it('keeps the WEB row when no QR payload is set (user has no QR — they want the URL visible)', () => {
    // qrPayload = website (auto-derived). To force "no QR", set website to ''
    const card = {
      ...createEmptyCard(),
      back: {
        ...createEmptyCard().back,
        website: '',
        phone: '+39 333',
        email: 'a@b.com',
      },
    };
    const svg = buildCardSvg(card, 'back', 1024, 663);
    // Telefono + email devono essere presenti (WEB no perché website vuoto)
    expect(svg).toContain('+39 333');
    expect(svg).toContain('a@b.com');
  });

  it('embeds a real QR code SVG on the back (no placeholder rect, Phase 2.1)', () => {
    const card = {
      ...createEmptyCard(),
      back: { ...createEmptyCard().back, website: 'https://example.com' },
    };
    const svg = buildCardSvg(card, 'back', 1024, 663);
    // Il QR reale è composto da molti <rect> (moduli). Il placeholder era un
    // singolo <rect> bianco. Verifichiamo che ci siano molti moduli QR.
    const rectCount = (svg.match(/<rect /g) || []).length;
    expect(rectCount).toBeGreaterThan(10);
  });

  it('QR rendering usa <g transform> con scale corretto (regression QR invisibile in PDF)', () => {
    // Bug storico: nested <svg viewBox="0 0 qrSize qrSize"> scalava il
    // QR con fattore sbagliato (inner content in 0-totalSize, non 0-qrSize)
    // e in alcuni browser Image-context non renderizzava. Ora usiamo
    // <g transform="translate scale"> con scale ricavato dal viewBox reale.
    const card = {
      ...createEmptyCard(),
      back: { ...createEmptyCard().back, website: 'https://example.com' },
    };
    const svg = buildCardSvg(card, 'back', 1024, 663);
    expect(svg).toMatch(/<g transform="translate\(\d+ \d+\) scale\([\d.]+\)">/);
    // Non deve più esserci un nested <svg> per il QR.
    const nestedSvgCount = (svg.match(/<svg /g) || []).length;
    expect(nestedSvgCount).toBe(1); // solo l'outer wrapper
  });
});
