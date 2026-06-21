import { describe, it, expect } from 'vitest';
import { needsAnalysis } from '../promptUtils';

describe('needsAnalysis', () => {
  it('returns true for analysis-style prompts (Italian)', () => {
    expect(needsAnalysis('Cosa miglioreresti di questo preventivo?')).toBe(true);
    expect(needsAnalysis('Come posso migliorare il testo?')).toBe(true);
    expect(needsAnalysis('Suggerisci delle modifiche')).toBe(true);
    expect(needsAnalysis('Analizza questo preventivo')).toBe(true);
    expect(needsAnalysis('Dimmi cosa ne pensi')).toBe(true);
    expect(needsAnalysis('Spiega perché è costoso')).toBe(true);
    expect(needsAnalysis('Perché conviene questa opzione?')).toBe(true);
    expect(needsAnalysis('Consigli per migliorare')).toBe(true);
  });

  it('returns true for analysis-style prompts (English)', () => {
    expect(needsAnalysis('What can you improve?')).toBe(true);
    expect(needsAnalysis('Suggest some changes')).toBe(true);
    expect(needsAnalysis('Analyze this quote')).toBe(true);
  });

  it('returns false for direct modify requests', () => {
    expect(needsAnalysis('Applica uno sconto del 10%')).toBe(false);
    expect(needsAnalysis('Rendi il preventivo più professionale')).toBe(false);
    expect(needsAnalysis('Semplifica il documento')).toBe(false);
    expect(needsAnalysis('Cambia il colore in blu')).toBe(false);
    expect(needsAnalysis('Aggiungi una clausola FAQ')).toBe(false);
    expect(needsAnalysis('Rinomina opzione 2 in Premium')).toBe(false);
    expect(needsAnalysis('Apply 10% discount')).toBe(false);
    expect(needsAnalysis('Make it more professional')).toBe(false);
  });

  it('returns false for empty or whitespace input', () => {
    expect(needsAnalysis('')).toBe(false);
    expect(needsAnalysis('   ')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(needsAnalysis('COSA MIGLIORERESTI?')).toBe(true);
    expect(needsAnalysis('cosa miglioreresti?')).toBe(true);
    expect(needsAnalysis('Cosa Miglioreresti?')).toBe(true);
  });

  it('detects analysis intent at any position in the prompt', () => {
    expect(needsAnalysis('Per questo preventivo, cosa suggerisci?')).toBe(true);
    expect(needsAnalysis('Spiegami il problema')).toBe(true);
  });
});
