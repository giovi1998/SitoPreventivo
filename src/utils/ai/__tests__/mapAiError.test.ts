import { describe, it, expect } from 'vitest';
import { mapAiError } from '../mapAiError';

describe('mapAiError', () => {
  it('maps 402 / credit errors', () => {
    expect(mapAiError(new Error('402 Payment Required'))).toMatch(/Credito DeepSeek/);
    expect(mapAiError('credito esaurito')).toMatch(/Credito DeepSeek/);
  });

  it('maps 429 / rate limit', () => {
    expect(mapAiError(new Error('429 Too Many Requests'))).toMatch(/Troppe richieste/);
    expect(mapAiError('Quota Gemini esaurita')).toMatch(/Troppe richieste/);
  });

  it('maps 401', () => {
    expect(mapAiError(new Error('401 Unauthorized'))).toMatch(/Chiave API/);
  });

  it('maps network errors', () => {
    expect(mapAiError(new Error('Failed to fetch'))).toMatch(/Connessione/);
    expect(mapAiError(new Error('NetworkError'))).toMatch(/Connessione/);
  });

  it('maps timeout', () => {
    expect(mapAiError(new Error('timeout after 30s'))).toMatch(/Timeout/);
  });

  it('maps copyright filter', () => {
    expect(mapAiError(new Error('Image generation blocked due to copyright/recitation'))).toMatch(/filtro/);
  });

  it('passes short Italian messages through', () => {
    expect(mapAiError('Limite token AI raggiunto')).toBe('Limite token AI raggiunto');
  });

  it('passes short unknown messages through', () => {
    expect(mapAiError(new Error('something weird xyz'))).toBe('something weird xyz');
  });

  it('falls back for long opaque messages', () => {
    const long = 'x'.repeat(150);
    expect(mapAiError(new Error(long))).toMatch(/Errore AI/);
  });
});
