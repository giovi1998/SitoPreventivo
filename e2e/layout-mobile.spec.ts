import { test, expect, type Page } from '@playwright/test';

const TEST_USER = {
  email: 'mobile-layout-test@example.com',
  password: 'Password123!',
  username: 'MobileLayoutTest',
  role: 'user',
};

async function seedAuth(page: Page): Promise<void> {
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
        displayName: u.username,
        companyName: 'Test',
        profession: 'Test',
        defaultColor: '#2563EB',
        defaultVat: 22,
        documentTheme: 'modern',
        preferredDocumentType: 'quote',
        tier: 'unlocked',
      }),
    );
  }, TEST_USER);
}

test.describe('Layout mobile sidebar drawer', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');
    await seedAuth(page);
    await page.goto('/app/editor');
    await page.waitForSelector('.mobile-topbar', { timeout: 10000 });
  });

  test('mobile topbar is visible and sidebar is hidden', async ({ page }) => {
    await expect(page.locator('.mobile-topbar')).toBeVisible();
    await expect(page.locator('.sidebar')).toBeHidden();
  });

  test('hamburger opens drawer with same nav items', async ({ page }) => {
    await page.getByRole('button', { name: /Apri menu/i }).click();
    const drawer = page.locator('.mobile-drawer');
    await expect(drawer).toBeVisible();
    await expect(page.getByRole('button', { name: /Bigliettini/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Documenti/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Impostazioni/i })).toBeVisible();
  });

  test('navigating from drawer closes it', async ({ page }) => {
    await page.getByRole('button', { name: /Apri menu/i }).click();
    await page.getByRole('button', { name: /Bigliettini/i }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('.mobile-drawer')).toBeHidden();
    await expect(page).toHaveURL(/\/app\/card/);
  });

  test('mobile theme toggle switches theme', async ({ page }) => {
    const html = page.locator('html');
    const initial = await html.getAttribute('data-theme') || 'light';
    await page.getByRole('button', { name: /Cambia tema/i }).click();
    const next = await html.getAttribute('data-theme');
    expect(next).not.toBe(initial);
  });

  test('mobile logout button redirects to login', async ({ page }) => {
    await page.getByRole('button', { name: /Esci/i }).click();
    await page.waitForURL(/\/login/);
    await expect(page.getByRole('heading', { name: /Bentornato/i })).toBeVisible();
  });
});