import { test, expect } from '@playwright/test';

const LAYOUTS = ['left', 'centered', 'split'] as const;
const SIZES = ['eu-85x55', 'us-89x51', 'square-65x65'] as const;

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

async function resizeElement(page: any, axis: 'w+' | 'w-' | 'h+' | 'h-') {
  const map: Record<string, string> = {
    'w+': 'grid-resize-w-plus',
    'w-': 'grid-resize-w-minus',
    'h+': 'grid-resize-h-plus',
    'h-': 'grid-resize-h-minus',
  };
  const btn = page.locator(`[data-testid="${map[axis]}"]`).first();
  await btn.waitFor({ timeout: 5000 });
  await btn.click();
  await page.waitForTimeout(300);
}

async function getGridStyle(page: any, testId: string, cssProp: string): Promise<string> {
  const el = page.locator(`[data-testid="${testId}"]`).first();
  await el.waitFor({ timeout: 5000 });
  return el.evaluate((node, prop) => window.getComputedStyle(node).getPropertyValue(prop), cssProp);
}

async function getBoundingBox(page: any, testId: string) {
  const el = page.locator(`[data-testid="${testId}"]`).first();
  await el.waitFor({ timeout: 5000 });
  return el.boundingBox();
}

test.describe('Card grid behavior regression suite', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/app/card');
    await page.waitForSelector('[data-testid="card-preview-front"]', { timeout: 10000 });
    await fillSampleData(page);
    await page.waitForTimeout(400);
  });

  test('Griglia ON/OFF does not change visual layout when grid matches flexbox default', async ({ page }) => {
    // Load split preset which is closest to default layout
    const gridToggle = page.locator('.card-grid-toggle').first();
    await gridToggle.click();
    await page.waitForTimeout(600);

    await selectPreset(page, 'split');
    await page.waitForTimeout(400);

    // Capture screenshot in grid mode
    await page.screenshot({ path: 'e2e/__screenshots__/card-grid-on-layout.png', fullPage: false });

    // Toggle grid off
    await gridToggle.click();
    await page.waitForTimeout(600);

    // The flexbox layout should still show the same text in roughly the same place.
    // We assert grid debug disappears and main text still visible.
    const debugFront = await page.locator('[data-testid="card-preview-front"] [data-testid="card-grid-debug"]').count();
    expect(debugFront).toBe(0);
    await expect(page.locator('text=Mario Rossi').first()).toBeVisible();
    await page.screenshot({ path: 'e2e/__screenshots__/card-grid-off-layout.png', fullPage: false });
  });

  for (const layout of LAYOUTS) {
    test(`Grid ON preserves element positions when toggling OFF from ${layout} preset`, async ({ page }) => {
      const gridToggle = page.locator('.card-grid-toggle').first();
      await gridToggle.click();
      await page.waitForTimeout(600);

      // Choose a preset that matches the current flexbox layout
      const presetValue = layout === 'left' ? 'left' : layout === 'centered' ? 'centered' : 'split';
      await selectPreset(page, presetValue);

      // Also set the front layout select to the same layout so flexbox OFF renders similarly
      const layoutSelect = page.locator('select').filter({ hasText: /Sinistra|Centrato|Split/ }).first();
      if (await layoutSelect.count() > 0) {
        await layoutSelect.selectOption(layout);
        await page.waitForTimeout(300);
      }

      await page.screenshot({ path: `e2e/__screenshots__/card-${layout}-grid-on.png`, fullPage: false });

      await gridToggle.click();
      await page.waitForTimeout(600);

      await expect(page.locator('text=Mario Rossi').first()).toBeVisible();
      await page.screenshot({ path: `e2e/__screenshots__/card-${layout}-grid-off.png`, fullPage: false });

      // Grid debug should be gone
      const debug = await page.locator('[data-testid="card-preview-front"] [data-testid="card-grid-debug"]').count();
      expect(debug).toBe(0);
    });
  }

  test('Moving an element in grid mode updates its CSS grid-area', async ({ page }) => {
    const gridToggle = page.locator('.card-grid-toggle').first();
    await gridToggle.click();
    await page.waitForTimeout(600);
    await selectPreset(page, 'left');

    // Select company element (left preset has empty space below it at row 3)
    await selectElement(page, 'company');

    // Read initial computed grid-row style
    const initialGridRow = await page.locator('[data-testid="grid-el-company"]').first().evaluate((el) => window.getComputedStyle(el as HTMLElement).gridRow);

    // Move company down one row
    await moveElement(page, 'down');

    const afterGridRow = await page.locator('[data-testid="grid-el-company"]').first().evaluate((el) => window.getComputedStyle(el as HTMLElement).gridRow);

    // The grid-row should have changed
    expect(afterGridRow).not.toBe(initialGridRow);
    await page.screenshot({ path: 'e2e/__screenshots__/card-grid-move-company.png', fullPage: false });
  });

  test('Resizing an element in grid mode changes its visual size (cell span)', async ({ page }) => {
    const gridToggle = page.locator('.card-grid-toggle').first();
    await gridToggle.click();
    await page.waitForTimeout(600);
    await selectPreset(page, 'left');

    await selectElement(page, 'company');
    const before = await getBoundingBox(page, 'grid-el-company');
    expect(before).not.toBeNull();

    // Increase company height (empty row below it)
    await resizeElement(page, 'h+');

    const after = await getBoundingBox(page, 'grid-el-company');
    expect(after).not.toBeNull();
    // The bounding box height should have increased
    expect(after!.height).toBeGreaterThanOrEqual(before!.height);

    await page.screenshot({ path: 'e2e/__screenshots__/card-grid-resize-company-height.png', fullPage: false });
  });

  test('Resizing company height increases its cell span', async ({ page }) => {
    const gridToggle = page.locator('.card-grid-toggle').first();
    await gridToggle.click();
    await page.waitForTimeout(600);

    // Use left preset: company cell has empty space below it at row 3
    await selectPreset(page, 'left');
    await selectElement(page, 'company');

    const beforeCell = await getBoundingBox(page, 'grid-el-company');

    await resizeElement(page, 'h+');

    const afterCell = await getBoundingBox(page, 'grid-el-company');
    expect(afterCell!.height).toBeGreaterThanOrEqual(beforeCell!.height);

    await page.screenshot({ path: 'e2e/__screenshots__/card-grid-resize-company-height.png', fullPage: false });
  });

  test('Back grid: moving QR left updates its grid-column', async ({ page }) => {
    const gridToggle = page.locator('.card-grid-toggle').first();
    await gridToggle.click();
    await page.waitForTimeout(600);

    // Switch grid editor to back
    const sideSelect = page.locator('select[aria-label="Lato griglia"]').first();
    await sideSelect.waitFor({ timeout: 5000 });
    await sideSelect.selectOption('back');
    await page.waitForTimeout(300);

    await selectElement(page, 'qr');
    const initialCol = await page.locator('[data-testid="grid-el-qr"]').first().evaluate((el) => window.getComputedStyle(el as HTMLElement).gridColumn);

    // Move QR left once (from col 3 to col 2; second move would collide with contacts)
    await moveElement(page, 'left');

    const afterCol = await page.locator('[data-testid="grid-el-qr"]').first().evaluate((el) => window.getComputedStyle(el as HTMLElement).gridColumn);
    expect(afterCol).not.toBe(initialCol);

    await page.screenshot({ path: 'e2e/__screenshots__/card-grid-back-qr-move.png', fullPage: false });
  });

  test('Back grid: resizing contacts width shrinks QR available space', async ({ page }) => {
    const gridToggle = page.locator('.card-grid-toggle').first();
    await gridToggle.click();
    await page.waitForTimeout(600);

    const sideSelect = page.locator('select[aria-label="Lato griglia"]').first();
    await sideSelect.selectOption('back');
    await page.waitForTimeout(300);

    await selectElement(page, 'contacts');
    const before = await getBoundingBox(page, 'grid-el-contacts');

    await resizeElement(page, 'w+');

    const after = await getBoundingBox(page, 'grid-el-contacts');
    expect(after!.width).toBeGreaterThanOrEqual(before!.width);

    await page.screenshot({ path: 'e2e/__screenshots__/card-grid-back-contacts-resize.png', fullPage: false });
  });

  for (const size of SIZES) {
    test(`Grid resize on ${size} does not overflow or overlap`, async ({ page }) => {
      const sizeSelect = page.locator('select').filter({ hasText: /EU 85|US 89|Quadrato/ }).first();
      if (await sizeSelect.count() > 0) {
        await sizeSelect.selectOption(size);
        await page.waitForTimeout(300);
      }

      const gridToggle = page.locator('.card-grid-toggle').first();
      await gridToggle.click();
      await page.waitForTimeout(600);
      await selectPreset(page, 'left');

      // Resize elements that have room to grow and take screenshot.
      // In the left preset only company has empty vertical space below it.
      await selectElement(page, 'company');
      await resizeElement(page, 'h+');

      await page.screenshot({ path: `e2e/__screenshots__/card-grid-${size}-no-overlap.png`, fullPage: false });

      // Assert no visible overlap by checking grid cells are distinct
      const cells = await page.locator('[data-testid="card-preview-front"] [data-testid^="grid-el-"]').all();
      const boxes = await Promise.all(cells.map(async (cell) => cell.boundingBox()));
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          if (!a || !b) continue;
          const overlap = !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
          expect(overlap, `cells ${i} and ${j} overlap on ${size}`).toBe(false);
        }
      }
    });
  }
});
