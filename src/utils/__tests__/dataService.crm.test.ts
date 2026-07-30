import { describe, it, expect, beforeEach, vi } from 'vitest';

// Prod path: IS_LOCAL è singleton di modulo, lo forziamo a false via mock.
vi.mock('../dataService/core.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../dataService/core.js')>();
  return { ...actual, IS_LOCAL: false };
});

import dataService from '../dataService';

describe('dataService CRM (prod path, query string)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  // Regression: senza status l'URL era `/api/customers&adminEmail=...` (404 in prod).
  it('getCustomers senza status → URL con ?adminEmail', async () => {
    await dataService.getCustomers();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/customers?adminEmail=admin%40gmail.com');
  });

  it('getCustomers con status preserva entrambi i parametri', async () => {
    await dataService.getCustomers('new');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/customers?status=new&adminEmail=admin%40gmail.com');
  });

  it('getIntakes senza status → URL con ?adminEmail', async () => {
    await dataService.getIntakes();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/intakes?adminEmail=admin%40gmail.com');
  });

  it('getIntakes con status preserva entrambi i parametri', async () => {
    await dataService.getIntakes('new');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/intakes?status=new&adminEmail=admin%40gmail.com');
  });
});
