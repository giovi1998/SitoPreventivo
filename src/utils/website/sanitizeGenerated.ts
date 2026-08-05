/**
 * Sanitizza il sito generato dall'AI rimuovendo elementi decorativi
 * indesiderati che il prompt vieta ma l'AI a volte genera comunque:
 *
 * 1. Regole CSS `X::before` / `X::after` con `content: "🍦"` (emoji) →
 *    blocco rimosso.
 * 2. Div vuoti decorativi (es. <div class="shape"></div>, .hero-shapes)
 *    senza contenuto reale.
 */
const EMOJI_RE = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
// Selettori LOGO/brand: qui ::before/::after con content NON vuoto va sempre
// rimosso (l'AI mette emoji o testo decorativo accanto al logo iniettato).
// Niente regole per btn/hero: ::after con "›" su un bottone è UX legittima.
const LOGO_SELECTOR_RE = /\b(brand|logo|site-logo|brand-mark)\b[^{}]*::(?:before|after)/i;

export function sanitizeGeneratedCss(css: string): string {
  if (!css) return css;
  // Rimuove blocchi ::before/::after se:
  // - il content contiene emoji, OPPURE
  // - il selettore è brand/logo e il content non è vuoto ("" per gradienti)
  //   né url() (immagini decorative accanto al logo).
  const blockRe = /([^{}]*::(?:before|after)[^{}]*)\{([^{}]*)\}/gi;
  return css.replace(blockRe, (_m, selector: string, body: string) => {
    const contentMatch = body.match(/content\s*:\s*(['"])(.*?)\1/i);
    if (contentMatch && EMOJI_RE.test(contentMatch[2])) {
      return '';
    }
    if (LOGO_SELECTOR_RE.test(selector)) {
      const hasContent = contentMatch && contentMatch[2].trim().length > 0;
      const hasUrlContent = /content\s*:\s*url\(/i.test(body);
      if (hasContent || hasUrlContent) {
        return '';
      }
    }
    return _m;
  });
}

export function sanitizeGeneratedHtml(html: string): string {
  if (!html) return html;
  let out = html;
  // Rimuove div/span vuoti decorativi (nessun contenuto, solo spazi) con
  // classi tipicamente decorative. Loop finché non cambia più: il wrapper
  // (es. .hero-shapes) diventa vuoto solo DOPO che i figli sono rimossi.
  const decorativeClassRe = /<(div|span)[^>]*class\s*=\s*"[^"]*\b(shape|shapes|hero-shapes|dot|decor|ornament|blob|circle|accent-shape)\b[^"]*"[^>]*>\s*<\/(?:div|span)>/gi;
  let prev = out;
  do {
    prev = out;
    out = out.replace(decorativeClassRe, '');
  } while (out !== prev);
  return out;
}

/**
 * Garantisce che le immagini gallery non sforino il viewport: appende una
 * regola CSS di sicurezza se il CSS generato non vincola già width/max-width
 * sulle immagini dentro .gallery.
 */
export function ensureResponsiveGallery(css: string): string {
  if (!css) return css;
  const hasGalleryImgRule = /\.gallery[^{]*\{[^}]*\b(display:\s*grid|grid-template-columns)[^}]*\}/i.test(css)
    || /\.gallery\s+img[^{]*\{[^}]*\b(max-width|width|object-fit)[^}]*\}/i.test(css);
  if (hasGalleryImgRule) return css;
  return `${css}\n\n/* sicurezza: immagini gallery responsive */\n.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; }\n.gallery-item img { width: 100%; height: 180px; object-fit: cover; display: block; border-radius: 10px; }\nimg { max-width: 100%; height: auto; }\n`;
}

export function sanitizeGeneratedWebsite(html: string, css: string): { html: string; css: string } {
  return { html: sanitizeGeneratedHtml(html), css: ensureResponsiveGallery(sanitizeGeneratedCss(css)) };
}
