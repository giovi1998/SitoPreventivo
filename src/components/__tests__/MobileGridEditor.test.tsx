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
    render(<MobileGridEditor grid={initialGrid} onChange={onChange} />);
    const select = screen.getByLabelText(/Elemento/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'name' } });
    fireEvent.click(screen.getByRole('button', { name: /Sposta elemento/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sposta a sinistra/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const newGrid = onChange.mock.calls[0][0] as CardGrid;
    const oldName = initialGrid.elements.name!;
    const newName = newGrid.elements.name!;
    expect(newName.x).toBe(Math.max(0, oldName.x - 1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
