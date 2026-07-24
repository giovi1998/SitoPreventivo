import { describe, it, expect } from 'vitest';
import { AuthContext, AppContext, AUTH_DEFAULT, APP_DEFAULT } from '../index';
import { evaluatePassword, scorePassword, EMPTY_RULES } from '../../components/PasswordStrength';

describe('Contexts', () => {
  describe('AUTH_DEFAULT', () => {
    it('has user null', () => {
      expect(AUTH_DEFAULT.user).toBeNull();
    });
    it('has login/register/logout noop functions', () => {
      expect(typeof AUTH_DEFAULT.login).toBe('function');
      expect(typeof AUTH_DEFAULT.register).toBe('function');
      expect(typeof AUTH_DEFAULT.logout).toBe('function');
    });
    it('default login/register return undefined', async () => {
      const loginResult = await AUTH_DEFAULT.login('a@b.com', 'pwd');
      const regResult = await AUTH_DEFAULT.register('a@b.com', 'pwd', 'user', 'm');
      expect(loginResult).toBeUndefined();
      expect(regResult).toBeUndefined();
    });
    it('default logout does not throw', () => {
      expect(() => AUTH_DEFAULT.logout()).not.toThrow();
    });
  });

  describe('APP_DEFAULT', () => {
    it('is empty object', () => {
      expect(APP_DEFAULT).toEqual({});
    });
  });

  describe('AuthContext', () => {
    it('is defined', () => {
      expect(AuthContext).toBeDefined();
    });
  });

  describe('AppContext', () => {
    it('is defined', () => {
      expect(AppContext).toBeDefined();
    });
  });
});

describe('evaluatePassword', () => {
  it('returns all false for empty', () => {
    expect(evaluatePassword('')).toEqual(EMPTY_RULES);
  });
  it('detects length', () => {
    expect(evaluatePassword('short').minLength).toBe(false);
    expect(evaluatePassword('verylongpassword').minLength).toBe(true);
  });
  it('detects uppercase', () => {
    expect(evaluatePassword('abcdefghijkl1!').hasUpper).toBe(false);
    expect(evaluatePassword('Abcdefghijkl1!').hasUpper).toBe(true);
  });
  it('detects lowercase', () => {
    expect(evaluatePassword('ABCDEFGHIJKL1!').hasLower).toBe(false);
    expect(evaluatePassword('Abcdefghijkl1!').hasLower).toBe(true);
  });
  it('detects number', () => {
    expect(evaluatePassword('Abcdefghijkl!').hasNumber).toBe(false);
    expect(evaluatePassword('Abcdefghijkl1!').hasNumber).toBe(true);
  });
  it('detects special char', () => {
    expect(evaluatePassword('Abcdefghijkl1').hasSpecial).toBe(false);
    expect(evaluatePassword('Abcdefghijkl1!').hasSpecial).toBe(true);
  });
  it('passes all for strong password', () => {
    const r = evaluatePassword('StrongPass1234!@#');
    expect(r.minLength).toBe(true);
    expect(r.hasUpper).toBe(true);
    expect(r.hasLower).toBe(true);
    expect(r.hasNumber).toBe(true);
    expect(r.hasSpecial).toBe(true);
  });
});

describe('scorePassword', () => {
  it('returns weak for empty', () => {
    expect(scorePassword(EMPTY_RULES, 0).tone).toBe('weak');
  });
  it('returns weak for 1-2 rules', () => {
    const r = { ...EMPTY_RULES, minLength: true, hasUpper: true };
    expect(scorePassword(r, 12).tone).toBe('weak');
  });
  it('returns fair for 3 rules', () => {
    const r = { ...EMPTY_RULES, minLength: true, hasUpper: true, hasLower: true };
    expect(scorePassword(r, 12).tone).toBe('fair');
  });
  it('returns good for 4 rules', () => {
    const r = { ...EMPTY_RULES, minLength: true, hasUpper: true, hasLower: true, hasNumber: true };
    expect(scorePassword(r, 12).tone).toBe('good');
  });
  it('returns strong for all 5 + 14+ chars', () => {
    const all = { minLength: true, hasUpper: true, hasLower: true, hasNumber: true, hasSpecial: true };
    expect(scorePassword(all, 16).tone).toBe('strong');
  });
});
