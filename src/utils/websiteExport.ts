import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Website } from './schemas/website';
import { mergeWebsiteWithDefaults } from './schemas/website';

/** Font Google caricabili via link (system fonts esclusi). */
const GOOGLE_FONT_FAMILIES = new Set([
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
  'Source Sans 3', 'DM Sans', 'Figtree', 'Plus Jakarta Sans', 'Oswald',
  'Raleway', 'Playfair Display', 'Merriweather', 'Outfit', 'Source Serif 4',
]);

function googleFontsLink(fontFamily: string): string {
  const name = fontFamily.split(',')[0]?.trim() || fontFamily;
  if (!GOOGLE_FONT_FAMILIES.has(name)) return '';
  return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${name.replace(/ /g, '+')}:wght@400;600;700&display=swap">`;
}

// Fallback minimo: hamburger menu funzionante. Usato quando il JS generato
// non parsa O va in errore a runtime (l'AI a volte richiama funzioni mai
// dichiarate — bug live 2026-08-21: "Unexpected token 'else'" / menu mobile
// morto). Un <script> rotto uccide tutto il JS della pagina.
const MENU_FALLBACK_JS = "document.querySelectorAll('.menu-toggle').forEach(function(b){b.addEventListener('click',function(){var n=b.closest('nav,header')||document.querySelector('nav');if(n)n.classList.toggle('nav-open');});});";

/** Parse-check senza eseguire: l'AI a volte tronca il JS (if senza else). */
function isParseableWebsiteJs(js: string): boolean {
  try {
    new Function(js);
    return true;
  } catch (err) {
    console.warn('[websiteExport] JS generato non parsabile, uso fallback menu:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Script tag finale del documento: il JS generato viaggia dentro try/catch;
 * se a runtime fallisce (ReferenceError ecc.) il flag __qbSiteJsFailed
 * attiva il binding di fallback dell'hamburger. Se il JS è sano, nessun
 * doppio binding. lean-code: nel raro caso di JS che bindea il toggle E poi
 * throwa altrove, il fallback aggiunge un secondo listener (toggle doppio)
 * — ceiling accettabile vs menu completamente morto.
 */
function websiteScriptTag(js: string): string {
  const trimmed = js.trim();
  if (!trimmed || !isParseableWebsiteJs(trimmed)) {
    return `<script>${MENU_FALLBACK_JS}</script>`;
  }
  const guarded = `try{\n${js}\n}catch(e){window.__qbSiteJsFailed=true;if(window.console&&console.warn)console.warn('[site] JS generato fallito:',e&&e.message);}`;
  return `<script>${guarded}</script><script>if(window.__qbSiteJsFailed){${MENU_FALLBACK_JS}}</script>`;
}

export function buildWebsiteFullDocument(html: string, css: string, js: string, fontFamily?: string): string {
  const fontLink = fontFamily ? googleFontsLink(fontFamily) : '';
  const scriptTag = websiteScriptTag(js);
  if (/<!DOCTYPE html>/i.test(html)) {
    // Il documento è già completo (AI genera html full-page): inietta
    // css/font nel <head> esistente e js prima di </body>.
    let out = html;
    if (fontLink || css) {
      const headEnd = out.indexOf('</head>');
      const inject = `${fontLink}<style>${css}</style>`;
      out = headEnd >= 0
        ? out.slice(0, headEnd) + inject + out.slice(headEnd)
        : inject + out;
    }
    if (js.trim()) {
      const bodyEnd = out.lastIndexOf('</body>');
      out = bodyEnd >= 0
        ? out.slice(0, bodyEnd) + scriptTag + out.slice(bodyEnd)
        : out + scriptTag;
    }
    return out;
  }
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${fontLink}<style>${css}</style>
</head>
<body>
${html}
${scriptTag}
</body>
</html>`;
}

/**
 * Sanitizza il nome file/cartella ZIP: rimuove caratteri illegali nei
 * filesystem (Windows: \ / : * ? " < > |) e spazi multipli. Un nome con
 * "|" (es. businessName "A | B") rende la cartella illeggibile in
 * Explorer → ZIP scaricato ma apparentemente vuoto.
 */
export function sanitizeZipName(raw: string): string {
  const cleaned = raw
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^-+|-+$/g, '');
  if (!cleaned || !/[a-zA-Z0-9]/.test(cleaned)) return 'sito-web';
  return cleaned.slice(0, 60);
}

/**
 * Esporta il sito come ZIP: file .html separati per pagina (CSS/JS
 * inline), immagini base64 → assets/ come file separati. Logica
 * condivisa editor + Collection (REQ-045..049, REQ-060).
 */
export async function exportWebsiteZip(
  input: Partial<Website> | null | undefined,
  options: { onAssetExtract?: (dataUrl: string) => boolean } = {},
): Promise<{ fileName: string; assetCount: number }> {
  const website = mergeWebsiteWithDefaults(input);
  const zip = new JSZip();
  const rawName = website.brief.businessName || website.title || 'sito-web';
  const safeName = sanitizeZipName(rawName);
  const baseFolder = `sito-${safeName}`;
  const folder = zip.folder(baseFolder)!;
  const assetsFolder = zip.folder(`${baseFolder}/assets`)!;
  const pages = website.pages.length > 0 ? website.pages : ['index'];

  // Raccogli le immagini (logo + gallery) per l'export in assets/
  const assetMap: Record<string, string> = {};
  let assetCounter = 0;
  let extracted = 0;
  const registerAsset = (dataUrl: string | null | undefined): string | null => {
    if (!dataUrl) return null;
    if (assetMap[dataUrl]) return assetMap[dataUrl];
    const isLogo = dataUrl === website.logoUrl;
    const ext = dataUrl.startsWith('data:image/svg') ? 'svg' : 'jpg';
    const fileName = `assets/${isLogo ? 'logo' : `img-${assetCounter + 1}`}.${ext}`;
    assetMap[dataUrl] = fileName;
    assetCounter++;
    extracted++;
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    assetsFolder.file(fileName.replace('assets/', ''), base64, { base64: true });
    return fileName;
  };

  const replaceSrcs = (html: string): string =>
    html.replace(/src="(data:[^"]+)"/g, (_m, dataUrl: string) => {
      const fileName = registerAsset(dataUrl);
      return fileName ? `src="${fileName}"` : _m;
    });

  registerAsset(website.logoUrl);
  for (const img of website.images) {
    if (options.onAssetExtract?.(img) === false) continue;
    registerAsset(img);
  }

  for (const page of pages) {
    const pageHtml = page === 'index' ? website.html : (website.pagesHtml || {})[page] || website.html;
    const doc = buildWebsiteFullDocument(replaceSrcs(pageHtml), website.css, website.js, website.brief.font);
    folder.file(`${page}.html`, doc);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const fileName = `sito-${safeName}.zip`;
  saveAs(blob, fileName);
  return { fileName, assetCount: extracted };
}
