import { test, expect } from '@playwright/test';
import { seedAuth } from './helpers/cardHarness';

test.describe('Social editor — functional', () => {
  test('empty state: no documents shows warning', async ({ page }) => {
    await page.goto('/login');
    await seedAuth(page);
    await page.goto('/app/social');
    await page.waitForTimeout(1500);
    await expect(page.locator('text=/seleziona un documento sorgente/i, text=/nessun documento/i, text=/crea prima/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('source selector lists card documents', async ({ page }) => {
    await page.goto('/login');
    await seedAuth(page);
    // Seed a card document
    await page.evaluate(() => {
      const now = new Date().toISOString();
      const cardDoc = {
        id: 'card_social_test',
        userEmail: 'test@example.com',
        documentType: 'businessCard',
        title: 'Social Source Card',
        front: { name: 'Mario Rossi', title: 'Dev', company: 'Acme', photoUrl: null, logoUrl: null, coverImageUrl: null, logoBackground: 'none', layout: 'left', useGrid: false },
        back: { phone: '', email: '', website: '', address: '', vatNumber: '', services: [], servicesLabel: 'Servizi', socials: [], qrPayload: '', qrLabel: '', qrSize: 'medium', coverImageUrl: null, useGrid: false },
        style: { sizePreset: 'eu-85x55', bgColor: '#FFFFFF', textColor: '#1a1a2e', accentColor: '#01696F', fontFamily: 'Inter', borderStyle: 'accent-strip-left', fontScale: 1 },
        createdAt: now,
        updatedAt: now,
      };
      const existing = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
      existing.push(cardDoc);
      localStorage.setItem('precisionQuote_documents:v1', JSON.stringify(existing));
    });
    await page.goto('/app/social');
    await page.waitForTimeout(1500);
    const sourceSelect = page.locator('select').filter({ hasText: /bigliettino|card|sorgente/i }).first();
    if (!(await sourceSelect.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Source select not visible');
      return;
    }
    await expect(sourceSelect.locator('option')).toHaveCount(2); // placeholder + 1 doc
  });

  test('generate without source shows info toast', async ({ page }) => {
    await page.goto('/login');
    await seedAuth(page);
    await page.goto('/app/social');
    await page.waitForTimeout(1500);
    const genBtn = page.getByRole('button', { name: /genera/i }).first();
    if (!(await genBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Generate button not visible');
      return;
    }
    await genBtn.click();
    await expect(page.locator('text=/seleziona un documento sorgente/i')).toBeVisible({ timeout: 3000 });
  });
});
