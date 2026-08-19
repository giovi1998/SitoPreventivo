import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SocialEditor from '../SocialEditor';
import { AuthContext, AUTH_DEFAULT } from '../../contexts';

const mockGeneratePostImage = vi.fn().mockResolvedValue('data:image/jpeg;base64,QUJD');
const mockSetPosts = vi.fn();
const mockGenerate = vi.fn().mockResolvedValue({ applied: false, posts: [] });
let mockPosts: { platform: string; caption: string; hashtags: string[]; tone: string; imagePrompt?: string }[] = [];
let mockPostImages: Record<string, string> = {};

// Mock useAISocial to avoid provider/network calls
vi.mock('../../hooks/useAISocial', () => ({
  useAISocial: () => ({
    generate: mockGenerate,
    generatePostImage: mockGeneratePostImage,
    posts: mockPosts,
    postImages: mockPostImages,
    isProcessing: false,
    logs: [],
    reset: vi.fn(),
    setPosts: mockSetPosts,
  }),
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ ...AUTH_DEFAULT, user: { email: 't@e.com', role: 'admin' } }}>
        {ui}
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

describe('SocialEditor (spec 12 UI integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPosts = [];
    mockPostImages = {};
    mockGeneratePostImage.mockClear();
    mockSetPosts.mockClear();
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
    expect(mockGeneratePostImage).toHaveBeenCalledWith('instagram', 'flat lay pastries', expect.any(String));
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

  it('fallback image prompt: usa i dati sorgente, mai vago (GEMINI_NO_IMAGE_IN_RESPONSE)', async () => {
    const { buildFallbackImagePrompt } = await import('../SocialEditor');
    const cardPrompt = buildFallbackImagePrompt(
      { type: 'card', sourceId: 'c1', data: { name: 'Mattia', title: 'Chef', company: 'Thai Food', accentColor: '#fff', services: ['Pad Thai', 'Cucina thai'] } },
      'instagram',
    );
    expect(cardPrompt).toContain('Pad Thai');
    expect(cardPrompt).toContain('No text');
    expect(cardPrompt).not.toContain('coerente col brand');
    const nullPrompt = buildFallbackImagePrompt(null, 'facebook');
    expect(nullPrompt).toContain('Professional social media photo');
    expect(nullPrompt).toContain('No text');
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

  it('offers website as source type and lists website documents', () => {
    renderWithRouter(
      <SocialEditor
        userEmail="t@e.com"
        cardDocuments={[]}
        flyerDocuments={[]}
        websiteDocuments={[{ id: 'w1', brief: { businessName: 'Pizzeria Da Mario' } } as never]}
      />
    );
    const select = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    expect(screen.getByText('Sito web')).toBeDefined();
    fireEvent.change(select, { target: { value: 'website' } });
    expect(screen.getByText('Pizzeria Da Mario')).toBeDefined();
  });

  it('fallback image prompt for website source uses businessName/sector/features', async () => {
    const { buildFallbackImagePrompt } = await import('../SocialEditor');
    const websitePrompt = buildFallbackImagePrompt(
      { type: 'website', sourceId: 'w1', data: { businessName: 'Thai Food', sector: 'Ristorazione', description: 'Cucina thai', features: 'Pad Thai, Asporto' } },
      'instagram',
    );
    expect(websitePrompt).toContain('Thai Food');
    expect(websitePrompt).toContain('Pad Thai');
    expect(websitePrompt).toContain('No text');
  });

  it('passa il prompt libero alla generazione quando si scrive nella textarea', async () => {
    mockGenerate.mockClear();
    renderWithRouter(
      <SocialEditor
        userEmail="t@e.com"
        cardDocuments={[{ id: 'c1', title: 'Mario Card' } as never]}
        flyerDocuments={[]}
      />
    );
    // seleziona il documento sorgente
    const docSelect = screen.getAllByRole('combobox')[1] as HTMLSelectElement;
    fireEvent.change(docSelect, { target: { value: 'c1' } });
    // scrivi il prompt libero
    const textarea = screen.getByPlaceholderText(/Descrivi cosa vuoi creare/i);
    fireEvent.change(textarea, { target: { value: 'Concentrati sui servizi di ristorazione' } });
    // submit della rail AI (pulsante "Genera")
    fireEvent.click(screen.getByRole('button', { name: 'Genera' }));
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'card', sourceId: 'c1' }),
      'promotional',
      expect.objectContaining({ userPrompt: 'Concentrati sui servizi di ristorazione' }),
    );
  });

  it('usa il modello immagine selezionato nel form quando genera', () => {
    mockPosts = [
      { platform: 'instagram', caption: 'Ciao', hashtags: [], tone: 'casual', imagePrompt: 'flat lay pastries' },
      { platform: 'facebook', caption: 'FB', hashtags: [], tone: 'promotional' },
      { platform: 'linkedin', caption: 'LI', hashtags: [], tone: 'professional' },
    ];
    renderWithRouter(
      <SocialEditor
        userEmail="t@e.com"
        cardDocuments={[{ id: 'c1', title: 'Card' } as never]}
        flyerDocuments={[]}
      />
    );
    const modelSelect = screen.getByLabelText('Modello immagine') as HTMLSelectElement;
    fireEvent.change(modelSelect, { target: { value: 'gemini-3.1-flash-lite-image' } });
    const buttons = screen.getAllByRole('button', { name: /Genera immagine/i });
    fireEvent.click(buttons[0]);
    expect(mockGeneratePostImage).toHaveBeenCalledWith('instagram', 'flat lay pastries', 'gemini-3.1-flash-lite-image');
  });

  it('rende la caption modificabile e aggiorna il post', () => {
    mockPosts = [
      { platform: 'instagram', caption: 'Ciao', hashtags: ['#food'], tone: 'casual', imagePrompt: 'flat lay pastries' },
      { platform: 'facebook', caption: 'FB', hashtags: [], tone: 'promotional' },
      { platform: 'linkedin', caption: 'LI', hashtags: [], tone: 'professional' },
    ];
    renderWithRouter(
      <SocialEditor
        userEmail="t@e.com"
        cardDocuments={[{ id: 'c1', title: 'Card' } as never]}
        flyerDocuments={[]}
      />
    );
    const caption = screen.getByLabelText('Modifica caption instagram') as HTMLTextAreaElement;
    fireEvent.change(caption, { target: { value: 'Ciao aggiornato' } });
    expect(mockSetPosts).toHaveBeenCalledWith(expect.any(Function));
    // verifica che l'updater produca la patch giusta
    const updater = mockSetPosts.mock.calls[0][0] as (prev: typeof mockPosts) => typeof mockPosts;
    const next = updater(mockPosts);
    expect(next[0].caption).toBe('Ciao aggiornato');
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
