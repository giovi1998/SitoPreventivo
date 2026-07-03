import type { BusinessCard } from '../documentSchemas';
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

  // Padding 4% of width
  const pad = Math.max(10, Math.round(pxW * 0.04));
  const stripW = Math.max(2, Math.round(pxW * 0.008));

  const frontLayout = card.front?.layout ?? 'left';
  const isLeft = frontLayout === 'left';
  const isSplit = frontLayout === 'split';
  const isCentered = frontLayout === 'centered';

  let out = '';

  // 1. Background
  out += `<rect width="${pxW}" height="${pxH}" fill="${bg}"/>`;

  // 2. Accent strip left
  if (card.style.borderStyle === 'accent-strip-left') {
    out += `<rect x="0" y="0" width="${stripW}" height="${pxH}" fill="${accent}"/>`;
  }
  // 3. Accent strip bottom
  if (card.style.borderStyle === 'accent-strip-bottom') {
    const stripH = Math.max(2, Math.round(pxH * 0.012));
    out += `<rect x="0" y="${pxH - stripH}" width="${pxW}" height="${stripH}" fill="${accent}"/>`;
  }

  // 4. Decorative diagonal pattern (top-right corner)
  const patternSize = Math.max(8, Math.round(pxW * 0.02));
  out += `<defs><pattern id="diag" patternUnits="userSpaceOnUse" width="${patternSize}" height="${patternSize}" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="${patternSize}" stroke="${accent}" stroke-width="0.6" opacity="0.06"/>
  </pattern></defs>`;
  out += `<rect x="${Math.round(pxW * 0.6)}" y="0" width="${Math.round(pxW * 0.4)}" height="${Math.round(pxH * 0.35)}" fill="url(#diag)"/>`;

  // 5. Photo or logo fallback
  const photoSize = Math.round(Math.min(pxW, pxH) * 0.4);
  const logoBg = card.front.logoBackground === 'card' ? bg : 'none';
  if (isLeft) {
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
    const textW = pxW - textX - pad;
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
    const divY = photoY + photoSize + Math.round(pxH * 0.04);
    out += `<line x1="${pad + stripW}" y1="${divY}" x2="${pxW - pad}" y2="${divY}" stroke="${accent}" stroke-width="1.2" opacity="0.85"/>`;
    const bottomY = divY + Math.round(pxH * 0.08);
    const website = card.back.website;
    const qrPayload = getEffectiveQrPayload(card);
    if (website && !qrPayload) {
      const hostname = deriveHostname(card);
      out += `<text x="${pxW / 2}" y="${bottomY}" font-family="Inter, system-ui, sans-serif" font-size="${Math.round(photoSize * 0.085)}" font-weight="500" fill="${text}" text-anchor="middle" opacity="0.6">${escapeXml(hostname)}</text>`;
    }
    if (hasLogo && hasPhoto) {
      const logoSize = Math.round(photoSize * 0.48);
      out += `<image href="${escapeXml(card.front.logoUrl!)}" x="${pxW - pad - logoSize}" y="${bottomY - logoSize}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`;
    }
  } else if (isSplit) {
    const leftW = Math.round(pxW * 0.42);
    out += `<rect x="0" y="0" width="${leftW}" height="${pxH}" fill="${accent}" opacity="0.08"/>`;
    if (hasPhoto) {
      out += `<image href="${escapeXml(card.front.photoUrl!)}" x="0" y="0" width="${leftW}" height="${pxH}" preserveAspectRatio="xMidYMid slice"/>`;
    } else if (hasLogo) {
      if (logoBg !== 'none') {
        out += `<rect x="0" y="0" width="${leftW}" height="${pxH}" fill="${escapeXml(logoBg)}"/>`;
      }
      const ls = Math.round(Math.min(leftW, pxH) * 0.6);
      out += `<image href="${escapeXml(card.front.logoUrl!)}" x="${(leftW - ls) / 2}" y="${(pxH - ls) / 2}" width="${ls}" height="${ls}" preserveAspectRatio="xMidYMid meet"/>`;
    }
    const textX = leftW + pad;
    let textY = pad + Math.round(pxH * 0.12);
    const nameSize = fs(pxH * 0.058, fontScale);
    const titleSize = fs(pxH * 0.042, fontScale);
    const companySize = fs(pxH * 0.038, fontScale);
    if (card.front.name) {
      out += `<text x="${textX}" y="${textY}" font-family="Inter, system-ui, sans-serif" font-size="${nameSize}" font-weight="800" fill="${text}" letter-spacing="0.5">${escapeXml(card.front.name.toUpperCase())}</text>`;
      textY += nameSize * 1.3;
    }
    if (card.front.title) {
      out += `<text x="${textX}" y="${textY}" font-family="Inter, system-ui, sans-serif" font-size="${titleSize}" font-weight="600" fill="${accent}">${escapeXml(card.front.title)}</text>`;
      textY += titleSize * 1.3;
    }
    if (card.front.company) {
      out += `<text x="${textX}" y="${textY}" font-family="Inter, system-ui, sans-serif" font-size="${companySize}" font-weight="400" fill="${text}" opacity="0.78">${escapeXml(card.front.company)}</text>`;
    }
    const divY = pxH - Math.round(pxH * 0.18);
    out += `<line x1="${textX}" y1="${divY}" x2="${pxW - pad}" y2="${divY}" stroke="${text}" stroke-width="0.5" stroke-dasharray="3,2" opacity="0.18"/>`;
    const logoSize = Math.round(pxH * 0.20);
    const logoY = pxH - pad - logoSize;
    if (hasLogo && hasPhoto) {
      out += `<image href="${escapeXml(card.front.logoUrl!)}" x="${textX}" y="${logoY}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`;
    }
  } else {
    // Centered layout
    let cursorY = pad + Math.round(pxH * 0.05);
    if (hasPhoto) {
      out += `<image href="${escapeXml(card.front.photoUrl!)}" x="${(pxW - photoSize) / 2}" y="${cursorY}" width="${photoSize}" height="${photoSize}" rx="${photoSize / 2}" ry="${photoSize / 2}" preserveAspectRatio="xMidYMid slice"/>`;
      cursorY += photoSize + Math.round(pxH * 0.04);
    } else if (hasLogo) {
      if (logoBg !== 'none') {
        out += `<rect x="${(pxW - photoSize) / 2}" y="${cursorY}" width="${photoSize}" height="${photoSize}" rx="${photoSize / 2}" fill="${escapeXml(logoBg)}"/>`;
      }
      const ls = Math.round(photoSize * 0.7);
      out += `<image href="${escapeXml(card.front.logoUrl!)}" x="${(pxW - ls) / 2}" y="${cursorY + (photoSize - ls) / 2}" width="${ls}" height="${ls}" preserveAspectRatio="xMidYMid meet"/>`;
      cursorY += photoSize + Math.round(pxH * 0.04);
    }
    const nameSize = fs(pxH * 0.09, fontScale);
    const titleSize = fs(pxH * 0.06, fontScale);
    const companySize = fs(pxH * 0.05, fontScale);
    if (card.front.name) {
      out += `<text x="${pxW / 2}" y="${cursorY + nameSize}" font-family="Inter, system-ui, sans-serif" font-size="${nameSize}" font-weight="800" fill="${text}" text-anchor="middle" letter-spacing="0.5">${escapeXml(card.front.name.toUpperCase())}</text>`;
      cursorY += nameSize * 1.3;
    }
    if (card.front.title) {
      out += `<text x="${pxW / 2}" y="${cursorY + titleSize}" font-family="Inter, system-ui, sans-serif" font-size="${titleSize}" font-weight="600" fill="${accent}" text-anchor="middle">${escapeXml(card.front.title)}</text>`;
      cursorY += titleSize * 1.3;
    }
    if (card.front.company) {
      out += `<text x="${pxW / 2}" y="${cursorY + companySize}" font-family="Inter, system-ui, sans-serif" font-size="${companySize}" font-weight="400" fill="${text}" text-anchor="middle" opacity="0.78">${escapeXml(card.front.company)}</text>`;
      cursorY += companySize * 1.4;
    }
    if (hasLogo && hasPhoto) {
      const logoSize = Math.round(pxH * 0.20);
      out += `<image href="${escapeXml(card.front.logoUrl!)}" x="${(pxW - logoSize) / 2}" y="${cursorY}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`;
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
  // Accent strip
  if (card.style.borderStyle === 'accent-strip-left') {
    out += `<rect x="0" y="0" width="${stripW}" height="${pxH}" fill="${accent}"/>`;
  }
  if (card.style.borderStyle === 'accent-strip-bottom') {
    const stripH = Math.max(2, Math.round(pxH * 0.012));
    out += `<rect x="0" y="${pxH - stripH}" width="${pxW}" height="${stripH}" fill="${accent}"/>`;
  }

  // Header
  if (headerWord) {
    const eyebrowSize = Math.round(pxH * 0.055);
    const wordmarkSize = Math.round(pxH * 0.052);
    out += `<text x="${pad + stripW}" y="${pad + eyebrowSize}" font-family="Inter, system-ui, sans-serif" font-size="${eyebrowSize}" font-weight="700" fill="${accent}" letter-spacing="2.5">CONTATTI</text>`;
    out += `<text x="${pxW - pad}" y="${pad + eyebrowSize}" font-family="Inter, system-ui, sans-serif" font-size="${wordmarkSize}" font-weight="600" fill="${accent}" text-anchor="end">${escapeXml(headerWord)}</text>`;
    const divY = pad + eyebrowSize + Math.round(pxH * 0.02);
    out += `<line x1="${pad + stripW}" y1="${divY}" x2="${pxW - pad}" y2="${divY}" stroke="${text}" stroke-width="0.4" stroke-dasharray="3,2" opacity="0.18"/>`;
  }

  // Contacts (left column). If QR is present, omit the WEB row.
  const contactsX = pad + stripW;
  const QR_PX_PCT_BY_ENUM: Record<'small' | 'medium' | 'large', number> = {
    small: 0.25,
    medium: 0.35,
    large: 0.50,
  };
  const qrSize = hasQr ? Math.round(pxH * (QR_PX_PCT_BY_ENUM[card.back.qrSize] ?? 0.35)) : 0;
  const qrX = hasQr ? pxW - pad - qrSize : 0;
  const qrY = hasQr ? Math.round((pxH - qrSize) / 2) : 0;
  const contactsW = hasQr
    ? Math.round(pxW * 0.52) - stripW
    : pxW - pad * 2 - stripW;

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
  if (card.back.website && !hasQr) {
    renderContact('Web', card.back.website, accent, true);
  }
  if (card.back.address) renderContact('Indirizzo', card.back.address);
  if (card.back.vatNumber) renderContact('P.IVA', card.back.vatNumber);

  // Services
  const services = (card.back.services ?? []).filter((s) => s.trim().length > 0);
  if (services.length > 0) {
    const servicesY = lineY + Math.round(pxH * 0.02);
    out += `<line x1="${contactsX}" y1="${servicesY - valSize * 0.2}" x2="${contactsX + contactsW}" y2="${servicesY - valSize * 0.2}" stroke="${accent}" stroke-width="0.3" stroke-dasharray="2,1.5" opacity="0.16"/>`;
    const servicesLabelText = (card.back.servicesLabel ?? '').trim();
    let cursorServices = servicesY;
    if (servicesLabelText) {
      const labelSize = Math.round(pxH * 0.030);
      out += `<text x="${contactsX}" y="${cursorServices + labelSize}" font-family="Inter, system-ui, sans-serif" font-size="${labelSize}" font-weight="700" fill="${accent}" letter-spacing="1.2" opacity="0.7">${escapeXml(servicesLabelText.toUpperCase())}</text>`;
      cursorServices += labelSize + Math.round(pxH * 0.012);
    }
    const hasLongService = services.some((s) => s.length >= 40);
    const svcSize = fs(pxH * 0.04, fontScale) * (hasLongService ? 0.85 : 1);
    const svcLineH = svcSize * 1.3;
    services.forEach((svc, idx) => {
      out += `<text x="${contactsX}" y="${cursorServices + (idx + 1) * svcLineH}" font-family="Inter, system-ui, sans-serif" font-size="${svcSize}" font-weight="700" fill="${accent}">· ${escapeXml(svc)}</text>`;
    });
    lineY = cursorServices + services.length * svcLineH;
  }

  // Socials
  if (socials.length > 0) {
    const socialsY = lineY + Math.round(pxH * 0.03);
    out += `<line x1="${contactsX}" y1="${socialsY - valSize}" x2="${contactsX + contactsW}" y2="${socialsY - valSize}" stroke="${text}" stroke-width="0.3" stroke-dasharray="2,1.5" opacity="0.14"/>`;
    const socialsText = socials
      .map((s) => {
        const handle = deriveHandle(s.url);
        const value = handle || s.url;
        return `${s.platform} · ${value}`;
      })
      .join(' · ');
    out += `<text x="${contactsX}" y="${socialsY + valSize * 0.3}" font-family="Inter, system-ui, sans-serif" font-size="${fs(pxH * 0.04, fontScale)}" font-weight="500" fill="${text}" opacity="0.78" font-style="italic">${escapeXml(socialsText)}</text>`;
  }

  // QR code
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
  }

  // QR label
  if (card.back.qrLabel && hasQr) {
    out += `<text x="${qrX + qrSize / 2}" y="${qrY + qrSize + Math.round(pxH * 0.035)}" font-family="Inter, system-ui, sans-serif" font-size="${Math.round(pxH * 0.034)}" font-weight="500" fill="${text}" text-anchor="middle" opacity="0.78">${escapeXml(card.back.qrLabel)}</text>`;
  }

  if (opts.includeDebugBoxes && card.backGrid) {
    out += buildGridDebugSvg(card.backGrid, pxW, pxH);
  }

  return out;
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
  const inner = side === 'front' ? buildFrontSvg(card, pxW, pxH, opts) : buildBackSvg(card, pxW, pxH, opts);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${pxW} ${pxH}" width="${pxW}" height="${pxH}">${inner}</svg>`;
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
