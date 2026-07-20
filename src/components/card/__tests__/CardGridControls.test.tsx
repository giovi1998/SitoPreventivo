import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardGridControls } from '../CardGridControls';
import { createEmptyCard, createGiovanniCardTemplate } from '../../../utils/documentSchemas';
import type { BusinessCard } from '../../../utils/documentSchemas';

describe('CardGridControls', () => {
  function renderControls(props: Partial<React.ComponentProps<typeof CardGridControls>> = {}) {
    const card: BusinessCard = {
      ...createEmptyCard(),
      ...props.card,
    };
    const base: React.ComponentProps<typeof CardGridControls> = {
      card,
      side: 'front',
      gridEnabled: true,
      onSideChange: vi.fn(),
      onChangeGrid: vi.fn(),
      selected: '',
      onSelect: vi.fn(),
      onAfterMove: vi.fn(),
      onAfterResize: vi.fn(),
      onAfterAlign: vi.fn(),
      onPatchPhotoPlacement: vi.fn(),
      mode: 'inline',
      ...props,
    };
    return {
      ...render(<CardGridControls {...base} />),
      mocks: {
        onChangeGrid: base.onChangeGrid,
        onPatchPhotoPlacement: base.onPatchPhotoPlacement,
      },
    };
  }

  it('shows photo placement controls when photo element is selected', () => {
    const card = createGiovanniCardTemplate();
    renderControls({ card, selected: 'photo' });
    expect(screen.getByTestId('grid-photo-placement')).toBeInTheDocument();
    expect(screen.getByLabelText(/zoom foto/i)).toHaveValue('1');
  });

  it('does not show photo placement controls for non-photo element', () => {
    const card = createGiovanniCardTemplate();
    renderControls({ card, selected: 'name' });
    expect(screen.queryByTestId('grid-photo-placement')).not.toBeInTheDocument();
  });

  it('nudges photo left and clamps to -1', () => {
    const card = createGiovanniCardTemplate();
    const { mocks } = renderControls({ card, selected: 'photo' });
    fireEvent.click(screen.getByTestId('grid-photo-left'));
    expect(mocks.onPatchPhotoPlacement).toHaveBeenCalledWith({ x: -0.05, y: 0, scale: 1 });
  });

  it('zooms photo via range', () => {
    const card = createGiovanniCardTemplate();
    const { mocks } = renderControls({ card, selected: 'photo' });
    fireEvent.change(screen.getByTestId('grid-photo-zoom'), { target: { value: '1.5' } });
    expect(mocks.onPatchPhotoPlacement).toHaveBeenCalledWith({ x: 0, y: 0, scale: 1.5 });
  });

  it('hides photo placement controls when onPatchPhotoPlacement is not provided', () => {
    const card = createGiovanniCardTemplate();
    renderControls({ card, selected: 'photo', onPatchPhotoPlacement: undefined });
    expect(screen.queryByTestId('grid-photo-placement')).not.toBeInTheDocument();
  });
});
