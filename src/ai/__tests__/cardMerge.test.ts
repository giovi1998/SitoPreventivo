import { describe, it, expect } from 'vitest';
import { mergeCardAIResponse } from '../cardMerge';
import { createEmptyCard, createGiovanniCardTemplate } from '../../utils/documentSchemas';
import type { BusinessCard } from '../../utils/documentSchemas';

describe('mergeCardAIResponse', () => {
  it('returns the same card if no modifications', () => {
    const card = createGiovanniCardTemplate();
    const { card: merged, changes } = mergeCardAIResponse(card, {});
    expect(changes).toHaveLength(0);
    expect(merged.front.name).toBe(card.front.name);
  });

  it('merges front.name change and tracks it', () => {
    const card = createEmptyCard();
    const { card: merged, changes } = mergeCardAIResponse(card, {
      front: { name: 'MARIO ROSSI' },
    });
    expect(merged.front.name).toBe('MARIO ROSSI');
    expect(changes.some((c) => c.includes('nome') && c.includes('MARIO ROSSI'))).toBe(true);
  });

  it('merges back.phone change and tracks it', () => {
    const card = createEmptyCard();
    const { card: merged, changes } = mergeCardAIResponse(card, {
      back: { phone: '+39 333 1234567' },
    });
    expect(merged.back.phone).toBe('+39 333 1234567');
    expect(changes.some((c) => c.includes('telefono'))).toBe(true);
  });

  it('merges style.accentColor change and tracks it', () => {
    const card = createEmptyCard();
    const { card: merged, changes } = mergeCardAIResponse(card, {
      style: { accentColor: '#1e3a5f' },
    });
    expect(merged.style.accentColor).toBe('#1e3a5f');
    expect(changes.some((c) => c.includes('accentColor') || c.includes('accent'))).toBe(true);
  });

  it('merges front.layout change (enum)', () => {
    const card = createEmptyCard();
    const { card: merged, changes } = mergeCardAIResponse(card, {
      front: { layout: 'split' },
    });
    expect(merged.front.layout).toBe('split');
    expect(changes.some((c) => c.includes('layout'))).toBe(true);
  });

  it('merges back.socials array (replace)', () => {
    const card = createEmptyCard();
    const { card: merged, changes } = mergeCardAIResponse(card, {
      back: { socials: [{ platform: 'GitHub', url: '@mario' }] },
    });
    expect(merged.back.socials).toEqual([{ platform: 'GitHub', url: '@mario' }]);
    expect(changes.some((c) => c.includes('social'))).toBe(true);
  });

  it('preserves id, documentType, createdAt, userEmail', () => {
    const card = createGiovanniCardTemplate();
    card.userEmail = 'user@test.com';
    const { card: merged } = mergeCardAIResponse(card, { front: { name: 'X' } });
    expect(merged.id).toBe(card.id);
    expect(merged.documentType).toBe('businessCard');
    expect(merged.createdAt).toBe(card.createdAt);
    expect(merged.userEmail).toBe('user@test.com');
  });

  it('updates updatedAt when changes are applied', () => {
    const card = createEmptyCard();
    card.updatedAt = '2020-01-01T00:00:00.000Z'; // force old timestamp
    const { card: merged } = mergeCardAIResponse(card, { front: { name: 'X' } });
    expect(merged.updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
  });

  it('does NOT update updatedAt when no changes', () => {
    const card = createEmptyCard();
    const originalUpdatedAt = card.updatedAt;
    const { card: merged } = mergeCardAIResponse(card, {});
    expect(merged.updatedAt).toBe(originalUpdatedAt);
  });

  it('does NOT overwrite photoUrl/logoUrl (preserves user-uploaded base64)', () => {
    const card: BusinessCard = {
      ...createEmptyCard(),
      front: { ...createEmptyCard().front, photoUrl: 'data:image/png;base64,USERPHOTO', logoUrl: 'data:image/png;base64,USERLOGO' },
    };
    const { card: merged } = mergeCardAIResponse(card, {
      front: { photoUrl: null, logoUrl: null, name: 'X' },
    });
    expect(merged.front.photoUrl).toBe('data:image/png;base64,USERPHOTO');
    expect(merged.front.logoUrl).toBe('data:image/png;base64,USERLOGO');
  });

  it('merges multiple sections at once (front + back + style)', () => {
    const card = createEmptyCard();
    const { card: merged, changes } = mergeCardAIResponse(card, {
      front: { name: 'Mario', layout: 'centered' },
      back: { phone: '+39 333', website: 'https://x.com' },
      style: { accentColor: '#FF0000', borderStyle: 'thin' },
    });
    expect(merged.front.name).toBe('Mario');
    expect(merged.front.layout).toBe('centered');
    expect(merged.back.phone).toBe('+39 333');
    expect(merged.back.website).toBe('https://x.com');
    expect(merged.style.accentColor).toBe('#FF0000');
    expect(merged.style.borderStyle).toBe('thin');
    expect(changes.length).toBeGreaterThanOrEqual(6);
  });

  it('merges grid.elements.qr position (C - AI grid move)', () => {
    const card = createEmptyCard();
    const { card: merged, changes } = mergeCardAIResponse(card, {
      grid: {
        cols: 4,
        rows: 4,
        elements: {
          qr: { x: 0, y: 2, w: 1, h: 2 },
        },
      },
    });
    expect(merged.grid?.elements.qr).toEqual({ x: 0, y: 2, w: 1, h: 2 });
    expect(changes.some((c) => c.includes('qr'))).toBe(true);
  });

  it('merges grid.elements.photo size (C - AI grid resize)', () => {
    const card = createEmptyCard();
    const { card: merged, changes } = mergeCardAIResponse(card, {
      grid: {
        elements: {
          photo: { x: 0, y: 0, w: 2, h: 2 },
        },
      },
    });
    expect(merged.grid?.elements.photo).toEqual({ x: 0, y: 0, w: 2, h: 2 });
    expect(changes.some((c) => c.includes('photo'))).toBe(true);
  });
});
