import { useState, useRef, useCallback } from 'react';
import type { PremiumQuote } from '../utils/quoteSchema';
import type { AIStreamChunk, AILogEntry, ProcessResult } from '../ai/types';
import { AIOrchestrator } from '../ai/index';
import { StreamBuffer, summarizeMergeChanges, describeAIError } from '../ai/eventLog';
import dataService from '../utils/dataService';

interface UseAIReturn {
  processPrompt: (
    quote: PremiumQuote,
    prompt: string,
    options?: {
      modelId?: string;
      onProgress?: (msg: string) => void;
    }
  ) => Promise<ProcessResult>;
  resetChat: () => void;
  aiLogs: AILogEntry[];
  isProcessing: boolean;
  sessionId: string | null;
  availableModels: { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean }[];
  addLog: (type: AILogEntry['type'], msg: string) => void;
}

function parseResultChanges(changes: string[]): {
  toolCount: number;
  mergeChanges: string[];
  errorKind: 'empty' | 'not_json' | 'invalid_json' | null;
} {
  let toolCount = 0;
  const mergeChanges: string[] = [];
  let errorKind: 'empty' | 'not_json' | 'invalid_json' | null = null;

  for (const c of changes) {
    if (c.startsWith('tool:')) {
      toolCount++;
    } else if (c === 'error:empty') {
      errorKind = 'empty';
    } else if (c === 'error:not_json') {
      errorKind = 'not_json';
    } else if (c === 'error:invalid_json') {
      errorKind = 'invalid_json';
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

  const getOrchestrator = useCallback(() => {
    if (!orchestratorRef.current) {
      orchestratorRef.current = new AIOrchestrator();
    }
    return orchestratorRef.current;
  }, []);

  const addLog = useCallback((type: AILogEntry['type'], msg: string) => {
    setAiLogs((prev) => {
      const entry: AILogEntry = { type, msg, time: new Date().toLocaleTimeString('it-IT') };
      return [...prev.slice(-19), entry];
    });
  }, []);

  const processPrompt = useCallback(
    async (
      quote: PremiumQuote,
      prompt: string,
      options?: {
        modelId?: string;
        onProgress?: (msg: string) => void;
      }
    ): Promise<ProcessResult> => {
      if (!prompt.trim() && !options?.modelId) {
        throw new Error('Inserisci un prompt per l\'AI.');
      }

      setIsProcessing(true);

      if (userEmail && userEmail !== 'admin@gmail.com') {
        try {
          const profile = await dataService.getUserProfile(userEmail);
          if (profile.error) throw new Error(profile.error);
          if (profile.tokensUsed >= profile.tokenLimit) {
            throw new Error('Limite token AI raggiunto. Contatta l\'amministratore.');
          }
        } catch (err: any) {
          setIsProcessing(false);
          throw err;
        }
      }

      addLog('info', '→ Invio richiesta...');
      streamBufferRef.current.clear();
      startedToolsRef.current = new Set();

      try {
        const orchestrator = getOrchestrator();
        options?.onProgress?.('🤖 Chiamata AI in corso...');

        const result = await orchestrator.processPrompt(quote, prompt, {
          modelId: options?.modelId,
          onStream: (chunk: AIStreamChunk) => {
            if (chunk.type === 'content' && chunk.content) {
              streamBufferRef.current.append(chunk.content);
              return;
            }
            if (chunk.type === 'tool_call' && chunk.toolCall) {
              const { id, function: fn } = chunk.toolCall;
              if (!startedToolsRef.current.has(id)) {
                startedToolsRef.current.add(id);
                addLog('tool', `⚙ ${fn.name} — avviato`);
              }
              return;
            }
            if (chunk.type === 'error' && chunk.error) {
              addLog('error', chunk.error);
            }
          },
          onToolStart: (toolCallId, name) => {
            if (!startedToolsRef.current.has(toolCallId)) {
              startedToolsRef.current.add(toolCallId);
              addLog('tool', `⚙ ${name} — avviato`);
            }
          },
          onToolComplete: (_toolCallId, name, toolResult) => {
            if (toolResult) {
              addLog('info', toolResult);
            }
            addLog('tool', `⚙ ${name} — completato`);
          },
        });

        setSessionId(result.sessionId);

        if (userEmail && userEmail !== 'admin@gmail.com' && result.response.usage?.totalTokens) {
          dataService.trackTokens(userEmail, result.response.usage.totalTokens);
        }

        const { toolCount, mergeChanges, errorKind } = parseResultChanges(result.changes);
        const hasModifications = toolCount > 0 || mergeChanges.length > 0;

        if (errorKind) {
          addLog('error', describeAIError(errorKind));
        }

        if (mergeChanges.length > 0) {
          addLog('success', summarizeMergeChanges(mergeChanges));
        }

        if (!hasModifications && !errorKind) {
          // Fallback: se il preventivo effettivamente è cambiato ma le modifiche non sono state tracciate
          const quoteChanged = result.quote && JSON.stringify(result.quote) !== JSON.stringify(quote);
          addLog('info', quoteChanged ? 'Modifiche applicate (riepilogo non disponibile)' : 'Nessuna modifica applicata');
        }

        return result;
      } catch (err: any) {
        const hint =
          err.message?.includes('402')
            ? 'Credito DeepSeek esaurito.'
            : err.message?.includes('401')
            ? 'Chiave API DeepSeek non valida.'
            : err.message?.includes('429')
            ? 'Troppe richieste. Attendi e riprova.'
            : err.message?.includes('fetch') || err.message?.includes('NetworkError')
            ? 'Connessione fallita.'
            : null;

        addLog('error', hint || err.message);
        throw new Error(hint || err.message);
      } finally {
        setIsProcessing(false);
      }
    },
    [userEmail, addLog, getOrchestrator]
  );

  const resetChat = useCallback(() => {
    const orch = getOrchestrator();
    orch.resetSession();
    setSessionId(null);
    setAiLogs([]);
    streamBufferRef.current.clear();
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
