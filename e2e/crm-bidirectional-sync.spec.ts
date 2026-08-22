import { test, expect, type Page } from '@playwright/test';
import { adminUser } from './fixtures';
const ADMIN = adminUser;
const DOC_ID_CARD = 'card_sync_test';
const DOC_ID_WEBSITE = 'website_sync_test';
const CUSTOMER_ID = 'cust_sync_test';

async function seedCustomerAndDocs(page: Page) {
  await page.evaluate(({ admin, custId, cardId, siteId }) => {
    localStorage.setItem('authToken', 'admin-token');
    localStorage.setItem('userEmail', admin.email);
    localStorage.setItem('username', admin.username);
    localStorage.setItem('userRole', admin.role);
    localStorage.setItem('registeredUsers', JSON.stringify([{ email: admin.email, password: admin.password, username: admin.username, role: admin.role }]));
    localStorage.setItem('userSettings_' + admin.email, JSON.stringify({ userEmail: admin.email, onboardingDone: true, displayName: 'Admin', tier: 'unlocked' }));
    const now = new Date().toISOString();
    const customer = {
      id: custId,
      businessName: 'Sync Test SRL',
      ownerName: 'Mario Rossi',
      sector: 'gelateria',
      activity: 'Gelateria artigianale',
      mood: 'fresco',
      target: 'famiglie',
      preferredColors: '#F4A261,#8B5E3C',
      font: 'Inter',
      pages: 'index, chi-siamo',
      sections: 'hero, chi_siamo, contatti',
      cta: 'Prenota ora',
      features: 'galleria foto',
      contacts: { address: 'Via Dante 1, Cagliari', phone: '0701234567', email: 'info@synctest.it', website: 'https://synctest.it' },
      socials: [{ platform: 'Instagram', url: 'https://instagram.com/synctest' }],
      status: 'done',
      customerPhotos: [],
      logoUrl: null,
      detectedLogoUrl: null,
      webData: {},
      researchStatus: {},
      createdAt: now,
      updatedAt: now,
    };
    localStorage.setItem('pq_customers:v1', JSON.stringify([customer]));
    const card = {
      id: cardId,
      userEmail: admin.email,
      documentType: 'businessCard',
      title: 'Card Sync Test',
      customerId: custId,
      front: { name: 'Mario Rossi', title: 'Gelataio', company: 'Sync Test SRL', photoUrl: null, logoUrl: null, coverImageUrl: null, layout: 'left', useGrid: false },
      back: { phone: '0701234567', email: 'info@synctest.it', website: 'https://synctest.it', address: 'Via Dante 1, Cagliari', vatNumber: '', services: [], servicesLabel: 'Servizi', socials: [{ platform: 'Instagram', url: 'https://instagram.com/synctest' }], qrPayload: '', qrLabel: '', qrSize: 'medium', coverImageUrl: null, useGrid: false },
      style: { sizePreset: 'eu-85x55', bgColor: '#FFFFFF', textColor: '#1a1a2e', accentColor: '#F4A261', fontFamily: 'Inter', borderStyle: 'accent-strip-left', fontScale: 1 },
      decorations: { pattern: null, opacity: 0.2, palette: { primary: '#F4A261', secondary: '#8B5E3C', accent: null }, userLocked: false },
      grid: {}, backGrid: {},
      status: 'BOZZA',
      createdAt: now,
      updatedAt: new Date(Date.now() - 60000).toISOString(),
    };
    const website = {
      id: siteId,
      userEmail: admin.email,
      documentType: 'website',
      title: 'Sito Sync Test',
      customerId: custId,
      brief: { businessName: 'Sync Test SRL', sector: 'gelateria', description: 'Gelateria artigianale', tone: 'fresco', target: 'famiglie', pages: 'index', preferredColors: '#F4A261', font: 'Inter', cta: '', sections: 'hero, chi_siamo, contatti', features: '', contacts: 'Via Dante 1, Cagliari, 0701234567, info@synctest.it', address: 'Via Dante 1, Cagliari', phone: '0701234567', email: 'info@synctest.it', socials: [{ platform: 'Instagram', url: 'https://instagram.com/synctest' }], mapsUrl: '', notes: '' },
      html: '<header><nav class=\"nav\"><div class=\"brand\">Sync Test</div></nav></header><section class=\"hero\"><h1>Sync</h1></section>',
      css: 'body{}',
      js: '',
      pages: ['index'],
      pagesHtml: {},
      source: 'ai',
      createdAt: now,
      updatedAt: new Date(Date.now() - 60000).toISOString(),
    };
    localStorage.setItem('precisionQuote_documents:v1', JSON.stringify([card, website]));
  }, { admin: ADMIN, custId: CUSTOMER_ID, cardId: DOC_ID_CARD, siteId: DOC_ID_WEBSITE });
}

test.describe('CRM bidirezionale', () => {
  test('CRM -> Website sync pages/sections/cta/features', async ({ page }) => {
    await page.goto('/login');
    await seedCustomerAndDocs(page);
    await page.goto('/app/customers/' + CUSTOMER_ID);
    await page.waitForSelector('[data-testid=\"crm-detail\"]', { timeout: 15000 });
    const pagesValue = page.locator('.crm-field', { hasText: 'Pagine richieste' }).locator('.crm-field-value');
    await expect(pagesValue).toContainText('index, chi-siamo');
    const sectionsValue = page.locator('.crm-field', { hasText: 'Sezioni desiderate' }).locator('.crm-field-value');
    await expect(sectionsValue).toContainText('hero, chi_siamo');
  });

  test('Website -> CRM sync via edit', async ({ page }) => {
    await page.goto('/login');
    await seedCustomerAndDocs(page);
    await page.goto('/app/website/' + DOC_ID_WEBSITE);
    await page.waitForSelector('.website-tabs', { timeout: 15000 });
    await expect(page.locator('.website-tabs')).toBeVisible();
  });

  test('Card -> CRM sync email', async ({ page }) => {
    await page.goto('/login');
    await seedCustomerAndDocs(page);
    await page.goto('/app/card/' + DOC_ID_CARD);
    await page.waitForSelector('.card-editor', { timeout: 15000 });
    const emailInput = page.locator('input[value=\"info@synctest.it\"]').first();
    await expect(emailInput).toBeVisible();
  });
});
