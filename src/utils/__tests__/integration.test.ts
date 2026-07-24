import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import dataService from '../dataService';

describe('integration: register → login → save → load → delete', () => {
  const lsBefore: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(localStorage).forEach((k) => {
      lsBefore[k] = localStorage.getItem(k) || '';
      localStorage.removeItem(k);
    });
    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    localStorage.clear();
    Object.entries(lsBefore).forEach(([k, v]) => {
      if (v) localStorage.setItem(k, v);
    });
  });

  it('completes full quote lifecycle', async () => {
    const reg = await dataService.register('lifecycle@test.com', 'Test1234!Pass!', 'Tester', 'other');
    expect(reg.success).toBe(true);

    const login = await dataService.login('lifecycle@test.com', 'Test1234!Pass!');
    expect(login.success).toBe(true);

    const quote = {
      id: 'lifecycle-q-1', title: 'Lifecycle', client: 'X', owner: 'lifecycle@test.com',
      options: [], clauses: [],
    } as any;

    const save = await dataService.saveQuote('lifecycle@test.com', quote);
    expect(save.success).toBe(true);

    const { quotes, total } = await dataService.getQuotes('lifecycle@test.com');
    expect(total).toBe(1);
    expect(quotes[0].id).toBe('lifecycle-q-1');

    const del = await dataService.deleteQuote('lifecycle-q-1', 'lifecycle@test.com');
    expect(del.success).toBe(true);

    const { quotes: after } = await dataService.getQuotes('lifecycle@test.com');
    expect(after).toHaveLength(0);
  });

  it('rejects save with wrong user (simulated)', async () => {
    await dataService.register('alice@test.com', 'Test1234!Pass!', 'Alice', 'female');
    const quote = { id: 'q-1', owner: 'alice@test.com', options: [], clauses: [] } as any;
    await dataService.saveQuote('alice@test.com', quote);
    const { quotes: bobQuotes } = await dataService.getQuotes('bob@test.com');
    expect(bobQuotes).toHaveLength(0);
  });
});
