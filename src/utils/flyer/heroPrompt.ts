/**
 * Prompt construction for the flyer AI hero endpoint.
 *
 * Builds a Nano-Banana text prompt from the flyer sector, tone,
 * palette, and hero box aspect. The screenshot of the flyer is sent
 * separately as a reference image.
 */

import type { Flyer, FlyerSector, FlyerTone } from '../documentSchemas';
import { getFlyerDimensions } from '../documentSchemas';
import { heroBoxMmForLayout } from './templateCatalog';

const HERO_ASPECT_RATIOS = ['16:9', '3:2', '1:1', '2:3', '3:4'] as const;
export type HeroAspectRatio = (typeof HERO_ASPECT_RATIOS)[number];

const SECTOR_MOTIFS: Record<FlyerSector, string> = {
  ristorante:
    'appetizing food photography style, close-up dishes, warm rustic table settings, fresh ingredients, soft steam, elegant plating',
  evento:
    'celebration atmosphere, confetti, stage lights, crowd silhouettes, festive banners, dynamic energy',
  salone:
    'beauty and wellness interior, soft portrait lighting, elegant products, relaxed atmosphere, premium textures',
  negozio:
    'retail lifestyle photography, curated products on shelves, welcoming storefront, clean commercial aesthetic',
};

const SECTOR_STYLES: Record<FlyerSector, string> = {
  ristorante: 'warm, inviting, editorial food photography',
  evento: 'vibrant, energetic, event documentary',
  salone: 'soft, premium, lifestyle beauty',
  negozio: 'clean, commercial, retail lifestyle',
};

const TONE_ACTIONS: Record<FlyerTone, string> = {
  formale: 'conveys trust and professionalism with a calm, measured mood',
  giovanile: 'conveys energy and excitement with a bold, playful mood',
  tecnico: 'conveys precision and innovation with a clean, modern mood',
};

const TONE_LIGHTING: Record<FlyerTone, string> = {
  formale: 'soft, even studio lighting with subtle shadows',
  giovanile: 'bright, high-contrast lighting with vivid colours',
  tecnico: 'crisp directional lighting with cool accents and sharp edges',
};

export function aspectRatioForHeroBox(box: { w: number; h: number }): HeroAspectRatio {
  if (box.w <= 0 || box.h <= 0) return '3:2';
  const aspect = box.w / box.h;
  if (aspect >= 1.6) return '16:9';
  if (aspect >= 1.1) return '3:2';
  if (aspect >= 0.9) return '1:1';
  if (aspect >= 0.6) return '2:3';
  return '3:4';
}

export function aspectRatioForFlyer(flyer: Flyer): HeroAspectRatio {
  const box = heroBoxMmForLayout(flyer.style.layout, getFlyerDimensions(flyer));
  return aspectRatioForHeroBox(box);
}

export function buildHeroPrompt(flyer: Flyer, sector: FlyerSector, tone: FlyerTone): string {
  const { accentColor, bgColor, textColor } = flyer.style;
  const ratio = aspectRatioForFlyer(flyer);
  const motifs = SECTOR_MOTIFS[sector];
  const style = SECTOR_STYLES[sector];
  const action = TONE_ACTIONS[tone];
  const lighting = TONE_LIGHTING[tone];

  return (
    `Hero image for a ${sector} flyer, ${tone} tone. ` +
    `Depicts ${motifs}. ` +
    `The scene ${action}, as the focal point of a promotional flyer. ` +
    `Palette: ${accentColor} accent, ${bgColor} background, ${textColor} text. ` +
    `Composition: ${ratio}, full-bleed, no border, centered subject. ` +
    `Lighting: ${lighting}. ` +
    `Style: ${style}, print-ready, high quality. ` +
    `NO text, NO letters, NO numbers, NO QR codes, NO barcodes, NO logos, NO symbols, NO faces, NO people, NO brand names, NO watermarks, NO UI elements, NO frames, NO badges. ` +
    `Pure background/hero visual; flyer text and CTA are overlaid separately.`
  );
}

export function buildHeroContext(flyer: Flyer, sector: FlyerSector, tone: FlyerTone): string {
  const ratio = aspectRatioForFlyer(flyer);
  return `Sector: ${sector}. Tone: ${tone}. Hero box aspect: ${ratio}. Layout: ${flyer.style.layout}. Size: ${flyer.size} ${flyer.orientation}.`;
}

export function getDefaultHeroSector(flyer: Flyer): FlyerSector {
  // Try to infer from the template seed or title if the editor didn't
  // pass an explicit sector. Falls back to negozio.
  const text = `${flyer.title ?? ''} ${flyer.content.headline ?? ''} ${flyer.content.body ?? ''} ${flyer.content.subheadline ?? ''}`.toLowerCase();
  if (/ristor|pizz|trattoria|cucina|chef|food|cibo|pasta|osteria/.test(text)) return 'ristorante';
  if (/evento|festa|concerto|sagra|party|matrimonio|conferenza|fiera/.test(text)) return 'evento';
  if (/salon|parrucchiere|estetista|bellezza|spa|wellness|barbier|nail/.test(text)) return 'salone';
  if (/negozio|shop|store|boutique|mercato|vendita|outlet/.test(text)) return 'negozio';
  return 'negozio';
}

export function getDefaultHeroTone(flyer: Flyer): FlyerTone {
  return 'formale';
}

export function hasHeroBox(layout: string): boolean {
  return layout !== 'centered';
}
