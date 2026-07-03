import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('qrcode', () => ({
  default: {
    create: () => ({ modules: { size: 1, data: [1] } }),
  },
}));

import { FlyerPreviewPanel } from '../FlyerPreviewPanel';
import { createEmptyFlyer } from '../../../utils/documentSchemas';
import { computeFlyerLayout } from '../../../utils/flyer';

describe('FlyerPreviewPanel', () => {
  it('renders the preview and warnings', () => {
    const flyer = createEmptyFlyer();
    const plan = computeFlyerLayout(flyer);
    render(<FlyerPreviewPanel flyer={flyer} plan={plan} tier="unlocked" previewFocus={false} showDebug={false} setShowDebug={() => {}} setPreviewFocus={() => {}} onCollapse={() => {}} />);
    expect(screen.getByTestId('flyer-preview')).toBeInTheDocument();
    expect(screen.getByText(/Verticale/i)).toBeInTheDocument();
  });

  it('shows density badge', () => {
    const flyer = createEmptyFlyer();
    const plan = computeFlyerLayout(flyer);
    render(<FlyerPreviewPanel flyer={flyer} plan={plan} tier="unlocked" previewFocus={false} showDebug={false} setShowDebug={() => {}} setPreviewFocus={() => {}} onCollapse={() => {}} />);
    expect(screen.getByText('Spazio ok')).toBeInTheDocument();
  });

  it('renders focus toggle', () => {
    const flyer = createEmptyFlyer();
    const plan = computeFlyerLayout(flyer);
    render(<FlyerPreviewPanel flyer={flyer} plan={plan} tier="unlocked" previewFocus={false} showDebug={false} setShowDebug={() => {}} setPreviewFocus={() => {}} onCollapse={() => {}} />);
    expect(screen.getByTestId('focus-toggle')).toBeInTheDocument();
  });
});
