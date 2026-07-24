import { describe, it, expect } from 'vitest';
import { resolveCardQrPayload, getEffectiveQrPayload } from '../qrPayload';
import { createEmptyCard } from '../../documentSchemas';

describe('qrPayload', () => {
  describe('resolveCardQrPayload', () => {
    it('prefers explicit qrPayload over website', () => {
      const card = {
        ...createEmptyCard(),
        back: { ...createEmptyCard().back, qrPayload: 'CUSTOM:payload', website: 'https://example.com' },
      };
      expect(resolveCardQrPayload(card)).toBe('CUSTOM:payload');
    });

    it('falls back to website when qrPayload is empty', () => {
      const card = {
        ...createEmptyCard(),
        back: { ...createEmptyCard().back, qrPayload: '', website: 'https://example.com' },
      };
      expect(resolveCardQrPayload(card)).toBe('https://example.com');
    });

    it('returns empty string when both are empty', () => {
      expect(resolveCardQrPayload(createEmptyCard())).toBe('');
    });
  });

  describe('getEffectiveQrPayload', () => {
    it('returns resolved value for valid http URL', () => {
      const card = {
        ...createEmptyCard(),
        back: { ...createEmptyCard().back, website: 'https://example.com' },
      };
      expect(getEffectiveQrPayload(card)).toBe('https://example.com');
    });

    it('returns resolved value for custom payload', () => {
      const card = {
        ...createEmptyCard(),
        back: { ...createEmptyCard().back, qrPayload: 'MATMSG:TO:...' },
      };
      expect(getEffectiveQrPayload(card)).toBe('MATMSG:TO:...');
    });

    it('returns empty string when resolved value is empty', () => {
      expect(getEffectiveQrPayload(createEmptyCard())).toBe('');
    });
  });
});
