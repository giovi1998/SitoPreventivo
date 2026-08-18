import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SocialEditor from '../SocialEditor';
import { MQ_WORKSPACE } from '../../hooks/useMediaQuery';

const mockGeneratePostImage = vi.fn().mockResolvedValue('data:image/jpeg;base64,QUJD');
let mockPosts: { platform: string; caption: string; hashtags: string[]; tone: string; imagePrompt?: string }[] = [];

vi.mock('../../hooks/useAISocial', () => ({
  useAISocial: () => ({
    generate: vi.fn(),
    generatePostImage: mockGeneratePostImage,
    posts: mockPosts,
    postImages: {},
    isProcessing: false,
    logs: [{ step: 'init', message: 'pronto' }],
    reset: vi.fn(),
  }),
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function mockViewport(isMobileWorkspace: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q === MQ_WORKSPACE ? isMobileWorkspace : false,
    media: q,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as any;
}

describe('SocialEditor mobile AI panel (pattern card/website)', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    cleanup();
    localStorage.clear();
    mockPosts = [];
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  const cardDocs = [{ id: 'c1', title: 'Card', front: { name: 'Mario' } } as never];

  it('mobile: nasconde la rail desktop e mostra FAB + bottom sheet', () => {
    mockViewport(true);
    renderWithRouter(<SocialEditor userEmail="t@e.com" cardDocuments={cardDocs} flyerDocuments={[]} />);

    const fab = screen.getByRole('button', { name: /Apri pannello AI/i });
    expect(fab).toBeDefined();
    expect(document.querySelector('.website-rail')).toBeNull();

    fireEvent.click(fab);
    expect(screen.getByRole('dialog', { name: /Pannello AI/i })).toBeDefined();
    expect(screen.getByText('Configura generazione')).toBeDefined();
  });

  it('mobile: chiude il bottom sheet cliccando sul backdrop', () => {
    mockViewport(true);
    renderWithRouter(<SocialEditor userEmail="t@e.com" cardDocuments={cardDocs} flyerDocuments={[]} />);

    fireEvent.click(screen.getByRole('button', { name: /Apri pannello AI/i }));
    const backdrop = screen.getByRole('dialog', { name: /Pannello AI/i });
    fireEvent.click(backdrop);
    expect(screen.queryByRole('dialog', { name: /Pannello AI/i })).toBeNull();
  });

  it('desktop: mostra il form dentro la rail (nessun FAB)', () => {
    mockViewport(false);
    renderWithRouter(<SocialEditor userEmail="t@e.com" cardDocuments={cardDocs} flyerDocuments={[]} />);

    expect(screen.queryByRole('button', { name: /Apri pannello AI/i })).toBeNull();
    expect(screen.getByText('Configura generazione')).toBeDefined();
  });

  it('mobile: hint testuale parla di pannello in basso, non rail a destra', () => {
    mockViewport(true);
    renderWithRouter(<SocialEditor userEmail="t@e.com" cardDocuments={cardDocs} flyerDocuments={[]} />);

    expect(screen.getByText(/pannello AI in basso/i)).toBeDefined();
    expect(screen.queryByText(/rail AI Assist a destra/i)).toBeNull();
  });
});
