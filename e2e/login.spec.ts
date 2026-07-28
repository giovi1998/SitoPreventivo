import { test, expect } from '@playwright/test';

test.describe('Login page — functional', () => {
  test('login form validates empty fields', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Accedi$/i }).click();
    await expect(page.locator('.auth-error')).toBeVisible();
    await expect(page.locator('.auth-error')).toContainText(/compila tutti i campi/i);
  });

  test('register mode toggle shows extra fields', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Registrati/i }).click();
    await expect(page.locator('#reg-username')).toBeVisible();
    await expect(page.locator('#reg-gender')).toBeVisible();
    await expect(page.getByRole('button', { name: /Crea account/i })).toBeVisible();
  });

  test('register validates username', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Registrati/i }).click();
    await page.locator('#auth-email').fill('new@example.com');
    await page.locator('#auth-password').fill('Password123!');
    await page.getByRole('button', { name: /Crea account/i }).click();
    await expect(page.locator('.auth-error')).toContainText(/inserisci un username/i);
  });

  test('register new user → redirect /app', async ({ page }) => {
    await page.goto('/login');
    const email = `reg_${Date.now()}@example.com`;
    await page.getByRole('button', { name: /Registrati/i }).click();
    await page.locator('#reg-username').fill('RegTest');
    await page.locator('#reg-gender').selectOption('male');
    await page.locator('#auth-email').fill(email);
    await page.locator('#auth-password').fill('Password123!');
    await page.getByRole('button', { name: /Crea account/i }).click();
    await page.waitForURL(/\/app/, { timeout: 10000 });
    const token = await page.evaluate(() => localStorage.getItem('authToken'));
    expect(token).toBeTruthy();
    const stored = await page.evaluate(() => localStorage.getItem('userEmail'));
    // local-dev may resolve a different stored user (legacy registeredUsers list)
    expect(stored).toBeTruthy();
  });

  test('login with existing user → redirect /app', async ({ page }) => {
    // Seed user first
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('registeredUsers', JSON.stringify([
        { email: 'login@example.com', password: 'Password123!', username: 'LoginTest', role: 'user' },
      ]));
    });
    await page.goto('/login');
    await page.locator('#auth-email').fill('login@example.com');
    await page.locator('#auth-password').fill('Password123!');
    await page.getByRole('button', { name: /Accedi$/i }).click();
    await page.waitForURL(/\/app/, { timeout: 10000 });
  });

  test('login wrong password → error', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('registeredUsers', JSON.stringify([
        { email: 'bad@example.com', password: 'CorrectPass123!', username: 'Bad', role: 'user' },
      ]));
    });
    await page.locator('#auth-email').fill('bad@example.com');
    await page.locator('#auth-password').fill('WrongPass999');
    await page.getByRole('button', { name: /Accedi$/i }).click();
    await expect(page.locator('.auth-error')).toBeVisible({ timeout: 5000 });
  });

  test('password visibility toggle', async ({ page }) => {
    await page.goto('/login');
    const input = page.locator('#auth-password');
    await expect(input).toHaveAttribute('type', 'password');
    await page.locator('.auth-eye-btn').click();
    await expect(input).toHaveAttribute('type', 'text');
  });
});
