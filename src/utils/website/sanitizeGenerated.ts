import { sanitizeMapAddress } from '../../ai/prompts/websiteSystem';

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
  // Rimuove i blocchi ::before/::after decorativi: l'AI li usa per
  // emoji/icone (vietate dal prompt) e il verify li flagga sempre.
  // ECCEZIONE: .menu-toggle::before/::after è l'icona hamburger legittima
  // (il prompt la chiede esplicitamente: "disegna via CSS ::before/::after
  // con box-shadow o gradienti") — senza, resta il fallback spoglio.
  const blockRe = /([^{}]*::(?:before|after)[^{}]*)\{([^{}]*)\}/gi;
  return css.replace(blockRe, (_m, selector: string) => (/menu-toggle/.test(selector) ? _m : ''));
}

export function sanitizeGeneratedHtml(html: string): string {
  if (!html) return html;
  let out = html;
  // Rimuove span decorativi vuoti (brand-dot, dot, shape...) e div decorativi.
  const decorativeClassRe = /<(div|span)[^>]*class\s*=\s*"[^"]*\b(shape|shapes|hero-shapes|dot|brand-dot|decor|ornament|blob|circle|accent-shape)\b[^"]*"[^>]*>\s*<\/(?:div|span)>/gi;
  let prev = out;
  do {
    prev = out;
    out = out.replace(decorativeClassRe, '');
  } while (out !== prev);
  // Bottone menu-toggle: rimuove SOLO emoji/unicode (☰) dal contenuto,
  // lasciando span/icone CSS-safe (le barre hamburger vengono dal CSS).
  out = out.replace(/(<button[^>]*class\s*=\s*"[^"]*\bmenu-toggle\b[^"]*"[^>]*>)([\s\S]*?)(<\/button>)/gi, (_m, pre: string, content: string, post: string) => {
    if (/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}☰≡]/u.test(content)) return `${pre}${post}`;
    return _m;
  });
  return out;
}

/**
 * Sanitizza il JS generato dall'AI: rimuove l'assegnazione di emoji/unicode
 * (es. toggle.innerHTML = '☰') che il verify flagga come testo visibile.
 * L'icona hamburger deve venire dal CSS, non dal JS.
 */
export function sanitizeGeneratedJs(js: string): string {
  if (!js) return js;
  return js
    .replace(/[^'"`]*\.innerHTML\s*=\s*['"`][^'"`]*[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}☰][^'"`]*['"`][^;]*;/giu, '')
    .replace(/[^'"`]*\.textContent\s*=\s*['"`][^'"`]*[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}☰][^'"`]*['"`][^;]*;/giu, '');
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

/**
 * Garantisce un'icona hamburger di qualità: se il CSS non disegna le barre
 * sul .menu-toggle (né ::before/::after, né background-image, né span
 * figli), appende un fallback completo: 2 barre con transizione ad X su
 * .nav-open. Senza, il bottone resta vuoto/invisibile su mobile.
 */
export function ensureHamburgerCss(css: string): string {
  if (!css) return css;
  const hasHamburgerRule = /\.menu-toggle::(?:before|after)/i.test(css)
    || /\.menu-toggle[^{]*\{[^}]*\b(background-image|content)[^}]*\}/i.test(css)
    || /\.menu-toggle[^{]*\bspan\b/i.test(css);
  if (hasHamburgerRule) return css;
  return `${css}

/* sicurezza: icona hamburger (2 barre con transizione ad X) se il CSS non la disegna */
.menu-toggle {
  position: relative;
  width: 42px;
  height: 42px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  display: none;
}
.menu-toggle::before,
.menu-toggle::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 22px;
  height: 2px;
  border-radius: 2px;
  background: currentColor;
  transform: translate(-50%, -50%);
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.menu-toggle::before { margin-top: -5px; }
.menu-toggle::after { margin-top: 5px; }
.nav-open .menu-toggle::before { margin-top: 0; transform: translate(-50%, -50%) rotate(45deg); }
.nav-open .menu-toggle::after { margin-top: 0; transform: translate(-50%, -50%) rotate(-45deg); }
@media (max-width: 768px) {
  .menu-toggle { display: block; }
}
`;
}

export function sanitizeGeneratedWebsite(html: string, css: string): { html: string; css: string } {
  return { html: sanitizeGeneratedHtml(html), css: ensureResponsiveGallery(sanitizeGeneratedCss(css)) };
}

/**
 * Forza l'iframe Google Maps corretto nel HTML generato dall'AI.
 *
 * L'AI spesso ignora l'iframe del prompt e ne costruisce uno suo con solo
 * l'indirizzo (es. "Via Dante Alighieri") senza città → Google risolve a
 * un'altra località (es. Rozzano invece di Cagliari). Questo post-process:
 * - sostituisce QUALSIASI iframe google maps con l'URL deterministico
 *   `https://www.google.com/maps?q=<indirizzo+città>&output=embed`
 * - se NON c'è un iframe maps ma c'è una sezione contatti, lo INIETTA
 */
export function enforceMapIframe(html: string, contacts: string): string {
  if (!html || !contacts) return html;
  const address = sanitizeMapAddress(contacts);
  if (!address) return html;
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
  const iframeTag = `<iframe src="${mapSrc}" width="100%" height="400" style="border:0;" allowfullscreen="" loading="lazy" title="Mappa"></iframe>`;
  const iframeRe = /<iframe[^>]*src\s*=\s*["'][^"']*google\.com\/maps[^"']*["'][^>]*>[\s\S]*?<\/iframe>/gi;
  if (iframeRe.test(html)) {
    return html.replace(iframeRe, iframeTag);
  }
  // Mappa mancante: inietta nella sezione contatti (prima del </section>)
  const contactSectionRe = /(<section[^>]*id\s*=\s*["']contatti["'][^>]*>[\s\S]*?)(<\/section>)/i;
  if (contactSectionRe.test(html)) {
    return html.replace(contactSectionRe, `$1<div class="map-embed">${iframeTag}</div>$2`);
  }
  return html;
}
