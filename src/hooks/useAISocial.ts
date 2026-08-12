import { useRef, useCallback, useState } from 'react';
import {
  SocialAIOrchestrator,
  type SocialPost,
  type SocialProcessResult,
} from '../ai/socialOrchestrator';
import type { SocialSource, SocialTone } from '../ai/prompts/socialSystem';
import { useAILogs } from './useAILogs';
import { newRequestId } from '../utils/ai/requestId';
import dataService from '../utils/dataService';
import { resolveProviderId, providerSupportsVision } from '../utils/resolveProviderId';
import { calculateCostUsd } from '../ai/providerPricing';
import { getAiVisionEnabled } from '../utils/uiPrefs';
import { captureElementAsBase64 } from '../utils/ai/captureElement';

export interface UseAISocialReturn {
  generate: (
    source: SocialSource,
    tone: SocialTone,
    options?: { onProgress?: (msg: string) => void },
  ) => Promise<SocialProcessResult>;
  reset: () => void;
  logs: ReturnType<typeof useAILogs>['logs'];
  posts: SocialPost[];
  isProcessing: boolean;
  availableModels: { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean; supportsVision: boolean }[];
  lastCostUsd: number;
}

export function useAISocial(userEmail?: string, sessionId?: string): UseAISocialReturn {
  const orchestratorRef = useRef<SocialAIOrchestrator | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [lastCostUsd, setLastCostUsd] = useState(0);
  const { logs, isProcessing, startStream, appendStream, finalizeStream, info, success, error, clear } = useAILogs('useAISocial');

  const getOrchestrator = (): SocialAIOrchestrator => {
    if (!orchestratorRef.current) orchestratorRef.current = new SocialAIOrchestrator();
    return orchestratorRef.current;
  };

  const generate = useCallback(
    async (source: SocialSource, tone: SocialTone, options?: { onProgress?: (msg: string) => void }) => {
      const requestId = newRequestId();
      const label = source.type === 'card'
        ? `card "${source.data.name}"`
        : `flyer "${source.data.headline}"`;
      info(`Invio richiesta: 3 post da ${label}, tone=${tone}`, undefined, { requestId });
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

  const reset = useCallback(() => {
    getOrchestrator().resetSession();
    setPosts([]);
    clear();
  }, [clear]);

  const availableModels = getOrchestrator().getProviderList();

  return { generate, reset, logs, posts, isProcessing, availableModels, lastCostUsd };
}

async function captureSocialPreview(source: SocialSource): Promise<string | undefined> {
  try {
    const selector = source.type === 'card' ? '[data-card-preview]' : '[data-flyer-preview]';
    const previewEl = document.querySelector<HTMLElement>(selector);
    if (!previewEl) return undefined;
    return (await captureElementAsBase64(previewEl, { maxWidth: 1024, quality: 0.8, type: 'image/jpeg' })) ?? undefined;
  } catch {
    return undefined;
  }
}
