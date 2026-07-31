import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('qrcode', () => ({
  default: {
    create: () => ({ modules: { size: 1, data: [1] } }),
  },
}));

import { FlyerPreview } from '../FlyerPreview';
import { createFlyerTemplate, getFlyerDimensions } from '../../../utils/documentSchemas';

// Larghezza di riferimento desktop (mirror di FLYER_PREVIEW_REF_WIDTH in FlyerPreview)
const REF_WIDTH = 380;

function expectedPreviewW(flyer: ReturnType<typeof createFlyerTemplate>, containerW: number): number {
  const dims = getFlyerDimensions(flyer);
  const totalWmm = dims.w + 6;
  const totalHmm = dims.h + 6;
  const scale = Math.min(Math.min(containerW, REF_WIDTH) / totalWmm, 520 / totalHmm);
  return Number((totalWmm * scale).toFixed(2));
}

describe('FlyerPreview auto-fit (REQ-007)', () => {
  afterEach(() => {
    // Ripristina l'assenza di ResizeObserver (default jsdom)
    delete (globalThis as Record<string, unknown>).ResizeObserver;
  });

  it('senza ResizeObserver (jsdom) mantiene la larghezza di riferimento desktop', () => {
    const flyer = createFlyerTemplate('ristorante', 'magazine');
    render(<FlyerPreview flyer={flyer} />);
    const preview = screen.getByTestId('flyer-preview');
    const w = parseFloat(preview.style.width);
    expect(w).toBeCloseTo(expectedPreviewW(flyer, REF_WIDTH), 2);
  });

  it('con ResizeObserver la preview si restringe alla larghezza del container', () => {
    const flyer = createFlyerTemplate('ristorante', 'magazine');
    const defaultW = expectedPreviewW(flyer, REF_WIDTH);

    class FakeResizeObserver {
      private cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
      }
      observe(el: Element): void {
        this.cb(
          [{ contentRect: { width: 200 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
        void el;
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    (globalThis as Record<string, unknown>).ResizeObserver = FakeResizeObserver;

    render(<FlyerPreview flyer={flyer} />);
    const preview = screen.getByTestId('flyer-preview');
    const w = parseFloat(preview.style.width);
    expect(w).toBeLessThan(defaultW);
    expect(w).toBeLessThanOrEqual(200);
  });

  it('con ResizeObserver su container largo la preview non supera mai REF_WIDTH', () => {
    const flyer = createFlyerTemplate('ristorante', 'magazine');

    class FakeResizeObserver {
      private cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
      }
      observe(): void {
        this.cb(
          [{ contentRect: { width: 900 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    (globalThis as Record<string, unknown>).ResizeObserver = FakeResizeObserver;

    render(<FlyerPreview flyer={flyer} />);
    const preview = screen.getByTestId('flyer-preview');
    const w = parseFloat(preview.style.width);
    expect(w).toBeCloseTo(expectedPreviewW(flyer, REF_WIDTH), 2);
  });
});
