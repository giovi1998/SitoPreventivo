import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from '../useToast';

describe('useToast', () => {
  it('starts with empty toasts', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toEqual([]);
  });

  it('adds a toast with unique id', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      const id = result.current.addToast('info', 'ciao');
      expect(id).toBeTruthy();
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('ciao');
  });

  it('dismisses a specific toast', () => {
    const { result } = renderHook(() => useToast());
    let id = '';
    act(() => {
      id = result.current.addToast('error', 'errore');
    });
    act(() => {
      result.current.dismissToast(id);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('adds multiple toasts with unique ids', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.addToast('info', 'primo');
      result.current.addToast('success', 'secondo');
    });
    expect(result.current.toasts).toHaveLength(2);
    expect(result.current.toasts[0].id).not.toBe(result.current.toasts[1].id);
  });

  it('defaults durationMs to 3000 when not provided', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.addToast('success', 'default');
    });
    expect(result.current.toasts[0].durationMs).toBe(3000);
  });

  it('accepts explicit durationMs (Test 20 / AC-017)', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.addToast('success', 'long', 5000);
    });
    expect(result.current.toasts[0].durationMs).toBe(5000);
  });
});
