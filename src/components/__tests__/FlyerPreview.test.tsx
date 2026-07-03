import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('qrcode', () => ({
  default: {
    create: () => ({ modules: { size: 1, data: [1] } }),
  },
}));

import { FlyerPreview } from '../flyer/FlyerPreview';
import { createFlyerTemplate } from '../../utils/documentSchemas';

describe('FlyerPreview scaling', () => {
  it('renders the SVG at the container pixel size so content is not clipped by 96dpi natural sizing', () => {
    const flyer = createFlyerTemplate('ristorante', 'magazine');
    const { container } = render(<FlyerPreview flyer={flyer} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toBeTruthy();

    const wrapperW = parseFloat(wrapper.style.width);
    const wrapperH = parseFloat(wrapper.style.height);
    expect(wrapperW).toBeGreaterThan(0);
    expect(wrapperH).toBeGreaterThan(0);
    expect(wrapperW).toBeLessThanOrEqual(380);
    expect(wrapperH).toBeLessThanOrEqual(520);

    const svgEl = wrapper.querySelector('svg');
    expect(svgEl).toBeTruthy();
    const svgStyle = svgEl!.getAttribute('style') || '';
    // The injected preview style must pin the SVG to the wrapper size in px,
    // overriding any mm-based natural width/height that would clip content.
    const roundedW = wrapperW.toFixed(2);
    const roundedH = wrapperH.toFixed(2);
    expect(svgStyle).toContain(`width:${roundedW}px`);
    expect(svgStyle).toContain(`height:${roundedH}px`);
  });

  it('keeps the SVG viewBox intact so the page proportions are preserved', () => {
    const flyer = createFlyerTemplate('ristorante', 'classic');
    const { container } = render(<FlyerPreview flyer={flyer} />);
    const svgEl = container.querySelector('svg');
    expect(svgEl).toBeTruthy();
    const vb = svgEl!.getAttribute('viewBox');
    expect(vb).toMatch(/0 0 \d+\.?\d* \d+\.?\d*/);
  });
});
