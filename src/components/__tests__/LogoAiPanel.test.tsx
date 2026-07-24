import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LogoAiPanel from '../LogoAiPanel';
import type { LogoBuilder } from '../../utils/documentSchemas';

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
    expect(screen.getByText('AI Assist')).toBeDefined();
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
        fireEvent.click(screen.getByText(/Salva prompt/i));
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
        fireEvent.click(screen.getByText(/Salva prompt/i));
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
        fireEvent.click(screen.getByText(/Salva prompt/i));
        // clear the fields, then apply the saved brief back
        fireEvent.change(screen.getByPlaceholderText(/Pizzeria moderna/i), { target: { value: '' } });
        fireEvent.click(screen.getByText('Brief A'));
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
        fireEvent.click(screen.getByText(/Salva prompt/i));
        expect(screen.getByText('Brief da eliminare')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Elimina prompt Brief da eliminare/i }));
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

  describe('preservazione background pagato (regressione v2.4)', () => {
    const baseConcept = {
      primaryText: 'Acme', tagline: 'Tag', iconType: 'none', iconGlyph: '', iconShape: 'circle',
      primaryColor: '#000000', secondaryColor: '#111111', fontFamily: 'Inter', layout: 'horizontal',
      icons: [], backgroundImage: null, backgroundColor: null, gradientFill: false, decorativeElements: [],
      imagePrompt: null, textBackdrop: 'none', textColorMode: 'auto',
      textOffsetX: 0, textOffsetY: 0, textScale: 1,
    };

    const seedWithPaidBg = () => {
      localStorage.setItem('logoAiChat:v1', JSON.stringify({
        answers: { activity: 'X', mood: 'minimal', target: 'Y', sector: 'tech' },
        step: 'result',
        concepts: [baseConcept],
        selected: -1,
        bgImages: [null], // background AI non ancora pronto
        ts: Date.now(),
      }));
    };

    it('applicare un concept senza background pronto NON cancella il backgroundImage pagato già applicato', () => {
      seedWithPaidBg();
      const onPatch = vi.fn();
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ enabled: true, provider: 'gemini' }),
      } as Response);
      try {
        render(
          <LogoAiPanel
            logo={{ builder: { ...baseConcept, backgroundImage: 'data:image/png;base64,PAID' } } as never}
            onPatch={onPatch}
            tier="unlocked"
            userEmail="t@e.com"
          />,
        );
        const selectBtn = screen.getByRole('button', { pressed: false });
        fireEvent.click(selectBtn);
        // LogoAiPanel.onPatch riceve un oggetto patch (Partial<LogoBuilder>).
        // La chiave backgroundImage DEVE essere assente, NON null, così non
        // sovrascrive il background pagato già presente nel builder.
        expect(onPatch).toHaveBeenCalled();
        const patchArg = onPatch.mock.calls[0][0] as Partial<LogoBuilder>;
        expect(patchArg.backgroundImage).toBeUndefined();
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('applicare un concept CON background pronto usa il nuovo background', () => {
      localStorage.setItem('logoAiChat:v1', JSON.stringify({
        answers: { activity: 'X', mood: 'minimal', target: 'Y', sector: 'tech' },
        step: 'result',
        concepts: [baseConcept],
        selected: -1,
        bgImages: ['data:image/png;base64,NEW'],
        ts: Date.now(),
      }));
      const onPatch = vi.fn();
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ enabled: true, provider: 'gemini' }),
      } as Response);
      try {
        render(
          <LogoAiPanel
            logo={{ builder: { ...baseConcept, backgroundImage: 'data:image/png;base64,OLD' } } as never}
            onPatch={onPatch}
            tier="unlocked"
            userEmail="t@e.com"
          />,
        );
        fireEvent.click(screen.getByRole('button', { pressed: false }));
        const patchArg = onPatch.mock.calls[0][0] as LogoBuilder;
        expect(patchArg.backgroundImage).toBe('data:image/png;base64,NEW');
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

    /**
     * Regressione v2.4.2: durante la rigenerazione di UN SOLO concept
     * (via "Prompt avanzato" > "Rigenera immagine"), lo spinner deve
     * apparire SOLO sulla card in rigenerazione, non sulle altre 2 che
     * già hanno un background pronto o sono in idle. Prima del fix,
     * `bgLoading` dipendeva solo da `isGeneratingBg` (bool globale
     * dell'hook), quindi TUTTE le card senza bg mostravano lo spinner
     * anche se solo una era effettivamente in rigenerazione.
     */
    it('shows spinner ONLY on the concept being regenerated, not on the others (regression v2.4.2)', async () => {
      const conceptA = { ...baseConcept, primaryText: 'Acme', imagePrompt: 'prompt A' };
      const conceptB = { ...baseConcept, primaryText: 'Zenith', imagePrompt: 'prompt B' };
      localStorage.setItem('logoAiChat:v1', JSON.stringify({
        answers: { activity: 'X', mood: 'minimal', target: 'Y', sector: 'tech' },
        step: 'result',
        concepts: [conceptA, conceptB],
        selected: -1,
        // concept B ha già un bg pronto; concept A no (per rigenerarlo)
        bgImages: [null, 'data:image/png;base64,READY_B'],
        ts: Date.now(),
      }));
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ enabled: true, provider: 'gemini' }),
      } as Response);
      // La promise non si risolve mai: regeneratingIdx resta settato
      // per tutta la durata dell'assert (simula generazione in corso).
      generateBackgroundMock.mockReturnValue(new Promise(() => {}));
      try {
        render(
          <LogoAiPanel logo={{ builder: {} } as never} onPatch={vi.fn()} tier="unlocked" userEmail="t@e.com" />
        );
        await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
        const regenButtons = screen.getAllByRole('button', { name: /Rigenera immagine/i });
        fireEvent.click(regenButtons[0]); // rigenera SOLO il concept A (index 0)
        await waitFor(() => expect(generateBackgroundMock).toHaveBeenCalledTimes(1));
        // Solo UNA card mostra lo spinner overlay (quella in rigenerazione)
        expect(screen.getAllByText(/Generazione sfondo/i)).toHaveLength(1);
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });

  /**
   * Regressione: lo sfondo AI generato per i concept in preview (prima
   * della selezione) si perdeva cambiando tab AI -> Builder -> AI,
   * perché l'effect di persistenza su localStorage non includeva
   * `bgImages` nel dependency array. Il primo persist (scattato su
   * `concepts`) catturava bgImages ancora a [null, null, null]; gli
   * aggiornamenti successivi (dopo la generazione Gemini) non
   * triggeravano un nuovo salvataggio. Al remount (cambio tab) il
   * componente ricaricava lo snapshot vecchio senza immagini.
   */
  describe('persistenza bgImages su cambio tab (regressione: immagine persa)', () => {
    const genConcept = {
      primaryText: 'Acme', tagline: '', iconType: 'none', iconGlyph: '', iconShape: 'circle',
      primaryColor: '#000000', secondaryColor: '#111111', fontFamily: 'Inter', layout: 'horizontal',
      icons: [], backgroundImage: null, backgroundColor: null, gradientFill: false, decorativeElements: [],
      imagePrompt: 'a background', textBackdrop: 'none', textColorMode: 'auto',
      textOffsetX: 0, textOffsetY: 0, textScale: 1,
    };

    it('persists bgImages to localStorage after Gemini generation completes', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ enabled: true, provider: 'gemini' }),
      } as Response);
      generateMock.mockResolvedValue({ applied: true, concepts: [genConcept] });
      generateBackgroundMock.mockResolvedValue({
        applied: true,
        logo: { builder: { ...genConcept, backgroundImage: 'data:image/png;base64,GENERATED' } },
      });
      try {
        render(
          <LogoAiPanel logo={{ builder: {} } as never} onPatch={vi.fn()} tier="unlocked" userEmail="t@e.com" />
        );
        await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
        fireEvent.change(screen.getByPlaceholderText(/Pizzeria moderna/i), { target: { value: 'Attività di prova lunga abbastanza' } });
        fireEvent.change(screen.getByPlaceholderText(/giovani 25-35/i), { target: { value: 'Target di prova' } });
        fireEvent.click(screen.getByText('Genera 3 concept'));
        await waitFor(() => expect(generateBackgroundMock).toHaveBeenCalled());
        // Attende il debounce (500ms) dell'effect di persistenza.
        await waitFor(() => {
          const raw = localStorage.getItem('logoAiChat:v1');
          expect(raw).not.toBeNull();
          const parsed = JSON.parse(raw!);
          expect(parsed.bgImages).toContain('data:image/png;base64,GENERATED');
        }, { timeout: 2000 });
      } finally {
        fetchSpy.mockRestore();
      }
    });

    /**
     * Regressione più precisa: il debounce di persistenza (500ms) usava
     * solo `clearTimeout` nella cleanup. Se l'utente cambiava tab (quindi
     * smontava LogoAiPanel) ENTRO i 500ms dall'arrivo dell'immagine AI,
     * il timer veniva cancellato SENZA MAI scrivere in localStorage,
     * perdendo l'immagine anche se il fix del dependency array (bgImages
     * nell'effect deps) era già applicato. Fix: flush immediato dello
     * stato più recente (via ref) alla vera unmount, indipendentemente
     * dal timer di debounce.
     */
    it('does NOT lose bgImages when unmounted immediately after generation (before the 500ms debounce fires)', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ enabled: true, provider: 'gemini' }),
      } as Response);
      generateMock.mockResolvedValue({ applied: true, concepts: [genConcept] });
      generateBackgroundMock.mockResolvedValue({
        applied: true,
        logo: { builder: { ...genConcept, backgroundImage: 'data:image/png;base64,FAST_UNMOUNT' } },
      });
      try {
        const { unmount } = render(
          <LogoAiPanel logo={{ builder: {} } as never} onPatch={vi.fn()} tier="unlocked" userEmail="t@e.com" />
        );
        await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
        fireEvent.change(screen.getByPlaceholderText(/Pizzeria moderna/i), { target: { value: 'Attività di prova lunga abbastanza' } });
        fireEvent.change(screen.getByPlaceholderText(/giovani 25-35/i), { target: { value: 'Target di prova' } });
        fireEvent.click(screen.getByText('Genera 3 concept'));
        // Aspetta che la UI rifletta l'immagine generata (bgImages
        // aggiornato + re-render), ma NON i 500ms del debounce:
        // simula l'utente che cambia tab non appena vede il risultato.
        await waitFor(() => expect(screen.getByText(/AI bg ✓/i)).toBeInTheDocument());
        unmount(); // <- deve flushare subito, senza aspettare il timer
        const raw = localStorage.getItem('logoAiChat:v1');
        expect(raw).not.toBeNull();
        const parsed = JSON.parse(raw!);
        expect(parsed.bgImages).toContain('data:image/png;base64,FAST_UNMOUNT');
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('restores the generated bgImage on remount (simulates AI -> Builder -> AI tab switch)', async () => {
      localStorage.setItem('logoAiChat:v1', JSON.stringify({
        answers: { activity: 'X', mood: 'minimal', target: 'Y', sector: 'tech' },
        step: 'result',
        concepts: [genConcept],
        selected: -1,
        bgImages: ['data:image/png;base64,SURVIVED'],
        ts: Date.now(),
      }));
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ enabled: true, provider: 'gemini' }),
      } as Response);
      try {
        const { unmount } = render(
          <LogoAiPanel logo={{ builder: {} } as never} onPatch={vi.fn()} tier="unlocked" userEmail="t@e.com" />
        );
        // simula lo switch di tab: LogoEditor smonta LogoAiPanel quando
        // l'utente va sul tab Builder, poi lo rimonta tornando su AI.
        unmount();
        render(
          <LogoAiPanel logo={{ builder: {} } as never} onPatch={vi.fn()} tier="unlocked" userEmail="t@e.com" />
        );
        const svgHtml = document.querySelector('.logo-ai-concept-preview-inner')?.innerHTML ?? '';
        expect(svgHtml).toContain('SURVIVED');
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });
});