import { useCallback, useState } from 'react';
import { useAILogs } from './useAILogs';
import { newRequestId } from '../utils/ai/requestId';
import { mapAiError } from '../utils/ai/mapAiError';
import { logger } from '../utils/logger';
import { IMAGE_TOKEN_COST } from '../ai/costs';
import { calculateCostUsd, geminiImagePricingId } from '../ai/providerPricing';
import { getAiImageModelDefault } from '../utils/uiPrefs';
import { saveGeneratedImage } from '../utils/saveGeneratedImage';
import dataService from '../utils/dataService';

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

export function useAIIconHero(userEmail?: string): UseAIIconHeroReturn {
  const { logs, info, success, error, clear } = useAILogs('useAIIconHero');
  const [isProcessing, setIsProcessing] = useState(false);

  const generate = useCallback(
    async (prompt: string, kind: IconHeroKind, options?: IconHeroOptions) => {
      const requestId = newRequestId();
      setIsProcessing(true);
      info(kind === 'icon' ? '🎨 Generazione icona AI...' : '🖼️ Generazione hero AI...', prompt.slice(0, 300), { requestId });

      let responseStatus: number | undefined;
      const url = `${import.meta.env?.VITE_API_BASE || ''}/api/ai/image-flash`;

      try {
        const { removeWhiteBackground } = await import('../utils/ai/removeBackground');
        const apiBase = import.meta.env?.VITE_API_BASE || '';
        const res = await fetch(`${apiBase}/api/ai/image-flash`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
          body: JSON.stringify({
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
          }),
        });

        responseStatus = res.status;
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error(
              `Endpoint icona AI non trovato. Se sei in locale: riavvia npm run dev. Se sei su Vercel: verifica che il deploy includa la route /api/ai/image-flash.`,
            );
          }
          const err = await res.json().catch(() => ({ error: `Errore ${kind} AI (${res.status})` }));
          throw new Error(err.error || `${kind} AI ${res.status}`);
        }

        const { data } = (await res.json()) as { data: { imageBase64: string; mimeType: string } };

        // Costo reale dal modello richiesto (default = pref UI immagini).
        const costUsd = calculateCostUsd(
          geminiImagePricingId(options?.imageModel || getAiImageModelDefault()),
          undefined,
          1,
        );
        if (userEmail && userEmail !== 'admin@gmail.com') {
          Promise.resolve(dataService.trackTokens(userEmail, IMAGE_TOKEN_COST, costUsd) as unknown as Promise<unknown>).catch(() => {});
        }
        const sizeKB = Math.round(data.imageBase64.length * 0.75 / 1024);
        let finalDataUrl = `data:${data.mimeType};base64,${data.imageBase64}`;
        if (options?.background === 'transparent') {
          try {
            finalDataUrl = await removeWhiteBackground(finalDataUrl);
          } catch (e) {
            console.warn('Failed to remove white background', e);
          }
        }
        success(
          kind === 'icon' ? 'Icona AI generata' : 'Hero AI generato',
          `${data.mimeType}, ${sizeKB}KB`,
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
        logger.error(`IconHero AI ${kind} failed`, { route: 'useAIIconHero.generate', status: responseStatus, url, err: err?.message });
        error(`❌ ${hint}`, undefined, { requestId });
        throw new Error(hint);
      } finally {
        setIsProcessing(false);
      }
    },
    [userEmail, info, success, error],
  );

  return { generate, isProcessing, logs, clear };
}
