import { useState, useCallback } from 'react';

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 1.5;
export const ZOOM_STEP = 0.1;
export const ZOOM_DEFAULT = 1;

function clamp(value: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(value * 100) / 100));
}

export function useCardPreviewZoom(initialZoom: number = ZOOM_DEFAULT) {
  const [zoom, setZoomState] = useState<number>(clamp(initialZoom));

  const zoomIn = useCallback(() => {
    setZoomState((prev) => clamp(prev + ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomState((prev) => clamp(prev - ZOOM_STEP));
  }, []);

  const reset = useCallback(() => {
    setZoomState(ZOOM_DEFAULT);
  }, []);

  const setZoom = useCallback((value: number) => {
    setZoomState(clamp(value));
  }, []);

  const canZoomIn = useCallback(() => zoom < ZOOM_MAX, [zoom]);
  const canZoomOut = useCallback(() => zoom > ZOOM_MIN, [zoom]);

  return {
    zoom,
    zoomIn,
    zoomOut,
    reset,
    setZoom,
    canZoomIn,
    canZoomOut,
  };
}
