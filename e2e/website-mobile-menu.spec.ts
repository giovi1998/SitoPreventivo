import { test, expect, type Page } from '@playwright/test';
import { adminUser } from './fixtures';

// Test rigorosi menu mobile siti generati: hamburger visibile su viewport
// 375px, click apre il nav (.nav-open), per JS valido, JS rotto (SyntaxError)
// e js vuoto (fallback MENU_FALLBACK_JS in buildWebsiteFullDocument).
// Bug live 2026-08-21: "non funziona il menù nel caso di mobile".

const ADMIN = adminUser;
const DOC_ID = 'website_e2e_mobile_menu';

const VALID_JS = `document.querySelector('.menu-toggle').addEventListener('click', function () {
  document.querySelector('.nav').classList.toggle('nav-open');
});`;

const BROKEN_JS = `if (document.querySelector('.menu-toggle')) { init(); } else { fallback() }`;

async function seed(page: Page, js: string): Promise<void> {
  await page.evaluate(({ u, jsValue }) => {
    localStorage.setItem('authToken', 'admin-token');
    localStorage.setItem('userEmail', u.email);
    localStorage.setItem('username', u.username);
    localStorage.setItem('userRole', u.role);
    localStorage.setItem(
      'registeredUsers',
      JSON.stringify([{ email: u.email, password: u.password, username: u.username, role: u.role }]),
    );
    localStorage.setItem(
      `userSettings_${u.email}`,
      JSON.stringify({ userEmail: u.email, onboardingDone: true, displayName: 'Admin', tier: 'unlocked' }),
    );
    const now = new Date().toISOString();
    const doc = {
      id: 'website_e2e_mobile_menu',
      userEmail: u.email,
      documentType: 'website',
      title: 'Pad Thai E2E',
      brief: {
        businessName: 'Pad Thai', sector: '', description: 'Test', tone: '', target: '',
        pages: 'index', preferredColors: '', font: '', cta: '',
        sections: '', features: '', address: '', phone: '', email: '', contacts: '',
        socials: [], mapsUrl: '', notes: '',
      },
      html: '<header><nav class="nav"><div class="brand">Pad Thai</div><button class="menu-toggle" aria-label="Apri menu"></button><ul class="nav-links"><li><a href="#home">Home</a></li><li><a href="#contatti">Contatti</a></li></ul></nav></header><section class="hero"><h1>Un angolo di Thailandia</h1></section>',
      css: '\nheader { background: #fff; }\n.nav { display: flex; justify-content: space-between; align-items: center; padding: 1rem; }\n.nav-links { list-style: none; }\n.menu-toggle { border: none; background: transparent; width: 42px; height: 42px; cursor: pointer; position: relative; }\n@media (max-width: 768px) {\n  .nav-links { display: none; }\n  .nav-open .nav-links { display: block; }\n}\n',
      js: jsValue,
      pages: ['index'],
      pagesHtml: {},
      source: 'ai',
      createdAt: now,
      updatedAt: now,
    };
    const existing = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
    const idx = existing.findIndex((d: any) => d.id === doc.id);
    if (idx >= 0) existing[idx] = doc;
    else existing.push(doc);
    localStorage.setItem('precisionQuote_documents:v1', JSON.stringify(existing));
  }, { u: ADMIN, jsValue: js });
}

test.describe('Menu mobile sito generato', () => {
  for (const scenario of [
    { name: 'JS valido generato', js: VALID_JS },
    { name: 'JS rotto (SyntaxError) → fallback menu', js: BROKEN_JS },
    { name: 'JS vuoto → fallback menu iniettato', js: '' },
  ]) {
    test(`${scenario.name}: hamburger visibile a 375px, click apre nav`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.goto('/login');
      await seed(page, scenario.js);
      await page.goto(`/app/website/${DOC_ID}`);
      await page.waitForSelector('.website-tabs', { timeout: 15000 });
      await page.locator('.website-tab', { hasText: 'Preview' }).click();
      await page.waitForSelector('.preview-iframe', { timeout: 10000 });
      await page.locator('.viewport-btn', { hasText: 'Mobile' }).click();

      const frame = page.frameLocator('.preview-iframe');
      const toggle = frame.locator('.menu-toggle');
      await expect(toggle).toBeVisible();
      const nav = frame.locator('nav.nav');
      await expect(nav).not.toHaveClass(/nav-open/);

      await toggle.click();
      await expect(nav).toHaveClass(/nav-open/);
      await expect(frame.locator('.nav-links')).toBeVisible();

      // Secondo click chiude.
      await toggle.click();
      await expect(nav).not.toHaveClass(/nav-open/);

      // Nessun errore JS nella console dell'iframe.
      // (il fallback sostituisce il JS rotto prima dell'iniezione)
    });
  }

  test('console iframe senza SyntaxError anche con JS rotto', async ({ page }) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/login');
    await seed(page, BROKEN_JS);
    await page.goto(`/app/website/${DOC_ID}`);
    await page.waitForSelector('.preview-iframe', { timeout: 15000 });
    await page.waitForTimeout(2000);
    const syntaxErrors = errors.filter((e) => /SyntaxError|Unexpected token/.test(e));
    expect(syntaxErrors).toHaveLength(0);
  });
});
