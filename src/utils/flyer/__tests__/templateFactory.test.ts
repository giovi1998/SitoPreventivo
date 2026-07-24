import { describe, it, expect } from 'vitest';
import { createFlyerTemplate, getSectorLabel, getLayoutLabel, getSizeLabel, FLYER_SECTORS } from '../templateFactory';

describe('createFlyerTemplate', () => {
  it('creates all 16 sector/layout combinations', () => {
    for (const sector of FLYER_SECTORS) {
      for (const layout of ['classic', 'centered', 'split', 'magazine'] as const) {
        const flyer = createFlyerTemplate(sector, layout);
        expect(flyer.documentType).toBe('flyer');
        expect(flyer.style.layout).toBe(layout);
        expect(flyer.content.headline).toBeTruthy();
      }
    }
  });

  it('uses default layout when layout is omitted', () => {
    const flyer = createFlyerTemplate('ristorante');
    expect(flyer.style.layout).toBe('classic');
  });

  it('labels are correct', () => {
    expect(getSectorLabel('ristorante')).toBe('Ristorante');
    expect(getLayoutLabel('classic')).toBe('Classico');
    expect(getSizeLabel('A5')).toBe('A5 (148×210mm)');
  });
});
