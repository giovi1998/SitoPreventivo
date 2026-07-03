import type { Flyer } from '../documentSchemas';
import { getFlyerDimensions, FLYER_BLEED_MM } from '../documentSchemas';
import { applyWatermarkToCanvas, getDpiForTier, getMaxPngSideForTier, type Tier } from '../watermark';
import { buildFlyerSvg } from './svgRenderer';

const DPI = 300;

export interface FlyerExportOptions {
  tier: Tier;
}

export async function generateFlyerPng(flyer: Flyer, options: FlyerExportOptions): Promise<Uint8Array> {
  const tierDpi = getDpiForTier(options.tier, DPI, 'png');
  const maxSide = getMaxPngSideForTier(options.tier);
  const dims = getFlyerDimensions(flyer);
  const totalWmm = dims.w + FLYER_BLEED_MM * 2;
  const totalHmm = dims.h + FLYER_BLEED_MM * 2;
  let widthPx = Math.round(totalWmm * tierDpi / 25.4);
  let heightPx = Math.round(totalHmm * tierDpi / 25.4);
  if (widthPx > maxSide || heightPx > maxSide) {
    const ratio = maxSide / Math.max(widthPx, heightPx);
    widthPx = Math.round(widthPx * ratio);
    heightPx = Math.round(heightPx * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D non disponibile');

  const svg = buildFlyerSvg(flyer);
  const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
  const svgUrl = URL.createObjectURL(svgBlob);
  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        ctx.drawImage(img, 0, 0, widthPx, heightPx);
        URL.revokeObjectURL(svgUrl);
        resolve();
      } catch (e) { reject(e); }
    };
    img.onerror = (e) => { URL.revokeObjectURL(svgUrl); reject(new Error('SVG non rasterizzabile')); };
    img.src = svgUrl;
  });

  applyWatermarkToCanvas(ctx, options.tier, widthPx, heightPx);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Esportazione PNG fallita');
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}
