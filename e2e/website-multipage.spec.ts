import { test, expect, type Page } from '@playwright/test';
import { adminUser } from './fixtures';

const ADMIN_USER = adminUser;
const DOC_ID = 'website_e2e_multipage';

const INDEX_HTML = '<h1>Home E2E</h1><p class="idx">Testo index</p>';
const ABOUT_HTML = '<h1>Chi siamo E2E</h1><p class="abt">Testo about</p>';
const CONTACT_HTML = '<h1>Contatti E2E</h1><p class="cnt">Testo contact</p>';
const CSS = '.example{color:red}';

async function seed(page: Page): Promise<void> {
  await page.evaluate((u) => {
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
      JSON.stringify({
        userEmail: u.email,
        onboardingDone: true,
        displayName: 'Admin',
        tier: 'unlocked',
      }),
    );
    const now = new Date().toISOString();
    const doc = {
      id: 'web2_e2e_multi',
      userEmail: u.email,
      documentType: 'website',
      title: 'Sito E2E',
      brief: {
        businessName: 'E2E', sector: '', description: 'Test', tone: '', target: '',
        pages: 'index, about, contact', preferredColors: '', font: '', cta: '',
        sections: '', features: '', address: '', phone: '', email: '', contacts: '',
        socials: [], mapsUrl: '', notes: '',
      },
      html: '<h1>Home E2E</h1><p class="idx">Testo index</p>',
      css: '.idx{color:red}',
      js: '',
      pages: ['index', 'about', 'contact'],
      pagesHtml: { about: '<h1>Chi siamo E2E</h1><p class="abt">Testo about</p>', contact: '<h1>Contatti E2E</h1><p class="ct">Testo contact</p>' },
      source: 'ai',
      createdAt: now,
      updatedAt: now,
    };
    const existing = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
    const idx = existing.findIndex((d: any) => d.id === doc.id);
    if (idx >= 0) existing[idx] = doc; else existing.push(doc);
    localStorage.setItem('precisionQuote_documents:v1', JSON.stringify(existing));
  }, ADMIN_USER);
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/login');
  await seed(page);
  await page.goto('/app/website/web2_e2e_multi');
  await page.waitForSelector('.website-tabs', { timeout: 10000 });
}

test.describe('Sito multi-pagina (3 pagine)', () => {
  test('carica 3 pagine, preview per pagina, Nuova tab funziona', async ({ page, context }) => {
    await openEditor(page);
    await page.locator('.website-tab', { hasText: 'Preview' }).click();
    await page.waitForSelector('.preview-iframe', { timeout: 10000 });

    const frame = page.frameLocator('.preview-iframe');
    await expect(frame.locator('h1')).toHaveText('Home E2E');

    await page.locator('.page-switch-btn', { hasText: 'about' }).click();
    await expect(frame.locator('h1')).toHaveText('Chi siamo E2E');

    await page.locator('.page-switch-btn', { hasText: 'contact' }).click();
    await expect(frame.locator('h1')).toHaveText('Contatti E2E');

    const popupPromise = context.waitForEvent('page');
    await page.locator('.btn-open-tab').click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    expect(popup.url()).toContain('blob:');
  });

  test('modifica testo pagina secondaria nel Code → preview aggiornata', async ({ page }) => {
    await openEditor(page);
    await page.locator('.website-tab', { hasText: 'Codice' }).click();
    await page.locator('.code-page-switcher .page-switch-btn', { hasText: 'about' }).click();
    await page.waitForSelector('.code-editor-cm .cm-content', { timeout: 10000 });

    const cm = page.locator('.code-editor-cm .cm-content').first();
    await cm.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('<h1>Chi siamo AGGIORNATO</h1>');

    await page.locator('.website-tab', { hasText: 'Preview' }).click();
    await page.locator('.page-switch-btn', { hasText: 'about' }).click();
    const frame = page.frameLocator('.preview-iframe');
    await expect(frame.locator('h1')).toHaveText('Chi siamo AGGIORNATO');
    await expect(frame.locator('h1')).not.toHaveText('Chi siamo E2E');
  });
});

test.describe('Sito single-page (regressione: nessun switcher quando pages = solo index)', () => {
  const DOC_SINGLE = 'website_single_page';

  async function seedSingle(page: Page): Promise<void> {
    await page.goto('/login');
    await page.evaluate((payload) => {
      const { u, docId } = payload;
      localStorage.setItem('authToken', 'admin-token');
      localStorage.setItem('userEmail', u.email);
      localStorage.setItem('username', u.username);
      localStorage.setItem('userRole', u.role);
      localStorage.setItem('registeredUsers', JSON.stringify([{ email: u.email, password: u.password, username: u.username, role: u.role }]));
      localStorage.setItem(`userSettings_${u.email}`, JSON.stringify({ userEmail: u.email, onboardingDone: true, displayName: 'Admin', tier: 'unlocked' }));
      const now = new Date().toISOString();
      const doc = {
        id: docId,
        userEmail: u.email,
        documentType: 'website',
        title: 'Sito solo index',
        brief: { businessName: 'SoloX', sector: '', description: 'test', tone: '', target: '', pages: 'index', preferredColors: '', font: '', cta: '', sections: '', features: '', address: '', phone: '', email: '', contacts: '', socials: [], mapsUrl: '', notes: '' },
        html: '<h1>Solo Home</h1>',
        css: 'body{}',
        js: '',
        pages: ['index'],
        pagesHtml: {},
        createdAt: now,
        updatedAt: now,
      };
      const existing = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
      const idx = existing.findIndex((d: any) => d.id === doc.id);
      if (idx >= 0) existing[idx] = doc; else existing.push(doc);
      localStorage.setItem('precisionQuote_documents:v1', JSON.stringify(existing));
    }, { u: ADMIN_USER, docId: DOC_SINGLE });
  }

  test('preview single-page mostra index, nessun page-switcher mostrato', async ({ page }) => {
    await seedSingle(page);
    await page.goto(`/app/website/${DOC_SINGLE}`);
    await page.locator('.website-tab', { hasText: 'Preview' }).click();
    await page.waitForSelector('.preview-iframe', { timeout: 10000 });
    await expect(page.frameLocator('.preview-iframe').locator('h1')).toHaveText('Solo Home');
    // Nessun page-switcher: pages.length === 1
    await expect(page.locator('.page-switcher')).toHaveCount(0);
  });
});
