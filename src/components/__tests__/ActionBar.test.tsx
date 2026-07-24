import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ActionBar from '../ActionBar';

describe('ActionBar (REQ-UX-004/005)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cluster Salva (primary) / Esporta (secondary) / Nuovo (ghost)', () => {
    render(
      <ActionBar
        onSave={() => {}}
        onNew={() => {}}
        exportItems={[{ id: 'pdf', label: 'PDF' }]}
        onExport={() => {}}
      />
    );
    const toolbar = screen.getByRole('toolbar', { name: /Azioni documento/i });
    expect(toolbar).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salva' })).toHaveClass('action-bar__btn--primary');
    expect(screen.getByRole('button', { name: /Esporta ▾/i })).toHaveClass('action-bar__btn--secondary');
    expect(screen.getByRole('button', { name: 'Nuovo' })).toHaveClass('action-bar__btn--ghost');
  });

  it('menu Esporta: chiuso di default, si apre al click, chiama onExport e si richiude', () => {
    const onExport = vi.fn();
    render(<ActionBar exportItems={[{ id: 'svg', label: 'SVG vettoriale' }]} onExport={onExport} />);
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Esporta ▾/i }));
    const item = screen.getByRole('menuitem', { name: /SVG vettoriale/i });
    fireEvent.click(item);
    expect(onExport).toHaveBeenCalledWith('svg');
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  it('click fuori dal menu lo chiude', () => {
    render(
      <div>
        <ActionBar exportItems={[{ id: 'png', label: 'PNG' }]} onExport={() => {}} />
        <button>fuori</button>
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: /Esporta ▾/i }));
    expect(screen.getByRole('menuitem')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'fuori' }));
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  it('ESC chiude il menu', () => {
    render(<ActionBar exportItems={[{ id: 'png', label: 'PNG' }]} onExport={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Esporta ▾/i }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  it('bottoni opzionali: senza onSave/onNew/exportItems non li renderizza', () => {
    render(<ActionBar onSave={() => {}} />);
    expect(screen.getByRole('button', { name: 'Salva' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuovo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Esporta/i })).not.toBeInTheDocument();
  });

  it('disabled states rispettati', () => {
    render(
      <ActionBar
        onSave={() => {}}
        saveDisabled
        onNew={() => {}}
        newDisabled
        exportItems={[{ id: 'png', label: 'PNG' }]}
        onExport={() => {}}
        exportDisabled
      />
    );
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Nuovo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Esporta ▾/i })).toBeDisabled();
  });
});
