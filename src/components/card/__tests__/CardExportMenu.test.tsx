import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CardExportMenu from '../CardExportMenu';

describe('CardExportMenu', () => {
  const onAction = vi.fn();
  const onToggle = vi.fn();

  beforeEach(() => {
    onAction.mockClear();
    onToggle.mockClear();
  });

  it('renders desktop variant and calls toggle', () => {
    render(
      <CardExportMenu
        variant="desktop"
        open={false}
        exporting={null}
        onToggle={onToggle}
        onAction={onAction}
      />,
    );
    fireEvent.click(screen.getByText(/Esporta/i));
    expect(onToggle).toHaveBeenCalled();
  });

  it('renders mobile variant and calls toggle', () => {
    render(
      <CardExportMenu
        variant="mobile"
        open={false}
        exporting={null}
        onToggle={onToggle}
        onAction={onAction}
      />,
    );
    fireEvent.click(screen.getByTestId('mobile-export-btn'));
    expect(onToggle).toHaveBeenCalled();
  });

  it('fires action callbacks for each export option when open', () => {
    render(
      <CardExportMenu
        variant="desktop"
        open
        exporting={null}
        onToggle={onToggle}
        onAction={onAction}
      />,
    );
    const actions = [
      ['PDF 10-up \\(tipografia', 'pdf'],
      ['PDF 10-up \\(pulito', 'pdf-clean'],
      ['PNG fronte', 'png-front'],
      ['PNG retro', 'png-back'],
      ['SVG fronte', 'svg-front'],
      ['SVG retro', 'svg-back'],
      ['JSON', 'json'],
    ] as const;
    // labels use RegExp(label) below
    for (const [label, key] of actions) {
      onAction.mockClear();
      fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(label) }));
      expect(onAction).toHaveBeenCalledWith(key);
    }
  });

  it('shows busy label when exporting', () => {
    const { rerender } = render(
      <CardExportMenu
        variant="desktop"
        open={false}
        exporting={null}
        onToggle={onToggle}
        onAction={onAction}
      />,
    );
    expect(screen.getByText(/Esporta/i)).toBeInTheDocument();
    rerender(
      <CardExportMenu
        variant="desktop"
        open={false}
        exporting="pdf"
        onToggle={onToggle}
        onAction={onAction}
      />,
    );
    expect(screen.getByText(/Esportando/i)).toBeInTheDocument();
  });
});
