import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LogoAiPanel from '../LogoAiPanel';

const { generateMock, generateBackgroundMock, hookState } = vi.hoisted(() => ({
  generateMock: vi.fn(),
  generateBackgroundMock: vi.fn(),
  hookState: { isProcessing: false, isGeneratingBg: false },
}));

vi.mock('../../hooks/useAILogo', () => ({
  useAILogo: () => ({
    generate: generateMock,
    generateBackground: generateBackgroundMock,
    isProcessing: hookState.isProcessing,
    isGeneratingBg: hookState.isGeneratingBg,
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
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

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

  describe('preset prompt per settore (Piano B)', () => {
    it('renders a "Usa esempio" button that fills activity/mood/target from the selected sector preset', () => {
      render(
        <LogoAiPanel logo={{ builder: {} } as never} onPatch={vi.fn()} tier="unlocked" userEmail="t@e.com" />
      );
      fireEvent.click(screen.getByText(/Usa esempio/i));
      const activity = screen.getByPlaceholderText(/Pizzeria moderna/i) as HTMLTextAreaElement;
      expect(activity.value.length).toBeGreaterThan(0);
      const target = screen.getByPlaceholderText(/giovani 25-35/i) as HTMLInputElement;
      expect(target.value.length).toBeGreaterThan(0);
    });

    it('changes the preset example when a different sector is selected', () => {
      render(
        <LogoAiPanel logo={{ builder: {} } as never} onPatch={vi.fn()} tier="unlocked" userEmail="t@e.com" />
      );
      const sectorSelect = screen.getByDisplayValue('tech') as HTMLSelectElement;
      fireEvent.change(sectorSelect, { target: { value: 'food' } });
      fireEvent.click(screen.getByText(/Usa esempio/i));
      const activity = screen.getByPlaceholderText(/Pizzeria moderna/i) as HTMLTextAreaElement;
      expect(activity.value.toLowerCase()).toMatch(/pizz|ristor|cucina|food|forno/i);
    });
  });

  describe('libreria "I miei prompt" (Piano B)', () => {
    it('renders the "I miei prompt" section', () => {
      render(
        <LogoAiPanel logo={{ builder: {} } as never} onPatch={vi.fn()} tier="unlocked" userEmail="t@e.com" />
      );
      expect(screen.getByText(/I miei prompt/i)).toBeInTheDocument();
    });

    it('shows an empty-state message when no prompt is saved', () => {
      render(
        <LogoAiPanel logo={{ builder: {} } as never} onPatch={vi.fn()} tier="unlocked" userEmail="t@e.com" />
      );
      expect(screen.getByText(/Nessun prompt salvato/i)).toBeInTheDocument();
    });

    it('saves the current brief to the library and lists it', () => {
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Il mio brief preferito');
      try {
        render(
          <LogoAiPanel logo={{ builder: {} } as never} onPatch={vi.fn()} tier="unlocked" userEmail="t@e.com" />
        );
        fireEvent.change(screen.getByPlaceholderText(/Pizzeria moderna/i), { target: { value: 'Studio pedagogico' } });
        fireEvent.change(screen.getByPlaceholderText(/giovani 25-35/i), { target: { value: 'Genitori' } });
        fireEvent.click(screen.getByText(/Salva questo brief/i));
        expect(screen.getByText('Il mio brief preferito')).toBeInTheDocument();
      } finally {
        promptSpy.mockRestore();
      }
    });

    it('does not save when the label prompt is cancelled', () => {
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
      try {
        render(
          <LogoAiPanel logo={{ builder: {} } as never} onPatch={vi.fn()} tier="unlocked" userEmail="t@e.com" />
        );
        fireEvent.change(screen.getByPlaceholderText(/Pizzeria moderna/i), { target: { value: 'Studio pedagogico' } });
        fireEvent.change(screen.getByPlaceholderText(/giovani 25-35/i), { target: { value: 'Genitori' } });
        fireEvent.click(screen.getByText(/Salva questo brief/i));
        expect(screen.getByText(/Nessun prompt salvato/i)).toBeInTheDocument();
      } finally {
        promptSpy.mockRestore();
      }
    });

    it('applies a saved brief back into the form fields', () => {
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Brief A');
      try {
        render(
          <LogoAiPanel logo={{ builder: {} } as never} onPatch={vi.fn()} tier="unlocked" userEmail="t@e.com" />
        );
        fireEvent.change(screen.getByPlaceholderText(/Pizzeria moderna/i), { target: { value: 'Studio pedagogico' } });
        fireEvent.change(screen.getByPlaceholderText(/giovani 25-35/i), { target: { value: 'Genitori' } });
        fireEvent.click(screen.getByText(/Salva questo brief/i));
        // clear the fields, then apply the saved brief back
        fireEvent.change(screen.getByPlaceholderText(/Pizzeria moderna/i), { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: /Applica brief Brief A/i }));
        expect((screen.getByPlaceholderText(/Pizzeria moderna/i) as HTMLTextAreaElement).value).toBe('Studio pedagogico');
      } finally {
        promptSpy.mockRestore();
      }
    });

    it('deletes a saved brief from the library', () => {
      const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Brief da eliminare');
      try {
        render(
          <LogoAiPanel logo={{ builder: {} } as never} onPatch={vi.fn()} tier="unlocked" userEmail="t@e.com" />
        );
        fireEvent.change(screen.getByPlaceholderText(/Pizzeria moderna/i), { target: { value: 'Brief di prova' } });
        fireEvent.change(screen.getByPlaceholderText(/giovani 25-35/i), { target: { value: 'Target prova' } });
        fireEvent.click(screen.getByText(/Salva questo brief/i));
        expect(screen.getByText('Brief da eliminare')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Elimina brief Brief da eliminare/i }));
        expect(screen.queryByText('Brief da eliminare')).not.toBeInTheDocument();
      } finally {
        promptSpy.mockRestore();
      }
    });
  });

  describe('prompt avanzato per concept (Piano B)', () => {
    const baseConcept = {
      primaryText: 'A', tagline: '', iconType: 'none', iconGlyph: '', iconShape: 'circle',
      primaryColor: '#000000', secondaryColor: '#111111', fontFamily: 'Inter', layout: 'horizontal',
      icons: [], backgroundImage: null, backgroundColor: null, gradientFill: false, decorativeElements: [],
      imagePrompt: 'A cozy background', textBackdrop: 'none', textColorMode: 'auto',
      textOffsetX: 0, textOffsetY: 0, textScale: 1,
    };

    const seedConcepts = () => {
      localStorage.setItem('logoAiChat:v1', JSON.stringify({
        answers: { activity: 'X', mood: 'minimal', target: 'Y', sector: 'tech' },
        step: 'result',
        concepts: [baseConcept],
        selected: -1,
        bgImages: [null],
        ts: Date.now(),
      }));
    };

    it('shows a collapsible "Prompt avanzato" section with the imagePrompt prefilled', () => {
      seedConcepts();
      render(<LogoAiPanel logo={{ builder: {} } as never} onPatch={vi.fn()} tier="unlocked" userEmail="t@e.com" />);
      expect(screen.getByText(/Prompt avanzato/i)).toBeInTheDocument();
      const textarea = screen.getByLabelText(/Prompt immagine concept 1/i) as HTMLTextAreaElement;
      expect(textarea.value).toBe('A cozy background');
    });

    it('editing the prompt and clicking "Rigenera immagine" calls generateBackground with the edited value', async () => {
      seedConcepts();
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ enabled: true, provider: 'gemini' }),
      } as Response);
      generateBackgroundMock.mockResolvedValue({
        logo: { builder: { ...baseConcept, backgroundImage: 'data:image/png;base64,ZZZ' } },
        applied: true,
      });
      try {
        render(<LogoAiPanel logo={{ builder: {} } as never} onPatch={vi.fn()} tier="unlocked" userEmail="t@e.com" />);
        await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
        const textarea = screen.getByLabelText(/Prompt immagine concept 1/i);
        fireEvent.change(textarea, { target: { value: 'A brand new artistic prompt' } });
        fireEvent.click(screen.getByRole('button', { name: /Rigenera immagine/i }));
        await waitFor(() => expect(generateBackgroundMock).toHaveBeenCalled());
        const [, ctxArg] = generateBackgroundMock.mock.calls[0];
        expect(ctxArg.imagePrompt).toBe('A brand new artistic prompt');
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });

  describe('spinner durante generazione background (v2.4)', () => {
    /**
     * Bug originale: durante la generazione Gemini (multi-secondo),
     * il ConceptCard mostra il logo "nudo" (senza background), che
     * appare come un logo random/placeholder all'utente. Aggiungiamo
     * uno spinner overlay durante `isGeneratingBg && !bgImage && !bgError`.
     */
    const baseConcept = {
      primaryText: 'Acme', tagline: '', iconType: 'none', iconGlyph: '', iconShape: 'circle',
      primaryColor: '#000000', secondaryColor: '#111111', fontFamily: 'Inter', layout: 'horizontal',
      icons: [], backgroundImage: null, backgroundColor: null, gradientFill: false, decorativeElements: [],
      imagePrompt: null, textBackdrop: 'none', textColorMode: 'auto',
      textOffsetX: 0, textOffsetY: 0, textScale: 1,
    };

    const seedConceptLoading = () => {
      localStorage.setItem('logoAiChat:v1', JSON.stringify({
        answers: { activity: 'X', mood: 'minimal', target: 'Y', sector: 'tech' },
        step: 'result',
        concepts: [baseConcept],
        selected: -1,
        bgImages: [null],
        ts: Date.now(),
      }));
    };

    it('shows spinner overlay when isGeneratingBg is true and bg is not ready', () => {
      seedConceptLoading();
      hookState.isGeneratingBg = true;
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ enabled: false, provider: 'none' }),
      } as Response);
      try {
        render(
          <LogoAiPanel logo={{ builder: baseConcept } as never} onPatch={vi.fn()} tier="unlocked" userEmail="t@e.com" />
        );
        expect(screen.getByText(/Generazione sfondo/i)).toBeInTheDocument();
      } finally {
        hookState.isGeneratingBg = false;
        fetchSpy.mockRestore();
      }
    });

    it('does not show spinner when bg is ready', () => {
      localStorage.setItem('logoAiChat:v1', JSON.stringify({
        answers: { activity: 'X', mood: 'minimal', target: 'Y', sector: 'tech' },
        step: 'result',
        concepts: [baseConcept],
        selected: -1,
        bgImages: ['data:image/png;base64,READY'],
        ts: Date.now(),
      }));
      hookState.isGeneratingBg = true; // anche se true, bg è pronto
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ enabled: false, provider: 'none' }),
      } as Response);
      try {
        render(
          <LogoAiPanel logo={{ builder: baseConcept } as never} onPatch={vi.fn()} tier="unlocked" userEmail="t@e.com" />
        );
        expect(screen.queryByText(/Generazione sfondo/i)).not.toBeInTheDocument();
      } finally {
        hookState.isGeneratingBg = false;
        fetchSpy.mockRestore();
      }
    });
  });
});