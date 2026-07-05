import { useRef, useCallback, useState } from 'react';
import {
  OnboardingAIOrchestrator,
  type OnboardingSuggestions,
  type OnboardingSuggestResult,
} from '../ai/onboardingOrchestrator';
import { createEntry } from '../ai/eventLog';
import type { AILogEntry } from '../ai/types';

export interface UseAIOnboardingReturn {
  suggest: (
    name: string,
    sector?: string,
    options?: { onProgress?: (msg: string) => void },
  ) => Promise<OnboardingSuggestResult>;
  reset: () => void;
  logs: AILogEntry[];
  suggestions: OnboardingSuggestions | null;
  isProcessing: boolean;
}

const MAX_LOG_ENTRIES = 40;

export function useAIOnboarding(userEmail?: string): UseAIOnboardingReturn {
  const orchestratorRef = useRef<OnboardingAIOrchestrator | null>(null);
  const [logs, setLogs] = useState<AILogEntry[]>([]);
  const [suggestions, setSuggestions] = useState<OnboardingSuggestions | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const getOrchestrator = (): OnboardingAIOrchestrator => {
    if (!orchestratorRef.current) orchestratorRef.current = new OnboardingAIOrchestrator();
    return orchestratorRef.current;
  };

  const addLog = useCallback((entry: AILogEntry) => {
    setLogs((prev) => {
      const next = [...prev, entry];
      if (next.length > MAX_LOG_ENTRIES) next.shift();
      return next;
    });
  }, []);

  const suggest = useCallback(
    async (name: string, sector?: string, options?: { onProgress?: (msg: string) => void }) => {
      setIsProcessing(true);
      addLog(createEntry('info', 'onboarding_ai_suggest_start'));
      try {
        const result = await getOrchestrator().suggest(name, sector, {
          onStream: (chunk) => {
            if (chunk.type === 'content' && chunk.content) {
              addLog(createEntry('stream', chunk.content.slice(0, 200)));
            }
          },
          userEmail,
        });
        if (result.applied) {
          setSuggestions(result.suggestions);
          addLog(createEntry('success', `onboarding_ai_suggested:${result.suggestions.companySuggestions.length}`));
        } else {
          addLog(createEntry('error', 'onboarding_ai_failed', { detail: result.changes.join(',') }));
        }
        return result;
      } catch (err) {
        const msg = (err as Error)?.message || 'unknown';
        addLog(createEntry('error', 'onboarding_ai_exception', { detail: msg.slice(0, 200) }));
        throw err;
      } finally {
        setIsProcessing(false);
      }
    },
    [addLog, userEmail],
  );

  const reset = useCallback(() => {
    getOrchestrator().resetSession();
    setLogs([]);
    setSuggestions(null);
  }, []);

  return { suggest, reset, logs, suggestions, isProcessing };
}
