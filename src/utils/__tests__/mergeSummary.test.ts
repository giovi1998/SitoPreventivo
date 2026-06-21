import { describe, it, expect } from 'vitest';
import { summarizeMergeChanges, buildErrorSuggestion } from '../mergeSummary';

describe('summarizeMergeChanges', () => {
  it('counts tools, textEdits, and errors separately; errors excluded from count', () => {
    const result = summarizeMergeChanges(['tool:x', 'error:y', 'Titolo: z']);
    expect(result.count).toBe(2);
    expect(result.breakdown).toEqual({ tools: 1, textEdits: 1, errors: 1 });
  });

  it('builds summary string for mixed tool + text changes (AC-011)', () => {
    const result = summarizeMergeChanges(['tool:apply_discount', 'Titolo: "X"', 'Cliente: "Y"']);
    expect(result.count).toBe(3);
    expect(result.summary).toBe('3 modifiche applicate (1 tool, 2 modifiche testo). Vedi log.');
  });

  it('returns "nessuna modifica applicata" when changes is empty', () => {
    const result = summarizeMergeChanges([]);
    expect(result.count).toBe(0);
    expect(result.summary).toBe('nessuna modifica applicata');
  });

  it('handles only tools', () => {
    const result = summarizeMergeChanges(['tool:apply_discount', 'tool:add_faq']);
    expect(result.count).toBe(2);
    expect(result.summary).toBe('2 modifiche applicate (2 tool). Vedi log.');
  });

  it('handles only text edits', () => {
    const result = summarizeMergeChanges(['Titolo: "X"', 'Cliente: "Y"']);
    expect(result.count).toBe(2);
    expect(result.summary).toBe('2 modifiche applicate (2 modifiche testo). Vedi log.');
  });

  it('handles only errors (count 0)', () => {
    const result = summarizeMergeChanges(['error:invalid_quote:3']);
    expect(result.count).toBe(0);
    expect(result.summary).toBe('nessuna modifica applicata');
  });
});

describe('buildErrorSuggestion', () => {
  it('returns fallback for unknown errors (Test 19)', () => {
    const suggestion = buildErrorSuggestion('unknown error');
    expect(suggestion).toBe('Errore AI. Riprova, o modifica manualmente dalla colonna di sinistra.');
  });

  it('suggests recharge for 402 Payment Required (AC-014)', () => {
    const suggestion = buildErrorSuggestion('402 Payment Required');
    expect(suggestion).toBe('Credito DeepSeek esaurito. Ricarica su platform.deepseek.com e riprova.');
  });

  it('suggests waiting for 429 rate limit', () => {
    const suggestion = buildErrorSuggestion('429 Too Many Requests');
    expect(suggestion).toBe('Troppe richieste AI. Attendi 30s e riprova.');
  });

  it('suggests network check for fetch failure (AC-015)', () => {
    const suggestion = buildErrorSuggestion('Failed to fetch');
    expect(suggestion).toBe('Connessione assente o lenta. Verifica la rete e riprova.');
  });

  it('suggests network check for timeout', () => {
    const suggestion = buildErrorSuggestion('Request timeout');
    expect(suggestion).toBe('Connessione assente o lenta. Verifica la rete e riprova.');
  });

  it('suggests more specific prompt for JSON parse error (AC-015b)', () => {
    const suggestion = buildErrorSuggestion('Unexpected token < in JSON');
    expect(suggestion).toBe('AI non ha restituito JSON valido. Prova con un prompt più specifico (es. "cambia il titolo in X" invece di "migliora").');
  });

  it('matches "credito" keyword (case-insensitive)', () => {
    const suggestion = buildErrorSuggestion('Credito esaurito');
    expect(suggestion).toBe('Credito DeepSeek esaurito. Ricarica su platform.deepseek.com e riprova.');
  });

  it('matches "rate limit" keyword', () => {
    const suggestion = buildErrorSuggestion('rate limit exceeded');
    expect(suggestion).toBe('Troppe richieste AI. Attendi 30s e riprova.');
  });

  it('returns fallback for empty message', () => {
    const suggestion = buildErrorSuggestion('');
    expect(suggestion).toBe('Errore AI. Riprova, o modifica manualmente dalla colonna di sinistra.');
  });
});
