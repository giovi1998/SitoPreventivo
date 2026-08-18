import { test, expect, type Page } from '@playwright/test';
import { loginAsTestUser } from './helpers/cardHarness';
import { testUser, giovanniTemplate } from './fixtures';

/**
 * Guardia scroll pannello AI in OGNI editor (regressioni 2026-08-17/18:
 * panel clippato su website desktop, drawer mobile website schiacciato a
 * 160px). I pattern AI variano per editor — la guardia verifica quello
 * corretto per ciascuno:
 * - rail `.ai-console` (card/flyer/social/website desktop, social/website
 *   mobile drawer): `.ai-console__panel` overflow-y auto; mobile = drawer
 *   fixed bottom, max-height ~70vh (mai cappato a 160px).
 * - card mobile: FAB + bottom sheet (85vh, overflow-y auto).
 * - flyer mobile: bottom bar + `.editor-mobile-panel` (50vh, overflow-y auto).
 * - logo: `LogoAiPanel` custom (nessuna ai-console), tab in flusso pagina.
 */

async function seedCardDoc(page: Page) {
  await page.evaluate(({ email, tpl }) => {
    const docs = [{ ...tpl, id: 'rail-scroll-card', userEmail: email }];
    localStorage.setItem('precisionQuote_documents:v1', JSON.stringify(docs));
  }, { email: testUser.email, tpl: giovanniTemplate });
}

async function expectRailPanelScrollable(page: Page) {
  const toggle = page.locator('.ai-console__toggle');
  await expect(toggle).toBeVisible({ timeout: 15000 });
  const panel = page.locator('.ai-console__panel');
  if (!(await panel.isVisible().catch(() => false))) {
    await toggle.click();
  }
  await expect(panel).toBeVisible({ timeout: 5000 });
  const overflowY = await panel.evaluate((el) => getComputedStyle(el).overflowY);
  expect(overflowY, 'panel rail deve scrollare').toBe('auto');
}

test.describe('AI panel scrollabile in tutti gli editor', () => {
  test.describe('desktop: rail .ai-console', () => {
    for (const editor of [
      { path: '/app/card', name: 'card' },
      { path: '/app/flyer', name: 'flyer' },
      { path: '/app/social', name: 'social', seed: true },
      { path: '/app/website', name: 'website', admin: true },
      { path: '/app/editor', name: 'preventivo', admin: true },
    ]) {
      test(`${editor.name}: panel overflow-y auto`, async ({ page }) => {
        await loginAsTestUser(page);
        if (editor.admin) await page.evaluate(() => localStorage.setItem('userRole', 'admin'));
        if (editor.seed) await seedCardDoc(page);
        await page.goto(editor.path);
        await expectRailPanelScrollable(page);
      });
    }
  });

  test.describe('mobile 390px', () => {
    test('social: drawer fixed 70vh, panel scrolla', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await loginAsTestUser(page);
      await seedCardDoc(page);
      await page.goto('/app/social');
      const toggle = page.locator('.ai-console__toggle');
      await expect(toggle).toBeVisible({ timeout: 15000 });
      const panel = page.locator('.ai-console__panel');
      if (!(await panel.isVisible().catch(() => false))) {
        await toggle.click();
      }
      await expect(panel).toBeVisible({ timeout: 5000 });
      const m = await panel.evaluate((el) => ({
        position: getComputedStyle(el.closest('.ai-console')!).position,
        overflowY: getComputedStyle(el).overflowY,
        maxHeight: parseFloat(getComputedStyle(el).maxHeight),
      }));
      expect(m.position, 'social: drawer fixed').toBe('fixed');
      expect(m.overflowY, 'social: panel scrolla').toBe('auto');
      expect(m.maxHeight, 'social: ~70vh, non cappato').toBeGreaterThan(300);
    });

    test('website: FAB apre bottom sheet AI scrollabile (pattern card, 2026-08-18)', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await loginAsTestUser(page);
      await page.evaluate(() => {
        localStorage.setItem('userRole', 'admin');
        localStorage.setItem('pq_cookie_consent:v1', 'accepted');
        // Regressione 2026-08-18: console persistita COLLAPSED → il sheet
        // mostrava solo il toggle (nascosto via CSS) → pannello bianco.
        // forceExpanded deve ignorare la preferenza dentro lo sheet.
        localStorage.setItem('pq_ui:v1', JSON.stringify({ version: 1, aiConsoleExpanded: { website: false } }));
      });
      await page.goto('/app/website');
      // Su mobile la rail AI NON è più il drawer fixed: pattern card
      // (FAB + bottom sheet) — la rail resta solo desktop.
      const fab = page.locator('.card-ai-fab');
      await expect(fab).toBeVisible({ timeout: 15000 });
      await fab.click();
      const sheet = page.locator('.card-ai-bottom-sheet-content');
      await expect(sheet).toBeVisible({ timeout: 5000 });
      const m = await sheet.evaluate((el) => ({
        overflowY: getComputedStyle(el).overflowY,
        maxHeight: parseFloat(getComputedStyle(el).maxHeight),
      }));
      expect(m.overflowY, 'sheet scrolla').toBe('auto');
      expect(m.maxHeight, '85vh di 844px ≈ 717').toBeGreaterThan(500);
      // Il bottone Genera è dentro lo sheet anche con console persistita collapsed.
      await expect(sheet.getByRole('button', { name: /Genera sito con AI/i })).toBeVisible();
      // E la preferenza persistita non è stata sovrascritta (rail desktop intatta).
      const persisted = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('pq_ui:v1') || '{}')?.aiConsoleExpanded?.website);
      expect(persisted).toBe(false);
    });

    test('card: FAB apre bottom sheet scrollabile (85vh)', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await loginAsTestUser(page);
      await page.evaluate(() => localStorage.setItem('pq_cookie_consent:v1', 'accepted'));
      await page.goto('/app/card');
      const fab = page.locator('.card-ai-fab');
      await expect(fab).toBeVisible({ timeout: 15000 });
      await fab.click();
      const sheet = page.locator('.card-ai-bottom-sheet-content');
      await expect(sheet).toBeVisible({ timeout: 5000 });
      const m = await sheet.evaluate((el) => ({
        overflowY: getComputedStyle(el).overflowY,
        maxHeight: parseFloat(getComputedStyle(el).maxHeight),
      }));
      expect(m.overflowY).toBe('auto');
      expect(m.maxHeight, '85vh di 844px ≈ 717').toBeGreaterThan(500);
    });

    test('flyer: bottom bar AI apre mobile panel scrollabile (50vh)', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await loginAsTestUser(page);
      await page.goto('/app/flyer');
      const aiTab = page.locator('.editor-mobile-bar button', { hasText: 'AI' });
      await expect(aiTab).toBeVisible({ timeout: 15000 });
      await aiTab.click();
      const mobilePanel = page.locator('.editor-mobile-panel');
      await expect(mobilePanel).toBeVisible({ timeout: 5000 });
      const overflowY = await mobilePanel.evaluate((el) => getComputedStyle(el).overflowY);
      expect(overflowY).toBe('auto');
    });

    test('logo: pannello AI custom in flusso pagina (tab AI)', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await loginAsTestUser(page);
      await page.goto('/app/logo');
      const aiTab = page.getByRole('tab', { name: /AI/i });
      await expect(aiTab).toBeVisible({ timeout: 15000 });
      await aiTab.click();
      await expect(page.locator('.logo-ai-panel')).toBeVisible({ timeout: 5000 });
    });
  });
});
