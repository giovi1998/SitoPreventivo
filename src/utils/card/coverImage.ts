/**
 * Helpers for preparing card-side screenshots and the user's logo
 * to send as reference images to the `/api/ai/card-cover` endpoint.
 *
 * The reference images are input-only: they help Gemini understand the
 * real card layout so the generated background does not overlap the
 * text, QR, or logo. They are not the final deliverable, so they are
 * aggressively compressed.
 */

import type { BusinessCard } from '../documentSchemas';
import { renderCardSideDataUrl, resolveToBase64DataUrl } from './pngExport';
import { compressForAI, pruneImagesForBodyBudget } from '../ai/compressForAI';

const CARD_SCREENSHOT_LONG_SIDE = 512;
const CARD_SCREENSHOT_TARGET_BYTES = 400_000;
const LOGO_TARGET_BYTES = 100_000;
const LOGO_MAX_SIDE = 256;
const BODY_BUDGET_BYTES = 900_000;

/** Aspect of a standard EU business card (85mm x 55mm). */
const CARD_ASPECT = 85 / 55;

export interface CardCoverImages {
  cardImage?: string;
  logoImage?: string;
}

/** Renders the requested card side to a compressed JPEG data URL. */
export async function renderCardCoverScreenshot(
  card: BusinessCard,
  side: 'front' | 'back',
): Promise<string | undefined> {
  const pxW = CARD_SCREENSHOT_LONG_SIDE;
  const pxH = Math.round(CARD_SCREENSHOT_LONG_SIDE / CARD_ASPECT);
  try {
    const dataUrl = await renderCardSideDataUrl(card, side, pxW, pxH);
    const compressed = await compressForAI(dataUrl, CARD_SCREENSHOT_TARGET_BYTES, CARD_SCREENSHOT_LONG_SIDE);
    return compressed.dataUrl;
  } catch (err) {
    console.warn('[renderCardCoverScreenshot] fallback to no image', err);
    return undefined;
  }
}

export async function resolveCardCoverLogo(
  card: BusinessCard,
): Promise<string | undefined> {
  if (!card.front.logoUrl) return undefined;
  try {
    const resolved = await resolveToBase64DataUrl(card.front.logoUrl);
    if (!resolved) return undefined;
    
    // Convert to a raster JPEG data URL (even if it's an SVG)
    // so we don't send URL-encoded SVG text to Gemini, which expects base64.
    const { imageToJpegDataUrl } = await import('../ai/compressForAI');
    const rasterized = await imageToJpegDataUrl(resolved, LOGO_MAX_SIDE);
    
    const compressed = await compressForAI(rasterized, LOGO_TARGET_BYTES, LOGO_MAX_SIDE);
    return compressed.dataUrl;
  } catch (err) {
    console.warn('[resolveCardCoverLogo] fallback to no logo image', err);
    return undefined;
  }
}

/** Builds the request payload, pruning images if the JSON body exceeds budget. */
export function buildCardCoverPayload(
  prompt: string,
  context: string,
  images: CardCoverImages,
  side: 'front' | 'back',
  userEmail?: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    prompt,
    context,
    side,
    userEmail,
  };
  if (images.cardImage) payload.cardImage = images.cardImage;
  if (images.logoImage) payload.logoImage = images.logoImage;

  return pruneImagesForBodyBudget(payload, ['logoImage', 'cardImage'], BODY_BUDGET_BYTES);
}
