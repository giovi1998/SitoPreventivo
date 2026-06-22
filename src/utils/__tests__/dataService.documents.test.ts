import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import dataService from '../dataService';
import { createGiovanniQrTemplate } from '../documentSchemas';

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

  it('deleteDocument removes by id', async () => {
    const qr = { ...createGiovanniQrTemplate(), id: 'qr-1', userEmail: 'user@test.com' };
    await dataService.saveDocument('user@test.com', qr);
    await dataService.deleteDocument('qr-1', 'user@test.com');
    const { documents } = await dataService.getDocuments('user@test.com');
    expect(documents).toHaveLength(0);
  });
});
