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

export function sanitizeGeneratedCss(css: string): string {
  if (!css) return css;
  // Rimuove blocchi ::before/::after il cui content contiene emoji.
  // Pattern: selettore con ::before/::after, poi blocco { ... content: "..." ... }
  const blockRe = /([^{}]*::(?:before|after)[^{}]*)\{([^{}]*)\}/gi;
  return css.replace(blockRe, (_m, selector: string, body: string) => {
    const contentMatch = body.match(/content\s*:\s*(['"])(.*?)\1/i);
    if (contentMatch && EMOJI_RE.test(contentMatch[2])) {
      return '';
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

export function sanitizeGeneratedWebsite(html: string, css: string): { html: string; css: string } {
  return { html: sanitizeGeneratedHtml(html), css: sanitizeGeneratedCss(css) };
}
