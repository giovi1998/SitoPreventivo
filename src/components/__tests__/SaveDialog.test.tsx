import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import SaveDialog from '../SaveDialog';

describe('SaveDialog', () => {
  beforeEach(() => {
    cleanup();
  });

  it('uses "preventivo" as the default documentLabel for backward compat', () => {
    render(
      <SaveDialog open defaultName="" onSave={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByRole('heading', { name: /Salva preventivo/i })).toBeInTheDocument();
  });

  it('renders "Salva QR Code" when documentLabel="QR Code" is passed', () => {
    render(
      <SaveDialog
        open
        defaultName=""
        documentLabel="QR Code"
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: /Salva QR Code/i })).toBeInTheDocument();
  });

  it('renders "Salva logo" when documentLabel="logo" is passed (regression)', () => {
    // Phase 7 hotfix: LogoEditor was hardcoded to "Salva preventivo" even
    // when saving a logo, which was a visible UX bug. Now the editor
    // passes `documentLabel="logo"` and the dialog matches the action.
    render(
      <SaveDialog
        open
        defaultName=""
        documentLabel="logo"
        placeholder="Es. Logo - Acme Srl"
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: /Salva logo/i })).toBeInTheDocument();
    const input = screen.getByPlaceholderText(/Logo - Acme/);
    expect(input).toBeInTheDocument();
  });

  it('uses the placeholder override when provided', () => {
    render(
      <SaveDialog
        open
        defaultName=""
        documentLabel="bigliettino"
        placeholder="Es. Bigliettino Mario Rossi"
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: /Salva bigliettino/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Bigliettino Mario/)).toBeInTheDocument();
  });

  it('falls back to a generic placeholder when documentLabel is set but no placeholder', () => {
    render(
      <SaveDialog
        open
        defaultName=""
        documentLabel="QR Code"
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    // Capitalize first letter for the placeholder
    expect(screen.getByPlaceholderText(/Es\. QR Code/)).toBeInTheDocument();
  });

  it('calls onSave with the trimmed name when the primary button is clicked', () => {
    const onSave = vi.fn();
    render(
      <SaveDialog
        open
        defaultName=""
        documentLabel="logo"
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    const input = screen.getByPlaceholderText(/Es\. Logo/);
    fireEvent.change(input, { target: { value: '  Logo Acme  ' } });
    fireEvent.click(screen.getByRole('button', { name: /^Salva$/i }));
    expect(onSave).toHaveBeenCalledWith('Logo Acme');
  });

  it('returns null when open is false (no DOM render)', () => {
    const { container } = render(
      <SaveDialog
        open={false}
        defaultName="something"
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
