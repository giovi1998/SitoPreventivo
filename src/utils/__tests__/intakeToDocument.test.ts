import { describe, it, expect } from 'vitest';
import { intakeToLogo, intakeToCard, intakeToFlyer, intakeToSocial, intakeToAllDocuments, type IntakeBrief } from '../intakeToDocument';

const brief: IntakeBrief = {
  businessName: 'Ristorante Da Mario',
  ownerName: 'Mario Rossi',
  sector: 'ristorante',
  activity: 'Cucina sarda tradizionale',
  mood: 'caldo',
  target: 'Famiglie',
  preferredColors: 'rosso',
  contacts: { email: 'mario@example.com', phone: '333', address: 'Via Roma 1', website: 'http://mario.it' },
  package: 'apertura',
};

describe('TB-019 intakeToDocument (shape nested allineata a createEmpty*)', () => {
  it('intakeToLogo popola builder.primaryText e tagline', () => {
    const d = intakeToLogo(brief);
    expect(d.documentType).toBe('logo');
    expect(d.title).toBe('Logo Ristorante Da Mario');
    const builder = d.data.builder as Record<string, unknown>;
    expect(builder.primaryText).toBe('Ristorante Da Mario');
    expect(builder.tagline).toBe('Cucina sarda tradizionale');
    expect(builder.iconType).toBe('lucide');
    expect(builder.iconGlyph).toBe('sparkles');
    // shape base conservata
    expect(builder.layout).toBe('horizontal');
    expect(builder.primaryColor).toBe('#01696F');
  });

  it('intakeToCard popola front.name/company e back.phone/email', () => {
    const d = intakeToCard(brief);
    expect(d.documentType).toBe('businessCard');
    const front = d.data.front as Record<string, unknown>;
    const back = d.data.back as Record<string, unknown>;
    expect(front.name).toBe('Mario Rossi');
    expect(front.company).toBe('Ristorante Da Mario');
    expect(front.title).toBe('ristorante');
    expect(back.phone).toBe('333');
    expect(back.email).toBe('mario@example.com');
    expect(back.website).toBe('http://mario.it');
    expect(back.address).toBe('Via Roma 1');
    // style base conservata
    const style = d.data.style as Record<string, unknown>;
    expect(style.fontFamily).toBe('Inter');
    expect(style.sizePreset).toBe('eu-85x55');
  });

  it('intakeToFlyer popola content.headline e subheadline', () => {
    const d = intakeToFlyer(brief);
    expect(d.documentType).toBe('flyer');
    const content = d.data.content as Record<string, unknown>;
    expect(content.headline).toBe('Ristorante Da Mario');
    expect(content.subheadline).toBe('Cucina sarda tradizionale');
    const style = d.data.style as Record<string, unknown>;
    expect(style.fontFamily).toBe('Inter');
    expect(style.layout).toBe('classic');
  });

  it('intakeToSocial popola caption e brandName', () => {
    const d = intakeToSocial(brief);
    expect(d.documentType).toBe('generatedImage');
    expect((d.data as Record<string, unknown>).brandName).toBe('Ristorante Da Mario');
    expect(String((d.data as Record<string, unknown>).caption)).toContain('Ristorante Da Mario');
    expect(String((d.data as Record<string, unknown>).mood)).toBe('caldo');
  });

  it('intakeToAllDocuments restituisce 3 draft (no social v1)', () => {
    const all = intakeToAllDocuments(brief);
    expect(all).toHaveLength(3);
    expect(all.map((d) => d.documentType)).toEqual(['logo', 'businessCard', 'flyer']);
  });

  it('intakeToLogo include briefContext con dati cliente', () => {
    const d = intakeToLogo(brief);
    expect((d.data as Record<string, unknown>).briefContext).toContain('Ristorante Da Mario');
    expect((d.data as Record<string, unknown>).briefContext).toContain('ristorante');
    expect((d.data as Record<string, unknown>).briefContext).toContain('mario@example.com');
  });

  it('intakeToCard include briefContext', () => {
    const d = intakeToCard(brief);
    expect((d.data as Record<string, unknown>).briefContext).toContain('Via Roma 1');
  });

  it('intakeToLogo con brief vuoto non crasha (fallback)', () => {
    const d = intakeToLogo({ businessName: 'X' });
    const builder = d.data.builder as Record<string, unknown>;
    expect(builder.primaryText).toBe('X');
    expect(builder.tagline).toBe('');
    // shape base conservata anche con brief vuoto
    expect(builder.iconType).toBe('lucide');
  });

  it('intakeToCard con contacts vuoto non crasha', () => {
    const d = intakeToCard({ businessName: 'Y' });
    const back = d.data.back as Record<string, unknown>;
    expect(back.phone).toBe('');
    expect(back.email).toBe('');
  });
});