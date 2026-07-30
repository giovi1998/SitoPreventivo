import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { useCardAiImages, type UseCardAiImagesParams } from '../useCardAiImages';
import { createEmptyCard } from '../../utils/documentSchemas';
import type { BusinessCard } from '../../utils/documentSchemas';

interface SetupOverrides {
  card?: BusinessCard;
  tier?: 'free' | 'unlocked';
  photoPrompt?: string;
  iconPrompt?: string;
  autoIconPrompt?: string;
  generateCover?: UseCardAiImagesParams['generateCover'];
}

function setup(overrides: SetupOverrides = {}) {
  const addToast = vi.fn();
  const patchFront = vi.fn();
  const patchBack = vi.fn();
  const generateCover =
    overrides.generateCover ??
    vi.fn(async (_c: BusinessCard, side: 'front' | 'back' = 'front') => ({
      dataUrl: `data:image/png;base64,${side.toUpperCase()}`,
      aiCall: { kind: 'cover' as const, costUsd: 0.04 },
    }));
  const generatePhoto = vi.fn(async () => ({
    dataUrl: 'data:image/png;base64,PHOTO',
    aiCall: { kind: 'photo' as const, costUsd: 0.03 },
  }));
  const generateIconHero = vi.fn(async () => ({
    dataUrl: 'data:image/png;base64,ICON',
    aiCall: { kind: 'icon' as const, costUsd: 0.02 },
  }));

  const hook = renderHook(() => {
    const [card, setCard] = useState<BusinessCard>(() => overrides.card ?? createEmptyCard());
    const ai = useCardAiImages({
      card,
      tier: overrides.tier ?? 'unlocked',
      setCard,
      patchFront,
      patchBack,
      addToast,
      generateCover,
      generatePhoto,
      generateIconHero,
      photoPrompt: overrides.photoPrompt ?? '',
      iconPrompt: overrides.iconPrompt ?? '',
      autoIconPrompt: overrides.autoIconPrompt ?? 'minimal geometric icon representing professional business',
    });
    return { card, ...ai };
  });

  return { ...hook, addToast, patchFront, patchBack, generateCover, generatePhoto, generateIconHero };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useCardAiImages — tier gating', () => {
  it('blocks cover generation on free tier', async () => {
    const { result, addToast, generateCover } = setup({ tier: 'free' });
    await act(async () => { await result.current.handleGenerateCover('front'); });

    expect(generateCover).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith('info', 'Sblocca il piano per generare cover AI.', 4000);
    expect(result.current.isCoverGenerating).toBe(false);
  });

  it('blocks photo generation on free tier', async () => {
    const { result, addToast, generatePhoto } = setup({ tier: 'free' });
    await act(async () => { await result.current.handleGeneratePhoto(); });

    expect(generatePhoto).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith('info', 'Sblocca il piano per generare la foto AI.', 4000);
    expect(result.current.isPhotoGenerating).toBe(false);
  });

  it('blocks icon generation on free tier', async () => {
    const { result, addToast, generateIconHero } = setup({ tier: 'free' });
    await act(async () => {
      await result.current.handleGenerateIcon({ imageModel: 'm', background: 'transparent' });
    });

    expect(generateIconHero).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith('info', 'Sblocca il piano per generare icone AI.', 4000);
  });
});

describe('useCardAiImages — cover generation', () => {
  it('generates a front cover and records the AI call', async () => {
    const { result, addToast, generateCover } = setup();
    await act(async () => { await result.current.handleGenerateCover('front'); });

    expect(generateCover).toHaveBeenCalledWith(expect.anything(), 'front', undefined, { imageModel: undefined });
    expect(result.current.card.front.coverImageUrl).toBe('data:image/png;base64,FRONT');
    expect(result.current.card.back.coverImageUrl).toBeNull();
    expect(result.current.card.aiStats?.calls.cover).toEqual({ count: 1, costUsd: 0.04 });
    expect(addToast).toHaveBeenCalledWith('success', 'Cover AI generata e applicata al fronte.', 4000);
    expect(result.current.isCoverGenerating).toBe(false);
  });

  it('generates a back cover', async () => {
    const { result, addToast } = setup();
    await act(async () => { await result.current.handleGenerateCover('back'); });

    expect(result.current.card.back.coverImageUrl).toBe('data:image/png;base64,BACK');
    expect(result.current.card.front.coverImageUrl).toBeNull();
    expect(addToast).toHaveBeenCalledWith('success', 'Cover AI generata e applicata al retro.', 4000);
  });

  it('serializes front→back for side=both and records two AI calls', async () => {
    let frontResolved = false;
    const generateCover = vi.fn(async (_c: BusinessCard, side: 'front' | 'back' = 'front') => {
      if (side === 'front') {
        await Promise.resolve();
        frontResolved = true;
        return { dataUrl: 'data:image/png;base64,FRONT', aiCall: { kind: 'cover' as const, costUsd: 0.04 } };
      }
      expect(frontResolved).toBe(true);
      return { dataUrl: 'data:image/png;base64,BACK', aiCall: { kind: 'cover' as const, costUsd: 0.04 } };
    });
    const { result, addToast } = setup({ generateCover });

    await act(async () => { await result.current.handleGenerateCover('both'); });

    expect(generateCover).toHaveBeenCalledTimes(2);
    expect(generateCover).toHaveBeenNthCalledWith(1, expect.anything(), 'front', undefined, expect.any(Object));
    expect(generateCover).toHaveBeenNthCalledWith(2, expect.anything(), 'back', undefined, expect.any(Object));
    expect(result.current.card.front.coverImageUrl).toBe('data:image/png;base64,FRONT');
    expect(result.current.card.back.coverImageUrl).toBe('data:image/png;base64,BACK');
    expect(result.current.card.aiStats?.calls.cover).toEqual({ count: 2, costUsd: 0.08 });
    expect(addToast).toHaveBeenCalledWith('success', 'Cover AI generate per fronte e retro.', 4000);
  });

  it('surfaces an error toast and resets the generating flag on failure', async () => {
    const generateCover = vi.fn(async () => { throw new Error('proxy 502'); });
    const { result, addToast } = setup({ generateCover });

    await act(async () => { await result.current.handleGenerateCover('front'); });

    expect(addToast).toHaveBeenCalledWith('error', 'proxy 502', 5000);
    expect(result.current.isCoverGenerating).toBe(false);
    expect(result.current.card.front.coverImageUrl).toBeNull();
  });
});

describe('useCardAiImages — photo generation', () => {
  it('applies the generated photo to the front', async () => {
    const { result, addToast, generatePhoto } = setup();
    await act(async () => { await result.current.handleGeneratePhoto(); });

    expect(generatePhoto).toHaveBeenCalledWith(expect.anything(), {
      promptOverride: undefined,
      imageModel: undefined,
    });
    expect(result.current.card.front.photoUrl).toBe('data:image/png;base64,PHOTO');
    expect(result.current.card.aiStats?.calls.photo).toEqual({ count: 1, costUsd: 0.03 });
    expect(addToast).toHaveBeenCalledWith('success', 'Foto AI generata e applicata al bigliettino.', 4000);
    expect(result.current.isPhotoGenerating).toBe(false);
  });

  it('passes a non-empty photoPrompt as promptOverride', async () => {
    const { result, generatePhoto } = setup({ photoPrompt: '  ritratto studio  ' });
    await act(async () => { await result.current.handleGeneratePhoto(); });

    expect(generatePhoto).toHaveBeenCalledWith(expect.anything(), {
      promptOverride: 'ritratto studio',
      imageModel: undefined,
    });
  });
});

describe('useCardAiImages — CON-IS-001 icon generation', () => {
  const cardWithMedia = () => ({
    ...createEmptyCard(),
    front: {
      ...createEmptyCard().front,
      photoUrl: 'data:image/png;base64,USERPHOTO',
      logoUrl: 'data:image/png;base64,OLDLOGO',
    },
  });

  it('always lands in photoUrl and never touches logoUrl', async () => {
    const { result, addToast, generateIconHero } = setup({ card: cardWithMedia() });
    await act(async () => {
      await result.current.handleGenerateIcon({ imageModel: 'gemini', background: 'card' });
    });

    expect(generateIconHero).toHaveBeenCalledWith(
      'minimal geometric icon representing professional business',
      'icon',
      expect.objectContaining({ imageModel: 'gemini', background: 'card' }),
    );
    expect(result.current.card.front.photoUrl).toBe('data:image/png;base64,ICON');
    expect(result.current.card.front.logoUrl).toBe('data:image/png;base64,OLDLOGO');
    expect(result.current.card.aiStats?.calls.icon).toEqual({ count: 1, costUsd: 0.02 });
    expect(addToast).toHaveBeenCalledWith('success', 'Icona AI generata e applicata come foto.', 4000);
  });

  it('prefers the user iconPrompt over the auto prompt', async () => {
    const { result, generateIconHero } = setup({ iconPrompt: '  ingranaggio minimale  ' });
    await act(async () => {
      await result.current.handleGenerateIcon({ imageModel: 'gemini', background: 'transparent' });
    });

    expect(generateIconHero).toHaveBeenCalledWith(
      'ingranaggio minimale',
      'icon',
      expect.any(Object),
    );
  });
});

describe('useCardAiImages — remove cover', () => {
  it('removes the front cover via patchFront', () => {
    const { result, addToast, patchFront, patchBack } = setup();
    act(() => result.current.handleRemoveCover('front'));

    expect(patchFront).toHaveBeenCalledWith({ coverImageUrl: null });
    expect(patchBack).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith('info', 'Cover AI del fronte rimossa.', 2500);
  });

  it('removes the back cover via patchBack', () => {
    const { result, addToast, patchFront, patchBack } = setup();
    act(() => result.current.handleRemoveCover('back'));

    expect(patchBack).toHaveBeenCalledWith({ coverImageUrl: null });
    expect(patchFront).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith('info', 'Cover AI del retro rimossa.', 2500);
  });
});
