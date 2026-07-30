import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCardPromptLibrary } from '../useCardPromptLibrary';
import { createEmptyCard } from '../../utils/documentSchemas';
import {
  loadPromptLibrary,
  addPromptEntry,
  PROMPT_LIBRARY_KEYS,
} from '../../utils/promptLibrary';
import { buildCardPhotoBrief } from '../../utils/card/photoBrief';
import { buildCardCoverPromptBrief } from '../../utils/card/coverPrompt';

const addToast = vi.fn();
const emptyCard = createEmptyCard();

function setup(card = emptyCard) {
  return renderHook(() => useCardPromptLibrary(card, addToast));
}

beforeEach(() => {
  localStorage.clear();
  addToast.mockClear();
  vi.spyOn(window, 'prompt').mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCardPromptLibrary — save', () => {
  it('saves the photo prompt to localStorage and updates library state', () => {
    const { result } = setup();
    act(() => result.current.setPhotoPrompt('  foto studio  '));
    act(() => result.current.handleSavePhotoPrompt());

    expect(addToast).toHaveBeenCalledWith('success', 'Prompt salvato nella libreria.');
    const stored = loadPromptLibrary(PROMPT_LIBRARY_KEYS.cardPhoto);
    expect(stored).toHaveLength(1);
    expect(stored[0].prompt).toBe('foto studio');
    expect(stored[0].module).toBe('card-photo');
    // window.prompt annullato → label = primi 40 char del testo
    expect(stored[0].label).toBe('foto studio');
    expect(result.current.photoLibrary).toHaveLength(1);
  });

  it('uses the window.prompt label when provided', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('La mia etichetta');
    const { result } = setup();
    act(() => result.current.setIconPrompt('icona minimale'));
    act(() => result.current.handleSaveIconPrompt());

    const stored = loadPromptLibrary(PROMPT_LIBRARY_KEYS.cardIcon);
    expect(stored[0].label).toBe('La mia etichetta');
    expect(stored[0].module).toBe('card-icon');
  });

  it('saves the cover prompt under the cover key with default label fallback', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('   ');
    const { result } = setup();
    act(() => result.current.setCoverPrompt('sfondo gradiente'));
    act(() => result.current.handleSaveCoverPrompt());

    const stored = loadPromptLibrary(PROMPT_LIBRARY_KEYS.cardCover);
    expect(stored).toHaveLength(1);
    expect(stored[0].label).toBe('Prompt sfondo');
    expect(stored[0].module).toBe('card-cover');
  });

  it('refuses to save an empty prompt (info toast, nothing persisted)', () => {
    const { result } = setup();
    act(() => result.current.handleSavePhotoPrompt());

    expect(addToast).toHaveBeenCalledWith('info', 'Scrivi un prompt prima di salvarlo.');
    expect(loadPromptLibrary(PROMPT_LIBRARY_KEYS.cardPhoto)).toEqual([]);
    expect(result.current.photoLibrary).toEqual([]);
  });
});

describe('useCardPromptLibrary — apply', () => {
  it('applies an entry: sets prompt, opens editor, toasts', () => {
    const { result } = setup();
    act(() => result.current.handleApplyPhotoPrompt({
      id: 'p1', label: 'Studio', createdAt: 1, prompt: 'soft light',
    }));

    expect(result.current.photoPrompt).toBe('soft light');
    expect(result.current.showPhotoPromptEditor).toBe(true);
    expect(addToast).toHaveBeenCalledWith('info', 'Prompt «Studio» applicato.');
  });

  it('ignores entries without a prompt body', () => {
    const { result } = setup();
    act(() => result.current.handleApplyIconPrompt({
      id: 'p2', label: 'Vuoto', createdAt: 1,
    }));

    expect(result.current.iconPrompt).toBe('');
    expect(result.current.showIconPromptEditor).toBe(false);
  });
});

describe('useCardPromptLibrary — delete', () => {
  it('removes an entry by id from state and localStorage', () => {
    const [entry] = addPromptEntry(PROMPT_LIBRARY_KEYS.cardCover, {
      label: 'Sfondo', prompt: 'blu notte', module: 'card-cover',
    });
    const { result } = setup();
    expect(result.current.coverLibrary).toHaveLength(1);

    act(() => result.current.handleDeleteCoverPrompt(entry.id));
    expect(result.current.coverLibrary).toEqual([]);
    expect(loadPromptLibrary(PROMPT_LIBRARY_KEYS.cardCover)).toEqual([]);
  });
});

describe('useCardPromptLibrary — localStorage roundtrip', () => {
  it('reloads a saved library on remount', () => {
    const first = setup();
    act(() => first.result.current.setPhotoPrompt('ritratto editoriale'));
    act(() => first.result.current.handleSavePhotoPrompt());
    first.unmount();

    const second = setup();
    expect(second.result.current.photoLibrary).toHaveLength(1);
    expect(second.result.current.photoLibrary[0].prompt).toBe('ritratto editoriale');
  });
});

describe('useCardPromptLibrary — auto icon prompt', () => {
  it('falls back to a generic subject on an empty card', () => {
    const { result } = setup();
    expect(result.current.autoIconPrompt).toBe(
      'minimal geometric icon representing professional business',
    );
  });

  it('uses the front title when present', () => {
    const card = {
      ...createEmptyCard(),
      front: { ...createEmptyCard().front, title: 'Avvocato' },
    };
    const { result } = setup(card);
    expect(result.current.autoIconPrompt).toBe(
      'minimal geometric icon representing Avvocato',
    );
  });
});

describe('useCardPromptLibrary — fill auto', () => {
  it('fills the icon prompt with the auto prompt and opens the editor', () => {
    const { result } = setup();
    act(() => result.current.handleFillAutoIconPrompt());

    expect(result.current.iconPrompt).toBe(result.current.autoIconPrompt);
    expect(result.current.showIconPromptEditor).toBe(true);
  });

  it('fills the photo prompt from the photo brief and opens the editor', () => {
    const { result } = setup();
    act(() => result.current.handleFillAutoPhotoPrompt());

    expect(result.current.photoPrompt).toBe(buildCardPhotoBrief(emptyCard).prompt);
    expect(result.current.showPhotoPromptEditor).toBe(true);
  });

  it('fills the cover prompt from the cover brief (front) and opens the editor', () => {
    const { result } = setup();
    act(() => result.current.handleFillAutoCoverPrompt());

    expect(result.current.coverPrompt).toBe(buildCardCoverPromptBrief(emptyCard, 'front').prompt);
    expect(result.current.showCoverPromptEditor).toBe(true);
  });
});
