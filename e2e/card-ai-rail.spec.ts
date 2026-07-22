import { test, expect } from '@playwright/test';
import {
  loginAsTestUser,
  openCardEditor,
  applyGiovanniTemplate,
  screenshotDir,
} from './helpers/cardHarness';

/**
 * TB-023 UX review: la rail AI del card editor.
 * Verifica i fix emersi dal feedback utente:
 *  1. Badge provider: il menu si apre verso il basso e non viene clippato
 *     dal pannello (overflow-y:auto).
 *  2. Decorazioni: selezionando un pattern (dal manuale o dalla rail) la
 *     preview mostra un <svg> reale (non un <g> orfano in uno <span>).
 *  3. Log AI: il toggle apre e RICHIUDE il pannello log.
 *  4. Icona AI: selettore modello immagine + sfondo + editor prompt.
 *
 * Gli screenshot in e2e/__screenshots__ vanno revisionati a occhio dopo il run.
 */

async function shot(page: import('@playwright/test').Page, name: string) {
  const dir = await screenshotDir();
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
}

test.describe('Card AI rail (TB-023 UX feedback)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 950 });
    await loginAsTestUser(page);
    await openCardEditor(page);
    await applyGiovanniTemplate(page);
  });

  test('provider badge menu opens downward and stays inside the viewport', async ({ page }) => {
    const badge = page.getByTestId('ai-provider-badge');
    await expect(badge).toBeVisible();
    await badge.click();
    const menu = page.getByTestId('ai-provider-menu');
    await expect(menu).toBeVisible();

    const badgeBox = (await badge.boundingBox())!;
    const menuBox = (await menu.boundingBox())!;
    // Il menu si apre SOTTO il badge (fix clipping) e resta nella viewport.
    expect(menuBox.y).toBeGreaterThanOrEqual(badgeBox.y + badgeBox.height - 2);
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(950);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(1600);
    // Ci sono almeno 2 provider selezionabili.
    const options = menu.locator('[role="option"]');
    expect(await options.count()).toBeGreaterThanOrEqual(2);

    await shot(page, 'tb023-provider-menu-open');

    // Cambio provider: il badge aggiorna il nome.
    await options.filter({ hasText: /Ollama/i }).first().click();
    await expect(badge).toContainText('Ollama');
    await expect(menu).toBeHidden();
    await shot(page, 'tb023-provider-ollama-selected');
  });

  test('decorations render as a real SVG in the preview (manual panel)', async ({ page }) => {
    // Dal pannello MANUALE (Stile → Decorazione). La sezione Decorazione è
    // stata rimossa dalla rail AI (TB-023): resta solo in CardStyleFields.
    const decoSelect = page.getByLabel(/Pattern decorazione/i);
    await decoSelect.selectOption('wave-bottom');
    await page.waitForTimeout(300);

    const frontPattern = page.locator('[data-testid="card-preview-front"] svg.card-decorative-pattern');
    await expect(frontPattern).toBeVisible();
    // Deve contenere il <g> del renderer DENTRO l'svg.
    await expect(frontPattern.locator('[data-decorative-pattern="wave-bottom"]')).toHaveCount(1);
    // E deve avere dimensioni reali (bug precedente: <span> con <g> = 0x0 invisibile).
    const box = (await frontPattern.boundingBox())!;
    expect(box.width).toBeGreaterThan(100);
    expect(box.height).toBeGreaterThan(50);

    // Anche il retro mostra il pattern.
    const backPattern = page.locator('[data-testid="card-preview-back"] svg.card-decorative-pattern--back');
    await expect(backPattern).toBeVisible();

    await shot(page, 'tb023-decoration-wave-manual');

    // Cambio pattern dallo stesso pannello manuale.
    await decoSelect.selectOption('blob-corner');
    await page.waitForTimeout(300);
    await expect(
      page.locator('[data-testid="card-preview-front"] svg.card-decorative-pattern [data-decorative-pattern="blob-corner"]'),
    ).toHaveCount(1);
    await shot(page, 'tb023-decoration-blob-manual');
  });

  test('log AI toggle opens AND closes the log panel', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /Log AI/i });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.getByRole('log', { name: /Log attività AI/i })).toBeVisible();
    await shot(page, 'tb023-log-open');
    // Richiudo: questo era il bug segnalato ("non riesco a chiuderlo").
    await toggle.click();
    await expect(page.getByRole('log', { name: /Log attività AI/i })).toBeHidden();
  });

  test('icon AI section has image model, background and prompt editor', async ({ page }) => {
    await page.getByRole('button', { name: /Icona AI/i }).click();
    await expect(page.getByLabel(/Modello immagine/i).first()).toBeVisible();
    await expect(page.getByLabel(/Sfondo icona/i)).toBeVisible();
    const genBtn = page.getByTestId('card-generate-icon-ai');
    await expect(genBtn).toBeVisible();

    // Prompt editor toggle + libreria.
    await page.getByRole('button', { name: /Modifica prompt/i }).click();
    await expect(page.getByTestId('card-icon-prompt-editor')).toBeVisible();
    await page.getByRole('button', { name: /Usa prompt automatico/i }).click();
    const promptValue = await page.getByLabel(/Prompt icona AI/i).inputValue();
    expect(promptValue.length).toBeGreaterThan(0);
    await shot(page, 'tb023-icon-ai-section');
  });

  test('AI rail overview screenshot for visual review', async ({ page }) => {
    // Espando tutte le sezioni immagine per la review visuale.
    for (const name of [/Foto AI/i, /Icona AI/i, /Sfondo AI/i, /Decorazione/]) {
      const section = page.locator('.card-ai-panel .ai-section', { has: page.locator('h3', { hasText: name }) }).first();
      const header = section.locator('.ai-section-header');
      if (await header.count() > 0) await header.click().catch(() => {});
    }
    await page.waitForTimeout(400);
    const rail = page.locator('.card-editor-ai');
    const dir = await screenshotDir();
    await rail.screenshot({ path: `${dir}/tb023-ai-rail-full.png` });
  });
});
