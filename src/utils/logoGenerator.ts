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

// ─── VIEWBOX PER LAYOUT (auto-fit) ─────────────────────────────────

interface ViewBox {
  W: number;
  H: number;
}

const MIN_VIEWBOX = { horizontal: { W: 400, H: 160 }, vertical: { W: 300, H: 300 }, stacked: { W: 300, H: 320 } } as const;
const MAX_VIEWBOX = { horizontal: { W: 800, H: 180 }, vertical: { W: 500, H: 360 }, stacked: { W: 500, H: 380 } } as const;

// Inter bold approx: uppercase ≈ 0.55×fontSize per char, mixed ≈ 0.50.
export function estimateTextWidth(text: string, fontSize: number): number {
  if (!text) return 0;
  // Mixed-case average. Primary text is mostly title-case → 0.55 factor.
  return Math.round(text.length * fontSize * 0.55);
}

export function fitText(text: string, maxWidth: number, startSize = 36, minSize = 14): number {
  if (!text) return startSize;
  if (estimateTextWidth(text, startSize) <= maxWidth) return startSize;
  let lo = minSize;
  let hi = startSize;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (estimateTextWidth(text, mid) <= maxWidth) lo = mid;
    else hi = mid;
  }
  return lo;
}

function getViewBox(layout: LogoLayout, primaryText: string, tagline: string): ViewBox {
  const min = MIN_VIEWBOX[layout];
  const max = MAX_VIEWBOX[layout];
  switch (layout) {
    case 'horizontal': {
      const iconSize = Math.min(min.W, min.H) * 0.4;
      const textStartX = iconSize / 2 + 10 + iconSize / 2 + 14;
      const maxTextW = max.W - textStartX - 28;
      const fontSize = fitText(primaryText, maxTextW, 36, 14);
      const textW = estimateTextWidth(primaryText, fontSize);
      const W = Math.max(min.W, Math.min(max.W, Math.round(textStartX + textW + 28)));
      // Keep horizontal height fixed at 160 to preserve v1 previews/tests;
      // the tagline fits at y=textY+18 with H=160.
      return { W, H: min.H };
    }
    case 'vertical':
    case 'stacked': {
      const maxTextW = max.W - 40;
      const fontSize = fitText(primaryText, maxTextW, 32, 14);
      const textW = estimateTextWidth(primaryText, fontSize);
      const W = Math.max(min.W, Math.min(max.W, Math.round(textW + 40)));
      const extraH = tagline ? 40 : 20;
      const baseH = layout === 'stacked' ? 320 : 300;
      const H = Math.max(min.H, Math.min(max.H, baseH + extraH));
      return { W, H };
    }
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

function renderDecorations(
  builder: LogoBuilder,
  W: number,
  iconCenter: { x: number; y: number },
  iconSize: number,
  textX: number,
  textY: number,
  textWidth: number,
  fontSize: number,
): string {
  if (!builder.decorativeElements?.length) return '';
  const primary = isHexColor(builder.primaryColor) ? builder.primaryColor : '#01696F';
  const parts: string[] = [];
  if (builder.decorativeElements.includes('underline')) {
    parts.push(`<line x1="${textX}" y1="${textY + Math.round(fontSize * 0.35)}" x2="${textX + textWidth}" y2="${textY + Math.round(fontSize * 0.35)}" stroke="${primary}" stroke-width="2"/>`);
  }
  if (builder.decorativeElements.includes('dotRing')) {
    const ringR = iconSize / 2 + 8;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 - Math.PI / 2;
      const px = iconCenter.x + ringR * Math.cos(angle);
      const py = iconCenter.y + ringR * Math.sin(angle);
      parts.push(`<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="2" fill="${primary}"/>`);
    }
  }
  if (builder.decorativeElements.includes('topAccent')) {
    const barW = Math.round(W * 0.4);
    const barX = Math.round((W - barW) / 2);
    parts.push(`<rect x="${barX}" y="4" width="${barW}" height="4" rx="2" fill="${primary}"/>`);
  }
  return parts.join('');
}

function buildGradientDefs(builder: LogoBuilder): string {
  if (!builder.gradientFill) return '';
  const primary = isHexColor(builder.primaryColor) ? builder.primaryColor : '#01696F';
  const secondary = isHexColor(builder.secondaryColor) ? builder.secondaryColor : '#1a1a2e';
  return `<defs><linearGradient id="textGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${primary}"/><stop offset="1" stop-color="${secondary}"/></linearGradient></defs>`;
}

function buildBackgroundRect(builder: LogoBuilder, W: number, H: number): string {
  if (!builder.backgroundColor || !isHexColor(builder.backgroundColor)) return '';
  return `<rect width="${W}" height="${H}" fill="${builder.backgroundColor}"/>`;
}

// ─── TEXT READABILITY + POSITION (spec v2.3) ──────────────────────

/**
 * Resolves primaryText/tagline fill colors considering textColorMode.
 * gradientFill (v2.2) takes priority over textColorMode when enabled,
 * since it's an explicit stylistic choice independent of readability
 * mode. 'light'/'dark' force a fixed, high-contrast color regardless
 * of the brand secondary/primary colors — the whole point is to
 * guarantee legibility against an unpredictable AI-generated photo.
 */
function resolveTextColors(
  builder: LogoBuilder,
  primary: string,
  secondary: string,
  hasBgImage: boolean,
): { primaryTextColor: string; taglineColor: string } {
  if (builder.gradientFill) {
    return { primaryTextColor: 'url(#textGrad)', taglineColor: primary };
  }
  switch (builder.textColorMode) {
    case 'light':
      return { primaryTextColor: '#FFFFFF', taglineColor: 'rgba(255,255,255,0.85)' };
    case 'dark':
      return { primaryTextColor: '#0F172A', taglineColor: 'rgba(15,23,42,0.78)' };
    case 'auto':
    default:
      // When an AI photo background is present and the user hasn't
      // explicitly chosen a text color mode, default to light text
      // (white) — dark secondaryColor on an arbitrary photo is
      // usually illegible. The user can override via textColorMode.
      if (hasBgImage) {
        return { primaryTextColor: '#FFFFFF', taglineColor: 'rgba(255,255,255,0.85)' };
      }
      return { primaryTextColor: secondary, taglineColor: primary };
  }
}

/**
 * Renders a semi-transparent backdrop (pill or full-width band) behind
 * the text block for readability against busy AI-generated photo
 * backgrounds. The backdrop tone is the inverse of textColorMode so
 * it always contrasts with the text drawn on top of it.
 */
function buildTextBackdrop(
  builder: LogoBuilder,
  box: { x: number; y: number; width: number; height: number },
  viewW: number,
  hasBgImage: boolean,
): string {
  // When a background image is present and the user hasn't chosen a
  // backdrop, auto-enable a dark pill so the text is always legible
  // against an unpredictable photo. The user can override via
  // textBackdrop: 'none'.
  const effective = builder.textBackdrop === 'none' && hasBgImage ? 'pill' : builder.textBackdrop;
  if (effective === 'none') return '';
  const dark = 'rgba(15,23,42,0.55)';
  const light = 'rgba(255,255,255,0.72)';
  const fill = builder.textColorMode === 'dark' ? light : dark;
  if (effective === 'band') {
    return `<rect x="0" y="${box.y.toFixed(2)}" width="${viewW}" height="${box.height.toFixed(2)}" fill="${fill}"/>`;
  }
  const pad = 10;
  const rx = Math.round(box.height / 2);
  return `<rect x="${(box.x - pad).toFixed(2)}" y="${box.y.toFixed(2)}" width="${(box.width + pad * 2).toFixed(2)}" height="${box.height.toFixed(2)}" rx="${rx}" ry="${rx}" fill="${fill}"/>`;
}

// ─── BUILDER → SVG ──────────────────────────────────────────

function getSafeColors(builder: LogoBuilder): { primary: string; secondary: string } {
  return {
    primary: isHexColor(builder.primaryColor) ? builder.primaryColor : '#01696F',
    secondary: isHexColor(builder.secondaryColor) ? builder.secondaryColor : '#1a1a2e',
  };
}

function buildSvgForLayout(builder: LogoBuilder): string {
  const { W, H } = getViewBox(builder.layout, builder.primaryText, builder.tagline);
  const { primary, secondary } = getSafeColors(builder);
  const hasBgImage = !!builder.backgroundImage;
  const { primaryTextColor, taglineColor } = resolveTextColors(builder, primary, secondary, hasBgImage);
  const iconSize = Math.min(W, H) * 0.4;
  // v2.3: manual nudge + scale on top of the auto-fit layout. Icon
  // position/size is untouched — only the text block moves/scales.
  const scale = builder.textScale || 1;
  const offX = builder.textOffsetX || 0;
  const offY = builder.textOffsetY || 0;
  const tagOffX = builder.taglineOffsetX || 0;
  const tagOffY = builder.taglineOffsetY || 0;
  const hasTagline = !!builder.tagline;
  // v2.3.1: an AI photo background already carries the visual identity
  // (illustration/photo) — a lucide icon or decorative underline/dotRing
  // drawn on top of it reads as visual clutter and usually overlaps the
  // artwork. Icon + decorations are suppressed automatically whenever a
  // backgroundImage is present; the text is recentered and a dark pill
  // backdrop is auto-enabled for legibility (the user can override via
  // textBackdrop / textColorMode).

  const bgRect = buildBackgroundRect(builder, W, H);
  const bgImage = builder.backgroundImage
    ? `<image href="${escapeXml(builder.backgroundImage)}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"/>`
    : '';
  const defs = buildGradientDefs(builder);

  let icon = '';
  let primaryText = '';
  let taglineText = '';
  let decorations = '';
  let backdrop = '';
  let iconCenter: { x: number; y: number } = { x: W / 2, y: H / 2 };

  if (builder.layout === 'horizontal') {
    iconCenter = { x: iconSize / 2 + 10, y: H / 2 };
    if (!hasBgImage) {
      icon = renderIcon(builder, iconCenter.x, iconCenter.y, iconSize).svg;
    }
    // When a background image is present, the icon is suppressed but its
    // layout space would leave the text floating off-center over the photo.
    // Recenter the text block horizontally instead, so it sits cleanly in
    // the middle of the image. The user can still nudge with textOffsetX/Y.
    const baseTextX = hasBgImage ? W / 2 : iconCenter.x + iconSize / 2 + 14;
    const textAnchor: 'start' | 'middle' = hasBgImage ? 'middle' : 'start';
    const maxTextW = hasBgImage ? W - 40 : W - baseTextX - 28;
    const baseFontSize = fitText(builder.primaryText, maxTextW, 36, 14);
    const primaryFontSize = Math.max(10, Math.round(baseFontSize * scale));
    const taglineFontSize = Math.max(8, Math.round(14 * scale));
    const baseY = H / 2;
    const primaryX = baseTextX + offX;
    const primaryY = baseY + offY + (hasTagline ? -10 : 6);
    const taglineX = baseTextX + tagOffX;
    const taglineY = baseY + 18 + tagOffY;
    primaryText = renderText(builder, primaryX, primaryY, textAnchor, primaryFontSize, primaryTextColor);
    taglineText = renderTagline(builder, taglineX, taglineY, textAnchor, taglineFontSize, taglineColor);
    const textWidth = estimateTextWidth(builder.primaryText, primaryFontSize);
    const taglineWidth = hasTagline ? estimateTextWidth(builder.tagline, taglineFontSize) : 0;
    if (!hasBgImage) {
      decorations = renderDecorations(builder, W, iconCenter, iconSize, primaryX, primaryY - Math.round(primaryFontSize * 0.45), textWidth, primaryFontSize);
    }
    const box = unionTextBox(
      { x: primaryX, y: primaryY - primaryFontSize * 0.85, width: textWidth, height: primaryFontSize * 1.15 },
      hasTagline ? { x: taglineX, y: taglineY - taglineFontSize * 0.85, width: taglineWidth, height: taglineFontSize * 1.25 } : null,
    );
    backdrop = buildTextBackdrop(builder, box, W, hasBgImage);
  } else {
    // vertical / stacked share the same centered-block layout, differing
    // only in the base font size and tagline gap used by getViewBox().
    iconCenter = { x: W / 2, y: iconSize / 2 + 10 };
    if (!hasBgImage) {
      icon = renderIcon(builder, iconCenter.x, iconCenter.y, iconSize).svg;
    }
    const startFontSize = builder.layout === 'vertical' ? 32 : 36;
    const baseTaglineFontSize = builder.layout === 'vertical' ? 12 : 14;
    const taglineGap = builder.layout === 'vertical' ? 22 : 26;
    const maxTextW = W - 40;
    const baseFontSize = fitText(builder.primaryText, maxTextW, startFontSize, 14);
    const primaryFontSize = Math.max(10, Math.round(baseFontSize * scale));
    const taglineFontSize = Math.max(8, Math.round(baseTaglineFontSize * scale));
    // When a background image is present, the icon is suppressed. Center
    // the text block vertically (H/2) instead of below the icon area,
    // so the title+tagline sit cleanly in the middle of the photo.
    const baseY = hasBgImage ? H / 2 : iconCenter.y + iconSize / 2 + 30;
    const baseCenterX = W / 2;
    const primaryCenterX = baseCenterX + offX;
    const primaryY = baseY + offY;
    const taglineCenterX = baseCenterX + tagOffX;
    const taglineY = baseY + taglineGap + tagOffY;
    primaryText = renderText(builder, primaryCenterX, primaryY, 'middle', primaryFontSize, primaryTextColor);
    taglineText = renderTagline(builder, taglineCenterX, taglineY, 'middle', taglineFontSize, taglineColor);
    const textWidth = estimateTextWidth(builder.primaryText, primaryFontSize);
    const taglineWidth = hasTagline ? estimateTextWidth(builder.tagline, taglineFontSize) : 0;
    const primaryLeft = primaryCenterX - textWidth / 2;
    const taglineLeft = taglineCenterX - taglineWidth / 2;
    if (!hasBgImage) {
      decorations = renderDecorations(builder, W, iconCenter, iconSize, primaryLeft, primaryY - Math.round(primaryFontSize * 0.45), textWidth, primaryFontSize);
    }
    const box = unionTextBox(
      { x: primaryLeft, y: primaryY - primaryFontSize * 0.85, width: textWidth, height: primaryFontSize * 1.15 },
      hasTagline ? { x: taglineLeft, y: taglineY - taglineFontSize * 0.85, width: taglineWidth, height: taglineFontSize * 1.25 } : null,
    );
    backdrop = buildTextBackdrop(builder, box, W, hasBgImage);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${bgRect}${bgImage}${defs}${icon}${decorations}${backdrop}${primaryText}${taglineText}</svg>`;
}

/** Union bounding box of the primary text block and (optionally) the
 * tagline block, used to size the readability backdrop so it always
 * wraps both blocks even when they've been nudged independently. */
function unionTextBox(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number } | null,
): { x: number; y: number; width: number; height: number } {
  if (!b) return a;
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
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
    icons: [],
    backgroundImage: null,
    backgroundColor: null,
    gradientFill: false,
    decorativeElements: [],
    imagePrompt: null,
    textBackdrop: 'none',
    textColorMode: 'auto',
    textOffsetX: 0,
    textOffsetY: 0,
    textScale: 1,
    taglineOffsetX: 0,
    taglineOffsetY: 0,
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
