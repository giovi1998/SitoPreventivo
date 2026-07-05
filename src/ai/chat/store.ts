import type { ChatMessage, ChatSession } from '../types';
import {
  type SessionAdapter,
  noopSessionAdapter,
  autoDetectAdapter,
} from './localStorageAdapter';

function generateId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const MAX_SESSION_MESSAGES = 50;
const SAVE_DEBOUNCE_MS = 500;

export class ChatStore {
  private sessions: Map<string, ChatSession> = new Map();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly adapter: SessionAdapter;

  constructor(adapter?: SessionAdapter) {
    this.adapter = adapter ?? autoDetectAdapter();
    const loaded = this.adapter.load();
    for (const s of loaded) this.sessions.set(s.id, s);
  }

  createSession(): ChatSession {
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: generateId(),
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(session.id, session);
    this.scheduleSave();
    return session;
  }

  getSession(id: string): ChatSession | undefined {
    return this.sessions.get(id);
  }

  addMessage(sessionId: string, message: ChatMessage): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.messages.push(message);
    if (session.messages.length > MAX_SESSION_MESSAGES) {
      const systemMsg = session.messages[0]?.role === 'system' ? session.messages.shift() : null;
      const excess = session.messages.length - MAX_SESSION_MESSAGES + (systemMsg ? 1 : 0);
      session.messages.splice(0, Math.max(0, excess));
      if (systemMsg) session.messages.unshift(systemMsg);
    }

    session.updatedAt = new Date().toISOString();
    this.scheduleSave();
  }

  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.scheduleSave();
  }

  getHistory(sessionId: string, maxMessages: number = 30): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    return session.messages.slice(-maxMessages);
  }

  getRecentSessionIds(maxAgeMs: number = 3600000): string[] {
    const cutoff = Date.now() - maxAgeMs;
    return Array.from(this.sessions.values())
      .filter((s) => new Date(s.updatedAt).getTime() > cutoff)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((s) => s.id);
  }

  cleanup(maxAgeMs: number = 86400000): number {
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;
    for (const [id, session] of this.sessions) {
      if (new Date(session.updatedAt).getTime() < cutoff) {
        this.sessions.delete(id);
        removed++;
      }
    }
    if (removed > 0) this.scheduleSave();
    return removed;
  }

  /**
   * Debounced persistence: many addMessage calls in quick succession
   * (e.g. during a stream) coalesce into a single localStorage write.
   * No-op if the adapter is a noop (SSR).
   */
  private scheduleSave(): void {
    if (this.adapter instanceof noopSessionAdapter) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.adapter.save(Array.from(this.sessions.values()));
      this.saveTimer = null;
    }, SAVE_DEBOUNCE_MS);
  }
}

export const chatStore = new ChatStore();
