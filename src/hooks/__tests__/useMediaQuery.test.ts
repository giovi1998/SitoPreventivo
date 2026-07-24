import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from '../useMediaQuery';

type Listener = (e: MediaQueryListEvent) => void;

class MockMediaQueryList {
  matches: boolean;
  media: string;
  private listeners = new Set<Listener>();

  onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => any) | null = null;
  addEventListener = vi.fn((_type: 'change', listener: Listener) => {
    this.listeners.add(listener);
  });
  removeEventListener = vi.fn((_type: 'change', listener: Listener) => {
    this.listeners.delete(listener);
  });
  addListener = vi.fn((listener: Listener) => this.listeners.add(listener));
  removeListener = vi.fn((listener: Listener) => this.listeners.delete(listener));
  dispatchEvent = vi.fn((event: Event) => {
    this.listeners.forEach((l) => l(event as MediaQueryListEvent));
    return true;
  });

  constructor(query: string, matches: boolean) {
    this.media = query;
    this.matches = matches;
  }

  setMatches(m: boolean) {
    this.matches = m;
    this.listeners.forEach((l) => l({ matches: m, media: this.media } as MediaQueryListEvent));
  }
}

describe('useMediaQuery', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it('returns true when the query matches', () => {
    const mql = new MockMediaQueryList('(max-width: 600px)', true);
    window.matchMedia = vi.fn().mockReturnValue(mql) as any;
    const { result } = renderHook(() => useMediaQuery('(max-width: 600px)'));
    expect(result.current).toBe(true);
  });

  it('returns false when the query does not match', () => {
    const mql = new MockMediaQueryList('(max-width: 600px)', false);
    window.matchMedia = vi.fn().mockReturnValue(mql) as any;
    const { result } = renderHook(() => useMediaQuery('(max-width: 600px)'));
    expect(result.current).toBe(false);
  });

  it('reacts to change events (matches becomes false)', () => {
    const mql = new MockMediaQueryList('(max-width: 600px)', true);
    window.matchMedia = vi.fn().mockReturnValue(mql) as any;
    const { result } = renderHook(() => useMediaQuery('(max-width: 600px)'));
    expect(result.current).toBe(true);
    act(() => mql.setMatches(false));
    expect(result.current).toBe(false);
  });
});
