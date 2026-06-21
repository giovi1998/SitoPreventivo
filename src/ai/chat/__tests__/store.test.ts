import { describe, it, expect, beforeEach } from 'vitest';
import { chatStore } from '../store';
import type { ChatMessage } from '../../types';

describe('ChatStore', () => {
  beforeEach(() => {
    const sessions = (chatStore as unknown as { sessions: Map<string, unknown> }).sessions;
    const firstKey = sessions ? Array.from(sessions.keys())[0] : 'fake';
    chatStore.clearSession(firstKey ?? 'fake');
  });

  it('creates session with id', () => {
    const s = chatStore.createSession();
    expect(s.id).toBeDefined();
    expect(s.messages).toEqual([]);
  });

  it('adds message to session', () => {
    const s = chatStore.createSession();
    chatStore.addMessage(s.id, { role: 'user', content: 'ciao' });
    expect(chatStore.getSession(s.id)?.messages).toHaveLength(1);
  });

  it('trims messages to MAX 50', () => {
    const s = chatStore.createSession();
    for (let i = 0; i < 60; i++) {
      chatStore.addMessage(s.id, { role: 'user', content: `m${i}` });
    }
    expect(chatStore.getSession(s.id)!.messages.length).toBeLessThanOrEqual(50);
  });

  it('returns history with limit', () => {
    const s = chatStore.createSession();
    for (let i = 0; i < 10; i++) {
      chatStore.addMessage(s.id, { role: 'user', content: `m${i}` });
    }
    const h = chatStore.getHistory(s.id, 3);
    expect(h).toHaveLength(3);
  });

  it('clears session', () => {
    const s = chatStore.createSession();
    chatStore.clearSession(s.id);
    expect(chatStore.getSession(s.id)).toBeUndefined();
  });
});
