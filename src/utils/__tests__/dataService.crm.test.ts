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

  // Regression: research server-side chiama Firecrawl (fino a 120s) ma il
  // timeout default di api() è 5s → il client abortiva e il server consumava
  // comunque lo slot rate-limit orario ("Research già lanciata" al retry).
  it('researchCustomer usa timeout esteso (>5s default) per Firecrawl', async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementation((_url: string, opts: RequestInit) => new Promise((_res, reject) => {
        opts.signal?.addEventListener('abort', () => {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }));
      const p = dataService.researchCustomer('cust_x');
      let settled = false;
      void p.then(() => { settled = true; });
      await vi.advanceTimersByTimeAsync(5000);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(126000);
      await p;
      expect(settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('aiFillCustomer usa timeout esteso (>5s default) per il provider AI', async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementation((_url: string, opts: RequestInit) => new Promise((_res, reject) => {
        opts.signal?.addEventListener('abort', () => {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }));
      const p = dataService.aiFillCustomer('cust_x');
      let settled = false;
      void p.then(() => { settled = true; });
      await vi.advanceTimersByTimeAsync(5000);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(56000);
      await p;
      expect(settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
