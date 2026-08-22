import { useRef, useCallback, useState } from 'react';
import {
  SocialAIOrchestrator,
  type SocialPost,
  type SocialProcessResult,
} from '../ai/socialOrchestrator';
import type { SocialSource, SocialTone, SocialPlatform } from '../ai/prompts/socialSystem';
import { useAILogs } from './useAILogs';
import { newRequestId } from '../utils/ai/requestId';
import dataService from '../utils/dataService';
import { resolveProviderId, providerSupportsVision } from '../utils/resolveProviderId';
import { calculateCostUsd } from '../ai/providerPricing';
import { getAiVisionEnabled, getAiImageModelDefault } from '../utils/uiPrefs';
import { captureElementAsBase64 } from '../utils/ai/captureElement';
import { mapAiError } from '../utils/ai/mapAiError';
import { postAiImage } from '../utils/ai/imageCall';

export interface UseAISocialReturn {
  generate: (
    source: SocialSource,
    tone: SocialTone,
    options?: { onProgress?: (msg: string) => void; userPrompt?: string },
  ) => Promise<SocialProcessResult>;
  /** Modifica manuale di una caption generata (resa user-editable). */
  setPosts: React.Dispatch<React.SetStateAction<SocialPost[]>>;
  /** Genera l'immagine AI di un post via /api/ai/image-flash (1:1, kind custom). */
  generatePostImage: (platform: SocialPlatform, prompt: string, imageModel?: string) => Promise<string>;
  reset: () => void;
  logs: ReturnType<typeof useAILogs>['logs'];
  posts: SocialPost[];
  /** Immagini generate per piattaforma (data URL). */
  postImages: Partial<Record<SocialPlatform, string>>;
  isProcessing: boolean;
  availableModels: { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean; supportsVision: boolean }[];
  lastCostUsd: number;
}

export function useAISocial(userEmail?: string, sessionId?: string): UseAISocialReturn {
  const orchestratorRef = useRef<SocialAIOrchestrator | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [postImages, setPostImages] = useState<Partial<Record<SocialPlatform, string>>>({});
  const [lastCostUsd, setLastCostUsd] = useState(0);
  const { logs, isProcessing, startStream, appendStream, finalizeStream, info, success, error, clear } = useAILogs('useAISocial');

  const getOrchestrator = (): SocialAIOrchestrator => {
    if (!orchestratorRef.current) orchestratorRef.current = new SocialAIOrchestrator();
    return orchestratorRef.current;
  };

  const generate = useCallback(
    async (source: SocialSource, tone: SocialTone, options?: { onProgress?: (msg: string) => void; userPrompt?: string }) => {
      const requestId = newRequestId();
      const label = source.type === 'card'
        ? `card "${source.data.name}"`
        : source.type === 'flyer'
          ? `flyer "${source.data.headline}"`
          : `website "${source.data.businessName}"`;
      info(`Invio richiesta: 3 post da ${label}, tone=${tone}${options?.userPrompt?.trim() ? `, prompt="${options.userPrompt.trim().slice(0, 60)}"` : ''}`, undefined, { requestId });
      const streamId = startStream('Generazione in corso…', {
        requestId,
        sessionId: getOrchestrator().getCurrentSessionId() ?? undefined,
      });

      try {
        const resolvedModelId = resolveProviderId();
        const visionEnabled = getAiVisionEnabled() && providerSupportsVision(resolvedModelId);
        const imagePreviewBase64 = visionEnabled ? await captureSocialPreview(source) : undefined;
        const result = await getOrchestrator().generatePosts(source, tone, {
          modelId: resolvedModelId,
          sessionId,
          userPrompt: options?.userPrompt,
          onStream: (chunk) => {
            if (chunk.type === 'content' && chunk.content) {
              appendStream(streamId, chunk.content);
              options?.onProgress?.(`Generazione in corso… ${chunk.content.length} caratteri`);
            } else if (chunk.type === 'error' && chunk.error) {
              throw new Error(chunk.error);
            }
          },
          userEmail,
          imagePreviewBase64,
        });

        const tokens = result.response?.usage
          ? {
              prompt: result.response.usage.promptTokens,
              completion: result.response.usage.completionTokens,
              total: result.response.usage.totalTokens,
            }
          : undefined;

        finalizeStream(streamId, true, { tokens, detail: result.rawResponse?.slice(0, 16384), hasImage: !!imagePreviewBase64, imagePreviewBase64 });

        if (userEmail && userEmail !== 'admin@gmail.com' && result.response?.usage) {
          const cost = calculateCostUsd(resolveProviderId(), result.response.usage);
          setLastCostUsd(cost);
          dataService.trackTokens(userEmail, result.response.usage.totalTokens, cost).catch(() => {});
        }

        if (result.applied) {
          setPosts(result.posts);
          const platforms = result.posts.map((p) => p.platform).join(', ');
          success(`${result.posts.length} post generati`, platforms, { requestId });
        } else {
          error('AI non ha generato post validi', result.changes.join(','), { requestId });
        }
        return result;
      } catch (err) {
        const hint = (err as Error)?.message || 'Errore AI social';
        finalizeStream(streamId, false, { errorMsg: hint });
        throw err;
      }
    },
    [info, startStream, appendStream, finalizeStream, success, error, userEmail, sessionId]
  );

  const generatePostImage = useCallback(
    async (platform: SocialPlatform, prompt: string, imageModel?: string): Promise<string> => {
      const requestId = newRequestId();
      info(`Immagine post ${platform}…`, prompt.slice(0, 300), { requestId });
      try {
        const model = imageModel || getAiImageModelDefault();
        const { dataUrl, costUsd } = await postAiImage({
          endpoint: '/api/ai/image-flash',
          payload: {
            prompt: prompt.slice(0, 1000),
            kind: 'custom',
            aspectRatio: '1:1',
            size: '1K',
            imageModel: model,
            userEmail: userEmail || undefined,
            ...(sessionId ? { sessionId } : {}),
          },
          requestId,
          imageModel: model,
          userEmail,
          fallbackError: 'Errore generazione immagine AI',
        });
        setLastCostUsd((c) => c + costUsd);
        setPostImages((prev) => ({ ...prev, [platform]: dataUrl }));
        success(`Immagine ${platform} generata`, `${Math.round(dataUrl.length * 0.75 / 1024)}KB`, { requestId, costUsd, hasImage: true, imagePreviewBase64: dataUrl });
        return dataUrl;
      } catch (err) {
        const hint = mapAiError(err);
        error(hint, undefined, { requestId });
        throw new Error(hint);
      }
    },
    [info, success, error, userEmail, sessionId]
  );

  const reset = useCallback(() => {
    getOrchestrator().resetSession();
    setPosts([]);
    setPostImages({});
    clear();
  }, [clear]);

  const availableModels = getOrchestrator().getProviderList();

  return { generate, generatePostImage, reset, logs, posts, postImages, isProcessing, availableModels, lastCostUsd, setPosts };
}

async function captureSocialPreview(source: SocialSource): Promise<string | undefined> {
  try {
    if (source.type === 'website') return undefined;
    const selector = source.type === 'card' ? '[data-card-preview]' : '[data-flyer-preview]';
    const previewEl = document.querySelector<HTMLElement>(selector);
    if (!previewEl) return undefined;
    return (await captureElementAsBase64(previewEl, { maxWidth: 1024, quality: 0.8, type: 'image/jpeg' })) ?? undefined;
  } catch {
    return undefined;
  }
}
