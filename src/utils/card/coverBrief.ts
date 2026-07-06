import type { BusinessCard, CardGrid } from '../documentSchemas';

export interface CardCoverBrief {
  /** Nano-Banana visual prompt sent to Gemini image generation. */
  prompt: string;
  /** Structured card context (front/back/grid/palette) appended to the prompt. */
  context: string;
}

const MAX_PROMPT_LEN = 1000;
const MAX_CONTEXT_LEN = 1200;

/**
 * Builds a vision-aware cover brief for Gemini image generation.
 * The `prompt` follows the Nano-Banana formula but is intentionally built
 * as a *background texture* request, not a business-card design request.
 * This prevents Gemini from inventing text, faces, logos or other card
 * elements that the user will add separately.
 *
 * The `context` describes the actual card layout, grid positions, and palette
 * so the generated background is coherent with the rendered card (free space
 * for decoration vs calm areas for text). It also includes a compact JSON
 * snapshot of the card so the model can reason about the real rendering.
 */
export function buildCardCoverBrief(
  card: BusinessCard,
  side: 'front' | 'back' = 'front',
): CardCoverBrief {
  const { name, title, company } = card.front;
  const { accentColor, bgColor, textColor } = card.style;
  const brand = company || name || 'brand';
  const profession = title || 'professional';

  // v2.7 prompt: balanced. Keeps hard prohibitions only for card-like
  // elements the user will overlay separately (text, QR, logo, faces,
  // people, letters, numbers), but grants freedom on shapes, patterns,
  // lines, gradients, light effects so the background is more
  // expressive. Low contrast preserved for text legibility.
  const prompt = clamp(
    `Soft abstract background, a gentle gradient that drifts between ` +
      `the card palette tones (use ONLY: ${bgColor} primary, ` +
      `${accentColor} undertone, ${textColor} deepest, with subtle ±10% ` +
      `variation). Let one tone flow softly into another, like a calm ` +
      `watercolor wash — no hard edges. You may add soft shapes, gentle ` +
      `patterns, flowing lines, subtle dots, light gradients, organic ` +
      `forms — keep it abstract and tasteful. ` +
      `No text, no QR, no logo, no letters, no numbers, no faces, no ` +
      `people. No realistic objects, no UI elements. ` +
      `Low contrast throughout, every region stays light enough for ` +
      `overlaid text. Square 1:1, full-bleed.`,
    MAX_PROMPT_LEN,
  );

  const context = clamp(buildCoverContext(card, side), MAX_CONTEXT_LEN);

  return { prompt, context };
}

function buildCoverContext(card: BusinessCard, side: 'front' | 'back'): string {
  const lines: string[] = [];
  const { accentColor, bgColor, textColor, fontFamily } = card.style;

  lines.push(`Palette: accent ${accentColor}, background ${bgColor}, text ${textColor}, font ${fontFamily}.`);

  const profession = card.front.title || card.front.company || 'professional';
  lines.push(`Brand: "${card.front.company || card.front.name || 'brand'}" (${profession}).`);

  const grid = side === 'back' ? card.backGrid : card.grid;
  if (grid && grid.cols > 0 && grid.rows > 0) {
    lines.push(`${side === 'back' ? 'Back' : 'Front'} grid ${grid.cols}x${grid.rows}:`);
    const sorted = Object.entries(grid.elements)
      .filter(([, el]) => el && typeof el === 'object')
      .sort(([, a], [, b]) => (a.y - b.y) * 100 + (a.x - b.x));
    for (const [key, el] of sorted) {
      const xEnd = el.x + el.w;
      const yEnd = el.y + el.h;
      const placement = describePlacement(grid, el);
      const alignment = el.alignH || el.alignV
        ? `align=${[el.alignH, el.alignV].filter(Boolean).join(',')}`
        : '';
      lines.push(
        `- ${key} cols ${el.x}-${xEnd}, rows ${el.y}-${yEnd} (${placement}${alignment ? ` ${alignment}` : ''})`,
      );
    }
  } else {
    lines.push('Grid: not defined; generate a generic balanced background.');
  }

  lines.push(buildOverlayHints(card, side));

  // Compact JSON snapshot for coherence (layout/colors only, no secrets).
  const snapshot = buildCardSnapshot(card, side);
  if (snapshot) {
    lines.push(`Layout snapshot (for coherence): ${snapshot}`);
  }

  return lines.join(' ');
}

function buildOverlayHints(card: BusinessCard, side: 'front' | 'back'): string {
  const hints: string[] = [];
  if (side === 'front') {
    if (card.front.photoUrl) hints.push('a user photo will be placed on the front');
    if (card.front.logoUrl) hints.push('a user logo will be placed on the front');
    if (card.front.name || card.front.title || card.front.company) {
      hints.push('text name/title will be overlaid');
    }
  } else {
    if (card.back.qrPayload || card.back.website) hints.push('a QR code will be placed on the back');
    if (card.back.phone || card.back.email || card.back.website) hints.push('contact text will be overlaid');
    if (card.back.socials?.length) hints.push('social icons will be overlaid');
  }
  if (hints.length === 0) {
    return 'No specific overlays planned: keep overall contrast low and readable.';
  }
  return `Overlays: ${hints.join(', ')}. Keep those areas visually calm, low-contrast, and free of busy patterns so text remains legible.`;
}

function buildCardSnapshot(card: BusinessCard, side: 'front' | 'back'): string {
  try {
    const { accentColor, bgColor, textColor, fontFamily, fontScale } = card.style;
    const snapshot = {
      side,
      palette: { accent: accentColor, bg: bgColor, text: textColor, font: fontFamily, fontScale },
      grid: side === 'back' ? card.backGrid : card.grid,
      hasPhoto: side === 'front' ? !!card.front.photoUrl : false,
      hasLogo: side === 'front' ? !!card.front.logoUrl : false,
      hasQr: side === 'back' ? !!(card.back.qrPayload || card.back.website) : false,
      textFields:
        side === 'front'
          ? { name: card.front.name, title: card.front.title, company: card.front.company }
          : { phone: card.back.phone, email: card.back.email, website: card.back.website, qrLabel: card.back.qrLabel },
    };
    return JSON.stringify(snapshot);
  } catch {
    return '';
  }
}

function describePlacement(grid: CardGrid, el: { x: number; y: number; w: number; h: number }): string {
  const midX = el.x + el.w / 2;
  const midY = el.y + el.h / 2;
  const cx = midX <= grid.cols / 3 ? 'left' : midX >= (grid.cols * 2) / 3 ? 'right' : 'center';
  const cy = midY <= grid.rows / 3 ? 'top' : midY >= (grid.rows * 2) / 3 ? 'bottom' : 'middle';
  return `${cy}-${cx}`;
}

function clamp(s: string, max: number): string {
  if (s.length <= max) return s;
  // Try to cut at last sentence boundary before limit.
  const cut = s.lastIndexOf('.', max);
  if (cut > max * 0.8) return s.slice(0, cut + 1);
  return s.slice(0, max - 3) + '...';
}
