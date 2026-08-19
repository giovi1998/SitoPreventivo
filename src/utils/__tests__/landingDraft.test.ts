import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildLandingWebsite, exportLandingZip, colorFromName } from '../landingDraft';
import type { LandingDraftInput } from '../landingDraft';

const saveAsMock = vi.fn();
vi.mock('file-saver', () => ({ saveAs: (blob: Blob, name: string) => saveAsMock(blob, name) }));

const zipState = vi.hoisted(() => ({
  files: [] as Array<{ name: string; content: unknown }>,
  folders: [] as string[],
  reset() {
    this.files = [];
    this.folders = [];
  },
}));

vi.mock('jszip', () => ({
  default: class MockZip {
    folder(name: string) {
      zipState.folders.push(name);
      return this;
    }
    file(name: string, content: unknown) {
      zipState.files.push({ name, content });
      return this;
    }
    async generateAsync() {
      return new Blob(['zip'], { type: 'application/zip' });
    }
  },
}));

beforeEach(() => {
  zipState.reset();
  saveAsMock.mockClear();
});

function makeInput(overrides: Partial<LandingDraftInput> = {}): LandingDraftInput {
  return {
    businessName: 'Panetteria Rossi',
    webAnswers: {
      headline: 'Il pane di una volta, ogni mattina',
      offer: 'Pane artigianale, focacce e dolci da forno a legna.',
      cta: 'Prenota ora',
      tone: 'caldo e familiare',
    },
    preferredColors: 'blu notte e oro',
    activity: 'Panificio artigianale dal 1960',
    contacts: { phone: '333 1234567', email: 'info@panetteriarossi.it', address: 'Via Roma 1, Milano', website: 'https://panetteriarossi.it' },
    socials: [{ platform: 'Instagram', url: '@panetteriarossi' }],
    ...overrides,
  };
}

describe('colorFromName', () => {
  it('è deterministica: stesso nome → stesso colore', () => {
    expect(colorFromName('blu notte e oro')).toBe(colorFromName('blu notte e oro'));
  });

  it('nomi diversi → colori diversi', () => {
    expect(colorFromName('blu notte e oro')).not.toBe(colorFromName('rosso e crema'));
  });

  it('ritorna un colore CSS valido', () => {
    expect(colorFromName('verde')).toMatch(/^hsl\(\d+(\.\d+)?,\s*\d+%,\s*\d+%\)$/);
  });
});

describe('buildLandingWebsite', () => {
  it('mappa headline/offer/cta da webAnswers nella hero', () => {
    const site = buildLandingWebsite(makeInput());
    expect(site.html).toContain('Il pane di una volta, ogni mattina');
    expect(site.html).toContain('Pane artigianale, focacce e dolci da forno a legna.');
    expect(site.html).toContain('Prenota ora');
    expect(site.brief?.businessName).toBe('Panetteria Rossi');
    expect(site.brief?.cta).toBe('Prenota ora');
  });

  it('fallback: flyer headline/body quando webAnswers manca', () => {
    const site = buildLandingWebsite(
      makeInput({
        webAnswers: null,
        flyer: {
          content: { headline: 'Fresco ogni giorno', body: 'Impasto madre e lievitazione naturale.', cta: { label: 'Scopri' } },
          style: { accentColor: '#E11D48' },
        },
      }),
    );
    expect(site.html).toContain('Fresco ogni giorno');
    expect(site.html).toContain('Impasto madre e lievitazione naturale.');
    expect(site.html).toContain('Scopri');
  });

  it('fallback: activity quando mancano webAnswers e flyer', () => {
    const site = buildLandingWebsite(makeInput({ webAnswers: null, flyer: null }));
    expect(site.html).toContain('Panificio artigianale dal 1960');
  });

  it('fallback: businessName come headline quando tutto manca', () => {
    const site = buildLandingWebsite({ businessName: 'Bar Centrale' });
    expect(site.html).toContain('Bar Centrale');
  });

  it('include contatti (telefono, email, indirizzo, sito) nella sezione contatti', () => {
    const site = buildLandingWebsite(makeInput());
    expect(site.html).toContain('333 1234567');
    expect(site.html).toContain('info@panetteriarossi.it');
    expect(site.html).toContain('Via Roma 1, Milano');
    expect(site.html).toContain('https://panetteriarossi.it');
  });

  it('include social nel footer', () => {
    const site = buildLandingWebsite(makeInput());
    expect(site.html).toContain('Instagram');
    expect(site.html).toContain('@panetteriarossi');
  });

  it('palette derivata da preferredColors nel CSS', () => {
    const site = buildLandingWebsite(makeInput());
    expect(site.css).toContain('--accent');
    expect(site.css).toContain(colorFromName('blu notte e oro'));
  });

  it('propaga logoUrl al website per l\'export in assets', () => {
    const logo = 'data:image/png;base64,QUJDRA==';
    const site = buildLandingWebsite(makeInput({ logoUrl: logo }));
    expect(site.logoUrl).toBe(logo);
  });

  it('escape HTML nei testi utente', () => {
    const site = buildLandingWebsite(makeInput({ webAnswers: { headline: '<script>alert(1)</script>' } }));
    expect(site.html).not.toContain('<script>alert(1)</script>');
    expect(site.html).toContain('&lt;script&gt;');
  });

  it('genera html completo (doctype + body) e css con variabili palette', () => {
    const site = buildLandingWebsite(makeInput());
    expect(site.html).toContain('<!DOCTYPE html>');
    expect(site.html).toContain('</body>');
    expect(site.css).toContain(':root{--accent:');
  });
});

describe('exportLandingZip', () => {
  it('scarica ZIP con index.html e nome dal businessName', async () => {
    const res = await exportLandingZip(makeInput());
    expect(saveAsMock).toHaveBeenCalledWith(expect.any(Blob), 'sito-Panetteria Rossi.zip');
    expect(zipState.files.some((f) => f.name === 'index.html')).toBe(true);
    expect(res.fileName).toBe('sito-Panetteria Rossi.zip');
  });

  it('sposta il logo in assets/', async () => {
    const logo = 'data:image/png;base64,QUJDRA==';
    await exportLandingZip(makeInput({ logoUrl: logo }));
    expect(zipState.folders).toContain('sito-Panetteria Rossi/assets');
    expect(zipState.files.some((f) => f.name === 'logo.jpg')).toBe(true);
  });
});
