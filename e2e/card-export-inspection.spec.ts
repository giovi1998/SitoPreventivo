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

async function applyGiovanniTemplate(page: any) {
  const banner = page.locator('.card-template-banner').first();
  if (await banner.count() > 0) {
    await banner.locator('button').filter({ hasText: /Applica template/i }).first().click();
    await page.waitForTimeout(600);
  }
}

async function exportAndRead(page: any, action: string | RegExp): Promise<{ download: any; buffer: Buffer; tempPath: string }> {
  const exportBtn = page.locator('[data-testid="mobile-export-btn"], .card-export-menu > button').first();
  await exportBtn.click();
  await page.waitForTimeout(200);
  const matcher = typeof action === 'string' ? new RegExp(action, 'i') : action;
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.getByRole('menuitem').filter({ hasText: matcher }).first().click(),
  ]);
  await expect(exportBtn.locator('span, :scope')).not.toContainText('Esportando', { timeout: 20000 });
  const tempPath = await download.path();
  const buffer = await fs.readFile(tempPath);
  return { download, buffer, tempPath };
}

function parseSvgBounds(svg: string) {
  const viewBox = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const width = viewBox ? parseInt(viewBox[1], 10) : 0;
  const height = viewBox ? parseInt(viewBox[2], 10) : 0;
  const texts = Array.from(svg.matchAll(/<text[^>]* x="([^"]+)"[^>]* y="([^"]+)"[^>]* font-size="([^"]+)"[^>]*>([^<]*)<\/text>/g)).map((m) => ({
    x: parseFloat(m[1]),
    y: parseFloat(m[2]),
    fontSize: parseFloat(m[3]),
    text: m[4],
  }));
  const images = Array.from(svg.matchAll(/<image[^>]* href="([^"]+)"[^>]* x="([^"]+)"[^>]* y="([^"]+)"[^>]* width="([^"]+)"[^>]* height="([^"]+)"[^>]*>/g)).map((m) => ({
    href: m[1],
    x: parseFloat(m[2]),
    y: parseFloat(m[3]),
    width: parseFloat(m[4]),
    height: parseFloat(m[5]),
  }));
  const qrRects = Array.from(svg.matchAll(/<rect[^>]* x="([^"]+)"[^>]* y="([^"]+)"[^>]* width="([^"]+)"[^>]* height="([^"]+)"[^>]* fill="#FFFFFF"[^>]*stroke="#01696F"[^>]*\/>/g)).map((m) => ({
    x: parseFloat(m[1]),
    y: parseFloat(m[2]),
    width: parseFloat(m[3]),
    height: parseFloat(m[4]),
  }));
  return { width, height, texts, images, qrRects };
}

function assertInside(bounds: { width: number; height: number }, els: Array<{ x: number; y: number; width?: number; height?: number; fontSize?: number; text?: string }>, tolerance = 0) {
  for (const el of els) {
    const w = el.width ?? 0;
    const h = el.height ?? (el.fontSize ? el.fontSize * 1.2 : 0);
    const right = el.x + w + tolerance;
    const bottom = el.y + h + tolerance;
    expect(right, `element ${el.text ?? 'image'} overflows right: x=${el.x} w=${w}`).toBeLessThanOrEqual(bounds.width + tolerance);
    expect(bottom, `element ${el.text ?? 'image'} overflows bottom: y=${el.y} h=${h}`).toBeLessThanOrEqual(bounds.height + tolerance);
    expect(el.x, `element ${el.text ?? 'image'} overflows left`).toBeGreaterThanOrEqual(-tolerance);
    expect(el.y, `element ${el.text ?? 'image'} overflows top`).toBeGreaterThanOrEqual(-tolerance);
  }
}

test.describe('Card export inspection', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/app/card');
    await page.waitForSelector('[data-testid="card-preview-front"]', { timeout: 10000 });
    await page.waitForTimeout(500);
  });

  test('Giovanni template preview is stable when toggling grid ON/OFF', async ({ page }) => {
    await applyGiovanniTemplate(page);

    const frontName = page.locator('[data-testid="card-preview-front"]').first();
    await expect(frontName).toContainText('GIOVANNI CIDU');
    await expect(frontName).toContainText('Web Developer');

    await page.screenshot({ path: 'e2e/__screenshots__/card-export-preview-off.png', fullPage: false });

    const gridToggle = page.locator('.card-grid-toggle').first();
    await gridToggle.click();
    await page.waitForTimeout(600);
    await expect(page.locator('[data-testid="card-preview-front"] [data-testid="card-grid-debug"]')).toBeVisible();
    await page.screenshot({ path: 'e2e/__screenshots__/card-export-preview-on.png', fullPage: false });

    await gridToggle.click();
    await page.waitForTimeout(600);
    await expect(page.locator('[data-testid="card-preview-front"] [data-testid="card-grid-debug"]')).toBeHidden();
    await page.screenshot({ path: 'e2e/__screenshots__/card-export-preview-off2.png', fullPage: false });

    await expect(frontName).toContainText('GIOVANNI CIDU');
  });

  test('SVG front export contains photo, name, title, logo and stays in bounds', async ({ page }) => {
    await applyGiovanniTemplate(page);

    const { buffer } = await exportAndRead(page, 'SVG fronte');
    expect(buffer.toString('utf8', 0, 5)).toBe('<?xml');
    const svg = buffer.toString('utf8');
    const parsed = parseSvgBounds(svg);

    expect(parsed.texts.some((t) => t.text.includes('GIOVANNI CIDU')), 'SVG front must contain name').toBe(true);
    expect(parsed.texts.some((t) => t.text.includes('Web Developer')), 'SVG front must contain title').toBe(true);
    // The Giovanni logo is an SVG image, not text.
    const logoImg = parsed.images.find((i) => i.href.includes('WebdevCA') || i.href.includes('svg+xml'));
    expect(logoImg, 'SVG front must contain the logo image').toBeTruthy();

    expect(parsed.images.length, 'SVG front must contain at least one image').toBeGreaterThan(0);
    const photo = parsed.images.find((i) => i.href.includes('giovanni-photo') || i.href.startsWith('data:'));
    expect(photo, 'SVG front must contain the photo image').toBeTruthy();

    assertInside(parsed, parsed.texts);
    assertInside(parsed, parsed.images);
  });

  test('SVG back export contains contacts, QR, socials and stays in bounds', async ({ page }) => {
    await applyGiovanniTemplate(page);

    const { buffer } = await exportAndRead(page, 'SVG retro');
    const svg = buffer.toString('utf8');
    const parsed = parseSvgBounds(svg);

    expect(parsed.texts.some((t) => t.text.includes('CONTATTI')), 'SVG back must contain eyebrow').toBe(true);
    expect(parsed.texts.some((t) => t.text.includes('35180008042')), 'SVG back must contain phone').toBe(true);
    expect(parsed.texts.some((t) => t.text.includes('LinkedIn')), 'SVG back must contain socials').toBe(true);
    expect(parsed.qrRects.length, 'SVG back must contain QR frame').toBeGreaterThan(0);

    assertInside(parsed, parsed.texts, 2);
    assertInside(parsed, parsed.qrRects, 2);

    // v2.10.1: fonts as fraction of card height (rem-scale). Absolute px
    // grows with export resolution (SVG uses mm*20 ≈ 1100px tall).
    // Regression was min(cell)*0.16 → ~8% of height (giant). Target ~2–4%.
    const H = parsed.height;
    const phoneKey = parsed.texts.find((t) => t.text === 'TELEFONO' || t.text.includes('TELEFONO'));
    expect(phoneKey, 'TELEFONO key must exist').toBeTruthy();
    expect(phoneKey!.fontSize / H, 'TELEFONO too small').toBeGreaterThan(0.015);
    expect(phoneKey!.fontSize / H, 'TELEFONO too large (cell-based regression)').toBeLessThan(0.04);

    const emailVal = parsed.texts.find((t) => t.text.includes('webdevcaglian') || t.text.includes('@gmail'));
    expect(emailVal, 'email value must exist').toBeTruthy();
    expect(emailVal!.fontSize / H, 'email font too large').toBeLessThan(0.05);

    const social = parsed.texts.find((t) => t.text.includes('LinkedIn'));
    expect(social, 'LinkedIn social must exist').toBeTruthy();
    expect(social!.fontSize / H).toBeGreaterThan(0.012);
    expect(social!.fontSize / H).toBeLessThan(0.04);

    // QR on the right half, not microscopic
    const qr = parsed.qrRects[0];
    expect(qr.x).toBeGreaterThan(parsed.width * 0.4);
    expect(qr.width / H).toBeGreaterThan(0.15);
    expect(qr.width / H).toBeLessThan(0.55);
  });

  test('SVG front logo fills its grid cell (not 60% shrink regression)', async ({ page }) => {
    await applyGiovanniTemplate(page);

    const { buffer } = await exportAndRead(page, 'SVG fronte');
    const svg = buffer.toString('utf8');
    const parsed = parseSvgBounds(svg);

    // Logo is typically the second image (photo is first). Cell is ~half width.
    // Full-cell logo (minus 8% inset) ≈ 0.42 * width. 60% shrink was ≈0.25.
    const logos = parsed.images.filter((i) => i.width < parsed.width * 0.6);
    const logo = logos.sort((a, b) => b.width - a.width)[0];
    expect(logo, 'logo image must exist').toBeTruthy();
    expect(logo!.width / parsed.width, 'logo too small (60% shrink regression)').toBeGreaterThan(0.35);
  });

  test('PNG front export is a valid non-empty image', async ({ page }) => {
    await applyGiovanniTemplate(page);

    const { buffer } = await exportAndRead(page, 'PNG fronte');
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50);
    expect(buffer[2]).toBe(0x4e);
    expect(buffer[3]).toBe(0x47);
    expect(buffer.length).toBeGreaterThan(10000);
  });

  test('PNG back export is a valid non-empty image', async ({ page }) => {
    await applyGiovanniTemplate(page);

    const { buffer } = await exportAndRead(page, 'PNG retro');
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50);
    expect(buffer[2]).toBe(0x4e);
    expect(buffer[3]).toBe(0x47);
    expect(buffer.length).toBeGreaterThan(10000);
  });

  test('PDF export is a valid non-empty PDF', async ({ page }) => {
    await applyGiovanniTemplate(page);

    const { buffer } = await exportAndRead(page, /PDF 10-up.*tipografia/i);
    expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);
  });

  test('Services appear in back SVG export', async ({ page }) => {
    await applyGiovanniTemplate(page);

    await page.locator('[data-testid="card-add-service"]').first().click();
    await page.waitForTimeout(200);
    await page.locator('[data-testid="card-add-service"]').first().click();
    await page.waitForTimeout(200);
    const serviceInputs = await page.locator('input[aria-label^="Servizio "]').all();
    await serviceInputs[0].fill('Sviluppo Web');
    await serviceInputs[1].fill('Consulenza SEO');
    await page.waitForTimeout(400);

    const { buffer } = await exportAndRead(page, 'SVG retro');
    const svg = buffer.toString('utf8');
    expect(svg).toContain('Sviluppo Web');
    expect(svg).toContain('Consulenza SEO');
  });
});
