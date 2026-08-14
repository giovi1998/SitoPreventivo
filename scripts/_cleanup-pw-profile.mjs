// One-shot cleanup: rimuove i documenti draft del customer demo dal
// profilo Playwright persistente (accumulati dai run pre-fix).
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROFILE_DIR = path.join(ROOT, 'e2e', '__screenshots__', '.pw-profile');
const CUSTOMER_ID = process.argv[2] || '';

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://localhost:8000/app', { waitUntil: 'domcontentloaded' });
const res = await page.evaluate((cid) => {
  const all = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
  const keep = cid ? all.filter((d) => d.customerId !== cid) : all.filter((d) => !d.data?.autoGeneratePending);
  localStorage.setItem('precisionQuote_documents:v1', JSON.stringify(keep));
  return { before: all.length, after: keep.length };
}, CUSTOMER_ID);
console.log(`docs: ${res.before} → ${res.after} (rimossi ${res.before - res.after})`);
await ctx.close();
