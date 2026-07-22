/**
 * Preview vs Export parity audit (TB-023).
 *
 * Covers the mismatches fixed in v2.16:
 * - grid-mode photo export has the accent border stroke (preview .card-photo border)
 * - QR nudge/placement is visible in preview (--card-photo-transform) and
 *   shifts the QR in the exported SVG
 * - decoration pattern renders in preview AND in the exported SVG
 *
 * Screenshots are saved for visual study (preview vs exported PNG).
 */
import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import {
  loginAsTestUser,
  openCardEditor,
  applyGiovanniTemplate,
  exportCard,
  setGridOn,
  selectGridSide,
  selectGridElement,
  parseCardSvg,
  screenshotDir,
} from './helpers/cardHarness';

test.describe('Card preview vs export parity', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await openCardEditor(page);
    await applyGiovanniTemplate(page);
  });

  test('grid-mode photo: preview visible, export has accent border stroke', async ({ page }) => {
    await setGridOn(page, true);

    const shotDir = await screenshotDir();
    const front = page.locator('[data-testid="card-preview-front"]').first();
    const photo = front.locator('.card-photo').first();
    await expect(photo).toBeVisible();
    await front.screenshot({ path: path.join(shotDir, 'parity-preview-front-grid.png') });

    const { buffer, tempPath } = await exportCard(page, 'svg-front');
    const svg = buffer.toString('utf8');
    await fs.copyFile(tempPath, path.join(shotDir, 'parity-export-front-grid.svg'));

    // Photo image present.
    const parsed = parseCardSvg(svg);
    const photoImg = parsed.images.find((i) => i.href.includes('giovanni-photo') || i.href.startsWith('data:image'));
    expect(photoImg, 'export must contain the photo image').toBeTruthy();

    // v2.16: accent border stroke around the photo (parity with .card-photo CSS).
    expect(svg, 'export must stroke the photo with the accent color').toMatch(
      /<rect[^>]*fill="none" stroke="#[0-9a-fA-F]{6}"[^>]*\/>/,
    );
  });

  test('QR nudge: preview transform var + export QR shifts', async ({ page }) => {
    await setGridOn(page, true);

    // Baseline export (no nudge).
    const { buffer: baseBuf } = await exportCard(page, 'svg-back');
    const baseParsed = parseCardSvg(baseBuf.toString('utf8'));
    expect(baseParsed.qrRects.length).toBeGreaterThan(0);
    const baseQrX = baseParsed.qrRects[0].x;

    // Select QR element and nudge placement right twice (desktop controls).
    await selectGridSide(page, 'back');
    await selectGridElement(page, 'qr');
    const nudge = page.locator('[data-testid="grid-placement-right"]');
    await nudge.click();
    await page.waitForTimeout(200);
    await nudge.click();
    await page.waitForTimeout(400);

    // Preview: the QR cell carries --card-photo-transform (consumed by
    // .card-back-qr CSS — v2.16 fix, previously photo-only).
    const qrCell = page.locator('[data-testid="grid-el-qr"]');
    await expect(qrCell).toBeVisible();
    const transformVar = await qrCell.evaluate(
      (el) => (el as HTMLElement).style.getPropertyValue('--card-photo-transform'),
    );
    expect(transformVar, 'preview QR cell must carry the placement transform').toContain('translate(');

    // Export: QR rect x shifts right compared to baseline.
    const { buffer: nudgedBuf } = await exportCard(page, 'svg-back');
    const nudgedParsed = parseCardSvg(nudgedBuf.toString('utf8'));
    expect(nudgedParsed.qrRects.length).toBeGreaterThan(0);
    expect(nudgedParsed.qrRects[0].x, 'export QR must move right after nudge').toBeGreaterThan(baseQrX);
  });

  test('decoration wave-bottom renders in preview AND export SVG', async ({ page }) => {
    // Apply a decoration pattern from the manual style fields.
    const decorationField = page.locator('[data-testid="card-decoration-field"]');
    await expect(decorationField).toBeVisible();
    await decorationField.locator('select').first().selectOption('wave-bottom');
    await page.waitForTimeout(400);

    // Preview: inline SVG pattern layer present on both sides.
    await expect(page.locator('[data-testid="card-preview-front"] svg.card-decorative-pattern')).toHaveCount(1);

    const shotDir = await screenshotDir();
    await page.locator('[data-testid="card-preview-front"]').first()
      .screenshot({ path: path.join(shotDir, 'parity-preview-front-wave.png') });

    // Export: wave path with the pattern present in the SVG.
    const { buffer, tempPath } = await exportCard(page, 'svg-front');
    const svg = buffer.toString('utf8');
    await fs.copyFile(tempPath, path.join(shotDir, 'parity-export-front-wave.svg'));
    expect(svg).toContain('<path');
    // The wave pattern group is emitted before the content (layer 0).
    const patternIdx = svg.indexOf('data-decorative-pattern');
    const nameIdx = svg.indexOf('GIOVANNI CIDU');
    expect(patternIdx, 'pattern layer must be present').toBeGreaterThan(-1);
    expect(patternIdx, 'pattern must render before the content').toBeLessThan(nameIdx);
  });
});
