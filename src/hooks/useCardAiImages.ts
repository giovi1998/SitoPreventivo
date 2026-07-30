import { useCallback, useState } from 'react';
import type { BusinessCard } from '../utils/documentSchemas';
import { withAiCall, type AiCallKind } from '../utils/aiStats';
import type { IconBackground } from './useAIIconHero';

type AddToast = (type: string, message: string, durationMs?: number) => string;

type AiImageResult = { dataUrl: string; aiCall: { kind: AiCallKind; costUsd: number } };

export interface UseCardAiImagesParams {
  card: BusinessCard;
  tier: 'free' | 'unlocked';
  setCard: React.Dispatch<React.SetStateAction<BusinessCard>>;
  patchFront: (patch: Partial<BusinessCard['front']>) => void;
  patchBack: (patch: Partial<BusinessCard['back']>) => void;
  addToast: AddToast;
  generateCover: (
    card: BusinessCard,
    side?: 'front' | 'back',
    prompt?: string,
    options?: { onProgress?: (msg: string) => void; imageModel?: string },
  ) => Promise<AiImageResult>;
  generatePhoto: (
    card: BusinessCard,
    options?: { promptOverride?: string; onProgress?: (msg: string) => void; imageModel?: string },
  ) => Promise<AiImageResult>;
  generateIconHero: (
    prompt: string,
    kind: 'icon' | 'hero',
    options?: {
      primaryColor?: string;
      secondaryColor?: string;
      style?: string;
      imageModel?: string;
      background?: IconBackground;
    },
  ) => Promise<AiImageResult>;
  photoPrompt: string;
  iconPrompt: string;
  autoIconPrompt: string;
}

export function useCardAiImages({
  card,
  tier,
  setCard,
  patchFront,
  patchBack,
  addToast,
  generateCover,
  generatePhoto,
  generateIconHero,
  photoPrompt,
  iconPrompt,
  autoIconPrompt,
}: UseCardAiImagesParams) {
  const [isCoverGenerating, setIsCoverGenerating] = useState(false);
  const [isPhotoGenerating, setIsPhotoGenerating] = useState(false);

  const recordAiOnCard = useCallback((kind: AiCallKind, costUsd: number, transform?: (c: BusinessCard) => BusinessCard) => {
    setCard((prev) => {
      const next = transform ? transform(prev) : prev;
      return withAiCall(next, kind, costUsd);
    });
  }, [setCard]);

  const handleGenerateCover = useCallback(async (side: 'front' | 'back' | 'both' = 'front', imageModel?: string, promptOverride?: string) => {
    if (tier !== 'unlocked') {
      addToast('info', 'Sblocca il piano per generare cover AI.', 4000);
      return;
    }
    setIsCoverGenerating(true);
    try {
      if (side === 'both') {
        // Serializziamo fronte e retro: due chiamate Gemini in parallelo
        // possono sovraccaricare il dev proxy / l'upstream e ritornare 502.
        const frontRes = await generateCover(card, 'front', promptOverride, { imageModel });
        const backRes = await generateCover(card, 'back', promptOverride, { imageModel });
        recordAiOnCard('cover', frontRes.aiCall.costUsd, (c) => ({ ...c, front: { ...c.front, coverImageUrl: frontRes.dataUrl } }));
        recordAiOnCard('cover', backRes.aiCall.costUsd, (c) => ({ ...c, back: { ...c.back, coverImageUrl: backRes.dataUrl } }));
        addToast('success', 'Cover AI generate per fronte e retro.', 4000);
      } else {
        const res = await generateCover(card, side, promptOverride, { imageModel });
        recordAiOnCard('cover', res.aiCall.costUsd, (c) =>
          side === 'front'
            ? { ...c, front: { ...c.front, coverImageUrl: res.dataUrl } }
            : { ...c, back: { ...c.back, coverImageUrl: res.dataUrl } },
        );
        addToast('success', `Cover AI generata e applicata al ${side === 'front' ? 'fronte' : 'retro'}.`, 4000);
      }
    } catch (err: any) {
      addToast('error', err.message || 'Errore generazione cover AI', 5000);
    } finally {
      setIsCoverGenerating(false);
    }
  }, [card, tier, generateCover, recordAiOnCard, addToast]);

  const handleGeneratePhoto = useCallback(async (imageModel?: string) => {
    if (tier !== 'unlocked') {
      addToast('info', 'Sblocca il piano per generare la foto AI.', 4000);
      return;
    }
    setIsPhotoGenerating(true);
    try {
      const res = await generatePhoto(card, {
        promptOverride: photoPrompt.trim() || undefined,
        imageModel,
      });
      recordAiOnCard('photo', res.aiCall.costUsd, (c) => ({ ...c, front: { ...c.front, photoUrl: res.dataUrl } }));
      addToast('success', 'Foto AI generata e applicata al bigliettino.', 4000);
    } catch (err: any) {
      addToast('error', err.message || 'Errore generazione foto AI', 5000);
    } finally {
      setIsPhotoGenerating(false);
    }
  }, [card, tier, generatePhoto, recordAiOnCard, addToast, photoPrompt]);

  const handleGenerateIcon = useCallback(async (opts: { imageModel: string; background: IconBackground }) => {
    if (tier !== 'unlocked') {
      addToast('info', 'Sblocca il piano per generare icone AI.', 4000);
      return;
    }
    try {
      const res = await generateIconHero(iconPrompt.trim() || autoIconPrompt, 'icon', {
        primaryColor: card.style.accentColor,
        secondaryColor: card.style.textColor,
        imageModel: opts.imageModel,
        background: opts.background,
      });
      // CON-IS-001: sostituisce sempre la foto (photoUrl) esistente.
      recordAiOnCard('icon', res.aiCall.costUsd, (c) => ({ ...c, front: { ...c.front, photoUrl: res.dataUrl } }));
      addToast('success', 'Icona AI generata e applicata come foto.', 4000);
    } catch (err: any) {
      addToast('error', err.message || 'Errore generazione icona AI', 5000);
    }
  }, [card, tier, generateIconHero, iconPrompt, autoIconPrompt, recordAiOnCard, addToast]);

  const handleRemoveCover = useCallback(
    (side: 'front' | 'back') => {
      if (side === 'front') {
        patchFront({ coverImageUrl: null });
        addToast('info', 'Cover AI del fronte rimossa.', 2500);
      } else {
        patchBack({ coverImageUrl: null });
        addToast('info', 'Cover AI del retro rimossa.', 2500);
      }
    },
    [patchFront, patchBack, addToast],
  );

  return {
    isCoverGenerating,
    isPhotoGenerating,
    handleGenerateCover,
    handleGeneratePhoto,
    handleGenerateIcon,
    handleRemoveCover,
  };
}
