import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import dataService from '../dataService';

const LEGACY_KEY = 'precisionQuote_quotes';
const DOCS_KEY = 'precisionQuote_documents:v1';
const FLAG_PREFIX = 'pq_migration_v1_done_';

const originalLocation = window.location;

function seedLegacy(quotes: any[]) {
  localStorage.setItem(LEGACY_KEY, JSON.stringify(quotes));
}

function readDocs(): any[] {
  return JSON.parse(localStorage.getItem(DOCS_KEY) || '[]');
}

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'location', {
    value: { ...originalLocation, hostname: 'localhost' },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'location', { value: originalLocation, configurable: true });
});

describe('dataService.migrateLegacyQuotes (local path)', () => {
  it('returns no-op when no legacy quotes exist', async () => {
    const result = await dataService.migrateLegacyQuotes('user@test.com');
    expect(result).toEqual({ migrated: 0, skipped: false });
    expect(readDocs()).toEqual([]);
    expect(localStorage.getItem(`${FLAG_PREFIX}user@test.com`)).toBe('1');
  });

  it('migrates 5 quotes owned by the user to documents with documentType="quote"', async () => {
    seedLegacy([
      { id: 'q1', owner: 'user@test.com', title: 'A', client: 'X' },
      { id: 'q2', owner: 'user@test.com', title: 'B', client: 'X' },
      { id: 'q3', owner: 'user@test.com', title: 'C', client: 'X' },
      { id: 'q4', owner: 'user@test.com', title: 'D', client: 'X' },
      { id: 'q5', owner: 'user@test.com', title: 'E', client: 'X' },
    ]);
    const result = await dataService.migrateLegacyQuotes('user@test.com');
    expect(result).toEqual({ migrated: 5, skipped: false });
    const docs = readDocs();
    expect(docs).toHaveLength(5);
    expect(docs.every((d: any) => d.documentType === 'quote')).toBe(true);
    expect(docs.map((d: any) => d.id).sort()).toEqual([
      'migrate_q1', 'migrate_q2', 'migrate_q3', 'migrate_q4', 'migrate_q5',
    ]);
  });

  it('filters out quotes owned by other users', async () => {
    seedLegacy([
      { id: 'q1', owner: 'user@test.com', title: 'mine' },
      { id: 'q2', owner: 'other@test.com', title: 'theirs' },
    ]);
    const result = await dataService.migrateLegacyQuotes('user@test.com');
    expect(result.migrated).toBe(1);
    const docs = readDocs();
    expect(docs).toHaveLength(1);
    expect(docs[0].title).toBe('mine');
  });

  it('is idempotent: second call returns skipped=true and does not duplicate', async () => {
    seedLegacy([
      { id: 'q1', owner: 'user@test.com', title: 'A' },
      { id: 'q2', owner: 'user@test.com', title: 'B' },
    ]);
    const r1 = await dataService.migrateLegacyQuotes('user@test.com');
    expect(r1).toEqual({ migrated: 2, skipped: false });
    const r2 = await dataService.migrateLegacyQuotes('user@test.com');
    expect(r2).toEqual({ migrated: 0, skipped: true });
    expect(readDocs()).toHaveLength(2);
  });

  it('handles partial migration: if a doc was already migrated, skip it (idempotent on re-run with no flag)', async () => {
    seedLegacy([
      { id: 'q1', owner: 'user@test.com', title: 'A' },
      { id: 'q2', owner: 'user@test.com', title: 'B' },
      { id: 'q3', owner: 'user@test.com', title: 'C' },
    ]);
    // simulate prior partial migration: q1 already in documents
    localStorage.setItem(DOCS_KEY, JSON.stringify([
      { id: 'migrate_q1', documentType: 'quote', title: 'A', userEmail: 'user@test.com' },
    ]));
    const r = await dataService.migrateLegacyQuotes('user@test.com');
    expect(r.migrated).toBe(2);
    const docs = readDocs();
    expect(docs).toHaveLength(3);
    const ids = docs.map((d: any) => d.id).sort();
    expect(ids).toEqual(['migrate_q1', 'migrate_q2', 'migrate_q3']);
  });

  it('preserves _premium embed on migrated document', async () => {
    seedLegacy([{ id: 'q1', owner: 'user@test.com', title: 'A', _premium: { quoteId: 'PRV-2025-001' } }]);
    await dataService.migrateLegacyQuotes('user@test.com');
    const docs = readDocs();
    expect(docs[0]._premium).toEqual({ quoteId: 'PRV-2025-001' });
    expect(docs[0].userEmail).toBe('user@test.com');
  });

  it('throws (does not silently swallow) when localStorage.setItem fails (QuotaExceeded)', async () => {
    seedLegacy([{ id: 'q1', owner: 'user@test.com', title: 'A' }]);
    const realSetItem = Storage.prototype.setItem;
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === DOCS_KEY) {
        const e = new Error('QuotaExceeded');
        e.name = 'QuotaExceededError';
        throw e;
      }
      return realSetItem.call(this, k, v);
    });
    try {
      await expect(dataService.migrateLegacyQuotes('user@test.com')).rejects.toThrow(/QuotaExceeded/);
      // flag should NOT be set on failure (so retry can run)
      expect(localStorage.getItem(`${FLAG_PREFIX}user@test.com`)).toBeNull();
    } finally {
      setItemSpy.mockRestore();
    }
  });

  it('uses stable newId `migrate_<oldid>` (no timestamp) for true idempotency', async () => {
    seedLegacy([{ id: 'q1', owner: 'user@test.com', title: 'A' }]);
    await dataService.migrateLegacyQuotes('user@test.com');
    const docs = readDocs();
    expect(docs[0].id).toBe('migrate_q1');
    // no Date.now() suffix
    expect(docs[0].id).not.toMatch(/_\d{10,}$/);
  });
});
