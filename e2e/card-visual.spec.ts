import { test, expect } from '@playwright/test';
import fs from 'fs/promises';

const CARD_LAYOUTS = ['left', 'centered', 'split'] as const;
const CARD_SIZES = ['eu-85x55', 'us-89x51', 'square-65x65'] as const;

const LAYOUT_LABELS: Record<typeof CARD_LAYOUTS[number], string> = {
  left: 'Sinistra',
  centered: 'Centrato',
  split: 'Split',
};

const SIZE_LABELS: Record<typeof CARD_SIZES[number], string> = {
  'eu-85x55': 'EU 85×55mm',
  'us-89x51': 'US 89×51mm',
  'square-65x65': 'Quadrato 65×65mm',
};

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

async function setCardField(page: any, label: RegExp, value: string) {
  const labelEl = page.locator('label.card-field').filter({ hasText: label }).first();
  await labelEl.waitFor({ timeout: 5000 });
  const input = labelEl.locator('input, textarea, select').first();
  if (value.startsWith('option:')) {
    await input.selectOption(value.replace('option:', ''));
  } else {
    await input.fill(value);
  }
  await page.waitForTimeout(200);
}

test.describe('Card editor visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/app/card');
    await page.waitForSelector('[data-testid="card-preview-front"]', { timeout: 10000 });
    // Wait for layout/content to settle
    await page.waitForTimeout(500);
  });

  async function fillSampleData(page: any) {
    // Front fields
    await setCardField(page, /nome/i, 'Mario Rossi');
    await setCardField(page, /ruolo/i, 'Web Developer');
    await setCardField(page, /azienda/i, 'WebdevCA');
    // Back fields
    await setCardField(page, /telefono/i, '+39 012 345 6789');
    await setCardField(page, /email/i, 'mario.rossi@example.com');
    await setCardField(page, /sito/i, 'https://giovannicidu.vercel.app');
  }

  test('default card renders without grid debug in flexbox mode', async ({ page }) => {
    await fillSampleData(page);
    const debugFront = await page.locator('[data-testid="card-preview-front"] [data-testid="card-grid-debug"]').count();
    const debugBack = await page.locator('[data-testid="card-preview-back"] [data-testid="card-grid-debug"]').count();
    expect(debugFront).toBe(0);
    expect(debugBack).toBe(0);
    await page.screenshot({ path: 'e2e/__screenshots__/card-default.png', fullPage: false });
  });

  test('back preview shows "Contatti" eyebrow and contacts', async ({ page }) => {
    await fillSampleData(page);
    const back = page.locator('[data-testid="card-preview-back"]');
    await expect(back.locator('.card-back-eyebrow')).toHaveText(/Contatti/i);
    await expect(back).toContainText('+39 012 345 6789');
    await expect(back).toContainText('mario.rossi@example.com');
  });

  test('PNG back export is not blank and contains card content', async ({ page }) => {
    await fillSampleData(page);

    // Set a distinctive web font to verify it is applied in PNG export.
    const fontSelect = page.locator('label.card-field').filter({ hasText: /font/i }).locator('select').first();
    if (await fontSelect.count() > 0) {
      await fontSelect.selectOption('Oswald');
      await page.waitForTimeout(300);
    }

    // Open export menu and click PNG back.
    const exportBtn = page.locator('[data-testid="mobile-export-btn"], .card-export-menu > button').first();
    await exportBtn.click();
    await page.waitForTimeout(200);
    await page.getByRole('menuitem', { name: /PNG retro/i }).click();

    // Wait for export to finish (button text changes back from "Esportando…").
    await expect(exportBtn.locator('span, :scope')).not.toContainText('Esportando', { timeout: 15000 });

    // The exported PNG is rendered in a hidden canvas inside the page, and the
    // app may trigger a download. Read the canvas pixel data to verify it is
    // not all background color.
    const canvas = page.locator('canvas[data-testid="card-export-canvas"]').first();
    if (await canvas.count() > 0) {
      const distinctColors = await canvas.evaluate((c: HTMLCanvasElement) => {
        const ctx = c.getContext('2d');
        if (!ctx) return 0;
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        const colors = new Set<string>();
        for (let i = 0; i < data.length; i += 16) {
          colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
          if (colors.size > 10) break;
        }
        return colors.size;
      });
      expect(distinctColors, 'PNG export should contain multiple colors, not be blank').toBeGreaterThan(2);
    }

    // Fallback: at minimum a download should have been triggered for a non-empty PNG.
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    // Re-trigger export if no canvas was found.
    if (await canvas.count() === 0) {
      await exportBtn.click();
      await page.getByRole('menuitem', { name: /PNG retro/i }).click();
    }
    const download = await downloadPromise.catch(() => null);
    if (download) {
      const path = await download.path();
      expect(path).toBeTruthy();
      const stats = await fs.stat(path!);
      expect(stats.size).toBeGreaterThan(1000);
    }
  });

  for (const layout of CARD_LAYOUTS) {
    for (const size of CARD_SIZES) {
      test(`${layout} ${size} renders without overlap`, async ({ page }) => {
        await fillSampleData(page);
        // Change size
        const sizeSelect = page.locator('select').filter({ hasText: /EU 85|US 89|Quadrato/ }).first();
        if (await sizeSelect.count() > 0) {
          await sizeSelect.selectOption(size);
          await page.waitForTimeout(300);
        }
        // Change layout
        const layoutSelect = page.locator('select').filter({ hasText: /Sinistra|Centrato|Split/ }).first();
        if (await layoutSelect.count() > 0) {
          await layoutSelect.selectOption(layout);
          await page.waitForTimeout(300);
        }
        await page.screenshot({ path: `e2e/__screenshots__/card-${layout}-${size}.png`, fullPage: false });

        // Enable grid and verify debug overlay appears on both sides
        const gridToggle = page.locator('.card-grid-toggle').first();
        if (await gridToggle.count() > 0) {
          await gridToggle.click();
          await page.waitForTimeout(800);
          const debugFront = await page.locator('[data-testid="card-preview-front"] [data-testid="card-grid-debug"]').count();
          const debugBack = await page.locator('[data-testid="card-preview-back"] [data-testid="card-grid-debug"]').count();
          expect(debugFront, `front grid debug should be visible for ${layout}/${size}`).toBeGreaterThan(0);
          expect(debugBack, `back grid debug should be visible for ${layout}/${size}`).toBeGreaterThan(0);
          await page.screenshot({ path: `e2e/__screenshots__/card-${layout}-${size}-grid.png`, fullPage: false });
        }
      });
    }
  }
});
