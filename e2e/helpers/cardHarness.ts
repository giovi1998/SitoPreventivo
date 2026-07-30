import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import { auditExportSvg as _auditExportSvg } from '../../src/utils/card/layoutAudit';
import { testUser } from '../fixtures';

export const auditExportSvg = _auditExportSvg;

export type GridElementKey =
  | 'photo' | 'logo' | 'name' | 'title' | 'company'
  | 'contacts' | 'services' | 'socials' | 'qr';

export type ExportAction =
  | 'svg-front' | 'svg-back'
  | 'png-front' | 'png-back'
  | 'pdf';

export interface ParsedCardSvg {
  width: number;
  height: number;
  texts: Array<{ x: number; y: number; fontSize: number; text: string; anchor?: string }>;
  images: Array<{ x: number; y: number; width: number; height: number; href: string }>;
  qrRects: Array<{ x: number; y: number; width: number; height: number }>;
}

const TEST_USER = testUser;

export function seedAuth(page: Page): Promise<void> {
  return page.evaluate((user) => {
    localStorage.setItem('authToken', 'test-token');
    localStorage.setItem('userEmail', user.email);
    localStorage.setItem('username', user.username);
    localStorage.setItem('userRole', user.role);
    localStorage.setItem(
      'registeredUsers',
      JSON.stringify([{
        email: user.email,
        password: user.password,
        username: user.username,
        role: user.role,
      }]),
    );
    localStorage.setItem(
      `userSettings_${user.email}`,
      JSON.stringify({
        userEmail: user.email,
        onboardingDone: true,
        displayName: 'Test',
        companyName: 'Test',
        profession: 'Test',
        defaultColor: '#2563EB',
        defaultVat: 22,
        documentTheme: 'modern',
      }),
    );
  }, TEST_USER);
}

export async function loginAsTestUser(page: Page): Promise<void> {
  await page.goto('/login');
  await seedAuth(page);
}

export async function openCardEditor(page: Page): Promise<void> {
  await page.goto('/app/card');
  await page.waitForSelector('[data-testid="card-preview-front"]', { timeout: 10000 });
  await page.waitForTimeout(400);
}

export async function applyGiovanniTemplate(page: Page): Promise<void> {
  const banner = page.locator('.card-template-banner').first();
  if (await banner.count() > 0) {
    await banner.locator('button').filter({ hasText: /Applica template/i }).first().click();
    await page.waitForTimeout(600);
  }
}

export async function fillSampleCard(page: Page, overrides?: {
  name?: string;
  title?: string;
  company?: string;
  phone?: string;
  email?: string;
  website?: string;
}): Promise<void> {
  const fill = async (label: RegExp, value: string) => {
    const labelEl = page.locator('label.card-field').filter({ hasText: label }).first();
    await labelEl.waitFor({ timeout: 5000 });
    await labelEl.locator('input, textarea, select').first().fill(value);
    await page.waitForTimeout(150);
  };
  await fill(/nome/i, overrides?.name ?? 'Mario Rossi');
  await fill(/ruolo/i, overrides?.title ?? 'Web Developer');
  await fill(/azienda/i, overrides?.company ?? 'WebdevCA');
  await fill(/telefono/i, overrides?.phone ?? '+39 012 345 6789');
  await fill(/email/i, overrides?.email ?? 'mario.rossi@example.com');
  await fill(/sito/i, overrides?.website ?? 'https://giovannicidu.vercel.app');
}

export async function setGridOn(page: Page, on: boolean): Promise<void> {
  const gridToggle = page.locator('.card-grid-toggle').first();
  const currentOn = await gridToggle.evaluate((el) => el.classList.contains('active') || el.getAttribute('aria-pressed') === 'true');
  if (currentOn !== on) {
    await gridToggle.click();
    await page.waitForTimeout(600);
  }
  const debug = page.locator('[data-testid="card-preview-front"] [data-testid="card-grid-debug"]');
  if (on) await expect(debug).toBeVisible();
  else await expect(debug).toBeHidden();
}

export async function selectGridSide(page: Page, side: 'front' | 'back'): Promise<void> {
  const sideSelect = page.locator('[data-testid="grid-editor-side"]').first();
  await sideSelect.waitFor({ timeout: 5000 });
  await sideSelect.selectOption(side);
  await page.waitForTimeout(300);
}

export async function selectGridElement(page: Page, key: GridElementKey): Promise<void> {
  const elSelect = page.locator('select[aria-label="Elemento selezionato"]').first();
  await elSelect.waitFor({ timeout: 5000 });
  await elSelect.selectOption(key);
  await page.waitForTimeout(200);
}

export async function selectGridPreset(page: Page, preset: string): Promise<void> {
  const presetSelect = page.locator('[data-testid="grid-editor-preset"]').first();
  await presetSelect.waitFor({ timeout: 5000 });
  await presetSelect.selectOption(preset);
  await page.waitForTimeout(300);
}

export async function moveGrid(page: Page, dir: 'left' | 'right' | 'up' | 'down', opts: { force?: boolean } = {}): Promise<void> {
  const map: Record<string, string> = {
    left: 'grid-move-left',
    right: 'grid-move-right',
    up: 'grid-move-up',
    down: 'grid-move-down',
  };
  const btn = page.locator(`[data-testid="${map[dir]}"]`).first();
  await btn.waitFor({ timeout: 5000 });
  // With the new blocked-but-enabled buttons, force is no longer needed.
  await btn.click();
  await page.waitForTimeout(300);
}

export async function resizeGrid(page: Page, axis: 'w+' | 'w-' | 'h+' | 'h-'): Promise<void> {
  const map: Record<string, string> = {
    'w+': 'grid-resize-w-plus',
    'w-': 'grid-resize-w-minus',
    'h+': 'grid-resize-h-plus',
    'h-': 'grid-resize-h-minus',
  };
  const btn = page.locator(`[data-testid="${map[axis]}"]`).first();
  await btn.waitFor({ timeout: 5000 });
  await btn.click();
  await page.waitForTimeout(300);
}

export async function alignGrid(
  page: Page,
  h: 'left' | 'center' | 'right',
  v: 'top' | 'center' | 'bottom',
): Promise<void> {
  const btn = page.locator(`[data-testid="grid-align-${h}-${v}"]`).first();
  await btn.waitFor({ timeout: 5000 });
  await btn.click();
  await page.waitForTimeout(300);
}

export async function resetScroll(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
}

export async function exportCard(
  page: Page,
  action: ExportAction,
): Promise<{ download: import('@playwright/test').Download; buffer: Buffer; tempPath: string }> {
  const exportBtn = page.locator('[data-testid="mobile-export-btn"], .card-export-menu > button').first();
  await exportBtn.click();
  await page.waitForTimeout(200);
  const matcher: RegExp = (() => {
    switch (action) {
      case 'svg-front': return /SVG fronte/i;
      case 'svg-back': return /SVG retro/i;
      case 'png-front': return /PNG fronte/i;
      case 'png-back': return /PNG retro/i;
      case 'pdf': return /PDF 10-up.*tipografia/i;
    }
  })();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 25000 }),
    page.getByRole('menuitem').filter({ hasText: matcher }).first().click(),
  ]);
  await expect(exportBtn.locator('span, :scope')).not.toContainText('Esportando', { timeout: 20000 });
  const tempPath = await download.path();
  const buffer = await fs.readFile(tempPath);
  return { download, buffer, tempPath };
}

export function parseCardSvg(svg: string): ParsedCardSvg {
  const viewBox = svg.match(/viewBox="0 0 (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)"/);
  const width = viewBox ? parseFloat(viewBox[1]) : 0;
  const height = viewBox ? parseFloat(viewBox[2]) : 0;

  const textBlocks = Array.from(svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/gi));
  const texts = textBlocks.map((m) => {
    const attrs = m[1];
    const rawContent = m[2];
    const xMatch = attrs.match(/\bx="([^"]+)"/i);
    const yMatch = attrs.match(/\by="([^"]+)"/i);
    const fsMatch = attrs.match(/\bfont-size="([^"]+)"/i);
    const anchorMatch = attrs.match(/\btext-anchor="([^"]+)"/i);
    const innerText = rawContent.replace(/<[^>]+>/g, '').trim();

    return {
      x: xMatch ? parseFloat(xMatch[1]) : 0,
      y: yMatch ? parseFloat(yMatch[1]) : 0,
      fontSize: fsMatch ? parseFloat(fsMatch[1]) : 0,
      text: innerText,
      anchor: anchorMatch ? anchorMatch[1] : undefined,
    };
  });

  const imageBlocks = Array.from(svg.matchAll(/<image\b([^>]*)\/?>/gi));
  const images = imageBlocks.map((m) => {
    const attrs = m[1];
    const hrefMatch = attrs.match(/\b(?:href|xlink:href)="([^"]+)"/i);
    const xMatch = attrs.match(/\bx="([^"]+)"/i);
    const yMatch = attrs.match(/\by="([^"]+)"/i);
    const wMatch = attrs.match(/\bwidth="([^"]+)"/i);
    const hMatch = attrs.match(/\bheight="([^"]+)"/i);

    return {
      href: hrefMatch ? hrefMatch[1] : '',
      x: xMatch ? parseFloat(xMatch[1]) : 0,
      y: yMatch ? parseFloat(yMatch[1]) : 0,
      width: wMatch ? parseFloat(wMatch[1]) : 0,
      height: hMatch ? parseFloat(hMatch[1]) : 0,
    };
  });

  const rectBlocks = Array.from(svg.matchAll(/<rect\b([^>]*)\/?>/gi));
  const qrRects = rectBlocks
    .filter((m) => m[1].includes('stroke="#01696F"') || m[1].includes('stroke='))
    .map((m) => {
      const attrs = m[1];
      const xMatch = attrs.match(/\bx="([^"]+)"/i);
      const yMatch = attrs.match(/\by="([^"]+)"/i);
      const wMatch = attrs.match(/\bwidth="([^"]+)"/i);
      const hMatch = attrs.match(/\bheight="([^"]+)"/i);

      return {
        x: xMatch ? parseFloat(xMatch[1]) : 0,
        y: yMatch ? parseFloat(yMatch[1]) : 0,
        width: wMatch ? parseFloat(wMatch[1]) : 0,
        height: hMatch ? parseFloat(hMatch[1]) : 0,
      };
    });

  return { width, height, texts, images, qrRects };
}

export function getTextBounds(parsed: ParsedCardSvg, text: string) {
  return parsed.texts.find((t) => t.text.includes(text)) ?? null;
}

export function assertInside(
  bounds: { width: number; height: number },
  els: Array<{ x: number; y: number; width?: number; height?: number; fontSize?: number; text?: string }>,
  tolerance = 0,
) {
  for (const el of els) {
    const w = el.width ?? 0;
    const h = el.height ?? (el.fontSize ? el.fontSize * 1.2 : 0);
    const right = el.x + w + tolerance;
    const bottom = el.y + h + tolerance;
    expect(right, `element ${el.text ?? 'image'} overflows right: x=${el.x} w=${w}`).toBeLessThanOrEqual(bounds.width + tolerance);
    expect(bottom, `element ${el.text ?? 'image'} overflows bottom: y=${el.y} h=${h}`).toBeLessThanOrEqual(bounds.height + tolerance);
    expect(el.x, `element ${el.text ?? 'image'} overflows left`).toBeGreaterThanOrEqual(-tolerance);
    expect(el.y, `element ${el.text ?? 'image'} overflows top`).toBeGreaterThanOrEqual(-tolerance);
  }
}

export async function screenshotDir(): Promise<string> {
  const dir = 'e2e/__screenshots__';
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Salva lo screenshot di un lato della preview card in `e2e/__screenshots__/`
 * e ritorna il buffer PNG (per le asserzioni pixel-sampling).
 */
export async function saveCardSideScreenshot(
  page: Page,
  testid: 'card-preview-front' | 'card-preview-back',
  fileName: string,
): Promise<Buffer> {
  const dir = await screenshotDir();
  const el = page.locator(`[data-testid="${testid}"]`).first();
  await expect(el).toBeVisible();
  return el.screenshot({ path: path.join(dir, fileName) });
}

/**
 * Verifica che uno screenshot PNG non sia "mostly black" né blank (tutto
 * bianco/uniforme). Pixel-sampling reale via canvas in-page, adattato da
 * `assertImageNotMostlyBlack` di e2e/ai-log-preview.spec.ts (REQ-TEST-008).
 */
export async function assertScreenshotNotMostlyBlack(
  page: Page,
  buffer: Buffer,
  label: string,
): Promise<void> {
  const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
  const result = await page.evaluate(async (src) => {
    const res = await fetch(src);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, bitmap.width);
    canvas.height = Math.max(1, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return { nonBlack: 0, nonWhite: 0 };
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonBlack = 0;
    let nonWhite = 0;
    const step = 16; // campiona 1 pixel ogni 16
    for (let i = 0; i < data.length; i += step * 4) {
      if (data[i] > 30 || data[i + 1] > 30 || data[i + 2] > 30) nonBlack++;
      if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) nonWhite++;
    }
    return { nonBlack, nonWhite };
  }, dataUrl);
  expect(result.nonBlack, `${label}: screenshot mostly-black`).toBeGreaterThan(20);
  expect(result.nonWhite, `${label}: screenshot blank/uniforme`).toBeGreaterThan(20);
}

export async function copyExportToScreenshot(tempPath: string, name: string): Promise<string> {
  const dir = await screenshotDir();
  const dest = path.join(dir, name);
  await fs.copyFile(tempPath, dest);
  return dest;
}

export async function addServices(page: Page, services: string[]): Promise<void> {
  for (let i = 0; i < services.length; i++) {
    await page.locator('[data-testid="card-add-service"]').first().click();
    await page.waitForTimeout(200);
  }
  const inputs = await page.locator('input[aria-label^="Servizio "]').all();
  for (let i = 0; i < services.length; i++) {
    await inputs[i].fill(services[i]);
  }
  await page.waitForTimeout(400);
}

export async function addSocials(page: Page, socials: Array<{ platform: string; url: string }>): Promise<void> {
  for (let i = 0; i < socials.length; i++) {
    await page.locator('[data-testid="card-add-social"]').first().click();
    await page.waitForTimeout(200);
  }
  // Service rows reuse the same class; filter to rows that have a platform select.
  const rows = await page.locator('.card-social-row').filter({ has: page.locator('select') }).all();
  for (let i = 0; i < socials.length; i++) {
    await rows[i].locator('select').first().selectOption(socials[i].platform);
    await rows[i].locator('input').first().fill(socials[i].url);
  }
  await page.waitForTimeout(400);
}
