/**
 * Helpers for preparing logo reference images to send to the
 * `/api/ai/logo-background` endpoint.
 *
 * The logo screenshot is rendered from the current builder (text +
 * icon, no background). When regenerating, the previous AI background
 * is also sent as a reference "iteration to improve upon".
 */

import type { Logo } from '../documentSchemas';
import { builderToSvg, svgToPng } from '../logoGenerator';
import { compressForAI, pruneImagesForBodyBudget } from '../ai/compressForAI';

const LOGO_SCREENSHOT_LONG_SIDE = 512;
const LOGO_SCREENSHOT_TARGET_BYTES = 400_000;
const PREVIOUS_BG_TARGET_BYTES = 200_000;
const PREVIOUS_BG_MAX_SIDE = 512;
const BODY_BUDGET_BYTES = 900_000;

export interface LogoBackgroundImages {
  logoImage?: string;
  previousBackground?: string;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
  }
  return Buffer.from(bytes).toString('base64');
}

/** Renders the current logo builder to a compressed JPEG data URL. */
export async function renderLogoScreenshot(logo: Logo): Promise<string | undefined> {
  try {
    const svg = builderToSvg(logo.builder);
    const pngBytes = await svgToPng(svg, LOGO_SCREENSHOT_LONG_SIDE, { tier: 'unlocked' });
    const pngDataUrl = `data:image/png;base64,${uint8ArrayToBase64(pngBytes)}`;
    const compressed = await compressForAI(pngDataUrl, LOGO_SCREENSHOT_TARGET_BYTES, LOGO_SCREENSHOT_LONG_SIDE);
    return compressed.dataUrl;
  } catch (err) {
    console.warn('[renderLogoScreenshot] fallback to no image', err);
    return undefined;
  }
}

/** Re-encodes the previous AI background for use as a reference image. */
export async function compressPreviousBackground(logo: Logo): Promise<string | undefined> {
  const bg = logo.builder.backgroundImage;
  if (!bg) return undefined;
  try {
    const compressed = await compressForAI(bg, PREVIOUS_BG_TARGET_BYTES, PREVIOUS_BG_MAX_SIDE);
    return compressed.dataUrl;
  } catch (err) {
    console.warn('[compressPreviousBackground] fallback to no previous background', err);
    return undefined;
  }
}

/** Builds the request payload, pruning images if the JSON body exceeds budget. */
export function buildLogoBackgroundPayload(
  prompt: string,
  images: LogoBackgroundImages,
  userEmail?: string,
  imageModel?: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    prompt,
    userEmail,
    imageModel,
  };
  if (images.logoImage) payload.logoImage = images.logoImage;
  if (images.previousBackground) payload.previousBackground = images.previousBackground;

  return pruneImagesForBodyBudget(payload, ['logoImage', 'previousBackground'], BODY_BUDGET_BYTES);
}
