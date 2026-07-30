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
  } catch {
    // Documento malformato/non idratabile: fallback icona.
  }
  return '';
}
