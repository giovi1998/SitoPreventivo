import { test, expect, type Page } from '@playwright/test';
import { seedAuth } from './helpers/cardHarness';

async function loginAndOpenFlyer(page: Page) {
  await page.goto('/login');
  await seedAuth(page);
  await page.goto('/app/flyer');
  await page.waitForSelector('[data-testid="flyer-preview"]', { timeout: 15000 });
  await page.waitForTimeout(500);
}

// Scope helpers: manual panel uses "Immagine hero", AI panel uses "Hero Image".
const manualPanel = (page: Page) => page.locator('section[aria-label="Controllo manuale volantino"]');
const aiPanel = (page: Page) => page.locator('section[aria-label="AI Assist del volantino"]');

test.describe('Flyer hero AI entry point', () => {
  test('manual panel shows only upload, AI panel shows generate button for non-centered layouts', async ({ page }: { page: Page }) => {
    await loginAndOpenFlyer(page);

    const manual = manualPanel(page);
    const ai = aiPanel(page);

    // Open manual panel and hero section (default layout is classic, has hero).
    await manual.locator('.panel-kicker').first().click();
    await page.waitForTimeout(300);
    await manual.getByText('Immagine hero').first().click();
    await page.waitForTimeout(300);

    // Manual panel must have file upload and helper text.
    await expect(manual.getByLabel(/Carica immagine hero/i)).toBeVisible();
    await expect(manual.getByText(/usa il pannello AI Assist/i)).toBeVisible();

    // Manual panel must NOT have AI generate button.
    await expect(manual.getByRole('button', { name: /Genera hero AI/i })).not.toBeVisible();

    // AI panel must have generate button.
    await ai.locator('.panel-kicker').first().click();
    await page.waitForTimeout(300);
    await ai.getByText('Hero Image').first().click();
    await page.waitForTimeout(300);
    await expect(ai.getByRole('button', { name: /Genera hero AI/i })).toBeVisible();
  });

  test('centered layout hides hero section in both panels', async ({ page }: { page: Page }) => {
    await loginAndOpenFlyer(page);

    const manual = manualPanel(page);

    // Switch to centered layout from manual panel.
    await manual.locator('.panel-kicker').first().click();
    await page.waitForTimeout(300);
    await manual.getByText('Layout').first().click();
    await page.waitForTimeout(300);
    await manual.getByRole('button', { name: /Centrato/i }).first().click();
    await page.waitForTimeout(500);

    // No hero section in manual panel.
    await expect(manual.getByText('Immagine hero').first()).not.toBeVisible();
    await expect(manual.getByLabel(/Carica immagine hero/i)).not.toBeVisible();

    // No hero section in AI panel.
    const ai = aiPanel(page);
    await ai.locator('.panel-kicker').first().click();
    await page.waitForTimeout(300);
    await expect(ai.getByText('Hero Image').first()).not.toBeVisible();
    await expect(ai.getByRole('button', { name: /Genera hero AI/i })).not.toBeVisible();
  });
});
