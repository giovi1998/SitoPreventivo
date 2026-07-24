import { describe, it, expect } from 'vitest';
import { AppError, getErrorMessage, tryCatch } from '../errors';

describe('AppError', () => {
  it('preserves message and name', () => {
    const e = new AppError('qualcosa', 'CODE_1');
    expect(e.message).toBe('qualcosa');
    expect(e.code).toBe('CODE_1');
    expect(e.name).toBe('AppError');
    expect(e).toBeInstanceOf(Error);
  });
});

describe('getErrorMessage', () => {
  it('returns message from AppError', () => {
    expect(getErrorMessage(new AppError('app'))).toBe('app');
  });
  it('returns message from Error', () => {
    expect(getErrorMessage(new Error('std'))).toBe('std');
  });
  it('returns string as-is', () => {
    expect(getErrorMessage('hello')).toBe('hello');
  });
  it('falls back for unknown', () => {
    expect(getErrorMessage({} as unknown)).toBe('Errore sconosciuto');
    expect(getErrorMessage(null as unknown)).toBe('Errore sconosciuto');
  });
});

describe('tryCatch', () => {
  it('returns data on success', async () => {
    const r = await tryCatch(async () => 42);
    expect(r.data).toBe(42);
    expect(r.error).toBeUndefined();
  });
  it('returns error on throw', async () => {
    const r = await tryCatch(async () => {
      throw new Error('boom');
    });
    expect(r.error).toBe('boom');
    expect(r.data).toBeUndefined();
  });
  it('uses custom error message when provided', async () => {
    const r = await tryCatch(
      async () => {
        throw new Error('orig');
      },
      'custom'
    );
    expect(r.error).toBe('custom');
  });
});
