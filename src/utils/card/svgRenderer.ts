import type { BusinessCard, CardGrid } from '../documentSchemas';
import { FONT_SCALE_MIN, FONT_SCALE_MAX, deriveGridFromLayout, hasGridElements } from '../documentSchemas';
import { generateQrSvg } from '../qrGenerator';
import { resolveCardQrPayload, getEffectiveQrPayload } from './qrPayload';
import { deriveHostname, deriveHandle } from './textDerivation';
import {
  backPad,
  backHeaderMetrics,
  gridCellRect,
  gridCellBox,
  alignBoxInCell,
  backQrSizePx,
  effectiveBackGridForRender,
} from './backLayout';
import { renderDecorativePattern } from '../decorations/patterns';

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

// v2.7: quando l'SVG viene caricato come Image (canvas pipeline per PNG/PDF)
// o aperto come file standalone, il font-family non è disponibile perché
// l'SVG è isolato dalla pagina. Il `<style>@import url(...)</style>` dentro
// l'SVG fa sì che il browser carichi il font insieme al resto del SVG,
// garantendo che canvas e viewer mostrino il font corretto.
export const GOOGLE_FONTS_BASE = 'https://fonts.googleapis.com/css2?family=';
export const FONT_TO_GOOGLE_URL: Record<string, string> = {
  Inter: 'Inter:wght@400;500;600;700;800&display=swap',
  Roboto: 'Roboto:wght@400;500;700&display=swap',
  'Open Sans': 'Open+Sans:wght@400;500;600;700;800&display=swap',
  Lato: 'Lato:wght@400;700;900&display=swap',
  Montserrat: 'Montserrat:wght@400;500;600;700;800&display=swap',
  Poppins: 'Poppins:wght@400;500;600;700;800&display=swap',
  'Source Sans 3': 'Source+Sans+3:wght@400;600;700&display=swap',
  'DM Sans': 'DM+Sans:wght@400;500;600;700&display=swap',
  Figtree: 'Figtree:wght@400;500;600;700;800&display=swap',
  'Plus Jakarta Sans': 'Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
  Oswald: 'Oswald:wght@400;500;600;700&display=swap',
  Raleway: 'Raleway:wght@400;500;600;700;800&display=swap',
  'Playfair Display': 'Playfair+Display:wght@400;500;600;700;800&display=swap',
  Merriweather: 'Merriweather:wght@400;700;900&display=swap',
};

const FONT_DATA_CACHE = new Map<string, Promise<string | undefined>>();

function cleanFontFamily(fontFamily: string): string {
  return fontFamily.trim().split(',')[0].replace(/['"]/g, '');
}

export function buildSvgFontImport(fontFamily: string): string {
  const clean = cleanFontFamily(fontFamily);
  const suffix = FONT_TO_GOOGLE_URL[clean];
  if (!suffix) return '';
  const url = `${GOOGLE_FONTS_BASE}${suffix}`.replace(/&/g, '&amp;');
  return `<style>@import url('${url}');</style>`;
}

/**
 * v2.7.1: build a self-contained `<style>` tag with the requested Google Font
 * embedded as base64 data URIs. This is the only reliable way to make fonts
 * render synchronously when the SVG is loaded into a canvas or into an `<img>`
 * element, because `@import` fonts are loaded asynchronously and drawImage()
 * runs before they are available.
 *
 * The result is cached per font family.
 */
export async function buildEmbeddedFontImport(fontFamily: string): Promise<string> {
  const clean = cleanFontFamily(fontFamily);
  const suffix = FONT_TO_GOOGLE_URL[clean];
  if (!suffix) return '';

  if (FONT_DATA_CACHE.has(clean)) {
    return (await FONT_DATA_CACHE.get(clean)) ?? '';
  }

  const loadPromise = (async () => {
    const cssUrl = `${GOOGLE_FONTS_BASE}${suffix}`;
    try {
      const response = await fetch(cssUrl, { mode: 'cors' });
      if (!response.ok) return undefined;
      let cssText = await response.text();

      // v2.8.2: the regex must capture the value inside url(...) without the
      // surrounding `url(` and `)`, otherwise the replacement becomes
      // `url(url(data:...))` and the browser rejects the @font-face src.
      const urlMatches = Array.from(cssText.matchAll(/url\((https:\/\/[^)]+)\)/g));
      const replacements = await Promise.all(
        urlMatches.map(async (match) => {
          const rawUrl = match[1];
          try {
            const fontResponse = await fetch(rawUrl, { mode: 'cors' });
            if (!fontResponse.ok) return null;
            const blob = await fontResponse.blob();
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result as string;
                const comma = result.indexOf(',');
                resolve(comma >= 0 ? result.slice(comma + 1) : '');
              };
              reader.onerror = () => reject(reader.error || new Error('FileReader error'));
              reader.readAsDataURL(blob);
            });
            const mime = fontResponse.headers.get('content-type') ?? 'font/woff2';
            return { fullMatch: match[0], dataUrl: `url(data:${mime};base64,${base64})` };
          } catch {
            return null;
          }
        }),
      );

      replacements.forEach((r) => {
        if (r) cssText = cssText.split(r.fullMatch).join(r.dataUrl);
      });

      return `<style>${cssText}</style>`;
    } catch {
      return undefined;
    }
  })();

  FONT_DATA_CACHE.set(clean, loadPromise);
  return (await loadPromise) ?? '';
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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

export function buildFrontSvg(
  card: BusinessCard,
  pxW: number,
  pxH: number,
  opts: BuildSvgOptions = {},
): string {
  const bg = card.style.bgColor;
  const text = card.style.textColor;
  const accent = card.style.accentColor;
  const hasPhoto = !!card.front.photoUrl;
  const hasLogo = !!card.front.logoUrl;
  const fontScale = card.style.fontScale ?? 1;
  const fontFamily = svgFontFamily(card);

  const pad = Math.max(10, Math.round(pxW * 0.04));
  const stripW = Math.max(2, Math.round(pxW * 0.008));

  let out = '';

  // 0. Base background (only visible where cover image is missing or transparent)
  out += `<rect width="${pxW}" height="${pxH}" fill="${bg}"/>`;

  // 1. AI-generated cover image (full-bleed on top of base background)
  if (card.front.coverImageUrl) {
    out += `<image href="${escapeXml(card.front.coverImageUrl)}" x="0" y="0" width="${pxW}" height="${pxH}" preserveAspectRatio="xMidYMid slice"/>`;
  }
  // 1a. Readability wash on top of the cover.
  //
  // Two stacked semi-transparent layers, both using the card's own
  // background tint (`bgColor`). The first is a flat 35% wash that
  // flattens the cover's gradients into a calm tinted page; the second
  // is a soft vertical gradient that goes from 0% (full cover visible
  // at the top) to 50% (mostly the bg tint) at the bottom, so the
  // area where the user name sits in the default front grid is calmer
  // than the photo region at the top. This guarantees readable text
  // even when the AI cover happens to be too busy or too dark.
  if (card.front.coverImageUrl) {
    out += `<rect width="${pxW}" height="${pxH}" fill="${bg}" opacity="0.6"/>`;
    out += `<defs><linearGradient id="frontReadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${bg}" stop-opacity="0"/>
      <stop offset="55%" stop-color="${bg}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${bg}" stop-opacity="0.8"/>
    </linearGradient></defs>`;
    out += `<rect width="${pxW}" height="${pxH}" fill="url(#frontReadGrad)"/>`;
  }

  // 2. Decorative pattern: user-selected pattern overrides the legacy
  // corner radial gradient and diagonal accent pattern when present.
  if (card.decorations?.pattern) {
    out += renderDecorativePattern(card.decorations.pattern, pxW, pxH, {
      palette: card.decorations.palette || { primary: accent, secondary: text },
      opacity: card.decorations.opacity ?? 0.2,
    });
  } else {
    // Corner radial gradient (matches CSS .card-corner-accent)
    const cornerSize = Math.round(Math.min(pxW, pxH) * 0.28);
    out += `<defs><radialGradient id="cornerGrad" cx="100%" cy="0%" r="80%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient></defs>`;
    out += `<rect x="${pxW - cornerSize}" y="0" width="${cornerSize}" height="${cornerSize}" fill="url(#cornerGrad)"/>`;
  }

  // 3. Accent strip left
  if (card.style.borderStyle === 'accent-strip-left') {
    out += `<rect x="0" y="0" width="${stripW}" height="${pxH}" fill="${accent}"/>`;
  }
  // 4. Accent strip bottom
  if (card.style.borderStyle === 'accent-strip-bottom') {
    const stripH = Math.max(2, Math.round(pxH * 0.012));
    out += `<rect x="0" y="${pxH - stripH}" width="${pxW}" height="${stripH}" fill="${accent}"/>`;
  }

  // 5. Diagonal fallback pattern (only when no user pattern)
  if (!card.decorations?.pattern) {
    const patternSize = Math.max(8, Math.round(pxW * 0.02));
    out += `<defs><pattern id="diag" patternUnits="userSpaceOnUse" width="${patternSize}" height="${patternSize}" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="${patternSize}" stroke="${accent}" stroke-width="0.6" opacity="0.06"/>
    </pattern></defs>`;
    out += `<rect x="${Math.round(pxW * 0.6)}" y="0" width="${Math.round(pxW * 0.4)}" height="${Math.round(pxH * 0.35)}" fill="url(#diag)"/>`;
  }

  // 6. Render front from card.grid (single source of truth)
  // v2.8: when front.useGrid is false OR the grid has no elements, derive
  // fresh from layout so stale grids don't hide content (same fix as back).
  const rawFrontGrid = card.front.useGrid && hasGridElements('front', card) ? card.grid : undefined;
  const grid = rawFrontGrid ?? deriveGridFromLayout(card, 'front');
  if (grid && grid.cols > 0 && grid.rows > 0) {
    const cellW = pxW / grid.cols;
    const cellH = pxH / grid.rows;

    const photoEl = grid.elements.photo;
    if (hasPhoto && photoEl) {
      const x = photoEl.x * cellW;
      const y = photoEl.y * cellH;
      const w = photoEl.w * cellW;
      const h = photoEl.h * cellH;
      const isPhotoCircle = card.front.layout === 'photo-circle';
      const pp = photoEl.photoPlacement;
      const scale = pp?.scale ?? 1;
      const dx = ((pp?.x ?? 0) * w) / 2;
      const dy = ((pp?.y ?? 0) * h) / 2;
      // scaled image rect centered on cell, then nudged by placement.
      const imgW = w * scale;
      const imgH = h * scale;
      const imgX = x + (w - imgW) / 2 + dx;
      const imgY = y + (h - imgH) / 2 + dy;
      if (isPhotoCircle) {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const r = Math.min(w, h) / 2;
        out += `<defs><clipPath id="photoCircle"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>`;
        out += `<image href="${escapeXml(card.front.photoUrl!)}" x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#photoCircle)"/>`;
      } else {
        out += `<image href="${escapeXml(card.front.photoUrl!)}" x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" preserveAspectRatio="xMidYMid slice" clip-path="inset(0 round 6)"/>`;
      }
    }

    const logoEl = grid.elements.logo;
    if (hasLogo && logoEl) {
      const x = logoEl.x * cellW;
      const y = logoEl.y * cellH;
      const w = logoEl.w * cellW;
      const h = logoEl.h * cellH;
      // v2.12: logo box is 72% of the cell (matches preview CSS max-width/height)
      // so 3×3 alignment can move it. preserveAspectRatio keeps artwork aspect.
      const alignH = logoEl.alignH ?? 'center';
      const alignV = logoEl.alignV ?? 'center';
      const xAlign = alignH === 'left' ? 'xMin' : alignH === 'right' ? 'xMax' : 'xMid';
      const yAlign = alignV === 'top' ? 'YMin' : alignV === 'bottom' ? 'YMax' : 'YMid';
      const logoW = w * 0.72;
      const logoH = h * 0.72;
      let logoX = x + (w - logoW) / 2;
      let logoY = y + (h - logoH) / 2;
      if (alignH === 'left') logoX = x + w * 0.04;
      else if (alignH === 'right') logoX = x + w - logoW - w * 0.04;
      if (alignV === 'top') logoY = y + h * 0.04;
      else if (alignV === 'bottom') logoY = y + h - logoH - h * 0.04;
      if (card.front.logoBackground === 'card') {
        out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${escapeXml(bg)}"/>`;
      }
      out += `<image href="${escapeXml(card.front.logoUrl!)}" x="${logoX}" y="${logoY}" width="${logoW}" height="${logoH}" preserveAspectRatio="${xAlign}${yAlign} meet"/>`;
    }

    const textKeys: Array<keyof CardGrid['elements'] & ('name' | 'title' | 'company')> = ['name', 'title', 'company'];
    const textValues: Record<
      'name' | 'title' | 'company',
      { text: string; weight: number; color: string; letterSpacing: number; sizePct: number; opacity?: number }
    > = {
      name: { text: card.front.name.toUpperCase(), weight: 800, color: text, letterSpacing: 0.5, sizePct: 0.28 },
      title: { text: card.front.title, weight: 600, color: accent, letterSpacing: 0, sizePct: 0.21 },
      company: { text: card.front.company, weight: 400, color: text, letterSpacing: 0, sizePct: 0.18, opacity: 0.78 },
    };
    for (const key of textKeys) {
      const el = grid.elements[key];
      if (!el || !textValues[key].text) continue;
      const cfg = textValues[key];
      const x = el.x * cellW;
      const y = el.y * cellH;
      const w = el.w * cellW;
      const h = el.h * cellH;
      const alignH = el.alignH ?? 'center';
      const alignV = el.alignV ?? 'center';
      const fontSize = fs(h * cfg.sizePct, fontScale);
      const textX = alignH === 'left' ? x + pad * 0.5 : alignH === 'right' ? x + w - pad * 0.5 : x + w / 2;
      const textY = alignV === 'top'
        ? y + pad * 0.25
        : alignV === 'bottom'
          ? y + h - fontSize - pad * 0.25
          : y + (h - fontSize) / 2;
      const anchor = alignH === 'left' ? 'start' : alignH === 'right' ? 'end' : 'middle';
      const opacityAttr = cfg.opacity !== undefined ? ` opacity="${cfg.opacity}"` : '';
      const letterAttr = cfg.letterSpacing ? ` letter-spacing="${cfg.letterSpacing}"` : '';
      out += `<text x="${textX}" y="${textY}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${cfg.weight}" fill="${cfg.color}" text-anchor="${anchor}" dominant-baseline="text-before-edge"${letterAttr}${opacityAttr}>${escapeXml(cfg.text)}</text>`;
    }
  }

  // Fallback layout if grid missing: sensible default so export never empty
  if (!grid || Object.keys(grid.elements).length === 0) {
    const photoSize = Math.round(Math.min(pxW, pxH) * 0.4);
    const logoBg = card.front.logoBackground === 'card' ? bg : 'none';
    const photoX = pad + stripW;
    const photoY = pad;
    if (hasPhoto) {
      out += `<image href="${escapeXml(card.front.photoUrl!)}" x="${photoX}" y="${photoY}" width="${photoSize}" height="${photoSize}" preserveAspectRatio="xMidYMid slice" clip-path="inset(0 round 6)"/>`;
    } else if (hasLogo) {
      if (logoBg !== 'none') {
        out += `<rect x="${photoX}" y="${photoY}" width="${photoSize}" height="${photoSize}" rx="6" fill="${escapeXml(logoBg)}"/>`;
      }
      const ls = Math.round(photoSize * 0.7);
      out += `<image href="${escapeXml(card.front.logoUrl!)}" x="${photoX + (photoSize - ls) / 2}" y="${photoY + (photoSize - ls) / 2}" width="${ls}" height="${ls}" preserveAspectRatio="xMidYMid meet"/>`;
    }
    const textX = photoX + photoSize + Math.round(pxW * 0.03);
    let textY = photoY + Math.round(photoSize * 0.18);
    const nameSize = fs(photoSize * 0.13, fontScale);
    const titleSize = fs(photoSize * 0.09, fontScale);
    const companySize = fs(photoSize * 0.075, fontScale);
    if (card.front.name) {
      out += `<text x="${textX}" y="${textY}" font-family="${fontFamily}" font-size="${nameSize}" font-weight="800" fill="${text}" letter-spacing="0.5">${escapeXml(card.front.name.toUpperCase())}</text>`;
      textY += nameSize * 1.2;
    }
    if (card.front.title) {
      out += `<text x="${textX}" y="${textY}" font-family="${fontFamily}" font-size="${titleSize}" font-weight="600" fill="${accent}">${escapeXml(card.front.title)}</text>`;
      textY += titleSize * 1.3;
    }
    if (card.front.company) {
      out += `<text x="${textX}" y="${textY}" font-family="${fontFamily}" font-size="${companySize}" font-weight="400" fill="${text}" opacity="0.78">${escapeXml(card.front.company)}</text>`;
    }
  }

  if (opts.includeDebugBoxes && card.grid) {
    out += buildGridDebugSvg(card.grid, pxW, pxH);
  }

  return out;
}

export function buildBackSvg(
  card: BusinessCard,
  pxW: number,
  pxH: number,
  opts: BuildSvgOptions = {},
): string {
  const bg = card.style.bgColor;
  const text = card.style.textColor;
  const accent = card.style.accentColor;
  const stripW = Math.max(2, Math.round(pxW * 0.008));
  // v2.10: pad/header metrics shared with CardPreview CSS (hard WYSIWYG).
  const padBox = backPad(pxW, pxH);
  const pad = padBox.x; // legacy local name used in fallback layout below
  const fontScale = card.style.fontScale ?? 1;
  const fontFamily = svgFontFamily(card);

  const hostname = deriveHostname(card);
  const headerWord = hostname || card.front.company || '';
  const socials = card.back.socials.filter((s) => s.platform && s.url);
  const qrPayload = getEffectiveQrPayload(card);
  const hasQr = !!qrPayload;

  let out = '';
  // Background
  out += `<rect width="${pxW}" height="${pxH}" fill="${bg}"/>`;
  // Back cover image (full-bleed) with same readability wash as the front.
  if (card.back.coverImageUrl) {
    out += `<image href="${escapeXml(card.back.coverImageUrl)}" x="0" y="0" width="${pxW}" height="${pxH}" preserveAspectRatio="xMidYMid slice"/>`;
    out += `<rect width="${pxW}" height="${pxH}" fill="${bg}" opacity="0.6"/>`;
    out += `<defs><linearGradient id="backReadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${bg}" stop-opacity="0"/>
      <stop offset="55%" stop-color="${bg}" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="${bg}" stop-opacity="0.8"/>
    </linearGradient></defs>`;
    out += `<rect width="${pxW}" height="${pxH}" fill="url(#backReadGrad)"/>`;
  }
  // Decorative pattern (back)
  if (card.decorations?.pattern) {
    out += renderDecorativePattern(card.decorations.pattern, pxW, pxH, {
      palette: card.decorations.palette || { primary: accent, secondary: text },
      opacity: card.decorations.opacity ?? 0.2,
    });
  } else {
    // Corner radial gradient
    const cornerSize = Math.round(Math.min(pxW, pxH) * 0.28);
    out += `<defs><radialGradient id="backCornerGrad" cx="100%" cy="0%" r="80%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient></defs>`;
    out += `<rect x="${pxW - cornerSize}" y="0" width="${cornerSize}" height="${cornerSize}" fill="url(#backCornerGrad)"/>`;
  }
  // Accent strip
  if (card.style.borderStyle === 'accent-strip-left') {
    out += `<rect x="0" y="0" width="${stripW}" height="${pxH}" fill="${accent}"/>`;
  }
  if (card.style.borderStyle === 'accent-strip-bottom') {
    const stripH = Math.max(2, Math.round(pxH * 0.012));
    out += `<rect x="0" y="${pxH - stripH}" width="${pxW}" height="${stripH}" fill="${accent}"/>`;
  }

  // Header — v2.10: sizes from backHeaderMetrics (matches .card-back-header).
  let headerH = 0;
  const hasAnyContact = !!(card.back.phone || card.back.email || card.back.website || card.back.address || card.back.vatNumber);
  const headerMetrics = backHeaderMetrics(pxW, pxH, fontScale, padBox);
  if (hasAnyContact || headerWord) {
    const { eyebrowSize, wordmarkSize, textY, dividerY, headerX } = headerMetrics;
    out += `<text x="${headerX}" y="${textY}" font-family="${fontFamily}" font-size="${eyebrowSize}" font-weight="700" fill="${accent}" letter-spacing="2.5" dominant-baseline="alphabetic">CONTATTI</text>`;
    if (headerWord) {
      out += `<text x="${pxW - padBox.x}" y="${textY}" font-family="${fontFamily}" font-size="${wordmarkSize}" font-weight="600" fill="${accent}" text-anchor="end" dominant-baseline="alphabetic">${escapeXml(headerWord)}</text>`;
    }
    out += `<line x1="${headerX}" y1="${dividerY}" x2="${pxW - padBox.x}" y2="${dividerY}" stroke="${text}" stroke-width="0.4" stroke-dasharray="3,2" opacity="0.18"/>`;
    headerH = headerMetrics.bodyTop;
  }
  const bodyTop = headerH;
  const bodyH = pxH - bodyTop;

  // Render back from card.backGrid (single source of truth)
  // v2.8: when back.useGrid is false OR the persisted backGrid has no
  // usable elements, derive fresh from the default preset so the export
  // never goes blank.
  // v2.10: collapse empty services row so socials sit under contacts
  // (same density as preview when servicesContent is null).
  const useBackGrid = card.back.useGrid && hasGridElements('back', card);
  const persistedBackGrid = useBackGrid ? card.backGrid : undefined;
  const rawBackGrid = persistedBackGrid ?? (useBackGrid ? card.grid : undefined);
  const baseGrid = rawBackGrid ?? deriveGridFromLayout(card, 'back');
  const grid = baseGrid ? effectiveBackGridForRender(baseGrid, card) : baseGrid;
  if (grid && grid.cols > 0 && grid.rows > 0) {
    const cellW = pxW / grid.cols;
    const cellH = bodyH / grid.rows;

    const contactsEl = grid.elements.contacts;
    if (contactsEl) {
      // v2.10: cell rect from shared backLayout (matches preview padding).
      const cell = gridCellRect(contactsEl, cellW, cellH, bodyTop, padBox);
      const cx = cell.x;
      const cy = cell.y;
      const cw = cell.w;
      const ch = cell.h;

      const contactEntries: Array<{ key: string; value: string; color?: string; isAccent?: boolean }> = [];
      if (card.back.phone) contactEntries.push({ key: 'Telefono', value: card.back.phone });
      if (card.back.email) contactEntries.push({ key: 'Email', value: card.back.email });
      if (card.back.website && !hasQr) contactEntries.push({ key: 'Web', value: card.back.website, color: accent, isAccent: true });
      if (card.back.address) contactEntries.push({ key: 'Indirizzo', value: card.back.address });
      if (card.back.vatNumber) contactEntries.push({ key: 'P.IVA', value: card.back.vatNumber });

      // v2.10.1: size fonts vs CARD height (pxH), matching CSS rem on a
      // ~340px-tall preview (.card-back-key 0.58rem≈9.3px, .card-back-val
      // 0.78rem≈12.5px). Sizing vs min(cw,ch) blew up at export DPI
      // (cell ~300px → 48px labels). Then shrink-to-fit short cells.
      let keySize = fs(pxH * (9.3 / 340), fontScale);
      let valSize = fs(pxH * (12.5 / 340), fontScale);
      const wrappableKeys = new Set(['Email', 'Telefono']);
      // Label column = longest key glyph width + gap (never overlaps value).
      // "TELEFONO" ≈ 8 chars; uppercase sans ≈ 0.62em per char + letter-spacing.
      const longestKey = contactEntries.reduce((n, e) => Math.max(n, e.key.length), 1);
      const colLabelWFor = (ks: number) => {
        const textW = ks * longestKey * 0.62 + ks * 0.4; // letter-spacing budget
        const gap = Math.max(8, ks * 0.5);
        return Math.min(cw * 0.42, textW + gap);
      };
      const lineGapFor = (ks: number, vs: number) => Math.max(ks, vs) * 1.35;
      const linesFor = (vs: number, ks: number) => {
        const colLabelW = colLabelWFor(ks);
        const valueMaxW = Math.max(10, cw - colLabelW - pad * 0.5);
        return contactEntries.reduce((total, entry) => {
          const wrapped = wrappableKeys.has(entry.key)
            ? wrapTextAtWhitespace(entry.value, valueMaxW, vs)
            : [entry.value];
          return total + wrapped.length;
        }, 0);
      };
      const neededHeight = (ks: number, vs: number) => {
        const lines = Math.max(1, linesFor(vs, ks));
        return ks + pad * 0.25 + lines * lineGapFor(ks, vs);
      };
      while (keySize > 8 && neededHeight(keySize, valSize) > ch) {
        keySize *= 0.9;
        valSize *= 0.9;
      }

      const contactsAlignH = contactsEl.alignH ?? 'left';
      const contactsAlignV = contactsEl.alignV ?? 'top';
      const lineGap = lineGapFor(keySize, valSize);
      // v2.9: allinea label e valore sulla stessa baseline alfabetica, come
      // la preview React (.card-back-line { align-items: baseline }). Prima
      // usavamo text-before-edge su entrambi: label e valore venivano
      // top-aligned ma, essendo il valore più grande, la sua baseline era
      // più bassa e i due testi apparivano "sminchiati" (label galleggiante
      // sopra il valore). Ora calcoliamo un'unica baseline condivisa e usiamo
      // dominant-baseline="alphabetic" su entrambi i <text>.
      const valAscent = Math.round(valSize * 0.8);
      const contentH = contactEntries.length * lineGap + pad * 0.25;
      let startY = cy + valAscent + pad * 0.25;
      if (contactsAlignV === 'center') startY = cy + (ch - contentH) / 2 + valAscent + pad * 0.25;
      else if (contactsAlignV === 'bottom') startY = cy + ch - contentH + valAscent + pad * 0.25;
      let lineY = startY;
      const colLabelW = colLabelWFor(keySize);
      const valueMaxW = Math.max(10, cw - colLabelW - pad * 0.5);
      const labelAnchor = contactsAlignH === 'right' ? 'end' : contactsAlignH === 'center' ? 'middle' : 'start';
      const valueAnchor = contactsAlignH === 'right' ? 'end' : contactsAlignH === 'center' ? 'middle' : 'start';
      const labelX = contactsAlignH === 'right'
        ? cx + cw - colLabelW
        : contactsAlignH === 'center'
          ? cx + (cw - colLabelW) / 2
          : cx;
      const valueXBase = contactsAlignH === 'right'
        ? cx + cw
        : contactsAlignH === 'center'
          ? cx + cw / 2 + colLabelW / 2
          : cx + colLabelW;
      // v2.13: hard clip — text must NEVER paint outside the contacts cell.
      const contactsClipId = `clipContacts${contactsEl.x}${contactsEl.y}${contactsEl.w}${contactsEl.h}`;
      const contactsBox = gridCellBox(contactsEl, cellW, cellH, bodyTop);
      out += `<defs><clipPath id="${contactsClipId}"><rect x="${contactsBox.x}" y="${contactsBox.y}" width="${contactsBox.w}" height="${contactsBox.h}"/></clipPath></defs>`;
      out += `<g clip-path="url(#${contactsClipId})">`;
      const renderContact = (entry: { key: string; value: string; color?: string; isAccent?: boolean }) => {
        // Always wrap values to valueMaxW (not only email/phone) so long
        // strings never spill past the cell even without clip.
        const wrapped = wrapTextAtWhitespace(entry.value, valueMaxW, valSize);
        out += `<text x="${labelX}" y="${lineY}" font-family="${fontFamily}" font-size="${keySize}" font-weight="700" fill="${text}" opacity="0.55" letter-spacing="0.4" text-anchor="${labelAnchor}" dominant-baseline="alphabetic">${escapeXml(entry.key.toUpperCase())}</text>`;
        wrapped.forEach((line) => {
          out += `<text x="${valueXBase}" y="${lineY}" font-family="${fontFamily}" font-size="${valSize}" font-weight="500" fill="${entry.isAccent ? accent : (entry.color ?? text)}" text-anchor="${valueAnchor}" dominant-baseline="alphabetic">${escapeXml(line)}</text>`;
          lineY += lineGap;
        });
      };
      contactEntries.forEach(renderContact);
      // Fallback: no dedicated socials cell → socials inside contacts, CLIPPED.
      if (!grid.elements.socials && socials.length > 0) {
        const socialsText = socials
          .map((s) => {
            const handle = deriveHandle(s.url);
            const value = handle || s.url;
            return `${s.platform} ${value}`;
          })
          .join('   ');
        // Size vs card height (same as dedicated socials cell), then wrap.
        let socialSize = fs(pxH * (10 / 340), fontScale);
        const socialLineH = (s: number) => s * 1.35;
        const remainH = Math.max(8, cy + ch - lineY - pad * 0.25);
        while (socialSize > 6 && wrapTextAtWhitespace(socialsText, cw, socialSize).length * socialLineH(socialSize) > remainH) {
          socialSize *= 0.9;
        }
        const lines = wrapTextAtWhitespace(socialsText, cw, socialSize);
        let sy = lineY + Math.round(socialSize * 0.4);
        lines.forEach((line) => {
          if (sy > cy + ch) return;
          out += `<text x="${cx}" y="${sy}" font-family="${fontFamily}" font-size="${socialSize}" font-weight="500" fill="${text}" opacity="0.78" font-style="italic" dominant-baseline="text-before-edge">${escapeXml(line)}</text>`;
          sy += socialLineH(socialSize);
        });
      }
      out += '</g>';
    }

    // Services (separate grid element)
    let services = (card.back.services ?? []).filter((s) => s.trim().length > 0);
    let servicesEl = grid.elements.services;
    const socialsEl = grid.elements.socials;
    // v2.9.1: mirror CardPreview.tsx expansion — when socials are empty, let
    // services expand into the unused socials row so the left column doesn't
    // leave an empty gap. We create a temporary merged rect for rendering only.
    let servicesRenderEl = servicesEl;
    if (services.length > 0 && !socialsEl && servicesEl) {
      servicesRenderEl = { ...servicesEl, h: servicesEl.h + 1 };
    }
    if (servicesRenderEl && services.length > 0) {
      const svcCell = gridCellRect(servicesRenderEl, cellW, cellH, bodyTop, padBox);
      const sx = svcCell.x;
      const sy = svcCell.y;
      const sw = svcCell.w;
      const sh = svcCell.h;
      const servicesAlignH = servicesRenderEl.alignH ?? 'left';
      const servicesAlignV = servicesRenderEl.alignV ?? 'top';
      let svcY = sy + padBox.cellY * 0.25;
      const servicesLabelText = (card.back.servicesLabel ?? '').trim();
      let labelSize = 0;
      if (servicesLabelText) {
        // v2.10.1: vs card height (CSS ~0.62rem services label)
        labelSize = fs(pxH * (10 / 340), fontScale);
        svcY += labelSize * 1.1;
      }
      const hasLongService = services.some((s) => s.length >= 40);
      // v2.10.1: vs card height, not min(cell) which explodes at export DPI
      let svcSize = fs(pxH * (13 / 340), fontScale) * (hasLongService ? 0.85 : 1);
      // v2.5.1: tighter line-height (1.2 instead of 1.35) so 2-3
      // services + label fit a 1-row cell without shrinking too much.
      const svcLineH = (s: number) => s * 1.2;
      // Shrink services font until the whole list fits inside the cell height.
      const neededH = (s: number) => {
        const lineH = svcLineH(s);
        return (labelSize ? labelSize * 1.3 : 0) + services.length * lineH + pad * 0.5;
      };
      // v2.5.1: raised floor from 6 to 14 so services stay readable even
      // when the cell is very short (h:1). If they don't fit at 14px we
      // accept the overflow rather than producing invisible text.
      while (svcSize > 14 && neededH(svcSize) > sh) {
        svcSize *= 0.92;
      }
      const blockH = (labelSize ? labelSize * 1.3 : 0) + services.length * svcLineH(svcSize) + pad * 0.5;
      let startY = svcY;
      if (servicesAlignV === 'center') startY = sy + (sh - blockH) / 2;
      else if (servicesAlignV === 'bottom') startY = sy + sh - blockH;
      const textAnchor = servicesAlignH === 'right' ? 'end' : servicesAlignH === 'center' ? 'middle' : 'start';
      const textX = servicesAlignH === 'right'
        ? sx + sw - padBox.cellX * 0.5
        : servicesAlignH === 'center'
          ? sx + sw / 2
          : sx;
      let labelY = startY;
      if (servicesLabelText) {
        out += `<text x="${textX}" y="${labelY}" font-family="${fontFamily}" font-size="${labelSize}" font-weight="700" fill="${accent}" letter-spacing="1.2" opacity="0.7" text-anchor="${textAnchor}" dominant-baseline="text-before-edge">${escapeXml(servicesLabelText.toUpperCase())}</text>`;
        labelY += labelSize * 1.3;
      }
      const finalLineH = svcLineH(svcSize);
      const svcClipId = `clipServices${servicesRenderEl.x}${servicesRenderEl.y}${servicesRenderEl.w}${servicesRenderEl.h}`;
      const svcBox = gridCellBox(servicesRenderEl, cellW, cellH, bodyTop);
      out += `<defs><clipPath id="${svcClipId}"><rect x="${svcBox.x}" y="${svcBox.y}" width="${svcBox.w}" height="${svcBox.h}"/></clipPath></defs>`;
      out += `<g clip-path="url(#${svcClipId})">`;
      services.forEach((svc, idx) => {
        out += `<text x="${textX}" y="${labelY + idx * finalLineH}" font-family="${fontFamily}" font-size="${svcSize}" font-weight="800" fill="${accent}" text-anchor="${textAnchor}" dominant-baseline="text-before-edge">· ${escapeXml(svc)}</text>`;
      });
      out += '</g>';
    }

    if (services.length > 0 && !servicesEl && !socialsEl && contactsEl) {
      // v2.9.1: no services/socials cells at all but services exist (legacy
      // grid created before services were added). Render them in the contacts
      // fallback area, below the contacts text.
      // This branch is reached only when the persisted grid has no services
      // element and the user has added services; we avoid losing them.
      // (mirrors CardPreview.tsx fallback {!grid.elements.services && servicesContent}).
      const fallbackEl = contactsEl;
      const fx = fallbackEl.x * cellW + pad * 0.5;
      const fy = fallbackEl.y * cellH + bodyTop + pad * 0.5 + contactsEl.h * cellH;
      const fw = fallbackEl.w * cellW - pad;
      const fh = (grid.rows - fallbackEl.y - fallbackEl.h) * cellH - pad;
      if (fh > 20) {
        const servicesLabelText = (card.back.servicesLabel ?? '').trim();
        let labelSize = 0;
        let svcY = fy;
        if (servicesLabelText) {
          labelSize = fs(Math.min(fw, fh) * 0.18, fontScale);
          out += `<text x="${fx}" y="${svcY + labelSize}" font-family="${fontFamily}" font-size="${labelSize}" font-weight="700" fill="${accent}" letter-spacing="1.2" opacity="0.7" dominant-baseline="text-before-edge">${escapeXml(servicesLabelText.toUpperCase())}</text>`;
          svcY += labelSize * 1.4;
        }
        let svcSize = fs(Math.min(fw, fh) * 0.2, fontScale);
        const svcLineH = (s: number) => s * 1.2;
        const neededH = (s: number) => (labelSize ? labelSize * 1.4 : 0) + services.length * svcLineH(s) + pad * 0.5;
        while (svcSize > 14 && neededH(svcSize) > fh) svcSize *= 0.92;
        services.forEach((svc, idx) => {
          out += `<text x="${fx}" y="${svcY + (idx + 1) * svcLineH(svcSize)}" font-family="${fontFamily}" font-size="${svcSize}" font-weight="800" fill="${accent}" dominant-baseline="text-before-edge">· ${escapeXml(svc)}</text>`;
        });
      }
    }

    if (socialsEl && socials.length > 0) {
      // Full cell box (same coordinate system as preview CSS grid).
      const box = gridCellBox(socialsEl, cellW, cellH, bodyTop);
      const cellX = box.x;
      const cellY = box.y;
      const cellBoxW = box.w;
      const cellBoxH = box.h;
      const innerPad = padBox.cellX * 0.5;
      const sx = cellX + innerPad;
      const sw = Math.max(10, cellBoxW - innerPad * 2);
      const sh = Math.max(10, cellBoxH - innerPad * 2);
      const socialsText = socials
        .map((s) => {
          const handle = deriveHandle(s.url);
          const value = handle || s.url;
          return `${s.platform} ${value}`;
        })
        .join('   ');
      // v2.10.1: vs card height (CSS .card-back-socials ~0.62rem ≈ 10px @340)
      let socialSize = fs(pxH * (10 / 340), fontScale);
      const socialLineH = (s: number) => s * 1.35;
      const neededSocialH = (s: number) => {
        const lines = wrapTextAtWhitespace(socialsText, sw, s);
        return lines.length * socialLineH(s);
      };
      while (socialSize > 6 && neededSocialH(socialSize) > sh) {
        socialSize *= 0.92;
      }
      const lines = wrapTextAtWhitespace(socialsText, sw, socialSize);
      const blockH = lines.length * socialLineH(socialSize);
      const alignV = socialsEl.alignV ?? 'top';
      const alignH = socialsEl.alignH ?? 'left';
      let startY = cellY + innerPad;
      if (alignV === 'center') startY = cellY + (cellBoxH - blockH) / 2;
      else if (alignV === 'bottom') startY = cellY + cellBoxH - blockH - innerPad;
      const anchor = alignH === 'right' ? 'end' : alignH === 'center' ? 'middle' : 'start';
      const textX = alignH === 'right'
        ? cellX + cellBoxW - innerPad
        : alignH === 'center'
          ? cellX + cellBoxW / 2
          : sx;
      const clipId = `clipSocials${socialsEl.x}${socialsEl.y}${socialsEl.w}${socialsEl.h}`;
      out += `<defs><clipPath id="${clipId}"><rect x="${cellX}" y="${cellY}" width="${cellBoxW}" height="${cellBoxH}"/></clipPath></defs>`;
      out += `<g clip-path="url(#${clipId})">`;
      lines.forEach((line, idx) => {
        const lineY = startY + idx * socialLineH(socialSize);
        out += `<text x="${textX}" y="${lineY}" font-family="${fontFamily}" font-size="${socialSize}" font-weight="500" fill="${text}" opacity="0.78" font-style="italic" text-anchor="${anchor}" dominant-baseline="text-before-edge">${escapeXml(line)}</text>`;
      });
      out += '</g>';
    }

    const qrEl = grid.elements.qr;
    if (qrEl && hasQr) {
      // v2.10: QR size from shared backQrSizePx (same scale as preview CSS
      // --card-qr-size / PREVIEW_REF_H). Cell rect + align from backLayout.
      const qrCell = gridCellRect(qrEl, cellW, cellH, bodyTop, padBox);
      const qx = qrCell.x;
      const qy = qrCell.y;
      const qw = qrCell.w;
      const qh = qrCell.h;
      const qrAlignH = qrEl.alignH ?? 'center';
      const qrAlignV = qrEl.alignV ?? 'center';
      // Reserve space for qrLabel under the QR inside the cell.
      const labelReserve = card.back.qrLabel ? Math.round(Math.min(qw, qh) * 0.12) : 0;
      const qrSize = backQrSizePx(card, qw, qh - labelReserve, pxH);
      const pos = alignBoxInCell(
        { x: qx, y: qy, w: qw, h: qh - labelReserve },
        qrSize,
        qrSize,
        qrAlignH,
        qrAlignV,
      );
      const qrX = pos.x;
      const qrY = pos.y;
      const qrObj: any = {
        documentType: 'qrCode',
        id: 'card-back',
        title: '',
        data: { type: 'url', payload: qrPayload },
        style: {
          errorCorrection: 'M',
          fgColor: '#000000',
          bgColor: '#FFFFFF',
          size: qrSize * 2,
          margin: 1,
          logoOverlay: null,
          dotStyle: 'square',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const qrSvg = generateQrSvg(qrObj);
      out += `<rect x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" fill="#FFFFFF" stroke="${accent}" stroke-width="2"/>`;
      const viewBoxMatch = qrSvg.match(/viewBox="0 0 (\d+) (\d+)"/);
      const totalSize = viewBoxMatch ? parseInt(viewBoxMatch[1], 10) : qrSize;
      const innerScale = (qrSize - 8) / totalSize;
      out += `<g transform="translate(${qrX + 4} ${qrY + 4}) scale(${innerScale})">${extractQrInner(qrSvg)}</g>`;

      // QR label below QR, still inside the cell (matches preview density).
      if (card.back.qrLabel) {
        const labelSize = fs(Math.min(qw, qh) * 0.07, fontScale);
        const belowY = qrY + qrSize + Math.round(labelSize * 0.4);
        out += `<text x="${qx + qw / 2}" y="${belowY + labelSize}" font-family="${fontFamily}" font-size="${labelSize}" font-weight="500" fill="${text}" text-anchor="middle" opacity="0.78">${escapeXml(card.back.qrLabel)}</text>`;
      }
    }
  }

  // Fallback layout if backGrid missing: sensible default so export never empty
  const gridMissing = !card.backGrid || Object.keys(card.backGrid.elements).length === 0;
  if (gridMissing) {
    const contactsX = pad + stripW;
    const QR_PX_PCT_BY_ENUM: Record<'small' | 'medium' | 'large', number> = {
      small: 0.25,
      medium: 0.35,
      large: 0.50,
    };
    const fallbackQrSize = hasQr ? Math.round(pxH * (QR_PX_PCT_BY_ENUM[card.back.qrSize] ?? 0.35)) : 0;
    const qrX = hasQr ? pxW - pad - fallbackQrSize : 0;
    const qrY = hasQr ? Math.round((pxH - fallbackQrSize) / 2) : 0;
    const contactsW = hasQr ? Math.round(pxW * 0.52) - stripW : pxW - pad * 2 - stripW;

    const keySize = fs(pxH * 0.034, fontScale);
    const valSize = fs(pxH * 0.046, fontScale);
    let lineY = hasQr ? qrY - Math.round(pxH * 0.02) : pad + Math.round(pxH * 0.08);
    const lineGap = valSize * 1.35;
    const renderContact = (key: string, value: string, color: string = text, isAccent: boolean = false) => {
      out += `<text x="${contactsX}" y="${lineY}" font-family="${fontFamily}" font-size="${keySize}" font-weight="700" fill="${text}" opacity="0.55" letter-spacing="0.4">${escapeXml(key.toUpperCase())}</text>`;
      out += `<text x="${contactsX + Math.round(contactsW * 0.22)}" y="${lineY}" font-family="${fontFamily}" font-size="${valSize}" font-weight="500" fill="${isAccent ? accent : color}">${escapeXml(value)}</text>`;
      lineY += lineGap;
    };
    if (card.back.phone) renderContact('Telefono', card.back.phone);
    if (card.back.email) renderContact('Email', card.back.email);
    if (card.back.website && !hasQr) renderContact('Web', card.back.website, accent, true);
    if (card.back.address) renderContact('Indirizzo', card.back.address);
    if (card.back.vatNumber) renderContact('P.IVA', card.back.vatNumber);

    if (socials.length > 0) {
      const socialsY = lineY + Math.round(pxH * 0.03);
      const socialsText = socials
        .map((s) => {
          const handle = deriveHandle(s.url);
          const value = handle || s.url;
          return `${s.platform} ${value}`;
        })
        .join('   ');
      out += `<text x="${contactsX}" y="${socialsY + valSize * 0.3}" font-family="${fontFamily}" font-size="${fs(pxH * 0.04, fontScale)}" font-weight="500" fill="${text}" opacity="0.78" font-style="italic">${escapeXml(socialsText)}</text>`;
    }

    if (hasQr) {
      const qrObj: any = {
        documentType: 'qrCode',
        id: 'card-back',
        title: '',
        data: { type: 'url', payload: qrPayload },
        style: {
          errorCorrection: 'M',
          fgColor: '#000000',
          bgColor: '#FFFFFF',
          size: fallbackQrSize * 2,
          margin: 1,
          logoOverlay: null,
          dotStyle: 'square',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const qrSvg = generateQrSvg(qrObj);
      out += `<rect x="${qrX}" y="${qrY}" width="${fallbackQrSize}" height="${fallbackQrSize}" fill="#FFFFFF" stroke="${accent}" stroke-width="2"/>`;
      const viewBoxMatch = qrSvg.match(/viewBox="0 0 (\d+) (\d+)"/);
      const totalSize = viewBoxMatch ? parseInt(viewBoxMatch[1], 10) : fallbackQrSize;
      const innerScale = (fallbackQrSize - 8) / totalSize;
      out += `<g transform="translate(${qrX + 4} ${qrY + 4}) scale(${innerScale})">${extractQrInner(qrSvg)}</g>`;
    }
    if (card.back.qrLabel && hasQr) {
      out += `<text x="${qrX + fallbackQrSize / 2}" y="${qrY + fallbackQrSize + Math.round(pxH * 0.035)}" font-family="${fontFamily}" font-size="${Math.round(pxH * 0.034)}" font-weight="500" fill="${text}" text-anchor="middle" opacity="0.78">${escapeXml(card.back.qrLabel)}</text>`;
    }
  }

  if (opts.includeDebugBoxes && card.backGrid) {
    out += buildGridDebugSvg(card.backGrid, pxW, pxH);
  }

  return out;
}

// Width-aware wrap: split text at word boundaries (spaces/slashes)
// so long emails/URLs do not overflow cells. Does not break individual characters.
function wrapTextAtWhitespace(text: string, maxWidthPx: number, fontSize: number): string[] {
  if (!text) return [];
  const avgCharW = fontSize * 0.52;
  const measure = (s: string) => s.length * avgCharW;
  const tokens = text.split(/([/\s]+)/).filter((s) => s.length > 0);
  const lines: string[] = [];
  let current = '';
  const pushCurrent = () => {
    if (current) {
      lines.push(current.trim());
      current = '';
    }
  };
  for (const token of tokens) {
    const isSep = /^[/\s]+$/.test(token);
    if (isSep) {
      current += ' ';
      continue;
    }
    const candidate = current ? current + token : token;
    if (measure(candidate) <= maxWidthPx) {
      current = candidate;
    } else {
      pushCurrent();
      current = token;
    }
  }
  pushCurrent();
  return lines.length > 0 ? lines : [text];
}

/**
 * Build a standalone SVG representation of one side of the card at the given pixel dimensions.
 */
export function buildCardSvg(
  card: BusinessCard,
  side: 'front' | 'back',
  pxW: number,
  pxH: number,
  opts: BuildSvgOptions = {},
): string {
  const rotate = opts.rotate ?? 0;
  const fontImport = opts.embeddedFontCss || buildSvgFontImport(card.style.fontFamily || 'Inter');
  const inner = side === 'front' ? buildFrontSvg(card, pxW, pxH, opts) : buildBackSvg(card, pxW, pxH, opts);
  const head = fontImport ? `${fontImport}${inner}` : inner;
  if (rotate === 0) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${pxW} ${pxH}" width="${pxW}" height="${pxH}">${head}</svg>`;
  }
  const outW = rotate === 90 || rotate === 270 ? pxH : pxW;
  const outH = rotate === 90 || rotate === 270 ? pxW : pxH;
  const tx = rotate === 90 ? pxH : rotate === 180 ? pxW : 0;
  const ty = rotate === 180 ? pxH : rotate === 270 ? pxW : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${outW} ${outH}" width="${outW}" height="${outH}">${fontImport}<g transform="translate(${tx} ${ty}) rotate(${rotate})">${inner}</g></svg>`;
}

export function extractQrInner(qrSvg: string): string {
  const m = qrSvg.match(/<svg[^\u003e]*>([\s\S]*)<\/svg>/);
  if (!m) return '';
  return m[1];
}

function buildGridDebugSvg(grid: NonNullable<BusinessCard['grid']>, pxW: number, pxH: number): string {
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
