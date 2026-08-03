import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRefetchOnFocus } from '../useRefetchOnFocus';

describe('useRefetchOnFocus', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
  });

  it('calls fn when visibility changes to visible', () => {
    const fn = vi.fn();
    renderHook(() => useRefetchOnFocus(fn));
    expect(fn).not.toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not call fn when visibility changes to hidden', () => {
    const fn = vi.fn();
    renderHook(() => useRefetchOnFocus(fn));
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(fn).not.toHaveBeenCalled();
  });

  it('cleans up listener on unmount', () => {
    const fn = vi.fn();
    const { unmount } = renderHook(() => useRefetchOnFocus(fn));
    unmount();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(fn).not.toHaveBeenCalled();
  });
});
