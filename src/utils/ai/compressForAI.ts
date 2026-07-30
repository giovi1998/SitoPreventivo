/**
 * Shared client-side utility for preparing images to send to the
 * Gemini multimodal image-generation endpoints (`/ai/card-cover`,
 * `/ai/logo-background`, `/ai/flyer-hero`).
 *
 * The functions operate on browser data URLs. They re-encode images
 * via a canvas when the original data URL is too large, so the final
 * JSON request body stays well under the Vercel 1MB function-body
 * limit. Images meant as reference for Gemini are intentionally
 * smaller and lossy (JPEG 0.8) because they are input, not the final
 * deliverable.
 */

const DEFAULT_QUALITY = 0.8;

export interface CompressResult {
  dataUrl: string;
  bytes: number;
}

/** Returns the base64 payload from a data URL, preserving the prefix if requested. */
export function stripDataUrlPrefix(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return dataUrl;
  return dataUrl.slice(comma + 1);
}

/** Returns the MIME type declared in a data URL. */
export function getDataUrlMimeType(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;]+);base64,/);
  return match?.[1] ?? 'image/png';
}

/** Returns the byte length of a base64 string. */
export function base64ByteLength(base64: string): number {
  return Math.ceil((base64.length * 3) / 4);
}

/** Measures an existing data URL's size in bytes. */
export function dataUrlByteLength(dataUrl: string): number {
  return base64ByteLength(stripDataUrlPrefix(dataUrl));
}

/**
 * Loads a data URL into an HTMLImageElement. Throws on timeout or
 * error. jsdom testing environments can mock Image.
 */
export function loadImageFromDataUrl(src: string, timeoutMs = 3000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('Ambiente browser richiesto per loadImageFromDataUrl'));
      return;
    }
    const img = new Image();
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Timeout caricamento immagine'));
    }, timeoutMs);

    img.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error('Impossibile caricare immagine'));
    };
    img.src = src;
  });
}

/**
 * Resizes and re-encodes an image to a JPEG data URL, targeting a
 * maximum byte size. If the image already fits, it is returned as-is
 * (only the byte length is checked, not the dimensions).
 *
 * @param maxLongSide maximum long side in pixels (default 512)
 * @param targetBytes target byte size; if exceeded, the long side is
 *   scaled down step by step until the canvas export fits. Falls back
 *   to the smallest generated size even if it still exceeds the
 *   budget.
 * @returns a JPEG data URL.
 */
export async function compressForAI(
  dataUrl: string,
  targetBytes = 400_000,
  maxLongSide = 512,
): Promise<CompressResult> {
  const initialBytes = dataUrlByteLength(dataUrl);
  if (initialBytes <= targetBytes) {
    return { dataUrl, bytes: initialBytes };
  }

  const img = await loadImageFromDataUrl(dataUrl);
  const originalWidth = img.naturalWidth || img.width;
  const originalHeight = img.naturalHeight || img.height;
  const originalLong = Math.max(originalWidth, originalHeight);
  const scale = Math.min(1, maxLongSide / originalLong);

  let currentLong = Math.round(originalLong * scale);
  let result = '';
  let lastError: Error | undefined;

  while (currentLong >= 64) {
    const ratio = currentLong / originalLong;
    const w = Math.max(1, Math.round(originalWidth * ratio));
    const h = Math.max(1, Math.round(originalHeight * ratio));
    try {
      result = await encodeCanvasToJpegDataUrl(img, w, h, DEFAULT_QUALITY);
      const bytes = dataUrlByteLength(result);
      if (bytes <= targetBytes) {
        return { dataUrl: result, bytes };
      }
      lastError = new Error(`Dimensione ${currentLong}px supera il budget: ${bytes} byte`);
    } catch (err) {
      lastError = err as Error;
    }
    currentLong = Math.floor(currentLong * 0.85);
  }

  if (!result) {
    throw lastError || new Error('Compressione immagine fallita');
  }

  return { dataUrl: result, bytes: dataUrlByteLength(result) };
}

/** Re-encodes a loaded image to a new JPEG data URL at given dimensions. */
export async function encodeCanvasToJpegDataUrl(
  img: HTMLImageElement,
  width: number,
  height: number,
  quality = DEFAULT_QUALITY,
): Promise<string> {
  if (typeof document === 'undefined') {
    throw new Error('Ambiente browser richiesto per encodeCanvasToJpegDataUrl');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D non disponibile');
  // JPEG has no alpha; fill white so transparent sources don't turn black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('toBlob ha restituito null'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error || new Error('FileReader error'));
        reader.readAsDataURL(blob);
      },
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Measures the JSON body that would be sent and returns a pruned
 * request payload. Drops images in priority order (last image first,
 * then first image, then text-only) until the total body is below
 * maxBytes with a safety margin.
 */
export function pruneImagesForBodyBudget<T extends Record<string, unknown>>(
  payload: T,
  imageKeys: (keyof T)[],
  maxBytes = 900_000,
): T {
  const body = JSON.stringify(payload);
  if (body.length <= maxBytes) return payload;

  const clone = { ...payload };
  // Drop in reverse priority order: the caller should order
  // imageKeys from most important to least important.
  for (let i = imageKeys.length - 1; i >= 0; i--) {
    const key = imageKeys[i];
    if (clone[key]) {
      delete clone[key];
      const current = JSON.stringify(clone);
      if (current.length <= maxBytes) return clone as T;
    }
  }

  return clone as T;
}

/**
 * Convenience: converts a PNG/Uint8Array image to a JPEG data URL
 * suitable for AI input. Used when the source pipeline already
 * produces raw PNG bytes (e.g. the card exporter).
 */
export async function pngUint8ArrayToJpegDataUrl(
  bytes: Uint8Array,
  targetBytes = 400_000,
  maxLongSide = 512,
): Promise<CompressResult> {
  const base64 = typeof btoa === 'function'
    ? btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''))
    : Buffer.from(bytes).toString('base64');
  const dataUrl = `data:image/png;base64,${base64}`;
  return compressForAI(dataUrl, targetBytes, maxLongSide);
}

/**
 * Renders an SVG string to a JPEG data URL suitable for AI input.
 * The SVG is loaded via a blob URL, drawn to a canvas, and exported
 * as a JPEG. If the export exceeds targetBytes, it is re-compressed
 * by the shared pipeline.
 *
 * External http(s) `<image>` references are inlined first: a
 * cross-origin image would taint the canvas and make the export fail
 * with a SecurityError (flyer hero with a remote image URL).
 *
 * @param svg the SVG markup
 * @param targetBytes target byte size
 * @param maxLongSide maximum long side in pixels
 */
export async function svgToJpegDataUrlForAI(
  svg: string,
  targetBytes = 400_000,
  maxLongSide = 512,
): Promise<CompressResult> {
  if (typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof document === 'undefined') {
    throw new Error('Ambiente browser richiesto per svgToJpegDataUrlForAI');
  }
  const inlined = await inlineSvgExternalImages(svg);
  const blob = new Blob([inlined], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const dataUrl = await imageToJpegDataUrl(url, maxLongSide);
    return compressForAI(dataUrl, targetBytes, maxLongSide);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Replaces http(s) `href`s of `<image>` tags in an SVG with fetched
 * data URLs. Cross-origin images drawn from an SVG taint the canvas
 * and block `toBlob`/`toDataURL` with a SecurityError; inlining them
 * keeps the canvas clean. Images that cannot be fetched (CORS,
 * network error) are dropped — the rest of the SVG still renders.
 */
export async function inlineSvgExternalImages(svg: string): Promise<string> {
  const imageTagRe = /<image\b[^>]*?(?:\/>|>\s*<\/image>)/g;
  const hrefRe = /(?:xlink:)?href="(https?:\/\/[^"]+)"/;
  const tags = svg.match(imageTagRe);
  if (!tags) return svg;
  const urls = [...new Set(tags.map((tag) => tag.match(hrefRe)?.[1]).filter((u): u is string => Boolean(u)))];
  if (urls.length === 0) return svg;

  const fetched = new Map<string, string | null>();
  await Promise.all(urls.map(async (url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      fetched.set(url, await blobToDataUrl(blob));
    } catch {
      fetched.set(url, null);
    }
  }));

  return svg.replace(imageTagRe, (tag) => {
    const url = tag.match(hrefRe)?.[1];
    if (!url) return tag;
    const dataUrl = fetched.get(url);
    return dataUrl == null ? '' : tag.replace(url, dataUrl);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

/** Loads any image URL (blob or http) into a canvas and returns a JPEG data URL at the target long side. */
export async function imageToJpegDataUrl(src: string, maxLongSide = 512): Promise<string> {
  const img = await loadImageFromDataUrl(src);
  const originalWidth = img.naturalWidth || img.width;
  const originalHeight = img.naturalHeight || img.height;
  const originalLong = Math.max(originalWidth, originalHeight);
  const scale = Math.min(1, maxLongSide / originalLong);
  const width = Math.max(1, Math.round(originalWidth * scale));
  const height = Math.max(1, Math.round(originalHeight * scale));
  return encodeCanvasToJpegDataUrl(img, width, height, DEFAULT_QUALITY);
}
