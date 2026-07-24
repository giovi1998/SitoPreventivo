/**
 * TB-023: cattura un elemento DOM come immagine base64 JPEG.
 * Usata per screenshot preview da inviare a MiniMax M3 (vision feedback).
 *
 * L'SVG generato da `elementToSvg` viene caricato come data URL
 * (`data:image/svg+xml;charset=utf-8,...`): la versione precedente usava
 * un blob URL che veniva revocato PRIMA del `resolve`, quindi il secondo
 * `loadImage` falliva sempre nei browser reali e la cattura tornava null.
 *
 * Fallback: se l'elemento non è renderizzato o il browser non supporta
 * canvas, restituisce null.
 */
export async function captureElementAsBase64(
  element: HTMLElement | null,
  options: { maxWidth?: number; quality?: number; type?: 'image/jpeg' | 'image/png' } = {}
): Promise<string | null> {
  if (!element) return null;
  const { maxWidth = 1024, quality = 0.85, type = 'image/jpeg' } = options;

  try {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const scale = Math.min(1, maxWidth / rect.width);
    const width = Math.round(rect.width * scale);
    const height = Math.round(rect.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // jsdom non supporta drawWindow/HTMLCanvasElement rendering; ritorna null.
    if (typeof (window as any).document?.documentElement?.scrollHeight !== 'number') return null;

    const svg = elementToSvg(element, rect);
    const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    const img = await loadImage(svgUrl);
    // JPEG non supporta trasparenza: senza sfondo esplicito, aree vuote del
    // wrapper (es. flyer con SVG su sfondo trasparente) diventano nere.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    return canvas.toDataURL(type, quality);
  } catch {
    return null;
  }
}

function elementToSvg(element: HTMLElement, rect: DOMRect): string {
  const clone = element.cloneNode(true) as HTMLElement;
  // Inline computed styles so external CSS variables/classes survive the
  // SVG foreignObject rasterization. Without this, previews relying on
  // CSS variables render as blank/default (e.g. card grid, background images).
  const sourceElements = Array.from(element.querySelectorAll('*')) as HTMLElement[];
  const clonedElements = Array.from(clone.querySelectorAll('*')) as HTMLElement[];
  sourceElements.forEach((src, i) => {
    const dst = clonedElements[i];
    if (!dst) return;
    const computed = window.getComputedStyle(src);
    const inline: string[] = [];
    for (let j = 0; j < computed.length; j++) {
      const prop = computed.item(j);
      inline.push(`${prop}:${computed.getPropertyValue(prop)}`);
    }
    if (inline.length) dst.setAttribute('style', inline.join(';'));
  });
  const rootComputed = window.getComputedStyle(element);
  const rootInline: string[] = [];
  for (let j = 0; j < rootComputed.length; j++) {
    const prop = rootComputed.item(j);
    rootInline.push(`${prop}:${rootComputed.getPropertyValue(prop)}`);
  }
  clone.setAttribute('style', rootInline.join(';'));

  // Wrap in an XHTML div so foreignObject has a single root with explicit size.
  const wrapper = document.createElement('div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrapper.style.width = rect.width + 'px';
  wrapper.style.height = rect.height + 'px';
  wrapper.style.display = 'inline-block';
  wrapper.appendChild(clone);

  const foreign = `
      <foreignObject x="0" y="0" width="${rect.width}" height="${rect.height}">
        ${encodeXml(wrapper.outerHTML)}
      </foreignObject>
    `;
  return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}"
           viewBox="0 0 ${rect.width} ${rect.height}">
        ${foreign}
      </svg>
    `;
}

function loadImage(src: string, timeoutMs = 5000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error('Image load timeout')), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Failed to load image'));
    };
    img.src = src;
  });
}

function encodeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function __testOnlyLoadImage(src: string): Promise<HTMLImageElement> {
  return loadImage(src);
}
