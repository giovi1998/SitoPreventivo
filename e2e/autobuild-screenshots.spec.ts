import { test, expect, type Page } from '@playwright/test';
import { adminUser } from './fixtures';

const ADMIN = adminUser;

const CUSTOMER_ID = 'cust_e2e_autobuild_001';
const LOGO_DOC_ID = 'logo_e2e_autobuild_001';
const CARD_DOC_ID = 'card_e2e_autobuild_001';
const FLYER_DOC_ID = 'flyer_e2e_autobuild_001';
const WEBSITE_DOC_ID = 'website_e2e_autobuild_001';

function seedAdminAndCustomer(page: Page): Promise<void> {
  return page.evaluate(
    ({ customerId, logoDoc, cardDoc, flyerDoc, websiteDoc, customer, user }) => {
      localStorage.setItem('authToken', 'admin-token');
      localStorage.setItem('userEmail', user.email);
      localStorage.setItem('username', user.username);
      localStorage.setItem('userRole', user.role);
      localStorage.setItem(
        'registeredUsers',
        JSON.stringify([
          {
            email: user.email,
            password: user.password,
            username: user.username,
            role: user.role,
            tokensUsed: 0,
            tokenLimit: 1000000,
            createdAt: new Date().toISOString(),
          },
        ]),
      );
      localStorage.setItem(
        `userSettings_${user.email}`,
        JSON.stringify({
          userEmail: user.email,
          onboardingDone: true,
          displayName: 'Admin',
          companyName: 'Admin',
          profession: 'Admin',
          defaultColor: '#2563EB',
          defaultVat: 22,
          documentTheme: 'modern',
          preferredDocumentType: 'logo',
          tier: 'unlocked',
        }),
      );
      localStorage.setItem('unlock_codes', JSON.stringify([]));
      localStorage.setItem('precisionQuote_quotes', JSON.stringify([]));
      localStorage.setItem('precisionQuote_documents:v1', JSON.stringify([logoDoc, cardDoc, flyerDoc, websiteDoc]));
      localStorage.setItem(
        'pq_customers:v1',
        JSON.stringify([
          {
            ...customer,
            id: customerId,
            documents: [logoDoc, cardDoc, flyerDoc, websiteDoc].map((d) => d.id),
          },
        ]),
      );
    },
    {
      customerId: CUSTOMER_ID,
      user: ADMIN,
      customer: {
        businessName: 'Osteria E2E Autobuild',
        ownerName: 'Mario Rossi',
        activity: 'Ristorante thailandese',
        description: 'Authentic Thai cuisine blending tradition and European flavors.',
        mood: 'elegante e accogliente',
        target: 'famiglie e giovani coppie',
        preferredColors: '#D94625,#F2C94C,#1E3A29',
        contacts: { phone: '+39 070 1234567', email: 'info@osteria-e2e.it', address: 'Via Roma 1, Cagliari' },
        socials: ['https://instagram.com/osteriae2e', 'https://facebook.com/osteriae2e'],
        aiSuggestedFields: {
          notes: 'Usa tono caldo, menu fusion, servizio attento.',
          features: 'Menu thai, takeaway, cena romantica, cucina vegana',
        },
        updatedAt: new Date().toISOString(),
      },
      logoDoc: {
        id: LOGO_DOC_ID,
        customerId: CUSTOMER_ID,
        documentType: 'logo',
        title: 'Logo Osteria E2E',
        status: 'BOZZA',
        autoGeneratePending: true,
        updatedAt: new Date().toISOString(),
        builder: {
          primaryText: 'Osteria E2E',
          tagline: 'Thai Fusion',
          layout: 'horizontal',
          iconType: 'lucide',
          iconGlyph: 'chef-hat',
          primaryColor: '#D94625',
          secondaryColor: '#1E3A29',
          bgColor: '#FFFFFF',
        },
      },
      cardDoc: {
        id: CARD_DOC_ID,
        customerId: CUSTOMER_ID,
        documentType: 'businessCard',
        title: 'Card Osteria E2E',
        status: 'BOZZA',
        autoGeneratePending: true,
        updatedAt: new Date().toISOString(),
        front: {
          name: 'Mario Rossi',
          title: 'Chef & Owner',
          company: 'Osteria E2E',
          layout: 'centered',
          useGrid: true,
        },
        back: {
          email: 'info@osteria-e2e.it',
          phone: '+39 070 1234567',
          website: 'https://osteria-e2e.it',
          address: 'Via Roma 1, Cagliari',
          socials: [],
          services: [],
        },
        style: { primaryColor: '#D94625', accentColor: '#F2C94C', bgColor: '#FFFFFF', textColor: '#1E3A29', fontFamily: 'Inter' },
      },
      flyerDoc: {
        id: FLYER_DOC_ID,
        customerId: CUSTOMER_ID,
        documentType: 'flyer',
        title: 'Flyer Osteria E2E',
        status: 'BOZZA',
        autoGeneratePending: true,
        updatedAt: new Date().toISOString(),
        size: 'A5',
        orientation: 'portrait',
        content: { headline: '', subheadline: '', body: '', cta: { label: '', url: '' }, qrPayload: '', qrLabel: '' },
        style: { layout: 'classic', primaryColor: '#D94625', secondaryColor: '#F2C94C', bgColor: '#FFFFFF', textColor: '#1E3A29', fontFamily: 'Inter' },
      },
      websiteDoc: {
        id: WEBSITE_DOC_ID,
        customerId: CUSTOMER_ID,
        documentType: 'website',
        title: 'Sito Osteria E2E',
        status: 'BOZZA',
        autoGeneratePending: true,
        updatedAt: new Date().toISOString(),
        html: '',
        css: '',
        js: '',
        pages: ['index'],
        pagesHtml: {},
        brief: {
          businessName: 'Osteria E2E Autobuild',
          sector: 'ristorante thailandese',
          description: 'Authentic Thai cuisine blending tradition and European flavors.',
          tone: 'caldo ed elegante',
          target: 'famiglie e giovani coppie',
          preferredColors: '#D94625,#F2C94C,#1E3A29',
          cta: 'Prenota un tavolo',
          features: 'Menu thai, takeaway, cena romantica',
          contacts: 'Via Roma 1, Cagliari — +39 070 1234567 — info@osteria-e2e.it',
          socials: ['https://instagram.com/osteriae2e', 'https://facebook.com/osteriae2e'],
        },
      },
    },
  );
}

test.describe('Auto-build screenshots', () => {
  test.setTimeout(600_000);
  test.slow();

  test('genera bozze AI per tutti gli oggetti e salva screenshot', async ({ page }) => {
    test.setTimeout(600_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/login');
    await seedAdminAndCustomer(page);
    await page.goto(`/app/customers/${CUSTOMER_ID}`);
    await page.waitForSelector('[data-testid="crm-generate-drafts-btn"]', { timeout: 15000 });

    // Trigger autobuild (agentMode).
    await page.getByTestId('crm-generate-drafts-btn').click();

    // Attende fine generazione: log success o bottone torna idle.
    await page.waitForFunction(
      () => {
        const log = document.body.innerText || '';
        if (log.includes('Generazione bozze AI completata')) return true;
        const btn = document.querySelector('[data-testid="crm-generate-drafts-btn"]');
        const text = (btn?.textContent ?? '').toLowerCase();
        // durante generazione il bottone mostra "agente: ..." o "generazione…"
        return text.includes('genera bozze ai') && !document.body.innerText.includes('Generazione bozze AI in corso');
      },
      { timeout: 600000 },
    );
    await page.waitForTimeout(1000);

    // Screenshot riepilogo CRM post-autobuild.
    await page.screenshot({ path: 'e2e/screenshots/autobuild-crm-summary.png', fullPage: true });

    // Screenshot collection con preview inline.
    await page.goto('/app/collection');
    await page.waitForSelector('[data-testid="collection-grid"]', { timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e/screenshots/autobuild-collection.png', fullPage: true });

    // Screenshot singoli editori.
    const shots = [
      { docId: LOGO_DOC_ID, file: 'autobuild-logo-editor.png', url: `/app/logo/${LOGO_DOC_ID}` },
      { docId: CARD_DOC_ID, file: 'autobuild-card-editor.png', url: `/app/card/${CARD_DOC_ID}` },
      { docId: FLYER_DOC_ID, file: 'autobuild-flyer-editor.png', url: `/app/flyer/${FLYER_DOC_ID}` },
      { docId: WEBSITE_DOC_ID, file: 'autobuild-website-editor.png', url: `/app/website/${WEBSITE_DOC_ID}` },
    ];
    for (const shot of shots) {
      await page.goto(shot.url);
      await page.waitForTimeout(4000); // preview/prerender
      await page.screenshot({ path: `e2e/screenshots/${shot.file}`, fullPage: true });
    }

    // Torna in CRM e verifica stato done
    await page.goto(`/app/customers/${CUSTOMER_ID}`);
    await expect(page.getByTestId('crm-generate-drafts-btn')).toBeVisible();
    await expect(page.locator('text=Generazione bozze AI completata').first()).toBeVisible({ timeout: 10000 });
  });
});
