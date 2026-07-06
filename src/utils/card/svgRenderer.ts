import type { BusinessCard, CardGrid } from '../documentSchemas';
import { FONT_SCALE_MIN, FONT_SCALE_MAX, QR_SIZE_PX } from '../documentSchemas';
import { generateQrSvg } from '../qrGenerator';
import { resolveCardQrPayload, getEffectiveQrPayload } from './qrPayload';
import { deriveHostname, deriveHandle } from './textDerivation';

// Phase 2.2 REQ-D04: helper per scalare la dimensione del testo in base
// a `card.style.fontScale` (clamp 0.7-1.5, default 1). Da usare in tutti
// i `font-size="..."` del SVG export. Il `base` è la percentuale di `pxH`
// (o `photoSize`) da usare come base; il valore finale è arrotondato.
export function fs(base: number, fontScale: number): number {
  const f = typeof fontScale === 'number' && !Number.isNaN(fontScale) ? fontScale : 1;
  const clamped = Math.max(FONT_SCALE_MIN, Math.min(FONT_SCALE_MAX, f));
  return Math.max(1, Math.round(base * clamped));
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface BuildSvgOptions {
  withBleed?: boolean;
  includeDebugBoxes?: boolean;
  rotate?: 0 | 90 | 180 | 270;
}

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

  const pad = Math.max(10, Math.round(pxW * 0.04));
  const stripW = Math.max(2, Math.round(pxW * 0.008));

  let out = '';

  // 0. AI-generated cover image (full-bleed behind everything)
  if (card.front.coverImageUrl) {
    out += `<image href="${escapeXml(card.front.coverImageUrl)}" x="0" y="0" width="${pxW}" height="${pxH}" preserveAspectRatio="xMidYMid slice"/>`;
  }

  // 1. Background (only visible where cover image is missing or transparent)
  out += `<rect width="${pxW}" height="${pxH}" fill="${bg}"/>`;

  // 2. Corner radial gradient (matches CSS .card-corner-accent)
  const cornerSize = Math.round(Math.min(pxW, pxH) * 0.28);
  out += `<defs><radialGradient id="cornerGrad" cx="100%" cy="0%" r="80%">
    <stop offset="0%" stop-color="${accent}" stop-opacity="0.22"/>
    <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
  </radialGradient></defs>`;
  out += `<rect x="${pxW - cornerSize}" y="0" width="${cornerSize}" height="${cornerSize}" fill="url(#cornerGrad)"/>`;

  // 3. Accent strip left
  if (card.style.borderStyle === 'accent-strip-left') {
    out += `<rect x="0" y="0" width="${stripW}" height="${pxH}" fill="${accent}"/>`;
  }
  // 4. Accent strip bottom
  if (card.style.borderStyle === 'accent-strip-bottom') {
    const stripH = Math.max(2, Math.round(pxH * 0.012));
    out += `<rect x="0" y="${pxH - stripH}" width="${pxW}" height="${stripH}" fill="${accent}"/>`;
  }

  // 5. Decorative diagonal pattern (top-right corner)
  const patternSize = Math.max(8, Math.round(pxW * 0.02));
  out += `<defs><pattern id="diag" patternUnits="userSpaceOnUse" width="${patternSize}" height="${patternSize}" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="${patternSize}" stroke="${accent}" stroke-width="0.6" opacity="0.06"/>
  </pattern></defs>`;
  out += `<rect x="${Math.round(pxW * 0.6)}" y="0" width="${Math.round(pxW * 0.4)}" height="${Math.round(pxH * 0.35)}" fill="url(#diag)"/>`;

  // 6. Render front from card.grid (single source of truth)
  const grid = card.grid;
  if (grid && grid.cols > 0 && grid.rows > 0) {
    const cellW = pxW / grid.cols;
    const cellH = pxH / grid.rows;

    const photoEl = grid.elements.photo;
    if (hasPhoto && photoEl) {
      const x = photoEl.x * cellW;
      const y = photoEl.y * cellH;
      const w = photoEl.w * cellW;
      const h = photoEl.h * cellH;
      const isPhotoCircle = card.front.layout === 'photo-circle';
      if (isPhotoCircle) {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const r = Math.min(w, h) / 2;
        out += `<defs><clipPath id="photoCircle"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>`;
        out += `<image href="${escapeXml(card.front.photoUrl!)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#photoCircle)"/>`;
      } else {
        out += `<image href="${escapeXml(card.front.photoUrl!)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="inset(0 round 6)"/>`;
      }
    }

    const logoEl = grid.elements.logo;
    if (hasLogo && logoEl) {
      const x = logoEl.x * cellW;
      const y = logoEl.y * cellH;
      const w = logoEl.w * cellW;
      const h = logoEl.h * cellH;
      if (card.front.logoBackground === 'card') {
        out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${escapeXml(bg)}"/>`;
      }
      // Inset 8% for padding within the cell
      const inset = Math.min(w, h) * 0.08;
      out += `<image href="${escapeXml(card.front.logoUrl!)}" x="${x + inset}" y="${y + inset}" width="${w - inset * 2}" height="${h - inset * 2}" preserveAspectRatio="xMidYMid meet"/>`;
    }

    const textKeys: Array<keyof CardGrid['elements'] & ('name' | 'title' | 'company')> = ['name', 'title', 'company'];
    const textValues: Record<
      'name' | 'title' | 'company',
      { text: string; weight: number; color: string; letterSpacing: number; sizePct: number; opacity?: number }
    > = {
      name: { text: card.front.name.toUpperCase(), weight: 800, color: text, letterSpacing: 0.5, sizePct: 0.28 },
      title: { text: card.front.title, weight: 600, color: accent, letterSpacing: 0, sizePct: 0.21 },
      company: { text: card.front.company, weight: 400, color: text, letterSpacing: 0, sizePct: 0.18, opacity: 0.78 },
    };
    for (const key of textKeys) {
      const el = grid.elements[key];
      if (!el || !textValues[key].text) continue;
      const cfg = textValues[key];
      const x = el.x * cellW;
      const y = el.y * cellH;
      const w = el.w * cellW;
      const h = el.h * cellH;
      const alignH = el.alignH ?? 'center';
      const alignV = el.alignV ?? 'center';
      const fontSize = fs(h * cfg.sizePct, fontScale);
      const textX = alignH === 'left' ? x + pad * 0.5 : alignH === 'right' ? x + w - pad * 0.5 : x + w / 2;
      const textY = alignV === 'top'
        ? y + pad * 0.25
        : alignV === 'bottom'
          ? y + h - fontSize - pad * 0.25
          : y + (h - fontSize) / 2;
      const anchor = alignH === 'left' ? 'start' : alignH === 'right' ? 'end' : 'middle';
      const opacityAttr = cfg.opacity !== undefined ? ` opacity="${cfg.opacity}"` : '';
      const letterAttr = cfg.letterSpacing ? ` letter-spacing="${cfg.letterSpacing}"` : '';
      out += `<text x="${textX}" y="${textY}" font-family="Inter, system-ui, sans-serif" font-size="${fontSize}" font-weight="${cfg.weight}" fill="${cfg.color}" text-anchor="${anchor}" dominant-baseline="text-before-edge"${letterAttr}${opacityAttr}>${escapeXml(cfg.text)}</text>`;
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
      out += `<text x="${textX}" y="${textY}" font-family="Inter, system-ui, sans-serif" font-size="${nameSize}" font-weight="800" fill="${text}" letter-spacing="0.5">${escapeXml(card.front.name.toUpperCase())}</text>`;
      textY += nameSize * 1.2;
    }
    if (card.front.title) {
      out += `<text x="${textX}" y="${textY}" font-family="Inter, system-ui, sans-serif" font-size="${titleSize}" font-weight="600" fill="${accent}">${escapeXml(card.front.title)}</text>`;
      textY += titleSize * 1.3;
    }
    if (card.front.company) {
      out += `<text x="${textX}" y="${textY}" font-family="Inter, system-ui, sans-serif" font-size="${companySize}" font-weight="400" fill="${text}" opacity="0.78">${escapeXml(card.front.company)}</text>`;
    }
  }

  if (opts.includeDebugBoxes && card.grid) {
    out += buildGridDebugSvg(card.grid, pxW, pxH);
  }

  return out;
}

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
  const pad = Math.max(10, Math.round(pxW * 0.04));
  const fontScale = card.style.fontScale ?? 1;

  const hostname = deriveHostname(card);
  const headerWord = hostname || card.front.company || '';
  const socials = card.back.socials.filter((s) => s.platform && s.url);
  const qrPayload = getEffectiveQrPayload(card);
  const hasQr = !!qrPayload;

  let out = '';
  // Background
  out += `<rect width="${pxW}" height="${pxH}" fill="${bg}"/>`;
  // Corner radial gradient
  const cornerSize = Math.round(Math.min(pxW, pxH) * 0.28);
  out += `<defs><radialGradient id="backCornerGrad" cx="100%" cy="0%" r="80%">
    <stop offset="0%" stop-color="${accent}" stop-opacity="0.18"/>
    <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
  </radialGradient></defs>`;
  out += `<rect x="${pxW - cornerSize}" y="0" width="${cornerSize}" height="${cornerSize}" fill="url(#backCornerGrad)"/>`;
  // Accent strip
  if (card.style.borderStyle === 'accent-strip-left') {
    out += `<rect x="0" y="0" width="${stripW}" height="${pxH}" fill="${accent}"/>`;
  }
  if (card.style.borderStyle === 'accent-strip-bottom') {
    const stripH = Math.max(2, Math.round(pxH * 0.012));
    out += `<rect x="0" y="${pxH - stripH}" width="${pxW}" height="${stripH}" fill="${accent}"/>`;
  }

  // Header
  let headerH = 0;
  if (headerWord) {
    const eyebrowSize = fs(pxH * 0.055, fontScale);
    const wordmarkSize = fs(pxH * 0.052, fontScale);
    const headerTextH = Math.max(eyebrowSize, wordmarkSize);
    out += `<text x="${pad + stripW}" y="${pad + eyebrowSize}" font-family="Inter, system-ui, sans-serif" font-size="${eyebrowSize}" font-weight="700" fill="${accent}" letter-spacing="2.5">CONTATTI</text>`;
    out += `<text x="${pxW - pad}" y="${pad + eyebrowSize}" font-family="Inter, system-ui, sans-serif" font-size="${wordmarkSize}" font-weight="600" fill="${accent}" text-anchor="end">${escapeXml(headerWord)}</text>`;
    const divY = pad + headerTextH + Math.round(pxH * 0.02);
    out += `<line x1="${pad + stripW}" y1="${divY}" x2="${pxW - pad}" y2="${divY}" stroke="${text}" stroke-width="0.4" stroke-dasharray="3,2" opacity="0.18"/>`;
    // Reserve the same vertical space the preview uses for the header + divider + margin.
    headerH = divY + Math.round(pxH * 0.025);
  }
  const bodyTop = headerH;
  const bodyH = pxH - bodyTop;

  // Render back from card.backGrid (single source of truth)
  const grid = card.backGrid ?? card.grid;
  if (grid && grid.cols > 0 && grid.rows > 0) {
    const cellW = pxW / grid.cols;
    const cellH = bodyH / grid.rows;

    const contactsEl = grid.elements.contacts;
    if (contactsEl) {
      const cx = contactsEl.x * cellW + pad * 0.5;
      const cy = contactsEl.y * cellH + bodyTop + pad * 0.5;
      const cw = contactsEl.w * cellW - pad;
      const ch = contactsEl.h * cellH - pad;
      const keySize = fs(Math.min(cw, ch) * 0.09, fontScale);
      const valSize = fs(Math.min(cw, ch) * 0.12, fontScale);
      const lineGap = Math.max(keySize, valSize) * 1.25;
      let lineY = cy + keySize + pad * 0.25;
      // Empirical width for the uppercase bold label column.
      // Longest common labels: "INDIRIZZO" (~5.4*keySize), "TELEFONO" (~4.8*keySize).
      const colLabelW = Math.max(cw * 0.22, keySize * 6, pad * 1.5);
      const valueMaxW = Math.max(10, cw - colLabelW - pad * 0.5);
      const renderContact = (key: string, value: string, color: string = text, isAccent: boolean = false) => {
        const isWrap = key === 'Email' || key === 'Telefono';
        const wrapped = isWrap ? wrapTextAtWhitespace(value, valueMaxW, valSize) : [value];
        out += `<text x="${cx}" y="${lineY}" font-family="Inter, system-ui, sans-serif" font-size="${keySize}" font-weight="700" fill="${text}" opacity="0.55" letter-spacing="0.4" dominant-baseline="text-before-edge">${escapeXml(key.toUpperCase())}</text>`;
        const valueX = cx + colLabelW;
        wrapped.forEach((line) => {
          out += `<text x="${valueX}" y="${lineY}" font-family="Inter, system-ui, sans-serif" font-size="${valSize}" font-weight="500" fill="${isAccent ? accent : color}" dominant-baseline="text-before-edge">${escapeXml(line)}</text>`;
          lineY += lineGap;
        });
      };
      if (card.back.phone) renderContact('Telefono', card.back.phone);
      if (card.back.email) renderContact('Email', card.back.email);
      if (card.back.website && !hasQr) renderContact('Web', card.back.website, accent, true);
      if (card.back.address) renderContact('Indirizzo', card.back.address);
      if (card.back.vatNumber) renderContact('P.IVA', card.back.vatNumber);
    }

    // Services (separate grid element)
    const servicesEl = grid.elements.services;
    const services = (card.back.services ?? []).filter((s) => s.trim().length > 0);
    if (servicesEl && services.length > 0) {
      const sx = servicesEl.x * cellW + pad * 0.5;
      const sy = servicesEl.y * cellH + bodyTop + pad * 0.5;
      const sw = servicesEl.w * cellW - pad;
      const sh = servicesEl.h * cellH - pad;
      let svcY = sy + pad * 0.25;
      const servicesLabelText = (card.back.servicesLabel ?? '').trim();
      let labelSize = 0;
      if (servicesLabelText) {
        labelSize = fs(Math.min(sw, sh) * 0.18, fontScale);
        out += `<text x="${sx}" y="${svcY + labelSize}" font-family="Inter, system-ui, sans-serif" font-size="${labelSize}" font-weight="700" fill="${accent}" letter-spacing="1.2" opacity="0.7" dominant-baseline="text-before-edge">${escapeXml(servicesLabelText.toUpperCase())}</text>`;
        svcY += labelSize * 1.4;
      }
      const hasLongService = services.some((s) => s.length >= 40);
      let svcSize = fs(Math.min(sw, sh) * 0.2, fontScale) * (hasLongService ? 0.85 : 1);
      const svcLineH = (s: number) => s * 1.35;
      // Shrink services font until the whole list fits inside the cell height.
      const neededH = (s: number) => {
        const lineH = svcLineH(s);
        return (labelSize ? labelSize * 1.4 : 0) + services.length * lineH + pad * 0.5;
      };
      while (svcSize > 6 && neededH(svcSize) > sh) {
        svcSize *= 0.92;
      }
      const finalLineH = svcLineH(svcSize);
      services.forEach((svc, idx) => {
        out += `<text x="${sx}" y="${svcY + (idx + 1) * finalLineH}" font-family="Inter, system-ui, sans-serif" font-size="${svcSize}" font-weight="700" fill="${accent}" dominant-baseline="text-before-edge">· ${escapeXml(svc)}</text>`;
      });
    }

    const socialsEl = grid.elements.socials;
    if (socialsEl && socials.length > 0) {
      const sx = socialsEl.x * cellW + pad * 0.5;
      const sy = socialsEl.y * cellH + bodyTop + pad * 0.5;
      const sw = socialsEl.w * cellW - pad;
      const sh = socialsEl.h * cellH - pad;
      const socialsText = socials
        .map((s) => {
          const handle = deriveHandle(s.url);
          const value = handle || s.url;
          return `${s.platform} · ${value}`;
        })
        .join(' · ');
      let socialSize = fs(Math.min(sw, sh) * 0.22, fontScale);
      const socialLineH = (s: number) => s * 1.35;
      const neededSocialH = (s: number) => {
        const lines = wrapTextAtWhitespace(socialsText, Math.max(10, sw - pad * 0.5), s);
        return lines.length * socialLineH(s) + pad * 0.5;
      };
      while (socialSize > 6 && neededSocialH(socialSize) > sh) {
        socialSize *= 0.92;
      }
      const lines = wrapTextAtWhitespace(socialsText, Math.max(10, sw - pad * 0.5), socialSize);
      lines.forEach((line, idx) => {
        out += `<text x="${sx}" y="${sy + pad * 0.25 + (idx + 1) * socialLineH(socialSize)}" font-family="Inter, system-ui, sans-serif" font-size="${socialSize}" font-weight="500" fill="${text}" opacity="0.78" font-style="italic" dominant-baseline="text-before-edge">${escapeXml(line)}</text>`;
      });
    }

    const qrEl = grid.elements.qr;
    if (qrEl && hasQr) {
      // Phase 2.2 REQ-E02: in grid-mode la dimensione QR deriva dalla cella,
      // ma rispetta comunque `qrSize` (small/medium/large) come upper bound
      // per coerenza con la preview (CardPreview.tsx usa qrSizePxFor).
      // Mappa i px di QR_SIZE_PX (84/120/160) proporzionalmente alla carta:
      // la preview è ~340px di altezza per eu-85x55, qui pxH varia con DPI.
      const qrMaxPx = Math.round(pxH * (QR_SIZE_PX[card.back.qrSize] ?? QR_SIZE_PX.medium) / 340);
      const qx = qrEl.x * cellW + pad * 0.5;
      const qy = qrEl.y * cellH + bodyTop + pad * 0.5;
      const qw = qrEl.w * cellW - pad;
      const qh = qrEl.h * cellH - pad;
      const qrSize = Math.min(qw, qh, qrMaxPx);
      const qrX = qx + (qw - qrSize) / 2;
      const qrY = qy + (qh - qrSize) / 2;
      const qrObj: any = {
        documentType: 'qrCode',
        id: 'card-back',
        title: '',
        data: { type: 'url', payload: qrPayload },
        style: {
          errorCorrection: 'M',
          fgColor: '#000000',
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

      // QR label + wordmark below QR cell
      const belowY = qrY + qrSize + Math.round(cellH * 0.04);
      if (card.back.qrLabel) {
        const labelSize = fs(Math.min(qw, qh) * 0.08, fontScale);
        out += `<text x="${qx + qw / 2}" y="${belowY + labelSize}" font-family="Inter, system-ui, sans-serif" font-size="${labelSize}" font-weight="500" fill="${text}" text-anchor="middle" opacity="0.78">${escapeXml(card.back.qrLabel)}</text>`;
      }
      if (hostname) {
        const wordSize = fs(Math.min(qw, qh) * 0.07, fontScale);
        const wordY = belowY + (card.back.qrLabel ? fs(Math.min(qw, qh) * 0.18, fontScale) : wordSize);
        out += `<text x="${qx + qw / 2}" y="${wordY}" font-family="Inter, system-ui, sans-serif" font-size="${wordSize}" font-weight="600" fill="${accent}" text-anchor="middle">${escapeXml(hostname)}</text>`;
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
      out += `<text x="${contactsX}" y="${lineY}" font-family="Inter, system-ui, sans-serif" font-size="${keySize}" font-weight="700" fill="${text}" opacity="0.55" letter-spacing="0.4">${escapeXml(key.toUpperCase())}</text>`;
      out += `<text x="${contactsX + Math.round(contactsW * 0.22)}" y="${lineY}" font-family="Inter, system-ui, sans-serif" font-size="${valSize}" font-weight="500" fill="${isAccent ? accent : color}">${escapeXml(value)}</text>`;
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
          return `${s.platform} · ${value}`;
        })
        .join(' · ');
      out += `<text x="${contactsX}" y="${socialsY + valSize * 0.3}" font-family="Inter, system-ui, sans-serif" font-size="${fs(pxH * 0.04, fontScale)}" font-weight="500" fill="${text}" opacity="0.78" font-style="italic">${escapeXml(socialsText)}</text>`;
    }

    if (hasQr) {
      const qrObj: any = {
        documentType: 'qrCode',
        id: 'card-back',
        title: '',
        data: { type: 'url', payload: qrPayload },
        style: {
          errorCorrection: 'M',
          fgColor: '#000000',
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
      out += `<text x="${qrX + fallbackQrSize / 2}" y="${qrY + fallbackQrSize + Math.round(pxH * 0.035)}" font-family="Inter, system-ui, sans-serif" font-size="${Math.round(pxH * 0.034)}" font-weight="500" fill="${text}" text-anchor="middle" opacity="0.78">${escapeXml(card.back.qrLabel)}</text>`;
    }
  }

  if (opts.includeDebugBoxes && card.backGrid) {
    out += buildGridDebugSvg(card.backGrid, pxW, pxH);
  }

  return out;
}

// Width-aware wrap: split text at word boundaries (spaces/slashes)
// so long emails/URLs do not overflow cells. Does not break individual characters.
function wrapTextAtWhitespace(text: string, maxWidthPx: number, fontSize: number): string[] {
  if (!text) return [];
  const avgCharW = fontSize * 0.52;
  const measure = (s: string) => s.length * avgCharW;
  const tokens = text.split(/([/\s]+)/).filter((s) => s.length > 0);
  const lines: string[] = [];
  let current = '';
  const pushCurrent = () => {
    if (current) {
      lines.push(current.trim());
      current = '';
    }
  };
  for (const token of tokens) {
    const isSep = /^[/\s]+$/.test(token);
    if (isSep) {
      current += ' ';
      continue;
    }
    const candidate = current ? current + token : token;
    if (measure(candidate) <= maxWidthPx) {
      current = candidate;
    } else {
      pushCurrent();
      current = token;
    }
  }
  pushCurrent();
  return lines.length > 0 ? lines : [text];
}

/**
 * Build a standalone SVG representation of one side of the card at the given pixel dimensions.
 */
export function buildCardSvg(
  card: BusinessCard,
  side: 'front' | 'back',
  pxW: number,
  pxH: number,
  opts: BuildSvgOptions = {},
): string {
  const rotate = opts.rotate ?? 0;
  const inner = side === 'front' ? buildFrontSvg(card, pxW, pxH, opts) : buildBackSvg(card, pxW, pxH, opts);
  if (rotate === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${pxW} ${pxH}" width="${pxW}" height="${pxH}">${inner}</svg>`;
  }
  const outW = rotate === 90 || rotate === 270 ? pxH : pxW;
  const outH = rotate === 90 || rotate === 270 ? pxW : pxH;
  // Rotate around origin then translate so the content lands inside the
  // swapped viewBox. rotate(angle) in SVG (y-down, clockwise): 90° -> (x,y)->(-y,x),
  // so we translate by (+pxH, 0); 270° -> (x,y)->(y,-x), translate by (0, +pxW);
  // 180° -> (x,y)->(-x,-y), translate by (+pxW, +pxH).
  const tx = rotate === 90 ? pxH : rotate === 180 ? pxW : 0;
  const ty = rotate === 180 ? pxH : rotate === 270 ? pxW : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${outW} ${outH}" width="${outW}" height="${outH}"><g transform="translate(${tx} ${ty}) rotate(${rotate})">${inner}</g></svg>`;
}

export function extractQrInner(qrSvg: string): string {
  const m = qrSvg.match(/<svg[^\u003e]*>([\s\S]*)<\/svg>/);
  if (!m) return '';
  return m[1];
}

function buildGridDebugSvg(grid: NonNullable<BusinessCard['grid']>, pxW: number, pxH: number): string {
  const colors: Record<string, string> = {
    photo: '#ef4444',
    name: '#3b82f6',
    title: '#10b981',
    company: '#f59e0b',
    logo: '#8b5cf6',
    contacts: '#6366f1',
    qr: '#14b8a6',
    socials: '#f43f5e',
    services: '#a855f7',
  };
  const cellW = pxW / grid.cols;
  const cellH = pxH / grid.rows;
  let out = '';
  Object.entries(grid.elements).forEach(([key, el]) => {
    if (!el) return;
    const x = el.x * cellW;
    const y = el.y * cellH;
    const w = el.w * cellW;
    const h = el.h * cellH;
    const color = colors[key] || '#94a3b8';
    out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="2" opacity="0.7"/>`;
    out += `<text x="${x + 4}" y="${y + 14}" font-family="Inter, system-ui, sans-serif" font-size="10" fill="${color}" font-weight="700">${key}</text>`;
  });
  return out;
}
