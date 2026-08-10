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

  it('renderBodyAsText renders the body as native <text> without foreignObject', () => {
    const svg = buildFlyerSvg(sampleFlyer, { renderBodyAsText: true });
    expect(svg).not.toContain('foreignObject');
    expect(svg).toContain('<text');
    expect(svg).toContain('Vieni a trovarci in negozio');
  });

  it('short sample body fits without truncation (regression: clipped preview body)', () => {
    const flyer: Flyer = {
      ...sampleFlyer,
      content: {
        ...sampleFlyer.content,
        headline: 'Sagra del Paese',
        subheadline: '15 Agosto - Ingresso Libero',
        body: "Cibo tipico, musica dal vivo, attività per famiglie e fuochi d'artificio.",
        cta: { label: 'Prenota Ora', url: 'https://example.com' },
        qrPayload: 'https://example.com',
        qrLabel: 'Scansiona per info',
      },
    };
    const plan = computeFlyerLayout(flyer);
    expect(plan.text.body.truncated).toBe(false);
    expect(plan.text.body.hidden).toBe(false);
    const svg = buildFlyerSvg(flyer);
    expect(svg).toContain('famiglie e fuochi');
  });
});
