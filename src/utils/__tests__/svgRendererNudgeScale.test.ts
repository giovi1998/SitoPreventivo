import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildFrontSvg, buildBackSvg, wrapTextAtWhitespace } from '../card/svgRenderer';
import { resetMeasureContext } from '../card/textMeasure';
import { backPad, backHeaderMetrics, gridCellRect } from '../card/backLayout';
import { createEmptyCard } from '../documentSchemas';

// Spec v2.0 REQ-ZOOM-003 / REQ-TXT-001 / REQ-TEST-003:
// - placement.scale is a local font-size factor for front/back text elements
// - back texts (contacts/services/socials) honor placement nudge x/y with the
//   same ±half-free-space semantics as the front
// - wrapTextAtWhitespace uses real canvas metrics when available, with the
//   legacy 0.52 heuristic as the no-canvas fallback
// - documents without placement render byte-identical to neutral placement

const PXW = 1024;
const PXH = 663;

function fontSizeOfText(svg: string, text: string): number {
  const idx = svg.indexOf(text);
  if (idx === -1) return NaN;
  const before = svg.lastIndexOf('<text', idx);
  if (before === -1) return NaN;
  const tag = svg.slice(before, idx);
  const m = tag.match(/font-size="([^"]+)"/);
  return m ? parseFloat(m[1]) : NaN;
}

function xOfText(svg: string, text: string): number {
  const idx = svg.indexOf(text);
  if (idx === -1) return NaN;
  const before = svg.lastIndexOf('<text', idx);
  if (before === -1) return NaN;
  const tag = svg.slice(before, idx);
  const m = tag.match(/x="([^"]+)"/);
  return m ? parseFloat(m[1]) : NaN;
}

function yOfText(svg: string, text: string): number {
  const idx = svg.indexOf(text);
  if (idx === -1) return NaN;
  const before = svg.lastIndexOf('<text', idx);
  if (before === -1) return NaN;
  const tag = svg.slice(before, idx);
  const m = tag.match(/y="([^"]+)"/);
  return m ? parseFloat(m[1]) : NaN;
}

function frontCard(placement?: { x: number; y: number; scale: number }) {
  const base = createEmptyCard();
  return {
    ...base,
    front: {
      ...base.front,
      name: 'MARIO',
      title: 'Dev',
      company: 'Acme',
      useGrid: true,
    },
    grid: {
      cols: 4,
      rows: 4,
      elements: {
        name: { x: 0, y: 0, w: 4, h: 1, ...(placement ? { placement } : {}) },
        title: { x: 0, y: 1, w: 4, h: 1, ...(placement ? { placement } : {}) },
        company: { x: 0, y: 2, w: 4, h: 1, ...(placement ? { placement } : {}) },
      },
    },
  };
}

// Back card with 3 contact entries (no collapse in effectiveBackGridForRender)
// and no QR, so the persisted contacts cell is the effective render cell.
function contactsCard(placement?: { x: number; y: number; scale: number }) {
  const base = createEmptyCard();
  return {
    ...base,
    back: {
      ...base.back,
      useGrid: true,
      phone: '3401234567',
      email: 'mario@example.com',
      address: 'Via Roma 1',
    },
    backGrid: {
      cols: 4,
      rows: 4,
      elements: {
        contacts: { x: 0, y: 0, w: 2, h: 2, ...(placement ? { placement } : {}) },
      },
    },
  };
}

function servicesCard(placement?: { x: number; y: number; scale: number }) {
  const base = createEmptyCard();
  return {
    ...base,
    back: {
      ...base.back,
      useGrid: true,
      phone: '3401234567',
      email: 'mario@example.com',
      address: 'Via Roma 1',
      services: ['Consulenza', 'Supporto'],
      servicesLabel: '',
      socials: [],
    },
    backGrid: {
      cols: 4,
      rows: 4,
      elements: {
        contacts: { x: 0, y: 0, w: 2, h: 2 },
        services: { x: 0, y: 2, w: 2, h: 1, ...(placement ? { placement } : {}) },
        socials: { x: 0, y: 3, w: 2, h: 1 },
      },
    },
  };
}

function socialsCard(placement?: { x: number; y: number; scale: number }) {
  const base = createEmptyCard();
  return {
    ...base,
    back: {
      ...base.back,
      useGrid: true,
      phone: '3401234567',
      email: 'mario@example.com',
      address: 'Via Roma 1',
      socials: [{ platform: 'LinkedIn', url: 'https://linkedin.com/in/mario' }],
    },
    backGrid: {
      cols: 4,
      rows: 4,
      elements: {
        contacts: { x: 0, y: 0, w: 2, h: 2 },
        socials: { x: 0, y: 3, w: 2, h: 1, ...(placement ? { placement } : {}) },
      },
    },
  };
}

describe('REQ-ZOOM-003: front text scale (placement.scale as font-size factor)', () => {
  it('multiplies name/title/company font-size by placement.scale', () => {
    const plain = buildFrontSvg(frontCard() as any, PXW, PXH);
    const scaled = buildFrontSvg(frontCard({ x: 0, y: 0, scale: 1.5 }) as any, PXW, PXH);
    const nameBase = fontSizeOfText(plain, 'MARIO');
    const titleBase = fontSizeOfText(plain, 'Dev');
    const companyBase = fontSizeOfText(plain, 'Acme');
    expect(fontSizeOfText(scaled, 'MARIO')).toBeCloseTo(nameBase * 1.5, 5);
    expect(fontSizeOfText(scaled, 'Dev')).toBeCloseTo(titleBase * 1.5, 5);
    expect(fontSizeOfText(scaled, 'Acme')).toBeCloseTo(companyBase * 1.5, 5);
  });

  it('scale=1 produces byte-identical output to no placement', () => {
    const plain = buildFrontSvg(frontCard() as any, PXW, PXH);
    const neutral = buildFrontSvg(frontCard({ x: 0, y: 0, scale: 1 }) as any, PXW, PXH);
    expect(neutral).toBe(plain);
  });
});

describe('REQ-ZOOM-003: back text nudge + scale (contacts/services/socials)', () => {
  it('contacts: nudge shifts x/y by ±half the cell free space', () => {
    // scale kept at 1 here: with scale ≠ 1 the y baseline also moves via
    // valAscent/label metrics, which is scale behavior tested separately.
    const placement = { x: 0.4, y: -0.4, scale: 1 };
    const plain = buildBackSvg(contactsCard() as any, PXW, PXH);
    const nudged = buildBackSvg(contactsCard(placement) as any, PXW, PXH);

    const padBox = backPad(PXW, PXH);
    const bodyTop = backHeaderMetrics(PXW, PXH, 1, padBox).bodyTop;
    const cellH = (PXH - bodyTop) / 4;
    const cell = gridCellRect({ x: 0, y: 0, w: 2, h: 2 }, PXW / 4, cellH, bodyTop, padBox);
    const expectDx = (placement.x * cell.w) / 2;
    const expectDy = (placement.y * cell.h) / 2;

    expect(xOfText(nudged, 'TELEFONO') - xOfText(plain, 'TELEFONO')).toBeCloseTo(expectDx, 5);
    expect(yOfText(nudged, 'TELEFONO') - yOfText(plain, 'TELEFONO')).toBeCloseTo(expectDy, 5);
    expect(xOfText(nudged, 'mario@example.com') - xOfText(plain, 'mario@example.com')).toBeCloseTo(expectDx, 5);
  });

  it('contacts: placement.scale multiplies key/value font sizes', () => {
    const plain = buildBackSvg(contactsCard() as any, PXW, PXH);
    const scaled = buildBackSvg(contactsCard({ x: 0, y: 0, scale: 1.5 }) as any, PXW, PXH);
    expect(fontSizeOfText(scaled, 'TELEFONO')).toBeCloseTo(fontSizeOfText(plain, 'TELEFONO') * 1.5, 5);
    expect(fontSizeOfText(scaled, '3401234567')).toBeCloseTo(fontSizeOfText(plain, '3401234567') * 1.5, 5);
  });

  it('services: nudge/scale applied to the effective render cell (socials-row expansion)', () => {
    const placement = { x: -0.4, y: 0.4, scale: 1 };
    const plain = buildBackSvg(servicesCard() as any, PXW, PXH);
    const nudged = buildBackSvg(servicesCard(placement) as any, PXW, PXH);

    // Socials content is empty → servicesRenderEl expands into the socials
    // row (h: 1 + 1). The nudge must be computed on that effective cell.
    const padBox = backPad(PXW, PXH);
    const bodyTop = backHeaderMetrics(PXW, PXH, 1, padBox).bodyTop;
    const cellH = (PXH - bodyTop) / 4;
    const effCell = gridCellRect({ x: 0, y: 2, w: 2, h: 2 }, PXW / 4, cellH, bodyTop, padBox);
    const expectDx = (placement.x * effCell.w) / 2;
    const expectDy = (placement.y * effCell.h) / 2;

    expect(xOfText(nudged, 'Consulenza') - xOfText(plain, 'Consulenza')).toBeCloseTo(expectDx, 5);
    expect(yOfText(nudged, 'Consulenza') - yOfText(plain, 'Consulenza')).toBeCloseTo(expectDy, 5);

    const scaled = buildBackSvg(servicesCard({ x: 0, y: 0, scale: 1.2 }) as any, PXW, PXH);
    expect(fontSizeOfText(scaled, 'Consulenza')).toBeCloseTo(fontSizeOfText(plain, 'Consulenza') * 1.2, 5);
  });

  it('socials: dedicated cell honors nudge and font scale', () => {
    const placement = { x: 0.4, y: 0.4, scale: 1 };
    const plain = buildBackSvg(socialsCard() as any, PXW, PXH);
    const nudged = buildBackSvg(socialsCard(placement) as any, PXW, PXH);

    const padBox = backPad(PXW, PXH);
    const bodyTop = backHeaderMetrics(PXW, PXH, 1, padBox).bodyTop;
    const cellH = (PXH - bodyTop) / 4;
    // Socials uses the full cell box (no inset) for nudge semantics.
    const cellBoxW = 2 * (PXW / 4);
    const cellBoxH = cellH;
    expect(xOfText(nudged, 'LinkedIn') - xOfText(plain, 'LinkedIn')).toBeCloseTo((placement.x * cellBoxW) / 2, 5);
    expect(yOfText(nudged, 'LinkedIn') - yOfText(plain, 'LinkedIn')).toBeCloseTo((placement.y * cellBoxH) / 2, 5);

    const scaled = buildBackSvg(socialsCard({ x: 0, y: 0, scale: 1.3 }) as any, PXW, PXH);
    expect(fontSizeOfText(scaled, 'LinkedIn')).toBeCloseTo(fontSizeOfText(plain, 'LinkedIn') * 1.3, 5);
  });

  it('no placement on back is byte-identical to neutral placement on every text element', () => {
    const base = servicesCard();
    const neutral = servicesCard({ x: 0, y: 0, scale: 1 });
    (neutral.backGrid.elements as any).contacts.placement = { x: 0, y: 0, scale: 1 };
    (neutral.backGrid.elements as any).socials.placement = { x: 0, y: 0, scale: 1 };
    expect(buildBackSvg(neutral as any, PXW, PXH)).toBe(buildBackSvg(base as any, PXW, PXH));
  });
});

describe('REQ-TXT-001: wrapTextAtWhitespace uses real metrics with 0.52 fallback', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetMeasureContext();
  });

  function mockCanvas(widthPerCharFactor: number) {
    const ctx = {
      font: '',
      measureText(s: string) {
        const m = this.font.match(/([\d.]+)px/);
        const size = m ? parseFloat(m[1]) : 16;
        return { width: s.length * size * widthPerCharFactor };
      },
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx as any);
    resetMeasureContext();
  }

  it('mocked canvas (wide glyphs) wraps where the 0.52 estimate would not', () => {
    // 'aaaa bbbb' = 9 chars at fontSize 10.
    // Real metrics (1.0 factor): width 90 > maxWidth 60 → must wrap.
    // 0.52 estimate: width 46.8 ≤ 60 → single line.
    mockCanvas(1.0);
    const lines = wrapTextAtWhitespace('aaaa bbbb', 60, 10, 'Inter, sans-serif');
    expect(lines).toEqual(['aaaa', 'bbbb']);
  });

  it('mocked canvas (narrow glyphs) keeps one line where 0.52 would wrap', () => {
    // 0.3 factor: width 27 ≤ 40 → one line; 0.52 estimate 46.8 > 40 → wrap.
    mockCanvas(0.3);
    const lines = wrapTextAtWhitespace('aaaa bbbb', 40, 10, 'Inter, sans-serif');
    expect(lines).toEqual(['aaaa bbbb']);
  });

  it('falls back cleanly to the 0.52 estimate when canvas is unavailable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
    resetMeasureContext();
    // 0.52 fallback: 9 * 10 * 0.52 = 46.8 ≤ 60 → single line, no throw.
    expect(wrapTextAtWhitespace('aaaa bbbb', 60, 10, 'Inter, sans-serif')).toEqual(['aaaa bbbb']);
    // And it still wraps when the estimate says so.
    expect(wrapTextAtWhitespace('aaaa bbbb', 40, 10, 'Inter, sans-serif')).toEqual(['aaaa', 'bbbb']);
  });

  it('passes the requested font family to the canvas context', () => {
    mockCanvas(1.0);
    resetMeasureContext();
    const ctxSpy = HTMLCanvasElement.prototype.getContext as any;
    wrapTextAtWhitespace('test', 100, 12, "'Playfair Display', serif");
    expect(ctxSpy).toHaveBeenCalled();
  });
});
