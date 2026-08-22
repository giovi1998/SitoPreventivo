/**
 * chiccheria-compare.mjs — confronto A/B qualità autobuild tra due ambienti
 * (es. PROD/master vs branch locale) sullo stesso brief: "La Chiccheria",
 * gelateria artigianale a Cagliari (flyer promozionale gelato arancia e
 * cioccolato). Genera logo + card + flyer + website via "Genera bozze AI"
 * (agentMode) e salva gli screenshot degli editor per il confronto visivo.
 *
 * NOTA: il logo non è confrontabile se il cliente ha un logo caricato
 * (identico nei due ambienti): il confronto utile è website/card/flyer.
 *
 * Uso (dev server attivo per il branch):
 *   node scripts/chiccheria-compare.mjs --base http://localhost:8000 --label branch
 *   node scripts/chiccheria-compare.mjs --base https://quickbrand.vercel.app --label prod
 *
 * Password admin: da .env (VITE_ADMIN_PASSWORD o ADMIN_PASSWORD) oppure
 * variabile d'ambiente QB_ADMIN_PASSWORD (--password mai consigliato).
 * Output: screenshots/chiccheria-<label>/*.png + report JSON.
 *
 * Costo AI per giro completo: ~€0.20-0.50 (chiamate reali). Non è CI.
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BASE = arg('base', 'http://localhost:8000').replace(/\/$/, '');
const LABEL = arg('label', new URL(BASE).hostname.replace(/\W+/g, '-'));
const OUT = path.join(ROOT, 'screenshots', `chiccheria-${LABEL}`);

let password = process.env.QB_ADMIN_PASSWORD || '';
if (!password) {
  try {
    const envText = readFileSync(path.join(ROOT, '.env'), 'utf8');
    password = (envText.match(/^(?:VITE_)?ADMIN_PASSWORD=(.+)$/m)?.[1] || '').trim().replace(/^["']|["']$/g, '');
  } catch { /* .env assente */ }
}
if (!password) {
  console.error('Password admin mancante: setta QB_ADMIN_PASSWORD o VITE_ADMIN_PASSWORD in .env');
  process.exit(1);
}

// Brief identico nei due ambienti — è la condizione per un confronto onesto.
const CUSTOMER_NAME = 'La Chiccheria';
const BRIEF = {
  ownerName: 'Giovanni',
  sector: 'gelateria artigianale',
  activity: 'Gelateria artigianale con produzione propria',
  mood: 'fresco, goloso, artigianale',
  target: 'famiglie e turisti',
  preferredColors: '#F4A261,#8B5E3C',
  notes: 'Promo estiva: promozionale del gelato all\'arancia al cioccolato. Gelato artigianale dal 1998, coni e coppette, panna fresca.',
};

mkdirSync(OUT, { recursive: true });
const report = { base: BASE, label: LABEL, startedAt: new Date().toISOString(), steps: [], consoleErrors: [] };
const step = (n, name, ok, evidence) => {
  report.steps.push({ n, name, ok, evidence });
  console.log(`[step ${n}] ${ok ? 'OK  ' : 'FAIL'} ${name} — ${evidence}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForLog(page, re, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const txt = await page.locator('[data-testid="crm-ai-log"]').innerText().catch(() => '');
    if (re.test(txt)) return txt;
    await sleep(2000);
  }
  return null;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.consoleErrors.push(String(e).slice(0, 300)));
  let shotN = 0;
  const shot = async (name) => page.screenshot({ path: path.join(OUT, `${String(++shotN).padStart(2, '0')}-${name}.png`), fullPage: false });

  // ── 1. Login ──────────────────────────────────────────────
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('#auth-email', 'admin@gmail.com');
  await page.fill('#auth-password', password);
  await page.click('button.auth-submit');
  await page.waitForURL(/\/app/, { timeout: 20000 }).catch(() => {});
  const loggedIn = !page.url().includes('/login');
  step(1, 'Login admin', loggedIn, `url=${page.url()}`);
  if (!loggedIn) throw new Error('Login fallito');

  // ── 2. Cliente create-or-reuse ────────────────────────────
  await page.goto(`${BASE}/app/customers`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.crm-list, .crm-page', { timeout: 20000 });
  await sleep(1000);
  let card = page.locator('li.crm-card', { hasText: CUSTOMER_NAME }).first();
  if ((await card.count()) === 0) {
    await page.click('text=+ Nuovo cliente');
    await page.fill('[data-testid="crm-create-businessname"]', CUSTOMER_NAME);
    await page.fill('[data-testid="crm-create-ownername"]', BRIEF.ownerName);
    await page.fill('[data-testid="crm-create-sector"]', BRIEF.sector);
    await page.click('[data-testid="crm-create-submit"]');
    card = page.locator('li.crm-card', { hasText: CUSTOMER_NAME }).first();
    await card.waitFor({ timeout: 15000 });
  }
  await card.click();
  await page.waitForSelector('[data-testid="crm-detail"]', { timeout: 20000 });
  step(2, 'Cliente La Chiccheria pronto', true, page.url());

  // ── 3. Brief identico (idempotente: compila solo i campi vuoti) ──
  async function fillIfEmpty(testid, value) {
    const input = page.locator(`[data-testid="${testid}"]`);
    if ((await input.count()) === 0) return;
    if ((await input.inputValue().catch(() => '')).trim()) return;
    const field = input.locator('xpath=ancestor::*[contains(@class,"crm-field")][1]');
    await field.locator('.crm-field-value').click().catch(async () => { await input.click(); });
    await input.waitFor({ timeout: 5000 });
    await input.fill(value);
    await page.keyboard.press('Escape').catch(() => {});
    await input.blur().catch(() => {});
  }
  for (const [tid, value] of [
    ['crm-edit-activity', BRIEF.activity],
    ['crm-edit-mood', BRIEF.mood],
    ['crm-edit-target', BRIEF.target],
    ['crm-edit-preferredColors', BRIEF.preferredColors],
    ['crm-edit-notes', BRIEF.notes],
  ]) {
    await fillIfEmpty(tid, value).catch(() => {});
  }
  await shot('brief');
  step(3, 'Brief compilato', true, Object.keys(BRIEF).join(', '));

  // ── 4. Genera bozze AI (logo+card+flyer+website, agentMode) ──
  const genBtn = page.locator('[data-testid="crm-generate-drafts-btn"]');
  await genBtn.waitFor({ timeout: 15000 });
  if (!(await genBtn.isEnabled())) {
    // Nessun draft pending: rigenera tutti i draft dal menu per-doc? Fallback: ricrea i draft.
    step(4, 'Genera bozze AI', false, 'nessun draft pending (draft già generati in questo ambiente)');
  } else {
    await genBtn.click();
    await shot('generazione-in-corso');
    const logText = await waitForLog(page, /completata|fallita|error/i, 15 * 60_000);
    step(4, 'Genera bozze AI', !!logText && /completata/i.test(logText || ''), logText ? 'log CRM ok' : 'timeout log');
  }
  await shot('crm-summary');

  // ── 5. Screenshot editor per oggetto (website/card/flyer/logo) ──
  const targets = [
    { key: 'website', view: 'website' },
    { key: 'card', view: 'card' },
    { key: 'flyer', view: 'flyer' },
    { key: 'logo', view: 'logo' },
  ];
  for (const { key, view } of targets) {
    await page.goto(`${BASE}/app/collection`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);
    const openBtn = page.locator('.collection-card', { hasText: key === 'card' ? 'igliett' : key }).first();
    const found = (await openBtn.count()) > 0;
    if (!found) { step(5, `Editor ${key}`, false, 'non trovato in Collection'); continue; }
    await openBtn.locator('text=Apri').first().click().catch(async () => { await openBtn.click(); });
    await sleep(6000); // preview/prerender
    await shot(`editor-${key}`);
    step(5, `Editor ${key}`, true, page.url());
  }

  report.finishedAt = new Date().toISOString();
  writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`\nReport: ${path.join(OUT, 'report.json')}`);
  console.log('Confronto: apri le coppie editor-*.png dei due label (stesso ordine).');
  await browser.close();
}

main().catch((err) => {
  report.fatal = String(err?.stack || err).slice(0, 800);
  writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.error(err);
  process.exit(1);
});
