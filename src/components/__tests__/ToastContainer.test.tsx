import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ToastContainer from '../ToastContainer';

describe('ToastContainer', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<ToastContainer toasts={[]} onDismiss={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders toast messages', () => {
    render(<ToastContainer toasts={[{ id: 't1', type: 'success', message: 'Salvato!' }]} onDismiss={() => {}} />);
    expect(screen.getByText('Salvato!')).toBeInTheDocument();
  });

  it('calls onDismiss on click', () => {
    const onDismiss = vi.fn();
    render(<ToastContainer toasts={[{ id: 't1', type: 'error', message: 'Errore' }]} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText('Errore'));
    expect(onDismiss).toHaveBeenCalledWith('t1');
  });

  it('renders multiple toasts', () => {
    render(
      <ToastContainer
        toasts={[
          { id: 't1', type: 'success', message: 'Uno' },
          { id: 't2', type: 'error', message: 'Due' },
        ]}
        onDismiss={() => {}}
      />
    );
    expect(screen.getByText('Uno')).toBeInTheDocument();
    expect(screen.getByText('Due')).toBeInTheDocument();
  });
});
