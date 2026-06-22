import { describe, it, expect } from 'vitest';
import { detectCardRelevantFields, buildCardAIContext } from '../cardContext';
import { createEmptyCard, createGiovanniCardTemplate } from '../../../utils/documentSchemas';
import type { BusinessCard } from '../../../utils/documentSchemas';

describe('detectCardRelevantFields', () => {
  it('detects "nome" keyword → front field', () => {
    const f = detectCardRelevantFields('cambia nome in Mario');
    expect(f.has('front')).toBe(true);
  });

  it('detects "colore" / "palette" → style field', () => {
    expect(detectCardRelevantFields('cambia colore').has('style')).toBe(true);
    expect(detectCardRelevantFields('cambia palette').has('style')).toBe(true);
  });

  it('detects "layout" → front field', () => {
    expect(detectCardRelevantFields('usa layout centrato').has('front')).toBe(true);
  });

  it('detects "telefono" / "email" → back field', () => {
    expect(detectCardRelevantFields('cambia telefono').has('back')).toBe(true);
    expect(detectCardRelevantFields('modifica email').has('back')).toBe(true);
  });

  it('detects "social" / "linkedin" → back field', () => {
    expect(detectCardRelevantFields('aggiungi linkedin').has('back')).toBe(true);
    expect(detectCardRelevantFields('modifica social').has('back')).toBe(true);
  });

  it('detects "qr" → back field', () => {
    expect(detectCardRelevantFields('cambia qr').has('back')).toBe(true);
  });

  it('detects "font" → style field', () => {
    expect(detectCardRelevantFields('cambia font').has('style')).toBe(true);
  });

  it('detects "bordo" / "border" → style field', () => {
    expect(detectCardRelevantFields('cambia bordo').has('style')).toBe(true);
  });

  it('detects "premium" / "minimal" → style + front', () => {
    const f = detectCardRelevantFields('rendi premium');
    expect(f.has('style')).toBe(true);
    expect(f.has('front')).toBe(true);
  });

  it('detects "stampa" / "print" → analysis field', () => {
    expect(detectCardRelevantFields('ottimizza per stampa').has('analysis')).toBe(true);
  });

  it('returns empty set for unrelated prompt', () => {
    const f = detectCardRelevantFields('hello world');
    expect(f.size).toBe(0);
  });
});

describe('buildCardAIContext', () => {
  it('includes style always (for palette changes)', () => {
    const card = createEmptyCard();
    const { payload } = buildCardAIContext(card, 'ciao');
    expect(payload.style).toBeDefined();
  });

  it('includes front when prompt mentions nome', () => {
    const card = createEmptyCard();
    const { payload, relevantFields } = buildCardAIContext(card, 'cambia nome');
    expect(payload.front).toBeDefined();
    expect(relevantFields).toContain('front');
  });

  it('includes back when prompt mentions telefono', () => {
    const card = createEmptyCard();
    const { payload, relevantFields } = buildCardAIContext(card, 'cambia telefono');
    expect(payload.back).toBeDefined();
    expect(relevantFields).toContain('back');
  });

  it('includes front + style when prompt is premium (layout + palette)', () => {
    const card = createGiovanniCardTemplate();
    const { payload } = buildCardAIContext(card, 'rendi premium');
    expect(payload.front).toBeDefined();
    expect(payload.style).toBeDefined();
  });

  it('does NOT include id/documentType/createdAt in payload (internal fields)', () => {
    const card = createEmptyCard();
    const { payload } = buildCardAIContext(card, 'cambia nome');
    expect(payload.id).toBeUndefined();
    expect(payload.documentType).toBeUndefined();
    expect(payload.createdAt).toBeUndefined();
  });

  it('does NOT include photoUrl/logoUrl in front payload (base64 too large)', () => {
    const card: BusinessCard = {
      ...createEmptyCard(),
      front: { ...createEmptyCard().front, photoUrl: 'data:image/png;base64,AAAA', logoUrl: 'data:image/png;base64,BBBB' },
    };
    const { payload } = buildCardAIContext(card, 'cambia nome');
    expect((payload.front as any).photoUrl).toBeUndefined();
    expect((payload.front as any).logoUrl).toBeUndefined();
  });

  it('default relevantFields when none detected', () => {
    const card = createEmptyCard();
    const { relevantFields } = buildCardAIContext(card, 'hello');
    expect(relevantFields.length).toBeGreaterThan(0);
    expect(relevantFields).toContain('style');
  });
});
