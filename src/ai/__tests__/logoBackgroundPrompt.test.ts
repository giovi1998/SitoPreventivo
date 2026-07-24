import { describe, it, expect } from 'vitest';
import { buildBackgroundPrompt } from '../logoOrchestrator';

describe('logo background prompt negative constraints', () => {
  it('forbids text, QR, logos, faces, people, real objects, watermarks', () => {
    const prompt = buildBackgroundPrompt(
      { activity: 'Pizzeria', mood: 'warm', target: 'famiglie' },
      '#01696F',
      '#1a1a2e',
    ).toLowerCase();

    expect(prompt).toContain('no text');
    expect(prompt).toContain('no letters');
    expect(prompt).toContain('no words');
    expect(prompt).toContain('no readable typography');
    expect(prompt).toContain('no numbers');
    expect(prompt).toContain('no qr codes');
    expect(prompt).toContain('no barcodes');
    expect(prompt).toContain('no logos');
    expect(prompt).toContain('no symbols');
    expect(prompt).toContain('no faces');
    expect(prompt).toContain('no people');
    expect(prompt).toContain('no silhouettes');
    expect(prompt).toContain('no real-world objects');
    expect(prompt).toContain('no ui elements');
    expect(prompt).toContain('no recognizable brand icons');
    expect(prompt).toContain('no watermarks');
  });
});
