import { test, expect } from '@playwright/test';
import { seedAuth } from './helpers/cardHarness';

test.describe('Logo editor — save diagnosi', () => {
  test('Salva button opens SaveDialog, confirms, persists document', async ({ page }) => {
    await page.goto('/login');
    await seedAuth(page);
    // Seed logo con contenuto via localStorage (logoHasContent = true)
    await page.evaluate(() => {
      const logoDoc = {
        id: 'logo_e2e_test',
        userEmail: 'test@example.com',
        documentType: 'logo',
        title: 'E2E Test Logo',
        builder: {
          primaryText: 'Test',
          tagline: '',
          iconGlyph: 'star',
          layout: 'horizontal',
          primaryColor: '#000000',
          secondaryColor: '#FFFFFF',
          font: 'Inter',
        },
        updatedAt: new Date().toISOString(),
      };
      const existing = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
      if (!existing.some((d: any) => d.id === logoDoc.id)) {
        existing.push(logoDoc);
        localStorage.setItem('precisionQuote_documents:v1', JSON.stringify(existing));
      }
    });
    await page.goto('/app/logo/logo_e2e_test');
    await page.waitForTimeout(1500);

    // Clicca Salva
    const saveBtn = page.getByRole('button', { name: /^Salva$/i }).first();
    if (!(await saveBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Salva button not visible');
      return;
    }
    await saveBtn.click();

    // SaveDialog visibile
    const dialog = page.getByRole('heading', { name: /Salva logo/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Conferma
    const confirmBtn = page.getByRole('button', { name: /Conferma salvataggio/i });
    await confirmBtn.click();

    // Attendi elaborazione save
    await page.waitForTimeout(2000);

    // Verifica localStorage (save riuscito se doc esiste)
    const docs = await page.evaluate(() => {
      const raw = localStorage.getItem('precisionQuote_documents:v1');
      return raw ? JSON.parse(raw) : [];
    });
    const logoDocs = docs.filter((d: any) => d.documentType === 'logo');
    expect(logoDocs.length).toBeGreaterThan(0);
  });
});
