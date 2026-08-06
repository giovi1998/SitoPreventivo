import { escapeXml } from '../xml';

const META_NAME_RE = /<meta[^>]+name\s*=\s*["']([^"']+)["'][^>]*>/gi;
const META_PROPERTY_RE = /<meta[^>]+property\s*=\s*["']([^"']+)["'][^>]*>/gi;
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const HEAD_RE = /<head[^>]*>[\s\S]*?<\/head>/i;
const META_DESC_RE = /<meta[^>]+name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["']/i;

const EMOJI_RE = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;
const WHITESPACE_RE = /\s+/g;

/**
 * Sanitizza un testo libero (es. descrizione del brief) per i meta tag:
 * rimuove emoji, a capo letterali e spazi ripetuti. L'AI nel prompt vede
 * la descrizione con emoji/premi; nei meta non devono finire (HTML invalido
 * e incoerenze col testo della pagina).
 */
function sanitizeMetaText(raw: string, maxLen: number): string {
  return raw
    .replace(EMOJI_RE, '')
    .replace(WHITESPACE_RE, ' ')
    .trim()
    .slice(0, maxLen);
}

/**
 * Rimuove il tag <link rel="canonical"> se punta a un dominio social
 * (instagram/facebook/tiktok/linkedin/x.com/twitter/youtube): l'AI lo
 * inventa spesso dal social del brief e i motori tratterebbero il profilo
 * social come versione canonica del sito (problema SEO critico).
 */
const SOCIAL_DOMAINS = [
  'instagram.com',
  'facebook.com',
  'fb.com',
  'tiktok.com',
  'linkedin.com',
  'x.com',
  'twitter.com',
  'youtube.com',
  'youtu.be',
];

export function stripSocialCanonical(html: string): string {
  if (!html) return html;
  return html.replace(/<link[^>]*rel\s*=\s*["']canonical["'][^>]*>/gi, (tag) => {
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
    if (!href) return tag;
    try {
      const host = new URL(href).hostname.replace(/^www\./, '').toLowerCase();
      if (SOCIAL_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) {
        return '';
      }
    } catch {
      // URL invalido: il tag resta, il browser lo ignora
    }
    return tag;
  });
}

/**
 * Inietta meta description + OG tags nel <head> se mancanti.
 * - MAI duplicare tag esistenti (regex name/property).
 * - Inseriti DOPO charset/viewport (ordine corretto del head).
 * - Contenuto sanitizzato (no emoji, no a capo letterali).
 * - `og:description` coerente: usa la `meta description` esistente se
 *   presente, altrimenti la descrizione del brief.
 */
export function ensureSeoMeta(
  html: string,
  brief: { businessName: string; description: string },
): string {
  if (!html) return html;
  const headMatch = html.match(HEAD_RE);
  if (!headMatch) return html;
  let head = headMatch[0];

  // Sanitizza il contenuto dei meta/og GIÀ presenti: l'AI a volte inietta
  // emoji o a capo direttamente nel content dei tag generati (es. il brief
  // con premi "🦐 Tre coni\n@gambero_rosso").
  const cleanHead = head
    .replace(/(<(?:meta|link)[^>]*content\s*=\s*["'])([^"']*)(["'])/gi, (_m, pre, val: string, post) => {
      const cleaned = val.replace(EMOJI_RE, '').replace(WHITESPACE_RE, ' ').trim();
      return cleaned !== val ? `${pre}${cleaned}${post}` : _m;
    });
  if (cleanHead !== head) head = cleanHead;

  const existing = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = META_NAME_RE.exec(head)) !== null) existing.add(m[1].toLowerCase());
  while ((m = META_PROPERTY_RE.exec(head)) !== null) existing.add(m[1].toLowerCase());

  const title = (head.match(TITLE_RE)?.[1] ?? '').trim();
  const siteName = brief.businessName.trim();
  const metaDesc = head.match(META_DESC_RE)?.[1]?.trim() ?? '';
  const desc = metaDesc || sanitizeMetaText(brief.description, 200);
  const ogDesc = metaDesc || sanitizeMetaText(brief.description, 300);

  const tags: string[] = [];
  if (!existing.has('description') && desc) {
    tags.push(`<meta name="description" content="${escapeXml(desc)}">`);
  }
  if (title && !existing.has('og:title')) {
    tags.push(`<meta property="og:title" content="${escapeXml(title)}">`);
  }
  if (ogDesc && !existing.has('og:description')) {
    tags.push(`<meta property="og:description" content="${escapeXml(ogDesc)}">`);
  }
  if (!existing.has('og:type')) {
    tags.push(`<meta property="og:type" content="website">`);
  }
  if (siteName && !existing.has('og:site_name')) {
    tags.push(`<meta property="og:site_name" content="${escapeXml(siteName)}">`);
  }
  if (tags.length === 0) return html;

  // Dopo charset/viewport (o subito dopo <head> se assenti): i meta OG non
  // devono comparire prima dei meta charset/viewport (head invalido).
  const charsetIdx = head.search(/<meta[^>]*charset/i);
  const viewportIdx = head.search(/<meta[^>]*name\s*=\s*["']viewport["']/i);
  const insertAt = Math.max(charsetIdx, viewportIdx);
  if (insertAt === -1) {
    return html.replace(headMatch[0], `${head}\n${tags.join('\n')}`);
  }
  const closeIdx = head.indexOf('>', insertAt);
  const after = head.slice(0, closeIdx + 1);
  const tail = head.slice(closeIdx + 1);
  return html.replace(headMatch[0], `${after}\n${tags.join('\n')}${tail}`);
}
