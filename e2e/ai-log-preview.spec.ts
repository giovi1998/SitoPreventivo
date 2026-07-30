import { test, expect, type Page } from '@playwright/test';
import { testUser } from './fixtures';

const TEST_USER = testUser;

const ADMIN_USER = {
  email: 'admin-test@example.com',
  password: 'Password123!',
  username: 'AdminTest',
  role: 'admin',
};

async function seedAuth(page: Page, user = TEST_USER): Promise<void> {
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
        displayName: 'Test',
        companyName: 'Test',
        profession: 'Test',
        defaultColor: '#2563EB',
        defaultVat: 22,
        documentTheme: 'modern',
        preferredDocumentType: 'logo',
      }),
    );
  }, user);
}

function setAiPrefs(page: Page, editor: 'flyer' | 'logo' | 'editor'): Promise<void> {
  return page.evaluate((editorKind) => {
    const raw = localStorage.getItem('pq_ui:v1');
    const prefs = raw ? JSON.parse(raw) : {};
    prefs.aiProviderDefault = 'ollama-minimax-m3';
    prefs.aiVisionEnabled = true;
    prefs.aiConsoleExpanded = { ...(prefs.aiConsoleExpanded || {}), [editorKind]: true };
    localStorage.setItem('pq_ui:v1', JSON.stringify(prefs));
  }, editor);
}

async function blockAiChat(page: Page): Promise<void> {
  await page.route('/api/ai/chat*', (route) => route.abort('blockedbyclient'));
}

async function openLogPanel(page: Page): Promise<void> {
  const toggle = page.locator('.ai-console__log-toggle').first();
  if (await toggle.count() > 0) {
    const expanded = await toggle.getAttribute('aria-expanded');
    if (expanded !== 'true') {
      await toggle.click();
      await page.waitForTimeout(200);
    }
  }
}

async function openLogFullscreen(page: Page): Promise<void> {
  const expandBtn = page.locator('button[aria-label="Apri log completo"]').first();
  if (await expandBtn.count() > 0) {
    await expandBtn.click();
    await page.waitForTimeout(200);
  }
}

async function expandFirstLogEntry(page: Page): Promise<void> {
  const fullscreenRows = page.locator('.ai-log-fullscreen .ai-log-row');
  if (await fullscreenRows.count() > 0) {
    await fullscreenRows.first().click();
    await page.waitForTimeout(200);
    return;
  }
  const rows = page.locator('.ai-log-entry .ai-log-row').all();
  const first = (await rows)[0];
  if (first) {
    await first.click();
    await page.waitForTimeout(200);
  }
}

async function selectVisionProvider(page: Page): Promise<void> {
  const badge = page.locator('[data-testid="ai-provider-badge"]').first();
  if (await badge.count() === 0) return;
  await badge.click();
  const menu = page.locator('[data-testid="ai-provider-menu"]').first();
  await expect(menu).toBeVisible();
  const visionOption = page.getByRole('option', { name: /MiniMax M3/i }).first();
  if (await visionOption.count() > 0) {
    await visionOption.click();
  } else {
    const fallback = page.locator('.ai-provider-badge__option-tag', { hasText: /vision/i }).first();
    if (await fallback.count() > 0) await fallback.locator('xpath=../../..').click();
  }
  await page.waitForTimeout(200);
}

async function ensureAiConsoleExpanded(page: Page): Promise<void> {
  const toggle = page.locator('.ai-console__toggle').first();
  if (await toggle.count() === 0) return;
  const expanded = await toggle.getAttribute('aria-expanded');
  if (expanded !== 'true') {
    await toggle.click();
    await page.waitForTimeout(300);
  }
}

async function dismissOnboarding(page: Page): Promise<void> {
  const overlay = page.locator('.onb-overlay').first();
  if (await overlay.count() === 0) return;
  const skip = page.locator('.onb-overlay button', { hasText: /Salta/i }).first();
  if (await skip.count() > 0) {
    await skip.click();
    await page.waitForTimeout(300);
    return;
  }
  // Fallback: fill first step name and continue until done/skip appears.
  const nameInput = page.locator('.onb-overlay input').first();
  if (await nameInput.count() > 0) await nameInput.fill('Test');
  for (let i = 0; i < 6; i++) {
    const next = page.locator('.onb-overlay button', { hasText: /Continua|Inizia/i }).first();
    if (await next.count() === 0) break;
    await next.click();
    await page.waitForTimeout(200);
    const skip2 = page.locator('.onb-overlay button', { hasText: /Salta/i }).first();
    if (await skip2.count() > 0) {
      await skip2.click();
      await page.waitForTimeout(200);
      break;
    }
  }
}

async function firstLogPreviewSrc(page: Page): Promise<string | null> {
  const fullscreenImg = page.locator('.ai-log-fullscreen .ai-log-preview-img').first();
  if (await fullscreenImg.count() > 0) {
    await expect(fullscreenImg).toBeVisible();
    return fullscreenImg.getAttribute('src');
  }
  const img = page.locator('.ai-log-entry .ai-log-preview-img').first();
  await expect(img).toBeVisible();
  return img.getAttribute('src');
}

async function assertImageNotMostlyBlack(page: Page, src: string): Promise<void> {
  const isMostlyBlack = await page.evaluate(async (imageSrc) => {
    const res = await fetch(imageSrc);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, bitmap.width);
    canvas.height = Math.max(1, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonBlack = 0;
    const step = 16; // sample every 4th pixel
    for (let i = 0; i < data.length; i += step * 4) {
      if (data[i] > 30 || data[i + 1] > 30 || data[i + 2] > 30) nonBlack++;
    }
    // A real preview should have many non-black pixels; a black/empty image has very few.
    return nonBlack < 20;
  }, src);
  expect(isMostlyBlack, 'Log preview image should not be mostly black').toBe(false);
}

async function assertPreviewNotMostlyBlack(page: Page, selector: string): Promise<void> {
  const el = page.locator(selector).first();
  await expect(el).toBeVisible();
  const box = await el.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(50);
  expect(box!.height).toBeGreaterThan(50);
  const screenshot = await el.screenshot();
  let nonBlack = 0;
  for (let i = 0; i < screenshot.length; i += 4 * 16) {
    if (screenshot[i] > 30 || screenshot[i + 1] > 30 || screenshot[i + 2] > 30) nonBlack++;
  }
  expect(nonBlack, `Preview ${selector} should not be mostly black`).toBeGreaterThan(20);
}

test.describe('AI log preview images are not black', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 950 });
    await page.goto('/login');
    await seedAuth(page);
  });

  test('flyer AI log preview is visible and not black', async ({ page }) => {
    await setAiPrefs(page, 'flyer');
    await page.goto('/app/flyer');
    await page.waitForSelector('[data-testid="flyer-preview"]', { timeout: 10000 });
    await page.waitForTimeout(500);

    await assertPreviewNotMostlyBlack(page, '[data-flyer-preview]');
    await dismissOnboarding(page);
    await ensureAiConsoleExpanded(page);

    // Compila headline così la preview AI ha contenuto da catturare.
    const headlineInput = page.locator('input[placeholder="Es. Sagra del paese"]').first();
    await headlineInput.click();
    await headlineInput.pressSequentially('Cena di degustazione', { delay: 20 });
    await page.locator('input[placeholder="Es. 15 agosto, ingresso gratis"]').first().pressSequentially('Venerdì 20:30, posti limitati', { delay: 20 });
    await page.locator('textarea[placeholder="Es. Cibo tipico, musica dal vivo, ingresso gratuito."]').first().pressSequentially('Menu di 5 portate con vini selezionati.', { delay: 20 });
    await page.waitForTimeout(1000);

    const textarea = page.locator('textarea[aria-label="Brief AI"]').first();
    await textarea.fill('Cena di degustazione, 5 portate, venerdi 20:30, posti limitati');
    await page.waitForTimeout(200);
    await page.getByText('✨ Genera copy').first().click({ force: true });

    await openLogPanel(page);
    await page.waitForSelector('.ai-log-entry', { state: 'attached', timeout: 20000 });
    await openLogFullscreen(page);
    await expandFirstLogEntry(page);

    const src = await firstLogPreviewSrc(page);
    expect(src).toMatch(/^data:image\/jpeg;base64,/);
    await assertImageNotMostlyBlack(page, src!);
  });

  test('logo AI log preview is visible and not black', async ({ page }) => {
    await setAiPrefs(page, 'logo');
    await blockAiChat(page);
    await page.goto('/app/logo');
    await page.waitForSelector('[data-logo-preview]', { timeout: 10000 });
    await page.waitForTimeout(500);
    await dismissOnboarding(page);

    // Carica un template food così il preview ha contenuto colorato.
    await page.locator('.logo-tab', { hasText: /Builder/i }).click();
    await page.getByRole('button', { name: /Food/i }).first().click();
    await page.waitForTimeout(300);

    await page.locator('.logo-tab', { hasText: /AI Assist/i }).click();
    await page.waitForTimeout(200);

    await assertPreviewNotMostlyBlack(page, '[data-logo-preview]');

    await page.getByPlaceholder(/Pizzeria moderna/i).first().fill('Pizzeria moderna nel centro di Cagliari');
    await page.getByPlaceholder(/giovani 25-35, foodies/i).first().fill('giovani 25-35, foodies');
    await page.getByRole('button', { name: /Genera 3 concept/i }).first().click();

    await page.waitForSelector('.ai-log-entry', { timeout: 10000 });
    await expandFirstLogEntry(page);

    const src = await firstLogPreviewSrc(page);
    expect(src).toMatch(/^data:image\/jpeg;base64,/);
    await assertImageNotMostlyBlack(page, src!);
  });

  test('quote AI log preview is visible and not black', async ({ page }) => {
    await seedAuth(page, ADMIN_USER);
    await setAiPrefs(page, 'editor');
    await page.goto('/app/editor');
    await page.waitForTimeout(500);
    await page.waitForSelector('[data-quote-preview]', { timeout: 10000 });
    await page.waitForTimeout(500);

    await assertPreviewNotMostlyBlack(page, '[data-quote-preview]');
    await dismissOnboarding(page);
    await ensureAiConsoleExpanded(page);
    await selectVisionProvider(page);

    const textarea = page.locator('textarea[aria-label="Prompt modifica AI"]').first();
    await textarea.fill('Aggiungi una voce di consulenza da 500 euro');
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: /Applica prompt/i }).first().click({ force: true });

    await openLogPanel(page);
    await page.waitForSelector('.ai-log-entry', { state: 'attached', timeout: 20000 });
    await expandFirstLogEntry(page);

    const src = await firstLogPreviewSrc(page);
    expect(src).toMatch(/^data:image\/jpeg;base64,/);
    await assertImageNotMostlyBlack(page, src!);
  });
});
