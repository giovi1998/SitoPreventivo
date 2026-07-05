import { useRef, useCallback, useState } from 'react';
import type { Logo } from '../utils/documentSchemas';
import { LogoAIOrchestrator, type LogoProcessResult } from '../ai/logoOrchestrator';
import { createEntry } from '../ai/eventLog';
import type { AILogEntry } from '../ai/types';

/**
 * useAILogo — client-side hook for the Logo AI v2 orchestrator.
 * Mirrors useAICard / useAIFlyer shape: logs cap 40, token check
 * skipped for admin, error hint mapping.
 */
export interface UseAILogoReturn {
  generate: (
    logo: Logo,
    brief: string,
    options?: { sector?: string; onProgress?: (msg: string) => void },
  ) => Promise<LogoProcessResult>;
  reset: () => void;
  logs: AILogEntry[];
  isProcessing: boolean;
  availableModels: { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean }[];
}

const MAX_LOG_ENTRIES = 40;

export function useAILogo(userEmail?: string): UseAILogoReturn {
  const orchestratorRef = useRef<LogoAIOrchestrator | null>(null);
  const [logs, setLogs] = useState<AILogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const getOrchestrator = (): LogoAIOrchestrator => {
    if (!orchestratorRef.current) orchestratorRef.current = new LogoAIOrchestrator();
    return orchestratorRef.current;
  };

  const availableModels = getOrchestrator().getProviderList();

  const addLog = useCallback((entry: AILogEntry) => {
    setLogs((prev) => {
      const next = [...prev, entry];
      if (next.length > MAX_LOG_ENTRIES) next.shift();
      return next;
    });
  }, []);

  const generate = useCallback(
    async (logo: Logo, brief: string, options?: { sector?: string; onProgress?: (msg: string) => void }) => {
      setIsProcessing(true);
      addLog(createEntry('info', 'logo_ai_generate_start'));
      try {
        const result = await getOrchestrator().generateLogo(logo, brief, {
          sector: options?.sector,
          onStream: (chunk) => {
            if (chunk.type === 'content' && chunk.content) {
              addLog(createEntry('stream', chunk.content.slice(0, 200)));
            }
          },
          userEmail,
        });
        if (result.applied) {
          addLog(createEntry('success', 'logo_ai_generated'));
        } else {
          addLog(createEntry('error', 'logo_ai_failed', { detail: result.changes.join(',') }));
        }
        return result;
      } catch (err) {
        const msg = (err as Error)?.message || 'unknown';
        addLog(createEntry('error', 'logo_ai_exception', { detail: msg.slice(0, 200) }));
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
  }, []);

  return { generate, reset, logs, isProcessing, availableModels };
}
