import type { PremiumQuote } from '../quoteSchema';
import { escapeXml } from '../xml';

function formatEuro(n: number): string {
  return `€${Number(n || 0).toFixed(2).replace('.', ',')}`;
}

/**
 * Genera un'immagine raster semplice del preventivo (titolo, opzioni, totale).
 * Non è una preview fedele del PDF, ma evita foreignObject e produce un
 *'immagine caricabile come data URL.
 */
export async function renderQuotePreviewImage(
  quote: PremiumQuote,
  options: { maxWidth?: number; quality?: number; type?: 'image/jpeg' | 'image/png' } = {},
): Promise<string | null> {
  const { maxWidth = 1024, quality = 0.85, type = 'image/jpeg' } = options;
  try {
    const svg = buildQuotePreviewSvg(quote);
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
      ctx.fillStyle = '#ffffff';
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

export function buildQuotePreviewSvg(quote: PremiumQuote): string {
  const W = 800;
  const PADDING = 40;
  const accent = quote.uiPreferences?.accentColor || '#01696F';
  const text = '#1a1a2e';
  const muted = '#64748b';
  const font = 'Arial, sans-serif';

  const title = String(quote.project?.title ?? 'Preventivo');
  const clientRaw = quote.client?.name ?? '';
  const client = typeof clientRaw === 'string' ? clientRaw : String(clientRaw);
  const date = String(quote.createdAt || '').slice(0, 10);
  const options = quote.options || [];
  const total = options.reduce((sum, o) => sum + Number(o.summary?.totalGross || 0), 0);

  const lines: string[] = [];
  let y = PADDING;

  // Header
  lines.push(`<text x="${PADDING}" y="${y}" font-family="${font}" font-size="28" font-weight="700" fill="${text}" dominant-baseline="text-before-edge">${escapeXml(title)}</text>`);
  y += 40;
  if (client) {
    lines.push(`<text x="${PADDING}" y="${y}" font-family="${font}" font-size="16" fill="${muted}" dominant-baseline="text-before-edge">Cliente: ${escapeXml(client)}</text>`);
    y += 24;
  }
  if (date) {
    lines.push(`<text x="${PADDING}" y="${y}" font-family="${font}" font-size="14" fill="${muted}" dominant-baseline="text-before-edge">Data: ${escapeXml(date)}</text>`);
    y += 24;
  }
  y += 16;

  // Options
  for (const opt of options.slice(0, 4)) {
    lines.push(`<rect x="${PADDING}" y="${y}" width="${W - PADDING * 2}" height="1" fill="${accent}" opacity="0.3"/>`);
    y += 16;
    lines.push(`<text x="${PADDING}" y="${y}" font-family="${font}" font-size="18" font-weight="600" fill="${accent}" dominant-baseline="text-before-edge">${escapeXml(opt.label)}</text>`);
    y += 26;
    if (opt.description) {
      const desc = opt.description.length > 120 ? opt.description.slice(0, 117) + '...' : opt.description;
      lines.push(`<text x="${PADDING}" y="${y}" font-family="${font}" font-size="13" fill="${muted}" dominant-baseline="text-before-edge">${escapeXml(desc)}</text>`);
      y += 20;
    }
    const optTotal = opt.summary?.totalGross || 0;
    lines.push(`<text x="${W - PADDING}" y="${y}" font-family="${font}" font-size="16" font-weight="700" fill="${text}" text-anchor="end" dominant-baseline="text-before-edge">${formatEuro(optTotal)}</text>`);
    y += 32;
  }

  if (options.length > 4) {
    lines.push(`<text x="${PADDING}" y="${y}" font-family="${font}" font-size="13" fill="${muted}" dominant-baseline="text-before-edge">... e altre ${options.length - 4} opzioni</text>`);
    y += 24;
  }

  // Total
  y += 8;
  lines.push(`<rect x="${PADDING}" y="${y}" width="${W - PADDING * 2}" height="2" fill="${accent}"/>`);
  y += 20;
  lines.push(`<text x="${PADDING}" y="${y}" font-family="${font}" font-size="20" font-weight="700" fill="${text}" dominant-baseline="text-before-edge">Totale</text>`);
  lines.push(`<text x="${W - PADDING}" y="${y}" font-family="${font}" font-size="20" font-weight="700" fill="${accent}" text-anchor="end" dominant-baseline="text-before-edge">${formatEuro(total)}</text>`);
  y += 40;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Math.max(200, y + PADDING)}" width="${W}" height="${Math.max(200, y + PADDING)}"><rect width="100%" height="100%" fill="#ffffff"/>${lines.join('')}</svg>`;
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
