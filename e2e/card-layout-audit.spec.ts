import { test, expect } from '@playwright/test';
import {
  loginAsTestUser,
  openCardEditor,
  applyGiovanniTemplate,
  setGridOn,
  selectGridSide,
  selectGridElement,
  moveGrid,
  resetScroll,
  exportCard,
  parseCardSvg,
  auditExportSvg,
  type GridElementKey,
} from './helpers/cardHarness';

test.describe('Card layout event audit', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await openCardEditor(page);
    await applyGiovanniTemplate(page);
  });

  test('moving an element emits a blocked event on collision', async ({ page }) => {
    await setGridOn(page, true);
    // Move name left into photo cell (collision in Giovanni split grid).
    await selectGridElement(page, 'name');
    await moveGrid(page, 'left');

    const events = await page.evaluate(() => (window as any).__cardLayoutEvents ?? []);
    const moveEvents = events.filter((e: any) => e.type === 'grid.move');
    expect(moveEvents.length).toBeGreaterThan(0);

    const last = moveEvents[moveEvents.length - 1];
    expect(last.result).toBe('blocked');
    expect(last.reason).toBe('collision');
    expect(last.element).toBe('name');
  });

  test('successful move emits ok event', async ({ page }) => {
    await setGridOn(page, true);
    await selectGridSide(page, 'back');
    await selectGridElement(page, 'socials');

    // Socials has room to move up
    await moveGrid(page, 'up');

    const events = await page.evaluate(() => (window as any).__cardLayoutEvents ?? []);
    const okMove = events.find((e: any) => e.type === 'grid.move' && e.result === 'ok');
    expect(okMove).toBeTruthy();
    expect(okMove.element).toBe('socials');
  });

  test('export emits start and success events', async ({ page }) => {
    await exportCard(page, 'svg-front');

    const events = await page.evaluate(() => (window as any).__cardLayoutEvents ?? []);
    const start = events.find((e: any) => e.type === 'export.start');
    const success = events.find((e: any) => e.type === 'export.success');

    expect(start).toBeTruthy();
    expect(start.payload?.action).toBe('svg-front');
    expect(success).toBeTruthy();
  });

  test('back SVG export passes layout audit', async ({ page }) => {
    const { buffer } = await exportCard(page, 'svg-back');
    const svg = buffer.toString('utf8');
    const parsed = parseCardSvg(svg);

    // Reconstruct the card as parsed from the SVG (not enough context for a
    // full BusinessCard object, so we build a minimal shape matching audit needs).
    const card = {
      front: { name: 'GIOVANNI CIDU' },
      back: {
        phone: '35180008042',
        email: 'webdevcaglian@gmail.com',
        website: 'https://giovannicidu.vercel.app',
        socials: [
          { platform: 'LinkedIn', url: 'https://linkedin.com' },
          { platform: 'GitHub', url: 'https://github.com' },
        ],
      },
    } as any;

    const audit = auditExportSvg('back', svg, card);
    expect(audit.ok, `audit errors: ${audit.findings.filter((f) => f.severity === 'error').map((f) => f.message).join('; ')}`).toBe(true);
  });
});
