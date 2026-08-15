import type { BusinessCard } from '../documentSchemas';
import { compressDataUrl } from './imageCompress';

const MAX_DIM = 1200;
const MAX_BYTES = 400_000;

async function compressField(val: string | null | undefined): Promise<string | null> {
  if (!val || !val.startsWith('data:')) return val ?? null;
  return compressDataUrl(val, MAX_DIM, MAX_BYTES);
}

/**
 * Compress all base64 data-URL images inside a BusinessCard in parallel.
 * Returns a shallow copy with compressed fields; original is not mutated.
 * Non-data-URL fields (http URLs, null) pass through unchanged.
 */
export async function compressCardImages(card: BusinessCard): Promise<BusinessCard> {
  const [frontPhoto, frontLogo, frontCover, backCover] = await Promise.all([
    compressField(card.front.photoUrl),
    compressField(card.front.logoUrl),
    compressField(card.front.coverImageUrl),
    compressField(card.back.coverImageUrl),
  ]);
  return {
    ...card,
    front: { ...card.front, photoUrl: frontPhoto, logoUrl: frontLogo, coverImageUrl: frontCover },
    back: { ...card.back, coverImageUrl: backCover },
  };
}
