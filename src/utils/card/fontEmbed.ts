// Font embedding helpers for SVG export.
//
// v2.7: quando l'SVG viene caricato come Image (canvas pipeline per PNG/PDF)
// o aperto come file standalone, il font-family non è disponibile perché
// l'SVG è isolato dalla pagina. Il `<style>@import url(...)</style>` dentro
// l'SVG fa sì che il browser carichi il font insieme al resto del SVG,
// garantendo che canvas e viewer mostrino il font corretto.
export const GOOGLE_FONTS_BASE = 'https://fonts.googleapis.com/css2?family=';
export const FONT_TO_GOOGLE_URL: Record<string, string> = {
  Inter: 'Inter:wght@400;500;600;700;800&display=swap',
  Roboto: 'Roboto:wght@400;500;700&display=swap',
  'Open Sans': 'Open+Sans:wght@400;500;600;700;800&display=swap',
  Lato: 'Lato:wght@400;700;900&display=swap',
  Montserrat: 'Montserrat:wght@400;500;600;700;800&display=swap',
  Poppins: 'Poppins:wght@400;500;600;700;800&display=swap',
  'Source Sans 3': 'Source+Sans+3:wght@400;600;700&display=swap',
  'DM Sans': 'DM+Sans:wght@400;500;600;700&display=swap',
  Figtree: 'Figtree:wght@400;500;600;700;800&display=swap',
  'Plus Jakarta Sans': 'Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
  Oswald: 'Oswald:wght@400;500;600;700&display=swap',
  Raleway: 'Raleway:wght@400;500;600;700;800&display=swap',
  'Playfair Display': 'Playfair+Display:wght@400;500;600;700;800&display=swap',
  Merriweather: 'Merriweather:wght@400;700;900&display=swap',
};

const FONT_DATA_CACHE = new Map<string, Promise<string | undefined>>();

function cleanFontFamily(fontFamily: string): string {
  return fontFamily.trim().split(',')[0].replace(/['"]/g, '');
}

export function buildSvgFontImport(fontFamily: string): string {
  const clean = cleanFontFamily(fontFamily);
  const suffix = FONT_TO_GOOGLE_URL[clean];
  if (!suffix) return '';
  const url = `${GOOGLE_FONTS_BASE}${suffix}`.replace(/&/g, '&amp;');
  return `<style>@import url('${url}');</style>`;
}

/**
 * v2.7.1: build a self-contained `<style>` tag with the requested Google Font
 * embedded as base64 data URIs. This is the only reliable way to make fonts
 * render synchronously when the SVG is loaded into a canvas or into an `<img>`
 * element, because `@import` fonts are loaded asynchronously and drawImage()
 * runs before they are available.
 *
 * The result is cached per font family.
 */
export async function buildEmbeddedFontImport(fontFamily: string): Promise<string> {
  const clean = cleanFontFamily(fontFamily);
  const suffix = FONT_TO_GOOGLE_URL[clean];
  if (!suffix) return '';

  if (FONT_DATA_CACHE.has(clean)) {
    return (await FONT_DATA_CACHE.get(clean)) ?? '';
  }

  const loadPromise = (async () => {
    const cssUrl = `${GOOGLE_FONTS_BASE}${suffix}`;
    try {
      const response = await fetch(cssUrl, { mode: 'cors' });
      if (!response.ok) return undefined;
      let cssText = await response.text();

      // v2.8.2: the regex must capture the value inside url(...) without the
      // surrounding `url(` and `)`, otherwise the replacement becomes
      // `url(url(data:...))` and the browser rejects the @font-face src.
      const urlMatches = Array.from(cssText.matchAll(/url\((https:\/\/[^)]+)\)/g));
      const replacements = await Promise.all(
        urlMatches.map(async (match) => {
          const rawUrl = match[1];
          try {
            const fontResponse = await fetch(rawUrl, { mode: 'cors' });
            if (!fontResponse.ok) return null;
            const blob = await fontResponse.blob();
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result as string;
                const comma = result.indexOf(',');
                resolve(comma >= 0 ? result.slice(comma + 1) : '');
              };
              reader.onerror = () => reject(reader.error || new Error('FileReader error'));
              reader.readAsDataURL(blob);
            });
            const mime = fontResponse.headers.get('content-type') ?? 'font/woff2';
            return { fullMatch: match[0], dataUrl: `url(data:${mime};base64,${base64})` };
          } catch {
            return null;
          }
        }),
      );

      replacements.forEach((r) => {
        if (r) cssText = cssText.split(r.fullMatch).join(r.dataUrl);
      });

      return `<style>${cssText}</style>`;
    } catch {
      return undefined;
    }
  })();

  FONT_DATA_CACHE.set(clean, loadPromise);
  return (await loadPromise) ?? '';
}
