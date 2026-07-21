import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAILogs } from '../useAILogs';

const STORAGE_KEY = 'pq_ai_logs:test:v1';

describe('useAILogs', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('starts and finalizes a stream entry', () => {
    const { result } = renderHook(() => useAILogs('test'));
    let id: string;
    act(() => {
      id = result.current.startStream('Generazione in corso…', { requestId: 'r1' });
    });
    expect(result.current.isProcessing).toBe(true);
    expect(result.current.logs[0].type).toBe('stream');
    expect(result.current.logs[0].status).toBe('pending');
    expect(result.current.logs[0].requestId).toBe('r1');

    act(() => {
      result.current.appendStream(id, 'chunk 1 '.repeat(20));
    });
    expect(result.current.logs[0].msg).toContain('caratteri');

    act(() => {
      result.current.finalizeStream(id, true, {
        tokens: { prompt: 10, completion: 20, total: 30 },
        detail: '{"ok":true}',
      });
    });
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.logs[0].status).toBe('done');
    expect(result.current.logs[0].msg).toContain('30 token');
  });

  it('finalizes a stream as error on failure', () => {
    const { result } = renderHook(() => useAILogs('test'));
    let id: string;
    act(() => {
      id = result.current.startStream('Generazione…', { requestId: 'r2' });
    });
    act(() => {
      result.current.finalizeStream(id, false, { errorMsg: 'Timeout' });
    });
    expect(result.current.logs[0].status).toBe('error');
    expect(result.current.logs[0].msg).toBe('Timeout');
  });

  it('caps entries at 40 and persists to sessionStorage', () => {
    const { result } = renderHook(() => useAILogs('test'));
    act(() => {
      for (let i = 0; i < 45; i++) {
        result.current.info(`msg ${i}`);
      }
    });
    expect(result.current.logs.length).toBe(40);
    expect(result.current.logs[0].msg).toBe('msg 5');

    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    expect(stored.version).toBe(1);
    expect(stored.entries.length).toBe(40);
  });

  it('restores persisted entries on mount', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, entries: [{ id: 'x', type: 'info', msg: 'restored', time: '12:00:00' }] })
    );
    const { result } = renderHook(() => useAILogs('test'));
    expect(result.current.logs.length).toBe(1);
    expect(result.current.logs[0].msg).toBe('restored');
  });

  it('truncates detail to 8KB before persistence', () => {
    const { result } = renderHook(() => useAILogs('test'));
    act(() => {
      result.current.success('ok', 'x'.repeat(9000));
    });
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    expect(stored.entries[0].detail.length).toBeLessThanOrEqual(8192 + 1); // +1 for ellipsis
  });

  it('tracks total and last cost USD from finalization', async () => {
    const { result, rerender } = renderHook(() => useAILogs('test'));
    let id: string;
    act(() => {
      id = result.current.startStream('s', { requestId: 'r-cost' });
    });
    act(() => {
      result.current.finalizeStream(id, true, { tokens: { prompt: 100, completion: 50, total: 150 }, costUsd: 0.0123, modelId: 'deepseek-v4' });
    });
    rerender();
    expect(result.current.logs[0].costUsd).toBeCloseTo(0.0123, 4);
    expect(result.current.logs[0].modelId).toBe('deepseek-v4');
    expect(result.current.totalCostUsd).toBeCloseTo(0.0123, 4);
    expect(result.current.lastCostUsd).toBeCloseTo(0.0123, 4);
  });

  it('marks image operations with hasImage flag', () => {
    const { result } = renderHook(() => useAILogs('test'));
    act(() => {
      result.current.success('cover', 'img', { requestId: 'r-img', hasImage: true, modelId: 'gemini-3.1-flash-image' });
    });
    expect(result.current.logs[0].hasImage).toBe(true);
    expect(result.current.logs[0].modelId).toBe('gemini-3.1-flash-image');
  });
});
