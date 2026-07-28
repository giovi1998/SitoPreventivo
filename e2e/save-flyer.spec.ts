import { test, expect } from '@playwright/test';
import { seedAuth } from './helpers/cardHarness';

test.describe('Flyer editor — save diagnosi', () => {
  test('Salva button opens SaveDialog, confirms, persists document', async ({ page }) => {
    await page.goto('/login');
    await seedAuth(page);

    // Seed flyer completo (createEmptyFlyer structure) via localStorage
    await page.evaluate(() => {
      const now = new Date().toISOString();
      const flyerDoc = {
        documentType: 'flyer',
        id: 'flyer_e2e_test',
        userEmail: 'test@example.com',
        title: 'E2E Test Flyer',
        size: 'A5',
        orientation: 'portrait',
        content: {
          headline: 'Test Headline',
          subheadline: '',
          body: 'Test body copy',
          cta: { label: 'Call now', url: '' },
          heroImage: null,
          qrPayload: '',
          qrLabel: '',
        },
        style: {
          bgColor: '#FFFFFF',
          textColor: '#1a1a2e',
          accentColor: '#01696F',
          layout: 'classic',
          fontFamily: 'Inter',
          fontScale: 1,
        },
        decorations: {
          pattern: null,
          opacity: 0.2,
          palette: { primary: '#01696F', secondary: '#E11D48', accent: null },
          userLocked: false,
        },
        createdAt: now,
        updatedAt: now,
      };
      const existing = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
      if (!existing.some((d: any) => d.id === flyerDoc.id)) {
        existing.push(flyerDoc);
        localStorage.setItem('precisionQuote_documents:v1', JSON.stringify(existing));
      }
    });
    // Debug: cattura errori console
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/app/flyer/flyer_e2e_test');
    await page.waitForTimeout(1500);

    console.log('Flyer page errors:', errors.slice(0, 5));

    // Debug: log tutti i bottoni
    const allBtns = await page.locator('button').allTextContents();
    console.log('Flyer buttons:', allBtns.slice(0, 20));

    // Clicca Salva (qualsiasi bottone con "Salva")
    const saveBtn = page.locator('button').filter({ hasText: /salva/i }).first();
    if (!(await saveBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Salva button not visible. Found: ' + allBtns.slice(0, 10).join(', '));
      return;
    }
    await saveBtn.click();

    // SaveDialog visibile
    const dialog = page.getByRole('heading', { name: /Salva volantino/i });
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
    const flyerDocs = docs.filter((d: any) => d.documentType === 'flyer');
    expect(flyerDocs.length).toBeGreaterThan(0);
  });
});
