import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compressCardImages } from '../saveCompression';
import type { BusinessCard } from '../../documentSchemas';

vi.mock('../imageCompress', () => ({
  compressDataUrl: vi.fn(async (val: string) => {
    if (val.startsWith('data:') && val.length > 100) {
      return 'data:image/jpeg;base64,COMPRESSED';
    }
    return val;
  }),
}));

function makeCard(overrides: Partial<BusinessCard> = {}): BusinessCard {
  return {
    id: 'test-1',
    documentType: 'businessCard',
    title: 'Test',
    userEmail: 'test@example.com',
    front: {
      name: 'Mario', title: 'Dev', company: 'Acme',
      photoUrl: null, logoUrl: null, coverImageUrl: null,
      logoBackground: 'none', layout: 'left', useGrid: false,
    },
    back: {
      phone: '', email: '', website: '', address: '', vatNumber: '',
      services: [], servicesLabel: 'Servizi', socials: [],
      qrPayload: '', qrLabel: '', qrSize: 'medium',
      coverImageUrl: null, useGrid: false,
    },
    decorations: { pattern: null, opacity: 0.2, palette: { primary: '#000', secondary: '#fff', accent: '#888', text: '#000', background: '#fff' }, userLocked: false } as unknown as import('../../../utils/documentSchemas').BusinessCard['decorations'],
    grid: {},
    backGrid: {},
    style: { borderRadius: 'none', borderColor: '#000', borderWidth: 1, fontFamily: 'Inter', fontScale: 1, textColor: '#000', bgColor: '#fff', theme: 'modern' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as BusinessCard;
}

describe('compressCardImages', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('passes through null image fields unchanged', async () => {
    const card = makeCard();
    const result = await compressCardImages(card);
    expect(result.front.photoUrl).toBeNull();
    expect(result.front.logoUrl).toBeNull();
    expect(result.front.coverImageUrl).toBeNull();
    expect(result.back.coverImageUrl).toBeNull();
  });

  it('passes through http URLs unchanged', async () => {
    const card = makeCard({
      front: { ...makeCard().front, photoUrl: 'https://example.com/photo.jpg' },
    });
    const result = await compressCardImages(card);
    expect(result.front.photoUrl).toBe('https://example.com/photo.jpg');
  });

  it('compresses base64 data URL images', async () => {
    const bigDataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(500);
    const card = makeCard({
      front: { ...makeCard().front, coverImageUrl: bigDataUrl, photoUrl: bigDataUrl },
      back: { ...makeCard().back, coverImageUrl: bigDataUrl },
    });
    const result = await compressCardImages(card);
    expect(result.front.coverImageUrl).toBe('data:image/jpeg;base64,COMPRESSED');
    expect(result.front.photoUrl).toBe('data:image/jpeg;base64,COMPRESSED');
    expect(result.back.coverImageUrl).toBe('data:image/jpeg;base64,COMPRESSED');
  });

  it('usa budget persistenza 1200px/400KB (native-res 1K)', async () => {
    const { compressDataUrl } = await import('../imageCompress');
    const bigDataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(500);
    const card = makeCard({
      front: { ...makeCard().front, photoUrl: bigDataUrl },
    });
    await compressCardImages(card);
    expect(vi.mocked(compressDataUrl)).toHaveBeenCalledWith(bigDataUrl, 1200, 400_000);
  });

  it('does not mutate the original card', async () => {
    const bigDataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(500);
    const card = makeCard({
      front: { ...makeCard().front, coverImageUrl: bigDataUrl },
    });
    await compressCardImages(card);
    expect(card.front.coverImageUrl).toBe(bigDataUrl);
  });
});
