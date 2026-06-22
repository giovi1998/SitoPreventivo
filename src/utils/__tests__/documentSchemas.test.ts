import { describe, it, expect } from 'vitest';
import {
  documentTypeSchema,
  qrCodeSchema,
  qrStyleSchema,
  qrCodeDataSchema,
  qrDataTypeSchema,
  qrErrorCorrectionSchema,
  qrDotStyleSchema,
  createEmptyQrCode,
  createGiovanniQrTemplate,
  createDocumentFromQrCode,
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
});
