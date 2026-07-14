import { test, expect } from '@playwright/test';
import {
  loginAsTestUser,
  openCardEditor,
  fillSampleCard,
  setGridOn,
  selectGridSide,
  selectGridElement,
  selectGridPreset,
  moveGrid,
  alignGrid,
  exportCard,
  resetScroll,
} from './helpers/cardHarness';

test.describe('Card grid round-trip: preview -> export', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await openCardEditor(page);
    await fillSampleCard(page);
    await page.waitForTimeout(400);
  });

  test('Moving company down reflects in preview and front SVG export', async ({ page }) => {
    await setGridOn(page, true);
    await selectGridPreset(page, 'left');
    await selectGridElement(page, 'company');

    const companyCell = page.locator('[data-testid="grid-el-company"]').first();
    await companyCell.scrollIntoViewIfNeeded();
    const beforeGridRow = await companyCell.evaluate((el) => window.getComputedStyle(el).gridRow);

    await moveGrid(page, 'down');
    await page.waitForTimeout(200);

    await resetScroll(page);
    await companyCell.scrollIntoViewIfNeeded();
    const afterGridRow = await companyCell.evaluate((el) => window.getComputedStyle(el).gridRow);

    expect(afterGridRow).not.toBe(beforeGridRow);

    await page.screenshot({ path: 'e2e/__screenshots__/roundtrip-move-company-preview.png', fullPage: false });

    const { buffer } = await exportCard(page, 'svg-front');
    const svg = buffer.toString('utf8');
    expect(svg).toContain('WebdevCA');

    await page.screenshot({ path: 'e2e/__screenshots__/roundtrip-move-company-export.png', fullPage: false });
  });

  test('3x3 alignment (bottom-right) reflects in preview and front SVG export', async ({ page }) => {
    await setGridOn(page, true);
    await selectGridPreset(page, 'left');
    await selectGridElement(page, 'name');

    await alignGrid(page, 'right', 'bottom');

    const nameCell = page.locator('[data-testid="grid-el-name"]').first();
    await expect(nameCell).toBeVisible();
    const alignItems = await nameCell.evaluate((el) => window.getComputedStyle(el).alignItems);
    const justifyContent = await nameCell.evaluate((el) => window.getComputedStyle(el).justifyContent);
    expect(['flex-end', 'end']).toContain(alignItems);
    expect(['flex-end', 'end', 'right']).toContain(justifyContent);

    await page.screenshot({ path: 'e2e/__screenshots__/roundtrip-align-name-preview.png', fullPage: false });

    const { buffer } = await exportCard(page, 'svg-front');
    const svg = buffer.toString('utf8');
    expect(svg).toContain('MARIO ROSSI');
  });

  test('Adding services reflects in back preview and back SVG export', async ({ page }) => {
    await page.locator('[data-testid="card-add-service"]').first().click();
    await page.waitForTimeout(200);
    await page.locator('[data-testid="card-add-service"]').first().click();
    await page.waitForTimeout(200);

    const serviceInputs = await page.locator('input[aria-label^="Servizio "]').all();
    await serviceInputs[0].fill('Sviluppo Web');
    await serviceInputs[1].fill('Consulenza SEO');
    await page.waitForTimeout(400);

    const back = page.locator('[data-testid="card-preview-back"]').first();
    await expect(back).toContainText('Sviluppo Web');
    await expect(back).toContainText('Consulenza SEO');

    await page.screenshot({ path: 'e2e/__screenshots__/roundtrip-services-preview.png', fullPage: false });

    const { buffer } = await exportCard(page, 'svg-back');
    const svg = buffer.toString('utf8');
    expect(svg).toContain('Sviluppo Web');
    expect(svg).toContain('Consulenza SEO');
  });

  test('Back grid: socials stay in their own cell in SVG export', async ({ page }) => {
    await page.locator('[data-testid="card-add-social"]').first().click();
    await page.waitForTimeout(200);
    await page.locator('[data-testid="card-add-social"]').first().click();
    await page.waitForTimeout(200);

    const socialRows = await page.locator('.card-social-row').all();
    expect(socialRows.length).toBeGreaterThanOrEqual(2);

    await socialRows[0].locator('select').first().selectOption('LinkedIn');
    await socialRows[0].locator('input').first().fill('https://linkedin.com/in/mario');
    await socialRows[1].locator('select').first().selectOption('GitHub');
    await socialRows[1].locator('input').first().fill('https://github.com/mario');
    await page.waitForTimeout(400);

    const { buffer } = await exportCard(page, 'svg-back');
    const svg = buffer.toString('utf8');
    expect(svg).toContain('LinkedIn');
    expect(svg).toContain('GitHub');

    await page.screenshot({ path: 'e2e/__screenshots__/roundtrip-socials-preview.png', fullPage: false });
  });

  test('Back grid 3x3 alignment for contacts and services reflects in SVG export', async ({ page }) => {
    await setGridOn(page, true);

    await selectGridSide(page, 'back');
    await page.waitForTimeout(300);

    await page.locator('[data-testid="card-add-service"]').first().click();
    await page.waitForTimeout(200);
    const serviceInputs = await page.locator('input[aria-label^="Servizio "]').all();
    await serviceInputs[0].fill('UX Design');
    await page.waitForTimeout(400);

    await selectGridElement(page, 'contacts');
    await alignGrid(page, 'right', 'bottom');

    await selectGridElement(page, 'services');
    await alignGrid(page, 'center', 'center');

    await page.screenshot({ path: 'e2e/__screenshots__/roundtrip-back-align-preview.png', fullPage: false });

    const { buffer } = await exportCard(page, 'svg-back');
    const svg = buffer.toString('utf8');
    expect(svg).toContain('UX Design');
    expect(svg).toContain('TELEFONO');

    await page.screenshot({ path: 'e2e/__screenshots__/roundtrip-back-align-export.png', fullPage: false });
  });

  test('Back grid move + services + export PNG/PDF are non-empty', async ({ page }) => {
    await setGridOn(page, true);

    await selectGridSide(page, 'back');
    await page.waitForTimeout(300);

    await page.locator('[data-testid="card-add-service"]').first().click();
    await page.waitForTimeout(200);
    await page.locator('[data-testid="card-add-service"]').first().click();
    await page.waitForTimeout(200);
    const serviceInputs = await page.locator('input[aria-label^="Servizio "]').all();
    await serviceInputs[0].fill('UX Design');
    await serviceInputs[1].fill('Brand Identity');
    await page.waitForTimeout(400);

    await selectGridElement(page, 'qr');
    await moveGrid(page, 'left');

    await page.screenshot({ path: 'e2e/__screenshots__/roundtrip-back-move-services-preview.png', fullPage: false });

    const { buffer: pngBuffer } = await exportCard(page, 'png-back');
    expect(pngBuffer[0]).toBe(0x89);
    expect(pngBuffer[1]).toBe(0x50);
    expect(pngBuffer.length).toBeGreaterThan(10000);

    const { buffer: pdfBuffer } = await exportCard(page, 'pdf');
    expect(pdfBuffer.toString('utf8', 0, 5)).toBe('%PDF-');
    expect(pdfBuffer.length).toBeGreaterThan(1000);
  });
});
