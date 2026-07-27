import { test, expect, type Page, type Route } from '@playwright/test';
import {
  loginAsTestUser,
  openCardEditor,
  fillSampleCard,
  saveCardSideScreenshot,
  assertScreenshotNotMostlyBlack,
} from './helpers/cardHarness';

// Spec TB-023 residuo: verifica icona AI 1K end-to-end (issue 2b
// post-tb023-known-issues.md). L'icona generata NON deve essere un quadrato
// vuoto (causa sospetta: removeBackground tolerance 240 che cancella icone
// chiare). Screenshot preview front + export PNG per verifica visiva altro
// modello.
//
// Mocka /api/ai/image-flash con un PNG 1024×1024 non-trasparente (riempito
// di colore solido + forma centrale) per determinismo (no chiavi Gemini in CI).

const DESKTOP_VIEWPORT = { width: 1400, height: 950 };

async function setup(page: Page): Promise<void> {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  // Pre-seed auth + tier unlocked PRIMA del login (AppShell legge al mount)
  await page.goto('/login');
  await page.evaluate(() => {
    const email = 'test@example.com';
    localStorage.setItem('authToken', 'test-token');
    localStorage.setItem('userEmail', email);
    localStorage.setItem('username', 'Test');
    localStorage.setItem('userRole', 'user');
    localStorage.setItem('registeredUsers', JSON.stringify([{ email, password: 'Password123!', username: 'Test', role: 'user' }]));
    localStorage.setItem(`userSettings_${email}`, JSON.stringify({
      userEmail: email,
      onboardingDone: true,
      displayName: 'Test',
      companyName: 'Test',
      profession: 'Test',
      defaultColor: '#2563EB',
      defaultVat: 22,
      documentTheme: 'modern',
      tier: 'unlocked',
      unlockCode: 'E2E-TEST',
    }));
  });
  await openCardEditor(page);
  await fillSampleCard(page);
}

// Genera un PNG 1024×1024 con sfondo bianco + cerchio rosso centrale.
// Non trasparente: se removeBackground lo strappa via, screenshot preview
// mostrerà un quadrato vuoto → test fallisce (cattura la regression).
async function mockImageFlashEndpoint(page: Page): Promise<void> {
  const pngBase64 = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    // Sfondo bianco (removeBackground tolerance 240 dovrebbe rimuoverlo)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 1024, 1024);
    // Forma centrale rossa (deve sopravvivere al removeBackground)
    ctx.fillStyle = '#E11D48';
    ctx.beginPath();
    ctx.arc(512, 512, 320, 0, Math.PI * 2);
    ctx.fill();
    // Dettaglio interno verde (contrasto forte)
    ctx.fillStyle = '#10B981';
    ctx.fillRect(440, 440, 144, 144);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  });
  await page.route('**/api/ai/image-flash', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { imageBase64: pngBase64, mimeType: 'image/png' } }),
    }),
  );
}

async function openIconAiSection(page: Page): Promise<void> {
  const aiPanel = page.locator('[data-testid="card-ai-panel"]').first();
  await expect(aiPanel).toBeVisible();
  const iconHeader = aiPanel.getByRole('button', { name: /icona ai/i }).first();
  await iconHeader.click();
  await page.waitForTimeout(300);
  const genBtn = aiPanel.locator('[data-testid="card-generate-icon-ai"]').first();
  await expect(genBtn).toBeVisible({ timeout: 5000 });
}

test.describe('TB-023 icona AI 1K end-to-end (issue 2b)', () => {
  test('(a) generate icon AI → photo cell mostra contenuto non vuoto', async ({ page }) => {
    test.setTimeout(120000);
    await setup(page);
    await mockImageFlashEndpoint(page);

    // Apri pannello AI card e genera icona
    await openIconAiSection(page);
    const aiPanel = page.locator('[data-testid="card-ai-panel"]').first();
    const genBtn = aiPanel.locator('[data-testid="card-generate-icon-ai"]').first();
    await genBtn.click();

    // Attendi che la foto cell mostri la nuova icona (photoUrl aggiornato)
    const photoCell = page.locator('[data-testid="grid-el-photo"] img, [data-testid="card-preview-front"] .card-photo').first();
    await expect(photoCell).toBeVisible({ timeout: 20000 });

    // Screenshot preview front
    const buf = await saveCardSideScreenshot(page, 'card-preview-front', 'tb023-icon-ai-1k-preview.png');
    await assertScreenshotNotMostlyBlack(page, buf, 'tb023-icon-ai-1k');
  });

  test('(b) icon survives removeBackground (no empty square)', async ({ page }) => {
    test.setTimeout(120000);
    await setup(page);
    await mockImageFlashEndpoint(page);

    await openIconAiSection(page);
    const aiPanel = page.locator('[data-testid="card-ai-panel"]').first();
    const genBtn = aiPanel.locator('[data-testid="card-generate-icon-ai"]').first();
    await genBtn.click();

    // Attendi photo visibile
    const photoCell = page.locator('[data-testid="card-preview-front"] .card-photo').first();
    await expect(photoCell).toBeVisible({ timeout: 20000 });

    // Verifica pixel-sampling: ci sono pixel rossi (E11D48) o verdi (10B981)
    // → l'icona NON è stata rimossa dal removeBackground.
    const result = await page.evaluate(async () => {
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('.card-photo'));
      if (!imgs.length) return { red: 0, green: 0, total: 0 };
      const img = imgs[0];
      // Attendi fully loaded
      if (!img.complete || !img.naturalWidth) {
        await new Promise((res) => {
          img.onload = () => res(null);
          img.onerror = () => res(null);
          setTimeout(() => res(null), 3000);
        });
      }
      const canvas = document.createElement('canvas');
      const w = Math.max(1, img.naturalWidth || 256);
      const h = Math.max(1, img.naturalHeight || 256);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { red: 0, green: 0, total: 0 };
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      let red = 0, green = 0, total = 0;
      // Step 4 = campiona ogni pixel (immagine piccola)
      for (let i = 0; i < data.length; i += 16) {
        total++;
        // Rosso: R alto, G/B medio-bassi
        if (data[i] > 180 && data[i + 1] < 100 && data[i + 2] < 100) red++;
        // Verde: G alto, R/B medio-bassi (verde #10B981 ha B=129)
        if (data[i + 1] > 150 && data[i] < 100 && data[i + 2] < 150) green++;
      }
      return { red, green, total };
    });
    // L'icona ha cerchio rosso + quadrato verde: devono esserci pixel di entrambi
    expect(result.total).toBeGreaterThan(100);
    expect(result.red, 'icona AI rossa scomparsa (removeBackground ha strappato tutto?)').toBeGreaterThan(5);
    expect(result.green, 'icona AI verde scomparsa').toBeGreaterThan(0);
  });

  test('(c) screenshot back preview not mostly-black (sanity check)', async ({ page }) => {
    test.setTimeout(120000);
    await setup(page);
    await mockImageFlashEndpoint(page);
    const buf = await saveCardSideScreenshot(page, 'card-preview-back', 'tb023-icon-ai-1k-back.png');
    await assertScreenshotNotMostlyBlack(page, buf, 'tb023-icon-ai-1k-back');
  });
});