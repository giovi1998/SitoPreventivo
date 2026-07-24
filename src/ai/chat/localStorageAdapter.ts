import type { ChatSession } from '../types';

export interface SessionAdapter {
  load(): ChatSession[];
  save(sessions: ChatSession[]): void;
  clear(): void;
}

/**
 * Persists AI chat sessions in browser localStorage. Cap to maxSessions
 * most-recent entries (by updatedAt) to stay under 5MB. Defensive on
 * load: parse errors or non-array data return [] rather than throwing.
 */
export class localStorageSessionAdapter implements SessionAdapter {
  constructor(
    private readonly key: string = 'pq_ai_sessions:v1',
    private readonly maxSessions: number = 5,
  ) {}

  load(): ChatSession[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as ChatSession[];
    } catch {
      return [];
    }
  }

  save(sessions: ChatSession[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const sorted = [...sessions].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      const trimmed = sorted.slice(0, this.maxSessions);
      localStorage.setItem(this.key, JSON.stringify(trimmed));
    } catch {
      // Quota exceeded or storage unavailable: best-effort, no crash.
    }
  }

  clear(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(this.key);
    } catch {
      // ignore
    }
  }
}

/**
 * No-op adapter for SSR / Vercel function runtime. Sessions remain
 * in-memory only and are lost at end of request (no regression vs v1).
 */
export class noopSessionAdapter implements SessionAdapter {
  load(): ChatSession[] {
    return [];
  }
  save(_sessions: ChatSession[]): void {
    /* no-op */
  }
  clear(): void {
    /* no-op */
  }
}

export function autoDetectAdapter(): SessionAdapter {
  if (typeof globalThis !== 'undefined' && (globalThis as { localStorage?: unknown }).localStorage !== undefined) {
    return new localStorageSessionAdapter();
  }
  return new noopSessionAdapter();
}
