import { test, expect, type Page } from '@playwright/test';

/**
 * E2E per la migrazione breakpoint canonici 767/1023
 * (spec completata, §5 Acceptance Criteria).
 *
 * Note sui selettori:
 * - `.sidebar` e `.mobile-topbar` sono conditional-render in Layout.tsx
 *   (REQ-006): sotto i 1023px la sidebar non è proprio nel DOM.
 * - `.topbar` invece è sempre renderizzata da AppShell e nascosta via CSS
 *   nel blocco `@media(max-width:1023px)` (REQ-002, GlobalStyles.tsx).
 */

const TEST_USER = {
  email: 'breakpoints-test@example.com',
  password: 'Password123!',
  username: 'BreakpointsTest',
  role: 'user',
};

async function seedAuth(page: Page): Promise<void> {
  await page.evaluate((u) => {
    localStorage.setItem('authToken', 'test-token');
    localStorage.setItem('userEmail', u.email);
    localStorage.setItem('username', u.username);
    localStorage.setItem('userRole', u.role);
    localStorage.setItem(
      'registeredUsers',
      JSON.stringify([{
        email: u.email,
        password: u.password,
        username: u.username,
        role: u.role,
      }]),
    );
    localStorage.setItem(
      `userSettings_${u.email}`,
      JSON.stringify({
        userEmail: u.email,
        onboardingDone: true,
        displayName: u.username,
        companyName: 'Test',
        profession: 'Test',
        defaultColor: '#2563EB',
        defaultVat: 22,
        documentTheme: 'modern',
        preferredDocumentType: 'quote',
        tier: 'unlocked',
      }),
    );
  }, TEST_USER);
}

async function loginAndGo(page: Page, path: string): Promise<void> {
  await page.goto('/login');
  await seedAuth(page);
  await page.goto(path);
}

test.describe('Breakpoint migration 767/1023', () => {
  test('AC-001: at 800px /app/editor shows mobile-topbar, sidebar absent from DOM, topbar hidden', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 1024 });
    await loginAndGo(page, '/app/editor');

    await expect(page.locator('.mobile-topbar')).toBeVisible();
    // Sidebar: conditional render (REQ-006) → non deve essere nel DOM.
    await expect(page.locator('.sidebar')).toHaveCount(0);
    // Topbar: resta nel DOM ma è nascosta dal blocco @1023 (REQ-002).
    await expect(page.locator('.topbar')).toBeHidden();
  });

  test('AC-002: at 1024px /app/editor shows sidebar and topbar, no mobile-topbar', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await loginAndGo(page, '/app/editor');

    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('.mobile-topbar')).toHaveCount(0);
  });

  test('AC-003: at 800px hamburger opens drawer with same nav links as desktop sidebar', async ({ page }) => {
    // Raccolgo le voci nav della sidebar desktop (1280px).
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAndGo(page, '/app/editor');
    await expect(page.locator('.sidebar')).toBeVisible();
    const sidebarLabels = (await page.locator('.sidebar nav .nav-label').allTextContents())
      .map((t) => t.trim())
      .filter(Boolean);
    expect(sidebarLabels.length).toBeGreaterThan(0);

    // Resize live 1280 → 800: sidebar esce dal DOM, compare la mobile-topbar.
    await page.setViewportSize({ width: 800, height: 1024 });
    await expect(page.locator('.sidebar')).toHaveCount(0);
    await expect(page.locator('.mobile-topbar')).toBeVisible();

    await page.getByRole('button', { name: /Apri menu/i }).click();
    const drawer = page.locator('.mobile-drawer');
    await expect(drawer).toBeVisible();

    const drawerLabels = (await drawer.locator('.drawer-nav button').allTextContents())
      .map((t) => t.trim())
      .filter(Boolean);
    for (const label of sidebarLabels) {
      expect(drawerLabels).toContain(label);
    }
  });

  test('AC-004: at 800px flyer editor shows .editor-mobile-bar', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 1024 });
    await loginAndGo(page, '/app/flyer');

    await expect(page.locator('.editor-mobile-bar')).toBeVisible({ timeout: 15000 });
  });

  test('AC-005: card editor tabs visible at 800px, absent at 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 1024 });
    await loginAndGo(page, '/app/card');

    const tabs = page.locator('[data-testid="card-editor-tabs"]');
    await expect(tabs).toBeVisible({ timeout: 15000 });

    // Resize live a desktop: tabs smontati (conditional render), 3-col attivo.
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(tabs).toHaveCount(0);
    await expect(page.locator('.card-editor-3col')).toBeVisible();
  });

  test('AC-006: at 375px logo editor has no horizontal overflow and 767px concept CSS rules exist', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAndGo(page, '/app/logo');

    await expect(page.locator('.logo-editor')).toBeVisible({ timeout: 15000 });

    const widths = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    expect(widths.doc).toBeLessThanOrEqual(375);
    expect(widths.body).toBeLessThanOrEqual(375);

    // Ermetico (zero chiamate AI): la regola @media(max-width:767px) con
    // `.logo-ai-concepts{grid-template-columns:1fr}` deve esistere nel CSS.
    const hasMobileConceptRules = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSMediaRule && /max-width:\s*767px/.test(rule.conditionText)) {
            const text = rule.cssText;
            if (text.includes('.logo-ai-concepts') && /grid-template-columns:\s*1fr/.test(text)) {
              return true;
            }
          }
        }
      }
      return false;
    });
    expect(hasMobileConceptRules).toBe(true);
  });

  test('AC-007: at 390px website editor preview iframe is full-width (grid stacked, no 38px collapse)', async ({ page }) => {
    // Regressione 2026-08-13: `.website-content` restava `1fr 320px` anche
    // su mobile → colonna main ~54px → iframe preview largo 38px (invisibile).
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAndGo(page, '/app/editor');
    await page.evaluate(() => {
      localStorage.setItem('userRole', 'admin'); // route /app/website è AdminEditorRoute
      const docs = [{
        id: 'web-bp-1',
        documentType: 'website',
        title: 'Sito test',
        status: 'BOZZA',
        userEmail: 'breakpoints-test@example.com',
        html: '<html><body><h1>Test</h1></body></html>',
        css: '',
        js: '',
        pages: ['index'],
        pagesHtml: {},
        source: 'ai',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }];
      localStorage.setItem('precisionQuote_documents:v1', JSON.stringify(docs));
    });
    await page.goto('/app/website/web-bp-1');
    await page.getByRole('tab', { name: 'Preview' }).click();
    const iframe = page.locator('.preview-iframe');
    await expect(iframe).toBeVisible({ timeout: 15000 });
    const box = await iframe.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(300);
  });

  test('website AI rail: panel scrollabile come gli altri editor (overflow-y auto, non hidden)', async ({ page }) => {
    // Regressione 2026-08-18: `.website-rail .ai-console__panel` aveva
    // `overflow: hidden` + children flex-shrink:0 → contenuto oltre
    // l'altezza rail clippato e irraggiungibile (report utente: "l'AI
    // nella pagina sito rimane fissa, non scrolla").
    await loginAndGo(page, '/app/editor');
    await page.evaluate(() => {
      localStorage.setItem('userRole', 'admin'); // route /app/website è AdminEditorRoute
      const docs = [{
        id: 'web-rail-scroll',
        documentType: 'website',
        title: 'Sito test scroll rail',
        status: 'BOZZA',
        userEmail: 'breakpoints-test@example.com',
        html: '<html><body><h1>Test</h1></body></html>',
        css: '',
        js: '',
        pages: ['index'],
        pagesHtml: {},
        source: 'ai',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }];
      localStorage.setItem('precisionQuote_documents:v1', JSON.stringify(docs));
    });
    await page.goto('/app/website/web-rail-scroll');
    const panel = page.locator('.website-rail .ai-console__panel');
    await expect(panel).toBeVisible({ timeout: 15000 });
    const overflowY = await panel.evaluate((el) => getComputedStyle(el).overflowY);
    expect(overflowY).toBe('auto');
  });

  test('single header: at 375x812 /app/editor exactly one visible header (mobile-topbar only)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAndGo(page, '/app/editor');

    await expect(page.locator('.mobile-topbar')).toBeVisible();
    await expect(page.locator('.topbar')).toBeHidden();

    const visibleHeaders = await page.evaluate(() => {
      const isVisible = (el: Element) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
      };
      return Array.from(document.querySelectorAll('.mobile-topbar, .topbar')).filter(isVisible).length;
    });
    expect(visibleHeaders).toBe(1);
  });
});
