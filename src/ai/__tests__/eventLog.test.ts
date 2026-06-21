import { describe, it, expect } from 'vitest';
import { StreamBuffer, summarizeMergeChanges, describeAIError, createStreamEntry, createEntry } from '../eventLog';

describe('StreamBuffer', () => {
  it('appends chunks and joins them', () => {
    const b = new StreamBuffer();
    b.append('hello ');
    b.append('world');
    expect(b.getRaw()).toBe('hello world');
  });
  it('skips empty chunks', () => {
    const b = new StreamBuffer();
    b.append('');
    b.append('x');
    expect(b.getRaw()).toBe('x');
  });
  it('clears buffer', () => {
    const b = new StreamBuffer();
    b.append('data');
    b.clear();
    expect(b.getRaw()).toBe('');
  });
});

describe('summarizeMergeChanges', () => {
  it('returns empty for no changes', () => {
    expect(summarizeMergeChanges([])).toBe('');
  });
  it('detects anagrafica area', () => {
    const s = summarizeMergeChanges(['Cliente: "Mario"']);
    expect(s).toContain('anagrafica');
  });
  it('detects opzioni area', () => {
    const s = summarizeMergeChanges(['Opzione "A": prezzo 100 → 90']);
    expect(s).toContain('opzioni');
  });
  it('detects multiple areas', () => {
    const s = summarizeMergeChanges(['Clausola aggiornata', 'Colore tema cambiato']);
    expect(s).toContain('clausole');
    expect(s).toContain('tema');
  });
});

describe('describeAIError', () => {
  it('returns specific message for empty', () => {
    expect(describeAIError('empty')).toMatch(/non ha restituito/);
  });
  it('returns specific message for not_json', () => {
    expect(describeAIError('not_json')).toMatch(/testo libero/);
  });
  it('returns specific message for invalid_json', () => {
    expect(describeAIError('invalid_json')).toMatch(/non valida/);
  });
});

describe('createStreamEntry', () => {
  it('creates pending stream entry', () => {
    const e = createStreamEntry();
    expect(e.status).toBe('pending');
    expect(e.type).toBe('stream');
    expect(e.msg).toContain('Generazione');
  });
});

describe('createEntry', () => {
  it('creates done entry by default', () => {
    const e = createEntry('info', 'ciao');
    expect(e.status).toBe('done');
    expect(e.msg).toBe('ciao');
    expect(e.id).toBeDefined();
  });
  it('honors custom status and duration', () => {
    const e = createEntry('tool', 'fatto', { status: 'done', durationMs: 123 });
    expect(e.durationMs).toBe(123);
  });
});
