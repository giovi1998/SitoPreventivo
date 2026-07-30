/**
 * crm-live-test.mjs — manual E2E validation of the CRM pipeline in dev (LOCAL/localStorage mode).
 * NOT part of CI / npm scripts. Run: node scripts/crm-live-test.mjs
 * Requires dev server on http://localhost:8000. Reads VITE_ADMIN_PASSWORD from .env at runtime
 * (never printed). Screenshots → screenshots/crm-live/. Idempotent: reuses existing "Pad Thai Live".
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'http://localhost:8000';
const SHOTS = path.join(ROOT, 'screenshots', 'crm-live');
const TMP_LOGO = path.join(ROOT, 'scripts', '.tmp-padthai-logo.png');
const CUSTOMER_NAME = 'Pad Thai Live';
mkdirSync(SHOTS, { recursive: true });

// Password from .env — never logged.
const envText = readFileSync(path.join(ROOT, '.env'), 'utf8');
const password = (envText.match(/^VITE_ADMIN_PASSWORD=(.+)$/m)?.[1] || '').trim().replace(/^["']|["']$/g, '');
if (!password) { console.error('VITE_ADMIN_PASSWORD not found in .env'); process.exit(1); }

const report = { steps: [], consoleErrors: [], flyerDraftCreated: null, researchStatus: null, aiGen: {}, notes: [] };
const step = (n, name, ok, evidence) => {
  report.steps.push({ step: n, name, ok, evidence });
  console.log(`[step ${n}] ${ok ? 'OK  ' : 'FAIL'} ${name} — ${evidence}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForLog(page, re, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const txt = await page.locator('[data-testid="crm-ai-log"]').innerText().catch(() => '');
    if (re.test(txt)) return { matched: true, text: txt };
    await sleep(1500);
  }
  return { matched: false, text: await page.locator('[data-testid="crm-ai-log"]').innerText().catch(() => '') };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => report.consoleErrors.push(`pageerror: ${String(e).slice(0, 300)}`));
  let shotN = 0;
  const shot = async (name) => {
    const p = path.join(SHOTS, `${String(++shotN).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: p, fullPage: false });
    return p;
  };

  // ── Step 1: login ──────────────────────────────────────────────
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#auth-email', 'admin@gmail.com');
  await page.fill('#auth-password', password);
  await page.click('button.auth-submit');
  await page.waitForURL(/\/app/, { timeout: 15000 }).catch(() => {});
  const loggedIn = !page.url().includes('/login');
  step(1, 'Login admin', loggedIn, `url=${page.url()}`);
  if (!loggedIn) { await shot('login-fail'); throw new Error('login failed'); }
  await shot('login');

  // ── Step 2: customers list, create-or-reuse ────────────────────
  await page.goto(`${BASE}/app/customers`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.crm-list, .crm-page', { timeout: 15000 });
  await sleep(1000);
  let card = page.locator('li.crm-card', { hasText: CUSTOMER_NAME }).first();
  let reused = await card.count() > 0;
  if (!reused) {
    await page.click('text=+ Nuovo cliente');
    await page.fill('[data-testid="crm-create-businessname"]', CUSTOMER_NAME);
    await page.fill('[data-testid="crm-create-ownername"]', 'Mattia');
    await page.fill('[data-testid="crm-create-sector"]', 'ristorante');
    await page.click('[data-testid="crm-create-submit"]');
    card = page.locator('li.crm-card', { hasText: CUSTOMER_NAME }).first();
    await card.waitFor({ timeout: 10000 });
  }
  step(2, 'Customer create/reuse', true, reused ? 'reused existing "Pad Thai Live"' : 'created new via UI form');
  await shot('customers-list');
  await card.click();

  // ── Step 3: detail URL routing ─────────────────────────────────
  await page.waitForSelector('[data-testid="crm-detail"]', { timeout: 15000 });
  await sleep(800);
  const detailUrl = page.url();
  const customerId = detailUrl.match(/\/app\/customers\/([^/?]+)/)?.[1] || null;
  step(3, 'URL routing /app/customers/<id>', !!customerId, `url=${detailUrl}`);
  await shot('customer-detail');

  // Fill activity + website via inline edit (create form has only name/owner/sector)
  async function editField(label, testid, value, isTextarea) {
    const field = page.locator(`.crm-field:has(.crm-field-label:text-is("${label}"))`).first();
    await field.locator('.crm-field-value').click();
    const input = page.locator(`[data-testid="${testid}"]`);
    await input.waitFor({ timeout: 5000 });
    await input.fill(value);
    if (isTextarea) await page.locator('[data-testid="crm-detail-title"]').click(); // blur commits
    else await input.press('Enter');
    await sleep(800);
  }
  const briefText = await page.locator('[data-testid="crm-detail"]').innerText();
  if (!briefText.includes('Ristorante thailandese')) {
    await editField('Attività', 'crm-edit-activity', 'Ristorante thailandese: pad thai, curry, piatti wok da asporto.', true);
  }
  if (!briefText.includes('padthaicagliari.it')) {
    await editField('Sito', 'crm-edit-contact_website', 'https://padthaicagliari.it', false);
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="crm-detail"]', { timeout: 15000 });
  await sleep(800);
  const detailText = await page.locator('[data-testid="crm-detail"]').innerText();
  const fieldsOk = detailText.includes('Ristorante thailandese') && detailText.includes('padthaicagliari.it');
  step(3.5, 'Activity + website set', fieldsOk, fieldsOk ? 'persisted after reload' : 'missing after reload');
  await shot('detail-fields');

  // ── Step 4: generate logo PNG + upload ─────────────────────────
  const logoPage = await ctx.newPage();
  await logoPage.setViewportSize({ width: 512, height: 512 });
  await logoPage.setContent(`<body style="margin:0"><svg id="logo" width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <rect x="16" y="16" width="480" height="480" rx="96" fill="#111111"/>
    <circle cx="256" cy="200" r="88" fill="#F4A261"/>
    <circle cx="222" cy="182" r="12" fill="#111111"/>
    <path d="M300 230 q60 10 70 70" stroke="#F4A261" stroke-width="26" fill="none" stroke-linecap="round"/>
    <text x="256" y="400" text-anchor="middle" font-family="Arial, sans-serif" font-size="64" font-weight="bold" fill="#F4A261">Pad Thai</text>
  </svg></body>`);
  await logoPage.locator('#logo').screenshot({ path: TMP_LOGO });
  await logoPage.close();

  const alreadyLogo = await page.locator('[data-testid="crm-logo-preview"]').count() > 0;
  if (!alreadyLogo) {
    await page.setInputFiles('[data-testid="crm-logo-upload"]', TMP_LOGO);
    const up = await waitForLog(page, /Logo caricato|Caricamento logo fallito/, 20000);
    step(4, 'Logo upload', /Logo caricato/.test(up.text), up.matched ? '"Logo caricato" in AI log' : `log tail: ${up.text.slice(-200)}`);
  } else {
    step(4, 'Logo upload', true, 'skipped — logo already present (idempotent reuse)');
  }
  const previewVisible = await page.locator('[data-testid="crm-logo-preview"]').count() > 0;
  report.notes.push(`logo preview visible: ${previewVisible}`);
  await shot('logo-uploaded');

  // ── Step 5: research (real Firecrawl) ──────────────────────────
  const researchDone = await page.locator('[data-testid="crm-research-section"]').count() > 0;
  if (!researchDone) {
    await page.click('[data-testid="crm-research-btn"]');
    const r = await waitForLog(page, /Research completata|research fallito|Research.*fallit/i, 120000);
    step(5, 'Research (Firecrawl)', /Research completata/i.test(r.text), r.matched ? 'completion log seen' : `timeout; log tail: ${r.text.slice(-200)}`);
  } else {
    step(5, 'Research (Firecrawl)', true, 'skipped — research section already present (reuse)');
  }
  await sleep(500);
  const webPill = await page.locator('.crm-timeline-row:has-text("Sito web") .crm-status-pill').first().innerText().catch(() => 'n/a');
  const logoPill = await page.locator('[data-testid="crm-logo-status"]').innerText().catch(() => 'n/a');
  report.researchStatus = { web: webPill.trim(), logo: logoPill.trim() };
  await shot('research-done');

  // ── Step 6: AI fill + auto-build ───────────────────────────────
  const docsBefore = await page.locator('[data-testid="crm-doc-list"] li.crm-doc-row').count();
  await page.click('[data-testid="crm-ai-fill-btn"]');
  const fill = await waitForLog(page, /AI fill completato|AI fill.*fallit/, 60000);
  step(6.1, 'AI fill gap', /AI fill completato/.test(fill.text), fill.matched ? 'ok' : `log tail: ${fill.text.slice(-200)}`);

  if (docsBefore === 0) {
    await page.click('[data-testid="crm-auto-build-btn"]');
    const ab = await waitForLog(page, /Auto-build: draft creati|Auto-build.*fallit/, 120000);
    step(6.2, 'Auto-build draft', /draft creati/.test(ab.text), ab.matched ? 'ok' : `log tail: ${ab.text.slice(-200)}`);
  } else {
    step(6.2, 'Auto-build draft', true, `skipped — ${docsBefore} docs already exist (reuse)`);
  }
  await sleep(800);
  const docTypes = await page.locator('[data-testid="crm-doc-list"] li.crm-doc-row .crm-doc-info strong').allInnerTexts();
  report.flyerDraftCreated = docTypes.some((t) => /flyer/i.test(t));
  report.notes.push(`docs after auto-build: [${docTypes.join(', ')}] (logo draft skipped by design when manual logo uploaded — dataService.js:1042)`);
  step(6.3, 'Flyer draft created', report.flyerDraftCreated, `docs: ${docTypes.join(', ')}`);
  await shot('auto-build-docs');

  // ── Step 7: palette provider default ───────────────────────────
  const providerVal = await page.locator('[data-testid="crm-ai-provider"]').inputValue();
  step(7, 'Palette provider default', providerVal === 'ollama-minimax-m3', `value=${providerVal}`);
  await shot('palette-provider');

  // ── Step 8: log copy/clear UX ──────────────────────────────────
  await page.click('[data-testid="crm-log-copy"]');
  await sleep(400);
  const copyLabel = await page.locator('[data-testid="crm-log-copy"]').innerText();
  const copyOk = copyLabel.includes('Copiato');
  await shot('log-copied');
  await page.click('[data-testid="crm-log-clear"]');
  await sleep(400);
  const emptyVisible = await page.locator('.crm-ai-log-empty').count() > 0;
  step(8, 'Log copy/clear', copyOk && emptyVisible, `copy label="${copyLabel.trim()}", empty after clear=${emptyVisible}`);
  await shot('log-cleared');

  // ── Step 9: Genera bozze AI (real AI calls, up to 8 min) ───────
  const genBtn = page.locator('[data-testid="crm-generate-drafts-btn"]');
  const genEnabled = await genBtn.isEnabled().catch(() => false);
  if (!genEnabled) {
    step(9, 'Genera bozze AI', false, 'button disabled (no pending drafts)');
  } else {
    const docIds = await page.locator('[data-testid^="crm-open-doc-"]').evaluateAll(
      (els) => els.map((el) => el.getAttribute('data-testid').replace('crm-open-doc-', '')));
    await genBtn.click();
    await sleep(30000);
    await shot('ai-gen-progress');
    const t0 = Date.now();
    const finalStatus = {};
    let lastShot = 0;
    while (Date.now() - t0 < 8 * 60 * 1000) {
      let allDone = true;
      for (const id of docIds) {
        const txt = await page.locator(`[data-testid="crm-doc-gen-${id}"]`).innerText().catch(() => '');
        if (txt.includes('✓')) finalStatus[id] = 'done';
        else if (txt.includes('✗')) finalStatus[id] = 'error';
        else { finalStatus[id] = txt ? 'running' : 'unknown'; allDone = false; }
      }
      if (allDone) break;
      if (Date.now() - lastShot > 90000) { await shot('ai-gen-progress'); lastShot = Date.now(); }
      await sleep(8000);
    }
    // map ids → types
    const rows = page.locator('[data-testid="crm-doc-list"] li.crm-doc-row');
    const n = await rows.count();
    for (let i = 0; i < n; i++) {
      const row = rows.nth(i);
      const type = await row.locator('.crm-doc-info strong').innerText();
      const openId = (await row.locator('[data-testid^="crm-open-doc-"]').getAttribute('data-testid'))?.replace('crm-open-doc-', '');
      if (openId) report.aiGen[type.trim()] = finalStatus[openId] || 'unknown';
    }
    const logTxt = await page.locator('[data-testid="crm-ai-log"]').innerText().catch(() => '');
    const errLines = logTxt.split('\n').filter((l) => /✗|errore|fallit/i.test(l)).slice(0, 5);
    report.notes.push(`ai-gen error lines: ${errLines.join(' | ') || 'none'}`);
    const allOk = Object.values(report.aiGen).length > 0 && Object.values(report.aiGen).every((s) => s === 'done');
    step(9, 'Genera bozze AI', allOk, JSON.stringify(report.aiGen));
    await shot('ai-gen-final');
  }

  // ── Step 10: open card editor (+ flyer) ────────────────────────
  const cardRow = page.locator('[data-testid="crm-doc-list"] li.crm-doc-row', { hasText: 'businessCard' }).first();
  if (await cardRow.count() > 0) {
    await cardRow.locator('[data-testid^="crm-open-doc-"]').click();
    await page.waitForURL(/\/app\/card\//, { timeout: 15000 }).catch(() => {});
    await sleep(5000); // editor hydrate + preview render
    step(10.1, 'Card editor open', /\/app\/card\//.test(page.url()), `url=${page.url()}`);
    await shot('editor-card');
    await page.goto(`${BASE}/app/customers/${customerId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="crm-detail"]', { timeout: 15000 });
    await sleep(1000);
  } else {
    step(10.1, 'Card editor open', false, 'no businessCard doc row');
  }
  const flyerRow = page.locator('[data-testid="crm-doc-list"] li.crm-doc-row', { hasText: 'flyer' }).first();
  if (await flyerRow.count() > 0) {
    await flyerRow.locator('[data-testid^="crm-open-doc-"]').click();
    await page.waitForURL(/\/app\/flyer\//, { timeout: 15000 }).catch(() => {});
    await sleep(5000);
    step(10.2, 'Flyer editor open', /\/app\/flyer\//.test(page.url()), `url=${page.url()}`);
    await shot('editor-flyer');
  } else {
    step(10.2, 'Flyer editor open', false, 'no flyer doc row');
  }

  await browser.close();
  report.consoleErrors = [...new Set(report.consoleErrors)].slice(0, 20);
  console.log('\n===== REPORT =====');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
