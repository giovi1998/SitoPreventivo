import { describe, it, expect } from 'vitest';
import { buildOnboardingSystemPrompt, buildOnboardingSuggestPrompt, sanitizeOnboardingName } from '../onboardingSystem';

describe('onboardingSystem (AI assist)', () => {
  it('system prompt declares 4 contract fields', () => {
    const p = buildOnboardingSystemPrompt();
    expect(p).toContain('displayName');
    expect(p).toContain('companySuggestions');
    expect(p).toContain('professionSuggestions');
    expect(p).toContain('defaultColor');
  });

  it('system prompt forbids inventing PII (email/telefono/indirizzo)', () => {
    const p = buildOnboardingSystemPrompt();
    expect(p.toLowerCase()).toContain('non inventare');
    expect(p.toLowerCase()).toContain('email');
    expect(p.toLowerCase()).toContain('telefono');
  });

  it('suggest prompt embeds name and sector', () => {
    const p = buildOnboardingSuggestPrompt('Giovanni', 'ristorante');
    expect(p).toContain('Giovanni');
    expect(p).toContain('ristorante');
  });

  it('suggest prompt for ristorante mentions Chef', () => {
    const p = buildOnboardingSuggestPrompt('Mario', 'ristorante');
    expect(p).toContain('Chef');
    expect(p).toContain('E62020');
  });

  it('suggest prompt for tech mentions Sviluppatore and 01696F', () => {
    const p = buildOnboardingSuggestPrompt('Alice', 'tech');
    expect(p).toContain('Sviluppatore');
    expect(p).toContain('01696F');
  });

  it('suggest prompt with no sector uses default generici', () => {
    const p = buildOnboardingSuggestPrompt('Luca');
    expect(p).toContain('Settore: (non specificato');
    expect(p).toContain('Professionista');
  });

  it('sanitize strips HTML and trims to 50', () => {
    expect(sanitizeOnboardingName('  <b>Giovanni</b>  ')).toBe('Giovanni');
    expect(sanitizeOnboardingName('a'.repeat(60)).length).toBe(50);
  });
});
