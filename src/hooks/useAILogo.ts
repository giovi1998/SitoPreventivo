import { useRef, useCallback, useState } from 'react';
import type { Logo } from '../utils/documentSchemas';
import { LogoAIOrchestrator, type LogoProcessResult } from '../ai/logoOrchestrator';
import { useAILogs } from './useAILogs';
import { mapAiError } from '../utils/ai/mapAiError';
import { IMAGE_TOKEN_COST } from '../ai/costs';
import { newRequestId } from '../utils/ai/requestId';
import dataService from '../utils/dataService';
import { resolveProviderId } from '../utils/resolveProviderId';
import { calculateCostUsd } from '../ai/providerPricing';

export interface UseAILogoReturn {
  generate: (
    logo: Logo,
    brief: string,
    options?: { sector?: string; onProgress?: (msg: string) => void },
  ) => Promise<LogoProcessResult>;
  generateBackground: (
    logo: Logo,
    context: { activity: string; mood: string; target: string; imagePrompt?: string },
  ) => Promise<{ logo: Logo; applied: boolean; error?: string }>;
  reset: () => void;
  logs: ReturnType<typeof useAILogs>['logs'];
  isProcessing: boolean;
  isGeneratingBg: boolean;
  availableModels: { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean; supportsVision: boolean }[];
  lastCostUsd: number;
}


export function useAILogo(userEmail?: string): UseAILogoReturn {
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
    () => {
      if (userEmail && userEmail !== 'admin@gmail.com') {
        dataService.trackTokens(userEmail, IMAGE_TOKEN_COST).catch(() => {});
      }
    },
    [userEmail]
  );

  const generate = useCallback(
    async (logo: Logo, brief: string, options?: { sector?: string; onProgress?: (msg: string) => void }) => {
      const requestId = newRequestId();
      const promptPreview = brief.length > 60 ? brief.slice(0, 57) + '...' : brief;
      info(`Invio richiesta: "${promptPreview}"`, brief, { requestId });
      const streamId = startStream('Generazione in corso…', {
        requestId,
        sessionId: getOrchestrator().getCurrentSessionId() ?? undefined,
      });

      try {
        const result = await getOrchestrator().generateLogo(logo, brief, {
          sector: options?.sector,
          modelId: resolveProviderId(),
          onStream: (chunk) => {
            if (chunk.type === 'content' && chunk.content) {
              appendStream(streamId, chunk.content);
              options?.onProgress?.(`Generazione in corso… ${chunk.content.length} caratteri`);
            } else if (chunk.type === 'error' && chunk.error) {
              throw new Error(chunk.error);
            }
          },
          userEmail,
        });

        const tokens = result.response?.usage
          ? {
              prompt: result.response.usage.promptTokens,
              completion: result.response.usage.completionTokens,
              total: result.response.usage.totalTokens,
            }
          : undefined;

        finalizeStream(streamId, true, {
          tokens,
          detail: result.rawResponse?.slice(0, 2048),
        });

        if (userEmail && userEmail !== 'admin@gmail.com' && result.response?.usage) {
          const cost = calculateCostUsd(resolveProviderId(), result.response.usage);
          setLastCostUsd(cost);
          dataService.trackTokens(userEmail, result.response.usage.totalTokens, cost).catch(() => {});
        }

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
        return result;
      } catch (err) {
        const hint = mapAiError(err);
        finalizeStream(streamId, false, { errorMsg: hint });
        throw new Error(hint);
      }
    },
    [info, startStream, appendStream, finalizeStream, success, error, userEmail]
  );

  const generateBackground = useCallback(
    async (logo: Logo, context: { activity: string; mood: string; target: string; imagePrompt?: string }) => {
      const requestId = newRequestId();
      const promptPreview = context.imagePrompt
        ? context.imagePrompt.slice(0, 50) + '...'
        : `activity="${context.activity.slice(0, 40)}"`;
      info(`Background AI: ${promptPreview}`, undefined, { requestId });
      setIsGeneratingBg(true);
      try {
        const result = await getOrchestrator().generateBackground(logo, context, { userEmail });
        if (result.applied) {
          success(
            'Background generato',
            `${result.logo.builder.backgroundImage?.length ?? 0} char base64`,
            { requestId }
          );
          trackImage();
          setLastCostUsd(0);
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
    [info, success, error, trackImage, userEmail]
  );

  const reset = useCallback(() => {
    getOrchestrator().resetSession();
    clear();
  }, [clear]);

  return { generate, generateBackground, reset, logs, isProcessing, isGeneratingBg, availableModels, lastCostUsd };
}
