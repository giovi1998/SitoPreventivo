import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiFontPicker, SHARED_FONT_FAMILIES } from '../AiFontPicker';

describe('AiFontPicker', () => {
  it('renders shared fonts', () => {
    render(<AiFontPicker value="Inter" onChange={() => {}} label="Font" />);
    expect(screen.getByText('Font')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(SHARED_FONT_FAMILIES.length).toBe(17);
  });

  it('calls onChange when selecting a font', () => {
    const onChange = vi.fn();
    render(<AiFontPicker value="Inter" onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Georgia' } });
    expect(onChange).toHaveBeenCalledWith('Georgia');
  });

  it('shows custom input for unknown fonts', () => {
    render(<AiFontPicker value="MyCustomFont" onChange={() => {}} allowCustom />);
    expect(screen.getByDisplayValue('MyCustomFont')).toBeInTheDocument();
  });
});
