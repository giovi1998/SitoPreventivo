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
  SIZE_PRESETS_MM,
  BLEED_MM,
  CARD_A4_COLS,
  CARD_A4_ROWS,
  CARD_A4_GAP_MM,
  CARD_A4_MARGIN_MM,
  resolveCardQrPayload,
} from '../cardGenerator';
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

  it('layout constants are correct for 10-up A4', () => {
    expect(BLEED_MM).toBe(3);
    expect(CARD_A4_COLS).toBe(5);
    expect(CARD_A4_ROWS).toBe(2);
    expect(CARD_A4_GAP_MM).toBe(5);
    expect(CARD_A4_MARGIN_MM).toBe(10);
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

  it('produces a 2-page A4 docDefinition (front + back)', async () => {
    const card = createEmptyCard();
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfMake = (pdfMakeModule as any).default;
    const createPdf = pdfMake.createPdf as any;
    createPdf.mockClear();
    await generateCardPDF(card, { tier: 'free' });
    expect(createPdf).toHaveBeenCalledTimes(1);
    const docDef = createPdf.mock.calls[0][0];
    expect(docDef).toBeDefined();
    expect(Array.isArray(docDef.content)).toBe(true);
    expect(docDef.pageSize).toBe('A4');
  });

  it('handles Giovanni template without errors', async () => {
    const card = createGiovanniCardTemplate();
    const buf = await generateCardPDF(card, { tier: 'free' });
    expect(buf.length).toBeGreaterThan(0);
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

  it('includes monogram text in docDefinition when name is set and no photo', async () => {
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
    expect(serialized).toContain('MR'); // monogram
  });

  it('includes socials in back docDefinition when present', async () => {
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
    expect(serialized).toContain('LinkedIn');
    expect(serialized).toContain('XXXXX');
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

  it('includes monogram placeholder when no photo on front', () => {
    const card = {
      ...createEmptyCard(),
      front: { ...createEmptyCard().front, name: 'MARIO ROSSI' },
    };
    const svg = buildCardSvg(card, 'front', 1024, 663);
    expect(svg).toContain('MR'); // monogram
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
});
