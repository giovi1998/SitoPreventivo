import { describe, it, expect, beforeEach } from 'vitest';

describe('TB-027 A1: autoBuildCustomer LOCAL shape flat (storage canonico, regression bozze vuote/doppio formato)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('crea 3 draft (no social v1) con shape flat + briefContext', async () => {
    localStorage.setItem('pq_customers:v1', JSON.stringify([{
      id: 'cust_1', businessName: 'Bar Da Mario', ownerName: 'Mario', sector: 'bar',
      activity: 'Cucina sarda', contacts: { email: 'm@e.it', phone: '333' }, customerPhotos: [],
    }]));
    const ds = (await import('../dataService')).default;
    const res = await ds.autoBuildCustomer('cust_1', false);
    expect(res.data.createdDocuments).toHaveLength(3);
    const docs = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
    expect(docs).toHaveLength(3);
    expect(docs.map((d: any) => d.documentType)).toEqual(['logo', 'businessCard', 'flyer']);
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
  });

  it('skip logo draft se detectedLogoUrl presente (admin ha già logo)', async () => {
    localStorage.setItem('pq_customers:v1', JSON.stringify([{
      id: 'cust_1', businessName: 'Bar', ownerName: 'Mario', sector: 'bar',
      detectedLogoUrl: 'data:image/x-icon;base64,xyz',
    }]));
    const ds = (await import('../dataService')).default;
    const res = await ds.autoBuildCustomer('cust_1', false);
    expect(res.data.createdDocuments).toHaveLength(2);
    const docs = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
    expect(docs.map((d: any) => d.documentType)).toEqual(['businessCard', 'flyer']);
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
    expect(first.data.createdDocuments).toHaveLength(3);
    const second = await ds.autoBuildCustomer('cust_1', false);
    expect(second.data.createdDocuments).toHaveLength(3);
    const docs = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
    // 3 bozze nuove + 1 confermato = 4, non 7
    expect(docs).toHaveLength(4);
    expect(docs.filter((d: any) => d.status === 'BOZZA')).toHaveLength(3);
    expect(docs.find((d: any) => d.id === 'flyer_confirmed')).toBeTruthy();
    // le bozze del primo giro sono state eliminate
    for (const oldId of first.data.createdDocuments) {
      expect(docs.find((d: any) => d.id === oldId)).toBeUndefined();
    }
  });

  it('cliente non trovato → error', async () => {
    localStorage.setItem('pq_customers:v1', JSON.stringify([]));
    const ds = (await import('../dataService')).default;
    const res = await ds.autoBuildCustomer('nope', false);
    expect(res.error).toBe('Cliente non trovato');
  });
});
