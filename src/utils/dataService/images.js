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
// mappa la quota su un errore strutturato.
const B64_IMAGE_PATHS = [
  ['front', 'photoUrl'],
  ['front', 'logoUrl'],
  ['front', 'coverImageUrl'],
  ['back', 'coverImageUrl'],
  ['builder', 'backgroundImage'],
  ['content', 'heroImage'],
];
// ~225KB raw espressi in caratteri base64 (4/3 + prefix data URL).
const B64_COMPRESS_MIN_CHARS = 300_000;

export async function compressPayloadImages(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  let out = payload;
  for (const [parent, field] of B64_IMAGE_PATHS) {
    const node = out[parent];
    const value = node && node[field];
    if (typeof value === 'string' && value.startsWith('data:') && value.length > B64_COMPRESS_MIN_CHARS) {
      const compressDataUrl = await loadCompressDataUrl();
      const compressed = await compressDataUrl(value, 768, 200_000);
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
          const compressed = await compressDataUrl(src, 768, 200_000);
          if (compressed && compressed !== src) next = next.split(src).join(compressed);
        } catch { /* immagine non comprimibile: resta l'originale */ }
      }
      out = { ...out, html: next };
    }
  }
  if (typeof out.logoUrl === 'string' && out.logoUrl.startsWith('data:') && out.logoUrl.length > B64_COMPRESS_MIN_CHARS) {
    try {
      const compressDataUrl = await loadCompressDataUrl();
      const compressed = await compressDataUrl(out.logoUrl, 768, 200_000);
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
          const compressed = await compressDataUrl(img, 768, 200_000);
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
