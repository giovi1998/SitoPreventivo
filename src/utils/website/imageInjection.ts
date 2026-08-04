/**
 * Inietta le immagini caricate dal brief nel HTML generato dall'AI.
 *
 * Strategia:
 * 1. Se l'HTML ha `.gallery-item` (div O button) senza <img> → inietta le
 *    immagini reali. Se ci sono più immagini che item, aggiunge nuovi item.
 * 2. Se NON ci sono gallery item e ci sono immagini → aggiunge una sezione
 *    `#gallery` con griglia prima del footer.
 * 3. Se l'AI ha generato gallery ma non ci sono immagini → rimuove i
 *    `.gallery-item` vuoti (niente buchi grigi).
 */
export function injectImagesIntoHtml(html: string, images: string[]): string {
  if (!images || images.length === 0) {
    return removeEmptyGalleryItems(html);
  }

  let out = html;

  // Caso 1: gallery-item esistenti (div o button) → inietta immagini
  const itemRegex = /<(div|button)[^>]*class\s*=\s*"[^"]*\bgallery-item\b[^"]*"[^>]*>([\s\S]*?)<\/(?:div|button)>/gi;
  const items: Array<{ match: string; isDiv: boolean; inner: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(out)) !== null) {
    const isDiv = m[1].toLowerCase() === 'div';
    const inner = m[2];
    // Solo item SENZA <img> (quelli con img già hanno un'immagine reale)
    if (!/<img/i.test(inner)) {
      items.push({ match: m[0], isDiv, inner });
    }
  }

  if (items.length > 0) {
    let imgIndex = 0;
    const filled = out.replace(itemRegex, (match, tag: string, inner: string) => {
      if (/<img/i.test(inner)) return match;
      if (imgIndex >= images.length) return match;
      const img = images[imgIndex];
      imgIndex++;
      const imgHtml = `<img src="${img}" alt="Foto ${imgIndex}" loading="lazy" />`;
      const openTag = `<${tag}${match.slice(tag.length + 1, match.indexOf('>'))}>`;
      return `${openTag}${imgHtml}${inner}</${tag}>`;
    });
    out = filled;

    // Rimuovi eventuali item rimasti VUOTI (più item che immagini)
    out = out.replace(/<(div|button)[^>]*class\s*=\s*"[^"]*\bgallery-item\b[^"]*"[^>]*>\s*<\/(?:div|button)>/gi, '');

    // Se restano immagini non usate → aggiungi altri item
    if (imgIndex < images.length) {
      const extra = images.slice(imgIndex).map((img) =>
        `<div class="gallery-item"><img src="${img}" alt="Foto" loading="lazy" /></div>`
      ).join('\n');
      const galleryWrap = out.match(/(<div[^>]*class\s*=\s*"[^"]*\bgallery\b[^"]*"[^>]*>)([\s\S]*?)(<\/div>)/i);
      if (galleryWrap) {
        out = out.replace(galleryWrap[0], `${galleryWrap[1]}${galleryWrap[2]}\n${extra}${galleryWrap[3]}`);
      } else {
        out += `\n${extra}`;
      }
    }
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
  let out = html.replace(/<(div|button)[^>]*class\s*=\s*"[^"]*\bgallery-item\b[^"]*"[^>]*>\s*<\/(?:div|button)>/gi, '');
  // Rimuovi il wrapper .gallery se è rimasto senza item
  out = out.replace(/<div[^>]*class\s*=\s*"[^"]*\bgallery\b[^"]*"[^>]*>\s*<\/div>/gi, '');
  // Rimuovi sezione gallery SOLO se non contiene immagini riempite
  out = out.replace(/<section[^>]*id\s*=\s*"(?:gallery|galleria)"[^>]*>([\s\S]*?)<\/section>/gi, (_m, inner: string) => {
    return inner.includes('<img') ? _m : '';
  });
  return out;
}
