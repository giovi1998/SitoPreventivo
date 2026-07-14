import { test, expect } from '@playwright/test';
import fs from 'fs/promises';

async function login(page: any) {
  await page.goto('/login');
  await page.evaluate(() => {
    const user = { email: 'test@example.com', password: 'Password123!' };
    localStorage.setItem('authToken', 'test-token');
    localStorage.setItem('userEmail', user.email);
    localStorage.setItem('username', 'Test');
    localStorage.setItem('userRole', 'user');
    localStorage.setItem('registeredUsers', JSON.stringify([{ email: user.email, password: user.password, username: 'Test', role: 'user' }]));
    localStorage.setItem('userSettings_test@example.com', JSON.stringify({ userEmail: user.email, onboardingDone: true, displayName: 'Test', companyName: 'Test', profession: 'Test', defaultColor: '#2563EB', defaultVat: 22, documentTheme: 'modern' }));
  });
}

async function fillSampleData(page: any) {
  const fill = async (label: RegExp, value: string) => {
    const labelEl = page.locator('label.card-field').filter({ hasText: label }).first();
    await labelEl.waitFor({ timeout: 5000 });
    await labelEl.locator('input, textarea, select').first().fill(value);
    await page.waitForTimeout(150);
  };
  await fill(/nome/i, 'Mario Rossi');
  await fill(/ruolo/i, 'Web Developer');
  await fill(/azienda/i, 'WebdevCA');
  await fill(/telefono/i, '+39 012 345 6789');
  await fill(/email/i, 'mario.rossi@example.com');
  await fill(/sito/i, 'https://giovannicidu.vercel.app');
}

async function enableGrid(page: any) {
  const gridToggle = page.locator('.card-grid-toggle').first();
  await gridToggle.click();
  await page.waitForTimeout(600);
  await expect(page.locator('[data-testid="card-preview-front"] [data-testid="card-grid-debug"]')).toBeVisible();
}

async function selectPreset(page: any, preset: string) {
  const presetSelect = page.locator('[data-testid="grid-editor-preset"]').first();
  await presetSelect.waitFor({ timeout: 5000 });
  await presetSelect.selectOption(preset);
  await page.waitForTimeout(300);
}

async function selectElement(page: any, element: string) {
  const elSelect = page.locator('select[aria-label="Elemento selezionato"]').first();
  await elSelect.waitFor({ timeout: 5000 });
  await elSelect.selectOption(element);
  await page.waitForTimeout(200);
}

async function moveElement(page: any, direction: 'left' | 'right' | 'up' | 'down') {
  const map: Record<string, string> = {
    left: 'grid-move-left',
    right: 'grid-move-right',
    up: 'grid-move-up',
    down: 'grid-move-down',
  };
  const btn = page.locator(`[data-testid="${map[direction]}"]`).first();
  await btn.waitFor({ timeout: 5000 });
  await btn.click();
  await page.waitForTimeout(300);
}

async function alignElement(page: any, h: 'left' | 'center' | 'right', v: 'top' | 'center' | 'bottom') {
  const btn = page.locator(`[data-testid="grid-align-${h}-${v}"]`).first();
  await btn.waitFor({ timeout: 5000 });
  await btn.click();
  await page.waitForTimeout(300);
}

async function exportAndReadSvg(page: any, side: 'front' | 'back'): Promise<string> {
  const exportBtn = page.locator('[data-testid="mobile-export-btn"], .card-export-menu > button').first();
  await exportBtn.click();
  await page.waitForTimeout(200);
  const matcher = side === 'front' ? /SVG fronte/i : /SVG retro/i;
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.getByRole('menuitem').filter({ hasText: matcher }).first().click(),
  ]);
  await expect(exportBtn.locator('span, :scope')).not.toContainText('Esportando', { timeout: 20000 });
  const tempPath = await download.path();
  const buffer = await fs.readFile(tempPath);
  return buffer.toString('utf8');
}

function getTextBounds(svg: string, text: string) {
  const re = new RegExp(`<text[^>]* x="([^"]+)"[^>]* y="([^"]+)"[^>]* font-size="([^"]+)"[^>]*>${text}</text>`);
  const m = svg.match(re);
  if (!m) return null;
  return { x: parseFloat(m[1]), y: parseFloat(m[2]), fontSize: parseFloat(m[3]) };
}

async function getSvgBounds(svg: string, viewBoxMatch?: RegExpMatchArray | null) {
  const viewBox = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const width = viewBox ? parseInt(viewBox[1], 10) : 0;
  const height = viewBox ? parseInt(viewBox[2], 10) : 0;
  return { width, height };
}

test.describe('Card grid round-trip: preview -> export', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/app/card');
    await page.waitForSelector('[data-testid="card-preview-front"]', { timeout: 10000 });
    await fillSampleData(page);
    await page.waitForTimeout(400);
  });

  test('Moving company down reflects in preview and front SVG export', async ({ page }) => {
    await enableGrid(page);
    await selectPreset(page, 'left');
    await selectElement(page, 'company');

    const companyCell = page.locator('[data-testid="grid-el-company"]').first();
    await companyCell.scrollIntoViewIfNeeded();
    const beforeGridRow = await companyCell.evaluate((el) => window.getComputedStyle(el).gridRow);

    await moveElement(page, 'down');
    await page.waitForTimeout(200);

    // Focus-on-click can scroll the preview out of viewport; reset scroll to
    // measure the actual rendered position of the grid cell.
    await page.evaluate(() => window.scrollTo(0, 0));
    await companyCell.scrollIntoViewIfNeeded();

    const afterGridRow = await companyCell.evaluate((el) => window.getComputedStyle(el).gridRow);

    // Grid row must change (e.g. "3 / span 1" -> "4 / span 1")
    expect(afterGridRow).not.toBe(beforeGridRow);

    await page.screenshot({ path: 'e2e/__screenshots__/roundtrip-move-company-preview.png', fullPage: false });

    const svg = await exportAndReadSvg(page, 'front');
    expect(svg).toContain('WebdevCA');
    const bounds = getTextBounds(svg, 'WebdevCA');
    expect(bounds, 'company text must be present in SVG').not.toBeNull();

    await page.screenshot({ path: 'e2e/__screenshots__/roundtrip-move-company-export.png', fullPage: false });
  });

  test('3x3 alignment (bottom-right) reflects in preview and front SVG export', async ({ page }) => {
    await enableGrid(page);
    await selectPreset(page, 'left');
    await selectElement(page, 'name');

    await alignElement(page, 'right', 'bottom');

    // Preview: name cell should have flex alignment bottom-right
    const nameCell = page.locator('[data-testid="grid-el-name"]').first();
    await expect(nameCell).toBeVisible();
    const alignItems = await nameCell.evaluate((el) => window.getComputedStyle(el).alignItems);
    const justifyContent = await nameCell.evaluate((el) => window.getComputedStyle(el).justifyContent);
    expect(['flex-end', 'end']).toContain(alignItems);
    expect(['flex-end', 'end', 'right']).toContain(justifyContent);

    await page.screenshot({ path: 'e2e/__screenshots__/roundtrip-align-name-preview.png', fullPage: false });

    const svg = await exportAndReadSvg(page, 'front');
    const bounds = getTextBounds(svg, 'MARIO ROSSI');
    expect(bounds, 'name text must be present in SVG').not.toBeNull();
    expect(bounds!.x).toBeGreaterThan(0);
    expect(bounds!.y).toBeGreaterThan(0);
  });

  test('Adding services reflects in back preview and back SVG export', async ({ page }) => {
    await page.locator('[data-testid="card-add-service"]').first().click();
    await page.waitForTimeout(200);
    await page.locator('[data-testid="card-add-service"]').first().click();
    await page.waitForTimeout(200);

    const serviceInputs = await page.locator('input[aria-label^="Servizio "]').all();
    await serviceInputs[0].fill('Sviluppo Web');
    await serviceInputs[1].fill('Consulenza SEO');
    await page.waitForTimeout(400);

    // Preview back must contain services
    const back = page.locator('[data-testid="card-preview-back"]').first();
    await expect(back).toContainText('Sviluppo Web');
    await expect(back).toContainText('Consulenza SEO');

    await page.screenshot({ path: 'e2e/__screenshots__/roundtrip-services-preview.png', fullPage: false });

    const svg = await exportAndReadSvg(page, 'back');
    expect(svg).toContain('Sviluppo Web');
    expect(svg).toContain('Consulenza SEO');
  });

  test('Back grid: socials stay in their own cell in SVG export', async ({ page }) => {
    await page.locator('[data-testid="card-add-social"]').first().click();
    await page.waitForTimeout(200);
    await page.locator('[data-testid="card-add-social"]').first().click();
    await page.waitForTimeout(200);

    const socialRows = await page.locator('.card-social-row').all();
    expect(socialRows.length).toBeGreaterThanOrEqual(2);

    await socialRows[0].locator('select').first().selectOption('LinkedIn');
    await socialRows[0].locator('input').first().fill('https://linkedin.com/in/mario');
    await socialRows[1].locator('select').first().selectOption('GitHub');
    await socialRows[1].locator('input').first().fill('https://github.com/mario');
    await page.waitForTimeout(400);

    const svg = await exportAndReadSvg(page, 'back');
    expect(svg).toContain('LinkedIn');
    expect(svg).toContain('GitHub');

    await page.screenshot({ path: 'e2e/__screenshots__/roundtrip-socials-preview.png', fullPage: false });
  });

  test('Back grid 3x3 alignment for contacts and services reflects in SVG export', async ({ page }) => {
    await enableGrid(page);

    const sideSelect = page.locator('select[aria-label="Lato griglia"]').first();
    await sideSelect.selectOption('back');
    await page.waitForTimeout(300);

    // Add services so the backGrid gets a services cell
    await page.locator('[data-testid="card-add-service"]').first().click();
    await page.waitForTimeout(200);
    const serviceInputs = await page.locator('input[aria-label^="Servizio "]').all();
    await serviceInputs[0].fill('UX Design');
    await page.waitForTimeout(400);

    await selectElement(page, 'contacts');
    await alignElement(page, 'right', 'bottom');

    await selectElement(page, 'services');
    await alignElement(page, 'center', 'center');

    await page.screenshot({ path: 'e2e/__screenshots__/roundtrip-back-align-preview.png', fullPage: false });

    const svg = await exportAndReadSvg(page, 'back');
    expect(svg).toContain('UX Design');
    expect(svg).toContain('TELEFONO');

    await page.screenshot({ path: 'e2e/__screenshots__/roundtrip-back-align-export.png', fullPage: false });
  });

  test('Back grid move + services + export PNG/PDF are non-empty', async ({ page }) => {
    await enableGrid(page);

    // Switch to back grid
    const sideSelect = page.locator('select[aria-label="Lato griglia"]').first();
    await sideSelect.selectOption('back');
    await page.waitForTimeout(300);

    // Add services
    await page.locator('[data-testid="card-add-service"]').first().click();
    await page.waitForTimeout(200);
    await page.locator('[data-testid="card-add-service"]').first().click();
    await page.waitForTimeout(200);
    const serviceInputs = await page.locator('input[aria-label^="Servizio "]').all();
    await serviceInputs[0].fill('UX Design');
    await serviceInputs[1].fill('Brand Identity');
    await page.waitForTimeout(400);

    await selectElement(page, 'qr');
    await moveElement(page, 'left');

    await page.screenshot({ path: 'e2e/__screenshots__/roundtrip-back-move-services-preview.png', fullPage: false });

    // Export PNG back
    const exportBtn = page.locator('[data-testid="mobile-export-btn"], .card-export-menu > button').first();
    await exportBtn.click();
    await page.waitForTimeout(200);

    const [pngDownload] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.getByRole('menuitem').filter({ hasText: /PNG retro/i }).first().click(),
    ]);
    const pngPath = await pngDownload.path();
    const pngBuffer = await fs.readFile(pngPath);
    expect(pngBuffer[0]).toBe(0x89);
    expect(pngBuffer[1]).toBe(0x50);
    expect(pngBuffer.length).toBeGreaterThan(10000);

    // Export PDF
    await exportBtn.click();
    await page.waitForTimeout(200);
    const [pdfDownload] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.getByRole('menuitem').filter({ hasText: /PDF 10-up.*tipografia/i }).first().click(),
    ]);
    const pdfPath = await pdfDownload.path();
    const pdfBuffer = await fs.readFile(pdfPath);
    expect(pdfBuffer.toString('utf8', 0, 5)).toBe('%PDF-');
    expect(pdfBuffer.length).toBeGreaterThan(1000);
  });
});
