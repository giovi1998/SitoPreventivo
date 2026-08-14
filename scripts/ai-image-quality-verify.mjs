/**
 * ai-image-quality-verify.mjs — LIVE verification of the ai-image-quality spec:
 * real Gemini generations via the dev proxy, pixel-density checks on the
 * PERSISTED images, and object-quality checks (font floors, hierarchy,
 * clipping) on the AI-generated logo/card/flyer.
 *
 * NOT part of CI / npm scripts. Manual tool, modeled on
 * scripts/design-review-ai-gen.mjs. Requires dev server on
 * http://localhost:8000 (override with BASE_URL env). Reads
 * VITE_ADMIN_PASSWORD from .env at runtime (never printed).
 *
 *   node scripts/ai-image-quality-verify.mjs            # full run (~8-10 min)
 *   node scripts/ai-image-quality-verify.mjs --endpoints-only  # phase A only (~2 min)
 *
 * Phase A (raw endpoints, no browser): POST /api/ai/card-photo, card-cover,
 * flyer-hero, logo-background → assert mimeType image/jpeg (output default
 * di gemini-3.1-flash-image; nessun output control accettato — probe live
 * 2026-08-07, gotchas §2.5) e source dims 1K (long side ≥1024, tutti gli
 * endpoint — il 2K non si usa: supera il limite risposta Vercel 4.5MB).
 *
 * Phase B (Playwright app flow): login → customer "La Chiccheria" →
 * auto-build → Genera bozze AI (or reuse already-generated docs) → read
 * persisted FLAT docs from localStorage → measure every AI image
 * (naturalWidth/Height) vs its render box → font floors + hierarchy +
 * clipping checks on the rendered previews.
 *
 * Output: e2e/__screenshots__/ai-image-quality/{*.png, report.json}.
 * Exit 0 iff all checks pass, 1 otherwise.
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const SHOTS = path.join(ROOT, 'e2e', '__screenshots__', 'ai-image-quality');
const PROFILE_DIR = path.join(ROOT, 'e2e', '__screenshots__', '.pw-profile');
const ENDPOINTS_ONLY = process.argv.includes('--endpoints-only');
const CUSTOMER_NAME = 'La Chiccheria';
mkdirSync(SHOTS, { recursive: true });

const report = { date: new Date().toISOString(), phaseA: {}, phaseB: { docs: {} }, notes: [], consoleErrors: [] };
const note = (m) => { report.notes.push(m); console.log(`[note] ${m}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Image header parsers (no deps) ────────────────────────────────
function jpegSize(buf) {
  let off = 2;
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) { off++; continue; }
    const marker = buf[off + 1];
    // SOF0-15 except DHT(DAC? no: C4), JPG(C8), DAC(CC)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) };
    }
    off += 2 + buf.readUInt16BE(off + 2);
  }
  return null;
}
function pngSizeBuf(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
function imageSizeFromBase64(b64, mimeType) {
  const buf = Buffer.from(b64, 'base64');
  return mimeType === 'image/png' ? pngSizeBuf(buf) : jpegSize(buf);
}

// ── Phase A: raw endpoint verification ────────────────────────────
const PROMPTS = {
  '/api/ai/card-photo': { prompt: 'Professional portrait photo of an italian pastry chef in a bright artisanal bakery, warm tones' },
  '/api/ai/card-cover': { prompt: 'Abstract elegant background for a patisserie business card, bordeaux and cream tones, soft gradient' },
  '/api/ai/flyer-hero': { prompt: 'Artisanal sardinian pastries on a rustic table, warm inviting light, editorial food photography' },
  '/api/ai/logo-background': { prompt: 'Elegant abstract patisserie emblem background, bordeaux and cream, minimal geometric ornament' },
};
const RAW_MIN = { '/api/ai/card-photo': 1024, '/api/ai/card-cover': 1024, '/api/ai/flyer-hero': 1024, '/api/ai/logo-background': 1024 };

async function phaseA() {
  console.log('=== Phase A: raw endpoints (serial, real Gemini calls) ===');
  let fatal = null;
  for (const [endpoint, body] of Object.entries(PROMPTS)) {
    const name = endpoint.split('/').pop();
    const t0 = Date.now();
    try {
      const res = await fetch(`${BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        report.phaseA[name] = { ok: false, status: res.status, error: (err.error || '').slice(0, 300), elapsedS: +elapsed };
        console.log(`[A] FAIL ${name}: HTTP ${res.status} ${String(err.error).slice(0, 120)} (${elapsed}s)`);
        // Stop rule: Gemini rejecting the request shape (config non
        // accettata, gotchas §2.5) must surface here, not be retried blindly.
        if (res.status === 400 || (res.status === 502 && /image|output|config/i.test(String(err.error)))) {
          fatal = `${name}: HTTP ${res.status} — ${String(err.error).slice(0, 200)}`;
        }
        continue;
      }
      const { data } = await res.json();
      const size = imageSizeFromBase64(data.imageBase64, data.mimeType);
      const bytes = Math.round(data.imageBase64.length * 0.75);
      const longSide = size ? Math.max(size.w, size.h) : 0;
      const minSide = RAW_MIN[endpoint];
      const isJpeg = data.mimeType === 'image/jpeg';
      const ok = isJpeg && longSide >= minSide;
      report.phaseA[name] = { ok, mimeType: data.mimeType, ...size, bytes, minLongSide: minSide, elapsedS: +elapsed };
      console.log(`[A] ${ok ? 'OK  ' : 'FAIL'} ${name}: ${data.mimeType} ${size?.w}x${size?.h} (${Math.round(bytes / 1024)}KB, ${elapsed}s, min ${minSide})`);
    } catch (e) {
      report.phaseA[name] = { ok: false, error: String(e).slice(0, 200) };
      console.log(`[A] FAIL ${name}: ${String(e).slice(0, 120)}`);
    }
    await sleep(2000); // gentle on the 5/min rate limit
  }
  if (fatal) {
    note(`FATAL phase A — possibile rifiuto config Gemini: ${fatal}`);
    return false;
  }
  return Object.values(report.phaseA).every((r) => r.ok);
}

// ── Phase B: app flow via Playwright ──────────────────────────────
const envText = readFileSync(path.join(ROOT, '.env'), 'utf8');
const password = (envText.match(/^VITE_ADMIN_PASSWORD=(.+)$/m)?.[1] || '').trim().replace(/^["']|["']$/g, '');
if (!password) { console.error('VITE_ADMIN_PASSWORD not found in .env'); process.exit(1); }

const step = (name, ok, evidence) => {
  report.phaseB[name] = { ok, evidence };
  console.log(`[B] ${ok ? 'OK  ' : 'FAIL'} ${name} — ${evidence}`);
};

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

async function phaseB() {
  console.log('=== Phase B: app flow (Playwright) ===');
  // Profilo persistente condiviso con design-review-ai-gen.mjs: in IS_LOCAL
  // i dati vivono in localStorage — senza persistenza ogni run parte vuoto
  // (customer "La Chiccheria" mai trovato) e rigenera tutto (doppio costo AI).
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => report.consoleErrors.push(`pageerror: ${String(e).slice(0, 300)}`));

  // Login (solo se il form appare — sessione persistente valida → redirect)
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  const emailField = page.locator('#auth-email');
  if (await emailField.waitFor({ timeout: 10000 }).then(() => true).catch(() => false)) {
    await emailField.fill('admin@gmail.com');
    await page.fill('#auth-password', password);
    await page.click('button.auth-submit');
    await page.waitForURL(/\/app/, { timeout: 15000 }).catch(() => {});
  }
  const loggedIn = !page.url().includes('/login');
  step('login', loggedIn, `url=${page.url()}`);
  if (!loggedIn) { await ctx.close(); return false; }

  // Customer reuse
  await page.goto(`${BASE}/app/customers`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.crm-list, .crm-page', { timeout: 15000 });
  await sleep(1000);
  const card = page.locator('li.crm-card', { hasText: CUSTOMER_NAME }).first();
  if (!(await card.count() > 0)) {
    note(`customer "${CUSTOMER_NAME}" non trovato — esegui prima scripts/design-review-ai-gen.mjs --smoke`);
    step('customer', false, 'missing');
    await ctx.close();
    return false;
  }
  await card.click();
  await page.waitForSelector('[data-testid="crm-detail"]', { timeout: 15000 });
  await sleep(800);
  const customerId = page.url().match(/\/app\/customers\/([^/?]+)/)?.[1] || null;
  step('customer', !!customerId, `id=${customerId}`);

  // Ensure drafts + AI generation (reuse if already done)
  let docIds = await collectDocIds(page);
  const TARGETS = ['logo', 'businessCard', 'flyer'];
  if (!(docIds.logo && docIds.businessCard && docIds.flyer)) {
    await page.click('[data-testid="crm-auto-build-btn"]');
    await sleep(3000);
    const t0 = Date.now();
    while (Date.now() - t0 < 30000) {
      docIds = await collectDocIds(page);
      if (docIds.logo && docIds.businessCard && docIds.flyer) break;
      await sleep(1500);
    }
  }
  step('drafts', !!(docIds.logo && docIds.businessCard && docIds.flyer), JSON.stringify(docIds));

  const genBtn = page.locator('[data-testid="crm-generate-drafts-btn"]');
  // Click solo se ci sono draft pending: il bottone può risultare enabled
  // anche a generazione già avvenuta → click a vuoto + poll infinito su
  // badge che non arriveranno mai (falso FAIL, 2026-08-13).
  const hasPending = await page.evaluate((ids) => {
    const all = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
    return all.some((d) => ids.includes(d.id) && d.autoGeneratePending);
  }, Object.values(docIds));
  const canGenerate = hasPending && (await genBtn.isEnabled().catch(() => false));
  if (canGenerate) {
    await genBtn.click();
    console.log('[B] Genera bozze AI started — polling up to 20 min…');
    await sleep(20000);
    const finalStatus = {};
    const t0 = Date.now();
    while (Date.now() - t0 < 20 * 60 * 1000) {
      let allDone = true;
      for (const type of TARGETS) {
        const txt = await page.locator(`[data-testid="crm-doc-gen-${docIds[type]}"]`).innerText().catch(() => '');
        if (txt.includes('✓')) finalStatus[type] = 'done';
        else if (txt.includes('✗')) finalStatus[type] = 'error';
        else { allDone = false; }
      }
      if (allDone) break;
      await sleep(8000);
    }
    step('generate', TARGETS.every((t) => finalStatus[t] === 'done'), JSON.stringify(finalStatus));
  } else {
    note('Genera bozze AI disabilitato — riuso documenti già generati');
    step('generate', true, 'reused existing generated docs');
  }

  // Read persisted FLAT docs and measure AI images
  const flatDocs = await page.evaluate((ids) => {
    const all = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
    const byId = {};
    for (const d of all) if (ids.includes(d.id)) byId[d.id] = d;
    return byId;
  }, Object.values(docIds));

  // Soglie persistite: generazione 1K uniforme (long side 1024–1408 a
  // seconda dell'aspect ratio) + compressDataUrl cap 1024px (background/hero
  // 1536). Min 1000 separa nettamente l'era 512px senza dipendere dall'aspect.
  const IMG_FIELDS = {
    logo: [['builder.backgroundImage', (d) => d.builder?.backgroundImage, 1000]],
    businessCard: [
      ['front.photoUrl', (d) => d.front?.photoUrl, 1000],
      ['front.coverImageUrl', (d) => d.front?.coverImageUrl, 1000],
    ],
    flyer: [['content.heroImage', (d) => d.content?.heroImage, 1000]],
  };
  for (const type of TARGETS) {
    const d = flatDocs[docIds[type]];
    report.phaseB.docs[type] = { id: docIds[type], images: {}, quality: {} };
    if (!d) { step(`persisted:${type}`, false, 'doc not found'); continue; }
    for (const [field, get, minLong] of IMG_FIELDS[type]) {
      const dataUrl = get(d);
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
        report.phaseB.docs[type].images[field] = { ok: false, note: 'absent or non-data-url' };
        step(`img:${field}`, false, 'absent');
        continue;
      }
      const measured = await page.evaluate(async (du) => {
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = du; });
        return { w: img.naturalWidth, h: img.naturalHeight, mime: du.slice(5, du.indexOf(';')), bytes: Math.round(du.length * 0.75) };
      }, dataUrl);
      const longSide = Math.max(measured.w, measured.h);
      const ok = longSide >= minLong;
      report.phaseB.docs[type].images[field] = { ok, ...measured, minLongSide: minLong };
      step(`img:${field}`, ok, `${measured.mime} ${measured.w}x${measured.h} (${Math.round(measured.bytes / 1024)}KB, min ${minLong})`);
    }
  }

  // ── Object-quality checks on rendered previews ──────────────────
  // Card: hierarchy 22/16/14 logical px (CARD_REF 640×414 = 85mm →
  // 0.3766 pt per logical px; contacts floor 7pt ≈ 18.6px).
  await page.goto(`${BASE}/app/card/${docIds.businessCard}`, { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  const cardQ = await page.evaluate(() => {
    const px = (sel, root = document) => {
      const el = root.querySelector(sel);
      return el ? parseFloat(getComputedStyle(el).fontSize) : null;
    };
    const back = document.querySelector('[data-testid="card-preview-back"]');
    const contacts = back ? [...back.querySelectorAll('.card-back-val')].map((el) => parseFloat(getComputedStyle(el).fontSize)) : [];
    const overflow = [...document.querySelectorAll('.card-grid-cell--text')].filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1).length;
    return { name: px('.card-name'), title: px('.card-title'), company: px('.card-company'), contactsMin: contacts.length ? Math.min(...contacts) : null, textOverflowCells: overflow };
  });
  const cardHierarchy = cardQ.name && cardQ.title && cardQ.company && cardQ.name > cardQ.title && cardQ.title >= cardQ.company && cardQ.name >= 20 && cardQ.company >= 12;
  const cardContactsOk = cardQ.contactsMin == null || cardQ.contactsMin >= 17;
  report.phaseB.docs.businessCard.quality = { ...cardQ, hierarchy: !!cardHierarchy, contactsFloorOk: cardContactsOk };
  step('quality:card', !!(cardHierarchy && cardContactsOk && cardQ.textOverflowCells === 0),
    `name=${cardQ.name} title=${cardQ.title} company=${cardQ.company} contactsMin=${cardQ.contactsMin} overflowCells=${cardQ.textOverflowCells}`);
  await page.locator('[data-testid="card-preview-front"]').screenshot({ path: path.join(SHOTS, 'card-front.png') }).catch(() => {});
  await page.locator('[data-testid="card-preview-back"]').screenshot({ path: path.join(SHOTS, 'card-back.png') }).catch(() => {});

  // Flyer: SVG font-size in mm (viewBox mm) — headline ≥8.4mm (24pt),
  // body ≥3.4mm (10pt). All texts inside the viewBox.
  await page.goto(`${BASE}/app/flyer/${docIds.flyer}`, { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  const flyerQ = await page.evaluate(() => {
    const svg = document.querySelector('[data-flyer-preview] svg');
    if (!svg) return null;
    const vb = svg.viewBox.baseVal;
    const sizes = [];
    let outOfBounds = 0;
    for (const t of svg.querySelectorAll('text')) {
      const fs = parseFloat(t.getAttribute('font-size') || getComputedStyle(t).fontSize);
      if (fs) sizes.push(fs);
      try {
        const bb = t.getBBox();
        if (bb.x < -1 || bb.y < -1 || bb.x + bb.width > vb.width + 1 || bb.y + bb.height > vb.height + 1) outOfBounds++;
      } catch { /* hidden */ }
    }
    return { maxFontMm: sizes.length ? Math.max(...sizes) : null, minFontMm: sizes.length ? Math.min(...sizes) : null, texts: sizes.length, outOfBounds };
  });
  const flyerOk = !!flyerQ && flyerQ.maxFontMm >= 8.4 && flyerQ.minFontMm >= 3.4 && flyerQ.outOfBounds === 0;
  report.phaseB.docs.flyer.quality = { ...flyerQ, floorsOk: flyerOk };
  step('quality:flyer', flyerOk, flyerQ ? `max=${flyerQ.maxFontMm?.toFixed(2)}mm min=${flyerQ.minFontMm?.toFixed(2)}mm texts=${flyerQ.texts} oob=${flyerQ.outOfBounds}` : 'no svg');
  await page.locator('[data-flyer-preview]').first().screenshot({ path: path.join(SHOTS, 'flyer.png') }).catch(() => {});

  // Logo: tagline ≈ 0.42× wordmark font-size; texts inside viewBox.
  await page.goto(`${BASE}/app/logo/${docIds.logo}`, { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  const logoQ = await page.evaluate(() => {
    const svg = document.querySelector('[data-logo-preview] svg');
    if (!svg) return null;
    const sizes = [...svg.querySelectorAll('text')].map((t) => parseFloat(t.getAttribute('font-size') || '0')).filter(Boolean).sort((a, b) => b - a);
    return { wordmark: sizes[0] ?? null, tagline: sizes.length > 1 ? sizes[sizes.length - 1] : null, ratio: sizes.length > 1 ? +(sizes[sizes.length - 1] / sizes[0]).toFixed(3) : null };
  });
  const logoOk = !!logoQ && (logoQ.ratio == null || (logoQ.ratio >= 0.3 && logoQ.ratio <= 0.55));
  report.phaseB.docs.logo.quality = { ...logoQ, ratioOk: logoOk };
  step('quality:logo', logoOk, logoQ ? `wordmark=${logoQ.wordmark} tagline=${logoQ.tagline} ratio=${logoQ.ratio}` : 'no svg');
  await page.locator('[data-logo-preview]').first().screenshot({ path: path.join(SHOTS, 'logo.png') }).catch(() => {});

  await ctx.close();
  return Object.values(report.phaseB).every((v) => typeof v !== 'object' || v.ok !== false);
}

async function main() {
  const aOk = await phaseA();
  if (ENDPOINTS_ONLY) {
    writeFileSync(path.join(SHOTS, 'report.json'), JSON.stringify(report, null, 2));
    process.exit(aOk ? 0 : 1);
  }
  if (!aOk) {
    note('Phase A fallita — Phase B saltata (stop rule, vedi report)');
    writeFileSync(path.join(SHOTS, 'report.json'), JSON.stringify(report, null, 2));
    process.exit(1);
  }
  const bOk = await phaseB().catch((e) => { note(`phaseB fatal: ${String(e).slice(0, 200)}`); return false; });
  report.consoleErrors = [...new Set(report.consoleErrors)].slice(0, 20);
  writeFileSync(path.join(SHOTS, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`\nreport: ${path.join(SHOTS, 'report.json')}`);
  console.log(aOk && bOk ? 'ALL CHECKS PASS' : 'SOME CHECKS FAILED');
  process.exit(aOk && bOk ? 0 : 1);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
