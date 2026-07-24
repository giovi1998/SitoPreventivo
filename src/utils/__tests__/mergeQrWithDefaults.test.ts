import { describe, it, expect } from 'vitest';
import { mergeQrWithDefaults, createEmptyQrCode, qrStyleSchema } from '../documentSchemas';

describe('mergeQrWithDefaults', () => {
  it('returns a full empty QR when input is null', () => {
    const result = mergeQrWithDefaults(null);
    const base = createEmptyQrCode();
    expect(result.documentType).toBe('qrCode');
    expect(result.style.fgColor).toBe(base.style.fgColor);
    expect(result.style.bgColor).toBe(base.style.bgColor);
    expect(result.style.errorCorrection).toBe(base.style.errorCorrection);
  });

  it('returns a full empty QR when input is undefined', () => {
    const result = mergeQrWithDefaults(undefined);
    expect(result.style.fgColor).toBe('#000000');
  });

  it('fills in missing style with defaults (regression: Cannot read fgColor of undefined)', () => {
    // Simulate a saved QR where the style was lost (legacy / partial save /
    // schema drift). Before the fix this crashed the first render.
    const partial = {
      documentType: 'qrCode' as const,
      id: 'qr_legacy',
      title: 'Old QR',
      data: { type: 'url' as const, payload: 'https://example.com' },
      // style is missing entirely
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const merged = mergeQrWithDefaults(partial);
    // The crash point: qr.style.fgColor must be a string, not undefined
    expect(typeof merged.style.fgColor).toBe('string');
    expect(merged.style.fgColor).toBe('#000000');
    expect(merged.style.bgColor).toBe('#FFFFFF');
    expect(merged.style.errorCorrection).toBe('M');
    // User fields are preserved
    expect(merged.id).toBe('qr_legacy');
    expect(merged.title).toBe('Old QR');
    expect(merged.data.payload).toBe('https://example.com');
  });

  it('fills in partial style (only fgColor, missing bgColor etc.) with defaults', () => {
    const partial = {
      ...createEmptyQrCode(),
      style: {
        ...createEmptyQrCode().style,
        fgColor: '#FF0000',
        // bgColor, errorCorrection, size, margin, logoOverlay, dotStyle missing
      } as any,
    };
    const merged = mergeQrWithDefaults(partial);
    expect(merged.style.fgColor).toBe('#FF0000'); // user value preserved
    expect(merged.style.bgColor).toBe('#FFFFFF'); // default
    expect(merged.style.size).toBe(512); // default
  });

  it('merged result always passes the qrStyleSchema validation', () => {
    // The merge output must be a valid QR shape: this guards against
    // accidental regressions where the merge logic drops a required field.
    const cases = [
      null,
      undefined,
      { documentType: 'qrCode' as const, id: 'x', data: { type: 'text' as const, payload: 'hi' } } as any,
      { ...createEmptyQrCode(), style: undefined as any },
      { ...createEmptyQrCode(), data: undefined as any },
    ];
    for (const input of cases) {
      const merged = mergeQrWithDefaults(input);
      // qrStyleSchema requires fgColor etc. If merge dropped a field,
      // safeParse will fail.
      const parsed = qrStyleSchema.safeParse(merged.style);
      expect(parsed.success).toBe(true);
    }
  });
});
