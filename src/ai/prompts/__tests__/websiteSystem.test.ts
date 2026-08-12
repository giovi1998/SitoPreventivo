import { describe, it, expect } from 'vitest';
import { buildWebsiteHtmlPrompt, buildWebsiteCssPrompt, buildWebsiteVerifyPrompt, buildWebsitePagePrompt, sanitizeMapAddress } from '../websiteSystem';

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

  it('sanitizeMapAddress filtra telefono/email/URL dai contatti', () => {
    expect(sanitizeMapAddress('Via Dante 5/A, Cagliari, 3405669008, x@y.it, https://site.it')).toBe('Via Dante 5/A Cagliari');
    expect(sanitizeMapAddress('Via Dante 5/A, 3405669008')).toBe('Via Dante 5/A');
  });

  it('sanitizeMapAddress include città (3 segmenti, Italy opzionale)', () => {
    // "Via Dante Alighieri, 5/A" spezza l'indirizzo in 2 segmenti → Cagliari
    // è il 3° (Italy il 4°, tagliato). Cagliari presente = mappa corretta.
    expect(sanitizeMapAddress('Via Dante Alighieri, 5/A, Cagliari, Italy, 3405669008, chiccheriacagliari@gmail.com')).toBe('Via Dante Alighieri 5/A Cagliari');
    // Indirizzo in un solo segmento → Cagliari + Italy entrano nei 3.
    expect(sanitizeMapAddress('Via Dante Alighieri 5/A, Cagliari, 09124, Italy')).toBe('Via Dante Alighieri 5/A Cagliari Italy');
  });

  it('mappa obbligatoria anche SENZA mapsUrl, se c\'è un indirizzo nei contatti', () => {
    const noMaps = { ...baseBrief, mapsUrl: '' };
    const prompt = buildWebsiteHtmlPrompt(noMaps, 'modern');
    expect(prompt).toContain('MAPPA OBBLIGATORIA');
    expect(prompt).toContain('https://www.google.com/maps?q=Via%20Dante%205%2FA%20Cagliari&output=embed');
  });

  it('senza mapsUrl e senza indirizzo → nessun iframe mappa', () => {
    const noContact = { ...baseBrief, mapsUrl: '', contacts: '' };
    const prompt = buildWebsiteHtmlPrompt(noContact, 'modern');
    expect(prompt).not.toContain('MAPPA OBBLIGATORIA');
    expect(prompt).not.toContain('google.com/maps');
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

  it('HTML prompt: vieta esplicitamente gli SVG', () => {
    const prompt = buildWebsiteHtmlPrompt(baseBrief, 'elegant');
    expect(prompt).toContain('SVG');
    expect(prompt).toContain('NON creare MAI tag <svg>');
  });

  it('HTML prompt: istruzioni multi-pagina con link relativi', () => {
    const prompt = buildWebsiteHtmlPrompt(baseBrief, 'elegant');
    expect(prompt).toContain('MULTI-PAGINA');
    expect(prompt).toContain('href="about.html"');
  });

  it('page prompt: genera pagina dedicata con nav identica e senza SVG/emoji', () => {
    const prompt = buildWebsitePagePrompt('about', {
      businessName: 'Gelateria Chiccheria',
      description: 'Gelateria artigianale',
      tone: 'amichevole',
      target: 'giovani',
      cta: 'Assaggia',
      contacts: 'Via Dante 5',
      socials: [],
    }, '<header class="nav"><div class="nav-inner"><div class="brand">Nome</div></div></header>');
    expect(prompt).toContain('Genera SOLO la struttura HTML della pagina "about"');
    expect(prompt).toContain('NAV DA USARE IDENTICA');
    expect(prompt).toContain('NON creare MAI tag <svg>');
    expect(prompt).toContain('.current-year');
    expect(prompt).toContain('NON usare emoji');
  });

  it('verify prompt: check accessibilità + divieti ::before/::after con contenuto e SVG', () => {
    const prompt = buildWebsiteVerifyPrompt('<h1>x</h1>', 'h1{}', '');
    expect(prompt).toContain('ACCESSIBILITÀ');
    expect(prompt).toContain('aria-label');
    expect(prompt).toContain('contrasto');
    expect(prompt).toContain('::before');
    expect(prompt).toContain('content: ""');
    expect(prompt).toContain('tag <svg>');
  });

  it('CSS prompt: pseudo-elementi solo con content vuoto, no SVG', () => {
    const prompt = buildWebsiteCssPrompt('<div class="hero"></div>', 'modern', {});
    expect(prompt).toContain('content: "" obbligatorio');
    expect(prompt).toContain('NON stilizzare MAI tag <svg>');
  });
});
