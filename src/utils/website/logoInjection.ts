export function injectLogoIntoHtml(html: string, logoUrl: string | null): string {
  if (!logoUrl) return html;
  const logoHtml = `<div class="site-logo-wrapper" style="display:flex;align-items:center;padding:8px 16px;"><img src="${logoUrl}" alt="Logo" class="site-logo" style="height:40px;width:auto;object-fit:contain;" /></div>`;
  let cleaned = html.replace(/<img[^>]*src\s*=\s*"data:image[^"]*"[^>]*\/?>/gi, '');
  cleaned = cleaned.replace(/<span[^>]*class\s*=\s*"[^"]*brand-mark[^"]*"[^>]*>.*?<\/span>/gi, '');
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
