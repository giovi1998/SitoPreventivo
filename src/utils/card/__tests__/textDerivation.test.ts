import { describe, it, expect } from 'vitest';
import { computeMonogram, deriveHostname, deriveHandle } from '../textDerivation';
import { createEmptyCard } from '../../documentSchemas';
import type { BusinessCard } from '../../documentSchemas';

describe('textDerivation', () => {
  describe('computeMonogram', () => {
    it('returns two-letter monogram for first and last name', () => {
      const card = { ...createEmptyCard(), front: { ...createEmptyCard().front, name: 'Mario Rossi' } };
      expect(computeMonogram(card)).toBe('MR');
    });

    it('returns first two letters for single name', () => {
      const card = { ...createEmptyCard(), front: { ...createEmptyCard().front, name: 'Giovanni' } };
      expect(computeMonogram(card)).toBe('GI');
    });

    it('returns empty string when name is empty', () => {
      expect(computeMonogram(createEmptyCard())).toBe('');
    });

    it('handles extra whitespace between names', () => {
      const card: BusinessCard = {
        ...createEmptyCard(),
        front: { ...createEmptyCard().front, name: '  Anna   Bianchi  ' },
      };
      expect(computeMonogram(card)).toBe('AB');
    });
  });

  describe('deriveHostname', () => {
    it('extracts hostname from valid URL', () => {
      const card = {
        ...createEmptyCard(),
        back: { ...createEmptyCard().back, website: 'https://www.example.com/path' },
      };
      expect(deriveHostname(card)).toBe('example.com');
    });

    it('returns raw value when URL is invalid', () => {
      const card = { ...createEmptyCard(), back: { ...createEmptyCard().back, website: 'not-a-url' } };
      expect(deriveHostname(card)).toBe('not-a-url');
    });

    it('returns empty string when website is empty', () => {
      expect(deriveHostname(createEmptyCard())).toBe('');
    });
  });

  describe('deriveHandle', () => {
    it('extracts @handle from known social URLs', () => {
      expect(deriveHandle('https://linkedin.com/in/mariorossi')).toBe('@mariorossi');
      expect(deriveHandle('https://github.com/mariorossi')).toBe('@mariorossi');
      expect(deriveHandle('https://x.com/mariorossi')).toBe('@mariorossi');
      expect(deriveHandle('https://instagram.com/mariorossi/')).toBe('@mariorossi');
    });

    it('falls back to raw url on malformed input', () => {
      expect(deriveHandle('just-a-name')).toBe('just-a-name');
    });

    it('returns empty string for empty url', () => {
      expect(deriveHandle('')).toBe('');
    });

    it('strips www and trailing path segments for generic hosts', () => {
      expect(deriveHandle('https://www.behance.net/gallery/123')).toBe('gallery/123');
    });
  });
});
