import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MobileGridEditor from '../MobileGridEditor';
import { gridPresetLeft } from '../../utils/documentSchemas';
import type { CardGrid } from '../../utils/documentSchemas';

const initialGrid: CardGrid = gridPresetLeft();

describe('MobileGridEditor', () => {
  it('renders a select for element choice and preset, and a "Sposta" button', () => {
    render(
      <MobileGridEditor
        grid={initialGrid}
        onChange={() => {}}
      />,
    );
    expect(screen.getByLabelText(/Elemento/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Preset/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sposta elemento/i })).toBeInTheDocument();
  });

  it('opens popup with 4 arrow buttons when "Sposta elemento" is tapped', () => {
    render(<MobileGridEditor grid={initialGrid} onChange={() => {}} />);
    const select = screen.getByLabelText(/Elemento/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'name' } });
    fireEvent.click(screen.getByRole('button', { name: /Sposta elemento/i }));
    expect(screen.getByTestId('mobile-grid-popup')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sposta su/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sposta giù/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sposta a sinistra/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sposta a destra/i })).toBeInTheDocument();
  });

  it('clicking an arrow button calls onChange with the moved grid and closes popup', () => {
    const onChange = vi.fn();
    const grid: CardGrid = {
      cols: 4,
      rows: 4,
      elements: {
        photo: { x: 0, y: 0, w: 1, h: 4 },
        name: { x: 1, y: 1, w: 3, h: 1 },
        title: { x: 1, y: 2, w: 3, h: 1 },
      },
    };
    render(<MobileGridEditor grid={grid} onChange={onChange} />);
    const select = screen.getByLabelText(/Elemento/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'name' } });
    fireEvent.click(screen.getByRole('button', { name: /Sposta elemento/i }));
    // name a (1,1): up va a y=0 libero (photo è in x=0)
    fireEvent.click(screen.getByRole('button', { name: /Sposta su/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const newGrid = onChange.mock.calls[0][0] as CardGrid;
    const newName = newGrid.elements.name!;
    expect(newName.y).toBe(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('arrow buttons are disabled when move would cause collision (BLOCK)', () => {
    const grid: CardGrid = {
      cols: 4,
      rows: 4,
      elements: {
        photo: { x: 0, y: 0, w: 1, h: 4 },
        name: { x: 1, y: 1, w: 3, h: 1 },
        title: { x: 1, y: 2, w: 3, h: 1 },
      },
    };
    render(<MobileGridEditor grid={grid} onChange={() => {}} />);
    const select = screen.getByLabelText(/Elemento/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'name' } });
    fireEvent.click(screen.getByRole('button', { name: /Sposta elemento/i }));
    // name a (1,1,3,1): left collide con photo a (0,0,1,4)
    expect(screen.getByRole('button', { name: /Sposta a sinistra/i })).toBeDisabled();
    // right: x+w=4 edge, ma anche collide con... no, edge prima
    expect(screen.getByRole('button', { name: /Sposta a destra/i })).toBeDisabled();
  });

  it('Logo option is selectable (Phase 2.1: logo is a grid element)', () => {
    render(<MobileGridEditor grid={initialGrid} onChange={() => {}} />);
    const select = screen.getByLabelText(/Elemento/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'logo' } });
    expect((select as HTMLSelectElement).value).toBe('logo');
  });

  it('side="back" only shows back elements (contacts/qr/socials), not front elements', () => {
    render(<MobileGridEditor grid={initialGrid} onChange={() => {}} side="back" />);
    const select = screen.getByLabelText(/Elemento/i) as HTMLSelectElement;
    const optionValues = Array.from(select.querySelectorAll('option')).map((o) => (o as HTMLOptionElement).value);
    expect(optionValues).toContain('contacts');
    expect(optionValues).toContain('qr');
    expect(optionValues).toContain('socials');
    expect(optionValues).not.toContain('photo');
    expect(optionValues).not.toContain('name');
    expect(optionValues).not.toContain('logo');
  });

  it('side="back" preset dropdown shows only "Default retro" option', () => {
    render(<MobileGridEditor grid={initialGrid} onChange={() => {}} side="back" />);
    const presetSelect = screen.getByLabelText(/Preset/i) as HTMLSelectElement;
    const presetValues = Array.from(presetSelect.querySelectorAll('option')).map((o) => (o as HTMLOptionElement).value);
    expect(presetValues).toEqual(['split']);
  });
});
