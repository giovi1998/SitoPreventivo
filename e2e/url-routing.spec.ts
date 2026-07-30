import { test, expect, type Page } from '@playwright/test';
import { seedAuth } from './helpers/cardHarness';
import { testUser } from './fixtures';

const TEST_USER = testUser;
const SEED_DOC_ID = 'card_e2e_routing_test';

function seedCardDocument(page: Page): Promise<void> {
  return page.evaluate(({ email, docId }) => {
    const doc = {
      id: docId,
      userEmail: email,
      documentType: 'businessCard',
      title: 'Routing Test Card',
      front: { name: 'Mario Rossi', title: 'Dev', company: 'Acme', photoUrl: null, logoUrl: null, coverImageUrl: null, logoBackground: 'none', layout: 'left', useGrid: false },
      back: { phone: '+39 012 3456', email: 'mario@example.com', website: '', address: '', vatNumber: '', services: [], servicesLabel: 'Servizi', socials: [], qrPayload: '', qrLabel: '', qrSize: 'medium', coverImageUrl: null, useGrid: false },
      style: { sizePreset: 'eu-85x55', bgColor: '#FFFFFF', textColor: '#1a1a2e', accentColor: '#01696F', fontFamily: 'Inter', borderStyle: 'accent-strip-left', fontScale: 1 },
    };
    const existing = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
    if (!existing.some((d: any) => d.id === docId)) {
      existing.push(doc);
      localStorage.setItem('precisionQuote_documents:v1', JSON.stringify(existing));
    }
  }, { email: TEST_USER.email, docId: SEED_DOC_ID });
}

async function loginAndSeed(page: Page) {
  await page.goto('/login');
  await seedAuth(page);
  await seedCardDocument(page);
}

test.describe('URL document-ID routing', () => {
  test('navigate to /app/card/:id loads the correct document', async ({ page }) => {
    await loginAndSeed(page);
    await page.goto(`/app/card/${SEED_DOC_ID}`);
    await page.waitForSelector('[data-testid="card-preview-front"]', { timeout: 10000 });
    await expect(page.locator('text=Mario Rossi').first()).toBeVisible();
    expect(page.url()).toContain(`/app/card/${SEED_DOC_ID}`);
  });

  test('opening a card URL in a new tab loads the same document', async ({ page, context }) => {
    await loginAndSeed(page);
    await page.goto(`/app/card/${SEED_DOC_ID}`);
    await page.waitForSelector('[data-testid="card-preview-front"]', { timeout: 10000 });
    const url = page.url();

    const newPage = await context.newPage();
    await newPage.goto(url);
    await newPage.waitForSelector('[data-testid="card-preview-front"]', { timeout: 10000 });
    await expect(newPage.locator('text=Mario Rossi').first()).toBeVisible();
    expect(newPage.url()).toContain(SEED_DOC_ID);
  });

  test('page refresh preserves the loaded document', async ({ page }) => {
    await loginAndSeed(page);
    await page.goto(`/app/card/${SEED_DOC_ID}`);
    await page.waitForSelector('[data-testid="card-preview-front"]', { timeout: 10000 });
    await expect(page.locator('text=Mario Rossi').first()).toBeVisible();

    await page.reload();
    await page.waitForSelector('[data-testid="card-preview-front"]', { timeout: 10000 });
    await expect(page.locator('text=Mario Rossi').first()).toBeVisible();
    expect(page.url()).toContain(`/app/card/${SEED_DOC_ID}`);
  });

  test('invalid docId redirects to base editor', async ({ page }) => {
    await loginAndSeed(page);
    await page.goto('/app/card/DOES_NOT_EXIST_999');
    await page.waitForTimeout(3000);
    expect(page.url()).not.toContain('DOES_NOT_EXIST_999');
  });

  test('root /app/card loads without docId (new document mode)', async ({ page }) => {
    await loginAndSeed(page);
    await page.goto('/app/card');
    await page.waitForSelector('[data-testid="card-preview-front"]', { timeout: 10000 });
    expect(page.url()).toMatch(/\/app\/card\/?$/);
  });
});
