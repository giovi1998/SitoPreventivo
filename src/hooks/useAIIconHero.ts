import { useCallback, useState } from 'react';
import { useAILogs } from './useAILogs';
import { newRequestId } from '../utils/ai/requestId';
import { mapAiError } from '../utils/ai/mapAiError';
import { logger } from '../utils/logger';
import { IMAGE_TOKEN_COST } from '../ai/costs';
import dataService from '../utils/dataService';

export type IconHeroKind = 'icon' | 'hero';

export type IconBackground = 'white' | 'card' | 'accent';

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
  ) => Promise<string>;
  isProcessing: boolean;
  logs: ReturnType<typeof useAILogs>['logs'];
}

export function useAIIconHero(userEmail?: string): UseAIIconHeroReturn {
  const { logs, info, success, error } = useAILogs('useAIIconHero');
  const [isProcessing, setIsProcessing] = useState(false);

  const generate = useCallback(
    async (prompt: string, kind: IconHeroKind, options?: IconHeroOptions) => {
      const requestId = newRequestId();
      setIsProcessing(true);
      info(kind === 'icon' ? '🎨 Generazione icona AI...' : '🖼️ Generazione hero AI...', prompt.slice(0, 120), { requestId });

      try {
        const apiBase = import.meta.env?.VITE_API_BASE || '';
        const res = await fetch(`${apiBase}/api/ai/image-flash`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
          body: JSON.stringify({
            prompt: prompt.slice(0, 1000),
            kind,
            aspectRatio: kind === 'hero' ? '16:9' : '1:1',
            size: '512',
            primaryColor: options?.primaryColor,
            secondaryColor: options?.secondaryColor,
            style: options?.style || 'minimalist',
            imageModel: options?.imageModel,
            background: options?.background,
            userEmail: userEmail || undefined,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `Errore ${kind} AI (${res.status})` }));
          throw new Error(err.error || `${kind} AI ${res.status}`);
        }

        const { data } = (await res.json()) as { data: { imageBase64: string; mimeType: string } };

        if (userEmail && userEmail !== 'admin@gmail.com') {
          Promise.resolve(dataService.trackTokens(userEmail, IMAGE_TOKEN_COST) as unknown as Promise<unknown>).catch(() => {});
        }

        success(kind === 'icon' ? 'Icona AI generata' : 'Hero AI generato', `${data.mimeType}, ${Math.round(data.imageBase64.length * 0.75 / 1024)}KB`, { requestId });
        return `data:${data.mimeType};base64,${data.imageBase64}`;
      } catch (err: any) {
        const hint = mapAiError(err);
        logger.error(`IconHero AI ${kind} failed`, { route: 'useAIIconHero.generate', err: err?.message });
        error(`❌ ${hint}`, undefined, { requestId });
        throw new Error(hint);
      } finally {
        setIsProcessing(false);
      }
    },
    [userEmail, info, success, error],
  );

  return { generate, isProcessing, logs };
}
