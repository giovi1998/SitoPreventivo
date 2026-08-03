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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120" width="200" height="120">
    <rect width="200" height="120" rx="8" fill="#f0f4f8"/>
    <circle cx="100" cy="35" r="18" fill="#01696F" opacity="0.15"/>
    <circle cx="100" cy="35" r="10" fill="#01696F" opacity="0.3"/>
    <circle cx="100" cy="35" r="4" fill="#01696F"/>
    <line x1="60" y1="35" x2="140" y2="35" stroke="#01696F" stroke-width="1.5" opacity="0.4"/>
    <line x1="100" y1="17" x2="100" y2="53" stroke="#01696F" stroke-width="1.5" opacity="0.4"/>
    <text x="100" y="75" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="600" fill="#1a1a2e">${escapeXml(name)}</text>
    <text x="100" y="92" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#8896ab">${pages} pagina${pages !== 1 ? 'e' : ''}</text>
    <rect x="60" y="100" width="80" height="14" rx="7" fill="#01696F" opacity="0.1"/>
    <text x="100" y="111" text-anchor="middle" font-family="sans-serif" font-size="7" fill="#01696F">Sito Web</text>
  </svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
