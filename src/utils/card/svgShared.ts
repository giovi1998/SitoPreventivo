import type { BusinessCard } from '../documentSchemas';
import { FONT_SCALE_MIN, FONT_SCALE_MAX } from '../documentSchemas';
import { estimateCharsForWidth, measureTextWidth, type MeasureTextOptions } from './textMeasure';

export { escapeXml } from '../xml';

// Phase 2.2 REQ-D04: helper per scalare la dimensione del testo in base
// a `card.style.fontScale` (clamp 0.7-1.5, default 1). Da usare in tutti
// i `font-size="..."` del SVG export. Il `base` è la percentuale di `pxH`
// (o `photoSize`) da usare come base; il valore finale è arrotondato.
export function fs(base: number, fontScale: number): number {
  const f = typeof fontScale === 'number' && !Number.isNaN(fontScale) ? fontScale : 1;
  const clamped = Math.max(FONT_SCALE_MIN, Math.min(FONT_SCALE_MAX, f));
  return Math.max(1, Math.round(base * clamped));
}

// v2.7 (bug fix): l'export SVG/PDF/PNG ignorava `card.style.fontFamily`
// e usava sempre "Inter, system-ui, sans-serif" a prescindere dal font
// scelto dall'utente (es. "Oswald"), mentre la preview React lo applica
// via CSS su tutta la card (`CardPreview.tsx`). Risultato: preview ed
// export mostravano font diversi. Fix: deriviamo lo stesso valore CSS
// (con fallback generico coerente: serif/monospace/sans-serif) e lo
// usiamo in ogni `font-family="..."` dell'SVG generato.
const SERIF_FONTS = new Set(['Georgia', 'Times New Roman', 'Playfair Display', 'Merriweather']);
const MONOSPACE_FONTS = new Set(['Courier New']);

export function svgFontFamily(card: BusinessCard): string {
  const raw = (card.style.fontFamily || 'Inter').trim() || 'Inter';
  const generic = MONOSPACE_FONTS.has(raw) ? 'monospace' : SERIF_FONTS.has(raw) ? 'serif' : 'sans-serif';
  const safe = raw.replace(/['"]/g, '');
  const quoted = safe.includes(' ') ? `'${safe}'` : safe;
  return `${quoted}, ${generic}`;
}

export interface BuildSvgOptions {
  withBleed?: boolean;
  includeDebugBoxes?: boolean;
  rotate?: 0 | 90 | 180 | 270;
  /** v2.7.1: optional self-contained font CSS (base64 embedded) for canvas/PNG/PDF export */
  embeddedFontCss?: string;
}

// Simple luminance check to decide if a hex color is light.
export function isLightColor(hex: string): boolean {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return false;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return false;
  // ITU-R BT.601 luminance
  const y = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return y > 0.6;
}

// Width-aware wrap: split text at word boundaries, punctuation (@ . - _ / \s),
// or hard character bounds so long emails/URLs do not overflow cells.
// v2.17 (spec v2.0 REQ-TXT-001): measurement goes through textMeasure —
// real canvas metrics (with the card's actual font family) in the browser,
// the legacy 0.52 heuristic as the no-canvas fallback (jsdom tests stay
// deterministic and byte-identical to the previous estimate).
export function wrapTextAtWhitespace(
  text: string,
  maxWidthPx: number,
  fontSize: number,
  fontFamily?: string,
): string[] {
  if (!text) return [];
  const measureOpts: MeasureTextOptions = { fontSize, fontFamily };
  const maxChars = estimateCharsForWidth(maxWidthPx, measureOpts);
  const measure = (s: string) => measureTextWidth(s, measureOpts);

  const tokens = text.split(/([/@._\-\s]+)/).filter((s) => s.length > 0);
  const lines: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (current) {
      const trimmed = current.trim();
      if (trimmed) lines.push(trimmed);
      current = '';
    }
  };

  for (const rawToken of tokens) {
    const isSep = /^[/@._\-\s]+$/.test(rawToken);
    const subTokens = !isSep && rawToken.length > maxChars
      ? (rawToken.match(new RegExp(`.{1,${maxChars}}`, 'g')) || [rawToken])
      : [rawToken];

    for (const token of subTokens) {
      const candidate = current ? current + token : token;

      if (measure(candidate) <= maxWidthPx) {
        current = candidate;
      } else {
        if (current) {
          pushCurrent();
          // Keep a punctuation separator at the wrap point (start of the new
          // line) so wrapped emails/URLs never lose characters — dropping it
          // turned "…@gmail" + ".com" into "…@gmail" + "com". Leading spaces
          // are still trimmed away by pushCurrent, so word wraps look the same.
          current = token;
        } else {
          lines.push(token);
          current = '';
        }
      }
    }
  }
  pushCurrent();
  return lines.length > 0 ? lines : [text];
}

export function extractQrInner(qrSvg: string): string {
  const m = qrSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  if (!m) return '';
  return m[1];
}

export function buildGridDebugSvg(grid: NonNullable<BusinessCard['grid']>, pxW: number, pxH: number): string {
  const colors: Record<string, string> = {
    photo: '#ef4444',
    name: '#3b82f6',
    title: '#10b981',
    company: '#f59e0b',
    logo: '#8b5cf6',
    contacts: '#6366f1',
    qr: '#14b8a6',
    socials: '#f43f5e',
    services: '#a855f7',
  };
  const cellW = pxW / grid.cols;
  const cellH = pxH / grid.rows;
  let out = '';
  Object.entries(grid.elements).forEach(([key, el]) => {
    if (!el) return;
    const x = el.x * cellW;
    const y = el.y * cellH;
    const w = el.w * cellW;
    const h = el.h * cellH;
    const color = colors[key] || '#94a3b8';
    out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="2" opacity="0.7"/>`;
    out += `<text x="${x + 4}" y="${y + 14}" font-family="Inter, system-ui, sans-serif" font-size="10" fill="${color}" font-weight="700">${key}</text>`;
  });
  return out;
}
