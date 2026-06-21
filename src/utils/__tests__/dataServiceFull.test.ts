import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import dataService from '../dataService';

describe('dataService local storage flows', () => {
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

  describe('register (local)', () => {
    it('hashes password and stores user', async () => {
      const result = await dataService.register('user@test.com', 'Valid123!Pass!', 'Mario', 'male');
      expect(result.success).toBe(true);
      const stored = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].password).toMatch(/^\$2[aby]\$/);
      expect(stored[0].password).not.toBe('Valid123!Pass!');
    });

    it('rejects duplicate email', async () => {
      await dataService.register('user@test.com', 'Valid123!Pass!', 'Mario', 'male');
      const result = await dataService.register('user@test.com', 'Other123!Pass!', 'Luigi', 'male');
      expect(result.success).toBe(false);
      expect(result.error).toContain('già registrata');
    });

    it('rejects admin email', async () => {
      const result = await dataService.register('admin@gmail.com', 'Valid123!Pass!', 'X', 'male');
      expect(result.success).toBe(false);
    });
  });

  describe('login (local)', () => {
    beforeEach(async () => {
      await dataService.register('user@test.com', 'Valid123!Pass!', 'Mario', 'male');
    });

    it('authenticates correct password', async () => {
      const result = await dataService.login('user@test.com', 'Valid123!Pass!');
      expect(result.success).toBe(true);
      expect(result.user.email).toBe('user@test.com');
    });

    it('rejects wrong password', async () => {
      const result = await dataService.login('user@test.com', 'WrongPass1!');
      expect(result.success).toBe(false);
    });

    it('rejects unknown email', async () => {
      const result = await dataService.login('nobody@test.com', 'AnyPass1!');
      expect(result.success).toBe(false);
    });
  });

  describe('quotes (local)', () => {
    const sampleQuote = {
      id: 'q-1', title: 'Test', client: 'X', owner: 'user@test.com',
      options: [], clauses: [],
    } as any;

    it('saves and reads quote', async () => {
      const saveResult = await dataService.saveQuote('user@test.com', sampleQuote);
      expect(saveResult.success).toBe(true);

      const { quotes } = await dataService.getQuotes('user@test.com');
      expect(quotes.some((q: any) => q.id === 'q-1')).toBe(true);
    });

    it('filters quotes by owner', async () => {
      await dataService.saveQuote('user@test.com', sampleQuote);
      const { quotes } = await dataService.getQuotes('other@test.com');
      expect(quotes).toHaveLength(0);
    });

    it('deletes quote', async () => {
      await dataService.saveQuote('user@test.com', sampleQuote);
      await dataService.deleteQuote('q-1', 'user@test.com');
      const { quotes } = await dataService.getQuotes('user@test.com');
      expect(quotes.some((q: any) => q.id === 'q-1')).toBe(false);
    });
  });

  describe('user profile & settings (local)', () => {
    it('returns default settings when none exist', async () => {
      const settings = await dataService.getUserSettings('user@test.com');
      expect(settings.onboardingDone).toBe(false);
    });

    it('saves and reads settings', async () => {
      await dataService.saveUserSettings('user@test.com', { displayName: 'Mario', companyName: 'SRL' } as any);
      const settings = await dataService.getUserSettings('user@test.com');
      expect(settings.displayName).toBe('Mario');
      expect(settings.companyName).toBe('SRL');
    });
  });

  describe('tokens tracking (local)', () => {
    it('increments tokensUsed', async () => {
      await dataService.register('user@test.com', 'Valid123!Pass!', 'Mario', 'male');
      await dataService.trackTokens('user@test.com', 500);
      const users = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
      expect(users[0].tokensUsed).toBe(500);
    });
  });

  describe('admin flows (local)', () => {
    it('adminGetUsers strips passwords', async () => {
      await dataService.register('a@test.com', 'Valid123!Pass!', 'A', 'male');
      const { users } = await dataService.adminGetUsers('lc-x');
      expect(users[0]).not.toHaveProperty('password');
    });

    it('adminUpdateLimits updates limit', async () => {
      await dataService.register('user@test.com', 'Valid123!Pass!', 'Mario', 'male');
      const result = await dataService.adminUpdateLimits('user@test.com', 5000000);
      expect(result.success).toBe(true);
      const users = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
      expect(users[0].tokenLimit).toBe(5000000);
    });
  });

  describe('templates (local)', () => {
    it('returns user templates', async () => {
      await dataService.saveQuote('user@test.com', {
        id: 't-1', title: 'Template', isTemplate: true, owner: 'user@test.com', options: [], clauses: [],
      } as any);
      const { quotes } = await dataService.getTemplates('user@test.com');
      expect(quotes.some((q: any) => q.id === 't-1')).toBe(true);
    });
  });

  describe('change password (local)', () => {
    it('updates password after re-auth', async () => {
      await dataService.register('user@test.com', 'Valid123!Pass!', 'Mario', 'male');
      const result = await dataService.changePassword('user@test.com', 'Valid123!Pass!', 'NewValid123!Pass!');
      expect(result.success).toBe(true);
      const users = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
      expect(users[0].password).toMatch(/^\$2/);
    });

    it('rejects wrong old password', async () => {
      await dataService.register('user@test.com', 'Valid123!Pass!', 'Mario', 'male');
      const result = await dataService.changePassword('user@test.com', 'WrongPass1!', 'NewValid123!Pass!');
      expect(result.success).toBe(false);
    });
  });
});
