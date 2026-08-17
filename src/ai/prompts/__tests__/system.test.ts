import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../system';

describe('buildSystemPrompt', () => {
  it('compact prompt contains all tool names', () => {
    const p = buildSystemPrompt(true);
    expect(p).toContain('apply_discount');
    expect(p).toContain('adjust_margin');
    expect(p).toContain('round_prices');
    expect(p).toContain('check_consistency');
  });
  it('compact prompt mentions response is JSON only', () => {
    const p = buildSystemPrompt(true);
    expect(p).toMatch(/JSON/);
    expect(p).toMatch(/Solo/);
  });
  it('full prompt contains all editable fields', () => {
    const p = buildSystemPrompt(false);
    expect(p).toContain('project.title');
    expect(p).toContain('paymentTerms');
    expect(p).toContain('uiPreferences');
  });
  it('prompt does NOT contain typos (bug fix: "Non chiamate." truncated, "univa azione")', () => {
    const p = buildSystemPrompt(true);
    expect(p).not.toContain('Non chiamate.');
    expect(p).not.toContain('univa azione');
  });
  it('compact prompt declares CAMPI NON MODIFICABILI and names total/summary/globalTotals', () => {
    const p = buildSystemPrompt(true);
    expect(p).toContain('CAMPI NON MODIFICABILI');
    expect(p).toContain('total');
    expect(p).toContain('summary');
    expect(p).toContain('globalTotals');
  });
  it('compact prompt contains negative examples (validate_quote as unica azione)', () => {
    const p = buildSystemPrompt(true);
    expect(p).toMatch(/ESEMPI NEGATIVI/i);
    expect(p).toContain('validate_quote');
  });
  it('compact prompt length is bounded (≤2500 chars)', () => {
    const p = buildSystemPrompt(true);
    expect(p.length).toBeLessThanOrEqual(2500);
  });
  it('compact prompt orders to preserve ALL existing elements and ALL brief elements', () => {
    const p = buildSystemPrompt(true);
    expect(p).toMatch(/PRESERVA TUTTI GLI ELEMENTI ESISTENTI/i);
    expect(p).toMatch(/TUTTI GLI ELEMENTI DEL BRIEF DEVONO ESSERCI/i);
    expect(p).toMatch(/senza richiesta esplicita|a meno che l'utente non lo chieda esplicitamente/i);
  });
});
