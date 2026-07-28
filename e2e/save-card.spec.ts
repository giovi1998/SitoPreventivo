import { test, expect } from '@playwright/test';
import { seedAuth } from './helpers/cardHarness';

test.describe('Card editor — save diagnosi', () => {
  test('Salva button opens SaveDialog, confirms, shows success toast', async ({ page }) => {
    await page.goto('/login');
    await seedAuth(page);
    await page.goto('/app/card');
    await page.waitForSelector('[data-testid="card-preview-front"]', { timeout: 10000 });
    await page.waitForTimeout(600);

    // Compila campo minimo per dirty state
    await page.locator('label.card-field').filter({ hasText: /nome/i }).first()
      .locator('input').fill('Mario Rossi');
    await page.waitForTimeout(300);

    // Clicca Salva (desktop ActionBar)
    const saveBtn = page.getByRole('button', { name: /^Salva$/i }).first();
    await saveBtn.click();

    // SaveDialog visibile
    const dialog = page.getByRole('heading', { name: /Salva bigliettino/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Conferma
    const confirmBtn = page.getByRole('button', { name: /Conferma salvataggio/i });
    await confirmBtn.click();

    // Toast success
    await expect(page.locator('text=/salvat/i').first()).toBeVisible({ timeout: 8000 });

    // Verifica localStorage
    const docs = await page.evaluate(() => {
      const raw = localStorage.getItem('precisionQuote_documents:v1');
      return raw ? JSON.parse(raw) : [];
    });
    expect(docs.length).toBeGreaterThan(0);
    expect(docs[0].documentType).toBe('businessCard');
  });
});
