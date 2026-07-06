import { describe, it, expect } from 'vitest';
import {
  hasElementContent,
  getAvailableGridElements,
  elementKeysForSide,
  FRONT_ELEMENT_KEYS,
  BACK_ELEMENT_KEYS,
} from '../gridElements';
import { createEmptyCard, createGiovanniCardTemplate } from '../../documentSchemas';
import type { BusinessCard } from '../../documentSchemas';
import type { GridElementKey } from '../gridElements';

describe('gridElements', () => {
  describe('elementKeysForSide', () => {
    it('returns front keys for front side', () => {
      expect(elementKeysForSide('front')).toEqual(FRONT_ELEMENT_KEYS);
      expect(elementKeysForSide('front')).toContain('photo');
      expect(elementKeysForSide('front')).not.toContain('contacts');
    });

    it('returns back keys for back side', () => {
      expect(elementKeysForSide('back')).toEqual(BACK_ELEMENT_KEYS);
      expect(elementKeysForSide('back')).toContain('qr');
      expect(elementKeysForSide('back')).toContain('services');
      expect(elementKeysForSide('back')).not.toContain('photo');
    });
  });

  describe('hasElementContent', () => {
    it('detects front content presence', () => {
      const empty = createEmptyCard();
      expect(hasElementContent('photo', empty, 'front')).toBe(false);
      expect(hasElementContent('logo', empty, 'front')).toBe(false);
      expect(hasElementContent('name', empty, 'front')).toBe(false);

      const card = {
        ...empty,
        front: {
          ...empty.front,
          photoUrl: 'data:image/png;base64,AAA',
          logoUrl: 'data:image/png;base64,BBB',
          name: 'Mario',
          title: 'CEO',
          company: 'Acme',
        },
      };
      expect(hasElementContent('photo', card, 'front')).toBe(true);
      expect(hasElementContent('logo', card, 'front')).toBe(true);
      expect(hasElementContent('name', card, 'front')).toBe(true);
      expect(hasElementContent('title', card, 'front')).toBe(true);
      expect(hasElementContent('company', card, 'front')).toBe(true);
    });

    it('ignores whitespace-only front text', () => {
      const card: BusinessCard = {
        ...createEmptyCard(),
        front: { ...createEmptyCard().front, name: '   ' },
      };
      expect(hasElementContent('name', card, 'front')).toBe(false);
    });

    it('detects back content presence', () => {
      const empty = createEmptyCard();
      expect(hasElementContent('contacts', empty, 'back')).toBe(false);
      expect(hasElementContent('qr', empty, 'back')).toBe(false);
      expect(hasElementContent('socials', empty, 'back')).toBe(false);

      const card = {
        ...empty,
        back: {
          ...empty.back,
          phone: '+39 333',
          website: 'https://example.com',
          socials: [{ platform: 'LinkedIn', url: 'https://linkedin.com/in/x' }],
        },
      };
      expect(hasElementContent('contacts', card, 'back')).toBe(true);
      expect(hasElementContent('qr', card, 'back')).toBe(true);
      expect(hasElementContent('socials', card, 'back')).toBe(true);
      expect(hasElementContent('services', card, 'back')).toBe(false);

      const withServices = { ...card, back: { ...card.back, services: ['Consulenza'] } };
      expect(hasElementContent('services', withServices, 'back')).toBe(true);
    });

    it('returns false for unknown front key on back side', () => {
      const card = createGiovanniCardTemplate();
      expect(hasElementContent('photo' as GridElementKey, card, 'back')).toBe(false);
    });
  });

  describe('getAvailableGridElements', () => {
    it('returns empty options for empty card', () => {
      expect(getAvailableGridElements('front', createEmptyCard())).toHaveLength(0);
      expect(getAvailableGridElements('back', createEmptyCard())).toHaveLength(0);
    });

    it('returns front options with labels for populated card', () => {
      const card = {
        ...createGiovanniCardTemplate(),
        front: { ...createGiovanniCardTemplate().front, company: 'Quickbrand' },
      };
      const opts = getAvailableGridElements('front', card);
      const values = opts.map((o) => o.value);
      expect(values).toContain('photo');
      expect(values).toContain('logo');
      expect(values).toContain('name');
      expect(values).toContain('title');
      expect(values).toContain('company');
      expect(opts.find((o) => o.value === 'name')?.label).toBe('Nome');
    });

    it('returns back options for populated back', () => {
      const card = {
        ...createGiovanniCardTemplate(),
        back: { ...createGiovanniCardTemplate().back, services: ['Consulenza'] },
      };
      const opts = getAvailableGridElements('back', card);
      const values = opts.map((o) => o.value);
      expect(values).toContain('contacts');
      expect(values).toContain('qr');
      expect(values).toContain('services');
      expect(values).toContain('socials');
    });

    it('does not return back socials when socials array has no valid entries', () => {
      const card: BusinessCard = {
        ...createGiovanniCardTemplate(),
        back: { ...createGiovanniCardTemplate().back, socials: [{ platform: '', url: '' }] },
      };
      const opts = getAvailableGridElements('back', card);
      expect(opts.map((o) => o.value)).not.toContain('socials');
    });
  });
});
