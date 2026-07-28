import { test, expect } from '@playwright/test';
import { seedAuth } from './helpers/cardHarness';

test.describe('QR editor — functional', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await seedAuth(page);
    await page.goto('/app/qr');
    await page.waitForSelector('.qr-editor', { timeout: 10000 });
    await page.waitForTimeout(400);
  });

  test('type switch changes payload fields', async ({ page }) => {
    const typeSelect = page.locator('select[aria-label="Tipo payload QR"]');
    await expect(typeSelect).toHaveValue('url');
    await typeSelect.selectOption('text');
    await expect(page.locator('input[aria-label*="testo" i], input[placeholder*="testo" i]').first()).toBeVisible();
    await typeSelect.selectOption('email');
    await expect(page.locator('input[aria-label*="email" i], input[placeholder*="email" i]').first()).toBeVisible();
    await typeSelect.selectOption('wifi');
    await expect(page.locator('input[aria-label*="ssid" i], input[placeholder*="ssid" i]').first()).toBeVisible();
  });

  test('URL validation shows warning for invalid input', async ({ page }) => {
    const urlInput = page.locator('input[aria-label="URL del QR code"]');
    await urlInput.fill('not-a-url');
    await expect(page.locator('.qr-warning')).toBeVisible();
    await expect(page.locator('.qr-warning')).toContainText(/URL non valido/i);
  });

  test('export PNG triggers download', async ({ page }) => {
    const urlInput = page.locator('input[aria-label="URL del QR code"]');
    await urlInput.fill('https://example.com');
    await page.waitForTimeout(600);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.getByRole('button', { name: /Esporta/i }).click().then(() =>
        page.getByRole('menuitem').filter({ hasText: /PNG/i }).first().click()
      ),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.png$/i);
  });

  test('export SVG triggers download', async ({ page }) => {
    const urlInput = page.locator('input[aria-label="URL del QR code"]');
    await urlInput.fill('https://example.com');
    await page.waitForTimeout(600);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.getByRole('button', { name: /Esporta/i }).click().then(() =>
        page.getByRole('menuitem').filter({ hasText: /SVG/i }).first().click()
      ),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.svg$/i);
  });

  test('save button persists document via SaveDialog', async ({ page }) => {
    const urlInput = page.locator('input[aria-label="URL del QR code"]');
    await urlInput.fill('https://example.com');
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: /^Salva$/i }).click();
    await expect(page.getByRole('heading', { name: /Salva QR Code/i })).toBeVisible();
    await page.getByRole('button', { name: /Conferma salvataggio/i }).click();
    await page.waitForTimeout(2000);
    const docs = await page.evaluate(() => {
      const raw = localStorage.getItem('precisionQuote_documents:v1');
      return raw ? JSON.parse(raw) : [];
    });
    expect(docs.filter((d: any) => d.documentType === 'qrCode').length).toBeGreaterThan(0);
  });

  test('reset clears payload', async ({ page }) => {
    const urlInput = page.locator('input[aria-label="URL del QR code"]');
    await urlInput.fill('https://example.com');
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /Nuovo/i }).click();
    await page.waitForTimeout(400);
    await expect(urlInput).toHaveValue('');
  });

  test('save without payload shows info toast', async ({ page }) => {
    await page.getByRole('button', { name: /^Salva$/i }).click();
    await expect(page.locator('text=/compila almeno il payload/i')).toBeVisible({ timeout: 3000 });
  });
});
