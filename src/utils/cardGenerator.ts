import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { BusinessCard, BusinessCardSizePreset } from './documentSchemas';
import { SIZE_PRESETS_MM, BLEED_MM, CARD_A4_COLS, CARD_A4_ROWS, CARD_A4_GAP_MM, CARD_A4_MARGIN_MM } from './documentSchemas';
import { generateQrSvg, isHttpUrl } from './qrGenerator';
import { isAllowedLogoMime } from './qrGenerator';
import { applyWatermarkToPdf, applyWatermarkToCanvas, type Tier } from './watermark';

pdfMake.vfs = pdfFonts;

type Content = any;
type TDocumentDefinitions = any;

export {
  SIZE_PRESETS_MM,
  BLEED_MM,
  CARD_A4_COLS,
  CARD_A4_ROWS,
  CARD_A4_GAP_MM,
  CARD_A4_MARGIN_MM,
};

const MAX_RAW_BYTES = 5_000_000;
const MAX_DIMENSION = 4000;
const MIN_QUALITY = 0.3;
const DEFAULT_MAX_DIM = 800;
const DEFAULT_MAX_BYTES = 500_000;
const QR_RENDER_PX = 512;
const TARGET_PX_PER_MM = 4;

export function resolveCardQrPayload(card: BusinessCard): string {
  if (card.back.qrPayload && card.back.qrPayload.trim().length > 0) {
    return card.back.qrPayload;
  }
  return card.back.website || '';
}

export function getEffectiveQrPayload(card: BusinessCard): string {
  const resolved = resolveCardQrPayload(card);
  if (!resolved) return '';
  if (isHttpUrl(resolved)) return resolved;
  return resolved;
}

function buildSocialsSummary(socials: BusinessCard['back']['socials']): string {
  return socials
    .filter((s) => s.platform && s.url)
    .map((s) => s.platform)
    .join(' · ');
}

function getCardDimensionsMm(card: BusinessCard): { w: number; h: number } {
  return SIZE_PRESETS_MM[card.style.sizePreset];
}

function decodeSvgDataUri(src: string): string | null {
  if (!src.startsWith('data:image/svg+xml')) return null;
  const comma = src.indexOf(',');
  if (comma === -1) return null;
  const meta = src.slice(0, comma);
  const payload = src.slice(comma + 1);
  try {
    if (/;base64/i.test(meta)) {
      if (typeof atob === 'function') return decodeURIComponent(escape(atob(payload)));
      return Buffer.from(payload, 'base64').toString('utf8');
    }
    return decodeURIComponent(payload);
  } catch {
    return null;
  }
}

function pdfImageOrSvg(src: string, opts: Record<string, unknown>): Content {
  const svg = decodeSvgDataUri(src);
  if (svg) return { svg, ...opts };
  return { image: src, ...opts };
}

function buildFrontCell(card: BusinessCard, dims: { w: number; h: number }): Content[] {
  const paddingMm = 4;
  const innerW = dims.w - paddingMm * 2;
  const textColor = card.style.textColor;
  const accentColor = card.style.accentColor;
  const hasPhoto = !!card.front.photoUrl;
  const hasLogo = !!card.front.logoUrl;
  // Phase 2.2 REQ-D04: scala font globale applicata all'export PDF.
  // Clamp difensivo (lo schema Zod già lo fa).
  const f = Math.max(0.7, Math.min(1.5, card.style.fontScale ?? 1));
  const cells: Content[] = [];

  // Photo or logo fallback (top-left area)
  if (hasPhoto) {
    cells.push(pdfImageOrSvg(card.front.photoUrl!, {
      width: 25,
      height: 25,
      absolutePosition: { x: paddingMm, y: paddingMm },
    }));
  } else if (hasLogo) {
    cells.push(pdfImageOrSvg(card.front.logoUrl!, {
      width: 22,
      height: 22,
      absolutePosition: { x: paddingMm + 1.5, y: paddingMm + 1.5 },
    }));
  }

  // Text block (right of photo, or full width if no photo)
  const textX = hasPhoto ? paddingMm + 27 : paddingMm;
  const textW = hasPhoto ? innerW - 27 : innerW;
  const textLines: Content[] = [];
  if (card.front.name) {
    textLines.push({ text: card.front.name.toUpperCase(), color: textColor, fontSize: 11 * f, bold: true, characterSpacing: 0.5 });
  }
  if (card.front.title) {
    textLines.push({ text: card.front.title, color: accentColor, fontSize: 7.5 * f, bold: true, margin: [0, 1, 0, 0] });
  }
  if (card.front.company) {
    textLines.push({ text: card.front.company, color: textColor, fontSize: 6.5 * f, margin: [0, 1, 0, 0] });
  }
  if (textLines.length > 0) {
    cells.push({
      stack: textLines,
      absolutePosition: { x: textX, y: paddingMm + 4 },
      width: textW,
    });
  }

  // Divider line (below the top content)
  const divY = hasPhoto ? paddingMm + 27 : paddingMm + 18;
  cells.push({
    canvas: [
      { type: 'line', x1: paddingMm, y1: divY, x2: dims.w - paddingMm, y2: divY, lineWidth: 0.4, lineColor: accentColor },
    ],
    absolutePosition: { x: 0, y: 0 },
    width: dims.w,
  });

  // Bottom row: handle/domain (center) | logo (right)
  const bottomY = divY + 4;
  if (card.back.website) {
    const hostname = deriveHostnameLocal(card.back.website);
    cells.push({
      text: hostname,
      fontSize: 6 * f,
      color: textColor,
      alignment: 'center',
      absolutePosition: { x: 0, y: bottomY + 1 },
      width: dims.w,
      opacity: 0.6,
    });
  }
  if (hasLogo && hasPhoto) {
    // Logo ~30% della larghezza card (es. 25mm su 85mm). Era 14mm — troppo
    // piccolo per essere leggibile. Vedi AGENTS.md "Known Issues — Card".
    const logoMm = Math.min(25, dims.w * 0.30);
    cells.push(pdfImageOrSvg(card.front.logoUrl!, {
      width: logoMm,
      height: logoMm,
      absolutePosition: { x: dims.w - paddingMm - logoMm, y: bottomY - 3 },
    }));
  }

  void innerW;
  return cells;
}

function buildBackCell(card: BusinessCard, _dims: { w: number; h: number }): Content[] {
  const textColor = card.style.textColor;
  const accentColor = card.style.accentColor;
  // Phase 2.2 REQ-D04: scala font globale applicata all'export PDF.
  const f = Math.max(0.7, Math.min(1.5, card.style.fontScale ?? 1));

  const contactLines: Content[] = [];
  if (card.back.phone) {
    contactLines.push({ text: card.back.phone, color: textColor, fontSize: 7 * f });
  }
  if (card.back.email) {
    contactLines.push({ text: card.back.email, color: textColor, fontSize: 7 * f });
  }
  if (card.back.website) {
    contactLines.push({ text: card.back.website, color: accentColor, fontSize: 7 * f, bold: true });
  }
  if (card.back.address) {
    contactLines.push({ text: card.back.address, color: textColor, fontSize: 6.5 * f });
  }
  if (card.back.vatNumber) {
    contactLines.push({ text: `P.IVA: ${card.back.vatNumber}`, color: textColor, fontSize: 6.5 * f });
  }

  // Phase 2.2 REQ-F02: block label editabile sopra la lista servizi.
  const services = (card.back.services ?? []).filter((s) => s.trim().length > 0);
  if (services.length > 0) {
    const servicesLabelText = (card.back.servicesLabel ?? '').trim();
    if (servicesLabelText) {
      contactLines.push({
        text: servicesLabelText.toUpperCase(),
        color: accentColor,
        fontSize: 5.5 * f,
        bold: true,
        characterSpacing: 1.2,
        opacity: 0.7,
        margin: [0, 3, 0, 0],
      });
    }
    const hasLongService = services.some((s) => s.length >= 40);
    const svcFontSize = (hasLongService ? 5.5 : 6.5) * f;
    services.forEach((svc) => {
      contactLines.push({
        text: `· ${svc}`,
        color: accentColor,
        fontSize: svcFontSize,
        bold: true,
        margin: [0, 0.5, 0, 0],
      });
    });
  }

  // Socials: include platform name + value (raw text if URL is invalid, handle if valid)
  const validSocials = card.back.socials.filter((s) => s.platform && s.url);
  if (validSocials.length > 0) {
    const socialsText = validSocials
      .map((s) => {
        const handle = deriveHandleLocal(s.url);
        return `${s.platform} · ${handle || s.url}`;
      })
      .join(' · ');
    contactLines.push({
      text: socialsText,
      color: textColor,
      fontSize: 6 * f,
      italics: true,
      margin: [0, 3, 0, 0],
      opacity: 0.78,
    });
  }

  return [
    { stack: contactLines },
  ];
}

export interface PageCardEntry {
  x: number; // mm top-left X on the A4 page (trim, no bleed)
  y: number; // mm top-left Y on the A4 page (trim, no bleed)
  w: number; // mm trim width (= cardW)
  h: number; // mm trim height (= cardH)
}

export interface PageLayout {
  entries: PageCardEntry[];
  pageOrientation: 'portrait' | 'landscape';
}

// Build a 2×5 (10-up) tile grid. `entry.w/h` are the trim dimensions
// (cardW × cardH). Bleed is NOT doubled per card: the GAP between tiles
// is the shared bleed (= CARD_A4_GAP_MM = BLEED_MM). The bg rect drawn
// underneath extends BLEED_MM/2 outward into the gap/page margin so the
// final cut line sits at the gap midpoint with proper bleed on both
// sides. Page is chosen adaptively: portrait A4 if 10 tiles fit, else
// landscape A4 (still 2×5 arrangement).
export function computePageCardEntries(cardW: number, cardH: number): PageLayout {
  // Le card sono ruotate 90° (clockwise) nella sheet: il lato lungo
  // (cardW) diventa verticale, il lato corto (cardH) orizzontale.
  // Quindi nella page la tile occupa (cardH × cardW) mm.
  const tileW = cardH;
  const tileH = cardW;
  // 5 colonne × 2 righe su A4 landscape (297×210mm) con GAP=BLEED=3mm
  // e tile ruotata. Math per EU 85×55: trimW = 5*55+4*3 = 287<297
  // (margine 5mm×2), trimH = 2*85+3 = 173<210 (margine 18.5mm×2).
  const build = (pageW: number, pageH: number): PageLayout => {
    const trimW = CARD_A4_COLS * tileW + (CARD_A4_COLS - 1) * CARD_A4_GAP_MM;
    const trimH = CARD_A4_ROWS * tileH + (CARD_A4_ROWS - 1) * CARD_A4_GAP_MM;
    const offsetX = (pageW - trimW) / 2;
    const offsetY = (pageH - trimH) / 2;
    const entries: PageCardEntry[] = [];
    for (let r = 0; r < CARD_A4_ROWS; r++) {
      for (let c = 0; c < CARD_A4_COLS; c++) {
        entries.push({
          x: offsetX + c * (tileW + CARD_A4_GAP_MM),
          y: offsetY + r * (tileH + CARD_A4_GAP_MM),
          w: tileW,
          h: tileH,
        });
      }
    }
    return { entries, pageOrientation: pageH >= pageW ? 'portrait' : 'landscape' };
  };
  // A4 landscape 297×210 è il layout primario (5×2 con card ruotate).
  const landscape = build(297, 210);
  const fits = landscape.entries.every(
    (e) => e.x >= 0 && e.y >= 0 && e.x + e.w <= 297 && e.y + e.h <= 210,
  );
  if (fits) return landscape;
  // Fallback portrait A4 (raro: cards molto grandi dove 5×2 landscape
  // non basta, es. 2 righe × 85=170 > 210? Mai per preset supportati).
  return build(210, 297);
}

function cropMarkLines(entry: PageCardEntry): Content {
  // Crop marks sit at the CUT line (gap midpoint = entry edge - GAP/2),
  // extending outward into the bleed band. With GAP=BLEED_MM=3mm and
  // len=2mm the marks stay inside the bleed band on both inner and
  // outer edges. Coordinate in pt (vedi MM_TO_PT).
  const len = mm2pt(2);
  const g = mm2pt(CARD_A4_GAP_MM / 2);
  const x0 = mm2pt(entry.x) - g;
  const y0 = mm2pt(entry.y) - g;
  const x1 = mm2pt(entry.x + entry.w) + g;
  const y1 = mm2pt(entry.y + entry.h) + g;
  const lw = 0.3;
  const accent = '#000000';
  return {
    canvas: [
      // top-left corner
      { type: 'line', x1: x0 - len, y1: y0, x2: x0, y2: y0, lineWidth: lw, lineColor: accent },
      { type: 'line', x1: x0, y1: y0 - len, x2: x0, y2: y0, lineWidth: lw, lineColor: accent },
      // top-right corner
      { type: 'line', x1: x1, y1: y0, x2: x1 + len, y2: y0, lineWidth: lw, lineColor: accent },
      { type: 'line', x1: x1, y1: y0 - len, x2: x1, y2: y0, lineWidth: lw, lineColor: accent },
      // bottom-left corner
      { type: 'line', x1: x0 - len, y1: y1, x2: x0, y2: y1, lineWidth: lw, lineColor: accent },
      { type: 'line', x1: x0, y1: y1, x2: x0, y2: y1 + len, lineWidth: lw, lineColor: accent },
      // bottom-right corner
      { type: 'line', x1: x1, y1: y1, x2: x1 + len, y2: y1, lineWidth: lw, lineColor: accent },
      { type: 'line', x1: x1, y1: y1, x2: x1, y2: y1 + len, lineWidth: lw, lineColor: accent },
    ],
    absolutePosition: { x: 0, y: 0 },
  };
}

// Bleed extension: bg/accent rect extend BLEED_MM/2 outward on every
// side, filling the shared gap (cut line at gap midpoint) and the page
// margin on outer cards. For cards sharing a side the two bleed zones
// overlap exactly (same color), giving a clean shared-bleed band.
const BLEED_HALF_MM = BLEED_MM / 2;

// pdfmake lavora in PUNTI (1pt = 1/72 inch = 25.4/72 mm). Tutte le
// coordinate passate a `canvas` / `absolutePosition` / `width` / `height`
// devono essere in pt, NON in mm. Senza questa conversione le card
// vengono disegnate a ~3mm l'una (287pt = 101mm invece di 287mm) e
// sembrano piccole e "raggruppate" sul foglio A4.
const MM_TO_PT = 72 / 25.4;

function mm2pt(mm: number): number {
  return mm * MM_TO_PT;
}

function cardRect(entry: PageCardEntry, fill: string, border?: { color: string; width: number }): Content {
  const b = mm2pt(BLEED_HALF_MM);
  const x = mm2pt(entry.x) - b;
  const y = mm2pt(entry.y) - b;
  const w = mm2pt(entry.w) + b * 2;
  const h = mm2pt(entry.h) + b * 2;
  const rect: any = { type: 'rect', x, y, w, h, color: fill };
  const out: any[] = [rect];
  if (border) {
    out.push({ type: 'rect', x, y, w, h, lineWidth: border.width, lineColor: border.color });
  }
  return { canvas: out, absolutePosition: { x: 0, y: 0 } };
}

// accent-strip-left/bottom del design: con cards ruotate 90° CW nella
// sheet, "left" del design → "top" della tile, "bottom" del design →
// "right" della tile. Le funzioni ricevono la tile ruotata quindi
// disegnano nella direzione corretta.
function accentStripLeft(entry: PageCardEntry, color: string): Content {
  const b = mm2pt(BLEED_HALF_MM);
  // top della tile (1.5mm wide, tutta l'altezza + bleed)
  return {
    canvas: [
      { type: 'rect', x: mm2pt(entry.x) - b, y: mm2pt(entry.y), w: mm2pt(1.5 + BLEED_MM), h: mm2pt(entry.h), color },
    ],
    absolutePosition: { x: 0, y: 0 },
  };
}

function accentStripBottom(entry: PageCardEntry, color: string): Content {
  const b = mm2pt(BLEED_HALF_MM);
  // right della tile (1.5mm tall, tutta la larghezza + bleed)
  return {
    canvas: [
      { type: 'rect', x: mm2pt(entry.x + entry.w) - mm2pt(1.5), y: mm2pt(entry.y) - b, w: mm2pt(1.5), h: mm2pt(entry.h) + b * 2, color },
    ],
    absolutePosition: { x: 0, y: 0 },
  };
}

function buildPageContent(
  card: BusinessCard,
  side: 'front' | 'back',
  entries: PageCardEntry[],
  qrSvg: string | null,
  isFirst: boolean,
): Content[] {
  const out: Content[] = [];
  const dims = getCardDimensionsMm(card);
  const accent = card.style.accentColor;
  const bg = card.style.bgColor;
  const borderColor = card.style.accentColor;

  entries.forEach((entry) => {
    // 1. Card background (full bleed area)
    out.push(cardRect(entry, bg, { color: borderColor, width: card.style.borderStyle === 'thin' ? 0.4 : 0 }));

    // 2. Accent strip
    if (card.style.borderStyle === 'accent-strip-left') {
      out.push(accentStripLeft(entry, accent));
    } else if (card.style.borderStyle === 'accent-strip-bottom') {
      out.push(accentStripBottom(entry, accent));
    }

    // 3. Content inside the safe area (offset by BLEED on all sides)
    const contentX = entry.x + BLEED_MM;
    const contentY = entry.y + BLEED_MM;
    const contentW = entry.w - BLEED_MM * 2;
    const contentH = entry.h - BLEED_MM * 2;

    if (side === 'front') {
      const cells = buildFrontCell(card, dims);
      cells.forEach((c) => {
        if (c && typeof c === 'object' && 'stack' in (c as any)) {
          out.push({ ...(c as any), absolutePosition: { x: contentX, y: contentY }, width: contentW });
        } else {
          out.push({ ...(c as any), absolutePosition: { x: contentX, y: contentY } });
        }
      });
    } else {
      // back
      const contactCells = buildBackCell(card, dims);
      out.push({ stack: contactCells, absolutePosition: { x: contentX, y: contentY }, width: contentW * 0.55 });

      if (qrSvg) {
        // Phase 2.2 REQ-E02: dimensione QR controllata da `card.back.qrSize`
        // (small/medium/large). Default 'medium' = 25mm. In flexbox-mode
        // è l'unica sorgente; in grid-mode la dimensione deriva dalla
        // cella (gestito in buildBackSvg).
        const QR_SIZE_MM_BY_ENUM: Record<'small' | 'medium' | 'large', number> = {
          small: 18,
          medium: 25,
          large: 32,
        };
        const qrSizeMm = Math.min(contentH - 4, QR_SIZE_MM_BY_ENUM[card.back.qrSize] ?? 25);
        const qrX = contentX + contentW - qrSizeMm;
        const qrY = contentY + (contentH - qrSizeMm) / 2;
        out.push({ svg: qrSvg, absolutePosition: { x: qrX, y: qrY }, width: qrSizeMm, height: qrSizeMm });
        if (card.back.qrLabel) {
          out.push({
            text: card.back.qrLabel,
            absolutePosition: { x: qrX - 2, y: qrY + qrSizeMm + 1 },
            width: qrSizeMm + 4,
            fontSize: 5,
            color: card.style.textColor,
            alignment: 'center',
          });
        }
      }
    }

    // 4. Crop marks
    out.push(cropMarkLines(entry));
  });

  if (isFirst) {
    out.unshift({ text: '', margin: [0, 0, 0, 0] });
  }
  return out;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

// Risolve un URL immagine (relativo, blob, data:) in un base64 data URL.
// Necessario perché un SVG caricato come Image non può fetchare immagini
// esterne in modo affidabile cross-browser / cross-origin / cross-prod
// (anche same-origin). Solo immagini inline (base64) sono garantite.
//
// Casi gestiti:
// - data:* → passa direttamente (già inline)
// - blob:* → passa direttamente (già inline)
// - path relativo (es. '/giovanni-photo.jpg') → fetch same-origin → base64
// - URL http(s) → tenta fetch con CORS; se fallisce, fallback all'originale
async function resolveToBase64DataUrl(url: string): Promise<string> {
  if (!url) return url;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  try {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[cardGenerator] image fetch ${url} failed: HTTP ${response.status}`);
      return url;
    }
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error || new Error('FileReader error'));
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[cardGenerator] image fetch ${url} threw:`, e);
    return url;
  }
}

async function renderCardSideDataUrl(
  card: BusinessCard,
  side: 'front' | 'back',
  pxW: number,
  pxH: number,
  opts: { rotate?: 0 | 90 | 180 | 270 } = {},
): Promise<string> {
  const rotate = opts.rotate ?? 0;
  // In test mode buildMinimalPng non ruota. Per il PDF 10-up la rotazione
  // è gestita al livello successivo (vedi sotto). Niente da fare qui.
  if (import.meta.env.MODE === 'test') {
    const png = buildMinimalPng(pxW, pxH, card.style.bgColor);
    return 'data:image/png;base64,' + uint8ArrayToBase64(png);
  }
  // Pre-risolvi TUTTI gli URL immagine (photo, logo, QR logoOverlay) in
  // base64 data URL PRIMA di costruire l'SVG. Garantisce che il PDF
  // contenga le immagini anche in produzione (Vercel serve `public/` alla
  // root) e in qualsiasi browser (Chrome/Firefox/Safari + mobile).
  const [resolvedPhotoUrl, resolvedLogoUrl] = await Promise.all([
    card.front.photoUrl ? resolveToBase64DataUrl(card.front.photoUrl) : Promise.resolve(null),
    card.front.logoUrl ? resolveToBase64DataUrl(card.front.logoUrl) : Promise.resolve(null),
  ]);
  const cardForSvg: BusinessCard = {
    ...card,
    front: {
      ...card.front,
      photoUrl: resolvedPhotoUrl,
      logoUrl: resolvedLogoUrl,
    },
  };
  const svg = buildCardSvg(cardForSvg, side, pxW, pxH);
  // Bug storico: usare `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  // carica l'SVG in un contesto "data:" senza base URL → tutti gli URL
  // relativi interni (es. `photoUrl: '/giovanni-photo.jpg'`) e i nested
  // SVG con viewBox falliscono silenziosamente: foto e QR invisibili
  // nel PDF. Soluzione: Blob URL che eredita l'origin della pagina →
  // URL relativi risolvono, nested SVG renderizzano correttamente.
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const svgUri = URL.createObjectURL(blob);
  try {
    const img = await loadSvgImage(svgUri);
    // Canvas finale con dimensioni post-rotazione. rotate=90/270 → swap
    // width/height; rotate=0/180 → dimensioni native.
    const outW = rotate === 90 || rotate === 270 ? pxH : pxW;
    const outH = rotate === 90 || rotate === 270 ? pxW : pxH;
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D non disponibile');
    ctx.fillStyle = card.style.bgColor;
    ctx.fillRect(0, 0, outW, outH);
    if (rotate === 0) {
      ctx.drawImage(img, 0, 0, pxW, pxH);
    } else {
      // Centro di rotazione = centro del canvas finale. Traslazione
      // inversa dopo la rotazione per rimettere l'immagine in bounding box.
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate((rotate * Math.PI) / 180);
      ctx.drawImage(img, -pxW / 2, -pxH / 2, pxW, pxH);
    }
    return canvas.toDataURL('image/png');
  } catch {
    const png = buildMinimalPng(rotate === 90 || rotate === 270 ? pxH : pxW, rotate === 90 || rotate === 270 ? pxW : pxH, card.style.bgColor);
    return 'data:image/png;base64,' + uint8ArrayToBase64(png);
  } finally {
    // Libera la memoria del Blob (l'immagine è già decodata in `img`).
    URL.revokeObjectURL(svgUri);
  }
}

function buildPageContentFromImage(
  card: BusinessCard,
  entries: PageCardEntry[],
  imageDataUrl: string,
  isFirst: boolean,
): Content[] {
  const out: Content[] = [];
  const accent = card.style.accentColor;
  const bg = card.style.bgColor;
  const borderColor = card.style.accentColor;

  entries.forEach((entry) => {
    // 1. Card background with shared bleed (extends BLEED_MM/2 into gap).
    out.push(cardRect(entry, bg, { color: borderColor, width: card.style.borderStyle === 'thin' ? 0.4 : 0 }));
    // 2. Accent strip (left or bottom) on top of bg bleed.
    if (card.style.borderStyle === 'accent-strip-left') {
      out.push(accentStripLeft(entry, accent));
    } else if (card.style.borderStyle === 'accent-strip-bottom') {
      out.push(accentStripBottom(entry, accent));
    }
    // 3. Raster card face laid at trim coords (no per-card bleed offset
    //    — bleed is the shared gap, filled by the bg rect above).
    //    width/height in pt perché pdfmake interpreta le unità del
    //    pageSize (pt di default, 1mm = 2.8346pt).
    out.push({
      image: imageDataUrl,
      absolutePosition: { x: mm2pt(entry.x), y: mm2pt(entry.y) },
      width: mm2pt(entry.w),
      height: mm2pt(entry.h),
    });
    // 4. Crop marks on the cut line (gap midpoint).
    out.push(cropMarkLines(entry));
  });

  if (isFirst) out.unshift({ text: '', margin: [0, 0, 0, 0] });
  return out;
}

export async function generateCardPDF(
  card: BusinessCard,
  opts: { tier: Tier },
): Promise<Uint8Array> {
  const dims = getCardDimensionsMm(card);
  const { entries, pageOrientation } = computePageCardEntries(dims.w, dims.h);
  // Il PDF 10-up deve avere le stesse proporzioni dell'export SVG/PNG.
  // Usiamo la stessa pipeline `buildCardSvg` → canvas PNG a 300 DPI, poi
  // piazziamo il raster su A4 dieci volte. Cards ruotate 90° (senso
  // orario) per entrare in 5 colonne × 2 righe su A4 landscape.
  // `renderCardSideDataUrl` ruota il canvas di 90° prima di esportare.
  const pxW = Math.round((dims.w / 25.4) * 300);
  const pxH = Math.round((dims.h / 25.4) * 300);
  // In landscape il raster va ruotato. computePageCardEntries ha già
  // determinato l'orientamento della pagina: se landscape, ruotiamo.
  const rotate: 0 | 90 = pageOrientation === 'landscape' ? 90 : 0;
  const frontImage = await renderCardSideDataUrl(card, 'front', pxW, pxH, { rotate });
  const backImage = await renderCardSideDataUrl(card, 'back', pxW, pxH, { rotate });

  const frontContent = buildPageContentFromImage(card, entries, frontImage, true);
  const backContent = buildPageContentFromImage(card, entries, backImage, false);

  const baseDoc: TDocumentDefinitions = {
    // pageSize esplicito in pt: pdfmake lavora in pt (1mm = 2.8346pt).
    // Senza conversioni, le coordinate mm passate altrove farebbero
    // sembrare le cards piccole (287pt = 101mm invece di 287mm).
    pageSize: pageOrientation === 'landscape'
      ? { width: mm2pt(297), height: mm2pt(210) }
      : { width: mm2pt(210), height: mm2pt(297) },
    pageOrientation,
    pageMargins: [0, 0, 0, 0],
    content: [
      { stack: frontContent },
      { text: '', pageBreak: 'after' },
      { stack: backContent },
    ],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 8,
    },
  };

  // Phase 5: tier-aware watermark (free → diagonal "PRECISIONQUOTE" + footer)
  const docDef = applyWatermarkToPdf(baseDoc, opts.tier);

  return new Promise<Uint8Array>((resolve, reject) => {
    let settled = false;
    const done = (bytes: Uint8Array) => {
      if (settled) return;
      settled = true;
      resolve(bytes);
    };
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    const timeout = setTimeout(() => {
      fail(new Error('Timeout generazione PDF card'));
    }, 20_000);
    try {
      const doc = (pdfMake as any).createPdf(docDef);
      // Browser path: getBlob è più affidabile per download client-side.
      if (typeof doc.getBlob === 'function') {
        const maybePromise = doc.getBlob(async (blob: Blob) => {
          try {
            const ab = await blob.arrayBuffer();
            clearTimeout(timeout);
            done(new Uint8Array(ab));
          } catch (e) {
            clearTimeout(timeout);
            fail(e);
          }
        });
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(async (blob: Blob) => {
            const ab = await blob.arrayBuffer();
            clearTimeout(timeout);
            done(new Uint8Array(ab));
          }).catch((e: unknown) => { clearTimeout(timeout); fail(e); });
        }
        return;
      }
      const maybePromise = doc.getBuffer((buf: Uint8Array) => {
        clearTimeout(timeout);
        done(new Uint8Array(buf));
      });
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise
          .then((buf: Uint8Array) => { clearTimeout(timeout); done(new Uint8Array(buf)); })
          .catch((e: unknown) => { clearTimeout(timeout); fail(e); });
      }
    } catch (e) {
      clearTimeout(timeout);
      fail(e);
    }
  });
}

export async function generateCardPng(
  card: BusinessCard,
  side: 'front' | 'back',
  opts: { tier: Tier; dpi?: number },
): Promise<Uint8Array> {
  const dims = getCardDimensionsMm(card);
  const dpi = opts.tier === 'unlocked' ? (opts.dpi ?? 300) : 150;
  const pxW = Math.round((dims.w / 25.4) * dpi);
  const pxH = Math.round((dims.h / 25.4) * dpi);

  // 1. Build SVG string for the card
  const svg = buildCardSvg(card, side, pxW, pxH);

  // 2. Convert SVG to Image via data URI
  const svgUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

  // 3. Try real canvas rendering (works in browser)
  try {
    const img = await loadSvgImage(svgUri);
    const canvas = document.createElement('canvas');
    canvas.width = pxW;
    canvas.height = pxH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D non disponibile');
    // Solid background first (in case SVG has transparent areas)
    ctx.fillStyle = card.style.bgColor;
    ctx.fillRect(0, 0, pxW, pxH);
    ctx.drawImage(img, 0, 0, pxW, pxH);
    // Phase 5: tier-aware watermark on PNG canvas
    applyWatermarkToCanvas(ctx, opts.tier, pxW, pxH);

    // 4. Export as PNG via toDataURL (works in all browsers + jsdom with canvas polyfill)
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrlToUint8Array(dataUrl);
  } catch (e) {
    // Fallback: jsdom without canvas, or SSR. Return a valid minimal PNG with the
    // card's pixel dimensions encoded in IHDR so the file is a real (if blank) PNG.
    return buildMinimalPng(pxW, pxH, card.style.bgColor);
  }
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Build a minimal valid PNG buffer of the given dimensions, filled with the given bg color.
 * Used as a fallback in environments without a real canvas (jsdom tests, SSR).
 * The PNG signature + IHDR are real; the IDAT contains a single row of the bg color.
 */
function buildMinimalPng(pxW: number, pxH: number, bg: string): Uint8Array {
  // Parse bg hex (#RRGGBB) → RGB
  const m = bg.match(/^#([0-9a-fA-F]{6})$/);
  const r = m ? parseInt(m[1].slice(0, 2), 16) : 255;
  const g = m ? parseInt(m[1].slice(2, 4), 16) : 255;
  const b = m ? parseInt(m[1].slice(4, 6), 16) : 255;

  // Build IDAT payload: for each row, 1 filter byte (0) + 3 bytes per pixel (RGB)
  const rowLen = 1 + pxW * 3;
  const raw = new Uint8Array(rowLen * pxH);
  for (let y = 0; y < pxH; y++) {
    const off = y * rowLen;
    raw[off] = 0; // filter
    for (let x = 0; x < pxW; x++) {
      const p = off + 1 + x * 3;
      raw[p] = r; raw[p + 1] = g; raw[p + 2] = b;
    }
  }

  // Compress IDAT with zlib (use pako if available, else no compression)
  // For simplicity, use a stored (uncompressed) zlib block
  const compressed = zlibStored(raw);

  // PNG signature
  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdr = new Uint8Array(13);
  ihdr[0] = (pxW >>> 24) & 0xff; ihdr[1] = (pxW >>> 16) & 0xff; ihdr[2] = (pxW >>> 8) & 0xff; ihdr[3] = pxW & 0xff;
  ihdr[4] = (pxH >>> 24) & 0xff; ihdr[5] = (pxH >>> 16) & 0xff; ihdr[6] = (pxH >>> 8) & 0xff; ihdr[7] = pxH & 0xff;
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // color type RGB
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  const out: number[] = [];
  pushBytes(out, sig);
  pushChunk(out, 'IHDR', ihdr);
  pushChunk(out, 'IDAT', compressed);
  pushChunk(out, 'IEND', new Uint8Array(0));
  return new Uint8Array(out);
}

function pushBytes(out: number[], data: Uint8Array) {
  for (let i = 0; i < data.length; i++) out.push(data[i]);
}

function pushChunk(out: number[], type: string, data: Uint8Array) {
  const len = data.length;
  out.push((len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff);
  for (let i = 0; i < type.length; i++) out.push(type.charCodeAt(i));
  for (let i = 0; i < data.length; i++) out.push(data[i]);
  // CRC placeholder (we compute a simple checksum for correctness)
  const crc = crc32(concatBytes(type, data));
  out.push((crc >>> 24) & 0xff, (crc >>> 16) & 0xff, (crc >>> 8) & 0xff, crc & 0xff);
}

function concatBytes(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(type.length + data.length);
  for (let i = 0; i < type.length; i++) out[i] = type.charCodeAt(i);
  out.set(data, type.length);
  return out;
}

// CRC32 table (PNG spec)
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// zlib stored (uncompressed) block
function zlibStored(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  // zlib header: CMF=0x78 (deflate, 32K window), FLG=0x01 (level 0, FCHECK)
  out.push(0x78, 0x01);
  const len = data.length;
  let off = 0;
  while (off < len) {
    const chunk = Math.min(len - off, 65535);
    const isLast = off + chunk === len;
    out.push(isLast ? 0x01 : 0x00); // BTYPE=00 (stored), BFINAL
    out.push(chunk & 0xff, (chunk >>> 8) & 0xff);
    out.push(~chunk & 0xff, (~chunk >>> 8) & 0xff);
    for (let i = 0; i < chunk; i++) out.push(data[off + i]);
    off += chunk;
  }
  // Adler32
  const adler = adler32(data);
  out.push((adler >>> 24) & 0xff, (adler >>> 16) & 0xff, (adler >>> 8) & 0xff, adler & 0xff);
  return new Uint8Array(out);
}

function adler32(data: Uint8Array): number {
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function loadSvgImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Timeout caricamento SVG'));
    }, 3000);
    img.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(img);
    };
    img.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error('Impossibile caricare SVG della card'));
    };
    img.src = uri;
  });
}

// ─── buildCardSvg (PNG rendering pipeline) ─────────────────
function computeMonogramLocal(name: string): string {
  if (!name) return '';
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '';
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return (tokens[0][0] + tokens[tokens.length - 1][0]).toUpperCase();
}

// Phase 2.2 REQ-D04: helper per scalare la dimensione del testo in base
// a `card.style.fontScale` (clamp 0.7-1.5, default 1). Da usare in tutti
// i `font-size="..."` del SVG export. Il `pct` è la percentuale di `pxH`
// (o `photoSize`) da usare come base; il valore finale è clonato.
function fs(base: number, fontScale: number): number {
  const f = typeof fontScale === 'number' && !Number.isNaN(fontScale) ? fontScale : 1;
  const clamped = Math.max(0.7, Math.min(1.5, f));
  return Math.max(1, Math.round(base * clamped));
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function deriveHandleLocal(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (['linkedin.com', 'github.com', 'twitter.com', 'x.com', 'instagram.com'].includes(host)) {
      const path = u.pathname.replace(/^\/+|\/+$/g, '');
      const handle = path.split('/').filter(Boolean).pop() || '';
      return handle ? `@${handle}` : '';
    }
    return u.pathname.replace(/^\/+|\/+$/g, '') || host;
  } catch {
    return '';
  }
}

function deriveHostnameLocal(website: string): string {
  try {
    return new URL(website).hostname.replace(/^www\./, '');
  } catch {
    return website;
  }
}

function buildFrontSvg(card: BusinessCard, pxW: number, pxH: number): string {
  const bg = card.style.bgColor;
  const text = card.style.textColor;
  const accent = card.style.accentColor;
  const hasPhoto = !!card.front.photoUrl;
  const hasLogo = !!card.front.logoUrl;
  const fontScale = card.style.fontScale ?? 1;

  // Padding 4% of width
  const pad = Math.max(10, Math.round(pxW * 0.04));
  const stripW = Math.max(2, Math.round(pxW * 0.008));

  // Determine layout zones
  const isLeft = card.front.layout === 'left';
  const isSplit = card.front.layout === 'split';
  const isCentered = card.front.layout === 'centered';

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

  // 5. Photo or logo fallback (left zone in 'left' and 'split'; centered in 'centered')
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
    if (website) {
      const hostname = deriveHostnameLocal(website);
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
    const textW = pxW - textX - pad;
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

  return out;
}

function buildBackSvg(card: BusinessCard, pxW: number, pxH: number): string {
  const bg = card.style.bgColor;
  const text = card.style.textColor;
  const accent = card.style.accentColor;
  const stripW = Math.max(2, Math.round(pxW * 0.008));
  const pad = Math.max(10, Math.round(pxW * 0.04));
  const fontScale = card.style.fontScale ?? 1;

  const hostname = card.back.website ? deriveHostnameLocal(card.back.website) : '';
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

  // Contacts (left column). Se c'è QR, omettiamo la riga WEB (il QR
  // codifica già l'URL) e riduciamo la larghezza dei contatti.
  const contactsX = pad + stripW;
  // Phase 2.2 REQ-E02: dimensione QR in flexbox-mode controllata da
  // `card.back.qrSize`. Map a % dell'altezza per restare proporzionata
  // a qualsiasi sizePreset. In grid-mode la dimensione viene dalla cella
  // (l'export grid non passa per buildBackSvg).
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
  // WEB row omessa se QR presente (il QR codifica già l'URL)
  if (card.back.website && !hasQr) {
    renderContact('Web', card.back.website, accent, true);
  }
  if (card.back.address) renderContact('Indirizzo', card.back.address);
  if (card.back.vatNumber) renderContact('P.IVA', card.back.vatNumber);

  // Services (lista servizi offerti, dopo i contatti e prima dei socials).
  // Phase 2.2 REQ-F02: heading `servicesLabel` editabile (vuoto = no label).
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
    // Phase 2.2 REQ-F03: auto-shrink font se qualche servizio è lungo.
    const hasLongService = services.some((s) => s.length >= 40);
    const svcSize = fs(pxH * 0.04, fontScale) * (hasLongService ? 0.85 : 1);
    const svcLineH = svcSize * 1.3;
    services.forEach((svc, idx) => {
      out += `<text x="${contactsX}" y="${cursorServices + (idx + 1) * svcLineH}" font-family="Inter, system-ui, sans-serif" font-size="${svcSize}" font-weight="700" fill="${accent}">· ${escapeXml(svc)}</text>`;
    });
    lineY = cursorServices + services.length * svcLineH;
  }

  // Socials (right after contacts, separated by dashed line)
  if (socials.length > 0) {
    const socialsY = lineY + Math.round(pxH * 0.03);
    out += `<line x1="${contactsX}" y1="${socialsY - valSize}" x2="${contactsX + contactsW}" y2="${socialsY - valSize}" stroke="${text}" stroke-width="0.3" stroke-dasharray="2,1.5" opacity="0.14"/>`;
    const socialsText = socials
      .map((s) => {
        const handle = deriveHandleLocal(s.url);
        const value = handle || s.url;
        return `${s.platform} · ${value}`;
      })
      .join(' · ');
    out += `<text x="${contactsX}" y="${socialsY + valSize * 0.3}" font-family="Inter, system-ui, sans-serif" font-size="${fs(pxH * 0.04, fontScale)}" font-weight="500" fill="${text}" opacity="0.78" font-style="italic">${escapeXml(socialsText)}</text>`;
  }

  // QR code reale (Phase 2.1 fix: era un placeholder con scritta "QR")
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
    // Bug storico: nested <svg viewBox="0 0 qrSize qrSize"> scalava il
    // contenuto del QR (che è in coordinate 0-totalSize) con fattore
    // sbagliato, e in alcuni browser Image-context il nested SVG non
    // renderizza. Fix: <g transform> con scale esplicito ricavato dal
    // viewBox reale del QR (estratto via regex).
    const viewBoxMatch = qrSvg.match(/viewBox="0 0 (\d+) (\d+)"/);
    const totalSize = viewBoxMatch ? parseInt(viewBoxMatch[1], 10) : qrSize;
    const innerScale = (qrSize - 8) / totalSize;
    out += `<g transform="translate(${qrX + 4} ${qrY + 4}) scale(${innerScale})">${extractQrInner(qrSvg)}</g>`;
  }

  // QR label
  if (card.back.qrLabel && hasQr) {
    out += `<text x="${qrX + qrSize / 2}" y="${qrY + qrSize + Math.round(pxH * 0.035)}" font-family="Inter, system-ui, sans-serif" font-size="${Math.round(pxH * 0.034)}" font-weight="500" fill="${text}" text-anchor="middle" opacity="0.78">${escapeXml(card.back.qrLabel)}</text>`;
  }

  return out;
}

/**
 * Estrae il contenuto interno (figli di <svg>) da un QR SVG generato.
 * Lo usiamo per innestare un QR SVG dentro il nostro back SVG mantenendo
 * solo i moduli (<rect>/<circle>) senza l'<svg> wrapper esterno.
 */
function extractQrInner(qrSvg: string): string {
  const m = qrSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  if (!m) return '';
  return m[1];
}

/**
 * Build a standalone SVG representation of one side of the card at the given pixel dimensions.
 * Used as the rendering pipeline for PNG export: SVG → Image → canvas → PNG.
 */
export function buildCardSvg(
  card: BusinessCard,
  side: 'front' | 'back',
  pxW: number,
  pxH: number,
): string {
  const inner = side === 'front' ? buildFrontSvg(card, pxW, pxH) : buildBackSvg(card, pxW, pxH);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${pxW} ${pxH}" width="${pxW}" height="${pxH}">${inner}</svg>`;
}
export interface CompressImageOptions {
  /**
   * Output format. Use `'png'` to preserve transparency (logos with
   * alpha channel). Defaults to `'jpeg'` (smaller files, but opaque).
   *
   * PNG output has no `quality` knob — size reduction is achieved by
   * scaling the canvas dimensions down iteratively until the encoded
   * dataURL fits under `maxBytes`.
   */
  format?: 'jpeg' | 'png';
  /**
   * Minimum width/height in pixels when scaling down a PNG to fit
   * `maxBytes`. Defaults to 200. Below this the function throws.
   */
  minDim?: number;
}

export async function compressImage(
  file: File,
  maxDim: number = DEFAULT_MAX_DIM,
  maxBytes: number = DEFAULT_MAX_BYTES,
  opts: CompressImageOptions = {},
): Promise<string> {
  if (!isAllowedLogoMime(file.type)) {
    throw new Error('Formato non supportato. Usa PNG, JPEG o SVG.');
  }
  if (file.size > MAX_RAW_BYTES) {
    throw new Error('File troppo grande (max 5MB)');
  }

  const img = await loadImage(file);
  if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
    throw new Error('Immagine troppo grande (max 4000px)');
  }

  const format = opts.format || 'jpeg';
  const minDim = opts.minDim || 200;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D non disponibile');
  }
  // For PNG, preserve transparency: do NOT paint a background.
  // For JPEG, the canvas is already opaque by default.
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  if (format === 'png') {
    // PNG has no quality parameter. To reduce size, scale down
    // dimensions iteratively (half each step) until the encoded
    // dataURL fits under maxBytes — but never below minDim.
    const maxChars = Math.floor(maxBytes * 1.37);
    let curW = canvas.width;
    let curH = canvas.height;
    const minSide = Math.min(minDim, Math.max(img.width, img.height));
    let dataUrl = canvas.toDataURL('image/png');
    while (dataUrl.length > maxChars && Math.min(curW, curH) > minSide) {
      curW = Math.max(minSide, Math.floor(curW / 2));
      curH = Math.max(minSide, Math.floor(curH / 2));
      canvas.width = curW;
      canvas.height = curH;
      ctx.clearRect(0, 0, curW, curH);
      ctx.drawImage(img, 0, 0, curW, curH);
      dataUrl = canvas.toDataURL('image/png');
    }
    if (dataUrl.length > maxChars) {
      throw new Error('Immagine troppo pesante anche dopo compressione');
    }
    return dataUrl;
  }

  // Default: JPEG (current behavior, opaque output).
  let quality = 0.85;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  const maxChars = Math.floor(maxBytes * 1.37);
  while (dataUrl.length > maxChars && quality > MIN_QUALITY) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  if (dataUrl.length > maxChars) {
    throw new Error('Immagine troppo pesante anche dopo compressione');
  }
  return dataUrl;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Immagine non leggibile'));
    };
    img.src = url;
  });
}

export function _internalForTests() {
  return { MAX_RAW_BYTES, MAX_DIMENSION, DEFAULT_MAX_DIM, DEFAULT_MAX_BYTES, resolveToBase64DataUrl };
}
