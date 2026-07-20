/**
 * TB-023: libreria pattern decorativi SVG riutilizzabili per card/flyer/logo.
 *
 * I pattern sono generati come stringhe SVG coordinateless in modo da
 * scalare con il `viewBox` del documento ospite. Ogni pattern accetta
 * palette (primary/secondary/accent) e opzioni di densità/posizione.
 */

export const DECORATIVE_PATTERN_IDS = [
  'wave-bottom',
  'wave-split',
  'blob-corner',
  'splash-corners',
  'full-overlay',
] as const;

export type DecorativePatternId = (typeof DECORATIVE_PATTERN_IDS)[number];

export interface DecorativePalette {
  primary: string;
  secondary: string;
  accent?: string | null;
}

export interface DecorativePatternOptions {
  palette: DecorativePalette;
  /** Opacità del pattern complessivo, 0-1 */
  opacity?: number;
  /** Usa gradiente invece di tinte piatte */
  gradient?: boolean;
  /** Densità / numero di elementi: 0.5 = sparso, 1 = default, 1.5 = denso */
  density?: number;
}

interface PatternRenderContext {
  width: number;
  height: number;
  seed: number;
  opacity?: number;
}

function normalizeColor(c: string): string {
  return /^#[0-9A-Fa-f]{3,8}$/.test(c) ? c : '#E5E7EB';
}

function paletteToGradient(
  id: string,
  palette: DecorativePalette,
  ctx: PatternRenderContext
): { defs: string; fill: string } {
  const p = normalizeColor(palette.primary);
  const s = normalizeColor(palette.secondary);
  const a = palette.accent ? normalizeColor(palette.accent) : s;
  return {
    defs: `
      <linearGradient id="${id}" x1="0%" y1="0%" x2="${ctx.width}" y2="${ctx.height}" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="${p}" stop-opacity="${(ctx.opacity ?? 1) * 0.35}" />
        <stop offset="50%" stop-color="${s}" stop-opacity="${(ctx.opacity ?? 1) * 0.25}" />
        <stop offset="100%" stop-color="${a}" stop-opacity="${(ctx.opacity ?? 1) * 0.15}" />
      </linearGradient>
    `,
    fill: `url(#${id})`,
  };
}

function paletteToFlat(palette: DecorativePalette, ctx: PatternRenderContext): string {
  return normalizeColor(palette.secondary);
}

function waveBottom(ctx: PatternRenderContext, opts: DecorativePatternOptions): { svg: string; defs: string } {
  const { width, height } = ctx;
  const opacity = opts.opacity ?? 0.22;
  const color = normalizeColor(opts.palette.secondary);
  const amplitude = height * 0.08 * (opts.density ?? 1);
  const waves = 2 + Math.round((opts.density ?? 1));
  let paths = '';
  for (let i = 0; i < waves; i++) {
    const yBase = height - amplitude * (i + 1) * 0.6;
    const freq = (i + 1) * 2;
    const d = Array.from({ length: width + 1 }, (_, x) => {
      const y = yBase + Math.sin((x / width) * Math.PI * freq) * amplitude * 0.5;
      return `${x === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    paths += `<path d="${d} L${width},${height} L0,${height} Z" fill="${color}" fill-opacity="${opacity}" />`;
  }
  return { svg: paths, defs: '' };
}

function waveSplit(ctx: PatternRenderContext, opts: DecorativePatternOptions): { svg: string; defs: string } {
  const { width, height } = ctx;
  const opacity = opts.opacity ?? 0.18;
  const color = normalizeColor(opts.palette.secondary);
  const accent = normalizeColor(opts.palette.accent || opts.palette.primary);
  const mid = width * 0.55;
  const amplitude = height * 0.06 * (opts.density ?? 1);
  const d1 = Array.from({ length: 101 }, (_, i) => {
    const x = (i / 100) * mid;
    const y = Math.sin((i / 100) * Math.PI * 3) * amplitude;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${(height * 0.25 + y).toFixed(1)}`;
  }).join(' ');
  const d2 = Array.from({ length: 101 }, (_, i) => {
    const x = mid + (i / 100) * (width - mid);
    const y = Math.cos((i / 100) * Math.PI * 3) * amplitude;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${(height * 0.65 + y).toFixed(1)}`;
  }).join(' ');
  const svg = `
    <path d="${d1}" fill="none" stroke="${color}" stroke-width="${(height * 0.006).toFixed(2)}" stroke-opacity="${opacity}" />
    <path d="${d2}" fill="none" stroke="${accent}" stroke-width="${(height * 0.006).toFixed(2)}" stroke-opacity="${opacity}" />
  `;
  return { svg, defs: '' };
}

function blobCorner(ctx: PatternRenderContext, opts: DecorativePatternOptions): { svg: string; defs: string } {
  const { width, height } = ctx;
  const opacity = opts.opacity ?? 0.2;
  const fill = opts.gradient
    ? paletteToGradient('blobCornerGrad', opts.palette, ctx).fill
    : normalizeColor(opts.palette.secondary);
  const defs = opts.gradient ? paletteToGradient('blobCornerGrad', opts.palette, ctx).defs : '';
  const size = Math.min(width, height) * 0.55 * (opts.density ?? 1);
  const cx = width - size * 0.4;
  const cy = height - size * 0.4;
  const r = size * 0.45;
  const path = `
    M${(cx - r).toFixed(1)},${cy.toFixed(1)}
    C${(cx - r).toFixed(1)},${(cy - r * 1.4).toFixed(1)} ${(cx + r * 0.6).toFixed(1)},${(cy - r * 1.4).toFixed(1)} ${(cx + r).toFixed(1)},${(cy - r * 0.4).toFixed(1)}
    C${(cx + r * 1.5).toFixed(1)},${(cy + r * 0.4).toFixed(1)} ${(cx + r * 0.5).toFixed(1)},${(cy + r * 1.2).toFixed(1)} ${cx.toFixed(1)},${(cy + r).toFixed(1)}
    C${(cx - r * 0.8).toFixed(1)},${(cy + r * 1.4).toFixed(1)} ${(cx - r * 1.3).toFixed(1)},${(cy + r * 0.2).toFixed(1)} ${(cx - r).toFixed(1)},${cy.toFixed(1)}
    Z
  `;
  return { svg: `<path d="${path}" fill="${fill}" fill-opacity="${opacity}" />`, defs };
}

function splashCorners(ctx: PatternRenderContext, opts: DecorativePatternOptions): { svg: string; defs: string } {
  const { width, height } = ctx;
  const opacity = opts.opacity ?? 0.16;
  const color = normalizeColor(opts.palette.secondary);
  const accent = normalizeColor(opts.palette.accent || opts.palette.primary);
  const count = 3 + Math.round((opts.density ?? 1) * 2);
  let svg = '';
  const radius = Math.min(width, height) * 0.12 * (opts.density ?? 1);
  const positions = [
    { cx: radius, cy: radius },
    { cx: width - radius, cy: radius },
    { cx: radius, cy: height - radius },
    { cx: width - radius, cy: height - radius },
  ];
  positions.forEach((pos, idx) => {
    const fill = idx % 2 === 0 ? color : accent;
    for (let i = 0; i < count; i++) {
      const r = radius * (0.25 + (i / count) * 0.75);
      svg += `<circle cx="${pos.cx.toFixed(1)}" cy="${pos.cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" fill-opacity="${opacity}" />`;
    }
  });
  return { svg, defs: '' };
}

function fullOverlay(ctx: PatternRenderContext, opts: DecorativePatternOptions): { svg: string; defs: string } {
  const { width, height } = ctx;
  const opacity = opts.opacity ?? 0.12;
  const grad = paletteToGradient('fullOverlayGrad', opts.palette, ctx);
  const defs = grad.defs;
  const count = 4 + Math.round((opts.density ?? 1) * 3);
  let blobs = '';
  for (let i = 0; i < count; i++) {
    const cx = width * (0.15 + (i / count) * 0.7);
    const cy = height * (0.1 + ((i * 31) % 100) / 100 * 0.8);
    const r = Math.min(width, height) * (0.12 + (i % 3) * 0.05);
    blobs += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${grad.fill}" fill-opacity="${opacity}" />`;
  }
  return { svg: blobs, defs };
}

const RENDERERS: Record<DecorativePatternId, (ctx: PatternRenderContext, opts: DecorativePatternOptions) => { svg: string; defs: string }> = {
  'wave-bottom': waveBottom,
  'wave-split': waveSplit,
  'blob-corner': blobCorner,
  'splash-corners': splashCorners,
  'full-overlay': fullOverlay,
};

/**
 * Genera un elemento SVG <g> con il pattern decorativo richiesto.
 * Il gruppo è pensato per essere inserito come primo figlio dell'elemento
 * radice del documento (card/flyer/logo). Le coordinate sono in user unit
 * relative a width/height passate.
 */
export function renderDecorativePattern(
  id: DecorativePatternId,
  width: number,
  height: number,
  opts: DecorativePatternOptions
): string {
  const ctx: PatternRenderContext = { width, height, seed: Math.floor(Math.random() * 10000), opacity: opts.opacity };
  const renderer = RENDERERS[id];
  if (!renderer) return '';
  const { svg, defs } = renderer(ctx, opts);
  return `
    <g data-decorative-pattern="${id}" style="pointer-events: none;">
      ${defs}
      ${svg}
    </g>
  `.trim();
}

/**
 * Suggerisce un pattern per settore/tono. Può essere sovrascritto manualmente
 * o dall'AI copywriter del flyer/card.
 */
export function suggestPatternForSector(sector?: string): DecorativePatternId {
  const s = (sector || '').toLowerCase();
  if (s.includes('food') || s.includes('ristor') || s.includes('bar')) return 'wave-bottom';
  if (s.includes('tech') || s.includes('software') || s.includes('app')) return 'blob-corner';
  if (s.includes('fashion') || s.includes('moda') || s.includes('beauty')) return 'splash-corners';
  if (s.includes('profession') || s.includes('studio') || s.includes('consul')) return 'wave-split';
  return 'full-overlay';
}

/**
 * Restituisce una palette di default basata sui colori del brand se presenti,
 * altrimenti una scala neutra.
 */
export function defaultDecorativePalette(
  primary?: string,
  secondary?: string,
  accent?: string
): DecorativePalette {
  return {
    primary: normalizeColor(primary || '#01696F'),
    secondary: normalizeColor(secondary || '#E11D48'),
    accent: accent ? normalizeColor(accent) : undefined,
  };
}
