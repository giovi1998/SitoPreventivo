import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MobileGridEditor, { blockedMoveReason } from '../MobileGridEditor';
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
    expect(args[1]).toBeUndefined();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('arrow buttons are disabled when move would cause collision (BLOCK)', () => {
    const card: BusinessCard = {
      ...createEmptyCard(),
      // photoUrl required: gridForCollisions ignores elements with no real
      // content (e.g. an empty photo cell must not block movement), so the
      // photo element only participates in the collision check below when
      // it actually has an image.
      front: { ...createEmptyCard().front, name: 'Mario', photoUrl: 'data:image/png;base64,PHOTO' },
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

  it('delegates preset select to onApplyPreset when provided (no divergent inline fallback)', () => {
    const card = createGiovanniCardTemplate();
    const onApplyPreset = vi.fn();
    const onChangeGrid = vi.fn();
    render(
      <MobileGridEditor
        card={card}
        side="front"
        gridEnabled
        selected=""
        onSelect={() => {}}
        onChangeSide={() => {}}
        onChangeGrid={onChangeGrid}
        onApplyPreset={onApplyPreset}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Preset griglia/i), { target: { value: 'left' } });
    expect(onApplyPreset).toHaveBeenCalledTimes(1);
    expect(onApplyPreset).toHaveBeenCalledWith('left');
    expect(onChangeGrid).not.toHaveBeenCalled();
  });

  it('fallback preset (no onApplyPreset) matches canonical gridPresetLeft: no photo/logo overlap, alignH/alignV set', () => {
    const base = createEmptyCard();
    const card: BusinessCard = {
      ...base,
      front: {
        ...base.front,
        photoUrl: 'data:image/png;base64,PHOTO',
        logoUrl: 'data:image/png;base64,LOGO',
        name: 'Mario Rossi',
        title: 'CEO',
        company: 'ACME',
      },
    };
    const onChangeGrid = vi.fn();
    render(
      <MobileGridEditor
        card={card}
        side="front"
        gridEnabled
        selected=""
        onSelect={() => {}}
        onChangeSide={() => {}}
        onChangeGrid={onChangeGrid}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Preset griglia/i), { target: { value: 'left' } });
    expect(onChangeGrid).toHaveBeenCalledTimes(1);
    const grid: CardGrid = onChangeGrid.mock.calls[0][0];
    expect(grid).toEqual(gridPresetLeft());
    // Regression: il vecchio fallback inline metteva photo h:4 + logo y:3
    // → sovrapposizione in riga 3. Qui photo (h:3) e logo (y:3) non collidono.
    const photo = grid.elements.photo!;
    const logo = grid.elements.logo!;
    expect(photo.y + photo.h).toBeLessThanOrEqual(logo.y);
    for (const el of Object.values(grid.elements)) {
      expect(el?.alignH).toBeDefined();
      expect(el?.alignV).toBeDefined();
    }
  });

  it('blockedMoveReason returns "collision" when the move is blocked by another element', () => {
    // Parità col desktop (CardGridControls.handleMove): il motivo del blocco
    // non è sempre 'border'. I bottoni del popup sono disabled quando la
    // mossa è bloccata, quindi il ramo è testato sull'helper puro.
    const el = { x: 1, y: 1, w: 3, h: 1 };
    const grid: CardGrid = { cols: 4, rows: 4, elements: {} };
    // left: x+dx=0 resta dentro i bordi → il blocco (photo a x=0) è collisione.
    expect(blockedMoveReason(el, grid, -1, 0)).toBe('collision');
  });

  it('blockedMoveReason returns "border" when the move exits the grid', () => {
    const el = { x: 1, y: 0, w: 3, h: 1 };
    const grid: CardGrid = { cols: 4, rows: 4, elements: {} };
    expect(blockedMoveReason(el, grid, 0, -1)).toBe('border');
    expect(blockedMoveReason(el, grid, 1, 0)).toBe('border'); // x+w=4 → bordo dx
  });
});
