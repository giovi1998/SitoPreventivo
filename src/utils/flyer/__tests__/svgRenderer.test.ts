import { describe, expect, it } from 'vitest';
import { buildFlyerSvg, renderFlyerSvg } from '../svgRenderer';
import { computeFlyerLayout } from '../layoutEngine';
import type { Flyer } from '../../documentSchemas';

const sampleFlyer: Flyer = {
  documentType: 'flyer',
  id: 'test-flyer-svg-1',
  size: 'A5',
  orientation: 'portrait',
  title: 'Test Flyer SVG',
  content: {
    headline: 'OFFERTA SPECIALE',
    subheadline: 'Sconto del 20% su tutti i servizi',
    body: 'Vieni a trovarci in negozio entro fine mese per approfittare della promozione esclusiva.',
    cta: { label: 'Chiama ora 070 123456', url: '' },
    heroImage: null,
    qrPayload: '',
    qrLabel: '',
  },
  style: {
    bgColor: '#ffffff',
    textColor: '#1e293b',
    accentColor: '#e11d48',
    layout: 'classic',
    fontFamily: 'Inter',
    fontScale: 1,
  },
  decorations: { pattern: null, opacity: 0.2, palette: { primary: '#e11d48', secondary: '#1e293b', accent: null }, userLocked: false },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('flyer svgRenderer (TB-007)', () => {
  it('buildFlyerSvg returns non-empty valid SVG string', () => {
    const svg = buildFlyerSvg(sampleFlyer);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('OFFERTA SPECIALE');
    // CTA viene renderizzata uppercase dallo svgRenderer
    expect(svg).toContain('CHIAMA ORA 070 123456');
  });

  it('renderFlyerSvg renders SVG with viewbox matching flyer dimensions', () => {
    const plan = computeFlyerLayout(sampleFlyer);
    const svg = renderFlyerSvg(plan, sampleFlyer);

    expect(svg).toContain('viewBox=');
    expect(svg).toContain(sampleFlyer.style.fontFamily);
  });
});
