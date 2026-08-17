import { describe, it, expect } from 'vitest';
import { contrastRatio, isValidHex, checkContrast, checkEmptyText, finishAnalysis } from '../sharedAnalyzer';

describe('sharedAnalyzer', () => {
  it('isValidHex: accetta 3/6 cifre, rifiuta altro', () => {
    expect(isValidHex('#fff')).toBe(true);
    expect(isValidHex('#FFFFFF')).toBe(true);
    expect(isValidHex('red')).toBe(false);
    expect(isValidHex('#GGGGGG')).toBe(false);
    expect(isValidHex(null)).toBe(false);
  });

  it('contrastRatio: bianco su nero alto, stesso colore = 1', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeGreaterThan(10);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 1);
  });

  it('checkContrast: segnala sotto 3:1', () => {
    const issues: string[] = [];
    checkContrast(issues, '#ffffff', '#ffffff', 'Testo');
    expect(issues.some((i) => i.includes('contrasto basso'))).toBe(true);
  });

  it('checkContrast: ok sopra 3:1', () => {
    const issues: string[] = [];
    checkContrast(issues, '#000000', '#ffffff', 'Testo');
    expect(issues).toEqual([]);
  });

  it('checkEmptyText: segnala vuoto', () => {
    const issues: string[] = [];
    checkEmptyText(issues, '  ', 'Nome');
    expect(issues).toContain('Nome è vuoto.');
  });

  it('finishAnalysis: cap a 8 issues', () => {
    const issues = Array.from({ length: 12 }, (_, i) => `issue ${i}`);
    const res = finishAnalysis(issues);
    expect(res.ok).toBe(false);
    expect(res.issues).toHaveLength(8);
  });
});
