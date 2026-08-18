import { test, expect, type Page } from '@playwright/test';
import { seedAuth, loginAsTestUser } from './helpers/cardHarness';
import { testUser, sampleFlyer, giovanniTemplate } from './fixtures';

/**
 * Guardia anti-regressione permanente (to-be-done #2, wayfinder
 * qualita-oggetti-map): le soglie asset/tipografiche di card/flyer/logo
 * dello script manuale `scripts/ai-image-quality-verify.mjs` (Phase B)
 * come test Playwright in CI. Zero chiamate AI: documenti fixture seedati
 * in localStorage (shape FLAT, gotcha §23), immagini JPEG 1280×960
 * generate via canvas (sopra la soglia 1000px — separa l'era 512/768px).
 */

const MIN_LONG_SIDE = 1000;

/** JPEG 1280×960 via canvas (gradiente, sopra soglia 1000 long side). */
function makeFixtureImage(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 960;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 1280, 960);
    grad.addColorStop(0, '#7f1d1d');
    grad.addColorStop(1, '#fef3c7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1280, 960);
    return canvas.toDataURL('image/jpeg', 0.85);
  });
}

/** Long side dell'immagine referenziata da un elemento <img>/<image>. */
async function intrinsicLongSide(page: Page, dataUrl: string): Promise<number> {
  return page.evaluate(async (du) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = du; });
    return Math.max(img.naturalWidth, img.naturalHeight);
  }, dataUrl);
}

function seedDocument(page: Page, doc: Record<string, unknown>): Promise<void> {
  return page.evaluate(({ d, email }) => {
    const existing = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
    const idx = existing.findIndex((x: any) => x.id === (d as any).id);
    const withUser = { ...d, userEmail: email };
    if (idx >= 0) existing[idx] = withUser;
    else existing.push(withUser);
    localStorage.setItem('precisionQuote_documents:v1', JSON.stringify(existing));
  }, { d: doc, email: testUser.email });
}

test.describe('AI image quality guard (soglie asset in CI)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('card preview: gerarchia 22/16/14, floor contatti, zero overflow', async ({ page }) => {
    // Seed fixture giovanniTemplate (layout 'centered' → fronte deriva
    // gridPresetCentered con company) + back in grid mode con services h:2
    // come nel template reale (createGiovanniCardTemplate): senza
    // back.useGrid=true la preview ignora backGrid e deriva il preset
    // default (services h:1) che non contiene label + 3 voci.
    const docId = 'card_quality_guard';
    await seedDocument(page, {
      ...giovanniTemplate,
      id: docId,
      back: { ...giovanniTemplate.back, useGrid: true },
      backGrid: {
        cols: 4,
        rows: 4,
        elements: {
          contacts: { x: 0, y: 0, w: 2, h: 1, alignH: 'left', alignV: 'top' },
          services: { x: 0, y: 1, w: 2, h: 2, alignH: 'left', alignV: 'center' },
          socials: { x: 0, y: 3, w: 2, h: 1, alignH: 'left', alignV: 'center' },
          qr: { x: 2, y: 0, w: 2, h: 4, alignH: 'center', alignV: 'center' },
        },
      },
    });
    await page.goto(`/app/card/${docId}`);
    await page.waitForSelector('[data-testid="card-preview-front"]', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const q = await page.evaluate(() => {
      const px = (sel: string, root: ParentNode = document) => {
        const el = root.querySelector(sel);
        return el ? parseFloat(getComputedStyle(el).fontSize) : null;
      };
      const back = document.querySelector('[data-testid="card-preview-back"]');
      const contacts = back
        ? [...back.querySelectorAll('.card-back-val')].map((el) => parseFloat(getComputedStyle(el).fontSize))
        : [];
      const overflowEls = [...document.querySelectorAll('.card-grid-cell--text')]
        .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
        .map((el) => `${el.getAttribute('data-testid')}: "${el.textContent?.slice(0, 40)}" sw=${el.scrollWidth} cw=${el.clientWidth} sh=${el.scrollHeight} ch=${el.clientHeight}`);
      return {
        name: px('.card-name'),
        title: px('.card-title'),
        company: px('.card-company'),
        contactsMin: contacts.length ? Math.min(...contacts) : null,
        textOverflowCells: overflowEls.length,
        overflowDetail: overflowEls.join(' | '),
      };
    });

    expect(q.name, 'card name font presente').not.toBeNull();
    expect(q.title, 'card title font presente').not.toBeNull();
    expect(q.company, 'card company font presente').not.toBeNull();
    expect(q.name!, 'gerarchia: name > title').toBeGreaterThan(q.title!);
    expect(q.title!, 'gerarchia: title >= company').toBeGreaterThanOrEqual(q.company!);
    expect(q.name!, 'floor name 20px').toBeGreaterThanOrEqual(20);
    expect(q.company!, 'floor company 12px').toBeGreaterThanOrEqual(12);
    if (q.contactsMin != null) {
      expect(q.contactsMin, 'floor contatti retro 17px (~7pt stampa)').toBeGreaterThanOrEqual(17);
    }
    expect(q.textOverflowCells, `zero celle testo in overflow (${q.overflowDetail})`).toBe(0);
  });

  test('flyer preview: floor font in mm (headline 24pt / body 10pt), zero testi fuori viewBox', async ({ page }) => {
    const docId = 'flyer_quality_guard';
    await seedDocument(page, { ...sampleFlyer, id: docId });
    await page.goto(`/app/flyer/${docId}`);
    await page.waitForSelector('[data-flyer-preview] svg', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const q = await page.evaluate(() => {
      const svg = document.querySelector('[data-flyer-preview] svg');
      if (!svg) return null;
      const vb = (svg as SVGSVGElement).viewBox.baseVal;
      const sizes: number[] = [];
      let outOfBounds = 0;
      for (const t of svg.querySelectorAll('text')) {
        // qrLabel è fine print by design (5-7pt, layoutEngine minFontSizePt:5):
        // esente dal floor body 10pt. Escluso via clip-path dedicato.
        const isQrLabel = (t.getAttribute('clip-path') || '').includes('clip-qrLabel');
        const fs = parseFloat(t.getAttribute('font-size') || getComputedStyle(t).fontSize);
        if (fs && !isQrLabel) sizes.push(fs);
        try {
          const bb = (t as SVGGraphicsElement).getBBox();
          if (bb.x < -1 || bb.y < -1 || bb.x + bb.width > vb.width + 1 || bb.y + bb.height > vb.height + 1) outOfBounds++;
        } catch { /* hidden */ }
      }
      return {
        maxFontMm: sizes.length ? Math.max(...sizes) : null,
        minFontMm: sizes.length ? Math.min(...sizes) : null,
        texts: sizes.length,
        outOfBounds,
      };
    });

    expect(q, 'flyer SVG preview presente').not.toBeNull();
    expect(q!.texts, 'flyer ha testi').toBeGreaterThan(0);
    expect(q!.maxFontMm!, 'headline >= 8.4mm (24pt)').toBeGreaterThanOrEqual(8.4);
    expect(q!.minFontMm!, 'body >= 3.4mm (10pt)').toBeGreaterThanOrEqual(3.4);
    expect(q!.outOfBounds, 'zero testi fuori viewBox').toBe(0);
  });

  test('logo preview: tagline 0.30-0.55× wordmark, testi dentro viewBox', async ({ page }) => {
    const docId = 'logo_quality_guard';
    await seedDocument(page, {
      id: docId,
      documentType: 'logo',
      title: 'Logo Guard',
      source: 'builder',
      builder: {
        primaryText: 'La Chiccheria',
        tagline: 'Pasticceria artigianale',
        iconType: 'none',
        iconGlyph: '',
        iconShape: 'circle',
        primaryColor: '#7f1d1d',
        secondaryColor: '#1a1a2e',
        fontFamily: 'Inter',
        layout: 'horizontal',
        icons: [],
        backgroundImage: null,
        backgroundColor: null,
        gradientFill: false,
        decorativeElements: [],
        imagePrompt: null,
        textBackdrop: 'none',
        textColorMode: 'auto',
        textOffsetX: 0,
        textOffsetY: 0,
        textScale: 1,
        taglineOffsetX: 0,
        taglineOffsetY: 0,
        textPosition: 'overlay',
      },
      brief: '',
      concepts: [],
      selected: -1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await page.goto(`/app/logo/${docId}`);
    await page.waitForSelector('[data-logo-preview] svg', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const q = await page.evaluate(() => {
      const svg = document.querySelector('[data-logo-preview] svg');
      if (!svg) return null;
      const texts = [...svg.querySelectorAll('text')];
      const sizes = texts
        .map((t) => parseFloat(t.getAttribute('font-size') || '0'))
        .filter(Boolean)
        .sort((a, b) => b - a);
      const vb = (svg as SVGSVGElement).viewBox.baseVal;
      let outOfBounds = 0;
      for (const t of texts) {
        try {
          const bb = (t as SVGGraphicsElement).getBBox();
          if (bb.x < -1 || bb.y < -1 || bb.x + bb.width > vb.width + 1 || bb.y + bb.height > vb.height + 1) outOfBounds++;
        } catch { /* hidden */ }
      }
      return {
        wordmark: sizes[0] ?? null,
        tagline: sizes.length > 1 ? sizes[sizes.length - 1] : null,
        ratio: sizes.length > 1 ? +(sizes[sizes.length - 1] / sizes[0]).toFixed(3) : null,
        outOfBounds,
      };
    });

    expect(q, 'logo SVG preview presente').not.toBeNull();
    expect(q!.wordmark, 'wordmark presente').not.toBeNull();
    expect(q!.tagline, 'tagline presente').not.toBeNull();
    expect(q!.ratio!, 'tagline 0.30-0.55× wordmark (§27.2)').toBeGreaterThanOrEqual(0.3);
    expect(q!.ratio!, 'tagline 0.30-0.55× wordmark (§27.2)').toBeLessThanOrEqual(0.55);
    expect(q!.outOfBounds, 'zero testi fuori viewBox').toBe(0);
  });

  test('immagini persistite non degradate: card photo/flyer hero/logo background >= 1000px long side', async ({ page }) => {
    const img = await makeFixtureImage(page);

    // Card con foto 1280px — la preview deve renderizzare l'originale, non
    // una versione declassata (regressione "immagini pixelate" §2.5).
    const cardId = 'card_img_guard';
    await seedDocument(page, {
      id: cardId,
      documentType: 'businessCard',
      title: 'Card Img Guard',
      front: { name: 'Mario Rossi', title: 'Dev', company: 'Acme', photoUrl: img, logoUrl: null, coverImageUrl: img, logoBackground: 'none', layout: 'left', useGrid: true },
      back: { phone: '+39 012 3456', email: 'mario@example.com', website: '', address: '', vatNumber: '', services: [], servicesLabel: 'Servizi', socials: [], qrPayload: '', qrLabel: '', qrSize: 'medium', coverImageUrl: null, useGrid: false },
      style: { sizePreset: 'eu-85x55', bgColor: '#FFFFFF', textColor: '#1a1a2e', accentColor: '#01696F', fontFamily: 'Inter', borderStyle: 'accent-strip-left', fontScale: 1 },
    });
    await page.goto(`/app/card/${cardId}`);
    await page.waitForSelector('[data-testid="card-preview-front"]', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const cardImg = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="card-preview-front"] img');
      return el ? (el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src : null;
    });
    expect(cardImg, 'card preview contiene la foto').toBeTruthy();
    expect(await intrinsicLongSide(page, cardImg!), 'card photo >= 1000px long side').toBeGreaterThanOrEqual(MIN_LONG_SIDE);

    // Flyer con hero 1280px.
    const flyerId = 'flyer_img_guard';
    await seedDocument(page, {
      ...sampleFlyer,
      id: flyerId,
      content: { ...sampleFlyer.content, heroImage: img },
    });
    await page.goto(`/app/flyer/${flyerId}`);
    await page.waitForSelector('[data-flyer-preview] svg', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const heroHref = await page.evaluate(() => {
      const el = document.querySelector('[data-flyer-preview] svg image');
      return el?.getAttribute('href') || el?.getAttribute('xlink:href') || null;
    });
    expect(heroHref, 'flyer preview contiene hero').toBeTruthy();
    expect(await intrinsicLongSide(page, heroHref!), 'flyer hero >= 1000px long side').toBeGreaterThanOrEqual(MIN_LONG_SIDE);

    // Logo con background 1280px.
    const logoId = 'logo_img_guard';
    await seedDocument(page, {
      id: logoId,
      documentType: 'logo',
      title: 'Logo Img Guard',
      source: 'builder',
      builder: {
        primaryText: 'La Chiccheria',
        tagline: 'Pasticceria',
        iconType: 'none',
        iconGlyph: '',
        iconShape: 'circle',
        primaryColor: '#FFFFFF',
        secondaryColor: '#1a1a2e',
        fontFamily: 'Inter',
        layout: 'horizontal',
        icons: [],
        backgroundImage: img,
        backgroundColor: null,
        gradientFill: false,
        decorativeElements: [],
        imagePrompt: null,
        textBackdrop: 'pill',
        textColorMode: 'auto',
        textOffsetX: 0,
        textOffsetY: 0,
        textScale: 1,
        taglineOffsetX: 0,
        taglineOffsetY: 0,
        textPosition: 'overlay',
      },
      brief: '',
      concepts: [],
      selected: -1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await page.goto(`/app/logo/${logoId}`);
    await page.waitForSelector('[data-logo-preview] svg', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const logoHref = await page.evaluate(() => {
      const el = document.querySelector('[data-logo-preview] svg image');
      return el?.getAttribute('href') || el?.getAttribute('xlink:href') || null;
    });
    expect(logoHref, 'logo preview contiene background').toBeTruthy();
    expect(await intrinsicLongSide(page, logoHref!), 'logo background >= 1000px long side').toBeGreaterThanOrEqual(MIN_LONG_SIDE);
  });
});
