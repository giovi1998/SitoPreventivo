import { useState, useRef, useCallback } from 'react';
import type { PremiumQuote } from '../utils/quoteSchema';
import type { AIStreamChunk, AILogEntry, ProcessResult } from '../ai/types';
import { AIOrchestrator } from '../ai/index';
import {
  StreamBuffer,
  summarizeMergeChanges,
  describeAIError,
  createStreamEntry,
  createEntry,
  createErrorEntry,
  createSuccessEntry,
  createToolEntry,
  createInfoEntry,
} from '../ai/eventLog';
import { formatToolCall, formatToolResult } from '../ai/toolLabels';
import dataService from '../utils/dataService';
import { logger } from '../utils/logger';

interface UseAIReturn {
  processPrompt: (
    quote: PremiumQuote,
    prompt: string,
    options?: {
      modelId?: string;
      onProgress?: (msg: string) => void;
      onStream?: (chunk: AIStreamChunk) => void;
    }
  ) => Promise<ProcessResult>;
  resetChat: () => void;
  aiLogs: AILogEntry[];
  isProcessing: boolean;
  sessionId: string | null;
  availableModels: { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean }[];
  addLog: (entry: AILogEntry) => void;
}

const MAX_LOG_ENTRIES = 40;

function parseResultChanges(changes: string[]): {
  toolCount: number;
  mergeChanges: string[];
  errorKind: 'empty' | 'not_json' | 'invalid_json' | 'followup_not_json' | 'followup_failed' | null;
} {
  let toolCount = 0;
  const mergeChanges: string[] = [];
  let errorKind: 'empty' | 'not_json' | 'invalid_json' | 'followup_not_json' | 'followup_failed' | null = null;

  for (const c of changes) {
    if (c.startsWith('tool:')) {
      toolCount++;
    } else if (c === 'error:empty') {
      errorKind = 'empty';
    } else if (c === 'error:not_json') {
      errorKind = 'not_json';
    } else if (c === 'error:invalid_json') {
      errorKind = 'invalid_json';
    } else if (c === 'error:followup_not_json') {
      errorKind = 'followup_not_json';
    } else if (c.startsWith('error:followup_failed')) {
      errorKind = 'followup_failed';
    } else {
      mergeChanges.push(c);
    }
  }

  return { toolCount, mergeChanges, errorKind };
}

export function useAI(userEmail?: string): UseAIReturn {
  const [aiLogs, setAiLogs] = useState<AILogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [availableModels] = useState(() => {
    const orch = new AIOrchestrator();
    return orch.getProviderList();
  });

  const orchestratorRef = useRef<AIOrchestrator | null>(null);
  const streamBufferRef = useRef(new StreamBuffer());
  const startedToolsRef = useRef<Set<string>>(new Set());
  const toolStartRef = useRef<Map<string, number>>(new Map());
  const streamEntryIdRef = useRef<string | null>(null);
  const streamStartRef = useRef<number>(0);
  const lastCharCountRef = useRef<number>(0);

  const getOrchestrator = useCallback(() => {
    if (!orchestratorRef.current) {
      orchestratorRef.current = new AIOrchestrator();
    }
    return orchestratorRef.current;
  }, []);

  const addLog = useCallback((entry: AILogEntry) => {
    setAiLogs((prev) => [...prev.slice(-(MAX_LOG_ENTRIES - 1)), entry]);
  }, []);

  const updateLog = useCallback((id: string, patch: Partial<AILogEntry>) => {
    setAiLogs((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const processPrompt = useCallback(
    async (
      quote: PremiumQuote,
      prompt: string,
      options?: {
        modelId?: string;
        onProgress?: (msg: string) => void;
        onStream?: (chunk: AIStreamChunk) => void;
      }
    ): Promise<ProcessResult> => {
      if (!prompt.trim() && !options?.modelId) {
        throw new Error("Inserisci un prompt per l'AI.");
      }

      setIsProcessing(true);

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

      addLog(createInfoEntry('📤 Invio richiesta...'));
      streamBufferRef.current.clear();
      startedToolsRef.current = new Set();
      toolStartRef.current = new Map();
      streamEntryIdRef.current = null;
      lastCharCountRef.current = 0;

      try {
        const orchestrator = getOrchestrator();
        options?.onProgress?.('🤖 Chiamata AI in corso...');

        const result = await orchestrator.processPrompt(quote, prompt, {
          modelId: options?.modelId,
          onStream: (chunk: AIStreamChunk) => {
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
            if (chunk.type === 'tool_call' && chunk.toolCall) {
              const { id, function: fn } = chunk.toolCall;
              if (!startedToolsRef.current.has(id)) {
                startedToolsRef.current.add(id);
                toolStartRef.current.set(id, Date.now());
                addLog(createToolEntry(`⚙ ${formatToolCall(fn.name, safeJson(fn.arguments))} — avviato`));
              }
              return;
            }
            if (chunk.type === 'error' && chunk.error) {
              addLog(createErrorEntry(chunk.error));
            }
          },
          onToolStart: (toolCallId, name) => {
            if (!startedToolsRef.current.has(toolCallId)) {
              startedToolsRef.current.add(toolCallId);
              toolStartRef.current.set(toolCallId, Date.now());
              addLog(createToolEntry(`⚙ ${name} — avviato`));
            }
          },
          onToolComplete: (toolCallId, name, toolResult) => {
            const start = toolStartRef.current.get(toolCallId);
            const durationMs = start ? Date.now() - start : undefined;
            addLog(createToolEntry(`⚙ ${formatToolResult(toolResult, name)} — fatto`, durationMs));
          },
        });

        setSessionId(result.sessionId);

        if (userEmail && userEmail !== 'admin@gmail.com' && result.response.usage?.totalTokens) {
          dataService.trackTokens(userEmail, result.response.usage.totalTokens);
        }

        const streamId = streamEntryIdRef.current;
        if (streamId) {
          const elapsed = ((Date.now() - streamStartRef.current) / 1000).toFixed(1);
          const tokens = result.response.usage?.totalTokens ?? 0;
          updateLog(streamId, {
            status: 'done',
            msg: `✅ Risposta ricevuta — ${tokens.toLocaleString('it-IT')} token · ${elapsed}s`,
            detail: result.rawResponse,
          });
        }

        const { toolCount, mergeChanges, errorKind } = parseResultChanges(result.changes);
        const hasModifications = toolCount > 0 || mergeChanges.length > 0;

        if (errorKind) {
          addLog(createErrorEntry(describeAIError(errorKind)));
        }

        if (mergeChanges.length > 0) {
          addLog(createSuccessEntry(summarizeMergeChanges(mergeChanges)));
        }

        if (!hasModifications && !errorKind) {
          const quoteChanged = result.quote && JSON.stringify(result.quote) !== JSON.stringify(quote);
          addLog(createInfoEntry(quoteChanged ? 'Modifiche applicate (riepilogo non disponibile)' : 'Nessuna modifica applicata'));
        }

        return result;
      } catch (err: any) {
        const msg = err.message || 'Errore AI';
        const hint =
          msg.includes('402')
            ? 'Credito DeepSeek esaurito.'
            : msg.includes('401')
            ? 'Chiave API DeepSeek non valida.'
            : msg.includes('429')
            ? 'Troppe richieste. Attendi e riprova.'
            : msg.includes('fetch') || msg.includes('NetworkError')
            ? 'Connessione fallita.'
            : null;

        const streamId = streamEntryIdRef.current;
        if (streamId) {
          updateLog(streamId, { status: 'error', msg: '❌ Generazione fallita', detail: msg });
        }
        logger.error('AI processPrompt failed', { route: 'useAI', err: msg });
        addLog(createErrorEntry(hint || msg));
        throw new Error(hint || msg);
      } finally {
        setIsProcessing(false);
        streamEntryIdRef.current = null;
      }
    },
    [userEmail, addLog, getOrchestrator, updateLog]
  );

  const resetChat = useCallback(() => {
    const orch = getOrchestrator();
    orch.resetSession();
    setSessionId(null);
    setAiLogs([]);
    streamBufferRef.current.clear();
    streamEntryIdRef.current = null;
  }, [getOrchestrator]);

  return {
    processPrompt,
    resetChat,
    aiLogs,
    isProcessing,
    sessionId,
    availableModels,
    addLog,
  };
}

function safeJson(s: string | undefined): Record<string, unknown> {
  if (!s) return {};
  try {
    const parsed = JSON.parse(s);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
