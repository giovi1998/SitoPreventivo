import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DecorationPicker, DECORATION_LABELS } from '../DecorationPicker';
import { DECORATIVE_PATTERN_IDS } from '../../utils/decorations/patterns';

describe('DecorationPicker', () => {
  it('renders one thumbnail per pattern plus none', () => {
    render(<DecorationPicker value={null} onChange={vi.fn()} />);
    expect(screen.getByTestId('decoration-thumb-none')).toBeInTheDocument();
    for (const id of DECORATIVE_PATTERN_IDS) {
      expect(screen.getByTestId(`decoration-thumb-${id}`)).toBeInTheDocument();
    }
  });

  it('marks the active pattern as aria-checked', () => {
    render(<DecorationPicker value="blob-corner" onChange={vi.fn()} />);
    expect(screen.getByTestId('decoration-thumb-blob-corner')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('decoration-thumb-none')).toHaveAttribute('aria-checked', 'false');
  });

  it('marks none as active when value is null', () => {
    render(<DecorationPicker value={null} onChange={vi.fn()} />);
    expect(screen.getByTestId('decoration-thumb-none')).toHaveAttribute('aria-checked', 'true');
  });

  it('emits the pattern id on click', () => {
    const onChange = vi.fn();
    render(<DecorationPicker value={null} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('decoration-thumb-wave-bottom'));
    expect(onChange).toHaveBeenCalledWith('wave-bottom');
  });

  it('emits null when the none thumbnail is clicked', () => {
    const onChange = vi.fn();
    render(<DecorationPicker value="wave-bottom" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('decoration-thumb-none'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('uses pattern labels as titles', () => {
    render(<DecorationPicker value={null} onChange={vi.fn()} />);
    for (const id of DECORATIVE_PATTERN_IDS) {
      expect(screen.getByTestId(`decoration-thumb-${id}`)).toHaveAttribute('title', DECORATION_LABELS[id]);
    }
  });

  it('renders an inline svg thumbnail (not empty) for each pattern', () => {
    const { container } = render(<DecorationPicker value={null} onChange={vi.fn()} />);
    const svgs = container.querySelectorAll('svg.decoration-picker__thumb-svg');
    expect(svgs.length).toBe(DECORATIVE_PATTERN_IDS.length);
    for (const svg of svgs) {
      expect(svg.getAttribute('viewBox')).toBe('0 0 80 50');
    }
  });
});