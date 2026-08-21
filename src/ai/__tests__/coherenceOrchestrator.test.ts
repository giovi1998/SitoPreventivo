import { describe, it, expect } from 'vitest';
import { cohereDrafts } from '../coherenceOrchestrator';

describe('cohereDrafts t21', () => {
  it('copia palette logo su card/flyer/website', () => {
    const logo = { builder: { primaryColor: '#FF0000', secondaryColor: '#00FF00' } } as never;
    const card = { style: { accentColor: '#000000' }, decorations: { palette: { primary: '#000000' } } } as never;
    const flyer = { style: { accentColor: '#111111' } } as never;
    const website = { brief: { preferredColors: '#000000' } } as never;
    const patch = cohereDrafts({ logo, card, flyer, website });
    expect((patch.card as unknown as { style?: { accentColor?: string } })?.style?.accentColor).toBe('#FF0000');
    expect((patch.flyer as unknown as { style?: { accentColor?: string } })?.style?.accentColor).toBe('#FF0000');
    expect(patch.website?.preferredColors).toBe('#FF0000,#00FF00');
  });

  it('senza logo → nessun patch', () => {
    const card = { style: { accentColor: '#000000' } } as never;
    expect(cohereDrafts({ card })).toEqual({});
  });

  it('palette già coerente → nessun patch', () => {
    const logo = { builder: { primaryColor: '#123456', secondaryColor: '#654321' } } as never;
    const card = { style: { accentColor: '#123456' }, decorations: { palette: { primary: '#123456' } } } as never;
    const patch = cohereDrafts({ logo, card });
    // card già #123456, flyer mancante, website mancante → solo flyer/website mancanti non generano patch per card
    expect(patch.card).toBeUndefined();
  });
});
