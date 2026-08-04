import { describe, it, expect } from 'vitest';
import { buildWebsiteHtmlPrompt, buildWebsiteCssPrompt } from '../websiteSystem';

const baseBrief = {
  businessName: 'Gelateria Chiccheria',
  sector: 'gelateria',
  description: 'Gelateria artigianale a Cagliari',
  tone: 'amichevole',
  target: 'giovani',
  pages: 'index',
  preferredColors: '#469bdb',
  font: 'Inter',
  cta: 'Assaggia la differenza',
  sections: 'hero, chi_siamo, contatti',
  features: '',
  contacts: '📍 Via Dante 5/A, Cagliari, 09124',
  socials: [
    { platform: 'Instagram', url: '@gelateriachiccheriacagliari' },
    { platform: 'Facebook', url: 'https://facebook.com/chiccheria' },
  ],
  mapsUrl: 'https://maps.app.goo.gl/abc123',
  notes: '',
};

describe('websiteSystem prompts (maps + socials)', () => {
  it('sanitizza l\'indirizzo: rimuove emoji e prende indirizzo + città', () => {
    const prompt = buildWebsiteHtmlPrompt(baseBrief, 'elegant');
    expect(prompt).not.toContain('%F0%9F%93%8D');
    expect(prompt).toContain('Via%20Dante%205%2FA%20Cagliari');
    expect(prompt).not.toContain('maps?q=%F0%9F%93%8D');
  });

  it('includa TUTTI i social del brief come obbligatori', () => {
    const prompt = buildWebsiteHtmlPrompt(baseBrief, 'elegant');
    expect(prompt).toContain('SOCIAL OBBLIGATORI');
    expect(prompt).toContain('Instagram');
    expect(prompt).toContain('@gelateriachiccheriacagliari');
    expect(prompt).toContain('Facebook');
    expect(prompt).toContain('https://facebook.com/chiccheria');
    expect(prompt).toContain('target="_blank" rel="noopener"');
  });

  it('non genera blocco social se il brief non ha social', () => {
    const noSocial = { ...baseBrief, socials: [] };
    const prompt = buildWebsiteHtmlPrompt(noSocial, 'modern');
    expect(prompt).not.toContain('SOCIAL OBBLIGATORI');
  });

  it('CSS prompt include la firma visiva dello stile', () => {
    const prompt = buildWebsiteCssPrompt('<div class="hero"></div>', 'brutalist', { preferredColors: '#000' });
    expect(prompt).toContain('CARATTERE VISIVO PER STILE');
    expect(prompt).toContain('brutalist');
    expect(prompt).toContain('bordi spessi');
  });

  it('CSS prompt: stile sconosciuto → firma modern fallback', () => {
    const prompt = buildWebsiteCssPrompt('<div></div>', 'non-esiste', {});
    expect(prompt).toContain('Firma: pulito, spazi ariosi');
  });

  it('CSS prompt: font del brief ha priorità massima sullo stile', () => {
    const prompt = buildWebsiteCssPrompt('<div></div>', 'brutalist', { font: 'Playfair Display' });
    expect(prompt).toContain('Font preferito (OBBLIGATORIO, massima priorità): Playfair Display');
    expect(prompt).toContain('NON sostituirlo con la firma dello stile');
    expect(prompt).toContain('--font DEVE essere "Playfair Display"');
  });

  it('HTML prompt: vieta emoji nel brand e testo', () => {
    const prompt = buildWebsiteHtmlPrompt(baseBrief, 'elegant');
    expect(prompt).toContain('EMOJI NEL TESTO');
    expect(prompt).toContain('NON usare emoji nel brand');
  });
});
