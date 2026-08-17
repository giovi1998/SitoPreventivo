import { describe, it, expect } from 'vitest';
import { analyzeLogo } from '../logoAnalyzer';
import { createEmptyLogo } from '../../schemas/logo';

describe('analyzeLogo', () => {
  it('segnala testo principale vuoto', () => {
    const logo = createEmptyLogo();
    const res = analyzeLogo(logo);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.includes('Testo principale è vuoto'))).toBe(true);
  });

  it('segnala backgroundImage senza textBackdrop', () => {
    const logo = createEmptyLogo();
    logo.builder.primaryText = 'Acme';
    logo.builder.backgroundImage = 'data:image/png;base64,xxx';
    logo.builder.textBackdrop = 'none';
    const res = analyzeLogo(logo);
    expect(res.issues.some((i) => i.includes('textBackdrop'))).toBe(true);
  });

  it('ok su logo completo', () => {
    const logo = createEmptyLogo();
    logo.builder.primaryText = 'Acme';
    logo.builder.primaryColor = '#000000';
    logo.builder.backgroundColor = '#ffffff';
    const res = analyzeLogo(logo);
    expect(res.ok).toBe(true);
  });
});
