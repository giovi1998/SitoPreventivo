import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { BusinessCard } from '../documentSchemas';
import { BLEED_MM, CARD_A4_GAP_MM } from '../documentSchemas';
import type { Tier } from '../watermark';
import { applyWatermarkToPdf } from '../watermark';
import { mm2pt } from './units';
import { computePageCardEntries, getCardDimensionsMm, type PageCardEntry, type PageLayout } from './pdfLayout';
import { renderCardSideDataUrl } from './pngExport';
import { deriveHandle, deriveHostname } from './textDerivation';

pdfMake.vfs = pdfFonts;

type Content = any;
type TDocumentDefinitions = any;

export { PageCardEntry, PageLayout, computePageCardEntries, getCardDimensionsMm };

const BLEED_HALF_MM = BLEED_MM / 2;

export type GenerateCardPdfOpts = {
  tier: Tier;
  /** Crop marks + sheet outlines for print shops. Default true. */
  cropMarks?: boolean;
};

export async function generateCardPDF(
  card: BusinessCard,
  opts: GenerateCardPdfOpts,
): Promise<Uint8Array> {
  const cropMarks = opts.cropMarks !== false;
  const dims = getCardDimensionsMm(card);
  const { entries, pageOrientation } = computePageCardEntries(dims.w, dims.h);
  const pxW = Math.round((dims.w / 25.4) * 300);
  const pxH = Math.round((dims.h / 25.4) * 300);
  const rotate: 0 | 90 = pageOrientation === 'landscape' ? 90 : 0;
  const frontImage = await renderCardSideDataUrl(card, 'front', pxW, pxH, { rotate });
  const backImage = await renderCardSideDataUrl(card, 'back', pxW, pxH, { rotate });

  const frontContent = buildPageContentFromImage(card, entries, frontImage, true, cropMarks);
  const backContent = buildPageContentFromImage(card, entries, backImage, false, cropMarks);

  const baseDoc: TDocumentDefinitions = {
    pageSize: pageOrientation === 'landscape'
      ? { width: mm2pt(297), height: mm2pt(210) }
      : { width: mm2pt(210), height: mm2pt(297) },
    pageOrientation,
    pageMargins: [0, 0, 0, 0],
    content: [
      { stack: frontContent },
      { text: '', pageBreak: 'after' },
      { stack: backContent },
    ],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 8,
    },
  };

  const docDef = applyWatermarkToPdf(baseDoc, opts.tier);

  return new Promise<Uint8Array>((resolve, reject) => {
    let settled = false;
    const done = (bytes: Uint8Array) => {
      if (settled) return;
      settled = true;
      resolve(bytes);
    };
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    const timeout = setTimeout(() => {
      fail(new Error('Timeout generazione PDF card'));
    }, 20_000);
    try {
      const doc = (pdfMake as any).createPdf(docDef);
      if (typeof doc.getBlob === 'function') {
        const maybePromise = doc.getBlob(async (blob: Blob) => {
          try {
            const ab = await blob.arrayBuffer();
            clearTimeout(timeout);
            done(new Uint8Array(ab));
          } catch (e) {
            clearTimeout(timeout);
            fail(e);
          }
        });
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(async (blob: Blob) => {
            const ab = await blob.arrayBuffer();
            clearTimeout(timeout);
            done(new Uint8Array(ab));
          }).catch((e: unknown) => { clearTimeout(timeout); fail(e); });
        }
        return;
      }
      const maybePromise = doc.getBuffer((buf: Uint8Array) => {
        clearTimeout(timeout);
        done(new Uint8Array(buf));
      });
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise
          .then((buf: Uint8Array) => { clearTimeout(timeout); done(new Uint8Array(buf)); })
          .catch((e: unknown) => { clearTimeout(timeout); fail(e); });
      }
    } catch (e) {
      clearTimeout(timeout);
      fail(e);
    }
  });
}

function buildPageContentFromImage(
  card: BusinessCard,
  entries: PageCardEntry[],
  imageDataUrl: string,
  isFirst: boolean,
  cropMarks = true,
): Content[] {
  const out: Content[] = [];
  const bg = card.style.bgColor;
  const borderColor = card.style.accentColor;
  // Sheet-level thin border only when crop marks mode AND user chose thin border.
  // Accent strips are already in the rasterized card image — do not double-draw.
  const sheetBorderW = cropMarks && card.style.borderStyle === 'thin' ? 0.4 : 0;

  entries.forEach((entry) => {
    // Bleed fill under the card (print shops need ink past the cut line).
    out.push(cardRect(entry, bg, sheetBorderW > 0 ? { color: borderColor, width: sheetBorderW } : undefined));
    out.push({
      image: imageDataUrl,
      absolutePosition: { x: mm2pt(entry.x), y: mm2pt(entry.y) },
      width: mm2pt(entry.w),
      height: mm2pt(entry.h),
    });
    if (cropMarks) {
      out.push(cropMarkLines(entry));
    }
  });

  if (isFirst) out.unshift({ text: '', margin: [0, 0, 0, 0] });
  return out;
}

function buildFrontCell(card: BusinessCard, dims: { w: number; h: number }): Content[] {
  const paddingMm = 4;
  const innerW = dims.w - paddingMm * 2;
  const textColor = card.style.textColor;
  const accentColor = card.style.accentColor;
  const hasPhoto = !!card.front.photoUrl;
  const hasLogo = !!card.front.logoUrl;
  const f = Math.max(0.7, Math.min(1.5, card.style.fontScale ?? 1));
  const cells: Content[] = [];

  if (hasPhoto) {
    cells.push(pdfImageOrSvg(card.front.photoUrl!, {
      width: 25,
      height: 25,
      absolutePosition: { x: paddingMm, y: paddingMm },
    }));
  } else if (hasLogo) {
    cells.push(pdfImageOrSvg(card.front.logoUrl!, {
      width: 22,
      height: 22,
      absolutePosition: { x: paddingMm + 1.5, y: paddingMm + 1.5 },
    }));
  }

  const textX = hasPhoto ? paddingMm + 27 : paddingMm;
  const textW = hasPhoto ? innerW - 27 : innerW;
  const textLines: Content[] = [];
  if (card.front.name) {
    textLines.push({ text: card.front.name.toUpperCase(), color: textColor, fontSize: 11 * f, bold: true, characterSpacing: 0.5 });
  }
  if (card.front.title) {
    textLines.push({ text: card.front.title, color: accentColor, fontSize: 7.5 * f, bold: true, margin: [0, 1, 0, 0] });
  }
  if (card.front.company) {
    textLines.push({ text: card.front.company, color: textColor, fontSize: 6.5 * f, margin: [0, 1, 0, 0] });
  }
  if (textLines.length > 0) {
    cells.push({
      stack: textLines,
      absolutePosition: { x: textX, y: paddingMm + 4 },
      width: textW,
    });
  }

  const divY = hasPhoto ? paddingMm + 27 : paddingMm + 18;
  cells.push({
    canvas: [
      { type: 'line', x1: paddingMm, y1: divY, x2: dims.w - paddingMm, y2: divY, lineWidth: 0.4, lineColor: accentColor },
    ],
    absolutePosition: { x: 0, y: 0 },
    width: dims.w,
  });

  const bottomY = divY + 4;
  const qrPayload = card.back.qrPayload.trim() || card.back.website;
  if (card.back.website && !qrPayload) {
    const hostname = deriveHostname(card);
    cells.push({
      text: hostname,
      fontSize: 6 * f,
      color: textColor,
      alignment: 'center',
      absolutePosition: { x: 0, y: bottomY + 1 },
      width: dims.w,
      opacity: 0.6,
    });
  }
  if (hasLogo && hasPhoto) {
    const logoMm = Math.min(25, dims.w * 0.30);
    cells.push(pdfImageOrSvg(card.front.logoUrl!, {
      width: logoMm,
      height: logoMm,
      absolutePosition: { x: dims.w - paddingMm - logoMm, y: bottomY - 3 },
    }));
  }

  return cells;
}

function buildBackCell(card: BusinessCard, _dims: { w: number; h: number }): Content[] {
  const textColor = card.style.textColor;
  const accentColor = card.style.accentColor;
  const f = Math.max(0.7, Math.min(1.5, card.style.fontScale ?? 1));

  const contactLines: Content[] = [];
  if (card.back.phone) contactLines.push({ text: card.back.phone, color: textColor, fontSize: 7 * f });
  if (card.back.email) contactLines.push({ text: card.back.email, color: textColor, fontSize: 7 * f });
  if (card.back.website) contactLines.push({ text: card.back.website, color: accentColor, fontSize: 7 * f, bold: true });
  if (card.back.address) contactLines.push({ text: card.back.address, color: textColor, fontSize: 6.5 * f });
  if (card.back.vatNumber) contactLines.push({ text: `P.IVA: ${card.back.vatNumber}`, color: textColor, fontSize: 6.5 * f });

  const services = (card.back.services ?? []).filter((s) => s.trim().length > 0);
  if (services.length > 0) {
    const servicesLabelText = (card.back.servicesLabel ?? '').trim();
    if (servicesLabelText) {
      contactLines.push({
        text: servicesLabelText.toUpperCase(),
        color: accentColor,
        fontSize: 5.5 * f,
        bold: true,
        characterSpacing: 1.2,
        opacity: 0.7,
        margin: [0, 3, 0, 0],
      });
    }
    const hasLongService = services.some((s) => s.length >= 40);
    const svcFontSize = (hasLongService ? 5.5 : 6.5) * f;
    services.forEach((svc) => {
      contactLines.push({
        text: `· ${svc}`,
        color: accentColor,
        fontSize: svcFontSize,
        bold: true,
        margin: [0, 0.5, 0, 0],
      });
    });
  }

  const validSocials = card.back.socials.filter((s) => s.platform && s.url);
  if (validSocials.length > 0) {
    const socialsText = validSocials
      .map((s) => {
        const handle = deriveHandle(s.url);
        return `${s.platform} · ${handle || s.url}`;
      })
      .join(' · ');
    contactLines.push({
      text: socialsText,
      color: textColor,
      fontSize: 6 * f,
      italics: true,
      margin: [0, 3, 0, 0],
      opacity: 0.78,
    });
  }

  return [{ stack: contactLines }];
}

function pdfImageOrSvg(src: string, opts: Record<string, unknown>): Content {
  const svg = decodeSvgDataUri(src);
  if (svg) return { svg, ...opts };
  return { image: src, ...opts };
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

function cropMarkLines(entry: PageCardEntry): Content {
  const len = mm2pt(2);
  const g = mm2pt(CARD_A4_GAP_MM / 2);
  const x0 = mm2pt(entry.x) - g;
  const y0 = mm2pt(entry.y) - g;
  const x1 = mm2pt(entry.x + entry.w) + g;
  const y1 = mm2pt(entry.y + entry.h) + g;
  const lw = 0.3;
  const accent = '#000000';
  return {
    canvas: [
      { type: 'line', x1: x0 - len, y1: y0, x2: x0, y2: y0, lineWidth: lw, lineColor: accent },
      { type: 'line', x1: x0, y1: y0 - len, x2: x0, y2: y0, lineWidth: lw, lineColor: accent },
      { type: 'line', x1: x1, y1: y0, x2: x1 + len, y2: y0, lineWidth: lw, lineColor: accent },
      { type: 'line', x1: x1, y1: y0 - len, x2: x1, y2: y0, lineWidth: lw, lineColor: accent },
      { type: 'line', x1: x0 - len, y1: y1, x2: x0, y2: y1, lineWidth: lw, lineColor: accent },
      { type: 'line', x1: x0, y1: y1, x2: x0, y2: y1 + len, lineWidth: lw, lineColor: accent },
      { type: 'line', x1: x1, y1: y1, x2: x1 + len, y2: y1, lineWidth: lw, lineColor: accent },
      { type: 'line', x1: x1, y1: y1, x2: x1, y2: y1 + len, lineWidth: lw, lineColor: accent },
    ],
    absolutePosition: { x: 0, y: 0 },
  };
}

function cardRect(entry: PageCardEntry, fill: string, border?: { color: string; width: number }): Content {
  const b = mm2pt(BLEED_HALF_MM);
  const x = mm2pt(entry.x) - b;
  const y = mm2pt(entry.y) - b;
  const w = mm2pt(entry.w) + b * 2;
  const h = mm2pt(entry.h) + b * 2;
  const rect: any = { type: 'rect', x, y, w, h, color: fill };
  const out: any[] = [rect];
  if (border) {
    out.push({ type: 'rect', x, y, w, h, lineWidth: border.width, lineColor: border.color });
  }
  return { canvas: out, absolutePosition: { x: 0, y: 0 } };
}


