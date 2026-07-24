import { describe, it, expect } from 'vitest';
import { getTheme, themes } from '../documentThemes';

describe('documentThemes', () => {
  it('returns minimal theme', () => {
    const t = getTheme('minimal');
    expect(t.label).toBe('Minimal');
    expect(t.description).toBeTruthy();
  });
  it('returns corporate theme', () => {
    const t = getTheme('corporate');
    expect(t.label).toBe('Corporate');
  });
  it('returns creative theme', () => {
    const t = getTheme('creative');
    expect(t.label).toBe('Creative');
  });
  it('themes object contains all 3 themes', () => {
    expect(Object.keys(themes).length).toBe(3);
    expect(themes.minimal).toBeDefined();
    expect(themes.corporate).toBeDefined();
    expect(themes.creative).toBeDefined();
  });
});
