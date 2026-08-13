/**
 * Inietta il logo reale nel HTML generato dall'AI.
 *
 * L'AI NON deve mai generare il logo (prompt lo vieta): viene iniettato qui
 * DOPO la generazione, in ordine: .brand → .nav-inner → <header> → body.
 *
 * ⚠️ Il CSS generato dall'AI può stilizzare `.site-logo` con `!important`
 * (background, border, padding, box-shadow, height) — l'AI tende a mettere
 * `!important` ovunque. Per resistere, usiamo una classe UNICA
 * (`qb-site-logo`) che l'AI non conosce + stili inline con `!important`.
 * Senza, il logo finisce dentro una scatola beige con bordo e ombra.
 */
export function injectLogoIntoHtml(html: string, logoUrl: string | null): string {
  if (!logoUrl) return html;
  const logoHtml = `<div class="qb-site-logo" style="display:flex!important;align-items:center!important;gap:12px!important;flex-shrink:0!important;background:transparent!important;border:none!important;box-shadow:none!important;padding:0!important;">
  <img src="${logoUrl}" alt="Logo" style="height:40px!important;width:auto!important;max-width:180px!important;object-fit:contain!important;display:block!important;background:transparent!important;border:none!important;box-shadow:none!important;padding:0!important;border-radius:0!important;margin:0!important;" />
</div>`;
  let cleaned = html.replace(/<img[^>]*src\s*=\s*"data:image[^"]*"[^>]*\/?>/gi, '');
  cleaned = cleaned.replace(/<span[^>]*class\s*=\s*"[^"]*brand-mark[^"]*"[^>]*>.*?<\/span>/gi, '');
  // Inject inside .brand div if present (stessa riga del nome attività).
  // MAI dentro .footer-brand / .footer-col: il logo va nella nav, non nel footer.
  const brandDiv = findBrandDiv(cleaned);
  if (brandDiv) {
    return cleaned.replace(brandDiv[0], `${brandDiv[1]}${logoHtml}${brandDiv[2]}${brandDiv[3]}`);
  }
  const navInnerMatch = cleaned.match(/(<div[^>]*class\s*=\s*"[^"]*\bnav-inner\b[^"]*"[^>]*>)([\s\S]*?)(<\/div>)/i);
  if (navInnerMatch) {
    return cleaned.replace(navInnerMatch[0], `${navInnerMatch[1]}${logoHtml}${navInnerMatch[2]}${navInnerMatch[3]}`);
  }
  const headerContent = cleaned.match(/(<header[^>]*>)([\s\S]*?)(<\/header>)/i);
  if (headerContent) {
    return cleaned.replace(headerContent[0], `${headerContent[1]}${logoHtml}${headerContent[2]}${headerContent[3]}`);
  }
  const firstTagMatch = cleaned.match(/<body[^>]*>/i) || cleaned.match(/<(main|section|div|h1|header|nav|article)[^>]*>/i);
  if (firstTagMatch) {
    return cleaned.replace(firstTagMatch[0], `${firstTagMatch[0]}\n${logoHtml}`);
  }
  return cleaned + '\n' + logoHtml;
}

/** Trova il primo <div class="...brand..."> che NON sia footer-brand/footer-col né dentro un <footer>. */
function findBrandDiv(html: string): RegExpMatchArray | null {
  const re = /(<div[^>]*class\s*=\s*"([^"]*\bbrand\b[^"]*)"[^>]*>)([\s\S]*?)(<\/div>)/gi;
  let m: RegExpMatchArray | null;
  while ((m = re.exec(html)) !== null) {
    const cls = m[2] || '';
    if (/\bfooter-/i.test(cls)) continue;
    // Esclude i brand dentro <footer> (es. <div class="brand"> in footer-brand)
    const before = html.slice(0, m.index);
    const lastFooterOpen = before.lastIndexOf('<footer');
    const lastFooterClose = before.lastIndexOf('</footer>');
    if (lastFooterOpen > lastFooterClose) continue;
    return m;
  }
  return null;
}

/**
 * Rimuove il blocco logo iniettato (qb-site-logo) dall'HTML. Serve per i
 * prompt AI (refine): il base64 del logo non deve viaggiare nel contesto.
 */
export function stripLogoFromHtml(html: string): string {
  return html.replace(/<div class="qb-site-logo"[\s\S]*?<\/div>\s*/gi, '');
}
