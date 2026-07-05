import { describe, it, expect } from 'vitest';
import {
  executeCardApplyPalette,
  executeCardSwitchLayout,
  executeCardAddService,
  executeCardRemoveEmptySocials,
  executeFlyerShortenBody,
  executeFlyerAddUrgency,
} from '../cardFlyerExecutors';

describe('cardApplyPalette', () => {
  it('applies premium palette', () => {
    const card = { style: { bgColor: '#ffffff', textColor: '#1a1a1a', accentColor: '#000000' } };
    const { payload, changes } = executeCardApplyPalette({ palette: 'premium' }, card);
    expect((payload as { style: { accentColor: string } }).style.accentColor).toBe('#1e3a5f');
    expect(changes).toContain('premium');
  });

  it('applies minimal palette', () => {
    const card = { style: {} };
    const { payload } = executeCardApplyPalette({ palette: 'minimal' }, card);
    expect((payload as { style: { accentColor: string } }).style.accentColor).toBe('#333333');
  });

  it('applies moderno palette (dark bg)', () => {
    const card = { style: {} };
    const { payload } = executeCardApplyPalette({ palette: 'moderno' }, card);
    expect((payload as { style: { bgColor: string } }).style.bgColor).toBe('#0F1117');
  });

  it('applies classico palette (The Classic)', () => {
    const card = { style: {} };
    const { payload } = executeCardApplyPalette({ palette: 'classico' }, card);
    expect((payload as { style: { accentColor: string } }).style.accentColor).toBe('#E62020');
  });

  it('rejects unknown palette', () => {
    const card = { style: { accentColor: '#000' } };
    const { payload, changes } = executeCardApplyPalette({ palette: 'foo' }, card);
    expect(changes).toContain('sconosciuta');
    expect((payload as { style: { accentColor: string } }).style.accentColor).toBe('#000');
  });
});

describe('cardSwitchLayout', () => {
  it('changes to split', () => {
    const card = { front: { layout: 'centered' } };
    const { payload, changes } = executeCardSwitchLayout({ layout: 'split' }, card);
    expect((payload as { front: { layout: string } }).front.layout).toBe('split');
    expect(changes).toContain('split');
  });

  it('rejects invalid layout', () => {
    const card = { front: { layout: 'centered' } };
    const { payload, changes } = executeCardSwitchLayout({ layout: 'foo' }, card);
    expect(changes).toContain('non valido');
    expect((payload as { front: { layout: string } }).front.layout).toBe('centered');
  });
});

describe('cardAddService', () => {
  it('adds valid service', () => {
    const card = { back: { services: ['Web'] } };
    const { payload, changes } = executeCardAddService({ service: 'API' }, card);
    expect((payload as { back: { services: string[] } }).back.services).toEqual(['Web', 'API']);
    expect(changes).toContain('API');
  });

  it('rejects when cap 8 reached', () => {
    const card = { back: { services: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] } };
    const { payload, changes } = executeCardAddService({ service: 'i' }, card);
    expect(changes).toContain('max 8');
    expect((payload as { back: { services: string[] } }).back.services).toHaveLength(8);
  });

  it('rejects service > 80 char', () => {
    const card = { back: { services: [] } };
    const { payload, changes } = executeCardAddService({ service: 'a'.repeat(81) }, card);
    expect(changes).toContain('80');
  });
});

describe('cardRemoveEmptySocials', () => {
  it('removes empty and XXXXX socials', () => {
    const card = {
      back: {
        socials: [
          { platform: 'ig', url: '' },
          { platform: 'fb', url: 'XXXXX' },
          { platform: 'li', url: 'https://linkedin.com/in/foo' },
        ],
      },
    };
    const { payload, changes } = executeCardRemoveEmptySocials({}, card);
    const socials = (payload as { back: { socials: unknown[] } }).back.socials;
    expect(socials).toHaveLength(1);
    expect(changes).toContain('2');
  });

  it('returns "Nessun" when no empty socials', () => {
    const card = { back: { socials: [{ platform: 'ig', url: 'valid' }] } };
    const { changes } = executeCardRemoveEmptySocials({}, card);
    expect(changes).toContain('Nessun');
  });
});

describe('flyerShortenBody', () => {
  it('truncates to ratio', () => {
    const flyer = { content: { body: 'a'.repeat(1000) } };
    const { payload, changes } = executeFlyerShortenBody({ ratio: 0.5 }, flyer);
    const body = (payload as { content: { body: string } }).content.body;
    expect(body.length).toBeLessThanOrEqual(501);
    expect(changes).toContain('50%');
  });

  it('rejects ratio out of range', () => {
    const flyer = { content: { body: 'short' } };
    const { changes } = executeFlyerShortenBody({ ratio: 0.1 }, flyer);
    expect(changes).toContain('fuori range');
  });
});

describe('flyerAddUrgency', () => {
  it('appends phrase to body', () => {
    const flyer = { content: { body: 'Welcome to the event' } };
    const { payload, changes } = executeFlyerAddUrgency({ phrase: 'Solo oggi' }, flyer);
    const body = (payload as { content: { body: string } }).content.body;
    expect(body).toContain('Welcome');
    expect(body).toContain('Solo oggi');
    expect(changes).toContain('Solo oggi');
  });

  it('rejects empty phrase', () => {
    const flyer = { content: { body: 'x' } };
    const { changes } = executeFlyerAddUrgency({ phrase: '' }, flyer);
    expect(changes).toContain('vuota');
  });

  it('rejects phrase > 50 char', () => {
    const flyer = { content: { body: 'x' } };
    const { changes } = executeFlyerAddUrgency({ phrase: 'a'.repeat(51) }, flyer);
    expect(changes).toContain('50');
  });
});
