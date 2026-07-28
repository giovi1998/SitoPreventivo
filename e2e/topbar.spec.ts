import { test, expect, type Page } from '@playwright/test';

const TEST_USER = {
  email: 'topbar-test@example.com',
  password: 'Password123!',
  username: 'TopbarTest',
  role: 'user',
};

async function seedAuth(page: Page, admin: boolean = false): Promise<void> {
  const role = admin ? 'admin' : TEST_USER.role;
  const user = { ...TEST_USER, role, email: admin ? 'admin@gmail.com' : TEST_USER.email };
  await page.evaluate((u) => {
    localStorage.setItem('authToken', 'test-token');
    localStorage.setItem('userEmail', u.email);
    localStorage.setItem('username', u.username);
    localStorage.setItem('userRole', u.role);
    if (u.role === 'admin') {
      localStorage.setItem(
        'registeredUsers',
        JSON.stringify([{
          email: u.email,
          password: u.password,
          username: u.username,
          role: 'admin',
        }]),
      );
    } else {
      localStorage.setItem(
        'registeredUsers',
        JSON.stringify([{
          email: u.email,
          password: u.password,
          username: u.username,
          role: u.role,
        }]),
      );
    }
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
  }, user);
}

test.describe('Topbar actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/login');
    await seedAuth(page, true);
    await page.goto('/app/editor');
    await page.waitForSelector('.workspace > .topbar', { timeout: 10000 });
  });

  test('save status shows saved after clicking save', async ({ page }) => {
    await page.locator('.topbar .top-btn-save').click();
    await expect(page.locator('.save-dialog-overlay')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.save-dialog')).toContainText('Salva preventivo');
    await page.locator('.save-dialog .btn-primary').click();
    await expect(page.locator('.save-status-saved')).toBeVisible({ timeout: 5000 });
  });

  test('document theme pills switch theme', async ({ page }) => {
    const corp = page.locator('.topbar .theme-pills button[title="Tema corporate"]');
    const cre = page.locator('.topbar .theme-pills button[title="Tema creative"]');
    await expect(corp).toBeVisible();
    await cre.click();
    await expect(cre).toHaveAttribute('aria-selected', 'true');
    await corp.click();
    await expect(corp).toHaveAttribute('aria-selected', 'true');
  });

  test('theme toggle switches dark/light', async ({ page }) => {
    const html = page.locator('html');
    const initial = await html.getAttribute('data-theme') || 'light';
    const toggle = page.locator('.topbar .theme-toggle');
    await expect(toggle).toBeVisible();
    await toggle.click();
    const next = await html.getAttribute('data-theme');
    expect(next).not.toBe(initial);
  });

  test('PDF export button is present and clickable', async ({ page }) => {
    const btn = page.locator('.topbar .top-btn-export[aria-label="Esporta PDF"]');
    await expect(btn).toBeVisible();
    await btn.click();
    // Export is async; just ensure it does not throw and button handles loading state.
    await page.waitForTimeout(500);
    await expect(btn).toBeVisible();
  });

  test('DOCX export button is present and clickable', async ({ page }) => {
    const btn = page.locator('.topbar [aria-label="Esporta DOCX"]');
    await expect(btn).toBeVisible();
    await btn.click();
    await page.waitForTimeout(500);
    await expect(btn).toBeVisible();
  });

  test('import PDF button opens import modal', async ({ page }) => {
    const btn = page.locator('.topbar [aria-label="Importa PDF"]');
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.locator('.pdf-import-modal h2')).toContainText(/Importa Preventivo da PDF/i);
  });

  test('save as template button is present and clickable', async ({ page }) => {
    const btn = page.locator('.topbar [aria-label="Template"]');
    await expect(btn).toBeVisible();
    await btn.click();
    await page.waitForTimeout(500);
    await expect(btn).toBeVisible();
  });
});