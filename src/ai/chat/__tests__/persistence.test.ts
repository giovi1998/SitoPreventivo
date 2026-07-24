import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChatStore } from '../store';
import {
  localStorageSessionAdapter,
  noopSessionAdapter,
} from '../localStorageAdapter';
import type { ChatSession } from '../../types';

function makeSession(id: string, updatedAt: string, messages: unknown[] = []): ChatSession {
  return {
    id,
    messages: messages as ChatSession['messages'],
    createdAt: updatedAt,
    updatedAt,
  };
}

describe('localStorageSessionAdapter', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('returns [] when nothing stored', () => {
    const adapter = new localStorageSessionAdapter('test:v1', 5);
    expect(adapter.load()).toEqual([]);
  });

  it('returns [] on invalid JSON', () => {
    localStorage.setItem('test:v1', '{not json');
    const adapter = new localStorageSessionAdapter('test:v1', 5);
    expect(adapter.load()).toEqual([]);
  });

  it('saves and loads roundtrip', () => {
    const adapter = new localStorageSessionAdapter('test:v1', 5);
    const session = makeSession('chat_1', new Date().toISOString(), [
      { role: 'user', content: 'ciao' },
    ]);
    adapter.save([session]);
    const loaded = adapter.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('chat_1');
    expect(loaded[0].messages[0].content).toBe('ciao');
  });

  it('caps at maxSessions keeping most recent by updatedAt', () => {
    const adapter = new localStorageSessionAdapter('test:v1', 3);
    const now = Date.now();
    const sessions = [
      makeSession('s1', new Date(now - 3000).toISOString()),
      makeSession('s2', new Date(now - 2000).toISOString()),
      makeSession('s3', new Date(now - 1000).toISOString()),
      makeSession('s4', new Date(now).toISOString()),
    ];
    adapter.save(sessions);
    const loaded = adapter.load();
    expect(loaded.map((s) => s.id)).toEqual(['s4', 's3', 's2']);
  });

  it('clear() removes the key', () => {
    const adapter = new localStorageSessionAdapter('test:v1', 5);
    adapter.save([makeSession('s1', new Date().toISOString())]);
    expect(localStorage.getItem('test:v1')).not.toBeNull();
    adapter.clear();
    expect(localStorage.getItem('test:v1')).toBeNull();
  });
});

describe('noopSessionAdapter', () => {
  it('all methods are no-ops', () => {
    const adapter = new noopSessionAdapter();
    expect(adapter.load()).toEqual([]);
    expect(() => adapter.save([])).not.toThrow();
    expect(() => adapter.clear()).not.toThrow();
  });
});

describe('ChatStore with persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('hydrates sessions from adapter on construction', () => {
    const now = new Date().toISOString();
    localStorage.setItem(
      'pq_ai_sessions:v1',
      JSON.stringify([makeSession('chat_persisted', now, [{ role: 'user', content: 'salvato' } as never])]),
    );
    const store = new ChatStore(new localStorageSessionAdapter());
    const s = store.getSession('chat_persisted');
    expect(s).toBeDefined();
    expect(s!.messages[0].content).toBe('salvato');
  });

  it('createSession + addMessage triggers debounced save', () => {
    vi.useFakeTimers();
    const store = new ChatStore(new localStorageSessionAdapter());
    const s = store.createSession();
    store.addMessage(s.id, { role: 'user', content: 'msg' });
    expect(localStorage.getItem('pq_ai_sessions:v1')).toBeNull();
    vi.advanceTimersByTime(600);
    const raw = localStorage.getItem('pq_ai_sessions:v1');
    expect(raw).not.toBeNull();
    const loaded = JSON.parse(raw!);
    expect(loaded[0].id).toBe(s.id);
  });

  it('clearSession removes from storage', () => {
    const store = new ChatStore(new localStorageSessionAdapter());
    const s = store.createSession();
    store.clearSession(s.id);
    vi.useFakeTimers();
    vi.advanceTimersByTime(600);
    const raw = localStorage.getItem('pq_ai_sessions:v1');
    const loaded = raw ? JSON.parse(raw) : [];
    expect(loaded.find((x: ChatSession) => x.id === s.id)).toBeUndefined();
  });

  it('cleanup removes old sessions from storage', () => {
    const old = makeSession('old', new Date(Date.now() - 25 * 3600 * 1000).toISOString());
    localStorage.setItem('pq_ai_sessions:v1', JSON.stringify([old]));
    const store = new ChatStore(new localStorageSessionAdapter());
    vi.useFakeTimers();
    const removed = store.cleanup(24 * 3600 * 1000);
    expect(removed).toBe(1);
    vi.advanceTimersByTime(600);
    const raw = localStorage.getItem('pq_ai_sessions:v1');
    const loaded = raw ? JSON.parse(raw) : null;
    expect(loaded === null || loaded.length === 0).toBe(true);
  });
});
