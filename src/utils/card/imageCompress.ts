import { isAllowedLogoMime } from '../qrGenerator';

export const MAX_RAW_BYTES = 5_000_000;
export const MAX_DIMENSION = 4000;
export const MIN_QUALITY = 0.3;
export const DEFAULT_MAX_DIM = 800;
export const DEFAULT_MAX_BYTES = 500_000;

export interface CompressImageOptions {
  /**
   * Output format. Use `'png'` to preserve transparency (logos with
   * alpha channel). Defaults to `'jpeg'` (smaller files, but opaque).
   *
   * PNG output has no `quality` knob, size reduction is achieved by
   * scaling the canvas dimensions down iteratively until the encoded
   * dataURL fits under `maxBytes`.
   */
  format?: 'jpeg' | 'png';
  /**
   * Minimum width/height in pixels when scaling down a PNG to fit
   * `maxBytes`. Defaults to 200. Below this the function throws.
   */
  minDim?: number;
}

export async function compressImage(
  file: File,
  maxDim: number = DEFAULT_MAX_DIM,
  maxBytes: number = DEFAULT_MAX_BYTES,
  opts: CompressImageOptions = {},
): Promise<string> {
  if (!isAllowedLogoMime(file.type)) {
    throw new Error('Formato non supportato. Usa PNG, JPEG o SVG.');
  }
  if (file.size > MAX_RAW_BYTES) {
    throw new Error('File troppo grande (max 5MB)');
  }

  const img = await loadImage(file);
  if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
    throw new Error('Immagine troppo grande (max 4000px)');
  }

  const format = opts.format || 'jpeg';
  const minDim = opts.minDim || 200;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D non disponibile');
  }
  // For PNG, preserve transparency: do NOT paint a background.
  // For JPEG, the canvas is already opaque by default.
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  if (format === 'png') {
    const maxChars = Math.floor(maxBytes * 1.37);
    let curW = canvas.width;
    let curH = canvas.height;
    const minSide = Math.min(minDim, Math.max(img.width, img.height));
    let dataUrl = canvas.toDataURL('image/png');
    while (dataUrl.length > maxChars && Math.min(curW, curH) > minSide) {
      curW = Math.max(minSide, Math.floor(curW / 2));
      curH = Math.max(minSide, Math.floor(curH / 2));
      canvas.width = curW;
      canvas.height = curH;
      ctx.clearRect(0, 0, curW, curH);
      ctx.drawImage(img, 0, 0, curW, curH);
      dataUrl = canvas.toDataURL('image/png');
    }
    if (dataUrl.length > maxChars) {
      throw new Error('Immagine troppo pesante anche dopo compressione');
    }
    return dataUrl;
  }

  // Default: JPEG (current behavior, opaque output).
  let quality = 0.85;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  const maxChars = Math.floor(maxBytes * 1.37);
  while (dataUrl.length > maxChars && quality > MIN_QUALITY) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  if (dataUrl.length > maxChars) {
    throw new Error('Immagine troppo pesante anche dopo compressione');
  }
  return dataUrl;
}

const DATA_URL_PREFIX_RE = /^data:([^;,]+)(?:;base64)?,/;

/**
 * Compress a data-URL string (base64 image) for localStorage persistence.
 * Caps output to `maxDim` px on the longest side and `maxBytes` encoded chars.
 * If the image already fits, returns it unchanged. Returns `null` on failure.
 */
export async function compressDataUrl(
  dataUrl: string,
  maxDim: number = 512,
  maxBytes: number = 300_000,
): Promise<string | null> {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
  // Payload troppo corto per essere un'immagine reale (es. stub nei test):
  // evita il caricamento via Image che in jsdom può non risolversi.
  const payload = dataUrl.split(',')[1] || '';
  if (payload.length < 100) return dataUrl;
  try {
    const img = await loadDataUrlImage(dataUrl);
    const curBytes = estimateBase64Bytes(dataUrl);
    if (curBytes <= maxBytes && Math.max(img.width, img.height) <= maxDim) {
      return dataUrl;
    }
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const isPng = dataUrl.includes('image/png');
    const mime = isPng ? 'image/png' : 'image/jpeg';
    const maxChars = Math.floor(maxBytes * 1.37);
    if (isPng) {
      return canvas.toDataURL('image/png').length > maxChars
        ? canvas.toDataURL('image/jpeg', 0.75)
        : canvas.toDataURL('image/png');
    }
    let quality = 0.75;
    let out = canvas.toDataURL('image/jpeg', quality);
    while (out.length > maxChars && quality > MIN_QUALITY) {
      quality -= 0.1;
      out = canvas.toDataURL('image/jpeg', quality);
    }
    return out;
  } catch {
    return dataUrl;
  }
}

function loadDataUrlImage(dataUrl: string, timeoutMs = 3000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error('data-url image load timeout')), timeoutMs);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('data-url image load failed')); };
    img.src = dataUrl;
  });
}

function estimateBase64Bytes(dataUrl: string): number {
  const raw = dataUrl.replace(DATA_URL_PREFIX_RE, '');
  return Math.round(raw.length * 0.75);
}

export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Immagine non leggibile'));
    };
    img.src = url;
  });
}
