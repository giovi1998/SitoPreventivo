/**
 * Inietta le immagini caricate dal brief nel HTML generato dall'AI.
 *
 * Strategia:
 * 1. Se l'HTML ha `.gallery-item` vuoti → riempili con <img src="{base64}">.
 * 2. Se NON ci sono gallery item e ci sono immagini → aggiungi una sezione
 *    `#gallery` con griglia prima del footer (o in coda al body).
 * 3. Se l'AI ha generato gallery ma non ci sono immagini → rimuovi i
 *    `.gallery-item` vuoti (niente buchi grigi).
 */
export function injectImagesIntoHtml(html: string, images: string[]): string {
  if (!images || images.length === 0) {
    return removeEmptyGalleryItems(html);
  }

  let out = html;

  // Caso 1: gallery-item vuoti → riempi
  const itemRegex = /<div[^>]*class\s*=\s*"[^"]*\bgallery-item\b[^"]*"[^>]*>\s*<\/div>/gi;
  let itemIndex = 0;
  const filled = out.replace(itemRegex, (match) => {
    if (itemIndex >= images.length) return match;
    const img = images[itemIndex];
    itemIndex++;
    return `<div class="gallery-item"><img src="${img}" alt="Foto ${itemIndex}" loading="lazy" /></div>`;
  });
  if (filled !== out) {
    // Se sono state riempite, rimuovi eventuali gallery-item rimasti vuoti
    // (più immagini che item) e il wrapper gallery se completamente vuoto.
    out = removeEmptyGalleryItems(filled);
    return out;
  }

  // Caso 2: nessuna gallery → aggiungi sezione prima del footer
  const gallerySection = buildGallerySection(images);
  const footerMatch = out.match(/<footer[\s\S]*?<\/footer>/i);
  if (footerMatch) {
    out = out.replace(footerMatch[0], `${gallerySection}\n${footerMatch[0]}`);
  } else {
    out = out.replace(/<\/body>/i, `${gallerySection}\n</body>`);
  }
  return out;
}

function buildGallerySection(images: string[]): string {
  const items = images
    .map((img, i) => `<div class="gallery-item"><img src="${img}" alt="Foto ${i + 1}" loading="lazy" /></div>`)
    .join('\n');
  return `\n<section id="gallery" class="gallery-section">\n  <div class="section-inner">\n    <h2>Gallery</h2>\n    <div class="gallery" aria-label="Galleria foto">\n${items}\n    </div>\n  </div>\n</section>`;
}

function removeEmptyGalleryItems(html: string): string {
  let out = html.replace(/<div[^>]*class\s*=\s*"[^"]*\bgallery-item\b[^"]*"[^>]*>\s*<\/div>/gi, '');
  // Rimuovi il wrapper .gallery se è rimasto senza item
  out = out.replace(/<div[^>]*class\s*=\s*"[^"]*\bgallery\b[^"]*"[^>]*>\s*<\/div>/gi, '');
  // Rimuovi sezione gallery SOLO se non contiene immagini riempite
  out = out.replace(/<section[^>]*id\s*=\s*"gallery"[^>]*>([\s\S]*?)<\/section>/gi, (_m, inner: string) => {
    return inner.includes('<img') ? _m : '';
  });
  return out;
}
