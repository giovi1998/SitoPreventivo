import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SocialEditor from '../SocialEditor';

const mockGeneratePostImage = vi.fn().mockResolvedValue('data:image/jpeg;base64,QUJD');
let mockPosts: { platform: string; caption: string; hashtags: string[]; tone: string; imagePrompt?: string }[] = [];
let mockPostImages: Record<string, string> = {};

// Mock useAISocial to avoid provider/network calls
vi.mock('../../hooks/useAISocial', () => ({
  useAISocial: () => ({
    generate: vi.fn(),
    generatePostImage: mockGeneratePostImage,
    posts: mockPosts,
    postImages: mockPostImages,
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
    mockPosts = [];
    mockPostImages = {};
    mockGeneratePostImage.mockClear();
  });

  it('mostra bottone "Genera immagine" per post con imagePrompt e chiama la generazione', async () => {
    mockPosts = [
      { platform: 'instagram', caption: 'Ciao', hashtags: ['#food'], tone: 'casual', imagePrompt: 'flat lay pastries' },
      { platform: 'facebook', caption: 'FB', hashtags: [], tone: 'promotional', imagePrompt: 'bakery storefront' },
      { platform: 'linkedin', caption: 'LI', hashtags: [], tone: 'professional', imagePrompt: 'office desk' },
    ];
    renderWithRouter(
      <SocialEditor
        userEmail="t@e.com"
        cardDocuments={[{ id: 'c1', title: 'Card' } as never]}
        flyerDocuments={[]}
      />
    );
    const buttons = screen.getAllByRole('button', { name: /Genera immagine/i });
    expect(buttons).toHaveLength(3);
    fireEvent.click(buttons[0]);
    expect(mockGeneratePostImage).toHaveBeenCalledWith('instagram', 'flat lay pastries');
  });

  it('mostra la preview immagine quando postImages contiene la piattaforma', () => {
    mockPosts = [
      { platform: 'instagram', caption: 'Ciao', hashtags: [], tone: 'casual', imagePrompt: 'x' },
      { platform: 'facebook', caption: 'FB', hashtags: [], tone: 'promotional' },
      { platform: 'linkedin', caption: 'LI', hashtags: [], tone: 'professional' },
    ];
    mockPostImages = { instagram: 'data:image/jpeg;base64,QUJD' };
    renderWithRouter(
      <SocialEditor
        userEmail="t@e.com"
        cardDocuments={[{ id: 'c1', title: 'Card' } as never]}
        flyerDocuments={[]}
      />
    );
    const img = screen.getByRole('img', { name: /immagine post instagram/i });
    expect(img.getAttribute('src')).toBe('data:image/jpeg;base64,QUJD');
  });

  it('renderizza il form con sorgente e tono (regressione)', () => {
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
