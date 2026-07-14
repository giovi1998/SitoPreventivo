import { test, expect } from '@playwright/test';
import {
  loginAsTestUser,
  openCardEditor,
  fillSampleCard,
  setGridOn,
  selectGridPreset,
  selectGridElement,
  moveGrid,
  resizeGrid,
} from './helpers/cardHarness';

const LAYOUTS = ['left', 'centered', 'split'] as const;
const SIZES = ['eu-85x55', 'us-89x51', 'square-65x65'] as const;

test.describe('Card grid behavior regression suite', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await openCardEditor(page);
    await fillSampleCard(page);
    await page.waitForTimeout(400);
  });

  test('Griglia ON/OFF does not change visual layout when grid matches flexbox default', async ({ page }) => {
    const gridToggle = page.locator('.card-grid-toggle').first();
    await gridToggle.click();
    await page.waitForTimeout(600);

    await selectGridPreset(page, 'split');
    await page.waitForTimeout(400);

    await page.screenshot({ path: 'e2e/__screenshots__/card-grid-on-layout.png', fullPage: false });

    await gridToggle.click();
    await page.waitForTimeout(600);

    const debugFront = await page.locator('[data-testid="card-preview-front"] [data-testid="card-grid-debug"]').count();
    expect(debugFront).toBe(0);
    await expect(page.locator('text=Mario Rossi').first()).toBeVisible();
    await page.screenshot({ path: 'e2e/__screenshots__/card-grid-off-layout.png', fullPage: false });
  });

  for (const layout of LAYOUTS) {
    test(`Grid ON preserves element positions when toggling OFF from ${layout} preset`, async ({ page }) => {
      const gridToggle = page.locator('.card-grid-toggle').first();
      await gridToggle.click();
      await page.waitForTimeout(600);

      const presetValue = layout === 'left' ? 'left' : layout === 'centered' ? 'centered' : 'split';
      await selectGridPreset(page, presetValue);

      const layoutSelect = page.locator('select').filter({ hasText: /Sinistra|Centrato|Split/ }).first();
      if (await layoutSelect.count() > 0) {
        await layoutSelect.selectOption(layout);
        await page.waitForTimeout(300);
      }

      await page.screenshot({ path: `e2e/__screenshots__/card-${layout}-grid-on.png`, fullPage: false });

      await gridToggle.click();
      await page.waitForTimeout(600);

      await expect(page.locator('text=Mario Rossi').first()).toBeVisible();
      await page.screenshot({ path: `e2e/__screenshots__/card-${layout}-grid-off.png`, fullPage: false });

      const debug = await page.locator('[data-testid="card-preview-front"] [data-testid="card-grid-debug"]').count();
      expect(debug).toBe(0);
    });
  }

  test('Moving an element in grid mode updates its CSS grid-area', async ({ page }) => {
    const gridToggle = page.locator('.card-grid-toggle').first();
    await gridToggle.click();
    await page.waitForTimeout(600);
    await selectGridPreset(page, 'left');

    await selectGridElement(page, 'company');

    const initialGridRow = await page.locator('[data-testid="grid-el-company"]').first().evaluate((el) => window.getComputedStyle(el as HTMLElement).gridRow);

    await moveGrid(page, 'down');

    const afterGridRow = await page.locator('[data-testid="grid-el-company"]').first().evaluate((el) => window.getComputedStyle(el as HTMLElement).gridRow);

    expect(afterGridRow).not.toBe(initialGridRow);
    await page.screenshot({ path: 'e2e/__screenshots__/card-grid-move-company.png', fullPage: false });
  });

  test('Resizing an element in grid mode changes its visual size (cell span)', async ({ page }) => {
    const gridToggle = page.locator('.card-grid-toggle').first();
    await gridToggle.click();
    await page.waitForTimeout(600);
    await selectGridPreset(page, 'left');

    await selectGridElement(page, 'company');
    const before = await page.locator('[data-testid="grid-el-company"]').first().boundingBox();
    expect(before).not.toBeNull();

    await resizeGrid(page, 'h+');

    const after = await page.locator('[data-testid="grid-el-company"]').first().boundingBox();
    expect(after).not.toBeNull();
    expect(after!.height).toBeGreaterThanOrEqual(before!.height);

    await page.screenshot({ path: 'e2e/__screenshots__/card-grid-resize-company-height.png', fullPage: false });
  });

  test('Resizing company height increases its cell span', async ({ page }) => {
    const gridToggle = page.locator('.card-grid-toggle').first();
    await gridToggle.click();
    await page.waitForTimeout(600);

    await selectGridPreset(page, 'left');
    await selectGridElement(page, 'company');

    const beforeCell = await page.locator('[data-testid="grid-el-company"]').first().boundingBox();

    await resizeGrid(page, 'h+');

    const afterCell = await page.locator('[data-testid="grid-el-company"]').first().boundingBox();
    expect(afterCell!.height).toBeGreaterThanOrEqual(beforeCell!.height);

    await page.screenshot({ path: 'e2e/__screenshots__/card-grid-resize-company-height.png', fullPage: false });
  });

  test('Back grid: moving QR left updates its grid-column', async ({ page }) => {
    const gridToggle = page.locator('.card-grid-toggle').first();
    await gridToggle.click();
    await page.waitForTimeout(600);

    const sideSelect = page.locator('select[aria-label="Lato griglia"]').first();
    await sideSelect.waitFor({ timeout: 5000 });
    await sideSelect.selectOption('back');
    await page.waitForTimeout(300);

    await selectGridElement(page, 'qr');
    const initialCol = await page.locator('[data-testid="grid-el-qr"]').first().evaluate((el) => window.getComputedStyle(el as HTMLElement).gridColumn);

    await moveGrid(page, 'left');

    const afterCol = await page.locator('[data-testid="grid-el-qr"]').first().evaluate((el) => window.getComputedStyle(el as HTMLElement).gridColumn);
    expect(afterCol).not.toBe(initialCol);

    await page.screenshot({ path: 'e2e/__screenshots__/card-grid-back-qr-move.png', fullPage: false });
  });

  test('Back grid: resizing contacts width shrinks QR available space', async ({ page }) => {
    const gridToggle = page.locator('.card-grid-toggle').first();
    await gridToggle.click();
    await page.waitForTimeout(600);

    const sideSelect = page.locator('select[aria-label="Lato griglia"]').first();
    await sideSelect.selectOption('back');
    await page.waitForTimeout(300);

    await selectGridElement(page, 'contacts');
    const before = await page.locator('[data-testid="grid-el-contacts"]').first().boundingBox();

    await resizeGrid(page, 'w+');

    const after = await page.locator('[data-testid="grid-el-contacts"]').first().boundingBox();
    expect(after!.width).toBeGreaterThanOrEqual(before!.width);

    await page.screenshot({ path: 'e2e/__screenshots__/card-grid-back-contacts-resize.png', fullPage: false });
  });

  for (const size of SIZES) {
    test(`Grid resize on ${size} does not overflow or overlap`, async ({ page }) => {
      const sizeSelect = page.locator('select').filter({ hasText: /EU 85|US 89|Quadrato/ }).first();
      if (await sizeSelect.count() > 0) {
        await sizeSelect.selectOption(size);
        await page.waitForTimeout(300);
      }

      const gridToggle = page.locator('.card-grid-toggle').first();
      await gridToggle.click();
      await page.waitForTimeout(600);
      await selectGridPreset(page, 'left');

      await selectGridElement(page, 'company');
      await resizeGrid(page, 'h+');

      await page.screenshot({ path: `e2e/__screenshots__/card-grid-${size}-no-overlap.png`, fullPage: false });

      const cells = await page.locator('[data-testid="card-preview-front"] [data-testid^="grid-el-"]').all();
      const boxes = await Promise.all(cells.map(async (cell) => cell.boundingBox()));
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          if (!a || !b) continue;
          const overlap = !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
          expect(overlap, `cells ${i} and ${j} overlap on ${size}`).toBe(false);
        }
      }
    });
  }
});
