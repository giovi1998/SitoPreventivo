import { test, expect } from '@playwright/test';
import { testUser } from './fixtures';

test.describe('Home page — CTA functional', () => {
  // TB-027: con VITE_REGISTRATION_ENABLED=false (default dev) le CTA anon
  // puntano a /login, non a /login?register=1.
  test('anon user: hero CTA goes to login', async ({ page }) => {
    await page.goto('/');
    const cta = page.locator('.hp-cta').first();
    await expect(cta).toHaveAttribute('href', /\/login(\?register=1)?$/);
  });

  test('anon user: header shows Accedi + Registrati', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hp-btn-ghost')).toHaveAttribute('href', '/login');
    await expect(page.locator('.hp-btn-primary')).toHaveAttribute('href', /\/login(\?register=1)?$/);
  });

  test('logged user: hero CTA goes to /app', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate((u) => {
      localStorage.setItem('authToken', 'test-token');
      localStorage.setItem('userEmail', u.email);
      localStorage.setItem('userRole', u.role);
      localStorage.setItem('registeredUsers', JSON.stringify([u]));
    }, testUser);
    await page.goto('/');
    const cta = page.locator('.hp-cta').first();
    await expect(cta).toHaveAttribute('href', '/app');
  });

  test('pricing anchor scrolls', async ({ page }) => {
    await page.goto('/');
    await page.locator('a[href="#pricing"]').first().click();
    await expect(page.locator('#pricing')).toBeInViewport({ timeout: 3000 });
  });

  test('bento tools section renders 6 items', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hp-create-item')).toHaveCount(6);
  });

  test('card flip demo toggles', async ({ page }) => {
    await page.goto('/');
    const flip = page.locator('.hp-flip');
    await expect(page.locator('.hp-tier-tag[data-tier="free"]')).toBeVisible();
    await flip.click();
    await expect(flip).toHaveClass(/is-flipped/);
    await expect(page.locator('.hp-tier-tag[data-tier="unlocked"]')).toBeVisible();
  });

  test('final CTA link', async ({ page }) => {
    await page.goto('/');
    const finalCta = page.locator('.hp-final-cta .hp-cta');
    await expect(finalCta).toHaveAttribute('href', /login\?register=1|\/app/);
  });

  test('pricing CTAs are mailto or links', async ({ page }) => {
    await page.goto('/');
    const proCta = page.locator('.hp-price-card.hp-price-featured .hp-price-cta');
    await expect(proCta).toHaveAttribute('href', /^mailto:/);
  });
});
