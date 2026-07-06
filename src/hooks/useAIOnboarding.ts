import { useRef, useCallback, useState } from 'react';
import {
  OnboardingAIOrchestrator,
  type OnboardingSuggestions,
  type OnboardingSuggestResult,
} from '../ai/onboardingOrchestrator';
import {
  StreamBuffer,
  createEntry,
  createStreamEntry,
  createErrorEntry,
  createSuccessEntry,
} from '../ai/eventLog';
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
const STREAM_UPDATE_THRESHOLD = 80;

export function useAIOnboarding(userEmail?: string): UseAIOnboardingReturn {
  const orchestratorRef = useRef<OnboardingAIOrchestrator | null>(null);
  const [logs, setLogs] = useState<AILogEntry[]>([]);
  const [suggestions, setSuggestions] = useState<OnboardingSuggestions | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const streamBufferRef = useRef(new StreamBuffer());
  const streamEntryIdRef = useRef<string | null>(null);
  const lastCharCountRef = useRef(0);
  const streamStartRef = useRef(0);

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

  const updateLog = useCallback((id: string, patch: Partial<AILogEntry>) => {
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);

  const suggest = useCallback(
    async (name: string, sector?: string, options?: { onProgress?: (msg: string) => void }) => {
      setIsProcessing(true);
      addLog(createEntry('info', `Suggerimenti per "${name}"${sector ? `, settore ${sector}` : ''}`));
      streamBufferRef.current.clear();
      streamEntryIdRef.current = null;
      lastCharCountRef.current = 0;

      try {
        const result = await getOrchestrator().suggest(name, sector, {
          onStream: (chunk) => {
            if (chunk.type === 'content' && chunk.content) {
              streamBufferRef.current.append(chunk.content);
              if (!streamEntryIdRef.current) {
                const entry = createStreamEntry();
                streamEntryIdRef.current = entry.id;
                streamStartRef.current = Date.now();
                addLog(entry);
              }
              const id = streamEntryIdRef.current;
              const total = streamBufferRef.current.getRaw().length;
              if (id && total - lastCharCountRef.current >= STREAM_UPDATE_THRESHOLD) {
                lastCharCountRef.current = total;
                const elapsed = ((Date.now() - streamStartRef.current) / 1000).toFixed(1);
                updateLog(id, { msg: `Generazione in corso... ${total} caratteri · ${elapsed}s` });
              }
              return;
            }
            if (chunk.type === 'error' && chunk.error) {
              addLog(createErrorEntry(chunk.error));
            }
          },
          userEmail,
        });

        if (streamEntryIdRef.current) {
          const total = streamBufferRef.current.getRaw().length;
          const elapsed = ((Date.now() - streamStartRef.current) / 1000).toFixed(1);
          updateLog(streamEntryIdRef.current, {
            msg: `Risposta ricevuta · ${total} caratteri · ${elapsed}s`,
            status: 'done',
          });
        }

        if (result.applied) {
          setSuggestions(result.suggestions);
          addLog(createSuccessEntry('Suggerimenti generati', `${result.suggestions.companySuggestions.length} company, ${result.suggestions.professionSuggestions.length} profession`));
        } else {
          addLog(createErrorEntry('AI non ha generato suggerimenti validi', result.changes.join(',')));
        }
        return result;
      } catch (err) {
        const msg = (err as Error)?.message || 'unknown';
        addLog(createErrorEntry(`Errore AI: ${msg.slice(0, 200)}`));
        throw err;
      } finally {
        setIsProcessing(false);
        streamBufferRef.current.clear();
        streamEntryIdRef.current = null;
      }
    },
    [addLog, updateLog, userEmail],
  );

  const reset = useCallback(() => {
    getOrchestrator().resetSession();
    setLogs([]);
    setSuggestions(null);
    streamBufferRef.current.clear();
    streamEntryIdRef.current = null;
  }, []);

  return { suggest, reset, logs, suggestions, isProcessing };
}