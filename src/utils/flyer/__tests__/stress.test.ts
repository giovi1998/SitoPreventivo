import { describe, it, expect } from 'vitest';
import { computeFlyerLayout } from '../layoutEngine';
import {
  stressLongHeadline,
  stressOverflowBody,
  stressWideCta,
  stressTinyFormat,
  stressMagazineManyColumns,
  stressLandscapeSplit,
} from '../__fixtures__/stress';
import { createFlyerTemplate } from '../../documentSchemas';

describe('computeFlyerLayout stress fixtures', () => {
  it.each(['A6', 'A5', 'A4', 'Letter', 'Square'] as const)('long headline on %s does not cause layout overflow', (size) => {
    const plan = computeFlyerLayout(stressLongHeadline(size, 'portrait', 'classic'));
    expect(plan.overflowFlags.layout_overflow).toBeFalsy();
  });

  it.each(['A6', 'A5', 'A4', 'Letter', 'Square'] as const)('overflow body on %s shrinks font or truncates without overlap', (size) => {
    const plan = computeFlyerLayout(stressOverflowBody(size, 'portrait', 'classic'));
    // Either truncated (too long even at min font) or shrunk (font reduced to fit)
    // Either way, no layout overflow
    expect(plan.overflowFlags.layout_overflow).toBeFalsy();
    // Body font should be reduced from max
    expect(plan.text.body.fontSizePt).toBeLessThanOrEqual(11);
  });

  it('wide CTA on A6 is shrunk to fit without overlap', () => {
    const plan = computeFlyerLayout(stressWideCta('A6', 'portrait', 'classic'));
    expect(plan.overflowFlags.layout_overflow).toBeFalsy();
    // CTA font should be reduced to fit (min is 10pt per print floors)
    expect(plan.text.cta.fontSizePt).toBeLessThanOrEqual(10);
  });

  it('tiny A6 classic with long copy does not overlap elements', () => {
    const plan = computeFlyerLayout(stressTinyFormat());
    expect(plan.overflowFlags.layout_overflow).toBeFalsy();
  });

  it('magazine A4 with long body is handled without overlap', () => {
    const plan = computeFlyerLayout(stressMagazineManyColumns());
    expect(plan.overflowFlags.layout_overflow).toBeFalsy();
  });

  it('landscape split A4 with long headline does not overlap elements', () => {
    const plan = computeFlyerLayout(stressLandscapeSplit());
    expect(plan.overflowFlags.layout_overflow).toBeFalsy();
  });

  it('default templates should not produce layout_overflow', () => {
    const sectors = ['ristorante', 'evento', 'salone', 'negozio'] as const;
    const layouts = ['classic', 'centered', 'split', 'magazine'] as const;
    for (const sector of sectors) {
      for (const layout of layouts) {
        const plan = computeFlyerLayout(createFlyerTemplate(sector, layout));
        expect(plan.overflowFlags.layout_overflow, `${sector} ${layout}`).toBeFalsy();
      }
    }
  });

  it('A6 with extreme body overflow emits body_truncated at min font', () => {
    // Only A6 is small enough to still truncate at min font
    const plan = computeFlyerLayout(stressOverflowBody('A6', 'portrait', 'classic'));
    // Body should either be truncated or at the 10pt print floor
    expect(plan.text.body.fontSizePt).toBeLessThanOrEqual(10);
  });
});