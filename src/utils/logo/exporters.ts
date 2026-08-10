import { applyWatermarkToCanvas, getMaxPngSideForTier, type Tier } from '../watermark';
import { buildEmbeddedFontImport } from '../card/fontEmbed';
import { svg2pdf } from 'svg2pdf.js';
import { jsPDF } from 'jspdf';

// ─── FONT EMBED PER EXPORT RASTER ─────────────────────────

/**
 * Embedde il font-family del logo come `@font-face` base64 dentro il SVG
 * (helper condiviso con il modulo card, vedi card/fontEmbed). Senza questo
 * il SVG caricato come blob in un `<img>` non accede ai webfont della
 * pagina e il testo rasterizza con il sans-serif generico di sistema.
 * No-op (SVG invariato) per font sconosciuti o se il fetch fallisce.
 */
export async function embedFontInSvg(svg: string): Promise<string> {
  const m = svg.match(/font-family="([^",]+)/);
  if (!m) return svg;
  const style = await buildEmbeddedFontImport(m[1]);
  if (!style) return svg;
  return svg.replace(/(<svg[^>]*>)/, `$1${style}`);
}

// ─── SVG → PNG ──────────────────────────────────────────

/**
 * Estrae W e H dal viewBox "0 0 W H" di un SVG. Se mancante o
 * malformato, fallback quadrato 512×512 (preserva comportamento
 * legacy per SVG senza viewBox).
 */
function parseViewBox(svg: string): { w: number; h: number } {
  const m = svg.match(/<svg[^>]*\bviewBox=["']([-\d.\s]+)["']/);
  if (m) {
    const parts = m[1].trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { w: parts[2], h: parts[3] };
    }
  }
  return { w: 512, h: 512 };
}

/**
 * Converte un SVG in PNG preservando l'aspect ratio del viewBox.
 *
 * Bug fix: prima `canvas.width = canvas.height = size` forzava un
 * quadrato, deformando logo orizzontali (es. viewBox 400×160 → 2.5:1)
 * in un quadrato 512×512. Ora parsiamo il viewBox e calcoliamo
 * `targetW`/`targetH` con il lato lungo = `size`.
 *
 * Crispness del testo: render a 2× supersampling su canvas
 * temporaneo, poi `drawImage` con `imageSmoothingQuality = 'high'`
 * al target. Questo mitiga il blur nativo del raster SVG→canvas.
 */
export async function svgToPng(
  svg: string,
  size: number,
  opts: { tier?: Tier } = {},
): Promise<Uint8Array> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error('svgToPng richiede un ambiente browser');
  }
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('Size non valido per svgToPng');
  }
  const tier: Tier = opts.tier || 'unlocked';
  const maxSide = getMaxPngSideForTier(tier);
  const effectiveSize = Math.min(size, maxSide);
  const { w: vw, h: vh } = parseViewBox(svg);
  const aspect = vw / vh;
  let targetW: number;
  let targetH: number;
  if (aspect >= 1) {
    targetW = effectiveSize;
    targetH = Math.max(1, Math.round(effectiveSize / aspect));
  } else {
    targetH = effectiveSize;
    targetW = Math.max(1, Math.round(effectiveSize * aspect));
  }
  const SUPERSAMPLE = 2;
  const renderW = targetW * SUPERSAMPLE;
  const renderH = targetH * SUPERSAMPLE;
  const svgWithFont = await embedFontInSvg(svg);
  const blob = new Blob([svgWithFont], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Impossibile caricare SVG come immagine'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = renderW;
    canvas.height = renderH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D non disponibile');
    ctx.clearRect(0, 0, renderW, renderH);
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, renderW, renderH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, renderW, renderH);
    // Downscale finale al target con smoothing high per testo crisp.
    const out = document.createElement('canvas');
    out.width = targetW;
    out.height = targetH;
    const octx = out.getContext('2d');
    if (!octx) throw new Error('Canvas 2D non disponibile (out)');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.clearRect(0, 0, targetW, targetH);
    octx.drawImage(canvas, 0, 0, renderW, renderH, 0, 0, targetW, targetH);
    // Phase 5: tier-aware watermark sul canvas finale (dimensioni reali).
    applyWatermarkToCanvas(octx, tier, targetW, targetH);
    const pngBlob: Blob = await new Promise((resolve, reject) => {
      out.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob ha restituito null'))), 'image/png');
    });
    const buf = await pngBlob.arrayBuffer();
    return new Uint8Array(buf);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ─── SVG → PDF (vettoriale) ────────────────────────────────

/**
 * Converte un SVG in PDF vettoriale (stampabile in tipografia senza
 * rasterizzazione). Usa svg2pdf.js che traduce le primitive SVG in
 * istruzioni pdfmake/jspdf vettoriali (path, text, rect, …). Il PDF
 * risultante ha dimensioni in pt uguali al viewBox del SVG, così il
 * logo mantiene le proporzioni ed è scalabile senza perdita.
 */
export async function svgToPdf(svg: string): Promise<Uint8Array> {
  if (typeof document === 'undefined') {
    throw new Error('svgToPdf richiede un ambiente browser');
  }
  const { w, h } = parseViewBox(svg);
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, 'image/svg+xml');
  const svgEl = doc.documentElement as unknown as SVGSVGElement;
  // svg2pdf.js richiede un elemento con ownerDocument valido: appendiamo
  // temporaneamente al body in un contenitore nascosto per dare un
  // contesto di rendering DOM completo (getBBox/viewport).
  const host = document.createElement('div');
  host.style.position = 'absolute';
  host.style.left = '-9999px';
  host.style.top = '0';
  host.style.width = '0';
  host.style.height = '0';
  host.style.overflow = 'hidden';
  const imported = document.importNode(svgEl, true) as SVGSVGElement;
  host.appendChild(imported);
  document.body.appendChild(host);
  try {
    const pdf = new jsPDF({
      orientation: w >= h ? 'landscape' : 'portrait',
      unit: 'pt',
      format: [w, h],
      compress: true,
    });
    await svg2pdf(imported, pdf, { x: 0, y: 0, width: w, height: h });
    const ab = pdf.output('arraybuffer') as ArrayBuffer;
    return new Uint8Array(ab);
  } finally {
    document.body.removeChild(host);
  }
}

// ─── SVG → JPG (sfondo colorato) ───────────────────────────

/**
 * Converte SVG in JPG con sfondo opaco. JPG non supporta trasparenza:
 * riempie il canvas con `bgColor` (default bianco) prima di disegnare
 * il logo. Utile per social che richiedono sfondo pieno.
 */
export async function svgToJpg(
  svg: string,
  size: number,
  bgColor = '#FFFFFF',
  opts: { tier?: Tier } = {},
): Promise<Uint8Array> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error('svgToJpg richiede un ambiente browser');
  }
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('Size non valido per svgToJpg');
  }
  const tier: Tier = opts.tier || 'unlocked';
  const maxSide = getMaxPngSideForTier(tier);
  const effectiveSize = Math.min(size, maxSide);
  const { w: vw, h: vh } = parseViewBox(svg);
  const aspect = vw / vh;
  let targetW: number;
  let targetH: number;
  if (aspect >= 1) {
    targetW = effectiveSize;
    targetH = Math.max(1, Math.round(effectiveSize / aspect));
  } else {
    targetH = effectiveSize;
    targetW = Math.max(1, Math.round(effectiveSize * aspect));
  }
  const SUPERSAMPLE = 2;
  const renderW = targetW * SUPERSAMPLE;
  const renderH = targetH * SUPERSAMPLE;
  const svgWithFont = await embedFontInSvg(svg);
  const blob = new Blob([svgWithFont], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Impossibile caricare SVG come immagine'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = renderW;
    canvas.height = renderH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D non disponibile');
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, renderW, renderH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, renderW, renderH);
    const out = document.createElement('canvas');
    out.width = targetW;
    out.height = targetH;
    const octx = out.getContext('2d');
    if (!octx) throw new Error('Canvas 2D non disponibile (out)');
    octx.fillStyle = bgColor;
    octx.fillRect(0, 0, targetW, targetH);
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(canvas, 0, 0, renderW, renderH, 0, 0, targetW, targetH);
    applyWatermarkToCanvas(octx, tier, targetW, targetH);
    const jpgBlob: Blob = await new Promise((resolve, reject) => {
      out.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob ha restituito null'))),
        'image/jpeg',
        0.92,
      );
    });
    const buf = await jpgBlob.arrayBuffer();
    return new Uint8Array(buf);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ─── SVG → ICO (Windows) ──────────────────────────────────

/**
 * Codifica uno o più PNG in un file ICO (formato Windows). Il formato
 * ICO moderno supporta PNG embedded (Vista+), evitando la bitmap BMP
 * legacy. Genera i PNG alle dimensioni richieste via svgToPng e li
 * assembla: header ICONDIR (6 byte) + ICONDIRENTRY (16 byte ciascuna)
 * + blob PNG in coda.
 */
export async function svgToIco(
  svg: string,
  sizes: number[] = [16, 32, 48],
  opts: { tier?: Tier } = {},
): Promise<Uint8Array> {
  if (sizes.length === 0) throw new Error('svgToIco richiede almeno una size');
  if (sizes.some((s) => s <= 0 || s > 256)) {
    throw new Error('ICO size deve essere 1..256');
  }
  const pngs: Uint8Array[] = [];
  for (const s of sizes) {
    const png = await svgToPng(svg, s, opts);
    pngs.push(png);
  }
  const headerSize = 6;
  const entrySize = 16;
  const dirSize = headerSize + entrySize * sizes.length;
  const totalSize = dirSize + pngs.reduce((acc, p) => acc + p.length, 0);
  const out = new Uint8Array(totalSize);
  const dv = new DataView(out.buffer);
  // ICONDIR
  dv.setUint16(0, 0, true); // reserved
  dv.setUint16(2, 1, true); // type: 1 = ICO
  dv.setUint16(4, sizes.length, true); // count
  let offset = dirSize;
  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i];
    const png = pngs[i];
    const base = headerSize + i * entrySize;
    dv.setUint8(base, s >= 256 ? 0 : s); // width (0 = 256)
    dv.setUint8(base + 1, s >= 256 ? 0 : s); // height
    dv.setUint8(base + 2, 0); // color palette
    dv.setUint8(base + 3, 0); // reserved
    dv.setUint16(base + 4, 1, true); // color planes
    dv.setUint16(base + 6, 32, true); // bits per pixel
    dv.setUint32(base + 8, png.length, true); // size in bytes
    dv.setUint32(base + 12, offset, true); // offset
    out.set(png, offset);
    offset += png.length;
  }
  return out;
}

// ─── SVG → Favicon set (ZIP) ──────────────────────────────

/**
 * Genera un archivio ZIP con il set completo di favicon per il web:
 * - favicon-16.png, favicon-32.png, favicon-64.png
 * - apple-touch-icon-180.png
 * - android-chrome-512.png
 * - favicon.ico (16+32+48)
 * - site.webmanifest
 * - browserconfig.xml (facoltativo)
 *
 * Ritorna un Uint8Array (contenuto ZIP). Il chiamante provvede al
 * download tramite file-saver.
 */
export async function svgToFaviconZip(
  svg: string,
  baseName = 'favicon',
  opts: { tier?: Tier } = {},
): Promise<Uint8Array> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const pngSizes: { size: number; file: string }[] = [
    { size: 16, file: `${baseName}-16.png` },
    { size: 32, file: `${baseName}-32.png` },
    { size: 64, file: `${baseName}-64.png` },
    { size: 180, file: 'apple-touch-icon.png' },
    { size: 512, file: 'android-chrome-512.png' },
  ];
  for (const { size, file } of pngSizes) {
    const png = await svgToPng(svg, size, opts);
    zip.file(file, png);
  }
  const ico = await svgToIco(svg, [16, 32, 48], opts);
  zip.file('favicon.ico', ico);
  // SVG favicon (browser moderni supportano <link rel="icon" type="image/svg+xml">)
  zip.file(`${baseName}.svg`, svg);
  const manifest = {
    name: baseName,
    short_name: baseName,
    icons: [
      { src: `/${baseName}-16.png`, sizes: '16x16', type: 'image/png' },
      { src: `/${baseName}-32.png`, sizes: '32x32', type: 'image/png' },
      { src: `/${baseName}-64.png`, sizes: '64x64', type: 'image/png' },
      { src: '/android-chrome-512.png', sizes: '512x512', type: 'image/png' },
      { src: `/${baseName}.svg`, sizes: 'any', type: 'image/svg+xml' },
    ],
    theme_color: '#01696F',
    background_color: '#FFFFFF',
    display: 'standalone',
  };
  zip.file('site.webmanifest', JSON.stringify(manifest, null, 2));
  const browserconfig = `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square150x150logo src="/mstile-150x150.png"/>
      <TileColor>#01696F</TileColor>
    </tile>
  </msapplication>
</browserconfig>`;
  zip.file('browserconfig.xml', browserconfig);
  const ab = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  return ab;
}

// ─── SVG → SVG ottimizzato ────────────────────────────────

/**
 * Minimizza un SVG: rimuove commenti, metadata, namespace ridondanti,
 * collassa whitespace ripetuto e rimuove attributi vuoti/default.
 * Risultato ~30-40% più piccolo dell'input sanitizeSvg. Approccio
 * conservativo basato su regex (no SVGO runtime pesante): sicuro per
 * SVG generati da builderToSvg (subset controllato di primitive).
 */
export function optimizeSvg(svg: string): string {
  let out = svg;
  // Rimuovi commenti XML
  out = out.replace(/<!--[\s\S]*?-->/g, '');
  // Rimuovi dichiarazione XML (inutile per inline/standalone moderno)
  out = out.replace(/<\?xml[^>]*\?>\s*/g, '');
  // Rimuovi metadata, desc, title (salvabili ma ingombranti)
  out = out.replace(/<metadata>[\s\S]*?<\/metadata>/g, '');
  out = out.replace(/<title>[\s\S]*?<\/title>/g, '');
  out = out.replace(/<desc>[\s\S]*?<\/desc>/g, '');
  // Rimuovi attributi default comuni
  out = out.replace(/\s+(?:fill|stroke|stroke-width|opacity)=""/g, '');
  out = out.replace(/\s+stroke="none"/g, '');
  // Collassa whitespace tra tag
  out = out.replace(/>\s+</g, '><');
  // Collassa spazi multipli dentro tag
  out = out.replace(/\s{2,}/g, ' ');
  // Trim globale
  out = out.trim();
  return out;
}
