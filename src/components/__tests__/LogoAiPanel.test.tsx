import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LogoAiPanel from '../LogoAiPanel';

vi.mock('../../hooks/useAILogo', () => ({
  useAILogo: () => ({
    generate: vi.fn(),
    generateBackground: vi.fn(),
    isProcessing: false,
    isGeneratingBg: false,
    logs: [],
    reset: vi.fn(),
    availableModels: [],
  }),
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

// Stub fetch per evitare errori su /api/ai/logo-config in jsdom
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ enabled: false, provider: 'none' }) }));

describe('LogoAiPanel (spec 11/12 UI integration)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the free-tier blocked message when tier === "free"', () => {
    render(
      <LogoAiPanel
        logo={{ builder: { primaryText: 'X' } } as never}
        onPatch={vi.fn()}
        tier="free"
        userEmail="t@e.com"
      />
    );
    expect(screen.getByText('AI Generation')).toBeDefined();
    expect(screen.getByText(/Riscatta un codice/i)).toBeDefined();
  });

  it('renders the namelix-like chat form when tier === "unlocked"', () => {
    render(
      <LogoAiPanel
        logo={{ builder: { primaryText: 'X' } } as never}
        onPatch={vi.fn()}
        tier="unlocked"
        userEmail="t@e.com"
      />
    );
    expect(screen.getByText(/Cosa fa la tua attività/i)).toBeDefined();
    expect(screen.getByText(/Che mood vuoi/i)).toBeDefined();
    expect(screen.getByText(/Chi è il tuo target/i)).toBeDefined();
  });

  it('mood options list minimal, bold, playful, elegant, tech', () => {
    render(
      <LogoAiPanel
        logo={{ builder: {} } as never}
        onPatch={vi.fn()}
        tier="unlocked"
        userEmail="t@e.com"
      />
    );
    for (const m of ['minimal', 'bold', 'playful', 'elegant', 'tech']) {
      // I bottoni mood hanno il testo come label del button; getAllByText
      // perché "mood" può apparire anche nella domanda "Che mood vuoi".
      const matches = screen.getAllByText(m);
      expect(matches.length).toBeGreaterThan(0);
    }
  });

  it('genera button disabled until activity and target filled', () => {
    render(
      <LogoAiPanel
        logo={{ builder: {} } as never}
        onPatch={vi.fn()}
        tier="unlocked"
        userEmail="t@e.com"
      />
    );
    const btn = screen.getByText('Genera 3 concept').closest('button');
    expect(btn?.hasAttribute('disabled')).toBe(true);
  });

  it('persists answers to localStorage and restores them on remount', async () => {
    const { unmount } = render(
      <LogoAiPanel
        logo={{ builder: {} } as never}
        onPatch={vi.fn()}
        tier="unlocked"
        userEmail="t@e.com"
      />
    );
    const activity = screen.getByPlaceholderText(/Pizzeria moderna/i);
    fireEvent.change(activity, { target: { value: 'Studio pedagogico' } });
    fireEvent.change(screen.getByPlaceholderText(/giovani 25-35/i), { target: { value: 'Genitori' } });
    // wait for debounce
    await new Promise((r) => setTimeout(r, 600));
    unmount();
    render(
      <LogoAiPanel
        logo={{ builder: {} } as never}
        onPatch={vi.fn()}
        tier="unlocked"
        userEmail="t@e.com"
      />
    );
    expect((screen.getByPlaceholderText(/Pizzeria moderna/i) as HTMLTextAreaElement).value).toBe('Studio pedagogico');
    expect((screen.getByPlaceholderText(/giovani 25-35/i) as HTMLInputElement).value).toBe('Genitori');
  });

  it('reset chat clears localStorage', async () => {
    render(
      <LogoAiPanel
        logo={{ builder: {} } as never}
        onPatch={vi.fn()}
        tier="unlocked"
        userEmail="t@e.com"
      />
    );
    const activity = screen.getByPlaceholderText(/Pizzeria moderna/i);
    fireEvent.change(activity, { target: { value: 'X' } });
    await new Promise((r) => setTimeout(r, 600));
    fireEvent.click(screen.getByText('Reset chat'));
    expect(localStorage.getItem('logoAiChat:v1')).toBeNull();
  });
});