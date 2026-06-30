import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import dataService from '../dataService';

const ADMIN = 'admin@gmail.com';
const FREE_USER = 'free@test.com';
const UNLOCKED_USER = 'unlocked@test.com';
const UNLOCK_CODES_KEY = 'unlock_codes';

function lsGet(key: string): any {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

function lsSet(key: string, value: any) {
  localStorage.setItem(key, JSON.stringify(value));
}

describe('dataService tier (local path)', () => {
  const lsBefore: Record<string, string> = {};
  const originalLocation = window.location;

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
    global.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    localStorage.clear();
    Object.entries(lsBefore).forEach(([k, v]) => {
      if (v) localStorage.setItem(k, v);
    });
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true });
  });

  // ─── getUserTier ─────────────────────────────────────
  describe('getUserTier', () => {
    it('admin → unlocked implicit, documentLimit null', async () => {
      const result = await dataService.getUserTier(ADMIN);
      expect(result.tier).toBe('unlocked');
      expect(result.documentLimit).toBeNull();
    });

    it('free user with no settings → free, count 0, limit 3', async () => {
      const result = await dataService.getUserTier(FREE_USER);
      expect(result.tier).toBe('free');
      expect(result.documentCount).toBe(0);
      expect(result.documentLimit).toBe(3);
    });

    it('user with tier=unlocked in localStorage → unlocked', async () => {
      lsSet(`userSettings_${UNLOCKED_USER}`, { tier: 'unlocked', documentCount: 7 });
      const result = await dataService.getUserTier(UNLOCKED_USER);
      expect(result.tier).toBe('unlocked');
      expect(result.documentCount).toBe(7);
    });

    it('user with invalid tier value → defaults to free', async () => {
      lsSet(`userSettings_${FREE_USER}`, { tier: 'premium-fake' });
      const result = await dataService.getUserTier(FREE_USER);
      expect(result.tier).toBe('free');
    });
  });

  // ─── redeemUnlockCode ─────────────────────────────────
  describe('redeemUnlockCode', () => {
    it('admin → returns unlocked short-circuit (no DB touch)', async () => {
      const result = await dataService.redeemUnlockCode(ADMIN, 'ANY-CODE');
      expect(result.tier).toBe('unlocked');
    });

    it('TEST-UNLOCK magic: always works in local', async () => {
      const result = await dataService.redeemUnlockCode(FREE_USER, 'TEST-UNLOCK');
      expect(result.success).toBe(true);
      expect(result.tier).toBe('unlocked');
      const settings = lsGet(`userSettings_${FREE_USER}`);
      expect(settings.tier).toBe('unlocked');
      expect(settings.unlockCode).toBe('TEST-UNLOCK');
    });

    it('TEST-UNLOCK accepts lowercase and trims whitespace', async () => {
      const result = await dataService.redeemUnlockCode(FREE_USER, '  test-unlock  ');
      expect(result.success).toBe(true);
    });

    it('invalid code (not in unlock_codes) → error', async () => {
      const result = await dataService.redeemUnlockCode(FREE_USER, 'NOPE-1234');
      expect(result.error).toBe('Codice non valido');
    });

    it('valid code from unlock_codes → marks as used + upgrades tier', async () => {
      lsSet(UNLOCK_CODES_KEY, [
        { code: 'PQ-AAAAAAA1-BBBBBBBB-CCCCCCCC', package: 'starter', usedBy: null, usedAt: null },
      ]);
      const result = await dataService.redeemUnlockCode(FREE_USER, 'PQ-AAAAAAA1-BBBBBBBB-CCCCCCCC');
      expect(result.success).toBe(true);
      expect(result.tier).toBe('unlocked');
      const codes = lsGet(UNLOCK_CODES_KEY);
      expect(codes[0].usedBy).toBe(FREE_USER);
      expect(codes[0].usedAt).toBeTruthy();
    });

    it('already used code → 409 error', async () => {
      lsSet(UNLOCK_CODES_KEY, [
        { code: 'PQ-AAAAAAA1-BBBBBBBB-CCCCCCCC', package: 'starter', usedBy: 'other@test.com', usedAt: '2026-01-01' },
      ]);
      const result = await dataService.redeemUnlockCode(FREE_USER, 'PQ-AAAAAAA1-BBBBBBBB-CCCCCCCC');
      expect(result.error).toBe('Codice già utilizzato');
    });

    it('case-insensitive lookup (input is normalized to uppercase)', async () => {
      lsSet(UNLOCK_CODES_KEY, [
        { code: 'PQ-AAAAAAAA-BBBBBBBB-CCCCCCCC', package: 'starter', usedBy: null, usedAt: null },
      ]);
      const result = await dataService.redeemUnlockCode(FREE_USER, 'pq-aaaaaaaa-bbbbbbbb-cccccccc');
      expect(result.success).toBe(true);
    });
  });

  // ─── incrementDocumentCount ──────────────────────────
  describe('incrementDocumentCount', () => {
    it('admin → no-op (returns count 0)', async () => {
      const result = await dataService.incrementDocumentCount(ADMIN);
      expect(result.documentCount).toBe(0);
    });

    it('free user: increments by 1 by default', async () => {
      await dataService.incrementDocumentCount(FREE_USER);
      await dataService.incrementDocumentCount(FREE_USER);
      const result = await dataService.incrementDocumentCount(FREE_USER);
      expect(result.documentCount).toBe(3);
    });

    it('free user: accepts custom delta', async () => {
      const result = await dataService.incrementDocumentCount(FREE_USER, 5);
      expect(result.documentCount).toBe(5);
    });

    it('starts from 0 for new user', async () => {
      const result = await dataService.incrementDocumentCount(FREE_USER);
      expect(result.documentCount).toBe(1);
    });
  });

  // ─── adminGenerateUnlockCode ─────────────────────────
  describe('adminGenerateUnlockCode', () => {
    it('generates code matching PQ-XXXX-XXXX-XXXX format', async () => {
      const result = await dataService.adminGenerateUnlockCode('starter');
      expect(result.success).toBe(true);
      expect(result.code).toMatch(/^PQ-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$/);
    });

    it('persists the code in unlock_codes with createdBy=admin', async () => {
      const { code } = await dataService.adminGenerateUnlockCode('apertura');
      const codes = lsGet(UNLOCK_CODES_KEY);
      expect(codes).toHaveLength(1);
      expect(codes[0].code).toBe(code);
      expect(codes[0].package).toBe('apertura');
      expect(codes[0].createdBy).toBe(ADMIN);
      expect(codes[0].usedBy).toBeNull();
    });

    it('multiple calls generate distinct codes', async () => {
      const c1 = await dataService.adminGenerateUnlockCode('starter');
      const c2 = await dataService.adminGenerateUnlockCode('starter');
      expect(c1.code).not.toBe(c2.code);
    });
  });

  // ─── adminListUnlockCodes ───────────────────────────
  describe('adminListUnlockCodes', () => {
    it('returns empty array when no codes exist', async () => {
      const result = await dataService.adminListUnlockCodes();
      expect(result.codes).toEqual([]);
    });

    it('returns all generated codes', async () => {
      await dataService.adminGenerateUnlockCode('starter');
      await dataService.adminGenerateUnlockCode('apertura');
      const result = await dataService.adminListUnlockCodes();
      expect(result.codes).toHaveLength(2);
    });
  });

  // ─── saveDocument + incrementDocumentCount integration ───
  describe('saveDocument + tier integration', () => {
    it('saveDocument with NEW id → incrementDocumentCount is called', async () => {
      const newDoc = { id: 'new-doc-1', userEmail: FREE_USER, documentType: 'qrCode', title: 'Test' };
      await dataService.saveDocument(FREE_USER, newDoc);
      // wait microtasks for fire-and-forget
      await new Promise(r => setTimeout(r, 10));
      const settings = lsGet(`userSettings_${FREE_USER}`);
      expect(settings.documentCount).toBe(1);
    });

    it('saveDocument with EXISTING id → no increment', async () => {
      const doc = { id: 'doc-1', userEmail: FREE_USER, documentType: 'qrCode', title: 'Original' };
      await dataService.saveDocument(FREE_USER, doc);
      await new Promise(r => setTimeout(r, 10));
      const updated = { ...doc, title: 'Updated' };
      await dataService.saveDocument(FREE_USER, updated);
      await new Promise(r => setTimeout(r, 10));
      const settings = lsGet(`userSettings_${FREE_USER}`);
      expect(settings.documentCount).toBe(1);
    });

    it('admin saveDocument → does not increment', async () => {
      const doc = { id: 'admin-doc-1', userEmail: ADMIN, documentType: 'qrCode' };
      await dataService.saveDocument(ADMIN, doc);
      await new Promise(r => setTimeout(r, 10));
      // No userSettings_<admin> key created
      expect(lsGet(`userSettings_${ADMIN}`)).toBeNull();
    });
  });
});
