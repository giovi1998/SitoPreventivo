import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FlyerStyleFields } from '../FlyerStyleFields';
import { createEmptyFlyer } from '../../../utils/documentSchemas';
import type { Flyer } from '../../../utils/documentSchemas';

describe('FlyerStyleFields', () => {
  function renderFields(overrides: Partial<Flyer> = {}, onUpdateDecorations = vi.fn()) {
    const flyer = { ...createEmptyFlyer(), ...overrides };
    return render(
      <FlyerStyleFields
        flyer={flyer}
        showCustomFont={false}
        setShowCustomFont={vi.fn()}
        onUpdateStyle={vi.fn()}
        onUpdateDecorations={onUpdateDecorations}
      />,
    );
  }

  it('renders the DecorationPicker when onUpdateDecorations is wired', () => {
    renderFields();
    expect(screen.getByTestId('decoration-picker')).toBeInTheDocument();
    expect(screen.getByTestId('decoration-thumb-none')).toBeInTheDocument();
  });

  it('emits pattern=null when the none thumbnail is clicked', () => {
    const onPatch = vi.fn();
    renderFields({ decorations: { pattern: 'wave-bottom', opacity: 0.2, palette: { primary: '#01696F', secondary: '#E11D48', accent: null }, userLocked: false } }, onPatch);
    fireEvent.click(screen.getByTestId('decoration-thumb-none'));
    expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({ pattern: null }));
  });

  it('emits the chosen pattern id when a thumbnail is clicked', () => {
    const onPatch = vi.fn();
    renderFields({}, onPatch);
    fireEvent.click(screen.getByTestId('decoration-thumb-blob-corner'));
    expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({ pattern: 'blob-corner' }));
  });

  it('shows opacity slider only when a pattern is set', () => {
    const { rerender } = render(
      <FlyerStyleFields
        flyer={{ ...createEmptyFlyer(), decorations: { pattern: 'wave-bottom', opacity: 0.3, palette: { primary: '#01696F', secondary: '#E11D48', accent: null }, userLocked: false } }}
        showCustomFont={false}
        setShowCustomFont={vi.fn()}
        onUpdateStyle={vi.fn()}
        onUpdateDecorations={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/opacità decorazione volantino/i)).toBeInTheDocument();
    rerender(
      <FlyerStyleFields
        flyer={{ ...createEmptyFlyer() }}
        showCustomFont={false}
        setShowCustomFont={vi.fn()}
        onUpdateStyle={vi.fn()}
        onUpdateDecorations={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText(/opacità decorazione volantino/i)).not.toBeInTheDocument();
  });
});