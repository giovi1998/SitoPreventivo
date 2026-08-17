import { describe, it, expect } from 'vitest';
import { buildCardSystemPrompt } from '../cardSystem';

describe('buildCardSystemPrompt', () => {
  it('mentions bigliettini da visita (not preventivi)', () => {
    const p = buildCardSystemPrompt();
    expect(p.toLowerCase()).toContain('bigliettin');
  });

  it('lists card-specific fields (front.name, back.phone, style.accentColor)', () => {
    const p = buildCardSystemPrompt();
    expect(p).toContain('front.name');
    expect(p).toContain('back.phone');
    expect(p).toContain('style.accentColor');
  });

  it('declares the 3 layout enum values', () => {
    const p = buildCardSystemPrompt();
    expect(p).toContain('centered');
    expect(p).toContain('left');
    expect(p).toContain('split');
  });

  it('declares the 4 borderStyle enum values', () => {
    const p = buildCardSystemPrompt();
    expect(p).toContain('none');
    expect(p).toContain('thin');
    expect(p).toContain('accent-strip-left');
    expect(p).toContain('accent-strip-bottom');
  });

  it('requires hex color format #RRGGBB', () => {
    const p = buildCardSystemPrompt();
    expect(p).toMatch(/#RRGGBB|#rrggbb|hex/i);
  });

  it('mentions ANALISI mode for print optimization', () => {
    const p = buildCardSystemPrompt();
    expect(p).toMatch(/analisi|analysis/i);
  });

  it('does NOT mention preventivo-specific fields (options, items, legalClauses, paymentTerms)', () => {
    const p = buildCardSystemPrompt();
    expect(p).not.toContain('legalClauses');
    expect(p).not.toContain('paymentTerms');
    expect(p).not.toContain('unitPrice');
  });

  it('declares PALETTE PREDEFINITE with at least 4 entries (premium, minimal, moderno, classico)', () => {
    const p = buildCardSystemPrompt();
    expect(p).toMatch(/PALETTE PREDEFINITE/i);
    expect(p).toContain('premium');
    expect(p).toContain('minimal');
    expect(p).toContain('moderno');
    expect(p).toContain('classico');
    expect(p).toMatch(/#[0-9A-Fa-f]{6}/);
  });

  it('shows collision example for "logo sopra nome" with both elements repositioned', () => {
    const p = buildCardSystemPrompt();
    expect(p.toLowerCase()).toContain('logo');
    expect(p.toLowerCase()).toContain('sopra');
    expect(p.toLowerCase()).toContain('nome');
    expect(p).toMatch(/riposizionat|sposta|nuovo layout|nuova posizione/i);
  });

  it('distinguishes when to use fontScale vs grid resize', () => {
    const p = buildCardSystemPrompt();
    expect(p).toMatch(/QUANDO.*allargare|cell.*vs.*fontScale|fontScale/i);
    expect(p).toContain('fontScale');
    expect(p).toMatch(/photo\.w|qrSize/);
  });

  it('warns against sending photoUrl/logoUrl and visible/enabled placeholders', () => {
    const p = buildCardSystemPrompt();
    expect(p).toMatch(/ESEMPI NEGATIVI|NON inviare/i);
    expect(p).toContain('photoUrl');
    expect(p).toContain('logoUrl');
    expect(p).toContain('visible');
  });

  // ─── Spec card-nudge v2.0 (REQ-AI-004/005) ────────────────────
  it('documents per-element placement (x/y nudge, scale) in the JSON contract', () => {
    const p = buildCardSystemPrompt();
    expect(p).toContain('placement');
    expect(p).toMatch(/placement.*scale|scale.*placement/i);
    expect(p).toMatch(/-1,1|\[-1, ?1\]/); // bound nudge documentato
    expect(p).toMatch(/0\.5[–-]2|\[0\.5, ?2\]/); // bound scale documentato
  });

  it('documents the right-balanced layout in the enum and layout list', () => {
    const p = buildCardSystemPrompt();
    expect(p).toContain('right-balanced');
  });

  it('says to OMIT placement rather than guess it (anti-hallucination, REQ-AI-005)', () => {
    const p = buildCardSystemPrompt();
    expect(p).toMatch(/NON inventare placement.*OMETTILO|OMETTILO.*placement|placement[\s\S]{0,200}OMETTILO/i);
  });

  it('prefers placement.scale over fontScale for per-element text sizing (legacy fontScale)', () => {
    const p = buildCardSystemPrompt();
    expect(p).toMatch(/fontScale.*legacy|legacy.*fontScale/i);
    expect(p).toContain('placement.scale');
  });

  // ─── TB-023 REQ-PD-007: decorations nel prompt ──────────────
  it('documents decorations.pattern with the 5 pattern ids and sector examples', () => {
    const p = buildCardSystemPrompt();
    expect(p).toContain('decorations.pattern');
    expect(p).toContain('wave-bottom');
    expect(p).toContain('blob-corner');
    expect(p).toContain('splash-corners');
    expect(p).toContain('full-overlay');
    expect(p).toContain('wave-split');
    expect(p).toMatch(/food.*wave-bottom|wave-bottom.*food/i);
    expect(p).toMatch(/tech.*blob-corner|blob-corner.*tech/i);
  });

  it('warns that userLocked decorations must not be touched', () => {
    const p = buildCardSystemPrompt();
    expect(p).toMatch(/userLocked/i);
  });

  // ─── Gerarchia tipografica + leggibilità su cover (design review auto-build) ───
  it('declares typographic hierarchy: nome più grande, ruolo medio, azienda più piccola (mai stessa dimensione)', () => {
    const p = buildCardSystemPrompt();
    expect(p).toMatch(/gerarchia/i);
    expect(p).toMatch(/nome[^.]{0,80}(più grande|maggiore)/i);
    expect(p).toMatch(/azienda[^.]{0,80}(più piccola|minore)/i);
    expect(p).toMatch(/mai la stessa dimensione|mai uguali/i);
  });

  it('prefers text placement over quiet/uniform cover areas, avoiding busy zones behind small text', () => {
    const p = buildCardSystemPrompt();
    expect(p).toMatch(/cover/i);
    expect(p).toMatch(/quieta|uniforme|zone libere|aree solide/i);
    expect(p).toMatch(/busy|ricche di dettagli|dettagliate/i);
  });
});
