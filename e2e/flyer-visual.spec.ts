import { test, expect } from '@playwright/test';

const FLYER_SECTORS = ['ristorante', 'evento', 'salone', 'negozio'] as const;
const FLYER_LAYOUTS = ['classic', 'centered', 'split', 'magazine'] as const;
const SECTOR_LABELS: Record<typeof FLYER_SECTORS[number], string> = {
  ristorante: 'Ristorante',
  evento: 'Evento',
  salone: 'Salone',
  negozio: 'Negozio',
};
const LAYOUT_LABELS: Record<typeof FLYER_LAYOUTS[number], string> = {
  classic: 'Classico',
  centered: 'Centrato',
  split: 'Diviso',
  magazine: 'Magazine',
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

test.describe('Flyer editor visual regression', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/app/flyer');
    await page.waitForSelector('[data-testid="flyer-preview"]', { timeout: 10000 });
  });

  test('default template renders without overflow warnings', async ({ page }) => {
    await page.waitForTimeout(500);
    const warnings = await page.locator('.flyer-preview-warnings .flyer-warning-error, .flyer-preview-warnings .flyer-warning-warning').count();
    expect(warnings).toBe(0);
    await page.screenshot({ path: 'e2e/__screenshots__/flyer-default.png', fullPage: false });
  });

  for (const sector of FLYER_SECTORS) {
    for (const layout of FLYER_LAYOUTS) {
      test(`${sector} ${layout} template renders without overflow`, async ({ page }) => {
        // Click sector button in the template banner
        const sectorButton = page.locator('.flyer-template-banner__row button', { hasText: SECTOR_LABELS[sector] });
        if (await sectorButton.count() > 0) {
          await sectorButton.first().click();
          await page.waitForTimeout(200);
        }
        // Click layout button in the manual panel layout section
        const layoutButton = page.locator('.flyer-layout-buttons button', { hasText: LAYOUT_LABELS[layout] });
        if (await layoutButton.count() > 0) {
          await layoutButton.first().click();
          await page.waitForTimeout(200);
        }
        const warningTexts = await page.locator('.flyer-preview-warnings .flyer-warning-error, .flyer-preview-warnings .flyer-warning-warning').allTextContents();
        expect(warningTexts, `${sector} ${layout} has overflow warnings: ${warningTexts.join('; ')}`).toEqual([]);
        await page.screenshot({ path: `e2e/__screenshots__/flyer-${sector}-${layout}.png`, fullPage: false });
      });
    }
  }
});
