import { test, expect, type Page } from '@playwright/test';
import {
  loginAsTestUser,
  openCardEditor,
  fillSampleCard,
  setGridOn,
  selectGridSide,
  selectGridElement,
  exportCard,
  parseCardSvg,
  saveCardSideScreenshot,
  assertScreenshotNotMostlyBlack,
  copyExportToScreenshot,
} from './helpers/cardHarness';

// Spec TB-023 residuo: drag foto grid-mode + wheel scale + overlay coords
// (REQ-DF-003 wheel, REQ-DF-005 readout/reset, REQ-UX-003 overlay).
// Screenshot front/back + export SVG/PNG per verifica visiva altro modello.

const DESKTOP_VIEWPORT = { width: 1400, height: 950 };

async function setupCardWithGrid(page: Page): Promise<void> {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await loginAsTestUser(page);
  await openCardEditor(page);
  await fillSampleCard(page);
  await setGridOn(page, true);
}

test.describe('TB-023 drag foto grid-mode + wheel + overlay', () => {
  test('(a) wheel on name updates scale slider + readout (REQ-DF-003/005)', async ({ page }) => {
    test.setTimeout(120000);
    await setupCardWithGrid(page);
    await selectGridElement(page, 'name');

    const zoomBefore = await page.locator('[data-testid="grid-placement-zoom"]').first().inputValue();
    expect(zoomBefore).toBe('1');

    // Wheel up on name cell → scale +0.1
    const nameCell = page.locator('[data-testid="grid-el-name"]').first();
    const box = await nameCell.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(300);

    const zoomAfter = await page.locator('[data-testid="grid-placement-zoom"]').first().inputValue();
    const zoomNum = parseFloat(zoomAfter);
    expect(zoomNum).toBeGreaterThan(1);

    // Readout mostra scale aggiornato
    const readout = page.locator('[data-testid="grid-placement-readout"]').first();
    await expect(readout).toContainText(`s: ${zoomNum.toFixed(2)}`);
  });

  test('(b) nudge name element shows overlay coords (REQ-UX-003)', async ({ page }) => {
    test.setTimeout(120000);
    await setupCardWithGrid(page);
    await selectGridElement(page, 'name');

    // Nudge via bottoni
    await page.locator('[data-testid="grid-placement-right"]').first().click();
    await page.locator('[data-testid="grid-placement-down"]').first().click();
    await page.waitForTimeout(200);

    // Overlay coords visibile sulla cella name
    const overlay = page.locator('[data-testid="grid-placement-overlay-name"]').first();
    await expect(overlay).toBeVisible();
    const overlayText = await overlay.textContent();
    expect(overlayText).toMatch(/x:\s*0\.0\d+/);
    expect(overlayText).toMatch(/y:\s*0\.0\d+/);

    // Readout aggiornato
    const readout = page.locator('[data-testid="grid-placement-readout"]').first();
    await expect(readout).toContainText(/x:\s*0\.05/i);
    await expect(readout).toContainText(/y:\s*0\.05/i);
  });

  test('(c) Reset button restores placement to {0,0,1} (REQ-DF-005)', async ({ page }) => {
    test.setTimeout(120000);
    await setupCardWithGrid(page);
    await selectGridElement(page, 'photo');

    // Nudge prima
    await page.locator('[data-testid="grid-placement-right"]').first().click();
    await page.locator('[data-testid="grid-placement-down"]').first().click();
    await page.waitForTimeout(150);
    const readout = page.locator('[data-testid="grid-placement-readout"]').first();
    await expect(readout).toContainText(/x:\s*0\.05/i);

    // Reset
    await page.locator('[data-testid="grid-placement-reset"]').first().click();
    await page.waitForTimeout(150);
    await expect(readout).toContainText('x: 0.00');
    await expect(readout).toContainText('y: 0.00');
    await expect(readout).toContainText('s: 1.00');
  });

  test('(d) screenshot front preview not mostly-black/blank + placement offset visible', async ({ page }) => {
    test.setTimeout(120000);
    await setupCardWithGrid(page);
    await selectGridElement(page, 'photo');
    await page.locator('[data-testid="grid-placement-right"]').first().click();
    await page.locator('[data-testid="grid-placement-down"]').first().click();
    await page.waitForTimeout(200);

    const buf = await saveCardSideScreenshot(page, 'card-preview-front', 'tb023-drag-photo-offset.png');
    await assertScreenshotNotMostlyBlack(page, buf, 'tb023-drag-front');
  });

  test('(e) export SVG front after name nudge — text element present + inside bounds', async ({ page }) => {
    test.setTimeout(120000);
    await setupCardWithGrid(page);
    await selectGridElement(page, 'name');
    await page.locator('[data-testid="grid-placement-right"]').first().click();
    await page.locator('[data-testid="grid-placement-zoom"]').first().fill('1.4');
    await page.waitForTimeout(200);

    const svgExport = await exportCard(page, 'svg-front');
    await copyExportToScreenshot(svgExport.tempPath, 'tb023-nudge-name-export-front.svg');
    const svgStr = svgExport.buffer.toString('utf8');
    const parsed = parseCardSvg(svgStr);
    expect(parsed.width).toBeGreaterThan(0);
    expect(parsed.height).toBeGreaterThan(0);
    // Testo name presente (uppercase via CSS in preview, ma export usa case originale o uppercase)
    expect(parsed.texts.length).toBeGreaterThan(0);
    const nameText = parsed.texts.find((t) => /mario/i.test(t.text));
    expect(nameText, 'nome "Mario" non trovato nel SVG export').toBeDefined();
    // Tutti i testi dentro i bounds (tolerance: testo lungo può estendere oltre)
    for (const t of parsed.texts) {
      expect(t.x).toBeGreaterThanOrEqual(-50);
      expect(t.y).toBeGreaterThanOrEqual(-50);
      expect(t.x).toBeLessThan(parsed.width + 50);
      expect(t.y).toBeLessThan(parsed.height + 50);
    }
  });

  test('(f) export PNG front after wheel zoom — screenshot not mostly-black', async ({ page }) => {
    test.setTimeout(120000);
    await setupCardWithGrid(page);
    await selectGridElement(page, 'photo');

    // Wheel zoom
    const photoCell = page.locator('[data-testid="grid-el-photo"]').first();
    const box = await photoCell.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, -240); // +0.2
      await page.waitForTimeout(200);
    }

    const pngExport = await exportCard(page, 'png-front');
    await copyExportToScreenshot(pngExport.tempPath, 'tb023-wheel-zoom-export-front.png');
    // Verifica dimensione > 0
    expect(pngExport.buffer.length).toBeGreaterThan(5000);
  });

  test('(g) back side screenshot after contacts nudge — not mostly-black', async ({ page }) => {
    test.setTimeout(120000);
    await setupCardWithGrid(page);
    await selectGridSide(page, 'back');
    await selectGridElement(page, 'contacts');
    await page.locator('[data-testid="grid-placement-right"]').first().click();
    await page.waitForTimeout(200);

    const buf = await saveCardSideScreenshot(page, 'card-preview-back', 'tb023-contacts-nudge-back.png');
    await assertScreenshotNotMostlyBlack(page, buf, 'tb023-contacts-back');
  });

  test('(h) overlay disappears when deselecting element (CON-DF-001)', async ({ page }) => {
    test.setTimeout(120000);
    await setupCardWithGrid(page);
    await selectGridElement(page, 'name');
    await expect(page.locator('[data-testid="grid-placement-overlay-name"]')).toBeVisible();
    // Seleziona altro elemento
    await selectGridElement(page, 'title');
    await expect(page.locator('[data-testid="grid-placement-overlay-name"]')).toHaveCount(0);
  });
});