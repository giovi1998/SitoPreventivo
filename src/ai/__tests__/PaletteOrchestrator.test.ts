import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paletteConceptSchema, paletteConceptsSchema, PaletteAIOrchestrator, type PaletteConcept } from '../PaletteOrchestrator';

const validConcept: PaletteConcept = {
  name: 'Caldo Tradizionale',
  primary: '#7c2d12',
  secondary: '#b45309',
  accent: '#dc2626',
  bg: '#fffbeb',
  text: '#1c1917',
  rationale: 'Ispirata alla cucina sarda tradizionale.',
};

describe('TB-027 B5 paletteConceptSchema', () => {
  it('accetta concept valido', () => {
    const r = paletteConceptSchema.safeParse(validConcept);
    expect(r.success).toBe(true);
  });

  it('rifiuta hex non valido', () => {
    const r = paletteConceptSchema.safeParse({ ...validConcept, primary: 'red' });
    expect(r.success).toBe(false);
  });

  it('rifiuta name vuoto', () => {
    const r = paletteConceptSchema.safeParse({ ...validConcept, name: '' });
    expect(r.success).toBe(false);
  });
});

describe('TB-027 B5 paletteConceptsSchema', () => {
  it('accetta array di 3', () => {
    const r = paletteConceptsSchema.safeParse([validConcept, { ...validConcept, name: 'B' }, { ...validConcept, name: 'C' }]);
    expect(r.success).toBe(true);
  });

  it('rifiuta array di 2', () => {
    const r = paletteConceptsSchema.safeParse([validConcept, { ...validConcept, name: 'B' }]);
    expect(r.success).toBe(false);
  });

  it('rifiuta array di 4', () => {
    const r = paletteConceptsSchema.safeParse([validConcept, validConcept, validConcept, validConcept]);
    expect(r.success).toBe(false);
  });
});

describe('TB-027 B5 PaletteAIOrchestrator smoke', () => {
  it('orchestrator istanziabile', () => {
    const o = new PaletteAIOrchestrator();
    expect(o.getProviderList().length).toBeGreaterThan(0);
  });

  it('useAIPalette import works', async () => {
    const mod = await import('../../hooks/useAIPalette');
    expect(typeof mod.useAIPalette).toBe('function');
  });
});