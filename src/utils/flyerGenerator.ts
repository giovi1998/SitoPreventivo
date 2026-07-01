/**
 * Phase 3, Flyer generator.
 *
 * Single-page print-ready flyers in 4 layouts (classic, centered,
 * split, magazine) × 5 sizes (A6, A5, A4, Letter, Square). Bleed
 * 3mm on all sides per print-shop standards. Crop marks via
 * pdfmake's built-in mark support.
 *
 * Two export surfaces:
 * - `generateFlyerPdf` → Uint8Array (pdfmake buffer)
 * - `generateFlyerPng` → Uint8Array (canvas pipeline, includes bleed)
 *
 * Both apply tier-aware watermark (free = QUICKBRAND diagonal pattern;
 * unlocked = no-op). PNG export respects tier DPI cap (free=72,
 * unlocked=300).
 */

import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Flyer, FlyerLayout, FlyerContent } from './documentSchemas';
import { getFlyerDimensions, FLYER_BLEED_MM } from './documentSchemas';
import { generateQrSvg, isHttpUrl } from './qrGenerator';
import { applyWatermarkToCanvas, applyWatermarkToPdf, getDpiForTier, getMaxPngSideForTier, type Tier } from './watermark';

pdfMake.vfs = pdfFonts;

// pdfmake content type is loosely typed in the project (no @types/pdfmake).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Content = any;

const PT_PER_MM = 2.83464567;
const DPI = 300; // baseline for canvas rendering (tier-aware via getDpiForTier)

function mmToPt(mm: number): number {
  return mm * PT_PER_MM;
}

function escapeXml(s: string): string {
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

function decodeSvgDataUri(src: string): string | null {
  if (!src.startsWith('data:image/svg+xml')) return null;
  const comma = src.indexOf(',');
  if (comma === -1) return null;
  const meta = src.slice(0, comma);
  const payload = src.slice(comma + 1);
  try {
    if (/;base64/i.test(meta)) {
      if (typeof atob === 'function') return decodeURIComponent(escape(atob(payload)));
      return Buffer.from(payload, 'base64').toString('utf8');
    }
    return decodeURIComponent(payload);
  } catch {
    return null;
  }
}

function pdfImageOrSvg(src: string, opts: Record<string, unknown>): Content {
  const svg = decodeSvgDataUri(src);
  if (svg) return { svg, ...opts };
  return { image: src, ...opts };
}

function safeHex(color: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}

function getQrPayload(flyer: Flyer): string {
  if (flyer.content.qrPayload && flyer.content.qrPayload.trim()) {
    return flyer.content.qrPayload.trim();
  }
  if (flyer.content.cta.url && isHttpUrl(flyer.content.cta.url)) {
    return flyer.content.cta.url;
  }
  return '';
}

function isCtaValid(flyer: Flyer): boolean {
  if (!flyer.content.cta.label.trim()) return false;
  if (!flyer.content.cta.url.trim()) return false;
  return isHttpUrl(flyer.content.cta.url);
}

function splitBodyLines(body: string, maxLineLen: number): string[] {
  if (!body) return [];
  // Split on \n first, then wrap each paragraph to maxLineLen
  const paragraphs = body.split(/\n+/);
  const lines: string[] = [];
  for (const p of paragraphs) {
    const words = p.split(/\s+/);
    let current = '';
    for (const w of words) {
      if (!w) continue;
      if (current.length === 0) {
        current = w;
      } else if (current.length + 1 + w.length <= maxLineLen) {
        current = `${current} ${w}`;
      } else {
        lines.push(current);
        current = w;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

// ─── PDF BUILDERS ──────────────────────────────────────────────

function buildClassicPdf(flyer: Flyer, dims: { w: number; h: number }): Content[] {
  const padding = 8;
  const innerW = dims.w - padding * 2;
  const cells: Content[] = [];
  const { headline, subheadline, body } = flyer.content;
  const textColor = safeHex(flyer.style.textColor, '#1a1a2e');
  const accentColor = safeHex(flyer.style.accentColor, '#01696F');
  const font = flyer.style.fontFamily || 'Helvetica';

  // Hero image (60% top)
  const heroH = Math.max(20, dims.h * 0.45);
  if (flyer.content.heroImage) {
    cells.push(pdfImageOrSvg(flyer.content.heroImage, {
      width: innerW,
      height: heroH,
      absolutePosition: { x: padding, y: padding },
    }));
  } else {
    cells.push({
      canvas: [
        { type: 'rect', x: padding, y: padding, w: innerW, h: heroH, color: accentColor, fillOpacity: 0.08 },
      ],
      absolutePosition: { x: 0, y: 0 },
    });
    cells.push({
      text: 'Hero image',
      color: accentColor,
      fontSize: 14,
      absolutePosition: { x: padding + 12, y: padding + heroH / 2 - 6 },
    });
  }

  // Accent bar
  const barY = padding + heroH + 4;
  cells.push({
    canvas: [
      { type: 'rect', x: padding, y: barY, w: 24, h: 1.5, color: accentColor, fillOpacity: 1 },
    ],
    absolutePosition: { x: 0, y: 0 },
  });

  // Headline (always present, but may be empty)
  let cursorY = barY + 6;
  if (headline) {
    cells.push({
      text: headline.toUpperCase(),
      color: textColor,
      fontSize: Math.min(22, Math.max(12, dims.w / 6)),
      bold: true,
      absolutePosition: { x: padding, y: cursorY },
    });
    cursorY += Math.min(12, Math.max(7, dims.w / 12));
  }
  if (subheadline) {
    cells.push({
      text: subheadline,
      color: accentColor,
      fontSize: Math.min(12, Math.max(9, dims.w / 14)),
      absolutePosition: { x: padding, y: cursorY },
    });
    cursorY += Math.min(8, Math.max(5, dims.w / 18));
  }
  if (body) {
    const lines = splitBodyLines(body, Math.max(40, Math.floor(dims.w * 1.5)));
    cells.push({
      text: lines,
      color: textColor,
      fontSize: Math.min(11, Math.max(8, dims.w / 16)),
      lineHeight: 1.25,
      absolutePosition: { x: padding, y: cursorY },
    });
    cursorY += lines.length * (Math.min(11, Math.max(8, dims.w / 16))) * 0.5 + 4;
  }
  pushCtaAndQr(flyer, dims, padding, cursorY, cells, textColor, accentColor, font);
  return cells;
}

function buildCenteredPdf(flyer: Flyer, dims: { w: number; h: number }): Content[] {
  const padding = 8;
  const cells: Content[] = [];
  const { headline, subheadline, body } = flyer.content;
  const textColor = safeHex(flyer.style.textColor, '#1a1a2e');
  const accentColor = safeHex(flyer.style.accentColor, '#01696F');

  let cursorY = padding + (flyer.content.heroImage ? Math.min(20, dims.h * 0.12) : 4);
  if (flyer.content.heroImage) {
    const heroH = Math.min(20, dims.h * 0.12);
    const heroW = Math.min(dims.w - padding * 2, 24);
    cells.push(pdfImageOrSvg(flyer.content.heroImage, {
      width: heroW,
      height: heroH,
      absolutePosition: { x: (dims.w - heroW) / 2, y: padding },
    }));
  }

  // Centered headline
  if (headline) {
    cells.push({
      text: headline.toUpperCase(),
      color: textColor,
      fontSize: Math.min(24, Math.max(14, dims.w / 5)),
      bold: true,
      alignment: 'center',
      absolutePosition: { x: padding, y: cursorY, width: dims.w - padding * 2 },
    });
    cursorY += Math.min(14, Math.max(8, dims.w / 9));
  }
  // Accent rule
  cells.push({
    canvas: [
      { type: 'rect', x: dims.w / 2 - 18, y: cursorY, w: 36, h: 0.8, color: accentColor, fillOpacity: 1 },
    ],
    absolutePosition: { x: 0, y: 0 },
  });
  cursorY += 5;
  if (subheadline) {
    cells.push({
      text: subheadline,
      color: accentColor,
      fontSize: Math.min(13, Math.max(10, dims.w / 12)),
      alignment: 'center',
      absolutePosition: { x: padding, y: cursorY, width: dims.w - padding * 2 },
    });
    cursorY += Math.min(8, Math.max(6, dims.w / 16));
  }
  if (body) {
    const lines = splitBodyLines(body, Math.max(40, Math.floor(dims.w * 1.6)));
    cells.push({
      text: lines,
      color: textColor,
      fontSize: Math.min(11, Math.max(8, dims.w / 16)),
      alignment: 'center',
      lineHeight: 1.3,
      absolutePosition: { x: padding, y: cursorY, width: dims.w - padding * 2 },
    });
    cursorY += lines.length * (Math.min(11, Math.max(8, dims.w / 16))) * 0.5 + 4;
  }
  pushCtaAndQr(flyer, dims, padding, cursorY, cells, textColor, accentColor, flyer.style.fontFamily || 'Helvetica');
  return cells;
}

function buildSplitPdf(flyer: Flyer, dims: { w: number; h: number }): Content[] {
  const padding = 6;
  const halfW = (dims.w - padding * 3) / 2;
  const cells: Content[] = [];
  const { headline, subheadline, body } = flyer.content;
  const textColor = safeHex(flyer.style.textColor, '#1a1a2e');
  const accentColor = safeHex(flyer.style.accentColor, '#01696F');
  const heroLeft = dims.w >= dims.h; // landscape: image on left; portrait: image on top

  if (heroLeft) {
    // Image left, text right
    if (flyer.content.heroImage) {
      cells.push(pdfImageOrSvg(flyer.content.heroImage, {
        width: halfW,
        height: dims.h - padding * 2,
        absolutePosition: { x: padding, y: padding },
      }));
    } else {
      cells.push({
        canvas: [
          { type: 'rect', x: padding, y: padding, w: halfW, h: dims.h - padding * 2, color: accentColor, fillOpacity: 0.08 },
        ],
        absolutePosition: { x: 0, y: 0 },
      });
    }
    let cursorY = padding + 6;
    const textX = padding * 2 + halfW;
    const textW = halfW;
    if (headline) {
      cells.push({
        text: headline.toUpperCase(),
        color: textColor,
        fontSize: Math.min(18, Math.max(11, halfW / 5)),
        bold: true,
        absolutePosition: { x: textX, y: cursorY, width: textW },
      });
      cursorY += Math.min(10, Math.max(7, halfW / 8));
    }
    if (subheadline) {
      cells.push({
        text: subheadline,
        color: accentColor,
        fontSize: Math.min(11, Math.max(9, halfW / 12)),
        absolutePosition: { x: textX, y: cursorY, width: textW },
      });
      cursorY += Math.min(7, Math.max(5, halfW / 14));
    }
    if (body) {
      const lines = splitBodyLines(body, Math.max(30, Math.floor(halfW * 1.4)));
      cells.push({
        text: lines,
        color: textColor,
        fontSize: Math.min(10, Math.max(7, halfW / 12)),
        lineHeight: 1.25,
        absolutePosition: { x: textX, y: cursorY, width: textW },
      });
      cursorY += lines.length * (Math.min(10, Math.max(7, halfW / 12))) * 0.5 + 3;
    }
    pushCtaAndQr(flyer, { w: textW, h: dims.h - padding * 2 }, textX, cursorY, cells, textColor, accentColor, flyer.style.fontFamily || 'Helvetica');
  } else {
    // Image top, text bottom (portrait)
    const heroH = Math.max(40, dims.h * 0.55);
    if (flyer.content.heroImage) {
      cells.push(pdfImageOrSvg(flyer.content.heroImage, {
        width: dims.w - padding * 2,
        height: heroH,
        absolutePosition: { x: padding, y: padding },
      }));
    } else {
      cells.push({
        canvas: [
          { type: 'rect', x: padding, y: padding, w: dims.w - padding * 2, h: heroH, color: accentColor, fillOpacity: 0.08 },
        ],
        absolutePosition: { x: 0, y: 0 },
      });
    }
    let cursorY = padding + heroH + 4;
    if (headline) {
      cells.push({
        text: headline.toUpperCase(),
        color: textColor,
        fontSize: Math.min(18, Math.max(12, dims.w / 7)),
        bold: true,
        absolutePosition: { x: padding, y: cursorY, width: dims.w - padding * 2 },
      });
      cursorY += Math.min(10, Math.max(7, dims.w / 12));
    }
    if (subheadline) {
      cells.push({
        text: subheadline,
        color: accentColor,
        fontSize: Math.min(11, Math.max(9, dims.w / 14)),
        absolutePosition: { x: padding, y: cursorY, width: dims.w - padding * 2 },
      });
      cursorY += Math.min(7, Math.max(5, dims.w / 18));
    }
    if (body) {
      const lines = splitBodyLines(body, Math.max(40, Math.floor(dims.w * 1.5)));
      cells.push({
        text: lines,
        color: textColor,
        fontSize: Math.min(10, Math.max(7, dims.w / 16)),
        lineHeight: 1.25,
        absolutePosition: { x: padding, y: cursorY, width: dims.w - padding * 2 },
      });
      cursorY += lines.length * (Math.min(10, Math.max(7, dims.w / 16))) * 0.5 + 3;
    }
    pushCtaAndQr(flyer, dims, padding, cursorY, cells, textColor, accentColor, flyer.style.fontFamily || 'Helvetica');
  }
  return cells;
}

function buildMagazinePdf(flyer: Flyer, dims: { w: number; h: number }): Content[] {
  const padding = 6;
  const cells: Content[] = [];
  const { headline, subheadline, body } = flyer.content;
  const textColor = safeHex(flyer.style.textColor, '#1a1a2e');
  const accentColor = safeHex(flyer.style.accentColor, '#01696F');

  // Top: centered title block
  if (headline) {
    cells.push({
      text: headline.toUpperCase(),
      color: textColor,
      fontSize: Math.min(22, Math.max(13, dims.w / 6)),
      bold: true,
      alignment: 'center',
      absolutePosition: { x: padding, y: padding, width: dims.w - padding * 2 },
    });
  }
  if (subheadline) {
    cells.push({
      text: subheadline,
      color: accentColor,
      fontSize: Math.min(11, Math.max(9, dims.w / 14)),
      alignment: 'center',
      absolutePosition: { x: padding, y: padding + Math.min(12, Math.max(8, dims.w / 9)), width: dims.w - padding * 2 },
    });
  }
  // Accent rule
  cells.push({
    canvas: [
      { type: 'rect', x: dims.w / 2 - 12, y: padding + Math.min(18, Math.max(12, dims.w / 7)), w: 24, h: 0.6, color: accentColor, fillOpacity: 1 },
    ],
    absolutePosition: { x: 0, y: 0 },
  });
  // 3-column body grid
  const startY = padding + Math.min(22, Math.max(15, dims.w / 5));
  const colGap = 3;
  const colW = (dims.w - padding * 2 - colGap * 2) / 3;
  const colH = dims.h - startY - padding - 10; // leave room for CTA/QR
  const lines = splitBodyLines(body, Math.max(20, Math.floor(colW * 1.4)));
  // Distribute lines across 3 columns
  const per = Math.ceil(lines.length / 3) || 1;
  for (let c = 0; c < 3; c++) {
    const chunk = lines.slice(c * per, c * per + per);
    if (chunk.length === 0) continue;
    cells.push({
      text: chunk,
      color: textColor,
      fontSize: Math.min(10, Math.max(7, colW / 8)),
      lineHeight: 1.3,
      absolutePosition: { x: padding + c * (colW + colGap), y: startY, width: colW, height: colH },
    });
  }
  pushCtaAndQr(flyer, dims, padding, dims.h - padding - 8, cells, textColor, accentColor, flyer.style.fontFamily || 'Helvetica');
  return cells;
}

function pushCtaAndQr(
  flyer: Flyer,
  dims: { w: number; h: number },
  baseX: number,
  baseY: number,
  cells: Content[],
  textColor: string,
  accentColor: string,
  font: string
) {
  // Reserve vertical space: CTA label on left, optional QR on right
  const qrSize = Math.max(12, Math.min(20, dims.w * 0.18));
  const hasQr = !!getQrPayload(flyer) && !isCtaValid(flyer) ? false : !!getQrPayload(flyer);
  const hasCta = isCtaValid(flyer);
  if (!hasCta && !hasQr) return;
  if (hasCta) {
    cells.push({
      table: {
        widths: [Math.max(20, dims.w * 0.4)],
        body: [
          [{
            text: flyer.content.cta.label.toUpperCase(),
            color: '#FFFFFF',
            fillColor: accentColor,
            fontSize: Math.min(11, Math.max(9, dims.w / 16)),
            bold: true,
            alignment: 'center',
            margin: [0, 2, 0, 2],
          }],
        ],
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
      },
      absolutePosition: { x: baseX, y: baseY + 2 },
    });
  }
  if (hasQr) {
    const qrSvg = generateQrSvg({
      documentType: 'qrCode',
      id: `${flyer.id}-flyer-qr`,
      title: 'flyer-qr',
      data: { type: 'url', payload: getQrPayload(flyer) },
      style: {
        errorCorrection: 'M',
        fgColor: textColor,
        bgColor: '#FFFFFF',
        size: 512,
        margin: 1,
        logoOverlay: null,
        dotStyle: 'square',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const qrX = hasCta ? baseX + Math.max(20, dims.w * 0.4) + 4 : baseX;
    cells.push({
      svg: qrSvg,
      width: qrSize,
      height: qrSize,
      absolutePosition: { x: qrX, y: baseY },
    });
    if (flyer.content.qrLabel && hasQr) {
      cells.push({
        text: flyer.content.qrLabel,
        color: textColor,
        fontSize: Math.min(7, Math.max(5, dims.w / 24)),
        absolutePosition: { x: qrX, y: baseY + qrSize + 1, width: qrSize },
      });
    }
  }
  void font;
}

function buildContentForLayout(flyer: Flyer, dims: { w: number; h: number }): Content[] {
  switch (flyer.style.layout) {
    case 'classic': return buildClassicPdf(flyer, dims);
    case 'centered': return buildCenteredPdf(flyer, dims);
    case 'split': return buildSplitPdf(flyer, dims);
    case 'magazine': return buildMagazinePdf(flyer, dims);
  }
}

// ─── PUBLIC API ──────────────────────────────────────────────

export interface FlyerExportOptions {
  tier: Tier;
}

export async function generateFlyerPdf(
  flyer: Flyer,
  options: FlyerExportOptions
): Promise<Uint8Array> {
  const dims = getFlyerDimensions(flyer);
  // Phase 3: usa buildFlyerSvg come SINGLE SOURCE OF TRUTH. Il PDF
  // embedda l'SVG in pdfmake (che lo renderizza nativamente). In
  // questo modo le proporzioni della preview coincidono 1:1 con
  // l'export PDF. Watermark + bleed gestiti da pdfmake come prima.
  const svg = buildFlyerSvg(flyer);
  const docDefinition: any = {
    pageSize: { width: mmToPt(dims.w), height: mmToPt(dims.h) },
    pageMargins: [mmToPt(FLYER_BLEED_MM), mmToPt(FLYER_BLEED_MM), mmToPt(FLYER_BLEED_MM), mmToPt(FLYER_BLEED_MM)],
    content: [
      {
        svg,
        width: mmToPt(dims.w - FLYER_BLEED_MM * 2),
        height: mmToPt(dims.h - FLYER_BLEED_MM * 2),
        absolutePosition: { x: 0, y: 0 },
      },
    ],
    info: { title: flyer.title || 'Volantino' },
  };
  const withWatermark = applyWatermarkToPdf(docDefinition, options.tier);
  return await new Promise<Uint8Array>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout generazione PDF volantino')), 20_000);
    try {
      const doc = (pdfMake as any).createPdf(withWatermark);
      if (typeof doc.getBlob === 'function') {
        const maybePromise = doc.getBlob(async (blob: Blob) => {
          try {
            const ab = await blob.arrayBuffer();
            clearTimeout(timeout);
            resolve(new Uint8Array(ab));
          } catch (e) {
            clearTimeout(timeout);
            reject(e);
          }
        });
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise
            .then(async (blob: Blob) => {
              const ab = await blob.arrayBuffer();
              clearTimeout(timeout);
              resolve(new Uint8Array(ab));
            })
            .catch((e: unknown) => { clearTimeout(timeout); reject(e); });
        }
        return;
      }
      const maybePromise = doc.getBuffer((buf: Uint8Array) => {
        clearTimeout(timeout);
        resolve(new Uint8Array(buf));
      });
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise
          .then((buf: Uint8Array) => { clearTimeout(timeout); resolve(new Uint8Array(buf)); })
          .catch((e: unknown) => { clearTimeout(timeout); reject(e); });
      }
    } catch (e) {
      clearTimeout(timeout);
      reject(e);
    }
  });
}

// ─── PNG export (canvas pipeline) ──────────────────────────────

/**
 * Render a flyer to PNG via an offscreen canvas. Same logic as the
 * PDF generator but adapted to a 2D context. Bleed is included in
 * the output (matches PDF behavior so the user can crop to the
 * trim line if needed).
 *
 * Returns a Uint8Array containing the PNG bytes.
 */
export async function generateFlyerPng(
  flyer: Flyer,
  options: FlyerExportOptions
): Promise<Uint8Array> {
  const tierDpi = getDpiForTier(options.tier, DPI, 'png');
  const maxSide = getMaxPngSideForTier(options.tier);
  const dims = getFlyerDimensions(flyer);
  const totalWmm = dims.w + FLYER_BLEED_MM * 2;
  const totalHmm = dims.h + FLYER_BLEED_MM * 2;
  // Phase 3: usa buildFlyerSvg come SINGLE SOURCE OF TRUTH. L'SVG
  // viene rasterizzato a canvas via <img>. Così le proporzioni di
  // preview, PDF e PNG coincidono.
  let widthPx = Math.round(totalWmm * tierDpi / 25.4);
  let heightPx = Math.round(totalHmm * tierDpi / 25.4);
  if (widthPx > maxSide || heightPx > maxSide) {
    const ratio = maxSide / Math.max(widthPx, heightPx);
    widthPx = Math.round(widthPx * ratio);
    heightPx = Math.round(heightPx * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D non disponibile');

  // Rasterizza l'SVG via <img>. await onload per assicurarsi che il
  // disegno sia completo prima di toBlob.
  const svg = buildFlyerSvg(flyer);
  const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
  const svgUrl = URL.createObjectURL(svgBlob);
  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        ctx.drawImage(img, 0, 0, widthPx, heightPx);
        URL.revokeObjectURL(svgUrl);
        resolve();
      } catch (e) { reject(e); }
    };
    img.onerror = (e) => { URL.revokeObjectURL(svgUrl); reject(new Error('SVG non rasterizzabile')); };
    img.src = svgUrl;
  });

  // Watermark last
  applyWatermarkToCanvas(ctx, options.tier, widthPx, heightPx);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Esportazione PNG fallita');
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

// ─── PNG DRAW HELPERS ──────────────────────────────────────────

function measureLines(
  ctx: CanvasRenderingContext2D,
  body: string,
  maxWidth: number
): string[] {
  if (!body) return [];
  const out: string[] = [];
  for (const para of body.split(/\n+/)) {
    const words = para.split(/\s+/);
    let line = '';
    for (const w of words) {
      if (!w) continue;
      if (!line) {
        line = w;
      } else {
        const test = `${line} ${w}`;
        if (ctx.measureText(test).width <= maxWidth) {
          line = test;
        } else {
          out.push(line);
          line = w;
        }
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function drawHeroImageOrPlaceholder(
  ctx: CanvasRenderingContext2D,
  heroImage: string | null,
  x: number,
  y: number,
  w: number,
  h: number,
  accentColor: string
): Promise<void> {
  return new Promise((resolve) => {
    if (!heroImage) {
      ctx.fillStyle = withAlpha(accentColor, 0.08);
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = accentColor;
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Hero image', x + w / 2, y + h / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      resolve();
      return;
    }
    const img = new Image();
    img.onload = () => {
      // Cover-fit: scale to fill the box, centered
      const scale = Math.max(w / img.width, h / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const dx = x + (w - drawW) / 2;
      const dy = y + (h - drawH) / 2;
      ctx.drawImage(img, dx, dy, drawW, drawH);
      resolve();
    };
    img.onerror = () => {
      ctx.fillStyle = withAlpha(accentColor, 0.08);
      ctx.fillRect(x, y, w, h);
      resolve();
    };
    img.src = heroImage;
  });
}

function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawCtaAndQrPng(
  ctx: CanvasRenderingContext2D,
  flyer: Flyer,
  baseX: number,
  baseY: number,
  areaW: number,
  textColor: string,
  accentColor: string,
  font: string
): { nextY: number } {
  let cursorX = baseX;
  const hasCta = isCtaValid(flyer);
  const hasQr = !!getQrPayload(flyer);
  if (hasCta) {
    ctx.font = `bold ${Math.max(10, Math.min(13, areaW / 18))}px ${font}`;
    const label = flyer.content.cta.label.toUpperCase();
    const padX = 10;
    const padY = 4;
    const textW = ctx.measureText(label).width;
    const btnW = textW + padX * 2;
    const btnH = 22;
    ctx.fillStyle = accentColor;
    roundRect(ctx, cursorX, baseY, btnW, btnH, 4);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cursorX + btnW / 2, baseY + btnH / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    cursorX += btnW + 6;
  }
  if (hasQr) {
    const qrSize = Math.max(40, Math.min(72, areaW * 0.18));
    const qrSvg = generateQrSvg({
      documentType: 'qrCode',
      id: `${flyer.id}-flyer-qr`,
      title: 'flyer-qr',
      data: { type: 'url', payload: getQrPayload(flyer) },
      style: {
        errorCorrection: 'M',
        fgColor: textColor,
        bgColor: '#FFFFFF',
        size: 512,
        margin: 1,
        logoOverlay: null,
        dotStyle: 'square',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    drawQrSvgToCanvas(ctx, qrSvg, cursorX, baseY, qrSize);
    if (flyer.content.qrLabel) {
      ctx.fillStyle = textColor;
      ctx.font = `${Math.max(7, Math.min(9, qrSize / 7))}px ${font}`;
      ctx.textAlign = 'center';
      ctx.fillText(flyer.content.qrLabel, cursorX + qrSize / 2, baseY + qrSize + 8);
      ctx.textAlign = 'left';
    }
    cursorX += qrSize + 4;
  }
  return { nextY: baseY + (hasQr ? 60 : 22) + (hasCta ? 4 : 0) };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawQrSvgToCanvas(
  ctx: CanvasRenderingContext2D,
  svg: string,
  x: number,
  y: number,
  size: number
) {
  // Quick path: build a data URL from the SVG and draw it as an image.
  // The QR SVG is small (≤ ~3KB), so this is cheap.
  const encoded = encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22');
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encoded}`;
  const img = new Image();
  img.onload = () => {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, size, size);
    ctx.drawImage(img, x, y, size, size);
  };
  img.onerror = () => {
    ctx.fillStyle = withAlpha('#000000', 0.05);
    ctx.fillRect(x, y, size, size);
  };
  img.src = dataUrl;
}

function drawTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  font: string,
  color: string,
  bold: boolean,
  align: CanvasTextAlign = 'left'
): { height: number; endY: number } {
  ctx.fillStyle = color;
  ctx.font = `${bold ? 'bold ' : ''}${fontSize}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  const lines = wrapText(ctx, text, maxWidth);
  const lineH = fontSize * 1.25;
  lines.forEach((line, i) => {
    const tx = align === 'center' ? x + maxWidth / 2 : align === 'right' ? x + maxWidth : x;
    ctx.fillText(line, tx, y + i * lineH);
  });
  return { height: lines.length * lineH, endY: y + lines.length * lineH };
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const para of text.split(/\n+/)) {
    const words = para.split(/\s+/);
    let line = '';
    for (const w of words) {
      if (!w) continue;
      if (!line) {
        line = w;
      } else {
        const test = `${line} ${w}`;
        if (ctx.measureText(test).width <= maxWidth) {
          line = test;
        } else {
          out.push(line);
          line = w;
        }
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function drawClassicPng(
  ctx: CanvasRenderingContext2D,
  flyer: Flyer,
  w: number, h: number,
  textColor: string, accentColor: string, font: string,
  bleedPx: number
): void {
  const padding = bleedPx;
  const innerW = w - padding * 2;
  const heroH = h * 0.45;
  void drawHeroImageOrPlaceholder(ctx, flyer.content.heroImage, padding, padding, innerW, heroH, accentColor);
  // Accent bar
  ctx.fillStyle = accentColor;
  ctx.fillRect(padding, padding + heroH + 4, 24, 1.5);
  let cursorY = padding + heroH + 14;
  const c = flyer.content;
  if (c.headline) {
    const r = drawTextLines(ctx, c.headline.toUpperCase(), padding, cursorY, innerW, Math.max(12, w / 24), font, textColor, true);
    cursorY = r.endY + 2;
  }
  if (c.subheadline) {
    const r = drawTextLines(ctx, c.subheadline, padding, cursorY, innerW, Math.max(9, w / 32), font, accentColor, false);
    cursorY = r.endY + 2;
  }
  if (c.body) {
    const r = drawTextLines(ctx, c.body, padding, cursorY, innerW, Math.max(8, w / 38), font, textColor, false);
    cursorY = r.endY + 4;
  }
  drawCtaAndQrPng(ctx, flyer, padding, cursorY, innerW, textColor, accentColor, font);
}

function drawCenteredPng(
  ctx: CanvasRenderingContext2D,
  flyer: Flyer,
  w: number, h: number,
  textColor: string, accentColor: string, font: string,
  bleedPx: number
): void {
  const padding = bleedPx;
  const innerW = w - padding * 2;
  let cursorY = padding;
  if (flyer.content.heroImage) {
    const heroH = h * 0.15;
    const heroW = Math.min(innerW, w * 0.4);
    void drawHeroImageOrPlaceholder(ctx, flyer.content.heroImage, (w - heroW) / 2, padding, heroW, heroH, accentColor);
    cursorY += heroH + 4;
  }
  if (flyer.content.headline) {
    const r = drawTextLines(ctx, flyer.content.headline.toUpperCase(), padding, cursorY, innerW, Math.max(14, w / 22), font, textColor, true, 'center');
    cursorY = r.endY + 2;
  }
  ctx.fillStyle = accentColor;
  ctx.fillRect(w / 2 - 18, cursorY + 2, 36, 0.8);
  cursorY += 8;
  if (flyer.content.subheadline) {
    const r = drawTextLines(ctx, flyer.content.subheadline, padding, cursorY, innerW, Math.max(10, w / 28), font, accentColor, false, 'center');
    cursorY = r.endY + 2;
  }
  if (flyer.content.body) {
    const r = drawTextLines(ctx, flyer.content.body, padding, cursorY, innerW, Math.max(8, w / 36), font, textColor, false, 'center');
    cursorY = r.endY + 4;
  }
  drawCtaAndQrPng(ctx, flyer, padding, cursorY, innerW, textColor, accentColor, font);
}

function drawSplitPng(
  ctx: CanvasRenderingContext2D,
  flyer: Flyer,
  w: number, h: number,
  textColor: string, accentColor: string, font: string,
  bleedPx: number
): void {
  const padding = bleedPx;
  const innerW = w - padding * 2;
  const heroLeft = w >= h;
  if (heroLeft) {
    const halfW = (innerW - padding) / 2;
    void drawHeroImageOrPlaceholder(ctx, flyer.content.heroImage, padding, padding, halfW, h - padding * 2, accentColor);
    let cursorY = padding + 6;
    const textX = padding + halfW + padding;
    const textW = halfW;
    if (flyer.content.headline) {
      const r = drawTextLines(ctx, flyer.content.headline.toUpperCase(), textX, cursorY, textW, Math.max(11, halfW / 14), font, textColor, true);
      cursorY = r.endY + 2;
    }
    if (flyer.content.subheadline) {
      const r = drawTextLines(ctx, flyer.content.subheadline, textX, cursorY, textW, Math.max(9, halfW / 18), font, accentColor, false);
      cursorY = r.endY + 2;
    }
    if (flyer.content.body) {
      const r = drawTextLines(ctx, flyer.content.body, textX, cursorY, textW, Math.max(7, halfW / 20), font, textColor, false);
      cursorY = r.endY + 4;
    }
    drawCtaAndQrPng(ctx, flyer, textX, cursorY, textW, textColor, accentColor, font);
  } else {
    const heroH = h * 0.55;
    void drawHeroImageOrPlaceholder(ctx, flyer.content.heroImage, padding, padding, innerW, heroH, accentColor);
    let cursorY = padding + heroH + 6;
    if (flyer.content.headline) {
      const r = drawTextLines(ctx, flyer.content.headline.toUpperCase(), padding, cursorY, innerW, Math.max(12, w / 22), font, textColor, true);
      cursorY = r.endY + 2;
    }
    if (flyer.content.subheadline) {
      const r = drawTextLines(ctx, flyer.content.subheadline, padding, cursorY, innerW, Math.max(9, w / 30), font, accentColor, false);
      cursorY = r.endY + 2;
    }
    if (flyer.content.body) {
      const r = drawTextLines(ctx, flyer.content.body, padding, cursorY, innerW, Math.max(7, w / 36), font, textColor, false);
      cursorY = r.endY + 4;
    }
    drawCtaAndQrPng(ctx, flyer, padding, cursorY, innerW, textColor, accentColor, font);
  }
}

function drawMagazinePng(
  ctx: CanvasRenderingContext2D,
  flyer: Flyer,
  w: number, h: number,
  textColor: string, accentColor: string, font: string,
  bleedPx: number
): void {
  const padding = bleedPx;
  const innerW = w - padding * 2;
  let cursorY = padding;
  if (flyer.content.headline) {
    const r = drawTextLines(ctx, flyer.content.headline.toUpperCase(), padding, cursorY, innerW, Math.max(13, w / 22), font, textColor, true, 'center');
    cursorY = r.endY + 2;
  }
  if (flyer.content.subheadline) {
    const r = drawTextLines(ctx, flyer.content.subheadline, padding, cursorY, innerW, Math.max(9, w / 30), font, accentColor, false, 'center');
    cursorY = r.endY + 4;
  }
  ctx.fillStyle = accentColor;
  ctx.fillRect(w / 2 - 12, cursorY + 2, 24, 0.8);
  cursorY += 8;
  const colGap = padding;
  const colW = (innerW - colGap * 2) / 3;
  const colH = h - cursorY - padding - 30;
  const lines = measureLines(ctx, flyer.content.body, colW);
  const per = Math.ceil(lines.length / 3) || 1;
  for (let c = 0; c < 3; c++) {
    const chunk = lines.slice(c * per, c * per + per);
    if (chunk.length === 0) continue;
    chunk.forEach((line, i) => {
      ctx.fillStyle = textColor;
      ctx.font = `${Math.max(7, colW / 7)}px ${font}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(line, padding + c * (colW + colGap), cursorY + i * (colW / 7) * 1.3);
    });
  }
  void colH;
  drawCtaAndQrPng(ctx, flyer, padding, h - padding - 28, innerW, textColor, accentColor, font);
}

// ─── UNIFIED SVG BUILDER (Phase 3) ─────────────────────────────
//
// `buildFlyerSvg` produce un SVG completo con viewBox in mm, usato
// sia dalla live preview sia dagli export PDF/PNG. In questo modo le
// proporzioni e la disposizione degli elementi sono identiche ovunque
// (preview = export). La funzione è la SINGLE SOURCE OF TRUTH per il
// layout del volantino.
//
// Coordinate: il viewBox è `0 0 totalWmm totalHmm` (mm reali del
// foglio, incluso il bleed 3mm). Il "safe area" è `BLEED 3mm` su ogni
// lato. Tutti gli elementi sono posizionati nel safe area, come in
// stampa reale.

function mm(v: number): string { return v.toFixed(3); }

// Inlining del QR: generaQrSvg ritorna un <svg> con viewBox proprio.
// Per inlinearlo nel parent SVG serve strippare l'outer <svg> e
// portare il viewBox dentro un <g transform="translate(x y) scale(s)">.
function inlineQrSvg(qrPayload: string, textColor: string): { inner: string; size: number } | null {
  if (!qrPayload) return null;
  const full = generateQrSvg({
    documentType: 'qrCode', id: 'flyer-export-qr', title: 'flyer-qr',
    data: { type: 'url', payload: qrPayload },
    style: { errorCorrection: 'M', fgColor: textColor, bgColor: '#FFFFFF', size: 512, margin: 1, logoOverlay: null, dotStyle: 'square' },
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  // Strip <svg ...> e </svg>, cattura il viewBox
  const m = full.match(/<svg[^>]*viewBox="([^"]+)"[^>]*>/);
  if (!m) return null;
  const inner = full.replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  // Il QR è renderizzato in 23x23 moduli (default), 1 viewBox unit = 1 modulo
  return { inner, size: 23 };
}

// Word-wrap di un body in righe che entrano in `maxWidthMm` al font
// `fontSizePt`. Il moltiplicatore 0.9 è conservativo: funziona per
// sia sans-serif (Inter/Roboto) che serif fallback (Georgia/serif).
// Meglio avere più righe che overflow. In produzione il font Inter
// è caricato e il fit è migliore.
function wrapBody(body: string, maxWidthMm: number, fontSizePt: number): string[] {
  if (!body) return [];
  // Truncation: limita ogni riga a maxChars caratteri per evitare overflow.
  // Sicuro per qualsiasi font (sans-serif o serif fallback).
  // Per A5 safeW=138mm a 5pt, ~25 chars/line è safe.
  const maxChars = Math.max(6, Math.floor((maxWidthMm / fontSizePt) * 2.83464567 * 0.28));
  const out: string[] = [];
  for (const para of body.split(/\n+/)) {
    if (!para) continue;
    let line = '';
    for (const w of para.split(/\s+/)) {
      if (!w) continue;
      // Se aggiungere questa parola supera maxChars, chiudi la riga.
      if (line && (line.length + 1 + w.length) > maxChars) {
        out.push(line);
        line = w;
      } else {
        line = line ? line + ' ' + w : w;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function escapeXmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Public API: build the full SVG markup for a flyer. Use this as the
 * single source of truth for layout. The output is an `<svg>` with
 * `viewBox="0 0 Wmm Hmm"`, suitable for embedding in HTML
 * (dangerouslySetInnerHTML), for pdfmake's `svg` content type, and
 * for canvas rasterization (load into Image, drawImage to canvas).
 *
 * All text (headline, sub, body) is rendered in a single
 * `<foreignObject>` block where the browser handles word wrapping
 * natively. This is the ONLY reliable way to get proper text wrapping
 * in SVG for any font (Inter in production or serif fallback).
 * Hero image, accent bar, CTA button, and QR code stay as native
 * SVG since they're images/buttons, not text.
 */
export function buildFlyerSvg(flyer: Flyer): string {
  const dims = getFlyerDimensions(flyer);
  const totalWmm = dims.w + FLYER_BLEED_MM * 2;
  const totalHmm = dims.h + FLYER_BLEED_MM * 2;
  const innerW = dims.w;
  const innerH = dims.h;
  const padding = 4;

  const bg = safeHex(flyer.style.bgColor, '#FFFFFF');
  const text = safeHex(flyer.style.textColor, '#1a1a2e');
  const accent = safeHex(flyer.style.accentColor, '#01696f');
  const font = flyer.style.fontFamily || 'Inter, sans-serif';
  const layout = flyer.style.layout;

  const headline = (flyer.content.headline || '').trim();
  const subheadline = (flyer.content.subheadline || '').trim();
  const body = (flyer.content.body || '').trim();
  const ctaLabel = (flyer.content.cta.label || '').trim();
  const ctaUrl = (flyer.content.cta.url || '').trim();
  const qrPayload = ctaUrl && isHttpUrl(ctaUrl) ? ctaUrl : (flyer.content.qrPayload || '').trim();
  const qrLabel = (flyer.content.qrLabel || '').trim();
  const showQr = !!qrPayload && isHttpUrl(qrPayload);
  const heroImage = flyer.content.heroImage;

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${mm(totalWmm)} ${mm(totalHmm)}" width="${mm(totalWmm)}mm" height="${mm(totalHmm)}mm" data-flyer-svg="1">`);
  parts.push(`<rect x="0" y="0" width="${mm(totalWmm)}" height="${mm(totalHmm)}" fill="${bg}"/>`);

  const safeX = padding;
  const safeY = padding;
  const safeW = innerW - padding * 2;
  const safeH = innerH - padding * 2;
  const QR_MM = Math.max(8, safeW * 0.18);

  // === Hero image (native SVG) ===
  if (heroImage) {
    let imgW = safeW, imgH: number;
    if (layout === 'split' && dims.w >= dims.h) {
      imgW = safeW * 0.5; imgH = safeH;
    } else if (layout === 'split') {
      imgH = safeH * 0.45;
    } else if (layout === 'centered') {
      imgH = safeH * 0.18;
    } else {
      imgH = safeH * 0.4;
    }
    parts.push(`<image href="${escapeXmlAttr(heroImage)}" x="${mm(safeX)}" y="${mm(safeY)}" width="${mm(imgW)}" height="${mm(imgH)}" preserveAspectRatio="xMidYMid slice"/>`);
  }

  // === ForeignObject for all text (browser handles wrapping) ===
  // Compute the text region based on layout + hero position.
  let textX = safeX, textY = safeY, textW = safeW, textH = safeH;
  if (layout === 'split' && dims.w >= dims.h && heroImage) {
    // Image left, text right (right half)
    textX = safeX + safeW * 0.5;
    textW = safeW * 0.5;
  } else if (heroImage) {
    // Text below image
    const heroH = layout === 'split' ? safeH * 0.45 : (layout === 'centered' ? safeH * 0.18 : safeH * 0.4);
    textY = safeY + heroH + 2;
    textH = safeH - heroH - 2;
  }
  // Reserve space at bottom for footer (CTA + QR)
  const footerH = showQr || ctaLabel ? 18 : 4;
  const bodyH = textH - footerH;

  // Font sizes per layout (pt, lineheight 1.3). Conservative so the
  // body has enough room for CTA + QR in the footer.
  const HEAD_PT = layout === 'magazine' ? 8 : layout === 'split' ? 8 : 9;
  const SUB_PT = layout === 'magazine' ? 4.5 : 5.5;
  const BODY_PT = layout === 'magazine' ? 3.8 : layout === 'split' ? 4.5 : 5;

  // Build CSS for the foreignObject text styles
  const foCss = [
    `margin:0;padding:0;box-sizing:border-box;width:${mm(textW)}mm;height:${mm(bodyH)}mm;`,
    `font-family:${escapeXmlAttr(font)};color:${text};line-height:1.25;`,
    `overflow:hidden;display:flex;flex-direction:column;justify-content:flex-start;`,
    layout === 'centered' ? 'align-items:center;text-align:center;' : 'align-items:flex-start;',
  ].join('');
  // Build the inner HTML content
  const headEl = headline ? `<div style="font-size:${HEAD_PT}pt;font-weight:700;text-transform:uppercase;line-height:1.15;margin:0 0 1mm 0;word-wrap:break-word;overflow:hidden;">${escapeHtml(headline)}</div>` : '';
  const subEl = subheadline ? `<div style="font-size:${SUB_PT}pt;color:${accent};line-height:1.2;margin:0 0 2mm 0;word-wrap:break-word;overflow:hidden;">${escapeHtml(subheadline)}</div>` : '';
  let bodyEl = '';
  if (body) {
    if (layout === 'magazine') {
      // 3 columns: split body by \n+ into 3 paragraphs, each in its
      // own column with webkit-line-clamp for overflow safety.
      const paragraphs = body.split(/\n+/).filter(Boolean).slice(0, 3);
      const colWmm = (textW - 4) / 3;
      bodyEl = `<div style="display:flex;gap:${mm(2)}mm;flex:1;min-height:0;">${paragraphs.map((p) => {
        return `<div style="flex:1;font-size:${BODY_PT}pt;line-height:1.3;word-wrap:break-word;overflow:hidden;display:-webkit-box;-webkit-line-clamp:8;-webkit-box-orient:vertical;">${escapeHtml(p)}</div>`;
      }).join('')}</div>`;
    } else {
      // Single body with webkit-line-clamp for overflow safety
      bodyEl = `<div style="font-size:${BODY_PT}pt;line-height:1.3;margin:0;word-wrap:break-word;overflow:hidden;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;flex:1;min-height:0;">${escapeHtml(body)}</div>`;
    }
  }
  // Accent bar (below sub, above body) — only for classic/centered/magazine
  let accentBarEl = '';
  if (layout !== 'split' && accent) {
    accentBarEl = `<div style="width:${mm(Math.max(3, safeW * 0.04))}mm;height:0.6mm;background:${accent};margin:0 0 1.5mm 0;"></div>`;
  }

  parts.push(`<foreignObject x="${mm(textX)}" y="${mm(textY)}" width="${mm(textW)}" height="${mm(bodyH)}">`);
  parts.push(`<div xmlns="http://www.w3.org/1999/xhtml" style="${foCss}">`);
  parts.push(headEl);
  if (accentBarEl && layout !== 'centered') parts.push(accentBarEl);
  parts.push(subEl);
  parts.push(bodyEl);
  parts.push('</div></foreignObject>');

  // === Footer: CTA + QR (native SVG) ===
  const footerY = safeY + safeH - Math.max(QR_MM, 8) - 1;
  if (ctaLabel) {
    const ctaW = Math.max(20, safeW * 0.4);
    const ctaH = 6;
    parts.push(`<rect x="${mm(safeX)}" y="${mm(footerY - ctaH + 6)}" width="${mm(ctaW)}" height="${mm(ctaH)}" rx="0.6" fill="${accent}"/>`);
    parts.push(`<text x="${mm(safeX + ctaW / 2)}" y="${mm(footerY - ctaH / 2 + 6 + 0.5)}" text-anchor="middle" font-size="6pt" font-weight="700" fill="#FFFFFF">${escapeXmlAttr(ctaLabel.toUpperCase())}</text>`);
  }
  if (showQr) {
    const qr = inlineQrSvg(qrPayload, text);
    if (qr) {
      const qrX = safeX + safeW - QR_MM;
      const qrY = footerY - QR_MM + 6;
      const scale = QR_MM / qr.size;
      parts.push(`<g transform="translate(${mm(qrX)} ${mm(qrY)}) scale(${scale})"><rect width="${qr.size}" height="${qr.size}" fill="#FFFFFF"/>${qr.inner}</g>`);
      if (qrLabel) {
        parts.push(`<text x="${mm(qrX + QR_MM / 2)}" y="${mm(qrY + QR_MM + 1.5)}" text-anchor="middle" font-size="4pt" fill="${text}">${escapeXmlAttr(qrLabel)}</text>`);
      }
    }
  }

  parts.push('</svg>');
  return parts.join('');
}

// Escape HTML entities for foreignObject content
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
