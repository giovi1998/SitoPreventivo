import { test, expect, type Page } from '@playwright/test';
import { adminUser } from './fixtures';

const ADMIN_USER = adminUser;

async function seedAdmin(page: Page): Promise<void> {
  await page.evaluate((u) => {
    localStorage.setItem('authToken', 'admin-token');
    localStorage.setItem('userEmail', u.email);
    localStorage.setItem('username', u.username);
    localStorage.setItem('userRole', u.role);
    localStorage.setItem(
      'registeredUsers',
      JSON.stringify([
        {
          email: u.email,
          password: u.password,
          username: u.username,
          role: u.role,
          tokensUsed: 0,
          tokenLimit: 1000000,
          createdAt: new Date().toISOString(),
        },
        {
          email: 'user1@example.com',
          password: 'Password123!',
          username: 'User1',
          role: 'user',
          tokensUsed: 1234,
          tokenLimit: 1000000,
          createdAt: new Date().toISOString(),
        },
      ]),
    );
    localStorage.setItem(
      `userSettings_${u.email}`,
      JSON.stringify({
        userEmail: u.email,
        onboardingDone: true,
        displayName: 'Admin',
        companyName: 'Admin',
        profession: 'Admin',
        defaultColor: '#2563EB',
        defaultVat: 22,
        documentTheme: 'modern',
        preferredDocumentType: 'logo',
        tier: 'unlocked',
      }),
    );
    localStorage.setItem('unlock_codes', JSON.stringify([]));
    localStorage.setItem('precisionQuote_quotes', JSON.stringify([]));
  }, ADMIN_USER);
}

test.describe('Admin dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/login');
    await seedAdmin(page);
    await page.goto('/app/admin');
    await page.waitForSelector('[data-testid="admin-tabs"]', { timeout: 10000 });
  });

  test('renders overview tab with users and quotes tables', async ({ page }) => {
    await expect(page.getByTestId('admin-tab-overview')).toHaveClass(/active/);
    await expect(page.locator('.admin-table').first()).toBeVisible();
    await expect(page.locator('.admin-table td').getByText('admin@gmail.com').first()).toBeVisible();
    await expect(page.locator('.admin-table td').getByText('user1@example.com').first()).toBeVisible();
  });

  test('switches to codes tab and generates an unlock code', async ({ page }) => {
    await page.getByTestId('admin-tab-codes').click();
    await expect(page.getByTestId('admin-codes-panel')).toBeVisible();
    await expect(page.getByTestId('admin-code-form')).toBeVisible();

    await page.getByTestId('admin-code-generate').click();

    await expect(page.getByTestId('admin-code-result')).toBeVisible({ timeout: 5000 });
    const code = await page.getByTestId('admin-code-result').locator('code').textContent();
    expect(code).toMatch(/^(PQ|QB)-[A-Z0-9-]+$/i);

    await expect(page.getByTestId('admin-code-row').first()).toBeVisible();
  });

  test('copies generated code to clipboard', async ({ page }) => {
    await page.getByTestId('admin-tab-codes').click();
    await page.getByTestId('admin-code-generate').click();
    await page.getByTestId('admin-code-result').waitFor({ state: 'visible', timeout: 5000 });

    const copyBtn = page.getByTestId('admin-code-copy');
    await expect(copyBtn).toBeVisible();

    await page.evaluate(() => {
      // Override writeText so the permission-less readText test can retrieve it.
      let last = '';
      Object.defineProperty(navigator.clipboard, 'writeText', {
        value: async (text: string) => { last = text; (window as any).__lastClipboard = last; },
        writable: true,
      });
    });
    await copyBtn.click();

    const clipboardText = await page.evaluate(() => (window as any).__lastClipboard || '');
    expect(clipboardText).toMatch(/^(PQ|QB)-[A-Z0-9-]+$/i);
  });

  test('user limit update button is present in overview table', async ({ page }) => {
    await expect(page.locator('.admin-table').first()).toBeVisible();
    const updateBtns = page.locator('button', { hasText: /Aggiorna limite|Sblocca/i });
    await expect(updateBtns.first()).toBeVisible();
  });
});