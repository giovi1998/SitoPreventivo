import { describe, it, expect } from 'vitest';
import { buildSocialSystemPrompt, buildSocialGeneratePrompt, buildSocialGenerateAllPrompt } from '../socialSystem';

describe('socialSystem (cross-module)', () => {
  it('system prompt declares 3 posts, one per piattaforma', () => {
    const p = buildSocialSystemPrompt();
    expect(p).toContain('instagram');
    expect(p).toContain('facebook');
    expect(p).toContain('linkedin');
    expect(p).toMatch(/3 post|uno per piattaforma/i);
  });

  it('system prompt limits caption per platform', () => {
    const p = buildSocialSystemPrompt();
    expect(p).toContain('500');
    expect(p).toContain('1000');
    expect(p).toContain('1500');
  });

  it('generate prompt for card embeds name+title+company', () => {
    const p = buildSocialGeneratePrompt(
      { type: 'card', sourceId: 'CARD-1', data: { name: 'Giovanni', title: 'Sviluppatore', company: 'HPE', accentColor: '#01696F', services: ['Web', 'API'] } },
      'professional',
      'linkedin',
    );
    expect(p).toContain('Giovanni');
    expect(p).toContain('HPE');
    expect(p).toContain('linkedin');
    expect(p).toContain('professional');
    expect(p).toContain('1500 char');
  });

  it('generate prompt for flyer embeds headline+cta', () => {
    const p = buildSocialGeneratePrompt(
      { type: 'flyer', sourceId: 'FLY-1', data: { headline: 'Sagra del paese', subheadline: '15 agosto', body: 'ingresso gratis', ctaLabel: 'Vieni!' } },
      'promotional',
      'instagram',
    );
    expect(p).toContain('Sagra del paese');
    expect(p).toContain('Vieni!');
    expect(p).toContain('instagram');
  });

  it('all-platform prompt requests 3 posts', () => {
    const p = buildSocialGenerateAllPrompt(
      { type: 'card', sourceId: 'CARD-1', data: { name: 'Mario', title: 'Chef', company: 'Trattoria', accentColor: '#E62020' } },
      'casual',
    );
    expect(p).toContain('Instagram');
    expect(p).toContain('Facebook');
    expect(p).toContain('LinkedIn');
  });
});
