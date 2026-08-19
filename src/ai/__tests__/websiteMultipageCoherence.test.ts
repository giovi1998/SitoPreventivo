import { describe, it, expect } from 'vitest';
import { summarizeIndexHtml, buildWebsitePagePrompt, buildWebsiteSystemPrompt } from '../prompts/websiteSystem';

describe('summarizeIndexHtml (TB-034 coerenza multipagina)', () => {
  it('estrare hero title, lead, CTA e sezioni dell\'index', () => {
    const html = [
      '<section class="hero" id="hero"><h1>Panetteria Artigianale dal 1985</h1><p>Pane fresco ogni giorno a Cagliari</p><a href="contatti.html" class="btn btn-primary">Richiedi preventivo</a></section>',
      '<section id="chi-siamo">CHI SIAMO</section><section id="contatti">CONTATTI</section>',
    ].join('');
    const s = summarizeIndexHtml(html);
    expect(s.heroTitle).toBe('Panetteria Artigianale dal 1985');
    expect(s.heroLeadLine).toBe('Pane fresco ogni giorno a Cagliari');
    expect(s.cta).toBe('Richiedi preventivo');
    expect(s.sections).toContain('chi-siamo');
    expect(s.sections).toContain('contatti');
  });

  it('html vuoto → summary vuoto ma valido', () => {
    const s = summarizeIndexHtml('');
    expect(s.heroTitle).toBeNull();
    expect(s.heroLeadLine).toBeNull();
    expect(s.cta).toBeNull();
    expect(s.sections).toEqual([]);
  });
});

describe('buildWebsitePagePrompt (TB-034) — coerenza multipagina', () => {
  const brief = {
    businessName: 'Panetteria Test',
    description: 'Panetteria',
    tone: '',
    target: '',
    cta: 'Richiedi preventivo',
    contacts: '',
    socials: [],
  };
  const navHtml = '<nav class="nav"><div class="nav-inner"><div class="brand">Panetteria Test</div></div></nav>';

  it('se la nav/indexSummary è presente, vieta la ripetizione della CTA e cita le sezioni già usate', () => {
    const indexHtml = [
      '<section class="hero" id="hero"><h1>Pane artigianale dal 1985</h1><p>Pane fresco ogni giorno</p><a class="btn" href="contatti.html">Richiedi preventivo</a></section>',
      '<section id="chi-siamo">x</section><section id="servizi">y</section>',
    ].join('');
    const prompt = buildWebsitePagePrompt('about', brief, navHtml, summarizeIndexHtml(indexHtml));
    expect(prompt).toContain('CONTENUTO GIÀ PRESENTE IN INDEX');
    expect(prompt).toContain('Pane artigianale dal 1985');
    expect(prompt).toContain('Richiedi preventivo');
    expect(prompt).toContain('chi-siamo');
    expect(prompt).toContain('servizi');
  });

  it('senza indexSummary → niente blocco dedupe (fallback pulito)', () => {
    const prompt = buildWebsitePagePrompt('about', brief, navHtml);
    expect(prompt).not.toContain('CONTENUTO GIÀ PRESENTE IN INDEX');
    expect(prompt).toContain('"about"');
  });

  it('richiede breadcrumb/.page-hero con il nome della pagina, non l\'hero home', () => {
    const prompt = buildWebsitePagePrompt('contact', brief, navHtml);
    expect(prompt).toContain('page-hero');
    expect(prompt).toContain('eyebrow');
    expect(prompt).toContain('non un hero identico alla home');
  });

  it('obbliga le classi condivise (coerenza stile tra pagine)', () => {
    const prompt = buildWebsitePagePrompt('about', brief, navHtml);
    expect(prompt).toContain('Riusa ESATTAMENTE');
    expect(prompt).toContain('section-inner');
    expect(prompt).toContain('btn');
    expect(prompt).toContain('page-hero');
  });
});

describe('system prompt coerenza multipagina', () => {
  it('il system prompt elenca la regola M-PAGE coerenza', () => {
    const p = buildWebsiteSystemPrompt();
    expect(p).toContain('Coerenza M-PAGE');
    expect(p).toContain('.page-hero');
  });
});
