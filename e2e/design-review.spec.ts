import { test, expect, type Page } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import {
  loginAsTestUser,
  openCardEditor,
  fillSampleCard,
  applyGiovanniTemplate,
  assertScreenshotNotMostlyBlack,
} from './helpers/cardHarness';
import { sampleFlyer } from './fixtures';

const OUT_DIR =
  process.env.DESIGN_REVIEW_OUT ?? 'e2e/__screenshots__/design-review/prima';

async function dismissOnboarding(page: Page): Promise<void> {
  const overlay = page.locator('.onb-overlay').first();
  if (await overlay.count() === 0) return;
  const skip = page.locator('.onb-overlay button', { hasText: /Salta/i }).first();
  if (await skip.count() > 0) {
    await skip.click();
    await page.waitForTimeout(300);
  }
}

test.beforeAll(async () => {
  await fs.mkdir(OUT_DIR, { recursive: true });
});

test.describe('Design review baseline (prima)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 950 });
    await loginAsTestUser(page);
  });

  test('card front and back previews', async ({ page }) => {
    await openCardEditor(page);
    await fillSampleCard(page);
    await page.waitForTimeout(500);

    const front = page.locator('[data-testid="card-preview-front"]').first();
    await expect(front).toBeVisible();
    const frontBuf = await front.screenshot({ path: path.join(OUT_DIR, 'card-front.png') });
    await assertScreenshotNotMostlyBlack(page, frontBuf, 'card-front');

    const back = page.locator('[data-testid="card-preview-back"]').first();
    await expect(back).toBeVisible();
    const backBuf = await back.screenshot({ path: path.join(OUT_DIR, 'card-back.png') });
    await assertScreenshotNotMostlyBlack(page, backBuf, 'card-back');
  });

  test('card giovanni template (grid, photo, QR, services, socials)', async ({ page }) => {
    await openCardEditor(page);
    await applyGiovanniTemplate(page);
    await page.waitForTimeout(600);

    const front = page.locator('[data-testid="card-preview-front"]').first();
    await expect(front).toBeVisible();
    const frontBuf = await front.screenshot({ path: path.join(OUT_DIR, 'card-template-front.png') });
    await assertScreenshotNotMostlyBlack(page, frontBuf, 'card-template-front');

    const back = page.locator('[data-testid="card-preview-back"]').first();
    await expect(back).toBeVisible();
    const backBuf = await back.screenshot({ path: path.join(OUT_DIR, 'card-template-back.png') });
    await assertScreenshotNotMostlyBlack(page, backBuf, 'card-template-back');
  });

  test('logo preview with brand name and tagline', async ({ page }) => {
    await page.goto('/app/logo');
    await page.waitForSelector('[data-logo-preview]', { timeout: 10000 });
    await page.waitForTimeout(500);
    await dismissOnboarding(page);

    // Assicura il tab Builder (form manuale) dove vive il form nome/tagline.
    const builderTab = page.locator('.logo-tab', { hasText: /Builder/i }).first();
    if (await builderTab.count() > 0) {
      await builderTab.click();
      await page.waitForTimeout(300);
    }

    await page.locator('input[aria-label="Testo principale"]').first().fill('Quickbrand Studio');
    await page.locator('input[aria-label="Sottotitolo"]').first().fill('Design & AI per il tuo brand');
    await page.waitForTimeout(400);

    const preview = page.locator('aside.builder-preview [data-logo-preview]').first();
    await expect(preview).toBeVisible();
    const buf = await preview.screenshot({ path: path.join(OUT_DIR, 'logo.png') });
    await assertScreenshotNotMostlyBlack(page, buf, 'logo');
  });

  test('flyer preview with sampleFlyer content', async ({ page }) => {
    await page.goto('/app/flyer');
    await page.waitForSelector('[data-testid="flyer-preview"]', { timeout: 10000 });
    await page.waitForTimeout(500);
    await dismissOnboarding(page);

    await page.locator('input[placeholder="Es. Sagra del paese"]').first().fill(sampleFlyer.content.headline);
    await page.locator('input[placeholder="Es. 15 agosto, ingresso gratis"]').first().fill(sampleFlyer.content.subheadline);
    await page.locator('textarea[placeholder="Es. Cibo tipico, musica dal vivo, ingresso gratuito."]').first().fill(sampleFlyer.content.body);
    await page.waitForTimeout(800);

    const preview = page.locator('[data-flyer-preview]').first();
    await expect(preview).toBeVisible();
    const buf = await preview.screenshot({ path: path.join(OUT_DIR, 'flyer.png') });
    await assertScreenshotNotMostlyBlack(page, buf, 'flyer');
  });
});
