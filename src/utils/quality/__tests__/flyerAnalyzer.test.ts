import { describe, it, expect } from 'vitest';
import { analyzeFlyer } from '../flyerAnalyzer';
import { createEmptyFlyer } from '../../schemas/flyer';

describe('analyzeFlyer', () => {
  it('segnala headline vuota', () => {
    const flyer = createEmptyFlyer();
    const res = analyzeFlyer(flyer);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.includes('Headline è vuoto'))).toBe(true);
  });

  it('ok su flyer con copy', () => {
    const flyer = createEmptyFlyer();
    flyer.content.headline = 'Sagra del paese';
    flyer.content.body = 'Vieni a mangiare';
    flyer.style.textColor = '#000000';
    flyer.style.bgColor = '#ffffff';
    const res = analyzeFlyer(flyer);
    expect(res.ok).toBe(true);
  });
});
