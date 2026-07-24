import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SocialEditor from '../SocialEditor';

// Mock useAISocial to avoid provider/network calls
vi.mock('../../hooks/useAISocial', () => ({
  useAISocial: () => ({
    generate: vi.fn(),
    posts: [],
    isProcessing: false,
    logs: [],
    reset: vi.fn(),
  }),
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('SocialEditor (spec 12 UI integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form with source type, source doc and tone selectors', () => {
    renderWithRouter(
      <SocialEditor
        userEmail="test@example.com"
        cardDocuments={[{ id: 'c1', title: 'Bigliettino Test', front: { name: 'Mario' } } as never]}
        flyerDocuments={[{ id: 'f1', title: 'Volantino Test', content: { headline: 'Sagra' } } as never]}
      />
    );
    expect(screen.getByText('Generatore post social')).toBeDefined();
    expect(screen.getByText('Bigliettino')).toBeDefined();
    expect(screen.getByText('Volantino')).toBeDefined();
  });

  it('shows empty state with CTAs when no documents available (v2.1 fix)', () => {
    renderWithRouter(
      <SocialEditor userEmail="t@e.com" cardDocuments={[]} flyerDocuments={[]} />
    );
    expect(screen.getByText(/Nessun documento sorgente/i)).toBeDefined();
    expect(screen.getByRole('link', { name: /Crea bigliettino/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /Crea volantino/i })).toBeDefined();
  });

  it('lists card documents in the source dropdown', () => {
    renderWithRouter(
      <SocialEditor
        userEmail="t@e.com"
        cardDocuments={[{ id: 'c1', title: 'Mario Card' } as never]}
        flyerDocuments={[]}
      />
    );
    expect(screen.getByText('Mario Card')).toBeDefined();
  });

  it('switches to flyer source and lists flyers', () => {
    renderWithRouter(
      <SocialEditor
        userEmail="t@e.com"
        cardDocuments={[]}
        flyerDocuments={[{ id: 'f1', title: 'Sagra Flyer' } as never]}
      />
    );
    // switch source type to flyer
    const select = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'flyer' } });
    expect(screen.getByText('Sagra Flyer')).toBeDefined();
  });

  it('does not crash when card documents are missing front/style/content (prod data shape)', () => {
    renderWithRouter(
      <SocialEditor
        userEmail="t@e.com"
        cardDocuments={[
          { id: 'c1', title: 'Card with front' } as never,
          { id: 'c2', front: undefined, style: undefined, back: undefined } as never,
          null as never,
        ]}
        flyerDocuments={[
          { id: 'f1', title: 'Flyer with content' } as never,
          { id: 'f2', content: undefined } as never,
          null as never,
        ]}
      />
    );
    expect(screen.getByText('Card with front')).toBeDefined();
    expect(screen.getByText('c2')).toBeDefined();
    // switch to flyer
    const select = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'flyer' } });
    expect(screen.getByText('Flyer with content')).toBeDefined();
    expect(screen.getByText('f2')).toBeDefined();
  });
});
