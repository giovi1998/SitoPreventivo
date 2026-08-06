/**
 * Normalizza i data URL inline in un documento HTML per i contesti
 * "ostili" (iframe srcdoc, clone html2canvas): Chrome lancia
 * ERR_INVALID_URL se il payload base64 contiene whitespace letterali
 * (base64 wrapped), se il prefisso è sporco (es. `data:image/jpeg; base64,`)
 * o se l'URL è troppo lungo. Per le anteprime vision le foto giganti non
 * servono: vengono rimosse.
 *
 * Casi coperti (hardening §26.21):
 * - src con quote doppie/singole: <img src="data:..."> / src='data:...'
 * - src SENZA quote (l'AI lo genera): <img src=data:image/jpeg;base64,....>
 * - whitespace nel prefisso PRIMA della virgola (data:image/jpeg; base64,)
 * - payload con apici interni (data:image/svg+xml con ' o " nel markup)
 * - background-image inline con data:
 */
const GIF_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function cleanPayload(url: string): string {
  const comma = url.indexOf(',');
  if (comma === -1) return url;
  // Pulisce ANCHE il prefisso (prima della virgola): `data:image/jpeg; base64,`
  // → `data:image/jpeg;base64,`. Il payload dopo la virgola perde i
  // whitespace (base64 wrapped). Gli apici interni (SVG) restano: un
  // data URL con ' o " nel payload è comunque valido in un attributo
  // quotato con l'altro tipo di apice.
  const prefix = url.slice(0, comma + 1).replace(/\s+/g, '');
  const payload = url.slice(comma + 1).replace(/\s+/g, '');
  return prefix + payload;
}

export function normalizeInlineImages(html: string, maxChars: number): string {
  if (!html) return html;

  let out = html;

  // 1) <img src="data:..."> o src='data:...' — payload tra gli stessi apici.
  //    g1 = prefisso fino al quote, g2 = quote, g3 = data URL.
  out = out.replace(/(<img\b[^>]*\bsrc\s*=\s*)(["'])(data:[\s\S]*?)\2/gi, (m, pre: string, quote: string, url: string) => {
    const clean = cleanPayload(url);
    if (clean.length > maxChars) return `${pre}${quote}${GIF_PLACEHOLDER}${quote}`;
    return `${pre}${quote}${clean}${quote}`;
  });

  // 2) <img src=data:...> SENZA quote — payload fino al primo spazio o '>'
  out = out.replace(/(<img\b[^>]*\bsrc\s*=\s*)(data:[^\s>]+)/gi, (m, pre: string, url: string) => {
    if (pre.endsWith('"') || pre.endsWith("'")) return m; // già gestito dal caso 1
    const clean = cleanPayload(url);
    if (clean.length > maxChars) return `${pre}${GIF_PLACEHOLDER}`;
    return `${pre}${clean}`;
  });

  // 3) background-image inline con data: — stesso trattamento
  out = out.replace(/(background(?:-image)?\s*:\s*url\(\s*["']?)(data:[^"')]+)(["']?\s*\))/gi, (m, pre: string, url: string, post: string) => {
    const clean = cleanPayload(url);
    if (clean.length > maxChars) return `${pre}${post}`;
    return `${pre}${clean}${post}`;
  });

  return out;
}
