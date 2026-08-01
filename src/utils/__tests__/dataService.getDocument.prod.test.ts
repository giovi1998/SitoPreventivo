import { describe, it, expect, vi, beforeEach } from 'vitest';
import dataService from '../dataService';

vi.mock('../dataService/core.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../dataService/core.js')>();
  return { ...actual, IS_LOCAL: false };
});

const prodRow = {
  id: 'flyer_prod1',
  userEmail: 'admin@gmail.com',
  documentType: 'flyer',
  title: 'Volantino Pad Thai',
  customerId: 'cust_pad',
  status: 'BOZZA',
  data: {
    content: { headline: 'Pad Thai', subheadline: 'Osteria thailandese' },
    style: { bgColor: '#FFFBF2', textColor: '#1F2937', accentColor: '#B45309' },
    layout: { format: 'a5', layout: 'classic' },
  },
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
};

describe('dataService.getDocument (PROD path — regression editor vuoto)', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => prodRow,
    })) as unknown as typeof fetch;
  });

  it('ritorna doc con id/documentType corretti anche se la riga ha data jsonb (envelope)', async () => {
    const doc = await dataService.getDocument('admin@gmail.com', 'flyer_prod1', 'flyer');
    expect(doc?.id).toBe('flyer_prod1');
    expect(doc?.documentType).toBe('flyer');
    expect((doc as unknown as { content?: { headline?: string } })?.content?.headline).toBe('Pad Thai');
  });

  it('deleteDocument tratta 404 come successo (idempotente — doc fantasma in UI)', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Documento non trovato' }),
    })) as unknown as typeof fetch;
    const res = await dataService.deleteDocument('card_ghost', 'admin@gmail.com');
    expect(res.success).toBe(true);
  });
});
