import type { BusinessCard, CardGrid } from '../documentSchemas';
import { deriveGridFromLayout, hasGridElements } from '../documentSchemas';
import {
  GRID_PAD_REF,
  GRID_GAP_REF,
  GRID_REF_HEIGHT,
  GRID_TEXT_PAD_X_REF,
  GRID_TEXT_PAD_Y_REF,
  GRID_PHOTO_BORDER_REF,
  CARD_REF,
} from './gridConstants';
import { renderDecorativePattern } from '../decorations/patterns';
import { escapeXml } from '../xml';
import { fs, svgFontFamily, wrapTextAtWhitespace, buildGridDebugSvg, type BuildSvgOptions } from './svgShared';

export function buildFrontSvg(
  card: BusinessCard,
  pxW: number,
  pxH: number,
  opts: BuildSvgOptions = {},
): string {
  const bg = card.style.bgColor;
  const text = card.style.textColor;
  const accent = card.style.accentColor;
  const hasPhoto = !!card.front.photoUrl;
  const hasLogo = !!card.front.logoUrl;
  const fontScale = card.style.fontScale ?? 1;
  const fontFamily = svgFontFamily(card);

  const pad = Math.max(10, Math.round(pxW * 0.04));
  const stripW = Math.max(2, Math.round(pxW * 0.008));

  let out = '';

  // 0. Base background (only visible where cover image is missing or transparent)
  out += `<rect width="${pxW}" height="${pxH}" fill="${bg}"/>`;

  // 1. AI-generated cover image (full-bleed on top of base background)
  if (card.front.coverImageUrl) {
    out += `<image href="${escapeXml(card.front.coverImageUrl)}" x="0" y="0" width="${pxW}" height="${pxH}" preserveAspectRatio="xMidYMid slice"/>`;
  }
  // 1a. Readability wash on top of the cover.
  //
  // Two stacked semi-transparent layers, both using the card's own
  // background tint (`bgColor`). The first is a flat 60% wash that
  // flattens the cover's gradients into a calm tinted page; the second
  // is a soft vertical gradient 0% → 25% (at 55%) → 80% at the bottom,
  // matching the preview CSS hex-alpha stops (00/40/cc), so the
  // area where the user name sits in the default front grid is calmer
  // than the photo region at the top. This guarantees readable text
  // even when the AI cover happens to be too busy or too dark.
  if (card.front.coverImageUrl) {
    out += `<rect width="${pxW}" height="${pxH}" fill="${bg}" opacity="0.6"/>`;
    out += `<defs><linearGradient id="frontReadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${bg}" stop-opacity="0"/>
      <stop offset="55%" stop-color="${bg}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${bg}" stop-opacity="0.8"/>
    </linearGradient></defs>`;
    out += `<rect width="${pxW}" height="${pxH}" fill="url(#frontReadGrad)"/>`;
  }

  // 2. Decorative pattern: user-selected pattern overrides the legacy
  // corner radial gradient and diagonal accent pattern when present.
  if (card.decorations?.pattern) {
    out += renderDecorativePattern(card.decorations.pattern, pxW, pxH, {
      palette: card.decorations.palette || { primary: accent, secondary: text },
      opacity: card.decorations.opacity ?? 0.2,
    });
  } else {
    // Corner radial gradient (matches CSS .card-corner-accent)
    const cornerSize = Math.round(Math.min(pxW, pxH) * 0.28);
    out += `<defs><radialGradient id="cornerGrad" cx="100%" cy="0%" r="80%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient></defs>`;
    out += `<rect x="${pxW - cornerSize}" y="0" width="${cornerSize}" height="${cornerSize}" fill="url(#cornerGrad)"/>`;
  }

  // 3. Accent strip left
  if (card.style.borderStyle === 'accent-strip-left') {
    out += `<rect x="0" y="0" width="${stripW}" height="${pxH}" fill="${accent}"/>`;
  }
  // 4. Accent strip bottom
  if (card.style.borderStyle === 'accent-strip-bottom') {
    const stripH = Math.max(2, Math.round(pxH * 0.012));
    out += `<rect x="0" y="${pxH - stripH}" width="${pxW}" height="${stripH}" fill="${accent}"/>`;
  }

  // 5. Diagonal fallback pattern (only when no user pattern)
  if (!card.decorations?.pattern) {
    const patternSize = Math.max(8, Math.round(pxW * 0.02));
    out += `<defs><pattern id="diag" patternUnits="userSpaceOnUse" width="${patternSize}" height="${patternSize}" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="${patternSize}" stroke="${accent}" stroke-width="0.6" opacity="0.06"/>
    </pattern></defs>`;
    out += `<rect x="${Math.round(pxW * 0.6)}" y="0" width="${Math.round(pxW * 0.4)}" height="${Math.round(pxH * 0.35)}" fill="url(#diag)"/>`;
  }

  // 6. Render front from card.grid (single source of truth)
  // v2.8: when front.useGrid is false OR the grid has no elements, derive
  // fresh from layout so stale grids don't hide content (same fix as back).
  const rawFrontGrid = card.front.useGrid && hasGridElements('front', card) ? card.grid : undefined;
  const grid = rawFrontGrid ?? deriveGridFromLayout(card, 'front');
  if (grid && grid.cols > 0 && grid.rows > 0) {
    // v2.16: grid proportions are shared with the preview via gridConstants.
    const frontGridPad = Math.max(6, Math.round(pxH * (GRID_PAD_REF / GRID_REF_HEIGHT)));
    const frontCellGap = Math.max(2, Math.round(pxH * (GRID_GAP_REF / GRID_REF_HEIGHT)));
    const gridAreaX = frontGridPad;
    const gridAreaY = frontGridPad;
    const gridAreaW = pxW - 2 * frontGridPad;
    const gridAreaH = pxH - 2 * frontGridPad;
    const cellW = (gridAreaW - (grid.cols - 1) * frontCellGap) / grid.cols;
    const cellH = (gridAreaH - (grid.rows - 1) * frontCellGap) / grid.rows;
    const cellX = (col: number) => gridAreaX + col * (cellW + frontCellGap);
    const cellY = (row: number) => gridAreaY + row * (cellH + frontCellGap);

      const photoEl = grid.elements.photo;
      if (hasPhoto && photoEl) {
        const x = cellX(photoEl.x);
        const y = cellY(photoEl.y);
        const w = photoEl.w * cellW;
        const h = photoEl.h * cellH;
        const isPhotoCircle = card.front.layout === 'photo-circle';
        const pp = photoEl.placement ?? photoEl.photoPlacement;
        const scale = pp?.scale ?? 1;
        const dx = ((pp?.x ?? 0) * w) / 2;
        const dy = ((pp?.y ?? 0) * h) / 2;
      // scaled image rect centered on cell, then nudged by placement.
      const imgW = w * scale;
      const imgH = h * scale;
      const imgX = x + (w - imgW) / 2 + dx;
      const imgY = y + (h - imgH) / 2 + dy;
      if (isPhotoCircle) {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const r = Math.min(w, h) / 2;
        out += `<defs><clipPath id="photoCircle"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>`;
        out += `<image href="${escapeXml(card.front.photoUrl!)}" x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#photoCircle)"/>`;
        const photoBorderW = Math.max(1.5, Math.round(pxH * (GRID_PHOTO_BORDER_REF / GRID_REF_HEIGHT)));
        out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${accent}" stroke-width="${photoBorderW}"/>`;
      } else {
        out += `<image href="${escapeXml(card.front.photoUrl!)}" x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" preserveAspectRatio="xMidYMid slice" clip-path="inset(0 round 6)"/>`;
        // Parity with preview CSS .card-photo { border: 2px solid accent }.
        const photoBorderW = Math.max(1.5, Math.round(pxH * (GRID_PHOTO_BORDER_REF / GRID_REF_HEIGHT)));
        out += `<rect x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" rx="6" fill="none" stroke="${accent}" stroke-width="${photoBorderW}"/>`;
      }
    } else if (!hasPhoto && hasLogo && photoEl && !grid.elements.logo) {
      // Parity with preview (CardPreview photoContent fallback): when there
      // is no photo and no dedicated logo grid element, the logo is shown
      // inside the photo cell with objectFit contain.
      const x = cellX(photoEl.x);
      const y = cellY(photoEl.y);
      const w = photoEl.w * cellW;
      const h = photoEl.h * cellH;
      if (card.front.logoBackground === 'card') {
        out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${escapeXml(bg)}"/>`;
      }
      out += `<image href="${escapeXml(card.front.logoUrl!)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
    }

    const logoEl = grid.elements.logo;
    if (hasLogo && logoEl) {
      const x = cellX(logoEl.x);
      const y = cellY(logoEl.y);
      const w = logoEl.w * cellW;
      const h = logoEl.h * cellH;
      // v2.12: logo box is 72% of the cell (matches preview CSS max-width/height)
      // so 3×3 alignment can move it. preserveAspectRatio keeps artwork aspect.
      // v2.16: placement scale/zoom and nudge are applied like photo/QR.
      const logoPlacement = logoEl.placement ?? logoEl.photoPlacement;
      const logoScale = logoPlacement?.scale ?? 1;
      const alignH = logoEl.alignH ?? 'center';
      const alignV = logoEl.alignV ?? 'center';
      const xAlign = alignH === 'left' ? 'xMin' : alignH === 'right' ? 'xMax' : 'xMid';
      const yAlign = alignV === 'top' ? 'YMin' : alignV === 'bottom' ? 'YMax' : 'YMid';
      const logoW = w * 0.72 * logoScale;
      const logoH = h * 0.72 * logoScale;
      let logoX = x + (w - logoW) / 2;
      let logoY = y + (h - logoH) / 2;
      if (alignH === 'left') logoX = x + w * 0.04;
      else if (alignH === 'right') logoX = x + w - logoW - w * 0.04;
      if (alignV === 'top') logoY = y + h * 0.04;
      else if (alignV === 'bottom') logoY = y + h - logoH - h * 0.04;
      const logoNudgeX = ((logoPlacement?.x ?? 0) * w) / 2;
      const logoNudgeY = ((logoPlacement?.y ?? 0) * h) / 2;
      if (card.front.logoBackground === 'card') {
        out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${escapeXml(bg)}"/>`;
      }
      out += `<image href="${escapeXml(card.front.logoUrl!)}" x="${logoX + logoNudgeX}" y="${logoY + logoNudgeY}" width="${logoW}" height="${logoH}" preserveAspectRatio="${xAlign}${yAlign} meet"/>`;
    }

    const textKeys: Array<keyof CardGrid['elements'] & ('name' | 'title' | 'company')> = ['name', 'title', 'company'];
    // v2.14: font sizes proportional to CARD height (pxH), matching preview
    // grid-mode rem sizes on the unified 640×414 reference (CARD_REF).
    // v2.18: widened hierarchy (nome ≫ ruolo > company):
    //   name    1.375rem = 22px → 22/414
    //   title   1rem     = 16px → 16/414
    //   company 0.875rem = 14px → 14/414
    // Sizes scale with the card, not the cell, so the relative proportions
    // match the preview regardless of cell dimensions.
    const textValues: Record<
      'name' | 'title' | 'company',
      { text: string; weight: number; color: string; letterSpacing: number; sizePct: number; opacity?: number }
    > = {
      name: { text: card.front.name.toUpperCase(), weight: 800, color: text, letterSpacing: 0.5, sizePct: 22 / CARD_REF.h },
      title: { text: card.front.title, weight: 600, color: accent, letterSpacing: 0, sizePct: 16 / CARD_REF.h },
      company: { text: card.front.company, weight: 400, color: text, letterSpacing: 0, sizePct: 14 / CARD_REF.h, opacity: 0.78 },
    };
    for (const key of textKeys) {
      const el = grid.elements[key];
      if (!el || !textValues[key].text) continue;
      const cfg = textValues[key];
      const x = cellX(el.x);
      const y = cellY(el.y);
      const w = el.w * cellW;
      const h = el.h * cellH;
      const alignH = el.alignH ?? 'center';
      const alignV = el.alignV ?? 'center';
      // v2.17 (spec v2.0 REQ-ZOOM-003): placement.scale is a local font-size
      // factor for text elements. scale=1 leaves the output byte-identical.
      const placement = el.placement ?? el.photoPlacement;
      const elScale = placement?.scale ?? 1;
      const fontSize = fs(pxH * cfg.sizePct, fontScale) * elScale;
      // v2.16: cell padding from shared gridConstants.
      const cellPadX = Math.max(4, Math.round(pxH * (GRID_TEXT_PAD_X_REF / GRID_REF_HEIGHT)));
      const cellPadY = Math.max(3, Math.round(pxH * (GRID_TEXT_PAD_Y_REF / GRID_REF_HEIGHT)));
      // v2.16: positional nudge inside the cell.
      const nudgeX = ((placement?.x ?? 0) * w) / 2;
      const nudgeY = ((placement?.y ?? 0) * h) / 2;
      const textX = (alignH === 'left' ? x + cellPadX : alignH === 'right' ? x + w - cellPadX : x + w / 2) + nudgeX;
      const anchor = alignH === 'left' ? 'start' : alignH === 'right' ? 'end' : 'middle';
      const opacityAttr = cfg.opacity !== undefined ? ` opacity="${cfg.opacity}"` : '';
      const letterAttr = cfg.letterSpacing ? ` letter-spacing="${cfg.letterSpacing}"` : '';
      // v2.18: wrap long texts at whitespace (preview wraps via CSS) and hard
      // clip to the cell — same rule as the back contacts cell (v2.13).
      // Text must never paint outside its grid cell.
      const maxTextW = Math.max(10, w - 2 * cellPadX);
      const lines = wrapTextAtWhitespace(cfg.text, maxTextW, fontSize, fontFamily);
      const lineH = fontSize * 1.15;
      const blockH = lines.length * lineH;
      const blockY = (alignV === 'top'
        ? y + cellPadY
        : alignV === 'bottom'
          ? y + h - blockH - cellPadY
          : y + (h - blockH) / 2) + nudgeY;
      const clipId = `clipFront_${key}_${el.x}_${el.y}_${el.w}_${el.h}`;
      out += `<defs><clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs>`;
      out += `<g clip-path="url(#${clipId})">`;
      lines.forEach((line, idx) => {
        out += `<text x="${textX}" y="${blockY + idx * lineH}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${cfg.weight}" fill="${cfg.color}" text-anchor="${anchor}" dominant-baseline="text-before-edge"${letterAttr}${opacityAttr}>${escapeXml(line)}</text>`;
      });
      out += '</g>';
    }
  }

  // Fallback layout if grid missing: sensible default so export never empty
  if (!grid || Object.keys(grid.elements).length === 0) {
    const photoSize = Math.round(Math.min(pxW, pxH) * 0.4);
    const logoBg = card.front.logoBackground === 'card' ? bg : 'none';
    const photoX = pad + stripW;
    const photoY = pad;
    if (hasPhoto) {
      out += `<image href="${escapeXml(card.front.photoUrl!)}" x="${photoX}" y="${photoY}" width="${photoSize}" height="${photoSize}" preserveAspectRatio="xMidYMid slice" clip-path="inset(0 round 6)"/>`;
    } else if (hasLogo) {
      if (logoBg !== 'none') {
        out += `<rect x="${photoX}" y="${photoY}" width="${photoSize}" height="${photoSize}" rx="6" fill="${escapeXml(logoBg)}"/>`;
      }
      const ls = Math.round(photoSize * 0.7);
      out += `<image href="${escapeXml(card.front.logoUrl!)}" x="${photoX + (photoSize - ls) / 2}" y="${photoY + (photoSize - ls) / 2}" width="${ls}" height="${ls}" preserveAspectRatio="xMidYMid meet"/>`;
    }
    const textX = photoX + photoSize + Math.round(pxW * 0.03);
    let textY = photoY + Math.round(photoSize * 0.18);
    const nameSize = fs(photoSize * 0.13, fontScale);
    const titleSize = fs(photoSize * 0.09, fontScale);
    const companySize = fs(photoSize * 0.075, fontScale);
    if (card.front.name) {
      out += `<text x="${textX}" y="${textY}" font-family="${fontFamily}" font-size="${nameSize}" font-weight="800" fill="${text}" letter-spacing="0.5">${escapeXml(card.front.name.toUpperCase())}</text>`;
      textY += nameSize * 1.2;
    }
    if (card.front.title) {
      out += `<text x="${textX}" y="${textY}" font-family="${fontFamily}" font-size="${titleSize}" font-weight="600" fill="${accent}">${escapeXml(card.front.title)}</text>`;
      textY += titleSize * 1.3;
    }
    if (card.front.company) {
      out += `<text x="${textX}" y="${textY}" font-family="${fontFamily}" font-size="${companySize}" font-weight="400" fill="${text}" opacity="0.78">${escapeXml(card.front.company)}</text>`;
    }
  }

  if (opts.includeDebugBoxes && card.grid) {
    out += buildGridDebugSvg(card.grid, pxW, pxH);
  }

  return out;
}
