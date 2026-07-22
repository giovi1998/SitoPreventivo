/**
 * Mobile vs Desktop parity audit (TB-023).
 *
 * Verifies that the card editor renders the same card content on mobile
 * (tabs + bottom sheet) and desktop (3-col + AI rail), and that the
 * mobile grid editor applies the SAME canonical presets as desktop
 * (regression: mobile used duplicated fallback presets where photo h:4
 * overlapped logo at row 3).
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import {
  loginAsTestUser,
  openCardEditor,
  applyGiovanniTemplate,
  fillSampleCard,
  setGridOn,
  selectGridPreset,
  screenshotDir,
} from './helpers/cardHarness';

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

test.describe('Card mobile vs desktop parity', () => {
  test('same card content on mobile (tabs) and desktop (3-col)', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await loginAsTestUser(page);
    await openCardEditor(page);
    await fillSampleCard(page);

    const shotDir = await screenshotDir();

    // Desktop: 3-col layout, no tabs.
    await expect(page.locator('[data-testid="card-preview-front"]')).toContainText('Mario Rossi');
    await expect(page.locator('[data-testid="card-editor-tabs"]')).toHaveCount(0);
    await page.screenshot({ path: path.join(shotDir, 'parity-desktop-editor.png') });

    // Mobile: tabs visible, preview tab shows the same content.
    await page.setViewportSize(MOBILE);
    await page.waitForTimeout(400);
    await expect(page.locator('[data-testid="card-editor-tabs"]')).toBeVisible();
    await expect(page.locator('[data-testid="card-preview-front"]')).toContainText('Mario Rossi');
    await page.screenshot({ path: path.join(shotDir, 'parity-mobile-preview-tab.png') });

    // Mobile "Modifica" tab exposes the same form fields as desktop.
    await page.locator('[data-testid="tab-edit"]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('label.card-field').filter({ hasText: /nome/i }).first()).toBeVisible();
    await page.screenshot({ path: path.join(shotDir, 'parity-mobile-edit-tab.png') });

    // Mobile back preview shows the same contacts as desktop would.
    await page.locator('[data-testid="tab-preview"]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="card-preview-back"]')).toContainText('+39 012 345 6789');
  });

  test('mobile preset left: photo cell spans 3 rows (no photo/logo overlap regression)', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await loginAsTestUser(page);
    await openCardEditor(page);
    // Giovanni template includes a photo, so the photo grid element is
    // rendered (canonical presets filter elements without content).
    await applyGiovanniTemplate(page);

    // Grid ON (toggle is in the preview tab on mobile).
    await setGridOn(page, true);

    // Apply preset "left" from the MOBILE grid editor (bottom of preview tab).
    const mobileEditor = page.locator('[data-testid="mobile-grid-editor"]');
    await expect(mobileEditor).toBeVisible();
    await selectGridPreset(page, 'left');
    await page.waitForTimeout(400);

    // Canonical gridPresetLeft: photo {x:0,y:0,w:2,h:3} → rows 1-3.
    // The old mobile fallback had photo h:4 overlapping the logo row.
    const photoCell = page.locator('[data-testid="grid-el-photo"]');
    await expect(photoCell).toBeVisible();
    await expect(photoCell).toHaveCSS('grid-row', /1 \/ span 3/);

    const shotDir = await screenshotDir();
    await page.screenshot({ path: path.join(shotDir, 'parity-mobile-preset-left.png') });
  });

  test('desktop preset left: photo cell spans 3 rows (same canonical preset)', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await loginAsTestUser(page);
    await openCardEditor(page);
    await applyGiovanniTemplate(page);

    await setGridOn(page, true);
    await selectGridPreset(page, 'left');
    await page.waitForTimeout(400);

    const photoCell = page.locator('[data-testid="grid-el-photo"]');
    await expect(photoCell).toBeVisible();
    await expect(photoCell).toHaveCSS('grid-row', /1 \/ span 3/);
  });
});
