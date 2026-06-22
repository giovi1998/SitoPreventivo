import { describe, it, expect } from 'vitest';
import { aiCardInputSchema } from '../aiCardInputSchema';

describe('aiCardInputSchema', () => {
  it('accepts a complete valid card payload', () => {
    const r = aiCardInputSchema.safeParse({
      front: { name: 'Mario', title: 'Dev', company: 'ACME', layout: 'left' },
      back: { phone: '+39 333', email: 'm@b.com', website: 'https://x.com', socials: [{ platform: 'LinkedIn', url: 'XXXXX' }] },
      style: { sizePreset: 'eu-85x55', bgColor: '#FFFFFF', textColor: '#1a1a2e', accentColor: '#01696F', fontFamily: 'Inter', borderStyle: 'accent-strip-left' },
    });
    expect(r.success).toBe(true);
  });

  it('accepts empty object (all fields optional)', () => {
    expect(aiCardInputSchema.safeParse({}).success).toBe(true);
  });

  it('accepts partial front only', () => {
    expect(aiCardInputSchema.safeParse({ front: { name: 'Mario' } }).success).toBe(true);
  });

  it('accepts partial back only', () => {
    expect(aiCardInputSchema.safeParse({ back: { phone: '+39 333' } }).success).toBe(true);
  });

  it('accepts partial style only', () => {
    expect(aiCardInputSchema.safeParse({ style: { accentColor: '#FF0000' } }).success).toBe(true);
  });

  it('rejects invalid layout enum', () => {
    expect(aiCardInputSchema.safeParse({ front: { layout: 'random' } }).success).toBe(false);
  });

  it('rejects invalid sizePreset enum', () => {
    expect(aiCardInputSchema.safeParse({ style: { sizePreset: 'jumbo' } }).success).toBe(false);
  });

  it('rejects invalid borderStyle enum', () => {
    expect(aiCardInputSchema.safeParse({ style: { borderStyle: 'thick' } }).success).toBe(false);
  });

  it('rejects invalid hex color (not 6 digits)', () => {
    expect(aiCardInputSchema.safeParse({ style: { accentColor: '#FFF' } }).success).toBe(false);
  });

  it('rejects invalid hex color (not hex)', () => {
    expect(aiCardInputSchema.safeParse({ style: { accentColor: 'red' } }).success).toBe(false);
  });

  it('rejects non-string name', () => {
    expect(aiCardInputSchema.safeParse({ front: { name: 123 } }).success).toBe(false);
  });

  it('accepts all 3 layouts', () => {
    for (const layout of ['centered', 'left', 'split'] as const) {
      expect(aiCardInputSchema.safeParse({ front: { layout } }).success).toBe(true);
    }
  });

  it('accepts all 4 borderStyles', () => {
    for (const bs of ['none', 'thin', 'accent-strip-left', 'accent-strip-bottom'] as const) {
      expect(aiCardInputSchema.safeParse({ style: { borderStyle: bs } }).success).toBe(true);
    }
  });

  it('accepts all 3 sizePresets', () => {
    for (const sp of ['eu-85x55', 'us-89x51', 'square-65x65'] as const) {
      expect(aiCardInputSchema.safeParse({ style: { sizePreset: sp } }).success).toBe(true);
    }
  });

  it('accepts socials array with platform + url', () => {
    expect(aiCardInputSchema.safeParse({
      back: { socials: [{ platform: 'LinkedIn', url: 'https://x.com' }] },
    }).success).toBe(true);
  });

  it('accepts qrPayload and qrLabel strings', () => {
    expect(aiCardInputSchema.safeParse({
      back: { qrPayload: 'MATMSG:custom', qrLabel: 'Scansiona' },
    }).success).toBe(true);
  });
});
