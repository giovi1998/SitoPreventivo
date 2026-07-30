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
