import { describe, expect, it } from 'vitest';
import { buildCardCoverPayload, resolveCardCoverLogo } from '../coverImage';
import type { BusinessCard } from '../../documentSchemas';

const sampleCard: BusinessCard = {
  documentType: 'businessCard',
  id: 'card-cover-test-1',
  title: 'Test Card',
  front: {
    name: 'Giovanni Cidu',
    title: 'Developer',
    company: 'Antigravity Tech',
    layout: 'centered',
    photoUrl: null,
    logoUrl: null,
    coverImageUrl: null,
    logoBackground: 'none',
    useGrid: false,
  },
  back: {
    phone: '+39 340 1234567',
    email: 'giovanni@example.com',
    website: '',
    address: '',
    vatNumber: '',
    services: [],
    servicesLabel: '',
    socials: [],
    qrPayload: '',
    qrLabel: '',
    qrSize: 'medium',
    coverImageUrl: null,
    useGrid: false,
  },
  style: {
    sizePreset: 'eu-85x55',
    bgColor: '#ffffff',
    textColor: '#0f172a',
    accentColor: '#2563eb',
    fontFamily: 'Inter',
    borderStyle: 'none',
    fontScale: 1,
  },
  grid: { cols: 4, rows: 4, elements: {} },
  backGrid: { cols: 4, rows: 4, elements: {} },
  decorations: { pattern: null, opacity: 0.2, palette: { primary: '#2563eb', secondary: '#0f172a', accent: null }, userLocked: false },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('aiCoverImage client-side payload helpers (TB-005)', () => {
  it('resolveCardCoverLogo returns undefined if card has no logoUrl', async () => {
    const res = await resolveCardCoverLogo(sampleCard);
    expect(res).toBeUndefined();
  });

  it('buildCardCoverPayload constructs valid request payload', () => {
    const payload = buildCardCoverPayload(
      'An abstract wave pattern',
      'Context details',
      {
        cardImage: 'data:image/jpeg;base64,mockCardImg',
        logoImage: 'data:image/jpeg;base64,mockLogoImg',
      },
      'front',
      'user@example.com',
      'gemini-3.1-flash-image'
    );

    expect(payload.prompt).toBe('An abstract wave pattern');
    expect(payload.context).toBe('Context details');
    expect(payload.side).toBe('front');
    expect(payload.userEmail).toBe('user@example.com');
    expect(payload.imageModel).toBe('gemini-3.1-flash-image');
    expect(payload.cardImage).toBe('data:image/jpeg;base64,mockCardImg');
    expect(payload.logoImage).toBe('data:image/jpeg;base64,mockLogoImg');
  });

  it('buildCardCoverPayload prunes logoImage first when exceeding body budget', () => {
    const hugeLogo = 'data:image/jpeg;base64,' + 'B'.repeat(1_000_000);
    const payload = buildCardCoverPayload(
      'Test prompt',
      'Test context',
      {
        cardImage: 'data:image/jpeg;base64,smallCard',
        logoImage: hugeLogo,
      },
      'back',
      'user@example.com'
    );

    expect(payload.prompt).toBe('Test prompt');
    expect(payload.logoImage).toBeUndefined();
    expect(payload.cardImage).toBe('data:image/jpeg;base64,smallCard');
  });
});
