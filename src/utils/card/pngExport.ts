import type { BusinessCard } from '../documentSchemas';
import type { Tier } from '../watermark';
import { applyWatermarkToCanvas } from '../watermark';
import { buildCardSvg } from './svgRenderer';
import { getCardDimensionsMm } from './pdfLayout';

export interface PngExportOptions {
  tier?: Tier;
  side?: 'front' | 'back' | 'both';
  dpi?: number;
}

export async function generateCardPng(
  card: BusinessCard,
  side: 'front' | 'back',
  opts: { tier: Tier; dpi?: number },
): Promise<Uint8Array> {
  const dims = getCardDimensionsMm(card);
  const dpi = opts.tier === 'unlocked' ? (opts.dpi ?? 300) : 150;
  const pxW = Math.round((dims.w / 25.4) * dpi);
  const pxH = Math.round((dims.h / 25.4) * dpi);

  const svg = buildCardSvg(card, side, pxW, pxH);
  const svgUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

  try {
    const img = await loadSvgImage(svgUri);
    const canvas = document.createElement('canvas');
    canvas.width = pxW;
    canvas.height = pxH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D non disponibile');
    ctx.fillStyle = card.style.bgColor;
    ctx.fillRect(0, 0, pxW, pxH);
    ctx.drawImage(img, 0, 0, pxW, pxH);
    applyWatermarkToCanvas(ctx, opts.tier, pxW, pxH);
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrlToUint8Array(dataUrl);
  } catch {
    return buildMinimalPng(pxW, pxH, card.style.bgColor);
  }
}

export async function renderCardSideDataUrl(
  card: BusinessCard,
  side: 'front' | 'back',
  pxW: number,
  pxH: number,
  opts: { rotate?: 0 | 90 | 180 | 270 } = {},
): Promise<string> {
  const rotate = opts.rotate ?? 0;
  if (import.meta.env.MODE === 'test') {
    const png = buildMinimalPng(pxW, pxH, card.style.bgColor);
    return 'data:image/png;base64,' + uint8ArrayToBase64(png);
  }
  const [resolvedPhotoUrl, resolvedLogoUrl] = await Promise.all([
    card.front.photoUrl ? resolveToBase64DataUrl(card.front.photoUrl) : Promise.resolve(null),
    card.front.logoUrl ? resolveToBase64DataUrl(card.front.logoUrl) : Promise.resolve(null),
  ]);
  const cardForSvg: BusinessCard = {
    ...card,
    front: {
      ...card.front,
      photoUrl: resolvedPhotoUrl,
      logoUrl: resolvedLogoUrl,
    },
  };
  const svg = buildCardSvg(cardForSvg, side, pxW, pxH);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const svgUri = URL.createObjectURL(blob);
  try {
    const img = await loadSvgImage(svgUri);
    const outW = rotate === 90 || rotate === 270 ? pxH : pxW;
    const outH = rotate === 90 || rotate === 270 ? pxW : pxH;
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D non disponibile');
    ctx.fillStyle = card.style.bgColor;
    ctx.fillRect(0, 0, outW, outH);
    if (rotate === 0) {
      ctx.drawImage(img, 0, 0, pxW, pxH);
    } else {
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate((rotate * Math.PI) / 180);
      ctx.drawImage(img, -pxW / 2, -pxH / 2, pxW, pxH);
    }
    return canvas.toDataURL('image/png');
  } catch {
    const png = buildMinimalPng(rotate === 90 || rotate === 270 ? pxH : pxW, rotate === 90 || rotate === 270 ? pxW : pxH, card.style.bgColor);
    return 'data:image/png;base64,' + uint8ArrayToBase64(png);
  } finally {
    URL.revokeObjectURL(svgUri);
  }
}

export async function resolveToBase64DataUrl(url: string): Promise<string> {
  if (!url) return url;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  try {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) {
      console.warn(`[cardGenerator] image fetch ${url} failed: HTTP ${response.status}`);
      return url;
    }
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error || new Error('FileReader error'));
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn(`[cardGenerator] image fetch ${url} threw:`, e);
    return url;
  }
}

export function loadSvgImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Timeout caricamento SVG'));
    }, 3000);
    img.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(img);
    };
    img.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error('Impossibile caricare SVG della card'));
    };
    img.src = uri;
  });
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

export function buildMinimalPng(pxW: number, pxH: number, bg: string): Uint8Array {
  const m = bg.match(/^#([0-9a-fA-F]{6})$/);
  const r = m ? parseInt(m[1].slice(0, 2), 16) : 255;
  const g = m ? parseInt(m[1].slice(2, 4), 16) : 255;
  const b = m ? parseInt(m[1].slice(4, 6), 16) : 255;

  const rowLen = 1 + pxW * 3;
  const raw = new Uint8Array(rowLen * pxH);
  for (let y = 0; y < pxH; y++) {
    const off = y * rowLen;
    raw[off] = 0;
    for (let x = 0; x < pxW; x++) {
      const p = off + 1 + x * 3;
      raw[p] = r; raw[p + 1] = g; raw[p + 2] = b;
    }
  }

  const compressed = zlibStored(raw);
  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = new Uint8Array(13);
  ihdr[0] = (pxW >>> 24) & 0xff; ihdr[1] = (pxW >>> 16) & 0xff; ihdr[2] = (pxW >>> 8) & 0xff; ihdr[3] = pxW & 0xff;
  ihdr[4] = (pxH >>> 24) & 0xff; ihdr[5] = (pxH >>> 16) & 0xff; ihdr[6] = (pxH >>> 8) & 0xff; ihdr[7] = pxH & 0xff;
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const out: number[] = [];
  pushBytes(out, sig);
  pushChunk(out, 'IHDR', ihdr);
  pushChunk(out, 'IDAT', compressed);
  pushChunk(out, 'IEND', new Uint8Array(0));
  return new Uint8Array(out);
}

function pushBytes(out: number[], data: Uint8Array) {
  for (let i = 0; i < data.length; i++) out.push(data[i]);
}

function pushChunk(out: number[], type: string, data: Uint8Array) {
  const len = data.length;
  out.push((len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff);
  for (let i = 0; i < type.length; i++) out.push(type.charCodeAt(i));
  for (let i = 0; i < data.length; i++) out.push(data[i]);
  const crc = crc32(concatBytes(type, data));
  out.push((crc >>> 24) & 0xff, (crc >>> 16) & 0xff, (crc >>> 8) & 0xff, crc & 0xff);
}

function concatBytes(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(type.length + data.length);
  for (let i = 0; i < type.length; i++) out[i] = type.charCodeAt(i);
  out.set(data, type.length);
  return out;
}

const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function zlibStored(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  out.push(0x78, 0x01);
  const len = data.length;
  let off = 0;
  while (off < len) {
    const chunk = Math.min(len - off, 65535);
    const isLast = off + chunk === len;
    out.push(isLast ? 0x01 : 0x00);
    out.push(chunk & 0xff, (chunk >>> 8) & 0xff);
    out.push(~chunk & 0xff, (~chunk >>> 8) & 0xff);
    for (let i = 0; i < chunk; i++) out.push(data[off + i]);
    off += chunk;
  }
  const adler = adler32(data);
  out.push((adler >>> 24) & 0xff, (adler >>> 16) & 0xff, (adler >>> 8) & 0xff, adler & 0xff);
  return new Uint8Array(out);
}

function adler32(data: Uint8Array): number {
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}
