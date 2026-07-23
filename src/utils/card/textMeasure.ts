/**
 * Measure text width using a shared offscreen canvas when available.
 *
 * In Node/jsdom environments (tests) canvas text measurement may not be
 * available; in that case we fall back to the previous heuristic
 * `avgCharW = fontSize * 0.52`. This keeps tests deterministic while giving
 * real browsers the benefit of accurate font metrics.
 */

let canvasCtx: CanvasRenderingContext2D | null | undefined;

function getCanvasContext(): CanvasRenderingContext2D | null {
  if (canvasCtx !== undefined) return canvasCtx;
  if (typeof document === 'undefined') {
    canvasCtx = null;
    return canvasCtx;
  }
  const canvas = document.createElement('canvas');
  canvasCtx = canvas.getContext('2d');
  return canvasCtx;
}

/**
 * Reset the cached canvas context. Exposed mainly for tests that need to
 * simulate a missing canvas environment.
 */
export function resetMeasureContext(): void {
  canvasCtx = undefined;
}

export interface MeasureTextOptions {
  fontSize: number;
  fontFamily?: string;
  fontWeight?: string | number;
  letterSpacing?: number;
}

/**
 * Measure the width of a string in pixels.
 *
 * Falls back to `fontSize * 0.52 * length` when canvas measurement is not
 * available or the requested font cannot be measured.
 */
export function measureTextWidth(text: string, options: MeasureTextOptions): number {
  if (!text) return 0;
  const ctx = getCanvasContext();
  if (!ctx) {
    return text.length * options.fontSize * 0.52;
  }
  const weight = options.fontWeight ?? 'normal';
  const family = options.fontFamily || 'Inter, system-ui, sans-serif';
  const size = `${options.fontSize}px`;
  ctx.font = `${weight} ${size} ${family}`;
  try {
    const metrics = ctx.measureText(text);
    return metrics.width;
  } catch {
    return text.length * options.fontSize * 0.52;
  }
}

/**
 * Estimate how many characters fit in `maxWidthPx` for the given font.
 *
 * The estimate is based on real measurement when possible and uses a simple
 * bisection over character count. This is used by the SVG text wrapper as a
 * safer default than the old fixed 0.52 factor.
 */
export function estimateCharsForWidth(maxWidthPx: number, options: MeasureTextOptions): number {
  if (maxWidthPx <= 0 || options.fontSize <= 0) return 1;
  const sample = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const sampleWidth = measureTextWidth(sample, options);
  const avgCharW = sampleWidth / sample.length || options.fontSize * 0.52;
  return Math.max(1, Math.floor(maxWidthPx / avgCharW));
}
