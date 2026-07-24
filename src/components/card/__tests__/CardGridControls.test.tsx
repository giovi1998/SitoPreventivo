import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardGridControls } from '../CardGridControls';
import { createEmptyCard, createGiovanniCardTemplate } from '../../../utils/documentSchemas';
import type { BusinessCard, CardGrid } from '../../../utils/documentSchemas';

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
      onPatchPlacement: vi.fn(),
      mode: 'inline',
      ...props,
    };
    return {
      ...render(<CardGridControls {...base} />),
      mocks: {
        onChangeGrid: base.onChangeGrid,
        onPatchPlacement: base.onPatchPlacement,
      },
    };
  }

  it('shows photo placement controls when photo element is selected', () => {
    const card = createGiovanniCardTemplate();
    renderControls({ card, selected: 'photo' });
    expect(screen.getByTestId('grid-placement-controls')).toBeInTheDocument();
    expect(screen.getByLabelText(/zoom foto/i)).toHaveValue('1');
  });

  it('does not show placement controls when no element is selected', () => {
    const card = createGiovanniCardTemplate();
    renderControls({ card, selected: '' });
    expect(screen.queryByTestId('grid-placement-controls')).not.toBeInTheDocument();
    expect(screen.queryByTestId('grid-placement-zoom')).not.toBeInTheDocument();
  });

  it('shows zoom slider labelled "Dimensione" for text elements (name/title)', () => {
    const card = createGiovanniCardTemplate();
    renderControls({ card, selected: 'name' });
    expect(screen.getByTestId('grid-placement-zoom')).toBeInTheDocument();
    expect(screen.getByLabelText(/dimensione nome/i)).toHaveValue('1');

    renderControls({ card, selected: 'title' });
    expect(screen.getByLabelText(/dimensione ruolo/i)).toBeInTheDocument();
  });

  it('shows zoom slider labelled "Dimensione" for back text elements (contacts)', () => {
    const card = createGiovanniCardTemplate();
    renderControls({ card, side: 'back', selected: 'contacts' });
    expect(screen.getByTestId('grid-placement-zoom')).toBeInTheDocument();
    expect(screen.getByLabelText(/dimensione contatti/i)).toBeInTheDocument();
  });

  it('keeps "Zoom" label for image-like elements (photo/qr)', () => {
    const card = createGiovanniCardTemplate();
    renderControls({ card, selected: 'photo' });
    expect(screen.getByLabelText(/zoom foto/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/dimensione foto/i)).not.toBeInTheDocument();

    renderControls({ card, side: 'back', selected: 'qr' });
    expect(screen.getByLabelText(/zoom qr/i)).toBeInTheDocument();
  });

  it('changes text scale via range and patches placement.scale', () => {
    const card = createGiovanniCardTemplate();
    const { mocks } = renderControls({ card, selected: 'name' });
    fireEvent.change(screen.getByTestId('grid-placement-zoom'), { target: { value: '1.3' } });
    expect(mocks.onPatchPlacement).toHaveBeenCalledWith('name', { x: 0, y: 0, scale: 1.3 });
  });

  it('nudges photo left and clamps to -1', () => {
    const card = createGiovanniCardTemplate();
    const { mocks } = renderControls({ card, selected: 'photo' });
    fireEvent.click(screen.getByTestId('grid-placement-left'));
    expect(mocks.onPatchPlacement).toHaveBeenCalledWith('photo', { x: -0.05, y: 0, scale: 1 });
  });

  it('zooms photo via range', () => {
    const card = createGiovanniCardTemplate();
    const { mocks } = renderControls({ card, selected: 'photo' });
    fireEvent.change(screen.getByTestId('grid-placement-zoom'), { target: { value: '1.5' } });
    expect(mocks.onPatchPlacement).toHaveBeenCalledWith('photo', { x: 0, y: 0, scale: 1.5 });
  });

  it('hides placement controls when onPatchPlacement is not provided', () => {
    const card = createGiovanniCardTemplate();
    renderControls({ card, selected: 'photo', onPatchPlacement: undefined });
    expect(screen.queryByTestId('grid-placement-controls')).not.toBeInTheDocument();
  });

  it('shows QR placement controls when QR element is selected on back', () => {
    const card = createGiovanniCardTemplate();
    renderControls({ card, side: 'back', selected: 'qr' });
    expect(screen.getByTestId('grid-placement-controls')).toBeInTheDocument();
    expect(screen.getByLabelText(/zoom QR/i)).toHaveValue('1');
  });

  it('nudges QR right with element identifier', () => {
    const card = createGiovanniCardTemplate();
    const { mocks } = renderControls({ card, side: 'back', selected: 'qr' });
    fireEvent.click(screen.getByTestId('grid-placement-right'));
    expect(mocks.onPatchPlacement).toHaveBeenCalledWith('qr', { x: 0.05, y: 0, scale: 1 });
  });
});
