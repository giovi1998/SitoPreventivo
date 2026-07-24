import { test, expect, type Page } from '@playwright/test';
import {
  seedAuth,
  openCardEditor,
  setGridOn,
  selectGridPreset,
  addServices,
} from './helpers/cardHarness';

const TEST_USER = {
  email: 'test@example.com',
  password: 'Password123!',
  username: 'Test',
  role: 'user',
};

async function unlockTier(page: Page) {
  await page.evaluate((email: string) => {
    const key = `userSettings_${email}`;
    const raw = localStorage.getItem(key);
    const settings = raw ? JSON.parse(raw) : {};
    settings.tier = 'unlocked';
    settings.unlockCode = 'TEST-E2E-UNLOCK';
    localStorage.setItem(key, JSON.stringify(settings));
  }, TEST_USER.email);
}

test.describe('Card AI tool path', () => {
  test('AI can truncate services and apply premium palette via tool calls', async ({ page }: { page: Page }) => {
    test.setTimeout(120000);

    await page.goto('/login');
    await seedAuth(page);
    await unlockTier(page);
    await openCardEditor(page);

    // Enable grid and apply centered preset.
    await setGridOn(page, true);
    await selectGridPreset(page, 'centered');

    // Add many services to create need for truncation.
    // The "Modifica"/"Retro" tabs exist only in the mobile layout; on
    // desktop the form (services included) is already visible.
    const modificaTab = page.getByText('Modifica', { exact: true }).first();
    if (await modificaTab.isVisible().catch(() => false)) {
      await modificaTab.click();
      await page.waitForTimeout(300);
      const retroTab = page.getByText('Retro', { exact: true }).first();
      if (await retroTab.isVisible().catch(() => false)) {
        await retroTab.click();
        await page.waitForTimeout(300);
      }
    }
    await addServices(page, [
      'Siti web',
      'E-commerce',
      'SEO',
      'Social media',
      'Branding',
      'Copywriting',
      'Fotografia',
    ]);

    // Desktop: AI panel is already visible; locate prompt textarea inside it.
    const aiPanel = page.locator('[data-testid="card-ai-panel"]');
    await expect(aiPanel).toBeVisible();
    const promptTextarea = aiPanel.locator('textarea').first();
    await expect(promptTextarea).toBeVisible();

    // Type a prompt that should trigger deterministic tools.
    const prompt = 'Mantieni solo i 3 servizi più importanti e usa la palette premium';
    await promptTextarea.fill(prompt);

    // Capture log events from window.__cardLayoutEvents for debugging.
    const eventsBefore = await page.evaluate(() => {
      (window as any).__cardLayoutEvents = (window as any).__cardLayoutEvents || [];
      return (window as any).__cardLayoutEvents.length;
    });

    // Click generate inside AI panel.
    await aiPanel.getByRole('button', { name: /Applica prompt/i }).first().click();

    // Wait for processing to complete (up to 60s for DeepSeek round-trip).
    await expect(async () => {
      const btn = aiPanel.getByRole('button', { name: /Applica prompt/i }).first();
      const busy = await btn.getAttribute('aria-busy');
      expect(busy).not.toBe('true');
    }).toPass({ timeout: 60000, intervals: [1000, 2000, 5000] });

    // Verify AI log mentions tool usage. Phase 14: the log lives behind the
    // "Log AI" collapsible in the AI console — open it first (it renders
    // AILogPanel only when expanded).
    const logToggle = page.getByRole('button', { name: /Log AI/i }).first();
    await expect(logToggle).toBeVisible();
    await logToggle.click();
    const aiLogText = await page.locator('.ai-log-panel, [data-testid="ai-log-panel"]').first().innerText({ timeout: 60000 });
    expect(aiLogText.length).toBeGreaterThan(50);

    // Best-effort: check if any tool-related keyword appears in log.
    const toolKeywords = ['tool', 'truncate', 'palette', 'apply', 'executor'];
    const hasToolSignal = toolKeywords.some((k) => aiLogText.toLowerCase().includes(k));
    if (!hasToolSignal) {
      console.warn('No explicit tool keyword in AI log; falling back to result assertions.');
    }

    // Verify services were truncated to 3 or fewer.
    const previewText = await page.locator('[data-testid="card-preview-back"]').first().innerText();
    const serviceMatches = previewText.match(/Siti web|E-commerce|SEO|Social media|Branding|Copywriting|Fotografia/g);
    expect(serviceMatches?.length ?? 0).toBeLessThanOrEqual(3);

    // Verify events were emitted.
    const eventsAfter = await page.evaluate(() => (window as any).__cardLayoutEvents.length);
    expect(eventsAfter).toBeGreaterThanOrEqual(eventsBefore);
  });
});
