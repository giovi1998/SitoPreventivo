import { test, expect } from '@playwright/test';
import {
  loginAsTestUser,
  openCardEditor,
  applyGiovanniTemplate,
  exportCard,
  parseCardSvg,
  assertInside,
  getTextBounds,
  addServices,
} from './helpers/cardHarness';

test.describe('Card export inspection', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await openCardEditor(page);
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

    const { buffer } = await exportCard(page, 'svg-front');
    expect(buffer.toString('utf8', 0, 5)).toBe('<?xml');
    const svg = buffer.toString('utf8');
    const parsed = parseCardSvg(svg);

    expect(parsed.texts.some((t) => t.text.includes('GIOVANNI CIDU')), 'SVG front must contain name').toBe(true);
    expect(parsed.texts.some((t) => t.text.includes('Web Developer')), 'SVG front must contain title').toBe(true);
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

    const { buffer } = await exportCard(page, 'svg-back');
    const svg = buffer.toString('utf8');
    const parsed = parseCardSvg(svg);

    expect(parsed.texts.some((t) => t.text.includes('CONTATTI')), 'SVG back must contain eyebrow').toBe(true);
    expect(parsed.texts.some((t) => t.text.includes('35180008042')), 'SVG back must contain phone').toBe(true);
    expect(parsed.texts.some((t) => t.text.includes('LinkedIn')), 'SVG back must contain socials').toBe(true);
    expect(parsed.qrRects.length, 'SVG back must contain QR frame').toBeGreaterThan(0);

    assertInside(parsed, parsed.texts, 2);
    assertInside(parsed, parsed.qrRects, 2);

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

    const qr = parsed.qrRects[0];
    expect(qr.x).toBeGreaterThan(parsed.width * 0.4);
    expect(qr.width / H).toBeGreaterThan(0.15);
    expect(qr.width / H).toBeLessThan(0.55);
  });

  test('SVG front logo fills its grid cell (not 60% shrink regression)', async ({ page }) => {
    await applyGiovanniTemplate(page);

    const { buffer } = await exportCard(page, 'svg-front');
    const svg = buffer.toString('utf8');
    const parsed = parseCardSvg(svg);

    const logos = parsed.images.filter((i) => i.width < parsed.width * 0.6);
    const logo = logos.sort((a, b) => b.width - a.width)[0];
    expect(logo, 'logo image must exist').toBeTruthy();
    expect(logo!.width / parsed.width, 'logo too small (60% shrink regression)').toBeGreaterThan(0.35);
  });

  test('PNG front export is a valid non-empty image', async ({ page }) => {
    await applyGiovanniTemplate(page);

    const { buffer } = await exportCard(page, 'png-front');
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50);
    expect(buffer[2]).toBe(0x4e);
    expect(buffer[3]).toBe(0x47);
    expect(buffer.length).toBeGreaterThan(10000);
  });

  test('PNG back export is a valid non-empty image', async ({ page }) => {
    await applyGiovanniTemplate(page);

    const { buffer } = await exportCard(page, 'png-back');
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50);
    expect(buffer[2]).toBe(0x4e);
    expect(buffer[3]).toBe(0x47);
    expect(buffer.length).toBeGreaterThan(10000);
  });

  test('PDF export is a valid non-empty PDF', async ({ page }) => {
    await applyGiovanniTemplate(page);

    const { buffer } = await exportCard(page, 'pdf');
    expect(buffer.toString('utf8', 0, 5)).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);
  });

  test('Services appear in back SVG export', async ({ page }) => {
    await applyGiovanniTemplate(page);

    await addServices(page, ['Sviluppo Web', 'Consulenza SEO']);

    const { buffer } = await exportCard(page, 'svg-back');
    const svg = buffer.toString('utf8');
    expect(svg).toContain('Sviluppo Web');
    expect(svg).toContain('Consulenza SEO');
  });
});
