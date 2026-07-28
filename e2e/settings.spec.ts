import { test, expect, type Page } from '@playwright/test';

const TEST_USER = {
  email: 'settings-test@example.com',
  password: 'Password123!',
  username: 'SettingsTest',
  role: 'user',
};

async function seedAuth(page: Page, tier: 'free' | 'unlocked' = 'free'): Promise<void> {
  await page.evaluate(({ u, tier: t }) => {
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
        preferredDocumentType: 'logo',
        tier: t,
        documentCount: 0,
        documentLimit: t === 'free' ? 3 : null,
      }),
    );
    localStorage.setItem('unlock_codes', JSON.stringify([]));
  }, { u: TEST_USER, tier });
}

async function seedCode(page: Page, code: string): Promise<void> {
  await page.evaluate(({ code: c, email }) => {
    const key = `userSettings_${email}`;
    const settings = JSON.parse(localStorage.getItem(key) || '{}');
    settings.tier = 'free';
    settings.documentLimit = 3;
    localStorage.setItem(key, JSON.stringify(settings));
    const codes = JSON.parse(localStorage.getItem('unlock_codes') || '[]');
    codes.push({
      code: c,
      package: 'single',
      usedBy: null,
      usedAt: null,
      createdBy: 'admin-test@example.com',
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem('unlock_codes', JSON.stringify(codes));
  }, { code, email: TEST_USER.email });
}

test.describe('Settings page', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/login');
    await seedAuth(page, 'free');
    await page.goto('/app/settings');
    await page.waitForSelector('.settings-page', { timeout: 10000 });
  });

  test('renders security tab by default with password form', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 2, name: /Impostazioni/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Sicurezza/i })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#old-password')).toBeVisible();
    await expect(page.locator('#new-password')).toBeVisible();
    await expect(page.getByRole('button', { name: /Cambia password/i })).toBeVisible();
  });

  test('switches to account tab and shows tier info', async ({ page }) => {
    await page.getByRole('tab', { name: /Account/i }).click();
    await expect(page.getByTestId('settings-tier-card')).toBeVisible();
    await expect(page.getByTestId('settings-tier-value')).toHaveText(/Free|Sbloccato/);
    await expect(page.getByTestId('settings-doc-count')).toBeVisible();
  });

  test('redeem invalid code shows error message', async ({ page }) => {
    await page.getByRole('tab', { name: /Account/i }).click();
    await expect(page.getByTestId('settings-redeem-form')).toBeVisible();
    await page.getByTestId('settings-redeem-input').fill('QB-INVALID-CODE');
    await page.getByTestId('settings-redeem-submit').click();
    await expect(page.getByTestId('settings-redeem-message')).toBeVisible({ timeout: 5000 });
    const text = await page.getByTestId('settings-redeem-message').textContent();
    expect(text).toMatch(/non valido|errore|Codice non trovato/i);
  });

  test('redeem valid code unlocks account', async ({ page }) => {
    await page.goto('/login');
    await seedAuth(page, 'free');
    await page.goto('/app/settings');
    await page.waitForSelector('.settings-page', { timeout: 10000 });

    await page.getByRole('tab', { name: /Account/i }).click();
    await expect(page.getByTestId('settings-redeem-form')).toBeVisible();
    await page.getByTestId('settings-redeem-input').fill('TEST-UNLOCK');
    await page.getByTestId('settings-redeem-submit').click();

    await expect(page.getByTestId('settings-tier-value')).toHaveText('Sbloccato', { timeout: 5000 });
  });

  test('password mismatch shows inline error', async ({ page }) => {
    await page.locator('#old-password').fill(TEST_USER.password);
    await page.locator('#new-password').fill('NewPass123!');
    await page.locator('#confirm-password').fill('Different123!');
    // Submit via Enter because the submit button is disabled until all rules pass.
    await page.locator('#confirm-password').press('Enter');
    await expect(page.getByText(/non coincidono/i)).toBeVisible();
  });

  test('weak new password shows validation error', async ({ page }) => {
    await page.locator('#old-password').fill(TEST_USER.password);
    await page.locator('#new-password').fill('short');
    await page.locator('#confirm-password').fill('short');
    await page.locator('#confirm-password').press('Enter');
    await expect(page.getByText(/requisiti di sicurezza/i)).toBeVisible();
  });
});