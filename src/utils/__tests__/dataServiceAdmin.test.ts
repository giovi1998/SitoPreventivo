import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import dataService from '../dataService';

describe('dataService admin (local path only)', () => {
  const lsBefore: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(localStorage).forEach((k) => {
      lsBefore[k] = localStorage.getItem(k) || '';
      localStorage.removeItem(k);
    });
  });

  afterEach(() => {
    localStorage.clear();
    Object.entries(lsBefore).forEach(([k, v]) => {
      if (v) localStorage.setItem(k, v);
    });
  });

  it('adminGetUsers in local mode reads from localStorage and strips password', async () => {
    localStorage.setItem('registeredUsers', JSON.stringify([
      { email: 'a@b.com', password: 'hashed', username: 'A' },
      { email: 'c@d.com', password: 'hashed', username: 'C' },
    ]));

    const result = await dataService.adminGetUsers('local-cache-1');

    expect(result.users).toHaveLength(2);
    expect(result.users[0]).not.toHaveProperty('password');
    expect(result.users[1]).not.toHaveProperty('password');
  });

  it('adminGetAllQuotes in local mode paginates localStorage', async () => {
    const quotes = Array.from({ length: 5 }, (_, i) => ({
      id: `q-${i}`, title: `Quote ${i}`, owner: 'admin@gmail.com',
    }));
    localStorage.setItem('precisionQuote_quotes', JSON.stringify(quotes));

    const page1 = await dataService.adminGetAllQuotes(1, 2, 'lc-1');
    expect(page1.quotes).toHaveLength(2);
    expect(page1.total).toBe(5);

    const page2 = await dataService.adminGetAllQuotes(2, 2, 'lc-1');
    expect(page2.quotes).toHaveLength(2);
  });

  it('adminUpdateLimits in local mode updates user tokenLimit', async () => {
    localStorage.setItem('registeredUsers', JSON.stringify([
      { email: 'user@test.com', password: 'x', username: 'u', tokenLimit: 100000 },
    ]));

    const result = await dataService.adminUpdateLimits('user@test.com', 2000000);
    expect(result.success).toBe(true);

    const stored = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
    expect(stored[0].tokenLimit).toBe(2000000);
  });
});
