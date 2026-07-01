// Screenshot test ISOLATO per tutti i 16 template del volantino.
// Renderizza ogni combinazione settore×layout in una pagina HTML
// statica usando buildFlyerSvg (single source of truth per il layout).
import { chromium } from 'playwright';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SECTORS = ['ristorante', 'evento', 'salone', 'negozio'];
const LAYOUTS = ['classic', 'centered', 'split', 'magazine'];
const OUT_DIR = join(process.cwd(), 'screenshots', 'flyer-templates');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// Importa il builder e i template via tsx (Vite li transpila)
const flyerMod = await import('../src/utils/flyerGenerator.ts');
const schemasMod = await import('../src/utils/documentSchemas.ts');

const { buildFlyerSvg } = flyerMod;
const { createFlyerTemplate } = schemasMod;

const items = [];

for (const sector of SECTORS) {
  for (const layout of LAYOUTS) {
    const tpl = createFlyerTemplate(sector);
    tpl.style.layout = layout;
    tpl.size = 'A5';
    tpl.orientation = 'portrait';
    const svg = buildFlyerSvg(tpl);
    items.push({ sector, layout, svg, format: 'A5-portrait' });
  }
}

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  body { font-family: 'Inter', system-ui, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 30px; }
  .item { background: white; padding: 16px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  .label { font-weight: 700; font-size: 14px; margin-bottom: 8px; color: #333; }
  .sublabel { font-size: 12px; color: #666; margin-bottom: 8px; }
  .preview-wrap { display: flex; justify-content: center; align-items: center; }
  .preview-wrap svg { max-width: 100%; height: auto; box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
  /* Force Inter in the SVG so the test matches production rendering */
  .preview-wrap svg text { font-family: 'Inter', system-ui, sans-serif !important; }
</style>
</head><body>
<h1 style="text-align:center">Flyer Templates — ${items.length} combinazioni</h1>
<div class="grid">
${items.map((it) => `
  <div class="item" id="item-${it.sector}-${it.layout}">
    <div class="label">${it.sector.toUpperCase()} · ${it.layout.toUpperCase()}</div>
    <div class="sublabel">${it.format}</div>
    <div class="preview-wrap">${it.svg}</div>
  </div>
`).join('\n')}
</div>
</body></html>`;

const htmlPath = join(OUT_DIR, '_index.html');
writeFileSync(htmlPath, html, 'utf-8');
console.log(`Wrote ${htmlPath} (${items.length} templates)`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1400, height: 1800 }, deviceScaleFactor: 2 });
const page = await context.newPage();
await page.goto(pathToFileURL(htmlPath).href);
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(1000);

for (const it of items) {
  const el = page.locator(`#item-${it.sector}-${it.layout}`);
  const file = join(OUT_DIR, `${it.sector}-${it.layout}.png`);
  await el.screenshot({ path: file });
  console.log(`  saved: ${file}`);
}

await page.screenshot({ path: join(OUT_DIR, '_all.png'), fullPage: true });
await browser.close();
console.log(`\nDone. ${items.length} screenshots in ${OUT_DIR}`);
