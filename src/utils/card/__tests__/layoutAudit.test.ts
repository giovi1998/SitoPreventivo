import { describe, it, expect } from 'vitest';
import { createGiovanniCardTemplate, createEmptyCard } from '../../documentSchemas';
import { auditExportSvg } from '../layoutAudit';
import { buildCardSvg } from '../svgRenderer';

describe('layoutAudit', () => {
  const H = 1100;
  const W = Math.round(H * (85 / 55));

  it('passes for Giovanni back export', () => {
    const card = createGiovanniCardTemplate();
    const svg = buildCardSvg(card, 'back', W, H);
    const audit = auditExportSvg('back', svg, card);
    expect(audit.ok).toBe(true);
    expect(audit.findings.filter((f) => f.severity === 'error')).toHaveLength(0);
  });

  it('does not flag logo too small on real Giovanni export', () => {
    const card = createGiovanniCardTemplate();
    const svg = buildCardSvg(card, 'front', W, H);
    const audit = auditExportSvg('front', svg, card);
    expect(audit.findings.some((f) => f.code === 'LOGO_TOO_SMALL')).toBe(false);
  });

  it('reports missing TELEFONO on empty back', () => {
    const card = createEmptyCard();
    card.back.phone = '';
    card.back.email = '';
    card.back.website = '';
    const svg = buildCardSvg(card, 'back', W, H);
    const audit = auditExportSvg('back', svg, card);
    expect(audit.findings.some((f) => f.code === 'MISSING_TEXT' && f.message.includes('TELEFONO'))).toBe(true);
  });

  it('handles social-only back without crash', () => {
    const card = createEmptyCard();
    card.back.socials = [{ platform: 'LinkedIn', url: 'https://linkedin.com/in/x' }];
    card.back.phone = '';
    card.back.email = '';
    card.back.website = '';
    const svg = buildCardSvg(card, 'back', W, H);
    const audit = auditExportSvg('back', svg, card);
    expect(audit.findings.some((f) => f.code === 'MISSING_TEXT' && f.message.includes('socials'))).toBe(false);
  });
});
