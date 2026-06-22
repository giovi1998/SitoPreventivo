import { describe, it, expect } from 'vitest';
import {
  documentTypeSchema,
  qrCodeSchema,
  qrStyleSchema,
  qrCodeDataSchema,
  qrDataTypeSchema,
  qrErrorCorrectionSchema,
  qrDotStyleSchema,
  businessCardSchema,
  createEmptyQrCode,
  createGiovanniQrTemplate,
  createDocumentFromQrCode,
  createEmptyCard,
  createGiovanniCardTemplate,
  gridPresetLeft,
  gridPresetCentered,
  gridPresetSplit,
  logoSchema,
  logoBuilderSchema,
  logoIconTypeSchema,
  logoIconShapeSchema,
  logoLayoutSchema,
  createEmptyLogo,
  createLogoTemplate,
  LOGO_SECTORS,
} from '../documentSchemas';

const GIOVANNI_URL = 'https://webdeveloperca.netlify.app/';

describe('documentSchemas', () => {
  describe('documentTypeSchema', () => {
    it('accepts all expected document types', () => {
      expect(documentTypeSchema.safeParse('quote').success).toBe(true);
      expect(documentTypeSchema.safeParse('qrCode').success).toBe(true);
      expect(documentTypeSchema.safeParse('businessCard').success).toBe(true);
      expect(documentTypeSchema.safeParse('flyer').success).toBe(true);
      expect(documentTypeSchema.safeParse('logo').success).toBe(true);
    });

    it('rejects unknown document type', () => {
      expect(documentTypeSchema.safeParse('spreadsheet').success).toBe(false);
    });
  });

  describe('qrCodeDataSchema', () => {
    it('accepts all 7 payload types', () => {
      const types = ['url', 'text', 'email', 'phone', 'vcard', 'wifi', 'sms'] as const;
      for (const type of types) {
        const r = qrCodeDataSchema.safeParse({ type, payload: 'x' });
        expect(r.success).toBe(true);
      }
    });

    it('rejects unknown payload type', () => {
      const r = qrCodeDataSchema.safeParse({ type: 'geo', payload: 'x' });
      expect(r.success).toBe(false);
    });
  });

  describe('qrStyleSchema', () => {
    it('applies defaults when fields missing', () => {
      const r = qrStyleSchema.parse({});
      expect(r.errorCorrection).toBe('M');
      expect(r.fgColor).toBe('#000000');
      expect(r.bgColor).toBe('#FFFFFF');
      expect(r.size).toBe(512);
      expect(r.margin).toBe(2);
      expect(r.dotStyle).toBe('rounded');
      expect(r.logoOverlay).toBeNull();
    });

    it('rejects invalid hex color', () => {
      const r = qrStyleSchema.safeParse({ fgColor: 'red' });
      expect(r.success).toBe(false);
    });

    it('rejects out-of-range size', () => {
      expect(qrStyleSchema.safeParse({ size: 64 }).success).toBe(false);
      expect(qrStyleSchema.safeParse({ size: 4096 }).success).toBe(false);
    });

    it('rejects out-of-range margin', () => {
      expect(qrStyleSchema.safeParse({ margin: -1 }).success).toBe(false);
      expect(qrStyleSchema.safeParse({ margin: 17 }).success).toBe(false);
    });
  });

  describe('qrCodeSchema', () => {
    it('validates a complete QR', () => {
      const r = qrCodeSchema.safeParse({
        documentType: 'qrCode',
        id: 'qr_1',
        title: 'Test',
        data: { type: 'url', payload: GIOVANNI_URL },
        style: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      expect(r.success).toBe(true);
    });

    it('rejects wrong documentType literal', () => {
      const r = qrCodeSchema.safeParse({
        documentType: 'quote',
        id: 'qr_1',
        title: 'Test',
        data: { type: 'url', payload: GIOVANNI_URL },
        style: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      expect(r.success).toBe(false);
    });
  });

  describe('enums', () => {
    it('qrErrorCorrectionSchema accepts L/M/Q/H only', () => {
      expect(qrErrorCorrectionSchema.safeParse('L').success).toBe(true);
      expect(qrErrorCorrectionSchema.safeParse('M').success).toBe(true);
      expect(qrErrorCorrectionSchema.safeParse('Q').success).toBe(true);
      expect(qrErrorCorrectionSchema.safeParse('H').success).toBe(true);
      expect(qrErrorCorrectionSchema.safeParse('X').success).toBe(false);
    });

    it('qrDotStyleSchema accepts square/rounded/dots only', () => {
      expect(qrDotStyleSchema.safeParse('square').success).toBe(true);
      expect(qrDotStyleSchema.safeParse('rounded').success).toBe(true);
      expect(qrDotStyleSchema.safeParse('dots').success).toBe(true);
      expect(qrDotStyleSchema.safeParse('cross').success).toBe(false);
    });
  });

  describe('createEmptyQrCode', () => {
    it('returns a valid QR with id and timestamps', () => {
      const qr = createEmptyQrCode();
      const r = qrCodeSchema.safeParse(qr);
      expect(r.success).toBe(true);
      expect(qr.id).toMatch(/^qr_/);
      expect(qr.title).toBe('QR Code');
      expect(qr.data.type).toBe('url');
      expect(qr.data.payload).toBe('');
      expect(qr.documentType).toBe('qrCode');
    });

    it('generates unique ids', () => {
      const a = createEmptyQrCode();
      const b = createEmptyQrCode();
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('createGiovanniQrTemplate', () => {
    it('pre-fills Giovanni URL', () => {
      const qr = createGiovanniQrTemplate();
      expect(qr.data.type).toBe('url');
      expect(qr.data.payload).toBe(GIOVANNI_URL);
      expect(qr.title).toContain('Giovanni');
      const r = qrCodeSchema.safeParse(qr);
      expect(r.success).toBe(true);
    });
  });

  describe('createDocumentFromQrCode', () => {
    it('attaches userEmail and refreshes updatedAt', () => {
      const original = createGiovanniQrTemplate();
      const originalUpdatedAt = original.updatedAt;
      const doc = createDocumentFromQrCode(original, 'a@b.com');
      expect(doc.userEmail).toBe('a@b.com');
      expect(doc.id).toBe(original.id);
      expect(doc.updatedAt >= originalUpdatedAt).toBe(true);
    });
  });

  describe('businessCardSchema', () => {
    const baseCard = {
      documentType: 'businessCard' as const,
      id: 'card_1',
      title: 'Test card',
      front: {
        name: 'Mario Rossi',
        title: 'CEO',
        company: 'ACME',
        photoUrl: null,
        logoUrl: null,
        layout: 'left' as const,
      },
      back: {
        phone: '+393331234567',
        email: 'mario@acme.com',
        website: 'https://acme.com',
        address: 'Via Roma 1',
        vatNumber: 'IT01234567890',
        socials: [{ platform: 'LinkedIn', url: 'https://linkedin.com/in/mario' }],
        qrPayload: '',
        qrLabel: 'Scansiona per visitare il sito',
      },
      style: {
        sizePreset: 'eu-85x55' as const,
        bgColor: '#FFFFFF',
        textColor: '#1a1a2e',
        accentColor: '#01696F',
        fontFamily: 'Inter',
        borderStyle: 'accent-strip-left' as const,
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    it('accepts a complete business card (REQs 002, 003, 007)', () => {
      const r = businessCardSchema.safeParse(baseCard);
      expect(r.success).toBe(true);
    });

    it('rejects wrong documentType literal', () => {
      const r = businessCardSchema.safeParse({ ...baseCard, documentType: 'quote' });
      expect(r.success).toBe(false);
    });

    it('rejects invalid hex color in style', () => {
      const r = businessCardSchema.safeParse({ ...baseCard, style: { ...baseCard.style, bgColor: 'red' } });
      expect(r.success).toBe(false);
    });

    it('rejects unknown front layout', () => {
      const r = businessCardSchema.safeParse({
        ...baseCard,
        front: { ...baseCard.front, layout: 'random' },
      });
      expect(r.success).toBe(false);
    });

    it('rejects unknown size preset', () => {
      const r = businessCardSchema.safeParse({
        ...baseCard,
        style: { ...baseCard.style, sizePreset: 'jumbo' },
      });
      expect(r.success).toBe(false);
    });

    it('accepts all 3 size presets', () => {
      for (const preset of ['eu-85x55', 'us-89x51', 'square-65x65'] as const) {
        const r = businessCardSchema.safeParse({
          ...baseCard,
          style: { ...baseCard.style, sizePreset: preset },
        });
        expect(r.success).toBe(true);
      }
    });

    it('accepts all 3 front layouts', () => {
      for (const layout of ['centered', 'left', 'split'] as const) {
        const r = businessCardSchema.safeParse({
          ...baseCard,
          front: { ...baseCard.front, layout },
        });
        expect(r.success).toBe(true);
      }
    });

    it('accepts all 4 border styles', () => {
      for (const bs of ['none', 'thin', 'accent-strip-left', 'accent-strip-bottom'] as const) {
        const r = businessCardSchema.safeParse({
          ...baseCard,
          style: { ...baseCard.style, borderStyle: bs },
        });
        expect(r.success).toBe(true);
      }
    });
  });

  describe('createEmptyCard', () => {
    it('returns a valid card with id and timestamps (AC-001)', () => {
      const card = createEmptyCard();
      const r = businessCardSchema.safeParse(card);
      expect(r.success).toBe(true);
      expect(card.documentType).toBe('businessCard');
      expect(card.id).toMatch(/^card_/);
      expect(card.front.layout).toBe('left');
      expect(card.style.sizePreset).toBe('eu-85x55');
      expect(card.back.website).toBe('');
      expect(card.back.qrPayload).toBe('');
      expect(card.front.photoUrl).toBeNull();
      expect(card.front.logoUrl).toBeNull();
    });

    it('generates unique ids', () => {
      const a = createEmptyCard();
      const b = createEmptyCard();
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('createGiovanniCardTemplate (AC-002)', () => {
    it('pre-fills Giovanni URL and XXXXX placeholders', () => {
      const card = createGiovanniCardTemplate();
      expect(card.back.website).toBe(GIOVANNI_URL);
      expect(card.back.phone).toBe('XXXXX');
      expect(card.back.email).toBe('XXXXX');
      expect(card.back.qrPayload).toBe(GIOVANNI_URL);
      expect(card.front.name).toContain('GIOVANNI');
      expect(card.front.layout).toBe('split');
      expect(card.front.photoUrl).toBe('/giovanni-photo.jpg');
      expect(card.title.toLowerCase()).toContain('giovanni');
      const r = businessCardSchema.safeParse(card);
      expect(r.success).toBe(true);
    });

    it('pre-fills company "HPE CDS" on front (Phase 2.1 update)', () => {
      const card = createGiovanniCardTemplate();
      expect(card.front.company).toBe('HPE CDS');
    });

    it('includes a transparent SVG logo as data URI (Phase 2.1: logoUrl non null)', () => {
      const card = createGiovanniCardTemplate();
      expect(card.front.logoUrl).not.toBeNull();
      expect(card.front.logoUrl).toMatch(/^data:image\/svg\+xml/);
      // Il logo è SVG trasparente: non contiene bgcolor= o un <rect> di sfondo
      expect(card.front.logoUrl).not.toContain('bgcolor');
    });

    it('logo data URI decodes to valid SVG with viewBox and terminal icon', () => {
      const card = createGiovanniCardTemplate();
      const uri = card.front.logoUrl!;
      // Estrai la parte SVG dalla data URI
      const svgPart = decodeURIComponent(uri.split(',')[1] || '');
      expect(svgPart).toContain('<svg');
      expect(svgPart).toContain('viewBox=');
      expect(svgPart).toContain('WebdevCA');
      // Lo sfondo è trasparente: nessun <rect> che copre l'intero viewBox
      // (il <rect> del badge SVG è 84×84, non copre i 400×160 del viewBox)
      expect(svgPart).toContain('fill="#01696F"'); // accent color del badge
    });

    it('pre-fills LinkedIn and GitHub placeholders with "XXXXX" (Phase 2.1: GitHub added)', () => {
      const card = createGiovanniCardTemplate();
      const platforms = card.back.socials.map((s) => s.platform);
      expect(platforms).toContain('LinkedIn');
      expect(platforms).toContain('GitHub');
      // Tutti gli url sono placeholder 'XXXXX'
      card.back.socials.forEach((s) => {
        expect(s.url).toBe('XXXXX');
      });
    });
  });

  describe('cardGridSchema (B1)', () => {
    it('validates a grid with cols, rows and elements having x/y/w/h', () => {
      const grid = {
        cols: 4,
        rows: 4,
        elements: {
          photo: { x: 0, y: 0, w: 1, h: 1 },
          name: { x: 1, y: 0, w: 3, h: 1 },
          title: { x: 1, y: 1, w: 3, h: 1 },
          qr: { x: 3, y: 2, w: 1, h: 2 },
          contacts: { x: 0, y: 2, w: 3, h: 2 },
        },
      };
      const r = businessCardSchema.shape.grid?.safeParse(grid);
      expect(r?.success).toBe(true);
    });

    it('rejects out-of-range cols (must be 2-8)', () => {
      const r = businessCardSchema.shape.grid?.safeParse({
        cols: 12,
        rows: 4,
        elements: {},
      });
      expect(r?.success).toBe(false);
    });

    it('is optional on businessCardSchema (default omitted)', () => {
      const card = createEmptyCard();
      expect((card as any).grid).toBeUndefined();
    });

    it('logo is a valid grid element (Phase 2.1 — card-logo in grid mode)', () => {
      const grid = {
        cols: 4,
        rows: 4,
        elements: {
          photo: { x: 0, y: 0, w: 2, h: 2 },
          logo: { x: 2, y: 0, w: 2, h: 2 },
          name: { x: 0, y: 2, w: 4, h: 1 },
          title: { x: 0, y: 3, w: 4, h: 1 },
        },
      };
      const r = businessCardSchema.shape.grid?.safeParse(grid);
      expect(r?.success).toBe(true);
    });
  });

  describe('gridPresetLeft/Centered/Split (B1)', () => {
    it('gridPresetLeft puts photo on left col, name+title on right', () => {
      const g = gridPresetLeft();
      expect(g.cols).toBe(4);
      expect(g.rows).toBe(4);
      expect(g.elements.photo!.x).toBe(0);
      expect(g.elements.name!.x).toBeGreaterThan(0);
    });

    it('gridPresetCentered centers name+title, photo on top', () => {
      const g = gridPresetCentered();
      expect(g.elements.photo!.y).toBe(0);
      expect(g.elements.name!.x).toBe(0);
    });

    it('gridPresetSplit puts contacts on left half, qr on right', () => {
      const g = gridPresetSplit();
      expect(g.elements.qr!.x).toBeGreaterThan(g.elements.contacts!.x);
    });

    it('all presets include a logo element (Phase 2.1: logo is grid-editable)', () => {
      expect(gridPresetLeft().elements.logo).toBeDefined();
      expect(gridPresetCentered().elements.logo).toBeDefined();
      expect(gridPresetSplit().elements.logo).toBeDefined();
    });
  });

  describe('logoSchema (Phase 4)', () => {
    it('accepts a minimal valid logo with defaults applied', () => {
      const logo = createEmptyLogo();
      const r = logoSchema.safeParse(logo);
      expect(r.success).toBe(true);
    });

    it('rejects unknown documentType literal', () => {
      const logo = { ...createEmptyLogo(), documentType: 'flyer' as const };
      const r = logoSchema.safeParse(logo);
      expect(r.success).toBe(false);
    });

    it('rejects invalid hex color in builder', () => {
      const logo = {
        ...createEmptyLogo(),
        builder: { ...createEmptyLogo().builder, primaryColor: 'red' },
      };
      const r = logoSchema.safeParse(logo);
      expect(r.success).toBe(false);
    });

    it('rejects unknown iconType', () => {
      const r = logoIconTypeSchema.safeParse('emoji');
      expect(r.success).toBe(false);
    });

    it('rejects unknown iconShape', () => {
      const r = logoIconShapeSchema.safeParse('triangle');
      expect(r.success).toBe(false);
    });

    it('rejects unknown layout', () => {
      const r = logoLayoutSchema.safeParse('diagonal');
      expect(r.success).toBe(false);
    });

    it('accepts all 4 iconType values', () => {
      for (const t of ['none', 'shape', 'monogram', 'lucide'] as const) {
        expect(logoIconTypeSchema.safeParse(t).success).toBe(true);
      }
    });

    it('accepts all 4 iconShape values', () => {
      for (const s of ['circle', 'square', 'rounded', 'hex'] as const) {
        expect(logoIconShapeSchema.safeParse(s).success).toBe(true);
      }
    });

    it('accepts all 3 layout values', () => {
      for (const l of ['horizontal', 'vertical', 'stacked'] as const) {
        expect(logoLayoutSchema.safeParse(l).success).toBe(true);
      }
    });

    it('logoBuilderSchema applies sensible defaults', () => {
      const b = logoBuilderSchema.parse({});
      expect(b.primaryText).toBe('');
      expect(b.tagline).toBe('');
      expect(b.iconType).toBe('none');
      expect(b.iconShape).toBe('circle');
      expect(b.primaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(b.secondaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(b.layout).toBe('horizontal');
    });
  });

  describe('createEmptyLogo (Phase 4)', () => {
    it('returns a valid logo with id and timestamps', () => {
      const logo = createEmptyLogo();
      const r = logoSchema.safeParse(logo);
      expect(r.success).toBe(true);
      expect(logo.id).toMatch(/^logo_/);
      expect(logo.documentType).toBe('logo');
      expect(logo.source).toBe('builder');
    });

    it('initializes brief/concepts/selected/edits as AI-dormient placeholders', () => {
      const logo = createEmptyLogo();
      expect(logo.brief).toBe('');
      expect(logo.concepts).toEqual([]);
      expect(logo.selected).toBe(-1);
      expect(logo.edits.primaryText).toBe('');
    });

    it('generates unique ids', () => {
      const a = createEmptyLogo();
      const b = createEmptyLogo();
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('createLogoTemplate (Phase 4)', () => {
    it('exports 4 sectors', () => {
      expect(LOGO_SECTORS).toEqual(['tech', 'food', 'fashion', 'professionista']);
    });

    it.each(LOGO_SECTORS)('template %s is a valid logo', (sector) => {
      const logo = createLogoTemplate(sector);
      const r = logoSchema.safeParse(logo);
      expect(r.success).toBe(true);
      expect(logo.builder.primaryText.length).toBeGreaterThan(0);
      expect(logo.builder.primaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('tech template picks a tech-flavored iconType (lucide/monogram)', () => {
      const logo = createLogoTemplate('tech');
      expect(['lucide', 'monogram', 'shape', 'none']).toContain(logo.builder.iconType);
    });

    it('food template picks food-flavored iconType (lucide/monogram)', () => {
      const logo = createLogoTemplate('food');
      expect(['lucide', 'monogram', 'shape', 'none']).toContain(logo.builder.iconType);
    });
  });
});
