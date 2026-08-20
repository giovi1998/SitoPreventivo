import { useCallback, useState } from 'react';
import { useAILogs } from './useAILogs';
import { newRequestId } from '../utils/ai/requestId';
import { mapAiError } from '../utils/ai/mapAiError';
import { logger } from '../utils/logger';
import { getAiImageModelDefault } from '../utils/uiPrefs';
import { saveGeneratedImage } from '../utils/saveGeneratedImage';
import { postAiImage } from '../utils/ai/imageCall';

export type IconHeroKind = 'icon' | 'hero';

export type IconBackground = 'transparent' | 'white' | 'card' | 'accent';

export interface IconHeroOptions {
  primaryColor?: string;
  secondaryColor?: string;
  style?: string;
  /** TB-023: modello immagine (gemini-2.0 flash / nano banana) */
  imageModel?: string;
  /** TB-023: sfondo dell'icona. 'card' usa primaryColor come tinta di sfondo. */
  background?: IconBackground;
}

export interface UseAIIconHeroReturn {
  generate: (
    prompt: string,
    kind: IconHeroKind,
    options?: IconHeroOptions
  ) => Promise<{ dataUrl: string; aiCall: { kind: 'icon' | 'hero'; costUsd: number } }>;
  isProcessing: boolean;
  logs: ReturnType<typeof useAILogs>['logs'];
  clear: () => void;
}

export function useAIIconHero(userEmail?: string, sessionId?: string): UseAIIconHeroReturn {
  const { logs, info, success, error, clear } = useAILogs('useAIIconHero');
  const [isProcessing, setIsProcessing] = useState(false);

  const generate = useCallback(
    async (prompt: string, kind: IconHeroKind, options?: IconHeroOptions) => {
      const requestId = newRequestId();
      setIsProcessing(true);
      info(kind === 'icon' ? '🎨 Generazione icona AI...' : '🖼️ Generazione hero AI...', prompt.slice(0, 300), { requestId });

      try {
        const { removeWhiteBackground } = await import('../utils/ai/removeBackground');
        const { dataUrl, costUsd, mimeType, sizeKB } = await postAiImage({
          endpoint: '/api/ai/image-flash',
          payload: {
            prompt: prompt.slice(0, 1000),
            kind,
            aspectRatio: kind === 'hero' ? '16:9' : '1:1',
            // '1K': con output JPEG q85 (spec ai-image-quality) il clamp
            // server 500KB non scatta più come coi PNG 1K.
            size: '1K',
            primaryColor: options?.primaryColor,
            secondaryColor: options?.secondaryColor,
            style: options?.style || 'minimalist',
            imageModel: options?.imageModel,
            background: options?.background === 'transparent' ? 'white' : options?.background,
            userEmail: userEmail || undefined,
            ...(sessionId ? { sessionId } : {}),
          },
          requestId,
          imageModel: options?.imageModel || getAiImageModelDefault(),
          userEmail,
          fallbackError: `Errore generazione ${kind} AI`,
          notFoundHint: `Endpoint icona AI non trovato. Se sei in locale: riavvia npm run dev. Se sei su Vercel: verifica che il deploy includa la route /api/ai/image-flash.`,
        });

        let finalDataUrl = dataUrl;
        if (options?.background === 'transparent') {
          try {
            finalDataUrl = await removeWhiteBackground(finalDataUrl);
          } catch (e) {
            console.warn('Failed to remove white background', e);
          }
        }
        success(
          kind === 'icon' ? 'Icona AI generata' : 'Hero AI generato',
          `${mimeType}, ${sizeKB}KB`,
          {
            requestId,
            costUsd,
            hasImage: true,
            imagePreviewBase64: finalDataUrl,
          },
        );
        // Persistenza Collection "Immagini Generate" (fire-and-forget,
        // stesso pattern di useAICard cover/photo).
        saveGeneratedImage(userEmail, finalDataUrl, 'cards', kind, prompt).catch(() => {});
        return { dataUrl: finalDataUrl, aiCall: { kind, costUsd } };
      } catch (err: any) {
        const is404Hint = err?.message?.includes('Endpoint icona AI non trovato');
        const hint = is404Hint ? err.message : mapAiError(err);
        logger.error(`IconHero AI ${kind} failed`, { route: 'useAIIconHero.generate', err: err?.message });
        error(`❌ ${hint}`, undefined, { requestId });
        throw new Error(hint);
      } finally {
        setIsProcessing(false);
      }
    },
    [userEmail, info, success, error, sessionId],
  );

  return { generate, isProcessing, logs, clear };
}
