/**
 * Builds a profession-focused photo brief for Gemini image generation.
 * Unlike cover (abstract texture), this produces a stylized illustration
 * that can replace the portrait photo slot (e.g. dog for dogsitter,
 * vegetables for nutritionist).
 */

import type { BusinessCard } from '../documentSchemas';

export interface CardPhotoBrief {
  prompt: string;
  context: string;
}

const MAX_PROMPT_LEN = 1000;
const MAX_CONTEXT_LEN = 1500;

export function buildCardPhotoBrief(card: BusinessCard): CardPhotoBrief {
  const profession = (card.front.title || card.front.company || 'professionista').trim();
  const brand = (card.front.company || card.front.name || 'brand').trim();
  const services = (card.back.services || []).filter(Boolean).slice(0, 6);
  const { accentColor, bgColor, textColor } = card.style;

  const servicesPart =
    services.length > 0
      ? `Activities and services: ${services.join(', ')}. `
      : '';

  const prompt = clamp(
    `Subject: a single stylized professional illustration that symbolizes ` +
      `the work of a ${profession} for the brand "${brand}". ` +
      `${servicesPart}` +
      `Action: the main subject is centered, calm, and clearly readable at small size. ` +
      `Context: palette restricted to ${bgColor} as background base, ${accentColor} as main accent, ` +
      `and ${textColor} as the deepest tone, with soft harmonious contrast. ` +
      `Composition: square 1:1 portrait crop, subject fills most of the frame, simple background. ` +
      `Lighting: soft studio light, no harsh shadows. ` +
      `Style: modern flat or semi-flat illustration, premium business-card quality, not photorealistic. ` +
      `Ensure the image remains free of any text, words, letters, numbers, logos, watermarks, ` +
      `QR codes, UI chrome, or multiple competing scenes. One clear professional motif only.`,
    MAX_PROMPT_LEN,
  );

  const contextLines = [
    `Profession: ${profession}`,
    `Brand: ${brand}`,
    services.length ? `Services: ${services.join('; ')}` : null,
    `Palette: bg ${bgColor}, accent ${accentColor}, text ${textColor}`,
    `Use case: business card portrait photo replacement`,
  ].filter(Boolean);

  return {
    prompt,
    context: clamp(contextLines.join('\n'), MAX_CONTEXT_LEN),
  };
}

function clamp(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}
