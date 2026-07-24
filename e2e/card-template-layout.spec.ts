import { test, expect, type Page } from '@playwright/test';
import {
  loginAsTestUser,
  fillSampleCard,
  selectGridSide,
  addSocials,
  addServices,
  setGridOn,
  saveCardSideScreenshot,
  assertScreenshotNotMostlyBlack,
  exportCard,
  parseCardSvg,
  getTextBounds,
  assertInside,
  type ParsedCardSvg,
} from './helpers/cardHarness';

const TEST_USER_EMAIL = 'test@example.com';
const DOC_ID = 'card_e2e_template_layout_v2';

// 1×1 red PNG data URI — tiny, self-contained, resolves synchronously during export.
const PHOTO_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const RIGHT_BALANCED_GRID = {
  cols: 4,
  rows: 4,
  elements: {
    name: { x: 0, y: 0, w: 4, h: 1, alignH: 'left', alignV: 'center' },
    photo: { x: 2, y: 1, w: 2, h: 2, alignH: 'center', alignV: 'center' },
    title: { x: 0, y: 1, w: 2, h: 1, alignH: 'left', alignV: 'center' },
    company: { x: 0, y: 2, w: 2, h: 1, alignH: 'left', alignV: 'center' },
    logo: { x: 0, y: 3, w: 1, h: 1, alignH: 'left', alignV: 'center' },
  },
};

const BACK_BALANCED_GRID = {
  cols: 4,
  rows: 4,
  elements: {
    contacts: { x: 0, y: 0, w: 2, h: 2, alignH: 'left', alignV: 'top' },
    services: { x: 0, y: 2, w: 2, h: 1, alignH: 'left', alignV: 'top' },
    socials: { x: 0, y: 3, w: 2, h: 1, alignH: 'left', alignV: 'top' },
    qr: { x: 2, y: 0, w: 2, h: 3, alignH: 'center', alignV: 'center' },
  },
};

function seedRightBalancedDocument(page: Page): Promise<void> {
  return page.evaluate(
    ({ email, docId, photoUrl, grid, backGrid }) => {
      const now = new Date().toISOString();
      const doc = {
        id: docId,
        documentType: 'businessCard',
        userEmail: email,
        title: 'Template Layout E2E',
        front: {
          name: '',
          title: '',
          company: '',
          photoUrl,
          logoUrl: null,
          coverImageUrl: null,
          logoBackground: 'none',
          layout: 'right-balanced',
          useGrid: true,
        },
        back: {
          phone: '',
          email: '',
          website: '',
          address: '',
          vatNumber: '',
          services: [],
          servicesLabel: 'Servizi',
          socials: [],
          qrPayload: '',
          qrLabel: '',
          qrSize: 'medium',
          coverImageUrl: null,
          useGrid: true,
        },
        style: {
          sizePreset: 'eu-85x55',
          bgColor: '#FFFFFF',
          textColor: '#1a1a2e',
          accentColor: '#01696F',
          fontFamily: 'Inter',
          borderStyle: 'accent-strip-left',
          fontScale: 1,
        },
        grid,
        backGrid,
        createdAt: now,
        updatedAt: now,
      };
      const existing = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
      const idx = existing.findIndex((d: any) => d.id === docId);
      if (idx >= 0) existing[idx] = doc;
      else existing.push(doc);
      localStorage.setItem('precisionQuote_documents:v1', JSON.stringify(existing));
    },
    {
      email: TEST_USER_EMAIL,
      docId: DOC_ID,
      photoUrl: PHOTO_DATA_URL,
      grid: RIGHT_BALANCED_GRID,
      backGrid: BACK_BALANCED_GRID,
    },
  );
}

interface TextBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function boundsByText(
  parsed: ParsedCardSvg,
  include: (t: ParsedCardSvg['texts'][number]) => boolean,
  lineHeightFactor = 1.2,
): TextBounds {
  const matches = parsed.texts.filter(include);
  expect(matches.length, 'expected at least one text element').toBeGreaterThan(0);
  const minX = Math.min(...matches.map((t) => t.x));
  const minY = Math.min(...matches.map((t) => t.y));
  const maxX = Math.max(...matches.map((t) => t.x + t.fontSize * 0.5));
  const maxY = Math.max(...matches.map((t) => t.y + t.fontSize * lineHeightFactor));
  return { minX, minY, maxX, maxY };
}

test.use({ viewport: { width: 1280, height: 720 } });

test.describe('card template layout v2 — right-balanced', () => {
  test('front layout, font sizes, and back collapse/overlap invariants', async ({ page }) => {
    // ── Setup ────────────────────────────────────────────────────────────────
    await loginAsTestUser(page);
    await seedRightBalancedDocument(page);
    await page.goto(`/app/card/${DOC_ID}`);
    await page.waitForSelector('[data-testid="card-preview-front"]', { timeout: 10000 });
    await page.waitForTimeout(600);
    await fillSampleCard(page);
    await page.waitForTimeout(400);
    await setGridOn(page, true);

    // ── Caso A — fronte ──────────────────────────────────────────────────────
    const frontBuffer = await saveCardSideScreenshot(
      page,
      'card-preview-front',
      'card-template-front-v2.png',
    );
    await assertScreenshotNotMostlyBlack(page, frontBuffer, 'fronte right-balanced');

    const frontExport = await exportCard(page, 'svg-front');
    const frontSvg = frontExport.buffer.toString('utf-8');
    const frontParsed = parseCardSvg(frontSvg);

    expect(frontParsed.width, 'SVG export width').toBe(1700);
    expect(frontParsed.height, 'SVG export height').toBe(1100);

    const nameBounds = getTextBounds(frontParsed, 'MARIO ROSSI');
    const titleBounds = getTextBounds(frontParsed, 'Web Developer');
    expect(nameBounds, 'name text found in front SVG').not.toBeNull();
    expect(titleBounds, 'title text found in front SVG').not.toBeNull();
    expect(nameBounds!.fontSize, 'name font-size >= title font-size').toBeGreaterThanOrEqual(
      titleBounds!.fontSize,
    );

    // Foto a destra e larga circa metà card.
    const photo =
      frontParsed.images.find((img) => img.href.startsWith('data:image')) ?? frontParsed.images[0];
    expect(photo, 'photo image found in front SVG').toBeDefined();
    expect(photo!.x, 'photo x >= card midline').toBeGreaterThanOrEqual(frontParsed.width / 2);
    expect(photo!.width, 'photo width ~ half card').toBeGreaterThanOrEqual(
      frontParsed.width * 0.4,
    );
    expect(photo!.width, 'photo width ~ half card').toBeLessThanOrEqual(frontParsed.width * 0.55);

    // ── Caso D — font-size aumentati sul nome ────────────────────────────────
    expect(nameBounds!.fontSize, 'name font-size >= 45px on 1700×1100 export').toBeGreaterThanOrEqual(45);
    expect(nameBounds!.fontSize, 'name font-size strictly larger than title').toBeGreaterThan(
      titleBounds!.fontSize,
    );

    // ── Caso B — retro senza services ────────────────────────────────────────
    await selectGridSide(page, 'back');
    await addSocials(page, [{ platform: 'LinkedIn', url: 'https://linkedin.com/in/test' }]);
    const qrDetails = page.locator('[data-testid="qr-advanced-details"]').first();
    await qrDetails.locator('summary').first().click();
    await qrDetails.locator('input[aria-label="Payload QR"]').first().fill('https://example.com/test');
    await page.waitForTimeout(400);

    const backNoServicesBuffer = await saveCardSideScreenshot(
      page,
      'card-preview-back',
      'card-template-back-no-services-v2.png',
    );
    await assertScreenshotNotMostlyBlack(page, backNoServicesBuffer, 'retro senza services');

    const backExport = await exportCard(page, 'svg-back');
    const backSvg = backExport.buffer.toString('utf-8');
    const backParsed = parseCardSvg(backSvg);

    const contactsBounds = boundsByText(
      backParsed,
      (t) =>
        t.text.includes('+39') ||
        t.text.includes('mario.rossi') ||
        t.text.includes('giovannicidu'),
    );
    const socialsBounds = boundsByText(
      backParsed,
      (t) => t.text.toLowerCase().includes('linkedin') || t.text.includes('@test'),
    );

    // Collasso services-vuoto: il gap verticale tra contacts e socials è < 25% card.
    const noServicesGap = socialsBounds.minY - contactsBounds.maxY;
    expect(noServicesGap, 'contacts→socials gap < 25% card height').toBeLessThan(
      backParsed.height * 0.25,
    );

    // ── Caso C — retro con services ──────────────────────────────────────────
    await addServices(page, ['Sviluppo web', 'Consulenza']);
    await page.waitForTimeout(400);

    const backWithServicesBuffer = await saveCardSideScreenshot(
      page,
      'card-preview-back',
      'card-template-back-with-services-v2.png',
    );
    await assertScreenshotNotMostlyBlack(page, backWithServicesBuffer, 'retro con services');

    const backWithServicesExport = await exportCard(page, 'svg-back');
    const backWithServicesSvg = backWithServicesExport.buffer.toString('utf-8');
    const backWithServicesParsed = parseCardSvg(backWithServicesSvg);

    const cBounds = boundsByText(
      backWithServicesParsed,
      (t) =>
        t.text.includes('+39') ||
        t.text.includes('mario.rossi') ||
        t.text.includes('giovannicidu'),
    );
    const sBounds = boundsByText(
      backWithServicesParsed,
      (t) =>
        t.text.includes('Sviluppo web') ||
        t.text.includes('Consulenza') ||
        t.text.toLowerCase().includes('servizi'),
    );
    const soBounds = boundsByText(
      backWithServicesParsed,
      (t) => t.text.toLowerCase().includes('linkedin') || t.text.includes('@test'),
    );

    // I tre blocchi devono essere visibili e verticalmente separati.
    expect(cBounds.maxY, 'contacts above services').toBeLessThan(sBounds.minY);
    expect(sBounds.maxY, 'services above socials').toBeLessThan(soBounds.minY);

    assertInside(
      { width: backWithServicesParsed.width, height: backWithServicesParsed.height },
      [
        { x: cBounds.minX, y: cBounds.minY, width: cBounds.maxX - cBounds.minX, height: cBounds.maxY - cBounds.minY },
        { x: sBounds.minX, y: sBounds.minY, width: sBounds.maxX - sBounds.minX, height: sBounds.maxY - sBounds.minY },
        { x: soBounds.minX, y: soBounds.minY, width: soBounds.maxX - soBounds.minX, height: soBounds.maxY - soBounds.minY },
      ],
      4,
    );
  });
});
