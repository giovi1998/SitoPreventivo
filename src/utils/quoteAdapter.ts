import type { PremiumQuote } from './quoteSchema';
import { toLegacyFormat, migrateFromLegacy } from './quoteSchema';

export interface QuoteMeta {
  shareToken?: string;
  isShared?: boolean;
  isTemplate?: boolean;
  isGlobal?: boolean;
}

export const quoteAdapter = {
  /** Convert a PremiumQuote (frontend domain model) to the flat legacy shape the API/DB expects. */
  toApi(quote: PremiumQuote, meta?: QuoteMeta) {
    const legacy = toLegacyFormat(quote);
    return { ...legacy, ...meta };
  },

  /** Convert a flat legacy object from the API/DB back into a PremiumQuote. */
  fromApi(legacy: unknown): PremiumQuote {
    return migrateFromLegacy(legacy as any);
  },
};

export default quoteAdapter;
