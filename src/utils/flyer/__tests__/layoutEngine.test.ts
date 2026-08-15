import { describe, it, expect } from 'vitest';
import { createFlyerTemplate, FLYER_SIZES, FLYER_LAYOUTS, type FlyerSize, type FlyerOrientation, type FlyerLayout } from '../../documentSchemas';
import { computeFlyerLayout, magazineColumnCount } from '../layoutEngine';
import { rectInside, rectsOverlap } from '../geometry';

const FLYER_SECTORS = ['ristorante', 'evento', 'salone', 'negozio'] as const;
const ORIENTATIONS: FlyerOrientation[] = ['portrait', 'landscape'];

function cloneWithOrientation(flyer: ReturnType<typeof createFlyerTemplate>, orientation: FlyerOrientation) {
  return { ...flyer, orientation };
}

function cloneWithSize(flyer: ReturnType<typeof createFlyerTemplate>, size: FlyerSize) {
  return { ...flyer, size };
}

function cloneWithLayout(flyer: ReturnType<typeof createFlyerTemplate>, layout: FlyerLayout) {
  return { ...flyer, style: { ...flyer.style, layout } };
}

function visibleBoxes(plan: ReturnType<typeof computeFlyerLayout>) {
  return Object.entries(plan.boxes)
    .filter(([id]) => plan.visibility[id as keyof typeof plan.visibility])
    .map(([, box]) => box!);
}

describe('computeFlyerLayout 144-case matrix', () => {
  for (const sector of FLYER_SECTORS) {
    for (const layout of FLYER_LAYOUTS) {
      for (const size of FLYER_SIZES) {
        for (const orientation of ORIENTATIONS) {
          if (size === 'Square' && orientation === 'landscape') continue;
          it(`${sector}/${layout}/${size}/${orientation}`, () => {
            const base = createFlyerTemplate(sector, layout);
            const flyer = cloneWithOrientation(cloneWithSize(base, size), orientation);
            const plan = computeFlyerLayout(flyer);
            const boxes = visibleBoxes(plan);

            // No overlaps
            for (let i = 0; i < boxes.length; i++) {
              for (let j = i + 1; j < boxes.length; j++) {
                expect(rectsOverlap(boxes[i], boxes[j])).toBe(false);
              }
            }

            // All visible boxes inside safe area
            for (const box of boxes) {
              expect(rectInside(box, plan.page.safe, 0.1)).toBe(true);
            }

            // QR min size respected when visible
            if (plan.visibility.qr && plan.boxes.qr) {
              expect(plan.boxes.qr.w).toBeGreaterThanOrEqual(16);
              expect(plan.boxes.qr.h).toBeGreaterThanOrEqual(16);
            }

            // Density not overflow for the template's default size/orientation
            const defaultSize = base.size;
            const defaultOrientation = base.orientation;
            if (size === defaultSize && orientation === defaultOrientation) {
              expect(plan.density).not.toBe('overflow');
            }
          });
        }
      }
    }
  }
});

describe('magazineColumnCount', () => {
  it('A6 always returns 1', () => {
    expect(magazineColumnCount('A6', 100)).toBe(1);
  });
  it('A5 returns 2', () => {
    expect(magazineColumnCount('A5', 100)).toBe(2);
  });
  it('Square returns 2', () => {
    expect(magazineColumnCount('Square', 100)).toBe(2);
  });
  it('A4 returns 3 when enough vertical space', () => {
    expect(magazineColumnCount('A4', 100)).toBe(3);
  });
  it('A4 returns 2 when vertical space is very small', () => {
    expect(magazineColumnCount('A4', 20)).toBe(2);
  });
});

describe('computeFlyerLayout overflow warnings', () => {
  it('emits body_truncated when body is too long', () => {
    const flyer = createFlyerTemplate('ristorante', 'classic');
    flyer.content.body = 'x '.repeat(2000);
    const plan = computeFlyerLayout(flyer);
    expect(plan.warnings.some((w) => w.code === 'body_truncated')).toBe(true);
    expect(plan.overflowFlags.body).toBe(true);
  });
});

describe('fontScale print floors', () => {
  it('fontScale 0.7 never pushes the body minimum below 10pt', () => {
    const flyer = createFlyerTemplate('ristorante', 'classic');
    flyer.style.fontScale = 0.7;
    flyer.content.body = 'parola '.repeat(800);
    const plan = computeFlyerLayout(flyer);
    expect(plan.text.body.fontSizePt).toBeGreaterThanOrEqual(10);
  });

  it('fontScale 0.7 never pushes the headline minimum below 24pt', () => {
    const flyer = createFlyerTemplate('ristorante', 'classic');
    flyer.style.fontScale = 0.7;
    flyer.content.headline = 'Titolo Molto Lungo Che Non Entra Anche Rimpicciolito Al Minimo';
    const plan = computeFlyerLayout(flyer);
    expect(plan.text.headline.fontSizePt).toBeGreaterThanOrEqual(24);
  });
});
