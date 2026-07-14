/**
 * Helpers for preparing the flyer screenshot to send to the
 * `/api/ai/flyer-hero` endpoint.
 */

import type { Flyer } from '../documentSchemas';
import { buildFlyerSvg } from './svgRenderer';
import { svgToJpegDataUrlForAI, pruneImagesForBodyBudget } from '../ai/compressForAI';
import type { FlyerSector, FlyerTone } from '../documentSchemas';
import {
  type HeroAspectRatio,
  aspectRatioForFlyer,
  buildHeroContext,
  buildHeroPrompt,
  getDefaultHeroSector,
  getDefaultHeroTone,
  hasHeroBox,
} from './heroPrompt';

export { hasHeroBox, aspectRatioForFlyer };
export type { HeroAspectRatio, FlyerSector, FlyerTone };

const FLYER_SCREENSHOT_LONG_SIDE = 512;
const FLYER_SCREENSHOT_TARGET_BYTES = 400_000;
const BODY_BUDGET_BYTES = 900_000;

export interface FlyerHeroImages {
  flyerImage?: string;
}

export async function renderFlyerScreenshot(flyer: Flyer): Promise<string | undefined> {
  try {
    const svg = buildFlyerSvg(flyer);
    const compressed = await svgToJpegDataUrlForAI(svg, FLYER_SCREENSHOT_TARGET_BYTES, FLYER_SCREENSHOT_LONG_SIDE);
    return compressed.dataUrl;
  } catch (err) {
    console.warn('[renderFlyerScreenshot] fallback to no image', err);
    return undefined;
  }
}

export function buildFlyerHeroPayload(
  flyer: Flyer,
  sector: FlyerSector,
  tone: FlyerTone,
  images: FlyerHeroImages,
  userEmail?: string,
  promptOverride?: string,
): Record<string, unknown> {
  const prompt = (promptOverride && promptOverride.trim().length > 0) ? promptOverride.trim() : buildHeroPrompt(flyer, sector, tone);
  const context = buildHeroContext(flyer, sector, tone);
  const aspectRatio = aspectRatioForFlyer(flyer);
  const payload: Record<string, unknown> = {
    prompt,
    context,
    aspectRatio,
    userEmail,
  };
  if (images.flyerImage) payload.flyerImage = images.flyerImage;

  return pruneImagesForBodyBudget(payload, ['flyerImage'], BODY_BUDGET_BYTES);
}

export { buildHeroPrompt, buildHeroContext, getDefaultHeroSector, getDefaultHeroTone };
