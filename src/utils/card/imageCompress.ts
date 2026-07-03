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
