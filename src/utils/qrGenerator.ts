import QRCode from 'qrcode';
import type { QrCodeData, QrDotStyle, QrErrorCorrection, QRCode as QRCodeType } from './documentSchemas';
import { applyWatermarkToCanvas, getMaxPngSideForTier, type Tier } from './watermark';

export function escapeVcard(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function escapeWifiValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/"/g, '\\"').replace(/:/g, '\\:');
}

export function buildQrPayload(data: QrCodeData): string {
  switch (data.type) {
    case 'url':
    case 'text':
      return data.payload;
    case 'email': {
      const [email = '', subject = ''] = data.payload.split('|');
      return `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
    }
    case 'phone':
      return `tel:${data.payload}`;
    case 'sms': {
      const [number = '', message = ''] = data.payload.split('|');
      return `SMSTO:${number}:${message}`;
    }
    case 'vcard':
      return data.payload;
    case 'wifi': {
      const [ssid = '', password = '', encryption = 'WPA'] = data.payload.split('|');
      const enc = encryption === 'nopass' ? 'nopass' : (encryption === 'WEP' ? 'WEP' : 'WPA');
      if (enc === 'nopass') {
        return `WIFI:T:nopass;S:${escapeWifiValue(ssid)};;`;
      }
      return `WIFI:T:${enc};S:${escapeWifiValue(ssid)};P:${escapeWifiValue(password)};;`;
    }
  }
}

interface RenderOptions {
  fgColor: string;
  bgColor: string;
  margin: number;
  errorCorrection: QrErrorCorrection;
  dotStyle: QrDotStyle;
}

function getMatrix(payload: string, errorCorrection: QrErrorCorrection): { data: boolean[][]; size: number } {
  const qr = QRCode.create(payload, { errorCorrectionLevel: errorCorrection });
  const size = qr.modules.size;
  const data: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) {
      row.push(qr.modules.data[r * size + c] === 1);
    }
    data.push(row);
  }
  return { data, size };
}

function buildSvgFromMatrix(matrix: { data: boolean[][]; size: number }, opts: RenderOptions): string {
  const { data, size } = matrix;
  const totalSize = size + opts.margin * 2;
  const bg = `<rect width="${totalSize}" height="${totalSize}" fill="${opts.bgColor}"/>`;
  const modules: string[] = [];

  if (opts.dotStyle === 'square') {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (data[r][c]) {
          modules.push(`<rect x="${c + opts.margin}" y="${r + opts.margin}" width="1" height="1" fill="${opts.fgColor}"/>`);
        }
      }
    }
  } else if (opts.dotStyle === 'rounded') {
    const radius = 0.35;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (data[r][c]) {
          modules.push(`<rect x="${c + opts.margin}" y="${r + opts.margin}" width="1" height="1" rx="${radius}" ry="${radius}" fill="${opts.fgColor}"/>`);
        }
      }
    }
  } else {
    const r = 0.45;
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (data[row][col]) {
          const cx = col + opts.margin + 0.5;
          const cy = row + opts.margin + 0.5;
          modules.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${opts.fgColor}"/>`);
        }
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" shape-rendering="geometricPrecision">${bg}${modules.join('')}</svg>`;
}

function injectLogoOverlay(svg: string, matrix: { data: boolean[][]; size: number }, margin: number, logoOverlay: string): string {
  const totalSize = matrix.size + margin * 2;
  const logoSize = Math.round(totalSize * 0.2);
  const offset = Math.round((totalSize - logoSize) / 2);
  const logoBg = `<rect x="${offset - 1}" y="${offset - 1}" width="${logoSize + 2}" height="${logoSize + 2}" fill="#FFFFFF"/>`;
  const logo = `<image href="${logoOverlay}" x="${offset}" y="${offset}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`;
  return svg.replace(/<\/svg>/, `${logoBg}${logo}</svg>`);
}

export function generateQrSvg(qr: QRCodeType): string {
  const payload = buildQrPayload(qr.data);
  if (!payload) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>`;
  }
  const matrix = getMatrix(payload, qr.style.errorCorrection);
  let svg = buildSvgFromMatrix(matrix, {
    fgColor: qr.style.fgColor,
    bgColor: qr.style.bgColor,
    margin: qr.style.margin,
    errorCorrection: qr.style.errorCorrection,
    dotStyle: qr.style.dotStyle,
  });
  if (qr.style.logoOverlay) {
    svg = injectLogoOverlay(svg, matrix, qr.style.margin, qr.style.logoOverlay);
  }
  return svg;
}

export async function generateQrPng(
  qr: QRCodeType,
  opts: { tier?: Tier } = {},
): Promise<Uint8Array> {
  const tier: Tier = opts.tier || 'unlocked';
  const maxSide = getMaxPngSideForTier(tier);
  const requestedSize = Math.min(qr.style.size, maxSide);
  const isFree = tier === 'free';

  // For free tier we MUST render to canvas so we can apply the watermark
  // (qrcode.toBuffer doesn't expose a way to add overlay). For unlocked
  // we use the faster toBuffer path.
  if (!isFree) {
    const bufferOpts: QRCode.QRCodeToBufferOptions = {
      type: 'png',
      errorCorrectionLevel: qr.style.errorCorrection,
      margin: qr.style.margin,
      width: requestedSize,
      color: { dark: qr.style.fgColor, light: qr.style.bgColor },
    };
    const buf = await QRCode.toBuffer(buildQrPayload(qr.data), bufferOpts);
    return new Uint8Array(buf);
  }

  // Free path: canvas render + watermark
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    // No canvas (SSR / node), fall back to buffer, watermark not applied.
    // Watermark is a no-op in node anyway since the file is meant for browser.
    const bufferOpts: QRCode.QRCodeToBufferOptions = {
      type: 'png',
      errorCorrectionLevel: qr.style.errorCorrection,
      margin: qr.style.margin,
      width: requestedSize,
      color: { dark: qr.style.fgColor, light: qr.style.bgColor },
    };
    const buf = await QRCode.toBuffer(buildQrPayload(qr.data), bufferOpts);
    return new Uint8Array(buf);
  }

  const canvas = document.createElement('canvas');
  canvas.width = requestedSize;
  canvas.height = requestedSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Canvas 2D unavailable (jsdom without polyfill) → fallback buffer
    const buf = await QRCode.toBuffer(buildQrPayload(qr.data), {
      type: 'png',
      errorCorrectionLevel: qr.style.errorCorrection,
      margin: qr.style.margin,
      width: requestedSize,
      color: { dark: qr.style.fgColor, light: qr.style.bgColor },
    });
    return new Uint8Array(buf);
  }
  await QRCode.toCanvas(canvas, buildQrPayload(qr.data), {
    errorCorrectionLevel: qr.style.errorCorrection,
    margin: qr.style.margin,
    width: requestedSize,
    color: { dark: qr.style.fgColor, light: qr.style.bgColor },
  });
  applyWatermarkToCanvas(ctx, tier, requestedSize, requestedSize);
  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function validateQrContrast(fg: string, bg: string): boolean {
  const fgRgb = hexToRgb(fg);
  const bgRgb = hexToRgb(bg);
  const l1 = relativeLuminance(fgRgb);
  const l2 = relativeLuminance(bgRgb);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return ratio >= 4.5;
}

export function contrastRatio(fg: string, bg: string): number {
  const fgRgb = hexToRgb(fg);
  const bgRgb = hexToRgb(bg);
  const l1 = relativeLuminance(fgRgb);
  const l2 = relativeLuminance(bgRgb);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const ALLOWED_LOGO_MIME = ['image/png', 'image/jpeg', 'image/svg+xml'] as const;
export type AllowedLogoMime = (typeof ALLOWED_LOGO_MIME)[number];

export function isAllowedLogoMime(mime: string): mime is AllowedLogoMime {
  return (ALLOWED_LOGO_MIME as readonly string[]).includes(mime);
}

export const ERROR_CORRECTION_LEVELS: QrErrorCorrection[] = ['L', 'M', 'Q', 'H'];
export const DOT_STYLES: QrDotStyle[] = ['square', 'rounded', 'dots'];
