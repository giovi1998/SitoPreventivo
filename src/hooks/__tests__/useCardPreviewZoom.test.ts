import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCardPreviewZoom, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from '../useCardPreviewZoom';

describe('useCardPreviewZoom', () => {
  it('starts at default zoom (1.0 = 100%)', () => {
    const { result } = renderHook(() => useCardPreviewZoom());
    expect(result.current.zoom).toBe(1);
  });

  it('starts at custom initial zoom', () => {
    const { result } = renderHook(() => useCardPreviewZoom(0.7));
    expect(result.current.zoom).toBe(0.7);
  });

  it('zoomIn() increases zoom by ZOOM_STEP, clamped to ZOOM_MAX', () => {
    const { result } = renderHook(() => useCardPreviewZoom(0.9));
    act(() => result.current.zoomIn());
    expect(result.current.zoom).toBeCloseTo(Math.min(ZOOM_MAX, 0.9 + ZOOM_STEP));
    act(() => result.current.zoomIn());
    act(() => result.current.zoomIn());
    act(() => result.current.zoomIn());
    act(() => result.current.zoomIn());
    act(() => result.current.zoomIn());
    act(() => result.current.zoomIn());
    expect(result.current.zoom).toBe(ZOOM_MAX);
  });

  it('zoomOut() decreases zoom by ZOOM_STEP, clamped to ZOOM_MIN', () => {
    const { result } = renderHook(() => useCardPreviewZoom(0.6));
    act(() => result.current.zoomOut());
    expect(result.current.zoom).toBeCloseTo(Math.max(ZOOM_MIN, 0.6 - ZOOM_STEP));
    act(() => result.current.zoomOut());
    act(() => result.current.zoomOut());
    act(() => result.current.zoomOut());
    act(() => result.current.zoomOut());
    act(() => result.current.zoomOut());
    expect(result.current.zoom).toBe(ZOOM_MIN);
  });

  it('reset() restores to 1.0', () => {
    const { result } = renderHook(() => useCardPreviewZoom(0.7));
    act(() => result.current.zoomIn());
    act(() => result.current.zoomIn());
    act(() => result.current.reset());
    expect(result.current.zoom).toBe(1);
  });

  it('zoom can be set explicitly via setZoom, clamped to range', () => {
    const { result } = renderHook(() => useCardPreviewZoom());
    act(() => result.current.setZoom(1.5));
    expect(result.current.zoom).toBe(1.5);
    act(() => result.current.setZoom(0.3));
    expect(result.current.zoom).toBe(ZOOM_MIN);
    act(() => result.current.setZoom(3));
    expect(result.current.zoom).toBe(ZOOM_MAX);
  });

  it('canZoomIn() returns false at max, canZoomOut() returns false at min', () => {
    const { result } = renderHook(() => useCardPreviewZoom(1));
    expect(result.current.canZoomIn()).toBe(true);
    expect(result.current.canZoomOut()).toBe(true);
    act(() => result.current.setZoom(ZOOM_MAX));
    expect(result.current.canZoomIn()).toBe(false);
    expect(result.current.canZoomOut()).toBe(true);
    act(() => result.current.setZoom(ZOOM_MIN));
    expect(result.current.canZoomIn()).toBe(true);
    expect(result.current.canZoomOut()).toBe(false);
  });
});
