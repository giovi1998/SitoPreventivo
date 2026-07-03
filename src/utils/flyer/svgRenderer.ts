import type { Flyer } from '../documentSchemas';
import type { FlyerLayoutPlan } from './geometry';
import { mm } from './geometry';
import { safeHex, escapeHtml, escapeXmlAttr, inlineQrSvg } from './qrRenderer';
import { computeFlyerLayout, magazineColumnCount } from './layoutEngine';

const MM_PER_PT = 0.352777778;

export interface SvgRenderOptions {
  includeDebugBoxes?: boolean;
  includeBleedBackground?: boolean;
  previewW?: number;
  previewH?: number;
}

/**
 * Render text block as native SVG <text> with <tspan> per line.
 * Each line is positioned at the exact mm computed by the layout engine.
 * This guarantees preview, PDF, and PNG all render identically.
 */
function renderTextBlock(
  block: FlyerLayoutPlan['text']['headline'],
  box: { x: number; y: number; w: number; h: number },
  opts: {
    font: string;
    color: string;
    fontWeight: number;
    align: 'left' | 'center';
    upperCase?: boolean;
    clipId?: string;
    baseline?: 'hanging' | 'auto';
  },
): string {
  if (!block.text || block.lines.length === 0) return '';
  const lineHeightMm = block.fontSizePt * block.lineHeight * MM_PER_PT;
  // Use dominant-baseline="text-before-edge" so the y coordinate is the very
  // top of the rendered glyph bounding box. This matches the layout engine's
  // top-down box model.
  const startY = opts.baseline === 'hanging' ? box.y : box.y + block.fontSizePt * MM_PER_PT;
  const baselineAttr = opts.baseline === 'hanging' ? ' dominant-baseline="text-before-edge"' : '';
  const lines = block.lines;
  const displayLines = opts.upperCase ? lines.map((l) => l.toUpperCase()) : lines;

  const parts: string[] = [];
  // font-size MUST be unitless (= user unit = mm in this viewBox).
  // Using "pt" or "mm" here makes Chromium convert to px@96dpi and then
  // treat those px as user units, producing a font ~3.78x larger than expected.
  for (let i = 0; i < displayLines.length; i++) {
    const line = displayLines[i];
    const y = startY + i * lineHeightMm;
    const x = opts.align === 'center'
      ? box.x + box.w / 2
      : box.x;
    const anchor = opts.align === 'center' ? 'middle' : 'start';
    parts.push(`<text x="${mm(x)}" y="${mm(y)}" text-anchor="${anchor}"${baselineAttr} font-family="${opts.font}" font-size="${(block.fontSizePt * MM_PER_PT).toFixed(4)}" font-weight="${opts.fontWeight}" fill="${opts.color}"${opts.clipId ? ` clip-path="url(#${opts.clipId})` : ''}">${escapeXmlAttr(line)}</text>`);
  }
  return parts.join('');
}

export function renderFlyerSvg(plan: FlyerLayoutPlan, flyer: Flyer, options: SvgRenderOptions = {}): string {
  const page = plan.page;
  const total = page.total;
  const parts: string[] = [];
  const bg = safeHex(flyer.style.bgColor, '#FFFFFF');
  const text = safeHex(flyer.style.textColor, '#1a1a2e');
  const accent = safeHex(flyer.style.accentColor, '#01696f');
  const font = flyer.style.fontFamily || 'Arial, sans-serif';
  const qrPayload = flyer.content.qrPayload || (flyer.content.cta.url && /^https?:\/\//i.test(flyer.content.cta.url) ? flyer.content.cta.url : '');

  const widthAttr = options.previewW ? `${options.previewW.toFixed(2)}px` : `${mm(total.w)}mm`;
  const heightAttr = options.previewH ? `${options.previewH.toFixed(2)}px` : `${mm(total.h)}mm`;
  const styleAttr = options.previewW && options.previewH
    ? ` style="width:${widthAttr};height:${heightAttr};display:block;"`
    : '';

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${mm(total.w)} ${mm(total.h)}" width="${widthAttr}" height="${heightAttr}"${styleAttr} data-flyer-svg="1">`);
  parts.push(`<rect x="0" y="0" width="${mm(total.w)}" height="${mm(total.h)}" fill="${bg}"/>`);

  // Trim box
  parts.push(`<rect x="${mm(page.trim.x)}" y="${mm(page.trim.y)}" width="${mm(page.trim.w)}" height="${mm(page.trim.h)}" fill="none" stroke="#000000" stroke-opacity="0.12" stroke-width="0.3"/>`);

  // Safe area debug
  if (options.includeDebugBoxes) {
    parts.push(`<rect x="${mm(page.safe.x)}" y="${mm(page.safe.y)}" width="${mm(page.safe.w)}" height="${mm(page.safe.h)}" fill="none" stroke="#ef4444" stroke-opacity="0.35" stroke-width="0.3" stroke-dasharray="2 2"/>`);
  }

  // Clip paths for text blocks (guarantee no overflow beyond box)
  const clipParts: string[] = [];
  for (const id of ['headline', 'subheadline', 'body', 'cta', 'qrLabel'] as const) {
    const box = plan.boxes[id];
    if (box && plan.visibility[id]) {
      clipParts.push(`<clipPath id="clip-${id}"><rect x="${mm(box.x)}" y="${mm(box.y)}" width="${mm(box.w)}" height="${mm(box.h)}"/></clipPath>`);
    }
  }
  if (clipParts.length > 0) {
    parts.push(`<defs>${clipParts.join('')}</defs>`);
  }

  // Hero
  if (plan.visibility.hero && plan.boxes.hero && flyer.content.heroImage) {
    const hero = plan.boxes.hero;
    parts.push(`<image href="${escapeXmlAttr(flyer.content.heroImage)}" x="${mm(hero.x)}" y="${mm(hero.y)}" width="${mm(hero.w)}" height="${mm(hero.h)}" preserveAspectRatio="xMidYMid slice"/>`);
  } else if (plan.visibility.hero && plan.boxes.hero) {
    const hero = plan.boxes.hero;
    parts.push(`<rect x="${mm(hero.x)}" y="${mm(hero.y)}" width="${mm(hero.w)}" height="${mm(hero.h)}" fill="${accent}" fill-opacity="0.08"/>`);
  }

  // Accent bar
  if (plan.visibility.accent && plan.boxes.accent) {
    const a = plan.boxes.accent;
    parts.push(`<rect x="${mm(a.x)}" y="${mm(a.y)}" width="${mm(a.w)}" height="${mm(a.h)}" fill="${accent}"/>`);
  }

  const centered = plan.layout === 'centered';

  // Headline (native SVG text)
  if (plan.visibility.headline && plan.boxes.headline && plan.text.headline.text) {
    parts.push(renderTextBlock(
      plan.text.headline,
      plan.boxes.headline,
      { font, color: text, fontWeight: 700, align: centered ? 'center' : 'left', upperCase: true, clipId: 'clip-headline', baseline: 'hanging' },

    ));
  }

  // Subheadline (native SVG text)
  if (plan.visibility.subheadline && plan.boxes.subheadline && plan.text.subheadline.text) {
    parts.push(renderTextBlock(
      plan.text.subheadline,
      plan.boxes.subheadline,
      { font, color: accent, fontWeight: 700, align: centered ? 'center' : 'left', upperCase: false, clipId: 'clip-subheadline', baseline: 'hanging' },
    ));
  }

  // Body (foreignObject with guaranteed clipping + columns)
  if (plan.visibility.body && plan.boxes.body && plan.text.body.text) {
    const bodyBox = plan.boxes.body;
    const body = plan.text.body;
    const magazine = plan.layout === 'magazine';
    const columnCount = magazine ? magazineColumnCount(plan.size, bodyBox.h) : 1;
    const colGap = 3;
    const bodyStyle = [
      `width:100%;min-width:0;max-width:100%;`,
      `font-size:${(body.fontSizePt * MM_PER_PT).toFixed(4)}px;line-height:1.3;`,
      `margin:0;padding:0;overflow:hidden;overflow-wrap:anywhere;`,
      columnCount > 1 ? `column-count:${columnCount};column-gap:${mm(colGap)}mm;` : '',
    ].join('');

    parts.push(`<foreignObject x="${mm(bodyBox.x)}" y="${mm(bodyBox.y)}" width="${mm(bodyBox.w)}" height="${mm(bodyBox.h)}" clip-path="url(#clip-body)">`);
    parts.push(`<div xmlns="http://www.w3.org/1999/xhtml" style="${bodyStyle}font-family:${font}, sans-serif;color:${text};">`);
    // Render body text as pre-wrapped lines to match the plan exactly
    const bodyLines = body.lines;
    for (const line of bodyLines) {
      parts.push(`<div style="margin:0;padding:0;">${escapeHtml(line)}</div>`);
    }
    parts.push('</div></foreignObject>');
  }

  // CTA (native SVG text on colored rect)
  if (plan.visibility.cta && plan.boxes.cta) {
    const cta = plan.boxes.cta;
    parts.push(`<rect x="${mm(cta.x)}" y="${mm(cta.y)}" width="${mm(cta.w)}" height="${mm(cta.h)}" rx="0.8" fill="${accent}"/>`);
    if (plan.text.cta.text) {
      const ctaBlock = plan.text.cta;
      // Center the text block vertically in the button using text-before-edge.
      const ctaY = cta.y + (cta.h - ctaBlock.fontSizePt * MM_PER_PT) / 2;
      parts.push(`<text x="${mm(cta.x + cta.w / 2)}" y="${mm(ctaY)}" text-anchor="middle" dominant-baseline="text-before-edge" font-family="${font}" font-size="${(ctaBlock.fontSizePt * MM_PER_PT).toFixed(4)}" font-weight="700" fill="#FFFFFF" clip-path="url(#clip-cta)" letter-spacing="-0.01em">${escapeXmlAttr(ctaBlock.text.toUpperCase())}</text>`);
    }
  }

  // QR
  if (plan.visibility.qr && plan.boxes.qr && qrPayload) {
    const qr = plan.boxes.qr;
    const inline = inlineQrSvg(qrPayload, text);
    if (inline) {
      const scale = qr.w / inline.size;
      parts.push(`<g transform="translate(${mm(qr.x)} ${mm(qr.y)}) scale(${scale})"><rect width="${inline.size}" height="${inline.size}" fill="#FFFFFF"/>${inline.inner}</g>`);
    }
    if (plan.visibility.qrLabel && plan.boxes.qrLabel && plan.text.qrLabel.text) {
      const qrBox = plan.boxes.qr;
      const lblBox = plan.boxes.qrLabel;
      const isLeftOfQr = qrBox && lblBox.x + lblBox.w <= qrBox.x + 0.5;
      parts.push(renderTextBlock(
        plan.text.qrLabel,
        plan.boxes.qrLabel,
        { font, color: text, fontWeight: 400, align: isLeftOfQr ? 'left' : 'center', upperCase: false, clipId: 'clip-qrLabel', baseline: 'hanging' },
      ));
    }
  }

  if (options.includeDebugBoxes) {
    for (const [id, box] of Object.entries(plan.boxes)) {
      if (!box) continue;
      parts.push(`<rect x="${mm(box.x)}" y="${mm(box.y)}" width="${mm(box.w)}" height="${mm(box.h)}" fill="none" stroke="${plan.visibility[id as keyof typeof plan.visibility] ? '#22c55e' : '#94a3b8'}" stroke-opacity="0.5" stroke-width="0.2"/>`);
    }
  }

  parts.push('</svg>');
  return parts.join('');
}

export function buildFlyerSvg(flyer: Flyer, options?: SvgRenderOptions): string {
  const plan = computeFlyerLayout(flyer);
  return renderFlyerSvg(plan, flyer, options);
}