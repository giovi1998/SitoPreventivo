/**
 * design-review-ai-gen.mjs — drive the REAL AI auto-generation for demo customer
 * "La Chiccheria" and capture preview screenshots of the 3 AI-generated documents
 * (logo / businessCard / flyer) for visual design review.
 *
 * NOT part of CI / npm scripts. Manual tool, modeled on scripts/crm-live-test.mjs.
 * Requires dev server on http://localhost:8000 (override with BASE_URL env).
 * Reads VITE_ADMIN_PASSWORD from .env at runtime (never printed).
 *
 *   node scripts/design-review-ai-gen.mjs           # full run (real AI calls, up to ~8 min)
 *   node scripts/design-review-ai-gen.mjs --smoke   # login + ensure customer + brief only, no AI
 *
 * Output: e2e/__screenshots__/design-review/ai/{logo-ai.png,card-ai-front.png,
 * card-ai-back.png,flyer-ai.png,report.json} + export/ (PNG reali scaricati via
 * UI: logo-export.png, card-export-front.png, flyer-export.png) + compare/
 * (contact sheet preview-vs-export: logo-compare.png, card-compare.png,
 * flyer-compare.png). Exit 0 if all 3 docs done AND all exports pass the
 * pixel-density threshold, 1 otherwise.
 *
 * Visual review template (preview vs export, affiancati in compare/):
 * - logo: tagline leggibile (0.42x wordmark), contrasto su backgroundImage,
 *   bordo pulito a 1024px (soglia export w===1024)
 * - card: gerarchia 22/16/14 (nome>ruolo>company), contatti retro leggibili,
 *   coerenza wrap/font preview-export (soglia export w>=1000, h>=600)
 * - flyer: floor stampa headline 24pt/body 10pt, sezioni spaziate,
 *   hero non sfocata (soglia export max-side>=1000)
 *
 * Notes: LOCAL/localStorage mode (IS_LOCAL). Documents use the canonical FLAT shape
 * (gotcha §23): logo → doc.builder.backgroundImage, card → doc.front.photoUrl /
 * doc.front.coverImageUrl, flyer → doc.content.heroImage. Editor routes
 * /app/logo/:docId, /app/card/:docId, /app/flyer/:docId (src/main.tsx).
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const SHOTS = path.join(ROOT, 'e2e', '__screenshots__', 'design-review', 'ai');
const EXPORT_DIR = path.join(SHOTS, 'export');
const COMPARE_DIR = path.join(SHOTS, 'compare');
const PROFILE_DIR = path.join(ROOT, 'e2e', '__screenshots__', '.pw-profile');
const SMOKE = process.argv.includes('--smoke');
const CUSTOMER_NAME = 'La Chiccheria';
mkdirSync(SHOTS, { recursive: true });
mkdirSync(EXPORT_DIR, { recursive: true });
mkdirSync(COMPARE_DIR, { recursive: true });

const BRIEF = {
  businessName: CUSTOMER_NAME,
  ownerName: 'Maria Piras',
  sector: 'Pasticceria e cafè',
  activity: 'Pasticceria artigianale e caffetteria nel cuore di Cagliari. Dolci tradizionali sardi, pasticceria moderna, brunch e caffè specialty.',
  mood: 'elegante e accogliente',
  target: 'famiglie e professionisti 30-60',
  preferredColors: 'bordeaux e crema',
  contacts: {
    address: 'Via Roma 42, Cagliari',
    phone: '+39 070 123 4567',
    email: 'info@lachiccheria.it',
    website: 'https://lachiccheria.it',
  },
};

// Password from .env — never logged.
const envText = readFileSync(path.join(ROOT, '.env'), 'utf8');
const password = (envText.match(/^VITE_ADMIN_PASSWORD=(.+)$/m)?.[1] || '').trim().replace(/^["']|["']$/g, '');
if (!password) { console.error('VITE_ADMIN_PASSWORD not found in .env'); process.exit(1); }

const report = { customer: CUSTOMER_NAME, smoke: SMOKE, steps: [], docs: {}, consoleErrors: [], notes: [],
  reviewTemplate: {
    logo: ['tagline leggibile (0.42x wordmark)', 'contrasto testo su backgroundImage', 'bordo pulito a 1024px'],
    businessCard: ['gerarchia 22/16/14 (nome > ruolo > company)', 'contatti retro leggibili', 'coerenza wrap/font preview vs export'],
    flyer: ['floor stampa headline 24pt / body 10pt', 'sezioni spaziate', 'hero non sfocata (max-side >= 1000)'],
    howTo: 'Apri i contact sheet in compare/ (preview vs export affiancati) e verifica ogni riga del template. La Chiccheria = caso reale AI: bordeaux/crema, settore pasticceria, brief completo.',
  } };
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

// Map doc rows in the CRM detail: documentType → docId (via crm-open-doc-<id> testid).
async function collectDocIds(page) {
  const map = {};
  const rows = page.locator('[data-testid="crm-doc-list"] li.crm-doc-row');
  const n = await rows.count();
  for (let i = 0; i < n; i++) {
    const row = rows.nth(i);
    const type = (await row.locator('.crm-doc-info strong').innerText().catch(() => '')).trim();
    const openId = (await row.locator('[data-testid^="crm-open-doc-"]').getAttribute('data-testid').catch(() => null))?.replace('crm-open-doc-', '');
    if (type && openId) map[type] = openId;
  }
  return map;
}

// Trigger the export menu item (text match) and wait for the download.
async function exportViaMenu(page, ctx, menuBtnLocator, itemText, outPath, timeoutMs = 45000) {
  const downloadP = ctx.waitForEvent('download', { timeout: timeoutMs }).catch(() => null);
  await menuBtnLocator.click();
  await page.getByRole('menuitem', { name: itemText }).first().click().catch(async () => {
    // Fallback: text-based match (mobile menus / plain buttons).
    await page.getByText(itemText, { exact: false }).first().click();
  });
  const dl = await downloadP;
  if (!dl) throw new Error(`no download for "${itemText}"`);
  await dl.saveAs(outPath);
  return outPath;
}

// Measure a PNG on disk without extra deps: parse IHDR width/height.
function pngSize(p) {
  const buf = readFileSync(p);
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// Vertical contact sheet: preview on top, export below, with labels.
// Immagini embed come data URL: `setContent` + src file:// viene bloccato
// da Chromium (about:blank non ha accesso file:) → icone broken image.
async function contactSheet(previewPng, exportPng, outPng, label) {
  const { chromium: c2 } = await import('playwright');
  const b2 = await c2.launch({ headless: true });
  const dataUrl = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
  try {
    const page2 = await b2.newPage({ viewport: { width: 1200, height: 1600 } });
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      body{margin:24px;font-family:system-ui,sans-serif;background:#f5f5f5}
      h1{font-size:18px;margin:8px 0 4px}
      .row{display:flex;gap:16px;align-items:flex-start;background:#fff;border:1px solid #ddd;border-radius:8px;padding:12px;margin-bottom:16px}
      .col{flex:1;text-align:center} .col img{max-width:100%;border:1px solid #eee;background:#fff}
      .cap{font-size:11px;color:#666;margin-top:4px}
    </style></head><body><h1>${label}</h1>
      <div class="row"><div class="col"><img src="${dataUrl(exportPng)}"><div class="cap">EXPORT</div></div>
      <div class="col"><img src="${dataUrl(previewPng)}"><div class="cap">PREVIEW</div></div></div>
    </body></html>`;
    await page2.setContent(html);
    await page2.waitForTimeout(800);
    await page2.screenshot({ path: outPng, fullPage: true });
  } finally {
    await b2.close();
  }
}

// Classify an image field: AI-generated images are data URLs; templates may use remote URLs.
const imgKind = (v) => (typeof v !== 'string' || !v ? null : v.startsWith('data:') ? 'data-url' : /^https?:/.test(v) ? 'remote-url' : 'other');

async function main() {
  // Profilo persistente condiviso con ai-image-quality-verify.mjs: in
  // IS_LOCAL customer/documenti vivono in localStorage → riuso tra run
  // (niente doppia generazione AI).
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => report.consoleErrors.push(`pageerror: ${String(e).slice(0, 300)}`));
  let shotN = 0;
  const shot = async (name) => {
    const p = path.join(SHOTS, `${String(++shotN).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: p, fullPage: false });
    return p;
  };

  // ── Step 1: login (solo se il form appare — con sessione persistente
  // valida /login redirige ad /app e il campo non esiste) ──
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  const emailField = page.locator('#auth-email');
  if (await emailField.waitFor({ timeout: 10000 }).then(() => true).catch(() => false)) {
    await emailField.fill('admin@gmail.com');
    await page.fill('#auth-password', password);
    await page.click('button.auth-submit');
    await page.waitForURL(/\/app/, { timeout: 15000 }).catch(() => {});
  }
  const loggedIn = !page.url().includes('/login');
  step(1, 'Login admin', loggedIn, `url=${page.url()}`);
  if (!loggedIn) { await shot('login-fail'); throw new Error('login failed'); }

  // ── Step 2: customers list, create-or-reuse "La Chiccheria" ────
  await page.goto(`${BASE}/app/customers`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.crm-list, .crm-page', { timeout: 15000 });
  await sleep(1000);
  let card = page.locator('li.crm-card', { hasText: CUSTOMER_NAME }).first();
  let reused = await card.count() > 0;
  if (!reused) {
    await page.click('text=+ Nuovo cliente');
    await page.fill('[data-testid="crm-create-businessname"]', BRIEF.businessName);
    await page.fill('[data-testid="crm-create-ownername"]', BRIEF.ownerName);
    await page.fill('[data-testid="crm-create-sector"]', BRIEF.sector);
    await page.click('[data-testid="crm-create-submit"]');
    card = page.locator('li.crm-card', { hasText: CUSTOMER_NAME }).first();
    await card.waitFor({ timeout: 10000 });
  }
  step(2, 'Customer create/reuse', true, reused ? `reused existing "${CUSTOMER_NAME}"` : 'created new via UI form');
  await card.click();

  // ── Step 3: detail page + brief enrichment ─────────────────────
  await page.waitForSelector('[data-testid="crm-detail"]', { timeout: 15000 });
  await sleep(800);
  const customerId = page.url().match(/\/app\/customers\/([^/?]+)/)?.[1] || null;
  step(3, 'Customer detail open', !!customerId, `id=${customerId}`);

  // Inline edit (same pattern as crm-live-test step 3.5). Textareas commit on blur.
  async function editField(label, testid, value, isTextarea) {
    const field = page.locator(`.crm-field:has(.crm-field-label:text-is("${label}"))`).first();
    await field.locator('.crm-field-value').click();
    const input = page.locator(`[data-testid="${testid}"]`);
    await input.waitFor({ timeout: 5000 });
    await input.fill(value);
    if (isTextarea) await page.locator('[data-testid="crm-detail-title"]').click(); // blur commits
    else await input.press('Enter');
    await sleep(700);
  }
  const EDITS = [
    ['Attività', 'crm-edit-activity', BRIEF.activity, true],
    ['Mood', 'crm-edit-mood', BRIEF.mood, false],
    ['Target', 'crm-edit-target', BRIEF.target, true],
    ['Colori preferiti', 'crm-edit-preferredColors', BRIEF.preferredColors, false],
    ['Email', 'crm-edit-contact_email', BRIEF.contacts.email, false],
    ['Telefono', 'crm-edit-contact_phone', BRIEF.contacts.phone, false],
    ['Indirizzo', 'crm-edit-contact_address', BRIEF.contacts.address, false],
    ['Sito', 'crm-edit-contact_website', BRIEF.contacts.website, false],
  ];
  const detailNow = await page.locator('[data-testid="crm-detail"]').innerText();
  for (const [label, testid, value, isTa] of EDITS) {
    if (detailNow.includes(value.slice(0, 24))) continue; // idempotent: already set
    await editField(label, testid, value, isTa).catch((e) => report.notes.push(`edit ${testid} failed: ${String(e).slice(0, 120)}`));
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="crm-detail"]', { timeout: 15000 });
  await sleep(800);
  let detailText = await page.locator('[data-testid="crm-detail"]').innerText();
  let briefOk = ['Pasticceria artigianale', 'elegante e accogliente', 'bordeaux e crema', 'lachiccheria.it', 'Via Roma 42'].every((s) => detailText.includes(s));

  // Fallback: seed brief directly in localStorage pq_customers:v1, then reload.
  if (!briefOk) {
    report.notes.push('UI brief edit incomplete — falling back to localStorage patch');
    await page.evaluate(({ id, name, brief }) => {
      const KEY = 'pq_customers:v1';
      const all = JSON.parse(localStorage.getItem(KEY) || '[]');
      const c = all.find((x) => x.id === id) || all.find((x) => x.businessName === name);
      if (c) {
        Object.assign(c, {
          ownerName: brief.ownerName, sector: brief.sector, activity: brief.activity,
          mood: brief.mood, target: brief.target, preferredColors: brief.preferredColors,
          contacts: { ...(c.contacts || {}), ...brief.contacts },
          updatedAt: new Date().toISOString(),
        });
        localStorage.setItem(KEY, JSON.stringify(all));
      }
    }, { id: customerId, name: CUSTOMER_NAME, brief: BRIEF });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="crm-detail"]', { timeout: 15000 });
    await sleep(800);
    detailText = await page.locator('[data-testid="crm-detail"]').innerText();
    briefOk = ['Pasticceria artigianale', 'bordeaux e crema', 'lachiccheria.it'].every((s) => detailText.includes(s));
  }
  step(3.5, 'Brief fields set', briefOk, briefOk ? 'persisted after reload' : 'missing after reload (+localStorage fallback)');
  await shot('customer-brief');

  if (SMOKE) {
    console.log('\n--smoke: stopping before auto-build / AI generation.');
    await browser.close();
    report.consoleErrors = [...new Set(report.consoleErrors)].slice(0, 20);
    console.log(JSON.stringify({ steps: report.steps, consoleErrors: report.consoleErrors, notes: report.notes }, null, 2));
    const ok = report.steps.every((s) => s.ok);
    process.exit(ok ? 0 : 1);
  }

  // ── Step 4: auto-build drafts (logo/card/flyer/website, zero AI) ─
  await page.click('[data-testid="crm-auto-build-btn"]');
  const ab = await waitForLog(page, /Auto-build: draft creati|Auto-build.*fallit/, 120000);
  step(4.1, 'Auto-build draft', /draft creati/.test(ab.text), ab.matched ? 'ok' : `log tail: ${ab.text.slice(-200)}`);
  await sleep(1000);
  // Wait for the 3 target draft rows to appear.
  let docIds = {};
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      docIds = await collectDocIds(page);
      if (docIds.logo && docIds.businessCard && docIds.flyer) break;
      await sleep(1500);
    }
  }
  const draftsOk = !!(docIds.logo && docIds.businessCard && docIds.flyer);
  step(4.2, 'Draft docs present (logo/card/flyer)', draftsOk, JSON.stringify(docIds));
  await shot('auto-build-docs');
  if (!draftsOk) throw new Error('auto-build did not produce the 3 target drafts');

  // ── Step 5: Genera bozze AI (real AI calls, up to 8 min) ───────
  const genBtn = page.locator('[data-testid="crm-generate-drafts-btn"]');
  if (!(await genBtn.isEnabled().catch(() => false))) {
    step(5, 'Genera bozze AI', false, 'button disabled (no pending drafts)');
    throw new Error('generate-drafts button disabled');
  }
  await genBtn.click();
  console.log('[step 5] Genera bozze AI started — polling badges up to 20 min…');
  await sleep(20000);
  const TARGETS = ['logo', 'businessCard', 'flyer'];
  const finalStatus = {};
  const t0 = Date.now();
  let lastShot = 0;
  while (Date.now() - t0 < 20 * 60 * 1000) {
    let allDone = true;
    for (const type of TARGETS) {
      const id = docIds[type];
      const txt = await page.locator(`[data-testid="crm-doc-gen-${id}"]`).innerText().catch(() => '');
      if (txt.includes('✓')) finalStatus[type] = 'done';
      else if (txt.includes('✗')) finalStatus[type] = 'error';
      else { finalStatus[type] = txt ? 'running' : 'unknown'; allDone = false; }
    }
    if (allDone) break;
    if (Date.now() - lastShot > 90000) { await shot('ai-gen-progress'); lastShot = Date.now(); }
    await sleep(8000);
  }
  // Per-doc error messages from the badge title attribute.
  for (const type of TARGETS) {
    const id = docIds[type];
    const errTitle = await page.locator(`[data-testid="crm-doc-gen-${id}"]`).getAttribute('title').catch(() => null);
    report.docs[type] = { id, status: finalStatus[type] || 'timeout', ...(errTitle ? { error: errTitle } : {}) };
  }
  const logTxt = await page.locator('[data-testid="crm-ai-log"]').innerText().catch(() => '');
  report.notes.push(`ai-gen error lines: ${logTxt.split('\n').filter((l) => /✗|errore|fallit/i.test(l)).slice(0, 5).join(' | ') || 'none'}`);
  step(5, 'Genera bozze AI', TARGETS.every((t) => finalStatus[t] === 'done'), JSON.stringify(finalStatus));
  await shot('ai-gen-final');

  // ── Step 6: editor screenshots of generated previews ──────────
  const ROUTES = { logo: 'logo', businessCard: 'card', flyer: 'flyer' };
  const EXPORT_ITEMS = {
    // type → [menu button locator, item text, output name, minSize {w,h}]
    // logo: PNG 1024 → width 1024, height = aspect del viewBox (i layout
    // orizzontali NON sono quadrati, es. 1024×410) → min solo su width.
    logo: [page.locator('.action-bar__btn--secondary'), 'PNG 1024', 'logo-export.png', { w: 1024, h: 1 }],
    businessCard: [page.locator('.card-export-menu button').first(), 'PNG fronte (300 DPI)', 'card-export-front.png', { w: 1000, h: 600 }],
    flyer: [page.locator('.flyer-editor-shell button').filter({ hasText: 'PNG' }).first(), 'PNG', 'flyer-export.png', { w: 1000, h: 600 }],
  };
  for (const type of TARGETS) {
    const id = docIds[type];
    await page.goto(`${BASE}/app/${ROUTES[type]}/${id}`, { waitUntil: 'domcontentloaded' });
    await sleep(5000); // editor hydrate + preview render
    let ok = false;
    if (type === 'logo') {
      const el = page.locator('[data-logo-preview]').first();
      ok = await el.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
      if (ok) await el.screenshot({ path: path.join(SHOTS, 'logo-ai.png') });
      step(6.1, 'Screenshot logo-ai.png', ok, `url=${page.url()}`);
    } else if (type === 'businessCard') {
      const front = page.locator('[data-testid="card-preview-front"]').first();
      const okF = await front.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
      if (okF) await front.screenshot({ path: path.join(SHOTS, 'card-ai-front.png') });
      const back = page.locator('[data-testid="card-preview-back"]').first();
      const okB = await back.isVisible().catch(() => false);
      if (okB) await back.screenshot({ path: path.join(SHOTS, 'card-ai-back.png') });
      step(6.2, 'Screenshot card-ai-front/back.png', okF, `front=${okF} back=${okB} url=${page.url()}`);
      ok = okF;
    } else if (type === 'flyer') {
      const el = page.locator('[data-flyer-preview]').first();
      ok = await el.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
      if (ok) await el.screenshot({ path: path.join(SHOTS, 'flyer-ai.png') });
      step(6.3, 'Screenshot flyer-ai.png', ok, `url=${page.url()}`);
    }

    // ── Step 6.5: real export via UI + pixel-density check ──────
    if (!ok) { step(6.5, `Export real ${type}`, false, 'preview not rendered — export skipped'); continue; }
    const [menuLocator, itemText, outName, min] = EXPORT_ITEMS[type];
    try {
      const outPath = path.join(EXPORT_DIR, outName);
      await exportViaMenu(page, ctx, menuLocator, itemText, outPath);
      const size = pngSize(outPath);
      const pass = size && size.w >= min.w && size.h >= min.h;
      report.docs[type].export = { path: outName, ...size, minRequired: min, pass: !!pass };
      step(6.5, `Export real ${type}`, !!pass,
        pass ? `${outName} ${size.w}x${size.h} (min ${min.w}x${min.h})` : `${outName} ${size?.w}x${size?.h} BELOW ${min.w}x${min.h}`);
      const previewPng = type === 'logo' ? path.join(SHOTS, 'logo-ai.png')
        : type === 'businessCard' ? path.join(SHOTS, 'card-ai-front.png')
        : path.join(SHOTS, 'flyer-ai.png');
      const cmp = path.join(COMPARE_DIR, `${type}-compare.png`);
      await contactSheet(previewPng, outPath, cmp, `${type} — preview vs export`);
      report.docs[type].compareSheet = cmp;
    } catch (e) {
      report.docs[type].export = { error: String(e).slice(0, 200) };
      step(6.5, `Export real ${type}`, false, String(e).slice(0, 120));
    }
  }

  // ── Step 7: report.json (AI image presence from FLAT local docs) ─
  await page.goto(`${BASE}/app/customers/${customerId}`, { waitUntil: 'domcontentloaded' });
  await sleep(1000);
  const flatDocs = await page.evaluate((ids) => {
    const all = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
    const byId = {};
    for (const d of all) if (ids.includes(d.id)) byId[d.id] = d;
    return byId;
  }, Object.values(docIds));
  for (const type of TARGETS) {
    const d = flatDocs[docIds[type]];
    if (!d) { report.docs[type].aiImages = { note: 'doc not found in localStorage' }; continue; }
    if (type === 'logo') report.docs[type].aiImages = { backgroundImage: imgKind(d.builder?.backgroundImage) };
    if (type === 'businessCard') report.docs[type].aiImages = { photoUrl: imgKind(d.front?.photoUrl), coverImageUrl: imgKind(d.front?.coverImageUrl) };
    if (type === 'flyer') report.docs[type].aiImages = { heroImage: imgKind(d.content?.heroImage) };
  }
  report.consoleErrors = [...new Set(report.consoleErrors)].slice(0, 20);
  writeFileSync(path.join(SHOTS, 'report.json'), JSON.stringify(report, null, 2));
  step(7, 'report.json written', true, path.join(SHOTS, 'report.json'));

  await ctx.close();
  console.log('\n===== REPORT =====');
  console.log(JSON.stringify(report.docs, null, 2));
  const allDone = TARGETS.every((t) => report.docs[t]?.status === 'done');
  const allExports = TARGETS.every((t) => report.docs[t]?.export?.pass === true);
  console.log(allDone ? 'ALL 3 DOCS DONE' : 'SOME DOCS NOT DONE');
  console.log(allExports ? 'ALL 3 EXPORTS PASS PIXEL CHECK' : 'SOME EXPORTS BELOW PIXEL THRESHOLD');
  process.exit(allDone && allExports ? 0 : 1);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
