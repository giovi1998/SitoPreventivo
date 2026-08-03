export function injectLogoIntoHtml(html: string, logoUrl: string | null): string {
  if (!logoUrl) return html;
  const logoHtml = `<div class="site-logo-wrapper" style="display:flex;align-items:center;gap:12px;"><img src="${logoUrl}" alt="Logo" class="site-logo" style="height:40px;width:auto;object-fit:contain;" /></div>`;
  let cleaned = html.replace(/<img[^>]*src\s*=\s*"data:image[^"]*"[^>]*\/?>/gi, '');
  cleaned = cleaned.replace(/<span[^>]*class\s*=\s*"[^"]*brand-mark[^"]*"[^>]*>.*?<\/span>/gi, '');
  // Inject inside .nav-inner or .brand div if present (same row as menu)
  const brandMatch = cleaned.match(/(<div[^>]*class\s*=\s*"[^"]*\bbrand\b[^"]*"[^>]*>)([\s\S]*?)(<\/div>)/i);
  if (brandMatch) {
    return cleaned.replace(brandMatch[0], `${brandMatch[1]}${logoHtml}${brandMatch[2]}${brandMatch[3]}`);
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
