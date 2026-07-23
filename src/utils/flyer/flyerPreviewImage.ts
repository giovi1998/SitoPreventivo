import type { Flyer } from '../documentSchemas';
import { buildFlyerSvg } from '../flyerGenerator';

/**
 * Renderizza il flyer come data URL raster (PNG/JPEG) usando SVG nativo.
 * A differenza di captureElementAsBase64, non usa foreignObject: l'SVG
 * risultante può essere caricato come immagine e disegnato su canvas.
 */
export async function renderFlyerPreviewImage(
  flyer: Flyer,
  options: { maxWidth?: number; quality?: number; type?: 'image/jpeg' | 'image/png' } = {},
): Promise<string | null> {
  const { maxWidth = 1024, quality = 0.85, type = 'image/jpeg' } = options;
  try {
    const svg = buildFlyerSvg(flyer, { renderBodyAsText: true });
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadImage(url);
      const scale = Math.min(1, maxWidth / img.width);
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = flyer.style.bgColor || '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      return canvas.toDataURL(type, quality);
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

function loadImage(src: string, timeoutMs = 5000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error('Image load timeout')), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Failed to load image'));
    };
    img.src = src;
  });
}
