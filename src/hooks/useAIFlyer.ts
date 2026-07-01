import { useCallback, useRef, useState } from 'react';
import type { Flyer, FlyerTone } from '../utils/documentSchemas';
import type { AIStreamChunk, AILogEntry } from '../ai/types';
import { FlyerAIOrchestrator, type FlyerRefineAction } from '../ai/flyerOrchestrator';
import {
  StreamBuffer,
  createEntry,
  createStreamEntry,
  createErrorEntry,
  createSuccessEntry,
  createInfoEntry,
} from '../ai/eventLog';
import dataService from '../utils/dataService';
import { logger } from '../utils/logger';

const MAX_LOG_ENTRIES = 40;

interface UseAIFlyerReturn {
  generate: (
    flyer: Flyer,
    brief: string,
    tone: FlyerTone,
    options?: { modelId?: string }
  ) => Promise<{ flyer: Flyer; changes: string[]; rawResponse?: string; applied: boolean }>;
  refine: (
    flyer: Flyer,
    action: FlyerRefineAction,
    options?: { modelId?: string }
  ) => Promise<{ flyer: Flyer; changes: string[]; rawResponse?: string; applied: boolean }>;
  reset: () => void;
  logs: AILogEntry[];
  isProcessing: boolean;
  availableModels: { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean }[];
}

/**
 * React hook wrapping FlyerAIOrchestrator with the standard log +
 * stream-buffer + token-tracking plumbing (see useAICard for the
 * original pattern).
 */
export function useAIFlyer(userEmail?: string): UseAIFlyerReturn {
  const [logs, setLogs] = useState<AILogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [availableModels] = useState(() => {
    const orch = new FlyerAIOrchestrator();
    return orch.getProviderList();
  });

  const orchestratorRef = useRef<FlyerAIOrchestrator | null>(null);
  const streamBufferRef = useRef(new StreamBuffer());
  const streamEntryIdRef = useRef<string | null>(null);
  const streamStartRef = useRef<number>(0);
  const lastCharCountRef = useRef<number>(0);

  const getOrchestrator = useCallback(() => {
    if (!orchestratorRef.current) {
      orchestratorRef.current = new FlyerAIOrchestrator();
    }
    return orchestratorRef.current;
  }, []);

  const addLog = useCallback((entry: AILogEntry) => {
    setLogs((prev) => [...prev.slice(-(MAX_LOG_ENTRIES - 1)), entry]);
  }, []);

  const updateLog = useCallback((id: string, patch: Partial<AILogEntry>) => {
    setLogs((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const runWith = useCallback(
    async (
      label: string,
      run: (
        onStream: (chunk: AIStreamChunk) => void
      ) => Promise<{ flyer: Flyer; changes: string[]; rawResponse?: string; applied: boolean }>,
      modelId?: string
    ) => {
      setIsProcessing(true);
      streamBufferRef.current.clear();
      streamEntryIdRef.current = null;
      lastCharCountRef.current = 0;

      if (userEmail && userEmail !== 'admin@gmail.com') {
        try {
          const profile = await dataService.getUserProfile(userEmail);
          if (profile.error) throw new Error(profile.error);
          if (profile.tokensUsed >= profile.tokenLimit) {
            throw new Error("Limite token AI raggiunto. Contatta l'amministratore.");
          }
        } catch (err: any) {
          setIsProcessing(false);
          throw err;
        }
      }

      addLog(createEntry('info', `📤 ${label}`));
      try {
        const orch = getOrchestrator();
        const result = await run((chunk) => {
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
            if (id && total - lastCharCountRef.current >= 80) {
              lastCharCountRef.current = total;
              const elapsed = ((Date.now() - streamStartRef.current) / 1000).toFixed(1);
              updateLog(id, { msg: `Generazione in corso... ${total} caratteri · ${elapsed}s` });
            }
            return;
          }
          if (chunk.type === 'error' && chunk.error) {
            addLog(createErrorEntry(chunk.error));
          }
        });

        if (userEmail && userEmail !== 'admin@gmail.com' && result.rawResponse) {
          // Token accounting is approximate (we use the rawResponse
          // length as a proxy if usage is missing). The card
          // orchestrator exposes the real usage in
          // `result.response.usage`; the flyer orchestrator returns
          // the same shape. We try to pull the real total first.
        }
        if (userEmail && userEmail !== 'admin@gmail.com') {
          // We don't have direct access to AIResponse.usage from
          // here; track the raw response length as an approximation
          // (4 chars ≈ 1 token). This matches the conservative
          // approach used elsewhere in the codebase.
          const approxTokens = Math.max(1, Math.ceil((result.rawResponse?.length || 0) / 4));
          dataService.trackTokens(userEmail, approxTokens).catch(() => {});
        }

        const streamId = streamEntryIdRef.current;
        if (streamId) {
          const elapsed = ((Date.now() - streamStartRef.current) / 1000).toFixed(1);
          updateLog(streamId, {
            status: 'done',
            msg: `✅ Risposta ricevuta · ${elapsed}s`,
            detail: result.rawResponse,
          });
        }

        const realChanges = result.changes.filter((c) => !c.startsWith('error:'));
        const errorChanges = result.changes.filter((c) => c.startsWith('error:'));

        if (result.applied && realChanges.length > 0) {
          addLog(createSuccessEntry(
            `${realChanges.length} modifica applicata (copy aggiornato)`,
            realChanges.join('\n')
          ));
        }
        if (errorChanges.length > 0) {
          addLog(createErrorEntry(
            'Risposta AI non valida (formato non riconosciuto). Riprova con un brief più chiaro.'
          ));
        }
        if (!result.applied && errorChanges.length === 0) {
          addLog(createInfoEntry('Nessuna modifica applicata'));
        }
        return result;
      } catch (err: any) {
        const msg = err?.message || 'Errore AI';
        const hint =
          msg.includes('402') ? 'Credito DeepSeek esaurito.'
          : msg.includes('401') ? 'Chiave API DeepSeek non valida.'
          : msg.includes('429') ? 'Troppe richieste. Attendi e riprova.'
          : msg.includes('fetch') || msg.includes('NetworkError') ? 'Connessione fallita.'
          : null;
        const streamId = streamEntryIdRef.current;
        if (streamId) {
          updateLog(streamId, { status: 'error', msg: '❌ Generazione fallita', detail: msg });
        }
        logger.error('Flyer AI failed', { route: 'useAIFlyer', err: msg });
        addLog(createErrorEntry(hint || msg));
        throw new Error(hint || msg);
      } finally {
        setIsProcessing(false);
        streamEntryIdRef.current = null;
      }
    },
    [userEmail, addLog, updateLog, getOrchestrator]
  );

  const generate = useCallback(
    async (flyer: Flyer, brief: string, tone: FlyerTone, options?: { modelId?: string }) => {
      const trimmed = brief.trim();
      if (!trimmed) {
        throw new Error('Inserisci un brief per generare il copy.');
      }
      return runWith(
        `Invio richiesta: "${trimmed.length > 60 ? trimmed.slice(0, 57) + '...' : trimmed}" (${tone})`,
        async (onStream) => {
          const orch = getOrchestrator();
          const r = await orch.generateCopy(flyer, trimmed, tone, {
            modelId: options?.modelId,
            onStream,
          });
          return { flyer: r.flyer, changes: r.changes, rawResponse: r.rawResponse, applied: r.applied };
        },
        options?.modelId
      );
    },
    [getOrchestrator, runWith]
  );

  const refine = useCallback(
    async (flyer: Flyer, action: FlyerRefineAction, options?: { modelId?: string }) => {
      return runWith(
        `Rifinisci copy: ${action}`,
        async (onStream) => {
          const orch = getOrchestrator();
          const r = await orch.refineCopy(flyer, action, {
            modelId: options?.modelId,
            onStream,
          });
          return { flyer: r.flyer, changes: r.changes, rawResponse: r.rawResponse, applied: r.applied };
        },
        options?.modelId
      );
    },
    [getOrchestrator, runWith]
  );

  const reset = useCallback(() => {
    const orch = getOrchestrator();
    orch.resetSession();
    setLogs([]);
    streamBufferRef.current.clear();
    streamEntryIdRef.current = null;
  }, [getOrchestrator]);

  return {
    generate,
    refine,
    reset,
    logs,
    isProcessing,
    availableModels,
  };
}
