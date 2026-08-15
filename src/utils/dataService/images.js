// Compressione immagini base64 pre-save (gotcha §2.12: localStorage unica
// persistenza + QuotaExceededError). Import dinamico extensionless di
// `../card/imageCompress` (.ts) mantenuto lazy: è valutato solo a chiamata,
// mai a module load, quindi il require() CJS dei test resta sicuro (§23).

async function loadCompressDataUrl() {
  const mod = await import('../card/imageCompress');
  return mod.compressDataUrl;
}

// Campi immagine base64 noti: compressi automaticamente prima del save locale
// per evitare QuotaExceededError (gotcha §2.12). Il fallback resta lsSet, che
// mappa la quota su un errore strutturato. Parametri path-aware (probe live
// 2026-08-07): Gemini 1K = short side 1024 (16:9 → 1376×768, 3:4 → 896×1200);
// i cap 1400/1200 conservano la risoluzione nativa senza upscale.
const B64_IMAGE_PATHS = [
  ['front', 'photoUrl', 1200, 400_000],
  ['front', 'logoUrl', 1200, 400_000],
  ['front', 'coverImageUrl', 1200, 400_000],
  ['back', 'coverImageUrl', 1200, 400_000],
  ['builder', 'backgroundImage', 1400, 400_000],
  ['content', 'heroImage', 1400, 400_000],
];
// ~225KB raw espressi in caratteri base64 (4/3 + prefix data URL).
const B64_COMPRESS_MIN_CHARS = 300_000;
// Website: immagini inline nell'HTML, budget più stretto (molte per documento).
const WEBSITE_IMG_MAX_DIM = 1024;
const WEBSITE_IMG_MAX_BYTES = 300_000;

export async function compressPayloadImages(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  let out = payload;
  for (const [parent, field, maxDim, maxBytes] of B64_IMAGE_PATHS) {
    const node = out[parent];
    const value = node && node[field];
    if (typeof value === 'string' && value.startsWith('data:') && value.length > B64_COMPRESS_MIN_CHARS) {
      const compressDataUrl = await loadCompressDataUrl();
      const compressed = await compressDataUrl(value, maxDim, maxBytes);
      if (compressed && compressed !== value) {
        out = { ...out, [parent]: { ...node, [field]: compressed } };
      }
    }
  }
  // Website: immagini base64 vivono dentro `html` (iniettate), `logoUrl`
  // e `images[]` al top level — nessun path fisso. Senza compressione un
  // sito con hero/gallery supera la quota localStorage e il save fallisce.
  if (typeof out.html === 'string' && out.html.includes('data:image/')) {
    const compressDataUrl = await loadCompressDataUrl();
    const html = out.html;
    const bigSrcs = [];
    const srcRe = /(data:image\/[^"')]+)/gi;
    let m;
    while ((m = srcRe.exec(html)) !== null) {
      if (m[1].length > B64_COMPRESS_MIN_CHARS) bigSrcs.push(m[1]);
    }
    if (bigSrcs.length > 0) {
      let next = html;
      for (const src of new Set(bigSrcs)) {
        try {
          const compressed = await compressDataUrl(src, WEBSITE_IMG_MAX_DIM, WEBSITE_IMG_MAX_BYTES);
          if (compressed && compressed !== src) next = next.split(src).join(compressed);
        } catch { /* immagine non comprimibile: resta l'originale */ }
      }
      out = { ...out, html: next };
    }
  }
  // Website multi-pagina: le immagini possono vivere anche nell'HTML delle
  // pagine secondarie (pagesHtml) → stessa compressione pre-save.
  if (out.pagesHtml && typeof out.pagesHtml === 'object') {
    const compressDataUrl = await loadCompressDataUrl();
    const srcRe = /(data:image\/[^"')]+)/gi;
    let pagesChanged = false;
    const nextPages = { ...out.pagesHtml };
    for (const [name, pageHtml] of Object.entries(out.pagesHtml)) {
      if (typeof pageHtml !== 'string' || !pageHtml.includes('data:image/')) continue;
      const bigSrcs = [];
      let m;
      while ((m = srcRe.exec(pageHtml)) !== null) {
        if (m[1].length > B64_COMPRESS_MIN_CHARS) bigSrcs.push(m[1]);
      }
      if (bigSrcs.length === 0) continue;
      let next = pageHtml;
      for (const src of new Set(bigSrcs)) {
        try {
          const compressed = await compressDataUrl(src, WEBSITE_IMG_MAX_DIM, WEBSITE_IMG_MAX_BYTES);
          if (compressed && compressed !== src) next = next.split(src).join(compressed);
        } catch { /* immagine non comprimibile: resta l'originale */ }
      }
      nextPages[name] = next;
      pagesChanged = true;
    }
    if (pagesChanged) out = { ...out, pagesHtml: nextPages };
  }
  if (typeof out.logoUrl === 'string' && out.logoUrl.startsWith('data:') && out.logoUrl.length > B64_COMPRESS_MIN_CHARS) {
    try {
      const compressDataUrl = await loadCompressDataUrl();
      const compressed = await compressDataUrl(out.logoUrl, WEBSITE_IMG_MAX_DIM, WEBSITE_IMG_MAX_BYTES);
      if (compressed && compressed !== out.logoUrl) out = { ...out, logoUrl: compressed };
    } catch { /* immagine non comprimibile: resta l'originale */ }
  }
  if (Array.isArray(out.images)) {
    const compressDataUrl = await loadCompressDataUrl();
    let changed = false;
    const next = [];
    for (const img of out.images) {
      if (typeof img === 'string' && img.startsWith('data:') && img.length > B64_COMPRESS_MIN_CHARS) {
        try {
          const compressed = await compressDataUrl(img, WEBSITE_IMG_MAX_DIM, WEBSITE_IMG_MAX_BYTES);
          if (compressed && compressed !== img) { next.push(compressed); changed = true; continue; }
        } catch { /* immagine non comprimibile: resta l'originale */ }
      }
      next.push(img);
    }
    if (changed) out = { ...out, images: next };
  }
  return out;
}

// Il documento può essere flat (editor: front/builder/content al top level)
// o envelope ({ id, documentType, data }): comprime in entrambi i livelli.
export async function compressDocumentImages(document) {
  let out = await compressPayloadImages(document);
  if (out.data) {
    out = { ...out, data: await compressPayloadImages(out.data) };
  }
  return out;
}
