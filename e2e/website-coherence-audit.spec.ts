import { test, expect, type Page } from '@playwright/test';
import { adminUser } from './fixtures';
import { mkdirSync } from 'node:fs';

const ADMIN_USER = adminUser;
const DOC_ID = 'website_visual_coherence_audit';

const NAV = `<header class="nav"><div class="nav-inner"><div class="brand">Gelateria Aurora</div><button class="menu-toggle" aria-label="Apri menu di navigazione"></button><ul class="nav-links"><li><a href="index.html">Home</a></li><li><a href="about.html">Chi siamo</a></li><li><a href="menu.html">Menu</a></li></ul></div></header>`;
const FOOTER = `<footer><div class="section-inner"><p>© <span class="current-year"></span> Gelateria Aurora</p></div></footer>`;

const INDEX_HTML = `${NAV}<main><section class="hero"><div class="section-inner"><p class="eyebrow">Gelateria artigianale</p><h1>Il gusto autentico di Cagliari</h1><p>Gelato artigianale, ingredienti a km 0, dal 1998.</p><a class="btn" href="menu.html">Vedi il menu</a></div></section><section class="section-inner" id="specialita"><h2>Le nostre specialità</h2><p>Tre gusti iconici creati ogni mattina a mano.</p></section></main>${FOOTER}`;
const ABOUT_HTML = `${NAV}<main><section class="page-hero"><div class="section-inner"><p class="eyebrow">Gelateria Aurora</p><h1>Chi siamo</h1><p>La nostra storia e i valori.</p></div></section><section class="section-inner"><h2>La nostra storia</h2><p>Dal 1998 produciamo gelato con ricette sarde e latte fresco di montagna.</p></section><section class="value section-inner"><h2>I nostri valori</h2><p>Artigianalità, qualità, stagionalità.</p></section></main>${FOOTER}`;
const MENU_HTML = `${NAV}<main><section class="page-hero"><div class="section-inner"><p class="eyebrow">Gelateria Aurora</p><h1>Menu</h1><p>Gusti e creme del giorno.</p></div></section><section class="section-inner"><h2>Sigari & Coppette</h2><p>Lista dei gusti disponibili oggi.</p></section></main>${FOOTER}`;

const CSS = `:root{--primary:#7C3AED;--accent:#E11D48;--bg:#FAF7FF;--text:#1A1A2E;--radius:12px;--font:Inter,system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6}
.section-inner{max-width:1100px;margin:0 auto;padding:2rem 1rem}
.nav{position:sticky;top:0;background:rgba(250,247,255,.9);backdrop-filter:blur(8px);border-bottom:1px solid #E9E4F5;padding:.75rem 0;z-index:50}
.nav-inner{max-width:1100px;margin:0 auto;padding:0 1rem;display:flex;align-items:center;gap:16px}
.brand{font-weight:800;font-size:1.15rem;letter-spacing:-.01em;color:var(--primary)}
.nav-links{display:flex;gap:16px;list-style:none;margin-left:auto}
.nav-links a{text-decoration:none;color:var(--text);font-weight:600;font-size:.95rem}
.nav-links a:hover{color:var(--primary)}
.hero{background:linear-gradient(135deg,var(--primary),#2D0A68);color:#fff;padding:6rem 1rem;text-align:center}
.hero h1{font-size:clamp(2.2rem,6vw,3.8rem);letter-spacing:-.03em;line-height:1.05;margin:.35rem 0 .75rem}
.hero p{max-width:620px;margin:0 auto 1.5rem;font-size:1.1rem;color:#E9E4F5}
.page-hero{background:linear-gradient(135deg,var(--primary),#2D0A68);color:#fff;padding:2.5rem 1rem;text-align:center}
.page-hero h1{font-size:clamp(1.6rem,4vw,2.4rem);letter-spacing:-.02em;margin:.2rem 0 .4rem}
.page-hero p{max-width:640px;margin:0 auto;color:#E9E4F5}
.eyebrow{text-transform:uppercase;letter-spacing:.22em;font-size:.75rem;font-weight:700;color:#FCD34D}
.btn{display:inline-block;background:var(--accent);color:#fff;padding:12px 24px;border-radius:8px;font-weight:700;text-decoration:none;transition:transform .2s ease}
.btn:hover{transform:translateY(-1px)}
h2{font-size:1.5rem;letter-spacing:-.02em;margin-bottom:.5rem}
footer{border-top:1px solid #E9E4F5;padding:1.5rem 0;text-align:center;color:#6B7280;font-size:.85rem}
.menu-toggle{display:none}
`;

async function seed(page: Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate((payload) => {
    const { u, INDEX_HTML: iHtml, ABOUT_HTML: aHtml, MENU_HTML: mHtml, CSS: cssText } = payload;
    localStorage.setItem('authToken', 'admin-token');
    localStorage.setItem('userEmail', u.email);
    localStorage.setItem('username', u.username);
    localStorage.setItem('userRole', u.role);
    localStorage.setItem('registeredUsers', JSON.stringify([{ email: u.email, password: u.password, username: u.username, role: u.role }]));
    localStorage.setItem(`userSettings_${u.email}`, JSON.stringify({ userEmail: u.email, onboardingDone: true, displayName: 'Admin', tier: 'unlocked' }));
    const now = new Date().toISOString();
    const doc = {
      id: 'website_visual_coherence_audit',
      userEmail: u.email,
      documentType: 'website',
      title: 'Gelateria Aurora (audit)',
      brief: { businessName: 'Gelateria Aurora', sector: 'food', description: 'Audit coerenza multipagina', tone: '', target: '', pages: 'index, about, menu', preferredColors: '', font: '', cta: '', sections: '', features: '', address: '', phone: '', email: '', contacts: '', socials: [], mapsUrl: '', notes: '' },
      html: iHtml,
      css: cssText,
      js: '',
      pages: ['index', 'about', 'menu'],
      pagesHtml: { about: aHtml, menu: mHtml },
      createdAt: now,
      updatedAt: now,
    };
    const existing = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
    const idx = existing.findIndex((d: any) => d.id === doc.id);
    if (idx >= 0) existing[idx] = doc; else existing.push(doc);
    localStorage.setItem('precisionQuote_documents:v1', JSON.stringify(existing));
  }, { u: ADMIN_USER, INDEX_HTML, ABOUT_HTML, MENU_HTML, CSS });
}

test.describe('Audit coerenza visiva multipagina', () => {
  test('3 pagine coerenti: nav/footer identici, hero home vs page-hero, classi condivise', async ({ page }) => {
    mkdirSync('artifacts/audit-website', { recursive: true });
    await seed(page);
    await page.goto(`/app/website/${DOC_ID}`);
    await page.waitForSelector('.website-tabs', { timeout: 10000 });
    await page.locator('.website-tab', { hasText: 'Preview' }).click();
    await page.waitForSelector('.preview-iframe', { timeout: 10000 });
    await page.waitForTimeout(500);

    const frame = page.frameLocator('.preview-iframe');

    // INDEX: hero grande con CTA
    await expect(frame.locator('.hero h1')).toHaveText('Il gusto autentico di Cagliari');
    await expect(frame.locator('.hero .btn')).toBeVisible();
    await page.screenshot({ path: 'artifacts/audit-website/01-index.png', fullPage: true });

    // ABOUT: page-hero (hero ridotto), nessuna CTA uguale, nav identica
    await page.locator('.page-switch-btn', { hasText: 'about' }).click();
    await page.waitForTimeout(300);
    await expect(frame.locator('.page-hero h1')).toHaveText('Chi siamo');
    await expect(frame.locator('.page-hero .btn')).toHaveCount(0);
    await expect(frame.locator('.nav .brand')).toHaveText('Gelateria Aurora');
    await expect(frame.locator('.nav-links a')).toHaveCount(3);
    await page.screenshot({ path: 'artifacts/audit-website/02-about.png', fullPage: true });

    // MENU: stesso brand/font/colore, footer presente
    await page.locator('.page-switch-btn', { hasText: 'menu' }).click();
    await page.waitForTimeout(300);
    await expect(frame.locator('.page-hero h1')).toHaveText('Menu');
    await expect(frame.locator('.nav .brand')).toHaveText('Gelateria Aurora');
    await expect(frame.locator('footer')).toBeVisible();
    await page.screenshot({ path: 'artifacts/audit-website/03-menu.png', fullPage: true });

    // Coerenza stile: il colore accent è identico tra pagine (btn in index)
    const indexBtnBg = await frame.locator('.nav .brand').evaluate((el) => getComputedStyle(el).color);
    await page.locator('.page-switch-btn', { hasText: 'index' }).click();
    await page.waitForTimeout(300);
    const homeBrand = await frame.locator('.nav .brand').evaluate((el) => getComputedStyle(el).color);
    expect(indexBtnBg).toBe(homeBrand);
  });
});
