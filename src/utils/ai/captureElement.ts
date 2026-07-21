/**
 * TB-023: cattura un elemento DOM come immagine base64 JPEG.
 * Usata per screenshot preview da inviare a MiniMax M3 (vision feedback).
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

    const svgData = await elementToSvg(element, rect, scale);
    const img = await loadImage(svgData);
    URL.revokeObjectURL(svgData);
    ctx.drawImage(img, 0, 0, width, height);

    return canvas.toDataURL(type, quality);
  } catch {
    return null;
  }
}

function elementToSvg(element: HTMLElement, rect: DOMRect, scale: number): Promise<string> {
  return new Promise((resolve, reject) => {
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
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}"
           viewBox="0 0 ${rect.width} ${rect.height}">
        ${foreign}
      </svg>
    `;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG image'));
    };
    img.src = url;
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
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
