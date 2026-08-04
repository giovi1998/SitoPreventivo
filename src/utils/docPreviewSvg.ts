import type { BusinessCard, Logo, Flyer } from './documentSchemas';
import { mergeCardWithDefaults, mergeFlyerWithDefaults } from './documentSchemas';
import { builderToSvg, sanitizeSvg } from './logoGenerator';
import { buildCardSvg } from './card/svgRenderer';
import { buildFlyerSvg } from './flyer/svgRenderer';
import { buildQuotePreviewSvg } from './quote/quotePreviewImage';
import { migrateFromLegacy, type PremiumQuote } from './quoteSchema';

/**
 * Genera SVG inline per preview (Collection, CRM CustomerDetail).
 * - logo: `builderToSvg` + sanitize, ritorna stringa SVG con viewBox.
 * - card: `buildCardSvg` lato front (no rotazione, no font import per
 *   leggerezza), ritorna SVG con viewBox 0 0 pxW pxH.
 * - flyer: `mergeFlyerWithDefaults` + `buildFlyerSvg` (viewBox in mm).
 * - quote: `buildQuotePreviewSvg` su PremiumQuote; se il doc è legacy
 *   flat, prima `migrateFromLegacy` poi preview.
 * Ritorna stringa vuota se il documento non è renderizzabile.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildPreviewSvg(doc: any): string {
  try {
    if (doc.documentType === 'logo' && doc.builder) {
      return sanitizeSvg(builderToSvg(doc.builder as Logo['builder']));
    }
    if (doc.documentType === 'businessCard') {
      const card = mergeCardWithDefaults(doc as Partial<BusinessCard>);
      // Preview front, dimensioni ridotte (il viewBox è in mm user units
      // ma renderizza scalato via CSS). Usiamo 320×200 px logici.
      return buildCardSvg(card, 'front', 320, 200, { embeddedFontCss: '' });
    }
    if (doc.documentType === 'flyer') {
      const flyer = mergeFlyerWithDefaults(doc as Partial<Flyer>);
      return buildFlyerSvg(flyer);
    }
    if (doc.documentType === 'quote') {
      // Doc unificato ha `quote` field (PremiumQuote); legacy flat ha
      // i campi sul doc stesso. migrateFromLegacy gestisce entrambi i
      // casi: se già PremiumQuote lo passa, se legacy lo converte.
      const quote = (doc.quote ?? migrateFromLegacy(doc)) as PremiumQuote;
      return buildQuotePreviewSvg(quote);
    }
    if (doc.documentType === 'website') {
      return buildWebsitePreviewSvg(doc);
    }
  } catch {
    // Documento malformato/non idratabile: fallback icona.
  }
  return '';
}

function buildWebsitePreviewSvg(doc: any): string {
  const name = doc.brief?.businessName || doc.title || 'Sito Web';
  const pages = Array.isArray(doc.pages) ? doc.pages.length : 1;
  const css = typeof doc.css === 'string' ? doc.css : '';
  const html = typeof doc.html === 'string' ? doc.html : '';
  const primary = extractCssColor(css, ['--primary', '--brand', '--color-primary']);
  const bg = extractCssColor(css, ['--bg', '--background']) || '#ffffff';
  const heading = extractHeading(html);
  const title = heading || name;

  const chrome = primary || '#01696F';
  const textColor = isLightColor(chrome) ? '#1a1a2e' : '#ffffff';
  const barColor = isLightColor(chrome) ? '#eef2f6' : 'rgba(0,0,0,0.25)';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120" width="200" height="120">
    <rect width="200" height="120" rx="8" fill="#f0f4f8"/>
    <rect x="20" y="14" width="160" height="92" rx="5" fill="${escapeXml(bg)}"/>
    <rect x="20" y="14" width="160" height="14" rx="5" fill="${escapeXml(chrome)}"/>
    <circle cx="30" cy="21" r="3" fill="${escapeXml(barColor)}"/>
    <circle cx="40" cy="21" r="3" fill="${escapeXml(barColor)}"/>
    <circle cx="50" cy="21" r="3" fill="${escapeXml(barColor)}"/>
    <text x="100" y="24" text-anchor="middle" font-family="sans-serif" font-size="6" fill="${escapeXml(textColor)}">${escapeXml(truncate(title, 30))}</text>
    <rect x="28" y="38" width="50" height="9" rx="2" fill="${escapeXml(chrome)}"/>
    <rect x="28" y="52" width="86" height="5" rx="2.5" fill="${escapeXml(chrome)}" opacity="0.35"/>
    <rect x="28" y="61" width="70" height="5" rx="2.5" fill="${escapeXml(chrome)}" opacity="0.35"/>
    <rect x="28" y="80" width="40" height="11" rx="5.5" fill="${escapeXml(chrome)}" opacity="0.25"/>
    <rect x="142" y="92" width="30" height="10" rx="3" fill="${escapeXml(chrome)}" opacity="0.12"/>
    <text x="157" y="100" text-anchor="middle" font-family="sans-serif" font-size="6.5" fill="${escapeXml(chrome)}">${pages} p.</text>
  </svg>`;
}

function extractCssColor(css: string, keys: string[]): string | null {
  for (const key of keys) {
    const m = css.match(new RegExp(`${key}\\s*:\\s*(#[0-9a-fA-F]{3,8}|rgb\\([^)]+\\)|rgba?\\([^)]+\\))`));
    if (m) return normalizeCssColor(m[1]);
  }
  return null;
}

function normalizeCssColor(color: string): string | null {
  const c = color.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c)) return c;
  if (/^rgba?\(/.test(c)) {
    const nums = c.match(/(\d+(?:\.\d+)?)/g)?.map(Number) || [];
    if (nums.length < 3) return null;
    return `rgb(${Math.min(255, Math.max(0, Math.round(nums[0])))},${Math.min(255, Math.max(0, Math.round(nums[1])))},${Math.min(255, Math.max(0, Math.round(nums[2])))})`;
  }
  return null;
}

function isLightColor(color: string): boolean {
  const m = color.match(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return false;
  const hex = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 180;
}

function extractHeading(html: string): string | null {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
