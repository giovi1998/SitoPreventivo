import type { BusinessCard } from '../documentSchemas';
import { deriveGridFromLayout, hasGridElements } from '../documentSchemas';
import { generateQrSvg } from '../qrGenerator';
import { getEffectiveQrPayload } from './qrPayload';
import { deriveHostname, deriveHandle } from './textDerivation';
import {
  backPad,
  backHeaderMetrics,
  gridCellRect,
  gridCellBox,
  alignBoxInCell,
  backQrSizePx,
  effectiveBackGridForRender,
} from './backLayout';
import { CARD_REF } from './gridConstants';
import { renderDecorativePattern } from '../decorations/patterns';
import { escapeXml } from '../xml';
import {
  fs,
  svgFontFamily,
  wrapTextAtWhitespace,
  extractQrInner,
  buildGridDebugSvg,
  type BuildSvgOptions,
} from './svgShared';

export function buildBackSvg(
  card: BusinessCard,
  pxW: number,
  pxH: number,
  opts: BuildSvgOptions = {},
): string {
  const bg = card.style.bgColor;
  const text = card.style.textColor;
  const accent = card.style.accentColor;
  const stripW = Math.max(2, Math.round(pxW * 0.008));
  // v2.10: pad/header metrics shared with CardPreview CSS (hard WYSIWYG).
  const padBox = backPad(pxW, pxH);
  const pad = padBox.x; // legacy local name used in fallback layout below
  const fontScale = card.style.fontScale ?? 1;
  const fontFamily = svgFontFamily(card);

  const hostname = deriveHostname(card);
  const headerWord = hostname || card.front.company || '';
  const socials = card.back.socials.filter((s) => s.platform && s.url);
  const qrPayload = getEffectiveQrPayload(card);
  const hasQr = !!qrPayload;

  let out = '';
  // Background
  out += `<rect width="${pxW}" height="${pxH}" fill="${bg}"/>`;
  // Back cover image (full-bleed) with same readability wash as the front.
  if (card.back.coverImageUrl) {
    out += `<image href="${escapeXml(card.back.coverImageUrl)}" x="0" y="0" width="${pxW}" height="${pxH}" preserveAspectRatio="xMidYMid slice"/>`;
    out += `<rect width="${pxW}" height="${pxH}" fill="${bg}" opacity="0.35"/>`;
    out += `<defs><linearGradient id="backReadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${bg}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${bg}" stop-opacity="0.45"/>
    </linearGradient></defs>`;
    out += `<rect width="${pxW}" height="${pxH}" fill="url(#backReadGrad)"/>`;
  }
  // Decorative pattern (back)
  if (card.decorations?.pattern) {
    out += renderDecorativePattern(card.decorations.pattern, pxW, pxH, {
      palette: card.decorations.palette || { primary: accent, secondary: text },
      opacity: card.decorations.opacity ?? 0.2,
    });
  } else {
    // Corner radial gradient
    const cornerSize = Math.round(Math.min(pxW, pxH) * 0.28);
    out += `<defs><radialGradient id="backCornerGrad" cx="100%" cy="0%" r="80%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient></defs>`;
    out += `<rect x="${pxW - cornerSize}" y="0" width="${cornerSize}" height="${cornerSize}" fill="url(#backCornerGrad)"/>`;
  }
  // Accent strip
  if (card.style.borderStyle === 'accent-strip-left') {
    out += `<rect x="0" y="0" width="${stripW}" height="${pxH}" fill="${accent}"/>`;
  }
  if (card.style.borderStyle === 'accent-strip-bottom') {
    const stripH = Math.max(2, Math.round(pxH * 0.012));
    out += `<rect x="0" y="${pxH - stripH}" width="${pxW}" height="${stripH}" fill="${accent}"/>`;
  }

  // Header — v2.10: sizes from backHeaderMetrics (matches .card-back-header).
  let headerH = 0;
  const hasAnyContact = !!(card.back.phone || card.back.email || card.back.website || card.back.address || card.back.vatNumber);
  const headerMetrics = backHeaderMetrics(pxW, pxH, fontScale, padBox);
  if (hasAnyContact || headerWord) {
    const { eyebrowSize, wordmarkSize, textY, dividerY, headerX } = headerMetrics;
    out += `<text x="${headerX}" y="${textY}" font-family="${fontFamily}" font-size="${eyebrowSize}" font-weight="700" fill="${accent}" letter-spacing="2.5" dominant-baseline="alphabetic">CONTATTI</text>`;
    if (headerWord) {
      out += `<text x="${pxW - padBox.x}" y="${textY}" font-family="${fontFamily}" font-size="${wordmarkSize}" font-weight="600" fill="${accent}" text-anchor="end" dominant-baseline="alphabetic">${escapeXml(headerWord)}</text>`;
    }
    out += `<line x1="${headerX}" y1="${dividerY}" x2="${pxW - padBox.x}" y2="${dividerY}" stroke="${text}" stroke-width="0.4" stroke-dasharray="3,2" opacity="0.18"/>`;
    headerH = headerMetrics.bodyTop;
  }
  const bodyTop = headerH;
  const bodyH = pxH - bodyTop;

  // Render back from card.backGrid (single source of truth)
  // v2.8: when back.useGrid is false OR the persisted backGrid has no
  // usable elements, derive fresh from the default preset so the export
  // never goes blank.
  // v2.10: collapse empty services row so socials sit under contacts
  // (same density as preview when servicesContent is null).
  const useBackGrid = card.back.useGrid && hasGridElements('back', card);
  const persistedBackGrid = useBackGrid ? card.backGrid : undefined;
  const rawBackGrid = persistedBackGrid ?? (useBackGrid ? card.grid : undefined);
  const baseGrid = rawBackGrid ?? deriveGridFromLayout(card, 'back');
  const grid = baseGrid ? effectiveBackGridForRender(baseGrid, card) : baseGrid;
  if (grid && grid.cols > 0 && grid.rows > 0) {
    const cellW = pxW / grid.cols;
    const cellH = bodyH / grid.rows;

    const contactsEl = grid.elements.contacts;
    if (contactsEl) {
      // v2.10: cell rect from shared backLayout (matches preview padding).
      const cell = gridCellRect(contactsEl, cellW, cellH, bodyTop, padBox);
      // v2.17 (spec v2.0 REQ-ZOOM-003): nudge x/y with the same semantics as
      // the front texts (±half the cell dimension) + scale as a local
      // font-size factor. The hard clip below stays on the un-nudged cell.
      const contactsPlacement = contactsEl.placement ?? contactsEl.photoPlacement;
      const contactsScale = contactsPlacement?.scale ?? 1;
      const cx = cell.x + ((contactsPlacement?.x ?? 0) * cell.w) / 2;
      const cy = cell.y + ((contactsPlacement?.y ?? 0) * cell.h) / 2;
      const cw = cell.w;
      const ch = cell.h;
      const contactEntries: Array<{ key: string; value: string; color?: string; isAccent?: boolean }> = [];
      if (card.back.phone) contactEntries.push({ key: 'Telefono', value: card.back.phone });
      if (card.back.email) contactEntries.push({ key: 'Email', value: card.back.email });
      if (card.back.website && !hasQr) contactEntries.push({ key: 'Web', value: card.back.website, color: accent, isAccent: true });
      if (card.back.address) contactEntries.push({ key: 'Indirizzo', value: card.back.address });
      if (card.back.vatNumber) contactEntries.push({ key: 'P.IVA', value: card.back.vatNumber });

      // v2.10.1: size fonts vs CARD height (pxH), matching CSS rem on the
      // unified 640×414 reference (CARD_REF, gridConstants). Sizing vs
      // min(cw,ch) blew up at export DPI (cell ~300px → 48px labels).
      // v2.18: print-minimum sizes — key 1rem=16px, val 1.1875rem=19px
      // logical (≥6pt/7pt on 55mm print height).
      let keySize = fs(pxH * (16 / CARD_REF.h), fontScale) * contactsScale;
      let valSize = fs(pxH * (19 / CARD_REF.h), fontScale) * contactsScale;
      const wrappableKeys = new Set(['Email', 'Telefono']);
      // Label column = longest key glyph width + gap (never overlaps value).
      // "TELEFONO" ≈ 8 chars; uppercase sans ≈ 0.62em per char + letter-spacing.
      const longestKey = contactEntries.reduce((n, e) => Math.max(n, e.key.length), 1);
      const colLabelWFor = (ks: number) => {
        const textW = ks * longestKey * 0.62 + ks * 0.4; // letter-spacing budget
        const gap = Math.max(8, ks * 0.5);
        return Math.min(cw * 0.42, textW + gap);
      };
      const lineGapFor = (ks: number, vs: number) => Math.max(ks, vs) * 1.35;
      const linesFor = (vs: number, ks: number) => {
        const colLabelW = colLabelWFor(ks);
        const valueMaxW = Math.max(10, cw - colLabelW - pad * 0.5);
        return contactEntries.reduce((total, entry) => {
          const wrapped = wrappableKeys.has(entry.key)
            ? wrapTextAtWhitespace(entry.value, valueMaxW, vs, fontFamily)
            : [entry.value];
          return total + wrapped.length;
        }, 0);
      };
      const neededHeight = (ks: number, vs: number) => {
        const lines = Math.max(1, linesFor(vs, ks));
        return ks + pad * 0.25 + lines * lineGapFor(ks, vs);
      };
      // v2.18: shrink floors are fractions of CARD_REF.h (DPI-independent),
      // never absolute export px — an absolute floor produced ~2pt text at
      // 300dpi. key floor 16/414, val floor 19/414 (print minimums).
      const keyFloorPx = pxH * (16 / CARD_REF.h);
      const valFloorPx = pxH * (19 / CARD_REF.h);
      while (neededHeight(keySize, valSize) > ch && keySize > keyFloorPx && valSize > valFloorPx) {
        const nextKey = keySize * 0.9;
        const nextVal = valSize * 0.9;
        if (nextKey < keyFloorPx || nextVal < valFloorPx) break;
        keySize = nextKey;
        valSize = nextVal;
      }

      const contactsAlignH = contactsEl.alignH ?? 'left';
      const contactsAlignV = contactsEl.alignV ?? 'top';
      const lineGap = lineGapFor(keySize, valSize);
      // v2.9: allinea label e valore sulla stessa baseline alfabetica, come
      // la preview React (.card-back-line { align-items: baseline }). Prima
      // usavamo text-before-edge su entrambi: label e valore venivano
      // top-aligned ma, essendo il valore più grande, la sua baseline era
      // più bassa e i due testi apparivano "sminchiati" (label galleggiante
      // sopra il valore). Ora calcoliamo un'unica baseline condivisa e usiamo
      // dominant-baseline="alphabetic" su entrambi i <text>.
      const valAscent = Math.round(valSize * 0.8);
      const contentH = contactEntries.length * lineGap + pad * 0.25;
      let startY = cy + valAscent + pad * 0.25;
      if (contactsAlignV === 'center') startY = cy + (ch - contentH) / 2 + valAscent + pad * 0.25;
      else if (contactsAlignV === 'bottom') startY = cy + ch - contentH + valAscent + pad * 0.25;
      let lineY = startY;
      const colLabelW = colLabelWFor(keySize);
      const valueMaxW = Math.max(10, cw - colLabelW - pad * 0.5);
      const labelAnchor = contactsAlignH === 'right' ? 'end' : contactsAlignH === 'center' ? 'middle' : 'start';
      const valueAnchor = contactsAlignH === 'right' ? 'end' : contactsAlignH === 'center' ? 'middle' : 'start';
      const labelX = contactsAlignH === 'right'
        ? cx + cw - colLabelW
        : contactsAlignH === 'center'
          ? cx + (cw - colLabelW) / 2
          : cx;
      const valueXBase = contactsAlignH === 'right'
        ? cx + cw
        : contactsAlignH === 'center'
          ? cx + cw / 2 + colLabelW / 2
          : cx + colLabelW;
      // v2.13: hard clip — text must NEVER paint outside the contacts cell.
      const contactsClipId = `clipContacts${contactsEl.x}${contactsEl.y}${contactsEl.w}${contactsEl.h}`;
      const contactsBox = gridCellBox(contactsEl, cellW, cellH, bodyTop);
      out += `<defs><clipPath id="${contactsClipId}"><rect x="${contactsBox.x}" y="${contactsBox.y}" width="${contactsBox.w}" height="${contactsBox.h}"/></clipPath></defs>`;
      out += `<g clip-path="url(#${contactsClipId})">`;
      const renderContact = (entry: { key: string; value: string; color?: string; isAccent?: boolean }) => {
        // Always wrap values to valueMaxW (not only email/phone) so long
        // strings never spill past the cell even without clip.
        const wrapped = wrapTextAtWhitespace(entry.value, valueMaxW, valSize, fontFamily);
        out += `<text x="${labelX}" y="${lineY}" font-family="${fontFamily}" font-size="${keySize}" font-weight="700" fill="${text}" opacity="0.55" letter-spacing="0.4" text-anchor="${labelAnchor}" dominant-baseline="alphabetic">${escapeXml(entry.key.toUpperCase())}</text>`;
        wrapped.forEach((line) => {
          out += `<text x="${valueXBase}" y="${lineY}" font-family="${fontFamily}" font-size="${valSize}" font-weight="500" fill="${entry.isAccent ? accent : (entry.color ?? text)}" text-anchor="${valueAnchor}" dominant-baseline="alphabetic">${escapeXml(line)}</text>`;
          lineY += lineGap;
        });
      };
      contactEntries.forEach(renderContact);
      // Fallback: no dedicated socials cell → socials inside contacts, CLIPPED.
      if (!grid.elements.socials && socials.length > 0) {
        const socialsText = socials
          .map((s) => {
            const handle = deriveHandle(s.url);
            const value = handle || s.url;
            return `${s.platform} ${value}`;
          })
          .join('   ');
        // Size vs card height (same as dedicated socials cell), then wrap.
        let socialSize = fs(pxH * (16 / CARD_REF.h), fontScale) * contactsScale;
        const socialLineH = (s: number) => s * 1.35;
        const remainH = Math.max(8, cy + ch - lineY - pad * 0.25);
        // v2.18: fractional floor (16/414 of pxH) instead of absolute 6px.
        const socialFloorPx = pxH * (16 / CARD_REF.h);
        while (socialSize > socialFloorPx && wrapTextAtWhitespace(socialsText, cw, socialSize, fontFamily).length * socialLineH(socialSize) > remainH) {
          socialSize *= 0.9;
        }
        const lines = wrapTextAtWhitespace(socialsText, cw, socialSize, fontFamily);
        let sy = lineY + Math.round(socialSize * 0.4);
        lines.forEach((line) => {
          if (sy > cy + ch) return;
          out += `<text x="${cx}" y="${sy}" font-family="${fontFamily}" font-size="${socialSize}" font-weight="500" fill="${text}" opacity="0.78" font-style="italic" dominant-baseline="text-before-edge">${escapeXml(line)}</text>`;
          sy += socialLineH(socialSize);
        });
      }
      out += '</g>';
    }

    // Services (separate grid element)
    let services = (card.back.services ?? []).filter((s) => s.trim().length > 0);
    let servicesEl = grid.elements.services;
    const socialsEl = grid.elements.socials;
    // v2.9.1: mirror CardPreview.tsx expansion — when socials are empty, let
    // services expand into the unused socials row so the left column doesn't
    // leave an empty gap. We create a temporary merged rect for rendering only.
    let servicesRenderEl = servicesEl;
    // Parity fix: expand when socials CONTENT is empty (the preview checks
    // socials.length, not just the grid element), reusing the socials
    // element height when present instead of a hardcoded +1.
    if (services.length > 0 && socials.length === 0 && servicesEl) {
      const emptySocialsH = socialsEl?.h ?? 1;
      servicesRenderEl = { ...servicesEl, h: servicesEl.h + emptySocialsH };
    }
    if (servicesRenderEl && services.length > 0) {
      const svcCell = gridCellRect(servicesRenderEl, cellW, cellH, bodyTop, padBox);
      // v2.17 (REQ-ZOOM-003): nudge/scale applied to the effective render
      // cell (including the socials-row expansion above), same semantics
      // as the front texts. The clip below stays on the un-nudged cell.
      const svcPlacement = servicesRenderEl.placement ?? servicesRenderEl.photoPlacement;
      const svcScale = svcPlacement?.scale ?? 1;
      const sx = svcCell.x + ((svcPlacement?.x ?? 0) * svcCell.w) / 2;
      const sy = svcCell.y + ((svcPlacement?.y ?? 0) * svcCell.h) / 2;
      const sw = svcCell.w;
      const sh = svcCell.h;
      const servicesAlignH = servicesRenderEl.alignH ?? 'left';
      const servicesAlignV = servicesRenderEl.alignV ?? 'top';
      let svcY = sy + padBox.cellY * 0.25;
      const servicesLabelText = (card.back.servicesLabel ?? '').trim();
      let labelSize = 0;
      if (servicesLabelText) {
        // v2.19: preview grid-mode 0.85rem = 13.6px (floor leggibilita').
        labelSize = fs(pxH * (13.6 / CARD_REF.h), fontScale) * svcScale;
        svcY += labelSize * 1.1;
      }
      const hasLongService = services.some((s) => s.length >= 40);
      // v2.19: preview grid-mode 1rem = 16px (floor leggibilita' ~6pt).
      let svcSize = fs(pxH * (16 / CARD_REF.h), fontScale) * (hasLongService ? 0.85 : 1) * svcScale;
      // v2.5.1: tighter line-height (1.2 instead of 1.35) so 2-3
      // services + label fit a 1-row cell without shrinking too much.
      const svcLineH = (s: number) => s * 1.2;
      // Shrink services font until the whole list fits inside the cell height.
      const neededH = (s: number) => {
        const lineH = svcLineH(s);
        return (labelSize ? labelSize * 1.3 : 0) + services.length * lineH + pad * 0.5;
      };
      // v2.18: floor is now a fraction of the unified reference (19/414 of
      // pxH) instead of absolute 14px — DPI-independent, so print size never
      // collapses toward ~2pt at high DPI. The floor sits above the base
      // size, so overflow is handled by the clip below, not by shrinking.
      const svcFloorPx = pxH * (19 / CARD_REF.h);
      while (svcSize > svcFloorPx && neededH(svcSize) > sh) {
        svcSize *= 0.92;
      }
      const blockH = (labelSize ? labelSize * 1.3 : 0) + services.length * svcLineH(svcSize) + pad * 0.5;
      let startY = svcY;
      if (servicesAlignV === 'center') startY = sy + (sh - blockH) / 2;
      else if (servicesAlignV === 'bottom') startY = sy + sh - blockH;
      const textAnchor = servicesAlignH === 'right' ? 'end' : servicesAlignH === 'center' ? 'middle' : 'start';
      const textX = servicesAlignH === 'right'
        ? sx + sw - padBox.cellX * 0.5
        : servicesAlignH === 'center'
          ? sx + sw / 2
          : sx;
      let labelY = startY;
      if (servicesLabelText) {
        out += `<text x="${textX}" y="${labelY}" font-family="${fontFamily}" font-size="${labelSize}" font-weight="700" fill="${accent}" letter-spacing="1.2" opacity="0.7" text-anchor="${textAnchor}" dominant-baseline="text-before-edge">${escapeXml(servicesLabelText.toUpperCase())}</text>`;
        labelY += labelSize * 1.3;
      }
      const finalLineH = svcLineH(svcSize);
      const svcClipId = `clipServices${servicesRenderEl.x}${servicesRenderEl.y}${servicesRenderEl.w}${servicesRenderEl.h}`;
      const svcBox = gridCellBox(servicesRenderEl, cellW, cellH, bodyTop);
      out += `<defs><clipPath id="${svcClipId}"><rect x="${svcBox.x}" y="${svcBox.y}" width="${svcBox.w}" height="${svcBox.h}"/></clipPath></defs>`;
      out += `<g clip-path="url(#${svcClipId})">`;
      services.forEach((svc, idx) => {
        out += `<text x="${textX}" y="${labelY + idx * finalLineH}" font-family="${fontFamily}" font-size="${svcSize}" font-weight="800" fill="${accent}" text-anchor="${textAnchor}" dominant-baseline="text-before-edge">· ${escapeXml(svc)}</text>`;
      });
      out += '</g>';
    }

    if (services.length > 0 && !servicesEl && !socialsEl && contactsEl) {
      // v2.9.1: no services/socials cells at all but services exist (legacy
      // grid created before services were added). Render them in the contacts
      // fallback area, below the contacts text.
      // This branch is reached only when the persisted grid has no services
      // element and the user has added services; we avoid losing them.
      // (mirrors CardPreview.tsx fallback {!grid.elements.services && servicesContent}).
      const fallbackEl = contactsEl;
      const fx = fallbackEl.x * cellW + pad * 0.5;
      const fy = fallbackEl.y * cellH + bodyTop + pad * 0.5 + contactsEl.h * cellH;
      const fw = fallbackEl.w * cellW - pad;
      const fh = (grid.rows - fallbackEl.y - fallbackEl.h) * cellH - pad;
      if (fh > 20) {
        const servicesLabelText = (card.back.servicesLabel ?? '').trim();
        let labelSize = 0;
        let svcY = fy;
        if (servicesLabelText) {
          labelSize = fs(Math.min(fw, fh) * 0.18, fontScale);
          out += `<text x="${fx}" y="${svcY + labelSize}" font-family="${fontFamily}" font-size="${labelSize}" font-weight="700" fill="${accent}" letter-spacing="1.2" opacity="0.7" dominant-baseline="text-before-edge">${escapeXml(servicesLabelText.toUpperCase())}</text>`;
          svcY += labelSize * 1.4;
        }
        let svcSize = fs(Math.min(fw, fh) * 0.2, fontScale);
        const svcLineH = (s: number) => s * 1.2;
        const neededH = (s: number) => (labelSize ? labelSize * 1.4 : 0) + services.length * svcLineH(s) + pad * 0.5;
        const svcFloorPx = pxH * (19 / CARD_REF.h);
        while (svcSize > svcFloorPx && neededH(svcSize) > fh) svcSize *= 0.92;
        services.forEach((svc, idx) => {
          out += `<text x="${fx}" y="${svcY + (idx + 1) * svcLineH(svcSize)}" font-family="${fontFamily}" font-size="${svcSize}" font-weight="800" fill="${accent}" dominant-baseline="text-before-edge">· ${escapeXml(svc)}</text>`;
        });
      }
    }

    if (socialsEl && socials.length > 0) {
      // Full cell box (same coordinate system as preview CSS grid).
      const box = gridCellBox(socialsEl, cellW, cellH, bodyTop);
      const cellX = box.x;
      const cellY = box.y;
      const cellBoxW = box.w;
      const cellBoxH = box.h;
      // v2.17 (REQ-ZOOM-003): nudge x/y (±half the cell dimension, same as
      // front texts) + scale as a local font-size factor. The clip path
      // stays on the un-nudged cell box.
      const socialsPlacement = socialsEl.placement ?? socialsEl.photoPlacement;
      const socialsScale = socialsPlacement?.scale ?? 1;
      const socialsNudgeX = ((socialsPlacement?.x ?? 0) * cellBoxW) / 2;
      const socialsNudgeY = ((socialsPlacement?.y ?? 0) * cellBoxH) / 2;
      const innerPad = padBox.cellX * 0.5;
      const sx = cellX + innerPad + socialsNudgeX;
      const sw = Math.max(10, cellBoxW - innerPad * 2);
      const sh = Math.max(10, cellBoxH - innerPad * 2);
      const socialsText = socials
        .map((s) => {
          const handle = deriveHandle(s.url);
          const value = handle || s.url;
          return `${s.platform} ${value}`;
        })
        .join('   ');
      // v2.19: preview grid-mode 1rem = 16px (floor leggibilita' ~6pt).
      let socialSize = fs(pxH * (16 / CARD_REF.h), fontScale) * socialsScale;
      const socialLineH = (s: number) => s * 1.35;
      const neededSocialH = (s: number) => {
        const lines = wrapTextAtWhitespace(socialsText, sw, s, fontFamily);
        return lines.length * socialLineH(s);
      };
      // v2.18: fractional floor (16/414 of pxH) instead of absolute 6px.
      const socialFloorPx = pxH * (16 / CARD_REF.h);
      while (socialSize > socialFloorPx && neededSocialH(socialSize) > sh) {
        socialSize *= 0.92;
      }
      const lines = wrapTextAtWhitespace(socialsText, sw, socialSize, fontFamily);
      const blockH = lines.length * socialLineH(socialSize);
      const alignV = socialsEl.alignV ?? 'top';
      const alignH = socialsEl.alignH ?? 'left';
      let startY = cellY + innerPad + socialsNudgeY;
      if (alignV === 'center') startY = cellY + (cellBoxH - blockH) / 2 + socialsNudgeY;
      else if (alignV === 'bottom') startY = cellY + cellBoxH - blockH - innerPad + socialsNudgeY;
      const anchor = alignH === 'right' ? 'end' : alignH === 'center' ? 'middle' : 'start';
      const textX = alignH === 'right'
        ? cellX + cellBoxW - innerPad + socialsNudgeX
        : alignH === 'center'
          ? cellX + cellBoxW / 2 + socialsNudgeX
          : sx;
      const clipId = `clipSocials${socialsEl.x}${socialsEl.y}${socialsEl.w}${socialsEl.h}`;
      out += `<defs><clipPath id="${clipId}"><rect x="${cellX}" y="${cellY}" width="${cellBoxW}" height="${cellBoxH}"/></clipPath></defs>`;
      out += `<g clip-path="url(#${clipId})">`;
      lines.forEach((line, idx) => {
        const lineY = startY + idx * socialLineH(socialSize);
        out += `<text x="${textX}" y="${lineY}" font-family="${fontFamily}" font-size="${socialSize}" font-weight="500" fill="${text}" opacity="0.78" font-style="italic" text-anchor="${anchor}" dominant-baseline="text-before-edge">${escapeXml(line)}</text>`;
      });
      out += '</g>';
    }

    const qrEl = grid.elements.qr;
    if (qrEl && hasQr) {
      // v2.10: QR size from shared backQrSizePx (same scale as preview CSS
      // --card-qr-size / PREVIEW_REF_H). Cell rect + align from backLayout.
      const qrCell = gridCellRect(qrEl, cellW, cellH, bodyTop, padBox);
      const qx = qrCell.x;
      const qy = qrCell.y;
      const qw = qrCell.w;
      const qh = qrCell.h;
      const qrAlignH = qrEl.alignH ?? 'center';
      const qrAlignV = qrEl.alignV ?? 'center';
      // v2.15: reserve space for qrLabel under the QR using the same
      // proportion as the preview (labelSize ~9.6px + 8px gap on the 414px ref).
      const labelReserve = card.back.qrLabel ? Math.max(20, Math.round(pxH * (18 / CARD_REF.h))) : 0;
      const qrSize = backQrSizePx(card, qw, qh - labelReserve, pxH);
      // v2.15: apply QR nudge/scale from generic placement, mirroring photo
      // placement behavior inside the cell.
      const qrPlacement = qrEl.placement ?? qrEl.photoPlacement;
      const qrScale = qrPlacement?.scale ?? 1;
      const scaledQrSize = Math.min(qrSize * qrScale, Math.min(qw, qh - labelReserve));
      const qrDx = ((qrPlacement?.x ?? 0) * qw) / 2;
      const qrDy = ((qrPlacement?.y ?? 0) * (qh - labelReserve)) / 2;
      const pos = alignBoxInCell(
        { x: qx, y: qy, w: qw, h: qh - labelReserve },
        scaledQrSize,
        scaledQrSize,
        qrAlignH,
        qrAlignV,
      );
      const qrX = pos.x + qrDx;
      const qrY = pos.y + qrDy;
      const qrObj: any = {
        documentType: 'qrCode',
        id: 'card-back',
        title: '',
        data: { type: 'url', payload: qrPayload },
        style: {
          errorCorrection: 'M',
          fgColor: card.style.textColor,
          bgColor: '#FFFFFF',
          size: qrSize * 2,
          margin: 1,
          logoOverlay: null,
          dotStyle: 'square',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const qrSvg = generateQrSvg(qrObj);
      out += `<rect x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" fill="#FFFFFF" stroke="${accent}" stroke-width="2"/>`;
      const viewBoxMatch = qrSvg.match(/viewBox="0 0 (\d+) (\d+)"/);
      const totalSize = viewBoxMatch ? parseInt(viewBoxMatch[1], 10) : qrSize;
      const innerScale = (qrSize - 8) / totalSize;
      out += `<g transform="translate(${qrX + 4} ${qrY + 4}) scale(${innerScale})">${extractQrInner(qrSvg)}</g>`;

      // v2.15: QR label size matches preview grid-mode 0.6rem=9.6px on
      // the 414px-tall reference (CARD_REF.h), so the label stays
      // proportional to the card instead of blowing up with the QR cell.
      if (card.back.qrLabel) {
        const labelSize = fs(pxH * (9.6 / CARD_REF.h), fontScale);
        const belowY = qrY + qrSize + Math.round(labelSize * 0.4);
        out += `<text x="${qx + qw / 2}" y="${belowY + labelSize}" font-family="${fontFamily}" font-size="${labelSize}" font-weight="500" fill="${text}" text-anchor="middle" opacity="0.78">${escapeXml(card.back.qrLabel)}</text>`;
      }
    }
  }

  // Fallback layout if backGrid missing: sensible default so export never empty
  const gridMissing = !card.backGrid || Object.keys(card.backGrid.elements).length === 0;
  if (gridMissing) {
    const contactsX = pad + stripW;
    const QR_PX_PCT_BY_ENUM: Record<'small' | 'medium' | 'large', number> = {
      small: 0.25,
      medium: 0.35,
      large: 0.50,
    };
    const fallbackQrSize = hasQr ? Math.round(pxH * (QR_PX_PCT_BY_ENUM[card.back.qrSize] ?? 0.35)) : 0;
    const qrX = hasQr ? pxW - pad - fallbackQrSize : 0;
    const qrY = hasQr ? Math.round((pxH - fallbackQrSize) / 2) : 0;
    const contactsW = hasQr ? Math.round(pxW * 0.52) - stripW : pxW - pad * 2 - stripW;

    const keySize = fs(pxH * 0.034, fontScale);
    const valSize = fs(pxH * 0.046, fontScale);
    let lineY = hasQr ? qrY - Math.round(pxH * 0.02) : pad + Math.round(pxH * 0.08);
    const lineGap = valSize * 1.35;
    const renderContact = (key: string, value: string, color: string = text, isAccent: boolean = false) => {
      out += `<text x="${contactsX}" y="${lineY}" font-family="${fontFamily}" font-size="${keySize}" font-weight="700" fill="${text}" opacity="0.55" letter-spacing="0.4">${escapeXml(key.toUpperCase())}</text>`;
      out += `<text x="${contactsX + Math.round(contactsW * 0.22)}" y="${lineY}" font-family="${fontFamily}" font-size="${valSize}" font-weight="500" fill="${isAccent ? accent : color}">${escapeXml(value)}</text>`;
      lineY += lineGap;
    };
    if (card.back.phone) renderContact('Telefono', card.back.phone);
    if (card.back.email) renderContact('Email', card.back.email);
    if (card.back.website && !hasQr) renderContact('Web', card.back.website, accent, true);
    if (card.back.address) renderContact('Indirizzo', card.back.address);
    if (card.back.vatNumber) renderContact('P.IVA', card.back.vatNumber);

    if (socials.length > 0) {
      const socialsY = lineY + Math.round(pxH * 0.03);
      const socialsText = socials
        .map((s) => {
          const handle = deriveHandle(s.url);
          const value = handle || s.url;
          return `${s.platform} ${value}`;
        })
        .join('   ');
      out += `<text x="${contactsX}" y="${socialsY + valSize * 0.3}" font-family="${fontFamily}" font-size="${fs(pxH * 0.04, fontScale)}" font-weight="500" fill="${text}" opacity="0.78" font-style="italic">${escapeXml(socialsText)}</text>`;
    }

    if (hasQr) {
      const qrObj: any = {
        documentType: 'qrCode',
        id: 'card-back',
        title: '',
        data: { type: 'url', payload: qrPayload },
        style: {
          errorCorrection: 'M',
          fgColor: card.style.textColor,
          bgColor: '#FFFFFF',
          size: fallbackQrSize * 2,
          margin: 1,
          logoOverlay: null,
          dotStyle: 'square',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const qrSvg = generateQrSvg(qrObj);
      out += `<rect x="${qrX}" y="${qrY}" width="${fallbackQrSize}" height="${fallbackQrSize}" fill="#FFFFFF" stroke="${accent}" stroke-width="2"/>`;
      const viewBoxMatch = qrSvg.match(/viewBox="0 0 (\d+) (\d+)"/);
      const totalSize = viewBoxMatch ? parseInt(viewBoxMatch[1], 10) : fallbackQrSize;
      const innerScale = (fallbackQrSize - 8) / totalSize;
      out += `<g transform="translate(${qrX + 4} ${qrY + 4}) scale(${innerScale})">${extractQrInner(qrSvg)}</g>`;
    }
    if (card.back.qrLabel && hasQr) {
      out += `<text x="${qrX + fallbackQrSize / 2}" y="${qrY + fallbackQrSize + Math.round(pxH * 0.035)}" font-family="${fontFamily}" font-size="${Math.round(pxH * 0.034)}" font-weight="500" fill="${text}" text-anchor="middle" opacity="0.78">${escapeXml(card.back.qrLabel)}</text>`;
    }
  }

  if (opts.includeDebugBoxes && card.backGrid) {
    out += buildGridDebugSvg(card.backGrid, pxW, pxH);
  }

  return out;
}
