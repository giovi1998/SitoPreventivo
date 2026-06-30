import type { LogoBuilder, LogoLayout, LogoIconShape } from './documentSchemas';
import { LUCIDE_ICON_PATHS, type LucideIconChildren } from './lucideIconPaths';
import { applyWatermarkToCanvas, getMaxPngSideForTier, type Tier } from './watermark';

// ─── ALLOWLIST LUCIDE ICONS (48 nomi) ──────────────────────
// Per v1, usiamo solo nomi come chiave di validazione. Il rendering
// della forma è una stilizzazione deterministica (vedi PAT-002 della
// spec): l'icona lucide compare nell'anteprima come React component
// (libreria lucide-react) e nell'SVG esportato come lettera
// iniziale del nome icona dentro la iconShape scelta. Questo evita
// di embeddare 48 path SVG nella build (bundle size) mantenendo
// output deterministico e sicuro.
export const LUCIDE_ICONS = [
  // food (10)
  'coffee', 'utensils', 'wine', 'pizza', 'cake',
  'chef-hat', 'drumstick', 'ice-cream-cone', 'lemon', 'sandwich',
  // tech (10)
  'code', 'cpu', 'database', 'cloud', 'terminal',
  'server', 'smartphone', 'wifi', 'zap', 'layers',
  // fashion (9)
  'shirt', 'scissors', 'sparkles', 'gem', 'crown',
  'watch', 'shopping-bag', 'palette', 'frame',
  // business (10)
  'briefcase', 'building', 'scale', 'stethoscope', 'book-open',
  'graduation-cap', 'hammer', 'wrench', 'lightbulb', 'globe',
  // nature (9)
  'leaf', 'tree-pine', 'flower', 'mountain', 'sun',
  'moon', 'star', 'flame', 'waves',
] as const;

export type LucideIconName = (typeof LUCIDE_ICONS)[number];

export function isValidLucideIcon(name: string): name is LucideIconName {
  return (LUCIDE_ICONS as readonly string[]).includes(name);
}

// ─── HELPERS ──────────────────────────────────────────

export function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

// ─── VIEWBOX PER LAYOUT ──────────────────────────────────────────

interface ViewBox {
  W: number;
  H: number;
}

function getViewBox(layout: LogoLayout): ViewBox {
  switch (layout) {
    case 'horizontal': return { W: 400, H: 160 };
    case 'vertical':   return { W: 300, H: 300 };
    case 'stacked':    return { W: 300, H: 320 };
  }
}

// ─── RENDER ICON (SHAPE) ──────────────────────────────────────────

interface IconRender {
  svg: string;       // frammento <g>...</g>
  glyphText: string; // testo da mostrare dentro (monogram, lucide)
}

function normalizeGlyph(builder: LogoBuilder): string {
  if (builder.iconType === 'monogram') {
    return builder.iconGlyph.toUpperCase().slice(0, 2);
  }
  if (builder.iconType === 'lucide') {
    // Solo prima lettera, uppercase, del nome icona
    const name = isValidLucideIcon(builder.iconGlyph) ? builder.iconGlyph : '?';
    return name.charAt(0).toUpperCase();
  }
  return '';
}

function renderIconShape(builder: LogoBuilder, cx: number, cy: number, size: number): string {
  const half = size / 2;
  const fill = isHexColor(builder.primaryColor) ? builder.primaryColor : '#01696F';
  switch (builder.iconShape) {
    case 'circle': {
      return `<circle cx="${cx}" cy="${cy}" r="${half}" fill="${fill}"/>`;
    }
    case 'square': {
      return `<rect x="${cx - half}" y="${cy - half}" width="${size}" height="${size}" fill="${fill}"/>`;
    }
    case 'rounded': {
      const r = Math.round(size * 0.18);
      return `<rect x="${cx - half}" y="${cy - half}" width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${fill}"/>`;
    }
    case 'hex': {
      const points: string[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const px = cx + half * Math.cos(angle);
        const py = cy + half * Math.sin(angle);
        points.push(`${px.toFixed(2)},${py.toFixed(2)}`);
      }
      return `<polygon points="${points.join(' ')}" fill="${fill}"/>`;
    }
  }
}

function renderIcon(builder: LogoBuilder, cx: number, cy: number, size: number): IconRender {
  if (builder.iconType === 'none') {
    return { svg: '', glyphText: '' };
  }
  const shape = renderIconShape(builder, cx, cy, size);
  const glyphText = normalizeGlyph(builder);

  if (builder.iconType === 'lucide' && isValidLucideIcon(builder.iconGlyph)) {
    // Renderizza l'icona lucide reale (path SVG da lucideIconPaths.ts)
    // scalata e centrata nella iconShape. Il colore del path è
    // bianco per risaltare sulla forma primaryColor.
    const children = LUCIDE_ICON_PATHS[builder.iconGlyph];
    if (children) {
      const scale = size / 24; // viewBox lucide = 0 0 24 24
      const tx = cx - 12 * scale;
      const ty = cy - 12 * scale;
      const paths = renderLucideChildren(children, tx, ty, scale);
      return { svg: `${shape}${paths}`, glyphText: '' };
    }
  }

  if (!glyphText) {
    return { svg: shape, glyphText: '' };
  }
  const fontSize = Math.round(size * 0.45);
  const escaped = escapeXml(glyphText);
  const text = `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" fill="#FFFFFF" font-family="${escapeXml(builder.fontFamily)}, sans-serif" font-weight="700" font-size="${fontSize}">${escaped}</text>`;
  return { svg: `${shape}${text}`, glyphText };
}

function renderLucideChildren(children: LucideIconChildren, tx: number, ty: number, scale: number): string {
  const groupTransform = `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})`;
  const inner = children
    .map(([tag, attrs]) => {
      const attrStr = Object.entries(attrs)
        .filter(([k]) => k !== 'key')
        .map(([k, v]) => `${k}="${escapeXml(String(v))}"`)
        .join(' ');
      return `<${tag} ${attrStr}/>`;
    })
    .join('');
  return `<g transform="${groupTransform}" stroke="#FFFFFF" stroke-width="${(2 / scale).toFixed(3)}" stroke-linecap="round" stroke-linejoin="round" fill="none">${inner}</g>`;
}

// ─── RENDER TEXT ──────────────────────────────────────────

function renderText(builder: LogoBuilder, x: number, y: number, anchor: 'start' | 'middle' | 'end', fontSize: number, color: string): string {
  const text = escapeXml(builder.primaryText);
  const family = escapeXml(builder.fontFamily);
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}" font-family="${family}, sans-serif" font-weight="700" font-size="${fontSize}">${text}</text>`;
}

function renderTagline(builder: LogoBuilder, x: number, y: number, anchor: 'start' | 'middle' | 'end', fontSize: number, color: string): string {
  if (!builder.tagline) return '';
  const text = escapeXml(builder.tagline);
  const family = escapeXml(builder.fontFamily);
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}" font-family="${family}, sans-serif" font-weight="400" font-size="${fontSize}" letter-spacing="1">${text}</text>`;
}

// ─── BUILDER → SVG ──────────────────────────────────────────

function getSafeColors(builder: LogoBuilder): { primary: string; secondary: string } {
  return {
    primary: isHexColor(builder.primaryColor) ? builder.primaryColor : '#01696F',
    secondary: isHexColor(builder.secondaryColor) ? builder.secondaryColor : '#1a1a2e',
  };
}

function buildSvgForLayout(builder: LogoBuilder): string {
  const { W, H } = getViewBox(builder.layout);
  const { primary, secondary } = getSafeColors(builder);
  const iconSize = Math.min(W, H) * 0.4;
  const textColor = secondary;

  let icon = '';
  let primaryText = '';
  let taglineText = '';
  let iconCenter: { x: number; y: number } = { x: W / 2, y: H / 2 };

  if (builder.layout === 'horizontal') {
    iconCenter = { x: iconSize / 2 + 10, y: H / 2 };
    const r = renderIcon(builder, iconCenter.x, iconCenter.y, iconSize);
    icon = r.svg;
    const textX = iconCenter.x + iconSize / 2 + 14;
    const textY = H / 2;
    primaryText = renderText(builder, textX, builder.tagline ? textY - 10 : textY + 6, 'start', 36, textColor);
    taglineText = renderTagline(builder, textX, textY + 18, 'start', 14, primary);
  } else if (builder.layout === 'vertical') {
    iconCenter = { x: W / 2, y: iconSize / 2 + 10 };
    const r = renderIcon(builder, iconCenter.x, iconCenter.y, iconSize);
    icon = r.svg;
    const textY = iconCenter.y + iconSize / 2 + 30;
    primaryText = renderText(builder, W / 2, textY, 'middle', 32, textColor);
    taglineText = renderTagline(builder, W / 2, textY + 22, 'middle', 12, primary);
  } else {
    // stacked
    iconCenter = { x: W / 2, y: iconSize / 2 + 10 };
    const r = renderIcon(builder, iconCenter.x, iconCenter.y, iconSize);
    icon = r.svg;
    const textY = iconCenter.y + iconSize / 2 + 30;
    primaryText = renderText(builder, W / 2, textY, 'middle', 36, textColor);
    taglineText = renderTagline(builder, W / 2, textY + 26, 'middle', 14, primary);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="none"/>${icon}${primaryText}${taglineText}</svg>`;
}

export function builderToSvg(b: LogoBuilder): string {
  return buildSvgForLayout(b);
}

export function applyLayout(svg: string, layout: LogoLayout): string {
  // Estrai builder dall'svg non è banale: ci aspettiamo che il chiamante
  // abbia ancora il builder. Questo helper è documentato come "re-render
  // shortcut" usato da LogoEditor quando cambia solo il layout.
  // Estraiamo texts e colori per preservarli.
  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitizeSvg(svg), 'image/svg+xml');
  const root = doc.querySelector('svg');
  if (!root) return svg;
  const texts = Array.from(root.querySelectorAll('text')).map((t) => t.textContent || '');
  // Preserva il primo colore di fill non bianco
  const circle = root.querySelector('circle, rect, polygon');
  const primaryColor = (circle?.getAttribute('fill')) || '#01696F';
  const textEl = root.querySelector('text');
  const secondaryColor = (textEl?.getAttribute('fill')) || '#1a1a2e';
  const family = textEl?.getAttribute('font-family')?.split(',')[0]?.trim() || 'Inter';
  return buildSvgForLayout({
    primaryText: texts[0] || '',
    tagline: texts[1] || '',
    iconType: 'shape',
    iconGlyph: texts.find((t) => t.length <= 2) || '',
    iconShape: 'circle',
    primaryColor,
    secondaryColor,
    fontFamily: family,
    layout,
  });
}

export function extractTexts(svg: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, 'image/svg+xml');
  return Array.from(doc.querySelectorAll('text')).map((t) => t.textContent || '');
}

export function replaceText(svg: string, oldText: string, newText: string): string {
  if (!oldText) return svg;
  const safe = escapeXml(newText);
  // Match solo dentro <text>...</text>
  const re = new RegExp(`(<text[^>]*>)([^<]*?)(${escapeRegex(oldText)})([^<]*?)(</text>)`, 'g');
  return svg.replace(re, (_, open, before, _match, after, close) => `${open}${before}${safe}${after}${close}`);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function replaceColor(svg: string, oldColor: string, newColor: string): string {
  if (!isHexColor(newColor)) return svg;
  const re = new RegExp(`fill="${escapeRegex(oldColor)}"`, 'g');
  return svg.replace(re, `fill="${newColor}"`);
}

// ─── SANITIZE ──────────────────────────────────────────

export function sanitizeSvg(svg: string): string {
  if (typeof DOMParser === 'undefined') {
    return svg;
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, 'image/svg+xml');
  const errorNode = doc.querySelector('parsererror');
  if (errorNode) {
    return svg; // meglio restituire l'originale che rompere il flusso
  }
  const root = doc.querySelector('svg');
  if (!root) return svg;

  // Rimuovi elementi pericolosi / inutili
  root.querySelectorAll('metadata, desc, script, style').forEach((el) => el.remove());
  // Rimuovi commenti
  const removeComments = (node: Node) => {
    const toRemove: ChildNode[] = [];
    node.childNodes.forEach((child) => {
      if (child.nodeType === 8 /* COMMENT */) toRemove.push(child);
      else if (child.nodeType === 1) removeComments(child);
    });
    toRemove.forEach((n) => n.parentNode?.removeChild(n));
  };
  removeComments(root);

  // Normalizza viewBox
  if (!root.getAttribute('viewBox')) {
    const w = root.getAttribute('width') || '100';
    const h = root.getAttribute('height') || '100';
    root.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }
  root.removeAttribute('width');
  root.removeAttribute('height');

  // Rimuovi event handler attributes (onclick, onload, onerror, ...)
  const dangerousAttrs = /^(on|formaction$|action$)/i;
  const walkAndStrip = (el: Element) => {
    const attrs = Array.from(el.attributes);
    attrs.forEach((attr) => {
      if (dangerousAttrs.test(attr.name)) {
        el.removeAttribute(attr.name);
      }
    });
    Array.from(el.children).forEach(walkAndStrip);
  };
  walkAndStrip(root);

  return new XMLSerializer().serializeToString(root);
}

// ─── SVG → PNG ──────────────────────────────────────────

export async function svgToPng(
  svg: string,
  size: number,
  opts: { tier?: Tier } = {},
): Promise<Uint8Array> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error('svgToPng richiede un ambiente browser');
  }
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('Size non valido per svgToPng');
  }
  const tier: Tier = opts.tier || 'unlocked';
  const maxSide = getMaxPngSideForTier(tier);
  const effectiveSize = Math.min(size, maxSide);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Impossibile caricare SVG come immagine'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = effectiveSize;
    canvas.height = effectiveSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D non disponibile');
    // Ensure transparent background (some browsers default to black)
    ctx.clearRect(0, 0, effectiveSize, effectiveSize);
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, effectiveSize, effectiveSize);
    ctx.drawImage(img, 0, 0, effectiveSize, effectiveSize);
    // Phase 5: tier-aware watermark on PNG canvas
    applyWatermarkToCanvas(ctx, tier, effectiveSize, effectiveSize);
    const pngBlob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob ha restituito null'))), 'image/png');
    });
    const buf = await pngBlob.arrayBuffer();
    return new Uint8Array(buf);
  } finally {
    URL.revokeObjectURL(url);
  }
}
