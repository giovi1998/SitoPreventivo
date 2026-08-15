import type { BusinessCard, Logo, Flyer } from './documentSchemas';
import { mergeCardWithDefaults, mergeFlyerWithDefaults, mergeLogoWithDefaults } from './documentSchemas';
import { builderToSvg, sanitizeSvg } from './logoGenerator';
import { buildCardSvg } from './card/svgRenderer';
import { buildFlyerSvg } from './flyer/svgRenderer';
import { buildQuotePreviewSvg } from './quote/quotePreviewImage';
import { migrateFromLegacy, type PremiumQuote } from './quoteSchema';

/**
 * Genera SVG inline per preview (Collection, CRM CustomerDetail).
 * - logo: `builderToSvg` + sanitize, ritorna stringa SVG con viewBox.
 * - card: `buildCardSvg` lato front (no rotazione, no font import per
 *   leggerezza), ritorna SVG con viewBox 0 0 pxW pxH.
 * - flyer: `mergeFlyerWithDefaults` + `buildFlyerSvg` (viewBox in mm).
 * - quote: `buildQuotePreviewSvg` su PremiumQuote; se il doc è legacy
 *   flat, prima `migrateFromLegacy` poi preview.
 * Ritorna stringa vuota se il documento non è renderizzabile.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildPreviewSvg(doc: any): string {
  try {
    if (doc.documentType === 'logo' && doc.builder) {
      // Merge defaults (come card/flyer): doc vecchi/parziali senza campi
      // builder (layout, textScale, ...) produrrebbero SVG con NaN o
      // crasherebbero in getViewBox → thumbnail vuota.
      return sanitizeSvg(builderToSvg(mergeLogoWithDefaults(doc as Partial<Logo>).builder));
    }
    if (doc.documentType === 'businessCard') {
      const card = mergeCardWithDefaults(doc as Partial<BusinessCard>);
      // Preview front, dimensioni ridotte (il viewBox è in mm user units
      // ma renderizza scalato via CSS). Usiamo 320×200 px logici.
      return buildCardSvg(card, 'front', 320, 200, { embeddedFontCss: '' });
    }
    if (doc.documentType === 'flyer') {
      const flyer = mergeFlyerWithDefaults(doc as Partial<Flyer>);
      return buildFlyerSvg(flyer);
    }
    if (doc.documentType === 'quote') {
      // Doc unificato ha `quote` field (PremiumQuote); legacy flat ha
      // i campi sul doc stesso. migrateFromLegacy gestisce entrambi i
      // casi: se già PremiumQuote lo passa, se legacy lo converte.
      const quote = (doc.quote ?? migrateFromLegacy(doc)) as PremiumQuote;
      return buildQuotePreviewSvg(quote);
    }
    if (doc.documentType === 'website') {
      return buildWebsitePreviewSvg(doc);
    }
  } catch {
    // Documento malformato/non idratabile: fallback icona.
  }
  return '';
}

function buildWebsitePreviewSvg(doc: any): string {
  const css = typeof doc.css === 'string' ? doc.css : '';
  const html = typeof doc.html === 'string' ? doc.html : '';
  if (!html && !css) return buildWebsitePlaceholderSvg(doc);

  const safeHtml = stripScripts(html).trim();
  if (!safeHtml) return buildWebsitePlaceholderSvg(doc);

  // Viewport fedele: se il CSS ha media query mobile, renderizza a 375px
  // (layout mobile vero), altrimenti 320px (layout desktop scalato).
  const mobile = /@media[^{]*max-width\s*:\s*(768|767|640|480)\s*px/.test(css);
  const w = mobile ? 375 : 320;
  const h = Math.round(w * 0.625);

  const bg = extractCssColor(css, ['--bg', '--background']) || '#ffffff';
  const safeCss = scopeCss(css, '.ws-preview').replace(/<\/style/gi, '<\\/style');
  const pageCount = Array.isArray(doc.pages) ? doc.pages.length : 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="${escapeXml(bg)}"/>
    <foreignObject x="0" y="0" width="${w}" height="${h}">
      <div xmlns="http://www.w3.org/1999/xhtml" class="ws-preview" style="width:${w}px;height:${h}px;overflow:hidden">
        <style>${safeCss}</style>
        ${safeHtml}
      </div>
    </foreignObject>
    ${pageCount > 1 ? `<rect x="${w - 46}" y="${h - 22}" width="38" height="14" rx="7" fill="#1a1a2e" opacity="0.75"/><text x="${w - 27}" y="${h - 12}" text-anchor="middle" font-family="sans-serif" font-size="8" fill="#ffffff">${pageCount} p.</text>` : ''}
  </svg>`;
}

function stripScripts(html: string): string {
  return html.replace(/<script\b[\s\S]*?<\/script\s*>/gi, '').replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

function buildWebsitePlaceholderSvg(doc: any): string {
  const name = doc.brief?.businessName || doc.title || 'Sito Web';
  const pages = Array.isArray(doc.pages) ? doc.pages.length : 1;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120" width="200" height="120">
    <rect width="200" height="120" rx="8" fill="#f0f4f8"/>
    <circle cx="100" cy="35" r="18" fill="#01696F" opacity="0.15"/>
    <circle cx="100" cy="35" r="10" fill="#01696F" opacity="0.3"/>
    <circle cx="100" cy="35" r="4" fill="#01696F"/>
    <line x1="60" y1="35" x2="140" y2="35" stroke="#01696F" stroke-width="1.5" opacity="0.4"/>
    <line x1="100" y1="17" x2="100" y2="53" stroke="#01696F" stroke-width="1.5" opacity="0.4"/>
    <text x="100" y="75" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="600" fill="#1a1a2e">${escapeXml(name)}</text>
    <text x="100" y="92" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#8896ab">${pages} pagina${pages !== 1 ? 'e' : ''}</text>
    <rect x="60" y="100" width="80" height="14" rx="7" fill="#01696F" opacity="0.1"/>
    <text x="100" y="111" text-anchor="middle" font-family="sans-serif" font-size="7" fill="#01696F">Sito Web</text>
  </svg>`;
}

/**
 * Scoping CSS per preview SVG (foreignObject): prefixa ogni regola con
 * `scope` così il CSS del sito non inquina l'app host. `:root`/`html`/
 * `body` → scope stesso (il wrapper div è il "body" della preview).
 * At-rules: @media/@supports ricorsivi, @keyframes/@font-face globali.
 */
function scopeCss(css: string, scope: string): string {
  const result: string[] = [];
  let head = '';
  let body = '';
  let depth = 0;
  let inComment = false;
  let inString: string | null = null;
  const append = (ch: string) => {
    if (depth > 0) body += ch;
    else head += ch;
  };

  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    const next = css[i + 1];
    if (inComment) {
      if (ch === '*' && next === '/') { inComment = false; i++; }
      continue;
    }
    if (inString) {
      if (ch === '\\') { append(ch + (css[i + 1] ?? '')); i++; continue; }
      append(ch);
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '/' && next === '*') { inComment = true; i++; continue; }
    if (ch === '"' || ch === "'") { inString = ch; append(ch); continue; }
    if (ch === '{') {
      depth++;
      if (depth === 1) body = '';
      else append(ch);
      continue;
    }
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        flush(head, body);
        head = '';
        body = '';
      } else {
        append(ch);
      }
      continue;
    }
    append(ch);
  }
  if (head.trim()) flush(head, '');
  return result.join('\n');

  function flush(h: string, b: string) {
    const t = h.trim();
    if (!t) return;
    const bTrim = b.trim();
    if (t.startsWith('@media') || t.startsWith('@supports')) {
      result.push(`${t} {\n${scopeCss(bTrim, scope)}\n}`);
    } else if (t.startsWith('@keyframes') || t.startsWith('@-webkit-keyframes') || t.startsWith('@font-face') || t.startsWith('@page')) {
      result.push(`${t} { ${bTrim} }`);
    } else if (t.startsWith('@import') || t.startsWith('@charset')) {
      if (bTrim) result.push(`${t} { ${bTrim} }`);
    } else if (t === ':root' || t === 'html') {
      result.push(`${scope} { ${bTrim} }`);
    } else {
      const scopedSelectors = t.split(',').map((s) => {
        const sel = s.trim();
        if (!sel) return sel;
        const replaced = sel
          .replace(/^body(?=[.#:[\] ]|$)/, scope)
          .replace(/^html(?=[.#:[\] ]|$)/, scope);
        return replaced === sel ? `${scope} ${sel}` : replaced;
      }).join(',\n');
      result.push(`${scopedSelectors} { ${bTrim} }`);
    }
  }
}

function extractCssColor(css: string, keys: string[]): string | null {
  for (const key of keys) {
    const m = css.match(new RegExp(`${key}\\s*:\\s*(#[0-9a-fA-F]{3,8}|rgb\\([^)]+\\)|rgba?\\([^)]+\\))`));
    if (m) return normalizeCssColor(m[1]);
  }
  return null;
}

function normalizeCssColor(color: string): string | null {
  const c = color.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c)) return c;
  if (/^rgba?\(/.test(c)) {
    const nums = c.match(/(\d+(?:\.\d+)?)/g)?.map(Number) || [];
    if (nums.length < 3) return null;
    return `rgb(${Math.min(255, Math.max(0, Math.round(nums[0])))},${Math.min(255, Math.max(0, Math.round(nums[1])))},${Math.min(255, Math.max(0, Math.round(nums[2])))})`;
  }
  return null;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
