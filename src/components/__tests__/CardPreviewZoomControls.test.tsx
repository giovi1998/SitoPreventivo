import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CardPreviewZoomControls from '../CardPreviewZoomControls';

describe('CardPreviewZoomControls', () => {
  it('renders -/reset/+ buttons and current zoom percentage', () => {
    render(
      <CardPreviewZoomControls
        zoom={1}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onReset={() => {}}
        canZoomIn={true}
        canZoomOut={true}
      />,
    );
    expect(screen.getByRole('button', { name: /Riduci zoom/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aumenta zoom/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset zoom/i })).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('displays the current zoom rounded to percentage', () => {
    render(
      <CardPreviewZoomControls
        zoom={0.7}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onReset={() => {}}
        canZoomIn={true}
        canZoomOut={true}
      />,
    );
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('disables zoom in button at max, zoom out at min', () => {
    const { rerender } = render(
      <CardPreviewZoomControls
        zoom={1.5}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onReset={() => {}}
        canZoomIn={false}
        canZoomOut={true}
      />,
    );
    expect(screen.getByRole('button', { name: /Aumenta zoom/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Riduci zoom/i })).not.toBeDisabled();

    rerender(
      <CardPreviewZoomControls
        zoom={0.5}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onReset={() => {}}
        canZoomIn={true}
        canZoomOut={false}
      />,
    );
    expect(screen.getByRole('button', { name: /Riduci zoom/i })).toBeDisabled();
  });

  it('calls onZoomIn/onZoomOut/onReset on clicks', () => {
    const onIn = vi.fn();
    const onOut = vi.fn();
    const onReset = vi.fn();
    render(
      <CardPreviewZoomControls
        zoom={1}
        onZoomIn={onIn}
        onZoomOut={onOut}
        onReset={onReset}
        canZoomIn={true}
        canZoomOut={true}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Aumenta zoom/i }));
    fireEvent.click(screen.getByRole('button', { name: /Riduci zoom/i }));
    fireEvent.click(screen.getByRole('button', { name: /Reset zoom/i }));
    expect(onIn).toHaveBeenCalledTimes(1);
    expect(onOut).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
