import { describe, expect, it } from 'vitest';
import {
  FLYER_SECTOR_DEFAULT_LAYOUT,
  FLYER_TEMPLATES_BY_SECTOR_LAYOUT,
  heroBoxMmForLayout,
} from '../templateCatalog';
import type { FlyerSector, FlyerLayout } from '../../documentSchemas';

describe('templateCatalog (TB-007)', () => {
  it('defines default layout for all 4 sectors', () => {
    const sectors: FlyerSector[] = ['ristorante', 'evento', 'salone', 'negozio'];
    sectors.forEach((s) => {
      expect(FLYER_SECTOR_DEFAULT_LAYOUT[s]).toBeDefined();
    });
  });

  it('contains templates for all 4 sectors x 4 layouts (16 total)', () => {
    const sectors: FlyerSector[] = ['ristorante', 'evento', 'salone', 'negozio'];
    const layouts: FlyerLayout[] = ['classic', 'centered', 'split', 'magazine'];

    sectors.forEach((sec) => {
      layouts.forEach((lay) => {
        const preset = FLYER_TEMPLATES_BY_SECTOR_LAYOUT[sec][lay];
        expect(preset).toBeDefined();
        expect(preset.headline.length).toBeGreaterThan(0);
        expect(preset.bgColor).toBeDefined();
        expect(preset.textColor).toBeDefined();
        expect(preset.accentColor).toBeDefined();
      });
    });
  });

  it('computes positive hero box dimensions for all layout types', () => {
    const layouts: FlyerLayout[] = ['classic', 'centered', 'split', 'magazine'];
    const dims = { w: 148, h: 210 }; // A5

    layouts.forEach((lay) => {
      const box = heroBoxMmForLayout(lay, dims);
      expect(box.w).toBeGreaterThan(0);
      expect(box.h).toBeGreaterThan(0);
    });
  });
});
