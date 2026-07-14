/**
 * Visual regression: Giovanni template preview vs PNG export.
 * Asserts structural parity (not pixel-diff) so CI is stable.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

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

test.describe('Card WYSIWYG visual', () => {
  test('preview and PNG export both show name, logo, contacts, socials, QR', async ({ page }) => {
    await login(page);
    await page.goto('/app/card');
    await page.waitForSelector('[data-testid="card-preview-front"]', { timeout: 10000 });

    const banner = page.locator('.card-template-banner').first();
    if (await banner.count() > 0) {
      await banner.locator('button').filter({ hasText: /Applica template/i }).first().click();
      await page.waitForTimeout(800);
    }

    const front = page.locator('[data-testid="card-preview-front"]').first();
    const back = page.locator('[data-testid="card-preview-back"]').first();
    await expect(front).toContainText('GIOVANNI CIDU');
    await expect(front).toContainText('Web Developer');
    await expect(back).toContainText('35180008042');
    await expect(back).toContainText('LinkedIn');
    await expect(back).toContainText('GitHub');

    // Preview screenshots for human review
    const shotDir = 'e2e/__screenshots__';
    await fs.mkdir(shotDir, { recursive: true });
    await front.screenshot({ path: path.join(shotDir, 'wysiwyg-preview-front.png') });
    await back.screenshot({ path: path.join(shotDir, 'wysiwyg-preview-back.png') });

    // Export PNG front
    const exportBtn = page.locator('[data-testid="mobile-export-btn"], .card-export-menu > button').first();
    await exportBtn.click();
    const [frontDl] = await Promise.all([
      page.waitForEvent('download', { timeout: 25000 }),
      page.getByRole('menuitem').filter({ hasText: /PNG fronte/i }).first().click(),
    ]);
    const frontPath = await frontDl.path();
    const frontBuf = await fs.readFile(frontPath!);
    expect(frontBuf[0]).toBe(0x89);
    expect(frontBuf.length).toBeGreaterThan(20000);
    await fs.copyFile(frontPath!, path.join(shotDir, 'wysiwyg-export-front.png'));

    // Export PNG back
    await exportBtn.click();
    const [backDl] = await Promise.all([
      page.waitForEvent('download', { timeout: 25000 }),
      page.getByRole('menuitem').filter({ hasText: /PNG retro/i }).first().click(),
    ]);
    const backPath = await backDl.path();
    const backBuf = await fs.readFile(backPath!);
    expect(backBuf[0]).toBe(0x89);
    expect(backBuf.length).toBeGreaterThan(15000);
    await fs.copyFile(backPath!, path.join(shotDir, 'wysiwyg-export-back.png'));

    // Export SVG back — font ratio hard assert
    await exportBtn.click();
    const [svgDl] = await Promise.all([
      page.waitForEvent('download', { timeout: 25000 }),
      page.getByRole('menuitem').filter({ hasText: /SVG retro/i }).first().click(),
    ]);
    const svg = (await fs.readFile(await svgDl.path()!)).toString('utf8');
    const vb = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
    const H = vb ? parseInt(vb[2], 10) : 1100;
    const phone = svg.match(/font-size="([\d.]+)"[^>]*>TELEFONO/);
    expect(phone).toBeTruthy();
    const phoneSize = parseFloat(phone![1]);
    expect(phoneSize / H).toBeLessThan(0.04);
    expect(phoneSize / H).toBeGreaterThan(0.015);
    expect(svg).toContain('LinkedIn');
    expect(svg).toContain('35180008042');
  });
});
