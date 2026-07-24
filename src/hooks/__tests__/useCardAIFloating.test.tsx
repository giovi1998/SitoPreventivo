import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCardAIFloating, CardAIFloatingProvider } from '../useCardAIFloating';
import type { AILogEntry } from '../../ai/types';

function wrapper({ children }: { children: React.ReactNode }) {
  return <CardAIFloatingProvider>{children}</CardAIFloatingProvider>;
}

function makeLog(id: string, msg: string): AILogEntry {
  return {
    id,
    type: 'info',
    msg,
    time: new Date().toISOString(),
  };
}

describe('useCardAIFloating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('starts closed with no unread logs', () => {
    const { result } = renderHook(() => useCardAIFloating(), { wrapper });
    expect(result.current.isOpen).toBe(false);
    expect(result.current.hasUnread).toBe(false);
  });

  it('toggle() flips isOpen state', () => {
    const { result } = renderHook(() => useCardAIFloating(), { wrapper });
    expect(result.current.isOpen).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(false);
  });

  it('hasUnread becomes true when a new log is pushed while closed', () => {
    const { result } = renderHook(() => useCardAIFloating(), { wrapper });
    expect(result.current.hasUnread).toBe(false);
    act(() => result.current.pushLog(makeLog('log-1', 'AI ha cambiato il nome')));
    expect(result.current.hasUnread).toBe(true);
  });

  it('open() sets isOpen=true and clears hasUnread', () => {
    const { result } = renderHook(() => useCardAIFloating(), { wrapper });
    act(() => result.current.pushLog(makeLog('log-1', 'm')));
    expect(result.current.hasUnread).toBe(true);
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
    expect(result.current.hasUnread).toBe(false);
  });

  it('close() sets isOpen=false', () => {
    const { result } = renderHook(() => useCardAIFloating(), { wrapper });
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });
});
