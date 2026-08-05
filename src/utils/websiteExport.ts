import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Website } from './schemas/website';
import { mergeWebsiteWithDefaults } from './schemas/website';

export function buildWebsiteFullDocument(html: string, css: string, js: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${css}</style>
</head>
<body>
${html}
<script>${js}</script>
</body>
</html>`;
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
  const name = website.brief.businessName || website.title || 'sito-web';
  const folder = zip.folder(`sito-${name}`)!;
  const assetsFolder = zip.folder(`sito-${name}/assets`)!;
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
    const pageHtml = page === 'index'
      ? website.html
      : website.html.replace(/<section[^>]*id="[^"]*"[^>]*>[\s\S]*?<\/section>/g, '')
          .replace(/<header>[\s\S]*?<\/header>/, '')
          .replace(/<footer>[\s\S]*?<\/footer>/, '');
    const doc = buildWebsiteFullDocument(replaceSrcs(pageHtml), website.css, website.js);
    folder.file(`${page}.html`, doc);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `sito-${name}.zip`);
  return { fileName: `sito-${name}.zip`, assetCount: extracted };
}
