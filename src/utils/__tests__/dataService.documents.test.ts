import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import dataService from '../dataService';
import { compressDataUrl } from '../card/imageCompress';
import { createGiovanniQrTemplate } from '../documentSchemas';

vi.mock('../card/imageCompress', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../card/imageCompress')>();
  return {
    ...actual,
    compressDataUrl: vi.fn(async (value: string) => `data:image/jpeg;base64,COMPRESSED_${value.length}`),
  };
});

const mockCompressDataUrl = compressDataUrl as unknown as ReturnType<typeof vi.fn>;

const LS_KEY = 'precisionQuote_documents:v1';

describe('dataService documents (local path)', () => {
  const lsBefore: Record<string, string> = {};
  const originalLocation = window.location;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    Object.keys(localStorage).forEach((k) => {
      lsBefore[k] = localStorage.getItem(k) || '';
      localStorage.removeItem(k);
    });
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, hostname: 'localhost' },
      writable: true,
      configurable: true,
    });
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    mockCompressDataUrl.mockClear();
    mockCompressDataUrl.mockImplementation(async (value: string) => `data:image/jpeg;base64,COMPRESSED_${value.length}`);
  });

  afterEach(() => {
    localStorage.clear();
    Object.entries(lsBefore).forEach(([k, v]) => {
      if (v) localStorage.setItem(k, v);
    });
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true });
  });

  it('saveDocument stores in precisionQuote_documents:v1 key', async () => {
    const qr = { ...createGiovanniQrTemplate(), userEmail: 'user@test.com' };
    const result = await dataService.saveDocument('user@test.com', qr);
    expect(result.success).toBe(true);
    const stored = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(qr.id);
  });

  it('saveDocument overwrites by id (no duplicates)', async () => {
    const qr = { ...createGiovanniQrTemplate(), userEmail: 'user@test.com' };
    await dataService.saveDocument('user@test.com', qr);
    const updated = { ...qr, title: 'Updated' };
    await dataService.saveDocument('user@test.com', updated);
    const stored = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe('Updated');
  });

  it('getDocuments returns all for the email', async () => {
    const qr1 = { ...createGiovanniQrTemplate(), id: 'qr-1', userEmail: 'user@test.com' };
    const qr2 = { ...createGiovanniQrTemplate(), id: 'qr-2', userEmail: 'user@test.com' };
    const qr3 = { ...createGiovanniQrTemplate(), id: 'qr-3', userEmail: 'other@test.com' };
    await dataService.saveDocument('user@test.com', qr1);
    await dataService.saveDocument('user@test.com', qr2);
    await dataService.saveDocument('other@test.com', qr3);
    const { documents } = await dataService.getDocuments('user@test.com');
    expect(documents).toHaveLength(2);
    expect(documents.map((d: any) => d.id).sort()).toEqual(['qr-1', 'qr-2']);
  });

  it('getDocuments filters by documentType', async () => {
    const qr = { ...createGiovanniQrTemplate(), id: 'qr-1', userEmail: 'user@test.com' };
    const fake = { ...qr, id: 'card-1', documentType: 'businessCard', userEmail: 'user@test.com' };
    await dataService.saveDocument('user@test.com', qr);
    await dataService.saveDocument('user@test.com', fake);
    const { documents } = await dataService.getDocuments('user@test.com', 'qrCode');
    expect(documents).toHaveLength(1);
    expect(documents[0].id).toBe('qr-1');
  });

  describe('getDocuments hydration (regression: draft CRM envelope invisibili in Collection)', () => {
    // Shape identica a autoBuildCustomer (dataService.js): dominio dentro `data`.
    const seedCrmDraft = () => {
      const draft = {
        id: 'logo_crm1',
        userEmail: 'user@test.com',
        customerId: 'cust_pad',
        documentType: 'logo',
        title: 'Logo PAD thai',
        status: 'BOZZA',
        documentTheme: 'corporate',
        data: {
          documentType: 'logo',
          title: 'Logo PAD thai',
          builder: { primaryText: 'PAD thai', backgroundImage: 'data:image/png;base64,BG' },
          briefContext: 'ristorante thai',
          autoGeneratePending: false,
        },
        createdAt: '2026-07-30T00:00:00.000Z',
        updatedAt: '2026-07-30T00:00:00.000Z',
      };
      localStorage.setItem(LS_KEY, JSON.stringify([draft]));
      return draft;
    };

    it('appiattisce i draft CRM envelope: builder.backgroundImage leggibile flat', async () => {
      seedCrmDraft();
      const { documents } = await dataService.getDocuments('user@test.com');
      expect(documents).toHaveLength(1);
      expect(documents[0].builder.backgroundImage).toBe('data:image/png;base64,BG');
      expect(documents[0].builder.primaryText).toBe('PAD thai');
    });

    it('preserva customerId/status/documentTheme dai draft envelope', async () => {
      seedCrmDraft();
      const { documents } = await dataService.getDocuments('user@test.com');
      expect(documents[0].customerId).toBe('cust_pad');
      expect(documents[0].status).toBe('BOZZA');
      expect(documents[0].documentTheme).toBe('corporate');
    });

    it('doc flat da editor passa invariato', async () => {
      const flatLogo = {
        id: 'logo_flat',
        userEmail: 'user@test.com',
        documentType: 'logo',
        title: 'Logo flat',
        customerId: 'cust_9',
        status: 'BOZZA',
        builder: { primaryText: 'Flat', backgroundImage: 'data:image/png;base64,FLAT' },
        createdAt: '2026-07-30T00:00:00.000Z',
        updatedAt: '2026-07-30T00:00:00.000Z',
      };
      localStorage.setItem(LS_KEY, JSON.stringify([flatLogo]));
      const { documents } = await dataService.getDocuments('user@test.com');
      expect(documents[0]).toMatchObject({
        id: 'logo_flat',
        customerId: 'cust_9',
        builder: { primaryText: 'Flat', backgroundImage: 'data:image/png;base64,FLAT' },
      });
    });

    it('doc QR flat con style passa invariato (no ramo qrCode su dati flat)', async () => {
      const qr = { ...createGiovanniQrTemplate(), id: 'qr-flat', userEmail: 'user@test.com' };
      await dataService.saveDocument('user@test.com', qr);
      const { documents } = await dataService.getDocuments('user@test.com');
      expect(documents[0].id).toBe('qr-flat');
      expect(documents[0].documentType).toBe('qrCode');
      expect(documents[0].style).toEqual(qr.style);
    });

    it('doc generatedImage flat conserva imageData (regression: preview Collection persa)', async () => {
      const genImg = {
        id: 'genimg_1',
        userEmail: 'user@test.com',
        documentType: 'generatedImage',
        title: 'Bigliettino · Icona',
        imageData: 'data:image/png;base64,ICON',
        imageCategory: 'cards',
        imageSource: 'icon',
        createdAt: '2026-07-30T00:00:00.000Z',
        updatedAt: '2026-07-30T00:00:00.000Z',
      };
      localStorage.setItem(LS_KEY, JSON.stringify([genImg]));
      const { documents } = await dataService.getDocuments('user@test.com');
      expect(documents[0]).toMatchObject({
        id: 'genimg_1',
        imageData: 'data:image/png;base64,ICON',
        imageCategory: 'cards',
        imageSource: 'icon',
      });
    });
  });

  describe('storage canonico flat per logo/card/flyer (regression doppio formato)', () => {
    it('save envelope dopo save flat: niente chiave data, builder NUOVO in storage e in getDocuments', async () => {
      // (1) save editor precedente: doc FLAT con builder vecchio
      await dataService.saveDocument('user@test.com', {
        id: 'logo-mix',
        documentType: 'logo',
        title: 'Logo PAD thai',
        userEmail: 'user@test.com',
        builder: { primaryText: 'Vecchio', backgroundImage: null },
      });
      // (2) save CRM "Genera bozze AI" (saveDraft): ENVELOPE con builder nuovo
      await dataService.saveDocument('user@test.com', {
        id: 'logo-mix',
        documentType: 'logo',
        title: 'Logo PAD thai',
        customerId: 'cust_pad',
        status: 'BOZZA',
        data: { builder: { primaryText: 'Nuovo', backgroundImage: 'data:image/jpeg;base64,NEW' } },
      });
      // (3) il record in storage è flat: niente doppio formato
      const stored = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].data).toBeUndefined();
      expect(stored[0].builder.backgroundImage).toBe('data:image/jpeg;base64,NEW');
      expect(stored[0].builder.primaryText).toBe('Nuovo');
      expect(stored[0].status).toBe('BOZZA');
      expect(stored[0].customerId).toBe('cust_pad');
      // getDocuments (CollectionView) vede il builder NUOVO, non quello stale
      const { documents } = await dataService.getDocuments('user@test.com');
      expect(documents[0].builder.backgroundImage).toBe('data:image/jpeg;base64,NEW');
      expect(documents[0].builder.primaryText).toBe('Nuovo');
    });

    it('QR flat con data payload NON viene spogliato della chiave data', async () => {
      const qr = { ...createGiovanniQrTemplate(), id: 'qr-data', userEmail: 'user@test.com' };
      await dataService.saveDocument('user@test.com', qr);
      const stored = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      expect(stored[0].data).toBeDefined();
      expect(stored[0].data.type).toBe('url');
      expect(stored[0].data.payload).toBe(qr.data.payload);
    });

    it('getCustomer espone lo shim data sui doc flat (CRM legge doc.data.*)', async () => {
      localStorage.setItem('pq_customers:v1', JSON.stringify([
        { id: 'cust_shim', businessName: 'Bar Da Mario', status: 'new' },
      ]));
      localStorage.setItem(LS_KEY, JSON.stringify([{
        id: 'logo_shim',
        userEmail: 'admin@gmail.com',
        customerId: 'cust_shim',
        documentType: 'logo',
        title: 'Logo Bar Da Mario',
        status: 'BOZZA',
        autoGeneratePending: true,
        builder: { primaryText: 'Bar Da Mario', backgroundImage: 'data:image/png;base64,BG' },
      }]));
      const res = await dataService.getCustomer('cust_shim');
      expect(res.data.documents).toHaveLength(1);
      expect(res.data.documents[0].data.autoGeneratePending).toBe(true);
      expect(res.data.documents[0].data.builder.primaryText).toBe('Bar Da Mario');
      expect(res.data.documents[0].data.builder.backgroundImage).toBe('data:image/png;base64,BG');
    });
  });

  it('deleteDocument removes by id', async () => {
    const qr = { ...createGiovanniQrTemplate(), id: 'qr-1', userEmail: 'user@test.com' };
    await dataService.saveDocument('user@test.com', qr);
    await dataService.deleteDocument('qr-1', 'user@test.com');
    const { documents } = await dataService.getDocuments('user@test.com');
    expect(documents).toHaveLength(0);
  });

  it('saveDocument stamps userEmail even if document omits it', async () => {
    const qr = { ...createGiovanniQrTemplate(), id: 'qr-stamp' };
    delete (qr as any).userEmail;
    await dataService.saveDocument('user@test.com', qr);
    const { documents } = await dataService.getDocuments('user@test.com');
    expect(documents).toHaveLength(1);
    expect(documents[0].userEmail).toBe('user@test.com');
  });

  it('saveDocument bumps updatedAt on every local save (regression: editor reset effect non scattava su doc risalvato dal CRM)', async () => {
    const logo = {
      ...createGiovanniQrTemplate(),
      id: 'logo-bump',
      documentType: 'logo',
      userEmail: 'user@test.com',
      builder: { primaryText: 'Pad thai', backgroundImage: null },
    };
    await dataService.saveDocument('user@test.com', logo);
    const first = JSON.parse(localStorage.getItem(LS_KEY) || '[]')[0];
    await new Promise((r) => setTimeout(r, 10));
    await dataService.saveDocument('user@test.com', { ...logo, builder: { primaryText: 'Pad thai', backgroundImage: 'data:image/png;base64,BG' } });
    const second = JSON.parse(localStorage.getItem(LS_KEY) || '[]')[0];
    expect(second.updatedAt).not.toBe(first.updatedAt);
    expect(second.builder.backgroundImage).toBe('data:image/png;base64,BG');
  });

  it('saveDocument returns a structured error when localStorage.setItem fails (QuotaExceeded)', async () => {
    const logo = {
      ...createGiovanniQrTemplate(),
      id: 'logo-1',
      documentType: 'logo',
      userEmail: 'user@test.com',
      builder: { backgroundImage: 'x'.repeat(6_000_000) },
    };
    const realSetItem = Storage.prototype.setItem;
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, val: string) {
      if (key === LS_KEY) {
        const e = new Error('QuotaExceeded');
        e.name = 'QuotaExceededError';
        throw e;
      }
      return realSetItem.call(this, key, val);
    });
    try {
      const result = await dataService.saveDocument('user@test.com', logo);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Spazio locale esaurito/i);
      expect(localStorage.getItem(LS_KEY)).toBeNull();
    } finally {
      setItemSpy.mockRestore();
    }
  });

  describe('compressione base64 pre-save (QuotaExceeded prevention)', () => {
    const bigDataUrl = () => `data:image/png;base64,${'A'.repeat(500_000)}`;

    it('comprime i campi immagine noti >300KB nel documento flat', async () => {
      const card = {
        ...createGiovanniQrTemplate(),
        id: 'card-big',
        documentType: 'businessCard',
        userEmail: 'user@test.com',
        front: { name: 'Mario', photoUrl: bigDataUrl(), logoUrl: bigDataUrl(), coverImageUrl: bigDataUrl() },
        back: { coverImageUrl: bigDataUrl() },
      };
      const result = await dataService.saveDocument('user@test.com', card);
      expect(result.success).toBe(true);
      const stored = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      expect(stored[0].front.photoUrl).toMatch(/^data:image\/jpeg;base64,COMPRESSED_/);
      expect(stored[0].front.logoUrl).toMatch(/^data:image\/jpeg;base64,COMPRESSED_/);
      expect(stored[0].front.coverImageUrl).toMatch(/^data:image\/jpeg;base64,COMPRESSED_/);
      expect(stored[0].back.coverImageUrl).toMatch(/^data:image\/jpeg;base64,COMPRESSED_/);
      expect(mockCompressDataUrl).toHaveBeenCalledTimes(4);
    });

    it('comprime builder.backgroundImage e content.heroImage da payload envelope (appiattito a flat)', async () => {
      const doc = {
        id: 'env-1',
        documentType: 'logo',
        title: 'Logo',
        userEmail: 'user@test.com',
        data: {
          builder: { backgroundImage: bigDataUrl() },
          content: { heroImage: bigDataUrl() },
        },
      };
      const result = await dataService.saveDocument('user@test.com', doc);
      expect(result.success).toBe(true);
      const stored = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      // Storage canonico flat: l'envelope viene appiattito, niente chiave data.
      expect(stored[0].data).toBeUndefined();
      expect(stored[0].builder.backgroundImage).toMatch(/^data:image\/jpeg;base64,COMPRESSED_/);
      expect(stored[0].content.heroImage).toMatch(/^data:image\/jpeg;base64,COMPRESSED_/);
    });

    it('non tocca immagini piccole o valori non data-URL', async () => {
      const card = {
        ...createGiovanniQrTemplate(),
        id: 'card-small',
        documentType: 'businessCard',
        userEmail: 'user@test.com',
        front: { name: 'Mario', photoUrl: 'data:image/png;base64,QUJD', logoUrl: '/logo.png', coverImageUrl: null },
      };
      await dataService.saveDocument('user@test.com', card);
      expect(mockCompressDataUrl).not.toHaveBeenCalled();
      const stored = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      expect(stored[0].front.photoUrl).toBe('data:image/png;base64,QUJD');
      expect(stored[0].front.logoUrl).toBe('/logo.png');
    });

    it('se la compressione fallisce il valore originale resta e il save va a buon fine', async () => {
      mockCompressDataUrl.mockImplementation(async (value: string) => value);
      const card = {
        ...createGiovanniQrTemplate(),
        id: 'card-fallback',
        documentType: 'businessCard',
        userEmail: 'user@test.com',
        front: { photoUrl: bigDataUrl() },
      };
      const result = await dataService.saveDocument('user@test.com', card);
      expect(result.success).toBe(true);
      const stored = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      expect(stored[0].front.photoUrl).toBe(bigDataUrl());
    });

    it('preserva customerId dal documento esistente se non passato', async () => {
      const base = { ...createGiovanniQrTemplate(), id: 'doc-cust', documentType: 'businessCard', userEmail: 'user@test.com', customerId: 'cust_123' };
      await dataService.saveDocument('user@test.com', base);
      await dataService.saveDocument('user@test.com', { id: 'doc-cust', documentType: 'businessCard', title: 'Aggiornato', data: { front: { name: 'Nuovo' } } });
      const stored = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      expect(stored[0].customerId).toBe('cust_123');
      expect(stored[0].title).toBe('Aggiornato');
    });

    it('sovrascrive customerId se passato esplicitamente', async () => {
      const base = { ...createGiovanniQrTemplate(), id: 'doc-cust2', documentType: 'businessCard', userEmail: 'user@test.com', customerId: 'cust_123' };
      await dataService.saveDocument('user@test.com', base);
      await dataService.saveDocument('user@test.com', { id: 'doc-cust2', documentType: 'businessCard', customerId: 'cust_456', title: 'Aggiornato' });
      const stored = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      expect(stored[0].customerId).toBe('cust_456');
    });
  });

  describe('getDocument (URL Document-ID Routing)', () => {
    it('returns the matching document by id, email and type', async () => {
      const qr = { ...createGiovanniQrTemplate(), id: 'qr-1', userEmail: 'user@test.com' };
      const card = { ...qr, id: 'card-1', documentType: 'businessCard' };
      await dataService.saveDocument('user@test.com', qr);
      await dataService.saveDocument('user@test.com', card);
      const doc = await dataService.getDocument('user@test.com', 'qr-1', 'qrCode');
      expect(doc).not.toBeNull();
      expect(doc?.id).toBe('qr-1');
      expect(doc?.documentType).toBe('qrCode');
    });

    it('returns null when id is not found', async () => {
      const qr = { ...createGiovanniQrTemplate(), id: 'qr-1', userEmail: 'user@test.com' };
      await dataService.saveDocument('user@test.com', qr);
      const doc = await dataService.getDocument('user@test.com', 'missing', 'qrCode');
      expect(doc).toBeNull();
    });

    it('returns null when userEmail does not match (ownership guard)', async () => {
      const qr = { ...createGiovanniQrTemplate(), id: 'qr-1', userEmail: 'user@test.com' };
      await dataService.saveDocument('user@test.com', qr);
      const doc = await dataService.getDocument('other@test.com', 'qr-1', 'qrCode');
      expect(doc).toBeNull();
    });

    it('returns null when documentType does not match', async () => {
      const qr = { ...createGiovanniQrTemplate(), id: 'qr-1', userEmail: 'user@test.com' };
      await dataService.saveDocument('user@test.com', qr);
      const doc = await dataService.getDocument('user@test.com', 'qr-1', 'businessCard');
      expect(doc).toBeNull();
    });

    it('calls the API in non-local mode', async () => {
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, hostname: 'example.com' },
        writable: true,
        configurable: true,
      });
      vi.resetModules();
      const ds = (await import('../dataService')).default;
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'qr-1', documentType: 'qrCode', userEmail: 'user@test.com', data: { type: 'url', payload: 'x' } } }),
      } as any);
      const doc = await ds.getDocument('user@test.com', 'qr-1', 'qrCode');
      expect(fetchMock).toHaveBeenCalledWith('/api/documents/qr-1?email=user%40test.com&type=qrCode', expect.any(Object));
      expect(doc?.id).toBe('qr-1');
    });
  });
});
