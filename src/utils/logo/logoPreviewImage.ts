import type { Logo } from '../documentSchemas';
import { builderToSvg } from '../logoGenerator';

/**
 * Renderizza il logo come data URL raster (PNG/JPEG) usando SVG nativo.
 * Non usa foreignObject, quindi l'SVG può essere caricato come immagine.
 */
export async function renderLogoPreviewImage(
  logo: Logo,
  options: { maxWidth?: number; quality?: number; type?: 'image/jpeg' | 'image/png' } = {},
): Promise<string | null> {
  const { maxWidth = 1024, quality = 0.85, type = 'image/jpeg' } = options;
  try {
    const svg = builderToSvg(logo.builder);
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
      ctx.fillStyle = logo.builder.backgroundColor || '#ffffff';
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
