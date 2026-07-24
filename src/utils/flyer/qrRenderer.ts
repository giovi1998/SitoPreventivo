import { generateQrSvg } from '../qrGenerator';

export function inlineQrSvg(qrPayload: string, textColor: string): { inner: string; size: number } | null {
  if (!qrPayload) return null;
  const full = generateQrSvg({
    documentType: 'qrCode', id: 'flyer-export-qr', title: 'flyer-qr',
    data: { type: 'url', payload: qrPayload },
    style: { errorCorrection: 'M', fgColor: textColor, bgColor: '#FFFFFF', size: 512, margin: 1, logoOverlay: null, dotStyle: 'square' },
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  const m = full.match(/<svg[^>]*viewBox="([^"]+)"[^>]*>/);
  if (!m) return null;
  const inner = full.replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return { inner, size: 23 };
}

export function escapeXmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function safeHex(color: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}
