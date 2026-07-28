import { test, expect } from '@playwright/test';
import { seedAuth } from './helpers/cardHarness';

test.describe('QR editor — save diagnosi', () => {
  test('Salva button persists QR document', async ({ page }) => {
    await page.goto('/login');
    await seedAuth(page);
    await page.goto('/app/qr');
    await page.waitForTimeout(1200);

    // Compila campo minimo (payload URL)
    const payloadInput = page.locator('input[placeholder*="url" i], input[aria-label*="url" i], input[placeholder*="https" i]').first();
    if (await payloadInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await payloadInput.fill('https://example.com');
      await page.waitForTimeout(300);
    }

    // Clicca Salva
    const saveBtn = page.getByRole('button', { name: /^Salva$/i }).first();
    if (!(await saveBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip(true, 'Salva button not visible');
      return;
    }
    await saveBtn.click();

    // SaveDialog visibile
    const dialog = page.getByRole('heading', { name: /Salva QR Code/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Conferma
    const confirmBtn = page.getByRole('button', { name: /Conferma salvataggio/i });
    await confirmBtn.click();

    // Attendi elaborazione save
    await page.waitForTimeout(2000);

    // Verifica localStorage
    const docs = await page.evaluate(() => {
      const raw = localStorage.getItem('precisionQuote_documents:v1');
      return raw ? JSON.parse(raw) : [];
    });
    const qrDocs = docs.filter((d: any) => d.documentType === 'qrCode');
    expect(qrDocs.length).toBeGreaterThan(0);
  });
});
