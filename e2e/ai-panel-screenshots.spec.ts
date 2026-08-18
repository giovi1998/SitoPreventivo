import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { loginAsTestUser } from './helpers/cardHarness';
import { testUser, giovanniTemplate } from './fixtures';

/**
 * Screenshot del pannello AI APERTO in ogni editor, desktop (1440×900) e
 * mobile (390×844) — richiesta utente 2026-08-18: "fai screen in tutti gli
 * editor, importante che siano utilizzabili". Ogni test: apre il pannello
 * con il pattern corretto per l'editor, verifica che un controllo chiave
 * sia visibile (usabilità, non solo presenza nel DOM) e salva lo screen in
 * e2e/__screenshots__/ai-panels/ per la valutazione visiva.
 *
 * Pattern AI per editor:
 * - desktop: rail `.ai-console` (card/flyer/social/website/preventivo) —
 *   panel espanso di default.
 * - logo: tab "AI" → LogoAiPanel custom (desktop e mobile).
 * - mobile card/website: FAB `.card-ai-fab` → bottom sheet.
 * - mobile flyer: bottom bar `.editor-mobile-bar` → `.editor-mobile-panel`.
 * - mobile social/preventivo: drawer condiviso (toggle `.ai-console__toggle`).
 */

const SHOT_DIR = path.join('e2e', '__screenshots__', 'ai-panels');

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

async function setup(page: Page, { admin = false } = {}) {
  await loginAsTestUser(page);
  await page.evaluate(({ email, tpl, isAdmin }) => {
    localStorage.setItem('pq_cookie_consent:v1', 'accepted');
    if (isAdmin) localStorage.setItem('userRole', 'admin');
    // tier unlocked: il pannello deve mostrare i controlli, non il guard Pro.
    const key = `userSettings_${email}`;
    const settings = JSON.parse(localStorage.getItem(key) || '{}');
    localStorage.setItem(key, JSON.stringify({ ...settings, tier: 'unlocked' }));
    const docs = [{ ...tpl, id: 'ai-shot-card', userEmail: email }];
    localStorage.setItem('precisionQuote_documents:v1', JSON.stringify(docs));
  }, { email: testUser.email, tpl: giovanniTemplate, isAdmin: admin });
}

async function shot(page: Page, name: string) {
  // Attesa fine animazioni (slideUp sheet 0.2s, drawer) — altrimenti lo
  // screen cattura il pannello a metà transizione e sembra "rotto".
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) });
}

/** Rail desktop/drawer mobile: espande se collassata, verifica panel visibile. */
async function openRailConsole(page: Page) {
  const toggle = page.locator('.ai-console__toggle');
  await expect(toggle).toBeVisible({ timeout: 15000 });
  const panel = page.locator('.ai-console__panel');
  if (!(await panel.isVisible().catch(() => false))) {
    await toggle.click();
  }
  await expect(panel).toBeVisible({ timeout: 5000 });
  return panel;
}

/** Lo sheet mobile card/website: click FAB → content visibile. */
async function openFabSheet(page: Page) {
  const fab = page.locator('.card-ai-fab');
  await expect(fab).toBeVisible({ timeout: 15000 });
  await fab.click();
  const sheet = page.locator('.card-ai-bottom-sheet-content');
  await expect(sheet).toBeVisible({ timeout: 5000 });
  return sheet;
}

test.describe('Screenshot pannello AI aperto — desktop', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test('card desktop: rail AI con controlli', async ({ page }) => {
    await setup(page);
    await page.goto('/app/card');
    const panel = await openRailConsole(page);
    await expect(panel.getByRole('button').first()).toBeVisible();
    await shot(page, 'card-desktop');
  });

  test('flyer desktop: rail AI con controlli', async ({ page }) => {
    await setup(page);
    await page.goto('/app/flyer');
    const panel = await openRailConsole(page);
    await expect(panel.getByRole('button').first()).toBeVisible();
    await shot(page, 'flyer-desktop');
  });

  test('social desktop: rail AI con bottone Genera', async ({ page }) => {
    await setup(page);
    await page.goto('/app/social');
    const panel = await openRailConsole(page);
    await expect(panel.getByRole('button').first()).toBeVisible();
    await shot(page, 'social-desktop');
  });

  test('website desktop: rail AI con bottone Genera sito', async ({ page }) => {
    await setup(page, { admin: true });
    await page.goto('/app/website');
    const panel = await openRailConsole(page);
    await expect(panel.getByRole('button', { name: /Genera sito con AI/i })).toBeVisible();
    await shot(page, 'website-desktop');
  });

  test('preventivo desktop: rail AI con quick action', async ({ page }) => {
    await setup(page, { admin: true });
    await page.goto('/app/editor');
    const panel = await openRailConsole(page);
    await expect(panel.getByRole('button').first()).toBeVisible();
    await shot(page, 'preventivo-desktop');
  });

  test('logo desktop: tab AI con pannello concept', async ({ page }) => {
    await setup(page);
    await page.goto('/app/logo');
    const aiTab = page.getByRole('tab', { name: /AI/i });
    await expect(aiTab).toBeVisible({ timeout: 15000 });
    await aiTab.click();
    await expect(page.locator('.logo-ai-panel')).toBeVisible({ timeout: 5000 });
    await shot(page, 'logo-desktop');
  });
});

test.describe('Screenshot pannello AI aperto — mobile 390px', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE);
  });

  test('card mobile: FAB → bottom sheet con controlli', async ({ page }) => {
    await setup(page);
    await page.goto('/app/card');
    // 2026-08-18: nessun tab "AI" nella tab bar — entry unica = FAB
    // (doppia entry tab+FAB segnalata dall'utente).
    await expect(page.getByRole('tab', { name: /^AI$/ })).toHaveCount(0);
    const sheet = await openFabSheet(page);
    await expect(sheet.getByRole('button').first()).toBeVisible();
    await shot(page, 'card-mobile');
  });

  test('flyer mobile: bottom bar → pannello AI con controlli', async ({ page }) => {
    await setup(page);
    await page.goto('/app/flyer');
    const aiTab = page.locator('.editor-mobile-bar button', { hasText: 'AI' });
    await expect(aiTab).toBeVisible({ timeout: 15000 });
    await aiTab.click();
    const mobilePanel = page.locator('.editor-mobile-panel');
    await expect(mobilePanel).toBeVisible({ timeout: 5000 });
    await expect(mobilePanel.getByRole('button').first()).toBeVisible();
    await shot(page, 'flyer-mobile');
  });

  test('social mobile: FAB -> bottom sheet con bottone Genera', async ({ page }) => {
    await setup(page);
    await page.goto('/app/social');
    // 2026-08-19: Social usa lo stesso pattern card/website (FAB + bottom sheet)
    // per ritraere il pannello AI su mobile, invece del drawer condiviso.
    const sheet = await openFabSheet(page);
    await expect(sheet.getByRole('button').first()).toBeVisible();
    await shot(page, 'social-mobile');
  });

  test('website mobile: FAB → bottom sheet con Genera sito', async ({ page }) => {
    await setup(page, { admin: true });
    await page.goto('/app/website');
    const sheet = await openFabSheet(page);
    await expect(sheet.getByRole('button', { name: /Genera sito con AI/i })).toBeVisible();
    await shot(page, 'website-mobile');
  });

  test('preventivo mobile: bottom bar → pannello AI custom', async ({ page }) => {
    await setup(page, { admin: true });
    await page.goto('/app/editor');
    // Preventivo mobile usa la bottom bar + editor-mobile-panel custom
    // (come flyer), NON il drawer condiviso AIConsole.
    const aiTab = page.locator('.editor-mobile-bar button', { hasText: 'AI' });
    await expect(aiTab).toBeVisible({ timeout: 15000 });
    await aiTab.click();
    const mobilePanel = page.locator('.editor-mobile-panel');
    await expect(mobilePanel).toBeVisible({ timeout: 5000 });
    await expect(mobilePanel.locator('.ai-panel')).toBeVisible();
    await shot(page, 'preventivo-mobile');
  });

  test('logo mobile: tab AI con pannello concept', async ({ page }) => {
    await setup(page);
    await page.goto('/app/logo');
    const aiTab = page.getByRole('tab', { name: /AI/i });
    await expect(aiTab).toBeVisible({ timeout: 15000 });
    await aiTab.click();
    await expect(page.locator('.logo-ai-panel')).toBeVisible({ timeout: 5000 });
    await shot(page, 'logo-mobile');
  });
});
