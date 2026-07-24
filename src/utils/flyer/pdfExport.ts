import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Flyer } from '../documentSchemas';
import { getFlyerDimensions, FLYER_BLEED_MM } from '../documentSchemas';
import { applyWatermarkToPdf, type Tier } from '../watermark';
import { buildFlyerSvg } from './svgRenderer';

pdfMake.vfs = pdfFonts;

const PT_PER_MM = 2.83464567;

function mmToPt(mm: number): number {
  return mm * PT_PER_MM;
}

export interface FlyerExportOptions {
  tier: Tier;
}

export async function generateFlyerPdf(flyer: Flyer, options: FlyerExportOptions): Promise<Uint8Array> {
  const dims = getFlyerDimensions(flyer);
  const svg = buildFlyerSvg(flyer);
  const docDefinition: any = {
    pageSize: { width: mmToPt(dims.w), height: mmToPt(dims.h) },
    pageMargins: [mmToPt(FLYER_BLEED_MM), mmToPt(FLYER_BLEED_MM), mmToPt(FLYER_BLEED_MM), mmToPt(FLYER_BLEED_MM)],
    content: [{ svg, width: mmToPt(dims.w - FLYER_BLEED_MM * 2), height: mmToPt(dims.h - FLYER_BLEED_MM * 2), absolutePosition: { x: 0, y: 0 } }],
    info: { title: flyer.title || 'Volantino' },
  };
  const withWatermark = applyWatermarkToPdf(docDefinition, options.tier);
  return await new Promise<Uint8Array>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout generazione PDF volantino')), 20_000);
    try {
      const doc = (pdfMake as any).createPdf(withWatermark);
      if (typeof doc.getBlob === 'function') {
        const maybePromise = doc.getBlob(async (blob: Blob) => {
          try {
            const ab = await blob.arrayBuffer();
            clearTimeout(timeout);
            resolve(new Uint8Array(ab));
          } catch (e) {
            clearTimeout(timeout);
            reject(e);
          }
        });
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise
            .then(async (blob: Blob) => {
              const ab = await blob.arrayBuffer();
              clearTimeout(timeout);
              resolve(new Uint8Array(ab));
            })
            .catch((e: unknown) => { clearTimeout(timeout); reject(e); });
        }
        return;
      }
      const maybePromise = doc.getBuffer((buf: Uint8Array) => {
        clearTimeout(timeout);
        resolve(new Uint8Array(buf));
      });
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise
          .then((buf: Uint8Array) => { clearTimeout(timeout); resolve(new Uint8Array(buf)); })
          .catch((e: unknown) => { clearTimeout(timeout); reject(e); });
      }
    } catch (e) {
      clearTimeout(timeout);
      reject(e);
    }
  });
}
