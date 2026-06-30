import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MobileGridEditor from '../MobileGridEditor';
import {
  gridPresetLeft,
  createGiovanniCardTemplate,
  createEmptyCard,
} from '../../utils/documentSchemas';
import type { BusinessCard, CardGrid } from '../../utils/documentSchemas';

describe('MobileGridEditor (Phase 2.2 API)', () => {
  it('renders side + element + Sposta elementi button', () => {
    const card = createGiovanniCardTemplate();
    render(
      <MobileGridEditor
        card={card}
        side="front"
        gridEnabled
        selected=""
        onSelect={() => {}}
        onChangeSide={() => {}}
        onChangeGrid={() => {}}
      />,
    );
    expect(screen.getByLabelText(/Lato griglia/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Elemento selezionato/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sposta elemento/i })).toBeInTheDocument();
  });

  it('opens popup with 4 arrow buttons when "Sposta elemento" is tapped', () => {
    const card: BusinessCard = {
      ...createGiovanniCardTemplate(),
      grid: { cols: 4, rows: 4, elements: { name: { x: 1, y: 1, w: 3, h: 1 } } },
    };
    render(
      <MobileGridEditor
        card={card}
        side="front"
        gridEnabled
        selected="name"
        onSelect={() => {}}
        onChangeSide={() => {}}
        onChangeGrid={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Sposta elemento/i }));
    expect(screen.getByTestId('mobile-grid-popup')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sposta su/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sposta giù/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sposta a sinistra/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sposta a destra/i })).toBeInTheDocument();
  });

  it('clicking an arrow button calls onChangeGrid with the moved grid and closes popup', () => {
    const onChangeGrid = vi.fn();
    const card: BusinessCard = {
      ...createEmptyCard(),
      front: { ...createEmptyCard().front, name: 'Mario' },
      grid: {
        cols: 4,
        rows: 4,
        elements: {
          photo: { x: 0, y: 0, w: 1, h: 4 },
          name: { x: 1, y: 1, w: 3, h: 1 },
        },
      },
    };
    render(
      <MobileGridEditor
        card={card}
        side="front"
        gridEnabled
        selected="name"
        onSelect={() => {}}
        onChangeSide={() => {}}
        onChangeGrid={onChangeGrid}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Sposta elemento/i }));
    // name a (1,1): up va a y=0 libero (photo è in x=0)
    fireEvent.click(screen.getByRole('button', { name: /Sposta su/i }));
    expect(onChangeGrid).toHaveBeenCalledTimes(1);
    const args = onChangeGrid.mock.calls[0];
    const newGrid: CardGrid = args[0];
    const newName = newGrid.elements.name!;
    expect(newName.y).toBe(0);
    expect(args[1]).toEqual({ useGrid: true });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('arrow buttons are disabled when move would cause collision (BLOCK)', () => {
    const card: BusinessCard = {
      ...createEmptyCard(),
      front: { ...createEmptyCard().front, name: 'Mario' },
      grid: {
        cols: 4,
        rows: 4,
        elements: {
          photo: { x: 0, y: 0, w: 1, h: 4 },
          name: { x: 1, y: 1, w: 3, h: 1 },
          title: { x: 1, y: 2, w: 3, h: 1 },
        },
      },
    };
    render(
      <MobileGridEditor
        card={card}
        side="front"
        gridEnabled
        selected="name"
        onSelect={() => {}}
        onChangeSide={() => {}}
        onChangeGrid={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Sposta elemento/i }));
    // name a (1,1,3,1): left collide con photo a (0,0,1,4)
    expect(screen.getByRole('button', { name: /Sposta a sinistra/i })).toBeDisabled();
    // right: x+w=4 edge → disabled
    expect(screen.getByRole('button', { name: /Sposta a destra/i })).toBeDisabled();
  });

  it('disables Sposta elementi button when gridEnabled=false (master switch OFF)', () => {
    const card = createGiovanniCardTemplate();
    render(
      <MobileGridEditor
        card={card}
        side="front"
        gridEnabled={false}
        selected=""
        onSelect={() => {}}
        onChangeSide={() => {}}
        onChangeGrid={() => {}}
      />,
    );
    const btn = screen.getByRole('button', { name: /Sposta elemento/i });
    expect(btn).toBeDisabled();
  });

  it('side="back" only shows back elements in element select', () => {
    const card = createGiovanniCardTemplate();
    render(
      <MobileGridEditor
        card={card}
        side="back"
        gridEnabled
        selected=""
        onSelect={() => {}}
        onChangeSide={() => {}}
        onChangeGrid={() => {}}
      />,
    );
    const select = screen.getByLabelText(/Elemento selezionato/i) as HTMLSelectElement;
    const optionTexts = Array.from(select.querySelectorAll('option')).map((o) => o.textContent ?? '');
    // Deve contenere "Contatti", "QR" (perché website è settato) ma NON
    // "Foto", "Nome", "Logo" (front-only).
    expect(optionTexts.some((t) => /Contatti/.test(t))).toBe(true);
    expect(optionTexts.some((t) => /QR/.test(t))).toBe(true);
    expect(optionTexts.some((t) => /^Foto$/.test(t))).toBe(false);
    expect(optionTexts.some((t) => /^Logo$/.test(t))).toBe(false);
  });
});
