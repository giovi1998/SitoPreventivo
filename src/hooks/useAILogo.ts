import { useRef, useCallback, useState } from 'react';
import type { Logo } from '../utils/documentSchemas';
import { LogoAIOrchestrator, type LogoProcessResult } from '../ai/logoOrchestrator';
import { useAILogs } from './useAILogs';
import { mapAiError } from '../utils/ai/mapAiError';
import { saveGeneratedImage } from '../utils/saveGeneratedImage';
import { IMAGE_TOKEN_COST } from '../ai/costs';
import { newRequestId } from '../utils/ai/requestId';
import dataService from '../utils/dataService';
import { resolveProviderId, providerSupportsVision } from '../utils/resolveProviderId';
import { calculateCostUsd } from '../ai/providerPricing';
import { getAiImageModelDefault, getAiVisionEnabled } from '../utils/uiPrefs';
import { renderLogoPreviewImage } from '../utils/logo/logoPreviewImage';

export interface UseAILogoReturn {
  generate: (
    logo: Logo,
    brief: string,
    options?: { sector?: string; modelId?: string; onProgress?: (msg: string) => void },
  ) => Promise<LogoProcessResult>;
  generateBackground: (
    logo: Logo,
    context: { activity: string; mood: string; target: string; imagePrompt?: string },
    options?: { imageModel?: string },
  ) => Promise<{ logo: Logo; applied: boolean; error?: string; aiCall?: { kind: 'background'; costUsd: number } }>;
  reset: () => void;
  logs: ReturnType<typeof useAILogs>['logs'];
  isProcessing: boolean;
  isGeneratingBg: boolean;
  availableModels: { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean; supportsVision: boolean }[];
  lastCostUsd: number;
}


export function useAILogo(userEmail?: string, sessionId?: string): UseAILogoReturn {
  const orchestratorRef = useRef<LogoAIOrchestrator | null>(null);
  const [isGeneratingBg, setIsGeneratingBg] = useState(false);
  const [lastCostUsd, setLastCostUsd] = useState(0);
  const {
    logs,
    isProcessing,
    startStream,
    appendStream,
    finalizeStream,
    info,
    success,
    error,
    clear,
  } = useAILogs('useAILogo');

  const getOrchestrator = (): LogoAIOrchestrator => {
    if (!orchestratorRef.current) orchestratorRef.current = new LogoAIOrchestrator();
    return orchestratorRef.current;
  };

  const availableModels = getOrchestrator().getProviderList();

  const trackImage = useCallback(
    (costUsd?: number) => {
      if (userEmail && userEmail !== 'admin@gmail.com') {
        dataService.trackTokens(userEmail, IMAGE_TOKEN_COST, costUsd).catch(() => {});
      }
    },
    [userEmail]
  );

  const generate = useCallback(
    async (logo: Logo, brief: string, options?: { sector?: string; modelId?: string; onProgress?: (msg: string) => void }) => {
      const requestId = newRequestId();
      const promptPreview = brief.length > 60 ? brief.slice(0, 57) + '...' : brief;

      const resolvedModelId = resolveProviderId(options?.modelId);
      // CON-MM-002: cattura lo screenshot solo se il provider risolto supporta
      // vision — con un provider text-only verrebbe catturato e scartato.
      let imagePreviewBase64: string | undefined;
      const visionEnabled = getAiVisionEnabled() && providerSupportsVision(resolvedModelId);
      const hasLogoContent = !!(logo.builder.primaryText || logo.builder.tagline || logo.builder.iconType !== 'none');
      if (visionEnabled && hasLogoContent) {
        try {
          imagePreviewBase64 = await renderLogoPreviewImage(logo, { maxWidth: 1024, quality: 0.8, type: 'image/jpeg' }) ?? undefined;
        } catch {
          imagePreviewBase64 = undefined;
        }
      }

      info(`Invio richiesta: "${promptPreview}"`, brief, { requestId, hasImage: !!imagePreviewBase64, imagePreviewBase64 });
      const streamId = startStream('Generazione in corso…', {
        requestId,
        sessionId: getOrchestrator().getCurrentSessionId() ?? undefined,
      });

      try {
        const result = await getOrchestrator().generateLogo(logo, brief, {
          sector: options?.sector,
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

        const cost = result.response?.usage ? calculateCostUsd(resolvedModelId, result.response.usage) : 0;
        if (userEmail && userEmail !== 'admin@gmail.com' && result.response?.usage) {
          dataService.trackTokens(userEmail, result.response.usage.totalTokens, cost).catch(() => {});
        }
        setLastCostUsd(cost);
        finalizeStream(streamId, true, {
          tokens,
          costUsd: cost,
          modelId: resolvedModelId,
          requestId,
          detail: result.rawResponse?.slice(0, 16384),
          hasImage: !!imagePreviewBase64,
          imagePreviewBase64,
        });

        if (result.applied) {
          const summary = [
            `Testo: ${result.logo.builder.primaryText || '(vuoto)'}`,
            `Icona: ${result.logo.builder.iconType}`,
            `Layout: ${result.logo.builder.layout}`,
            `Colori: ${result.logo.builder.primaryColor} + ${result.logo.builder.secondaryColor}`,
          ].join(' · ');
          success('Logo generato', summary, { requestId });
        } else {
          error('AI non ha restituito parametri validi', result.changes.join(','), { requestId });
        }
        return { ...result, aiCall: { kind: 'logoConcept' as const, costUsd: cost } };
      } catch (err) {
        const hint = mapAiError(err);
        finalizeStream(streamId, false, { errorMsg: hint });
        throw new Error(hint);
      }
    },
    [info, startStream, appendStream, finalizeStream, success, error, userEmail, sessionId]
  );

  const generateBackground = useCallback(
    async (logo: Logo, context: { activity: string; mood: string; target: string; imagePrompt?: string }, options?: { imageModel?: string }) => {
      const requestId = newRequestId();
      const promptPreview = context.imagePrompt
        ? context.imagePrompt.slice(0, 50) + '...'
        : `activity="${context.activity.slice(0, 40)}"`;
      info(`Background AI: ${promptPreview}`, undefined, { requestId });
      setIsGeneratingBg(true);
      try {
        const imageModel = options?.imageModel || getAiImageModelDefault();
        const result = await getOrchestrator().generateBackground(logo, context, { userEmail, imageModel, sessionId });
        if (result.applied) {
          const pricingId = imageModel === 'gemini-2.0-flash-preview-image-generation' ? 'gemini-flash-image' : 'gemini-nano-banana';
          const imageCost = calculateCostUsd(pricingId, undefined, 1);
          setLastCostUsd(imageCost);
          success(
            'Background generato',
            `${result.logo.builder.backgroundImage?.length ?? 0} char base64`,
            { requestId, modelId: imageModel, costUsd: imageCost, hasImage: true }
          );
          trackImage(imageCost);
          const bgImage = result.logo.builder.backgroundImage;
          if (bgImage) saveGeneratedImage(userEmail, bgImage, 'logos', 'background', context.imagePrompt).catch(() => {});
          return { ...result, aiCall: { kind: 'background' as const, costUsd: imageCost } };
        } else {
          error(mapAiError(result.error ?? 'Background non generato'), undefined, { requestId });
        }
        return result;
      } catch (err) {
        const hint = mapAiError(err);
        error(hint, undefined, { requestId });
        throw new Error(hint);
      } finally {
        setIsGeneratingBg(false);
      }
    },
    [info, success, error, trackImage, userEmail, sessionId]
  );

  const reset = useCallback(() => {
    getOrchestrator().resetSession();
    clear();
  }, [clear]);

  return { generate, generateBackground, reset, logs, isProcessing, isGeneratingBg, availableModels, lastCostUsd };
}
