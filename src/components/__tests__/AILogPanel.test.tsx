import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import AILogPanel from '../AILogPanel';
import type { AILogEntry } from '../../ai/types';

const makeEntry = (overrides: Partial<AILogEntry> = {}): AILogEntry => ({
  id: `log-${Math.random()}`,
  type: 'info',
  msg: 'Test message',
  time: '12:34:56',
  status: 'done',
  ...overrides,
});

describe('AILogPanel', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders empty state when no logs', () => {
    render(<AILogPanel logs={[]} isProcessing={false} />);
    expect(screen.getByText(/ancora\.\.\./i)).toBeInTheDocument();
  });

  it('renders log entries with time and message', () => {
    const logs = [
      makeEntry({ msg: 'Primo evento', time: '10:00:00' }),
      makeEntry({ msg: 'Secondo evento', time: '10:00:01' }),
    ];
    render(<AILogPanel logs={logs} isProcessing={false} />);
    expect(screen.getByText('Primo evento')).toBeInTheDocument();
    expect(screen.getByText('Secondo evento')).toBeInTheDocument();
  });

  it('shows pulse indicator when processing', () => {
    const { container } = render(<AILogPanel logs={[]} isProcessing={true} />);
    expect(container.querySelector('.ai-log-pulse')).toBeInTheDocument();
  });

  it('does not show pulse when idle', () => {
    const { container } = render(<AILogPanel logs={[]} isProcessing={false} />);
    expect(container.querySelector('.ai-log-pulse')).not.toBeInTheDocument();
  });

  it('expands entry detail on click', () => {
    const logs = [makeEntry({ msg: 'con dettaglio', detail: 'contenuto raw' })];
    render(<AILogPanel logs={logs} isProcessing={false} />);
    fireEvent.click(screen.getByText('con dettaglio'));
    expect(screen.getByText('contenuto raw')).toBeInTheDocument();
  });

  it('collapses entry detail on second click', () => {
    const logs = [makeEntry({ msg: 'con dettaglio', detail: 'contenuto raw' })];
    render(<AILogPanel logs={logs} isProcessing={false} />);
    const row = screen.getByText('con dettaglio');
    fireEvent.click(row);
    expect(screen.getByText('contenuto raw')).toBeInTheDocument();
    fireEvent.click(row);
    expect(screen.queryByText('contenuto raw')).not.toBeInTheDocument();
  });

  it('displays duration in ms for tool entries', () => {
    const logs = [makeEntry({ type: 'tool', msg: 'fatto', durationMs: 1234 })];
    render(<AILogPanel logs={logs} isProcessing={false} />);
    expect(screen.getByText('1234ms')).toBeInTheDocument();
  });

  it('opens fullscreen modal on expand button click', () => {
    const logs = [makeEntry()];
    render(<AILogPanel logs={logs} isProcessing={false} />);
    fireEvent.click(screen.getByLabelText('Apri log completo'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes fullscreen modal on backdrop click', () => {
    const logs = [makeEntry()];
    render(<AILogPanel logs={logs} isProcessing={false} />);
    fireEvent.click(screen.getByLabelText('Apri log completo'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('presentation'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes fullscreen modal on Escape key', () => {
    const logs = [makeEntry()];
    render(<AILogPanel logs={logs} isProcessing={false} />);
    fireEvent.click(screen.getByLabelText('Apri log completo'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders multiple entry types with different classes', () => {
    const logs = [
      makeEntry({ id: 'l1', type: 'info', msg: 'info' }),
      makeEntry({ id: 'l2', type: 'success', msg: 'success' }),
      makeEntry({ id: 'l3', type: 'error', msg: 'error' }),
      makeEntry({ id: 'l4', type: 'tool', msg: 'tool' }),
      makeEntry({ id: 'l5', type: 'stream', msg: 'stream' }),
    ];
    const { container } = render(<AILogPanel logs={logs} isProcessing={false} />);
    expect(container.querySelector('.ai-log-info')).toBeInTheDocument();
    expect(container.querySelector('.ai-log-success')).toBeInTheDocument();
    expect(container.querySelector('.ai-log-error')).toBeInTheDocument();
    expect(container.querySelector('.ai-log-tool')).toBeInTheDocument();
    expect(container.querySelector('.ai-log-stream')).toBeInTheDocument();
  });

  it('applies pending class for in-progress entries', () => {
    const logs = [makeEntry({ msg: 'in corso', status: 'pending' })];
    const { container } = render(<AILogPanel logs={logs} isProcessing={false} />);
    expect(container.querySelector('.pending')).toBeInTheDocument();
  });

  it('has role="log" for accessibility', () => {
    render(<AILogPanel logs={[]} isProcessing={false} />);
    expect(screen.getByRole('log')).toBeInTheDocument();
  });

  it('copy includes the detail field when present (complete log)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const logs = [
      makeEntry({ msg: 'Invio richiesta', detail: 'prompt completo qui' }),
      makeEntry({ msg: 'Risposta ricevuta' }),
      makeEntry({ type: 'success', msg: '1 modifica applicata', detail: '• Titolo: "X"' }),
    ];
    render(<AILogPanel logs={logs} isProcessing={false} />);
    fireEvent.click(screen.getByLabelText('Copia log'));
    await new Promise((r) => setTimeout(r, 0));
    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain('Invio richiesta');
    expect(copied).toContain('prompt completo qui');
    expect(copied).toContain('1 modifica applicata');
    expect(copied).toContain('• Titolo: "X"');
  });

  it('copy works for entries without detail (backward compat)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const logs = [makeEntry({ msg: 'no detail', detail: undefined })];
    render(<AILogPanel logs={logs} isProcessing={false} />);
    fireEvent.click(screen.getByLabelText('Copia log'));
    await new Promise((r) => setTimeout(r, 0));
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain('no detail');
  });
});
