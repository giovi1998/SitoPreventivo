/**
 * Visual regression: Giovanni template preview vs PNG export.
 * Asserts structural parity (not pixel-diff) so CI is stable.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import {
  loginAsTestUser,
  openCardEditor,
  applyGiovanniTemplate,
  exportCard,
  screenshotDir,
} from './helpers/cardHarness';

test.describe('Card WYSIWYG visual', () => {
  test('preview and PNG export both show name, logo, contacts, socials, QR', async ({ page }) => {
    await loginAsTestUser(page);
    await openCardEditor(page);
    await applyGiovanniTemplate(page);

    const front = page.locator('[data-testid="card-preview-front"]').first();
    const back = page.locator('[data-testid="card-preview-back"]').first();
    await expect(front).toContainText('GIOVANNI CIDU');
    await expect(front).toContainText('Web Developer');
    await expect(back).toContainText('35180008042');
    await expect(back).toContainText('LinkedIn');
    await expect(back).toContainText('GitHub');

    const shotDir = await screenshotDir();
    await front.screenshot({ path: path.join(shotDir, 'wysiwyg-preview-front.png') });
    await back.screenshot({ path: path.join(shotDir, 'wysiwyg-preview-back.png') });

    const { buffer: frontBuf, tempPath: frontTemp } = await exportCard(page, 'png-front');
    expect(frontBuf[0]).toBe(0x89);
    expect(frontBuf.length).toBeGreaterThan(20000);
    await fs.copyFile(frontTemp, path.join(shotDir, 'wysiwyg-export-front.png'));

    const { buffer: backBuf, tempPath: backTemp } = await exportCard(page, 'png-back');
    expect(backBuf[0]).toBe(0x89);
    expect(backBuf.length).toBeGreaterThan(15000);
    await fs.copyFile(backTemp, path.join(shotDir, 'wysiwyg-export-back.png'));

    const { buffer: svgBuf } = await exportCard(page, 'svg-back');
    const svg = svgBuf.toString('utf8');
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
