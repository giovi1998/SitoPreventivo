import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('TB-027 A1: autoBuildCustomer LOCAL shape flat (storage canonico, regression bozze vuote/doppio formato)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('crea 4 draft (no social v1) con shape flat + briefContext', async () => {
    localStorage.setItem('pq_customers:v1', JSON.stringify([{
      id: 'cust_1', businessName: 'Bar Da Mario', ownerName: 'Mario', sector: 'bar',
      activity: 'Cucina sarda', contacts: { email: 'm@e.it', phone: '333' }, customerPhotos: [],
    }]));
    const ds = (await import('../dataService')).default;
    const res = await ds.autoBuildCustomer('cust_1', false);
    expect(res.data.createdDocuments).toHaveLength(4);
    const docs = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
    expect(docs).toHaveLength(4);
    expect(docs.map((d: any) => d.documentType)).toEqual(['logo', 'businessCard', 'flyer', 'website']);
    // Shape flat: dominio al top level, nessuna chiave `data` envelope.
    for (const d of docs) {
      expect(d.data).toBeUndefined();
      expect(d.status).toBe('BOZZA');
      expect(d.customerId).toBe('cust_1');
    }
    const card = docs.find((d: any) => d.documentType === 'businessCard');
    expect(card.front.name).toBe('Mario');
    expect(card.back.email).toBe('m@e.it');
    expect(card.briefContext).toContain('Bar Da Mario');
    expect(card.briefContext).toContain('m@e.it');
    const logo = docs.find((d: any) => d.documentType === 'logo');
    expect(logo.builder.primaryText).toBe('Bar Da Mario');
    expect(logo.briefContext).toContain('Bar Da Mario');
    const flyer = docs.find((d: any) => d.documentType === 'flyer');
    expect(flyer.content.headline).toBe('Bar Da Mario');
    expect(flyer.briefContext).toContain('Bar Da Mario');
    const website = docs.find((d: any) => d.documentType === 'website');
    expect(website.brief.businessName).toBe('Bar Da Mario');
    expect(website.briefContext).toContain('Bar Da Mario');
  });

  it('skip logo draft se detectedLogoUrl presente (admin ha già logo)', async () => {
    localStorage.setItem('pq_customers:v1', JSON.stringify([{
      id: 'cust_1', businessName: 'Bar', ownerName: 'Mario', sector: 'bar',
      detectedLogoUrl: 'data:image/x-icon;base64,xyz',
    }]));
    const ds = (await import('../dataService')).default;
    const res = await ds.autoBuildCustomer('cust_1', false);
    expect(res.data.createdDocuments).toHaveLength(3);
    const docs = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
    expect(docs.map((d: any) => d.documentType)).toEqual(['businessCard', 'flyer', 'website']);
    expect(docs.find((d: any) => d.documentType === 'logo')).toBeUndefined();
  });

  it('skip logo draft se logoUrl manuale caricato', async () => {
    localStorage.setItem('pq_customers:v1', JSON.stringify([{
      id: 'cust_1', businessName: 'Bar', ownerName: 'Mario', sector: 'bar',
      logoUrl: 'data:image/png;base64,abc',
    }]));
    const ds = (await import('../dataService')).default;
    await ds.autoBuildCustomer('cust_1', false);
    const docs = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
    expect(docs.find((d: any) => d.documentType === 'logo')).toBeUndefined();
    // card usa il logoUrl manuale
    const card = docs.find((d: any) => d.documentType === 'businessCard');
    expect(card.front.logoUrl).toBe('data:image/png;base64,abc');
  });

  it('usa customerPhotos e detectedLogoUrl nei draft', async () => {
    localStorage.setItem('pq_customers:v1', JSON.stringify([{
      id: 'cust_1', businessName: 'Bar', ownerName: 'Mario', sector: 'bar',
      customerPhotos: ['data:image/png;base64,abc'],
    }]));
    const ds = (await import('../dataService')).default;
    await ds.autoBuildCustomer('cust_1', false);
    const docs = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
    const card = docs.find((d: any) => d.documentType === 'businessCard');
    expect(card.front.photoUrl).toBe('data:image/png;base64,abc');
    const flyer = docs.find((d: any) => d.documentType === 'flyer');
    expect(flyer.content.heroImage).toBe('data:image/png;base64,abc');
  });

  it('rerun sostituisce le BOZZE esistenti (no duplicati), non tocca i non-BOZZA', async () => {
    localStorage.setItem('pq_customers:v1', JSON.stringify([{
      id: 'cust_1', businessName: 'Bar Da Mario', ownerName: 'Mario', sector: 'bar', contacts: {},
    }]));
    // Documento confermato del cliente: non deve essere toccato dal rerun.
    localStorage.setItem('precisionQuote_documents:v1', JSON.stringify([{
      id: 'flyer_confirmed', userEmail: 'admin@gmail.com', customerId: 'cust_1',
      documentType: 'flyer', title: 'Flyer confermato', status: 'CONFERMATO', data: {},
    }]));
    const ds = (await import('../dataService')).default;
    const first = await ds.autoBuildCustomer('cust_1', false);
    expect(first.data.createdDocuments).toHaveLength(4);
    const second = await ds.autoBuildCustomer('cust_1', false);
    expect(second.data.createdDocuments).toHaveLength(4);
    const docs = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
    // 4 bozze nuove + 1 confermato = 5, non 9
    expect(docs).toHaveLength(5);
    expect(docs.filter((d: any) => d.status === 'BOZZA')).toHaveLength(4);
    expect(docs.find((d: any) => d.id === 'flyer_confirmed')).toBeTruthy();
    // le bozze del primo giro sono state eliminate
    for (const oldId of first.data.createdDocuments) {
      expect(docs.find((d: any) => d.id === oldId)).toBeUndefined();
    }
  });

  it('RAG: auto-build locale inietta top-k chunk knowledge nel briefContext di TUTTI i draft', async () => {
    localStorage.setItem('pq_customers:v1', JSON.stringify([{
      id: 'cust_1', businessName: 'Panificio Sardo', ownerName: 'Mario', sector: 'panificio',
      activity: 'Pane e dolci sardi', contacts: {},
    }]));
    localStorage.setItem('pq_customer_knowledge:v1', JSON.stringify({
      cust_1: [
        { chunk: 'Cocktail bar in centro a Cagliari.', source: 'firecrawl:homepage', createdAt: '2026-07-29', embedding: [1, 0] },
        { chunk: 'Pane e dolci sardi, forno a legna dal 1980.', source: 'firecrawl:homepage', createdAt: '2026-07-29', embedding: [0, 1] },
      ],
    }));
    // Query embedding "panificio" → [0,1]: top-k seleziona il chunk del panificio.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { embedding: [0, 1] } }),
    }));
    const ds = (await import('../dataService')).default;
    const res = await ds.autoBuildCustomer('cust_1', false);
    expect(res.data.createdDocuments).toHaveLength(4);
    const docs = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
    for (const d of docs) {
      expect(d.briefContext).toContain('Pane e dolci sardi, forno a legna dal 1980');
      expect(d.briefContext).not.toContain('Cocktail bar');
    }
  });

  it('RAG: auto-build locale senza chunk → briefContext invariato', async () => {
    localStorage.setItem('pq_customers:v1', JSON.stringify([{
      id: 'cust_1', businessName: 'Bar', ownerName: 'Mario', sector: 'bar', contacts: {},
    }]));
    const ds = (await import('../dataService')).default;
    await ds.autoBuildCustomer('cust_1', false);
    const docs = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
    expect(docs[0].briefContext).toContain('Attività: Bar');
    expect(docs[0].briefContext).not.toContain('Contenuto sito web');
  });

  it('cliente non trovato → error', async () => {
    localStorage.setItem('pq_customers:v1', JSON.stringify([]));
    const ds = (await import('../dataService')).default;
    const res = await ds.autoBuildCustomer('nope', false);
    expect(res.error).toBe('Cliente non trovato');
  });
});
