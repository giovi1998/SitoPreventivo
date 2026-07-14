import type { Flyer, FlyerSector, FlyerLayout } from '../documentSchemas';
import { createEmptyFlyer, getFlyerDimensions, FLYER_SECTOR_DEFAULT_LAYOUT, FLYER_SECTORS } from '../documentSchemas';
import { FLYER_TEMPLATES_BY_SECTOR_LAYOUT, heroBoxMmForLayout } from './templateCatalog';

export { FLYER_TEMPLATES_BY_SECTOR_LAYOUT, heroBoxMmForLayout, getFlyerDimensions };

export function getDefaultHeroImage(sector: FlyerSector, layout: FlyerLayout, size: Flyer['size'], orientation: Flyer['orientation']): string | null {
  const useLayout = layout ?? FLYER_SECTOR_DEFAULT_LAYOUT[sector];
  const tpl = FLYER_TEMPLATES_BY_SECTOR_LAYOUT[sector][useLayout];
  if (!tpl.imageSeed) return null;
  const box = heroBoxMmForLayout(useLayout, getFlyerDimensions({ ...createEmptyFlyer(), size, orientation }));
  let pxW = Math.round(box.w * 4);
  let pxH = Math.round(box.h * 4);
  const smaller = Math.min(pxW, pxH);
  if (smaller < 200) {
    const k = 200 / smaller;
    pxW = Math.round(pxW * k);
    pxH = Math.round(pxH * k);
  }
  return `https://picsum.photos/seed/${tpl.imageSeed}/${pxW}/${pxH}`;
}

export function createFlyerTemplate(sector: FlyerSector, layout?: FlyerLayout): Flyer {
  const now = new Date().toISOString();
  const useLayout = layout ?? FLYER_SECTOR_DEFAULT_LAYOUT[sector];
  const tpl = FLYER_TEMPLATES_BY_SECTOR_LAYOUT[sector][useLayout];
  const heroImage = tpl.imageSeed
    ? getDefaultHeroImage(sector, useLayout, tpl.size, tpl.orientation)
    : null;
  return {
    documentType: 'flyer',
    id: `flyer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: tpl.title,
    size: tpl.size,
    orientation: tpl.orientation,
    content: {
      headline: tpl.headline,
      subheadline: tpl.subheadline,
      body: tpl.body,
      cta: { ...tpl.cta },
      heroImage,
      qrPayload: '',
      qrLabel: tpl.qrLabel,
    },
    style: {
      bgColor: tpl.bgColor,
      textColor: tpl.textColor,
      accentColor: tpl.accentColor,
      layout: tpl.layout,
      fontFamily: 'Inter',
      fontScale: 1,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function getSectorLabel(sector: FlyerSector): string {
  const labels: Record<FlyerSector, string> = {
    ristorante: 'Ristorante', evento: 'Evento', salone: 'Salone', negozio: 'Negozio',
  };
  return labels[sector];
}

export function getLayoutLabel(layout: FlyerLayout): string {
  const labels: Record<FlyerLayout, string> = {
    classic: 'Classico', centered: 'Centrato', split: 'Diviso', magazine: 'Magazine',
  };
  return labels[layout];
}

export function getSizeLabel(size: Flyer['size']): string {
  const labels: Record<Flyer['size'], string> = {
    A6: 'A6 (105×148mm)', A5: 'A5 (148×210mm)', A4: 'A4 (210×297mm)', Letter: 'Letter (216×279mm)', Square: 'Square (210×210mm)',
  };
  return labels[size];
}

export { FLYER_SECTORS };
