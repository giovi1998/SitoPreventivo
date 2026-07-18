import { useRef, useCallback, useState } from 'react';
import {
  OnboardingAIOrchestrator,
  type OnboardingSuggestions,
  type OnboardingSuggestResult,
} from '../ai/onboardingOrchestrator';
import { useAILogs } from './useAILogs';
import { newRequestId } from '../utils/ai/requestId';

export interface UseAIOnboardingReturn {
  suggest: (
    name: string,
    sector?: string,
    options?: { onProgress?: (msg: string) => void },
  ) => Promise<OnboardingSuggestResult>;
  reset: () => void;
  logs: ReturnType<typeof useAILogs>['logs'];
  suggestions: OnboardingSuggestions | null;
  isProcessing: boolean;
}

export function useAIOnboarding(userEmail?: string): UseAIOnboardingReturn {
  const orchestratorRef = useRef<OnboardingAIOrchestrator | null>(null);
  const [suggestions, setSuggestions] = useState<OnboardingSuggestions | null>(null);
  const { logs, isProcessing, startStream, appendStream, finalizeStream, info, success, error, clear } = useAILogs('useAIOnboarding');

  const getOrchestrator = (): OnboardingAIOrchestrator => {
    if (!orchestratorRef.current) orchestratorRef.current = new OnboardingAIOrchestrator();
    return orchestratorRef.current;
  };

  const suggest = useCallback(
    async (name: string, sector?: string, options?: { onProgress?: (msg: string) => void }) => {
      const requestId = newRequestId();
      info(`Suggerimenti per "${name}"${sector ? `, settore ${sector}` : ''}`, undefined, { requestId });
      const streamId = startStream('Generazione in corso…', { requestId });

      try {
        const result = await getOrchestrator().suggest(name, sector, {
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
          ? { prompt: result.response.usage.promptTokens, completion: result.response.usage.completionTokens, total: result.response.usage.totalTokens }
          : undefined;
        finalizeStream(streamId, true, { tokens, detail: result.rawResponse?.slice(0, 2048) });

        if (result.applied) {
          setSuggestions(result.suggestions);
          success('Suggerimenti generati', `${result.suggestions.companySuggestions.length} company, ${result.suggestions.professionSuggestions.length} profession`, { requestId });
        } else {
          error('AI non ha generato suggerimenti validi', result.changes.join(','), { requestId });
        }
        return result;
      } catch (err) {
        const msg = (err as Error)?.message || 'Errore AI onboarding';
        finalizeStream(streamId, false, { errorMsg: msg.slice(0, 200) });
        throw err;
      }
    },
    [info, startStream, appendStream, finalizeStream, success, error, userEmail]
  );

  const reset = useCallback(() => {
    getOrchestrator().resetSession();
    setSuggestions(null);
    clear();
  }, [clear]);

  return { suggest, reset, logs, suggestions, isProcessing };
}
