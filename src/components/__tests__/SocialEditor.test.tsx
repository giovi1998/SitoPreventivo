import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('SocialEditor (spec 12 UI integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form with source type, source doc and tone selectors', () => {
    render(
      <SocialEditor
        userEmail="test@example.com"
        cardDocuments={[{ id: 'c1', title: 'Bigliettino Test', front: { name: 'Mario' } } as never]}
        flyerDocuments={[{ id: 'f1', title: 'Volantino Test', content: { headline: 'Sagra' } } as never]}
      />
    );
    expect(screen.getByText('Social AI')).toBeDefined();
    expect(screen.getByText('Bigliettino')).toBeDefined();
    expect(screen.getByText('Volantino')).toBeDefined();
  });

  it('shows empty state when no documents available (v2.1 fix)', () => {
    render(
      <SocialEditor userEmail="t@e.com" cardDocuments={[]} flyerDocuments={[]} />
    );
    expect(screen.getByText(/Nessun bigliettino o volantino/i)).toBeDefined();
  });

  it('lists card documents in the source dropdown', () => {
    render(
      <SocialEditor
        userEmail="t@e.com"
        cardDocuments={[{ id: 'c1', title: 'Mario Card' } as never]}
        flyerDocuments={[]}
      />
    );
    expect(screen.getByText('Mario Card')).toBeDefined();
  });

  it('switches to flyer source and lists flyers', () => {
    render(
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
});