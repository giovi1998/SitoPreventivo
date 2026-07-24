import { test, expect, type Page } from '@playwright/test';
import {
  loginAsTestUser,
  openCardEditor,
  fillSampleCard,
  setGridOn,
  selectGridSide,
  selectGridElement,
  exportCard,
  parseCardSvg,
  getTextBounds,
  assertInside,
  saveCardSideScreenshot,
  assertScreenshotNotMostlyBlack,
} from './helpers/cardHarness';

// Spec: spec/spec-card-nudge-layout-template.md v2.0 — REQ-TEST-007 / REQ-TEST-008.
// Copre: nudge testi fronte/retro (preview transform + offset in export SVG),
// zoom per-elemento come fattore font-size, rimozione slider globale
// "Dimensione testo", merge AI di placement + layout right-balanced con
// placement che sopravvive a una seconda mossa AI, e verifica screenshot
// (non mostly-black / non blank, pixel-sampling come ai-log-preview).

const DESKTOP_VIEWPORT = { width: 1400, height: 950 };

async function setupCardWithGrid(page: Page): Promise<void> {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await loginAsTestUser(page);
  await openCardEditor(page);
  await fillSampleCard(page);
  await setGridOn(page, true);
}

async function computedTransform(page: Page, testid: string): Promise<string> {
  return page.locator(`[data-testid="${testid}"]`).first().evaluate((el) => getComputedStyle(el).transform);
}

async function clickPlacement(page: Page, dir: 'left' | 'right' | 'up' | 'down', times: number): Promise<void> {
  const btn = page.locator(`[data-testid="grid-placement-${dir}"]`).first();
  await btn.waitFor({ timeout: 5000 });
  for (let i = 0; i < times; i++) {
    await btn.click();
    await page.waitForTimeout(150);
  }
}

// ─── AI mock helpers ────────────────────────────────────────────────

// Il provider Ollama passa SEMPRE per il proxy server-side (/api/ai/chat),
// anche in locale (vedi src/ai/providers/ollamaPro.ts callLocal→callProxy),
// quindi è mockabile via page.route. DeepSeek in locale andrebbe diretto
// all'API upstream con chiave da localStorage — per questo seediamo
// `pq_ui:v1.aiProviderDefault` con un provider ollama text-only (no vision
// → niente screenshot preview, vedi CON-MM-002).
async function seedOllamaProvider(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('pq_ui:v1', JSON.stringify({
      version: 1,
      sidebarCollapsed: false,
      aiConsoleExpanded: { card: true },
      aiProviderDefault: 'ollama-deepseek-v4-pro',
      aiVisionEnabled: false,
    }));
  });
}

// SSE normalizzato (formato DeepSeek-like) atteso da parseSSEStream del
// provider Ollama: righe `data: {choices:[{delta:{content}}]}` + `[DONE]`.
function sseBodyForJson(payload: unknown): string {
  const content = JSON.stringify(payload);
  const mid = Math.ceil(content.length / 2);
  const chunks = [content.slice(0, mid), content.slice(mid)];
  const lines = chunks.map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}`);
  lines.push(`data: ${JSON.stringify({ choices: [{ delta: {} }], usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 } })}`);
  lines.push('data: [DONE]');
  return `${lines.join('\n\n')}\n\n`;
}

function mockAiChatStream(page: Page, responses: unknown[]): Promise<void> {
  const queue = [...responses];
  const streamHandler = (route: import('@playwright/test').Route) => {
    const payload = queue.length > 1 ? queue.shift() : queue[0];
    return route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sseBodyForJson(payload),
    });
  };
  const chatHandler = (route: import('@playwright/test').Route) => {
    // Fallback non-stream (es. follow-up tool mode, non usato qui).
    const payload = queue.length > 1 ? queue.shift() : queue[0];
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{ message: { content: JSON.stringify(payload) } }],
        usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
      }),
    });
  };
  return Promise.all([
    page.route('**/api/ai/chat/stream', streamHandler),
    page.route('**/api/ai/chat', chatHandler),
  ]).then(() => undefined);
}

async function runAiPrompt(page: Page, prompt: string): Promise<void> {
  const aiPanel = page.locator('[data-testid="card-ai-panel"]');
  await expect(aiPanel).toBeVisible();
  const textarea = aiPanel.locator('textarea').first();
  await textarea.fill(prompt);
  const applyBtn = aiPanel.getByRole('button', { name: /Applica prompt/i }).first();
  await applyBtn.click();
  await expect(async () => {
    expect(await applyBtn.getAttribute('aria-busy')).not.toBe('true');
  }).toPass({ timeout: 20000, intervals: [500, 1000] });
  await page.waitForTimeout(400);
}

test.describe('Card nudge + zoom universale (spec card-nudge v2.0)', () => {
  test('(a) nudge testo fronte: transform CSS su grid-el-name + offset x in export SVG', async ({ page }) => {
    test.setTimeout(120000);
    await setupCardWithGrid(page);

    // Export di riferimento senza nudge.
    const refExport = await exportCard(page, 'svg-front');
    const refParsed = parseCardSvg(refExport.buffer.toString('utf8'));
    const refName = getTextBounds(refParsed, 'MARIO ROSSI');
    expect(refName, 'nome non trovato nel SVG di riferimento').not.toBeNull();
    assertInside(refParsed, refParsed.texts, 2);

    await selectGridElement(page, 'name');
    const controls = page.locator('[data-testid="grid-placement-controls"]').first();
    await expect(controls).toBeVisible();

    const transformBefore = await computedTransform(page, 'grid-el-name');
    await clickPlacement(page, 'right', 3); // placement.x = 0.15
    await expect.poll(() => computedTransform(page, 'grid-el-name')).not.toBe(transformBefore);
    const transformAfter = await computedTransform(page, 'grid-el-name');
    expect(transformAfter, 'transform CSS atteso dopo il nudge').not.toBe('none');

    const nudgedExport = await exportCard(page, 'svg-front');
    const nudgedParsed = parseCardSvg(nudgedExport.buffer.toString('utf8'));
    const nudgedName = getTextBounds(nudgedParsed, 'MARIO ROSSI');
    expect(nudgedName, 'nome non trovato nel SVG dopo nudge').not.toBeNull();
    expect(
      nudgedName!.x,
      `x nome nel SVG deve aumentare dopo nudge right (ref=${refName!.x}, nudged=${nudgedName!.x})`,
    ).toBeGreaterThan(refName!.x);
    assertInside(nudgedParsed, nudgedParsed.texts, 2);

    // REQ-TEST-008: screenshot preview fronte + verifica non-black/non-blank.
    const shot = await saveCardSideScreenshot(page, 'card-preview-front', 'card-nudge-front.png');
    await assertScreenshotNotMostlyBlack(page, shot, 'preview fronte dopo nudge');
  });

  test('(b) zoom testo: slider "Dimensione" su title → font-size scalato in preview ed export', async ({ page }) => {
    test.setTimeout(120000);
    await setupCardWithGrid(page);

    // Export di riferimento (scale = 1).
    const refExport = await exportCard(page, 'svg-front');
    const refParsed = parseCardSvg(refExport.buffer.toString('utf8'));
    const refTitle = getTextBounds(refParsed, 'Web Developer');
    expect(refTitle, 'titolo non trovato nel SVG di riferimento').not.toBeNull();

    await selectGridElement(page, 'title');
    const controls = page.locator('[data-testid="grid-placement-controls"]').first();
    await expect(controls).toBeVisible();
    // Label "Dimensione" (non "Zoom") per elementi testo.
    await expect(controls).toContainText('Dimensione');
    const slider = page.locator('[data-testid="grid-placement-zoom"]').first();
    await expect(slider).toBeVisible();

    const titleBox = () => page.locator('[data-testid="grid-el-title"] .card-title').first().boundingBox();
    const boxBefore = await titleBox();
    expect(boxBefore).not.toBeNull();

    await slider.fill('1.5');
    await page.waitForTimeout(300);
    // Lo slider mostra la percentuale aggiornata.
    await expect(controls).toContainText('150%');
    // Preview: la cella testo scala via CSS transform → bounding box cresce.
    const boxAfter = await titleBox();
    expect(boxAfter).not.toBeNull();
    expect(
      boxAfter!.height,
      `altezza titolo in preview deve crescere con scale 1.5 (${boxBefore!.height} → ${boxAfter!.height})`,
    ).toBeGreaterThan(boxBefore!.height * 1.2);

    const zoomExport = await exportCard(page, 'svg-front');
    const zoomParsed = parseCardSvg(zoomExport.buffer.toString('utf8'));
    const zoomTitle = getTextBounds(zoomParsed, 'Web Developer');
    expect(zoomTitle, 'titolo non trovato nel SVG dopo zoom').not.toBeNull();
    const ratio = zoomTitle!.fontSize / refTitle!.fontSize;
    expect(
      ratio,
      `font-size titolo nel SVG deve essere ~1.5× il riferimento (${refTitle!.fontSize} → ${zoomTitle!.fontSize})`,
    ).toBeGreaterThan(1.3);
    expect(ratio).toBeLessThan(1.7);
    assertInside(zoomParsed, zoomParsed.texts, 2);

    const shot = await saveCardSideScreenshot(page, 'card-preview-front', 'card-zoom-title-front.png');
    await assertScreenshotNotMostlyBlack(page, shot, 'preview fronte dopo zoom titolo');
  });

  test('(c) nudge retro: contacts → offset x in export svg-back (regressione gap 1)', async ({ page }) => {
    test.setTimeout(120000);
    await setupCardWithGrid(page);

    await selectGridSide(page, 'back');

    // Export di riferimento del retro senza nudge.
    const refExport = await exportCard(page, 'svg-back');
    const refParsed = parseCardSvg(refExport.buffer.toString('utf8'));
    const refPhone = getTextBounds(refParsed, '+39 012');
    expect(refPhone, 'telefono non trovato nel SVG retro di riferimento').not.toBeNull();
    assertInside(refParsed, refParsed.texts, 2);

    await selectGridElement(page, 'contacts');
    const controls = page.locator('[data-testid="grid-placement-controls"]').first();
    await expect(controls).toBeVisible();

    const transformBefore = await computedTransform(page, 'grid-el-contacts');
    await clickPlacement(page, 'right', 3);
    await expect.poll(() => computedTransform(page, 'grid-el-contacts')).not.toBe(transformBefore);

    const nudgedExport = await exportCard(page, 'svg-back');
    const nudgedParsed = parseCardSvg(nudgedExport.buffer.toString('utf8'));
    const nudgedPhone = getTextBounds(nudgedParsed, '+39 012');
    expect(nudgedPhone, 'telefono non trovato nel SVG retro dopo nudge').not.toBeNull();
    expect(
      nudgedPhone!.x,
      `x telefono nel SVG retro deve aumentare dopo nudge right (ref=${refPhone!.x}, nudged=${nudgedPhone!.x})`,
    ).toBeGreaterThan(refPhone!.x);
    assertInside(nudgedParsed, nudgedParsed.texts, 2);

    const shot = await saveCardSideScreenshot(page, 'card-preview-back', 'card-nudge-back.png');
    await assertScreenshotNotMostlyBlack(page, shot, 'preview retro dopo nudge contatti');
  });

  test('(d) UI contract: slider globale "Dimensione testo" rimosso, zoom visibile per testi', async ({ page }) => {
    test.setTimeout(60000);
    await setupCardWithGrid(page);

    // REQ-CTRL-001: il testid card-font-scale non deve più esistere.
    await expect(page.locator('[data-testid="card-font-scale"]')).toHaveCount(0);

    // REQ-ZOOM-001: zoom visibile per un elemento testo selezionato.
    await selectGridElement(page, 'name');
    const controls = page.locator('[data-testid="grid-placement-controls"]').first();
    await expect(controls).toBeVisible();
    await expect(page.locator('[data-testid="grid-placement-zoom"]').first()).toBeVisible();
    await expect(controls).toContainText('Dimensione');

    // Stesso controllo su un elemento del retro.
    await selectGridSide(page, 'back');
    await selectGridElement(page, 'contacts');
    await expect(page.locator('[data-testid="grid-placement-zoom"]').first()).toBeVisible();
  });

  test('(e) AI merge: placement + layout right-balanced; placement sopravvive a seconda mossa', async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await loginAsTestUser(page);
    await seedOllamaProvider(page);

    // Risposta 1: layout right-balanced + grid element name con placement.
    const aiResponse1 = {
      front: { layout: 'right-balanced' },
      grid: {
        cols: 4,
        rows: 4,
        elements: {
          name: { x: 0, y: 1, w: 3, h: 1, placement: { x: 0.4, y: -0.2, scale: 1.2 } },
        },
      },
    };
    // Risposta 2: muove solo x/y/w/h dello stesso elemento (placement omesso).
    const aiResponse2 = {
      grid: {
        cols: 4,
        rows: 4,
        elements: {
          name: { x: 1, y: 2, w: 2, h: 1 },
        },
      },
    };
    await mockAiChatStream(page, [aiResponse1, aiResponse2]);

    await openCardEditor(page);
    await fillSampleCard(page);
    await setGridOn(page, true);

    // Prompt senza keyword di analisi/tool (vedi src/ai/promptUtils.ts):
    // deve finire in "direct modify mode" (JSON merge).
    await runAiPrompt(page, 'Applica raffinamento grafico al bigliettino');

    // Dopo il merge: transform del nome presente in preview (placement applicato).
    await expect.poll(() => computedTransform(page, 'grid-el-name'), { timeout: 10000 }).not.toBe('none');
    const transformAfterFirst = await computedTransform(page, 'grid-el-name');

    // Seconda risposta AI: muove solo x/y/w/h → il placement deve sopravvivere.
    await runAiPrompt(page, 'Sposta il nome in basso nella griglia');
    await expect.poll(() => computedTransform(page, 'grid-el-name'), { timeout: 10000 }).not.toBe('none');
    const transformAfterSecond = await computedTransform(page, 'grid-el-name');
    expect(
      transformAfterSecond,
      'il placement AI deve sopravvivere alla seconda mossa (transform ancora presente)',
    ).toBe(transformAfterFirst);

    const shot = await saveCardSideScreenshot(page, 'card-preview-front', 'card-ai-placement-front.png');
    await assertScreenshotNotMostlyBlack(page, shot, 'preview fronte dopo AI placement');
  });
});
