import { describe, it, expect } from 'vitest';
import {
  mergeCardWithDefaults,
  mergeLogoWithDefaults,
  createEmptyCard,
  createEmptyLogo,
  businessCardSchema,
  logoSchema,
} from '../documentSchemas';

describe('mergeCardWithDefaults', () => {
  it('returns a full empty card when input is null', () => {
    const result = mergeCardWithDefaults(null);
    const base = createEmptyCard();
    expect(result.front).toEqual(base.front);
    expect(result.back).toEqual(base.back);
    expect(result.style).toEqual(base.style);
  });

  it('returns a full empty card when input is undefined', () => {
    const result = mergeCardWithDefaults(undefined);
    expect(result.front.layout).toBe('left');
    expect(result.back.qrSize).toBe('medium');
    expect(result.style.sizePreset).toBe('eu-85x55');
  });

  it('fills in missing front with defaults (regression: layout of undefined)', () => {
    // Simulate a saved card where the entire front object is missing
    // (legacy save, partial data, schema drift across phases 0-2).
    // Before the fix this crashed the editor with 'Cannot read
    // properties of undefined (reading layout)' at the first read
    // of card.front.layout in cardGenerator.
    const partial = {
      documentType: 'businessCard' as const,
      id: 'card_legacy',
      title: 'Old card',
      // front is missing entirely
      back: { phone: '+39 333 1234567' },
      // style is missing
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const merged = mergeCardWithDefaults(partial as any);
    // The crash point: card.front.layout must be a string
    expect(typeof merged.front.layout).toBe('string');
    expect(merged.front.layout).toBe('left');
    expect(merged.front.name).toBe('');
    expect(merged.front.photoUrl).toBeNull();
    // User data is preserved
    expect(merged.id).toBe('card_legacy');
    expect(merged.title).toBe('Old card');
    expect(merged.back.phone).toBe('+39 333 1234567');
  });

  it('fills in missing back with defaults', () => {
    const partial = {
      ...createEmptyCard(),
      back: undefined as any,
    };
    const merged = mergeCardWithDefaults(partial);
    expect(merged.back.qrSize).toBe('medium');
    expect(merged.back.services).toEqual([]);
    expect(merged.back.servicesLabel).toBe('Servizi');
  });

  it('fills in missing style with defaults', () => {
    const partial = {
      ...createEmptyCard(),
      style: undefined as any,
    };
    const merged = mergeCardWithDefaults(partial);
    expect(merged.style.sizePreset).toBe('eu-85x55');
    expect(merged.style.bgColor).toBe('#FFFFFF');
    expect(merged.style.fontScale).toBe(1);
  });

  it('preserves user-set front.name, front.layout, back.website', () => {
    const partial = {
      ...createEmptyCard(),
      front: { ...createEmptyCard().front, name: 'MARIO ROSSI', layout: 'split' as const },
      back: { ...createEmptyCard().back, website: 'https://example.com' },
    };
    const merged = mergeCardWithDefaults(partial);
    expect(merged.front.name).toBe('MARIO ROSSI');
    expect(merged.front.layout).toBe('split');
    expect(merged.back.website).toBe('https://example.com');
  });

  it('merged result passes the businessCardSchema validation', () => {
    // The merge output must always be a valid card shape. This guards
    // against regressions where the merge drops a required field.
    const cases = [
      null,
      undefined,
      { documentType: 'businessCard' as const, id: 'x' },
      { ...createEmptyCard(), front: undefined as any },
      { ...createEmptyCard(), back: undefined as any },
      { ...createEmptyCard(), style: undefined as any },
    ];
    for (const input of cases) {
      const merged = mergeCardWithDefaults(input as any);
      const parsed = businessCardSchema.safeParse(merged);
      expect(parsed.success).toBe(true);
    }
  });
});

describe('mergeLogoWithDefaults', () => {
  it('returns a full empty logo when input is null', () => {
    const result = mergeLogoWithDefaults(null);
    const base = createEmptyLogo();
    expect(result.builder).toEqual(base.builder);
  });

  it('returns a full empty logo when input is undefined', () => {
    const result = mergeLogoWithDefaults(undefined);
    expect(result.builder.layout).toBe('horizontal');
    expect(result.builder.primaryText).toBe('');
  });

  it('fills in missing builder with defaults (regression: builder.X of undefined)', () => {
    // The editor and SVG generator both read builder.layout /
    // builder.primaryText / builder.icons. A saved logo without
    // builder crashed at the first read. The merge restores the
    // full builder from createEmptyLogo().
    const partial = {
      documentType: 'logo' as const,
      id: 'logo_legacy',
      title: 'Old logo',
      // builder is missing entirely
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const merged = mergeLogoWithDefaults(partial as any);
    expect(merged.builder.layout).toBe('horizontal');
    expect(merged.builder.primaryText).toBe('');
    expect(merged.id).toBe('logo_legacy');
  });

  it('preserves user-set builder.primaryText, layout, icons', () => {
    const partial = {
      ...createEmptyLogo(),
      builder: {
        ...createEmptyLogo().builder,
        primaryText: 'Acme',
        layout: 'vertical' as const,
        icons: ['stethoscope'],
      },
    };
    const merged = mergeLogoWithDefaults(partial);
    expect(merged.builder.primaryText).toBe('Acme');
    expect(merged.builder.layout).toBe('vertical');
    expect(merged.builder.icons).toEqual(['stethoscope']);
  });

  it('merged result passes the logoSchema validation', () => {
    const cases = [
      null,
      undefined,
      { documentType: 'logo' as const, id: 'x' },
      { ...createEmptyLogo(), builder: undefined as any },
    ];
    for (const input of cases) {
      const merged = mergeLogoWithDefaults(input as any);
      const parsed = logoSchema.safeParse(merged);
      expect(parsed.success).toBe(true);
    }
  });
});
