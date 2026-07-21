import { useRef, useCallback, useState } from 'react';
import type { PremiumQuote } from '../utils/quoteSchema';
import type { AIStreamChunk } from '../ai/types';
import { AIOrchestrator } from '../ai/index';
import { useAILogs } from './useAILogs';
import { formatToolCall, formatToolResult } from '../ai/toolLabels';
import dataService from '../utils/dataService';
import { logger } from '../utils/logger';
import { mapAiError } from '../utils/ai/mapAiError';
import { newRequestId } from '../utils/ai/requestId';
import { resolveProviderId } from '../utils/resolveProviderId';
import { calculateCostUsd } from '../ai/providerPricing';

interface UseAIReturn {
  processPrompt: (
    quote: PremiumQuote,
    prompt: string,
    options?: {
      modelId?: string;
      onProgress?: (msg: string) => void;
      onStream?: (chunk: AIStreamChunk) => void;
    }
  ) => ReturnType<AIOrchestrator['processPrompt']>;
  resetChat: () => void;
  aiLogs: ReturnType<typeof useAILogs>['logs'];
  isProcessing: boolean;
  sessionId: string | null;
  availableModels: { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean; supportsVision: boolean }[];
  lastCostUsd: number;
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

function describeAIError(errorKind: string): string {
  switch (errorKind) {
    case 'empty':
      return 'La risposta AI è vuota: riprova con un prompt più specifico.';
    case 'not_json':
    case 'invalid_json':
    case 'followup_not_json':
      return 'La risposta AI non era nel formato previsto. Riprova con un prompt più specifico.';
    case 'followup_failed':
      return "L'elaborazione della risposta AI è fallita. Riprova.";
    case 'invalid_quote':
      return "I dati inviati all'AI non sono validi. Controlla il preventivo.";
    default:
      return "Errore durante l'elaborazione AI.";
  }
}

function parseResultChanges(changes: string[]): {
  toolCount: number;
  mergeChanges: string[];
  errorKind: 'empty' | 'not_json' | 'invalid_json' | 'followup_not_json' | 'followup_failed' | 'invalid_quote' | 'other_error' | null;
} {
  let toolCount = 0;
  const mergeChanges: string[] = [];
  let errorKind: ReturnType<typeof parseResultChanges>['errorKind'] = null;

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
    } else if (c.startsWith('error:invalid_quote')) {
      errorKind = 'invalid_quote';
    } else if (c.startsWith('error:')) {
      errorKind = 'other_error';
    } else {
      mergeChanges.push(c);
    }
  }

  return { toolCount, mergeChanges, errorKind };
}

export function useAI(userEmail?: string): UseAIReturn {
  const orchestratorRef = useRef<AIOrchestrator | null>(null);
  const { logs: aiLogs, isProcessing, startStream, appendStream, finalizeStream, info, success, error, tool, clear } = useAILogs('useAI');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastCostUsd, setLastCostUsd] = useState(0);
  const availableModels = useRef(new AIOrchestrator().getProviderList()).current;

  const getOrchestrator = useCallback(() => {
    if (!orchestratorRef.current) orchestratorRef.current = new AIOrchestrator();
    return orchestratorRef.current;
  }, []);

  const updateSessionId = useCallback(() => setSessionId(getOrchestrator().getCurrentSessionId()), [getOrchestrator]);

  const processPrompt = useCallback(
    async (
      quote: PremiumQuote,
      prompt: string,
      options?: {
        modelId?: string;
        onProgress?: (msg: string) => void;
        onStream?: (chunk: AIStreamChunk) => void;
      }
    ) => {
      if (!prompt.trim() && !options?.modelId) throw new Error("Inserisci un prompt per l'AI.");
      const requestId = newRequestId();

      if (userEmail && userEmail !== 'admin@gmail.com') {
        const profile = await dataService.getUserProfile(userEmail);
        if (profile.error) throw new Error(profile.error);
        if (profile.tokensUsed >= profile.tokenLimit) {
          throw new Error("Limite token AI raggiunto. Contatta l'amministratore.");
        }
      }

      const promptPreview = prompt.length > 60 ? prompt.slice(0, 57) + '...' : prompt;

      // TB-023: cattura screenshot preview per vision/analysis mode quando presente un elemento quote.
      let previewBase64: string | undefined;
      try {
        const previewEl = document.querySelector<HTMLElement>('[data-quote-preview]');
        if (previewEl) {
          const { captureElementAsBase64 } = await import('../utils/ai/captureElement');
          previewBase64 = await captureElementAsBase64(previewEl, { maxWidth: 1024, quality: 0.8, type: 'image/jpeg' }) ?? undefined;
        }
      } catch {
        previewBase64 = undefined;
      }

      info(`Invio richiesta: "${promptPreview}"`, prompt, { requestId, hasImage: !!previewBase64, imagePreviewBase64: previewBase64 });
      const streamId = startStream('Generazione in corso…', { requestId });

      try {
        const orchestrator = getOrchestrator();
        options?.onProgress?.('🤖 Chiamata AI in corso...');

        const resolvedModelId = resolveProviderId(options?.modelId);
        const run = async (onStream?: (chunk: AIStreamChunk) => void) => orchestrator.processPrompt(quote, prompt, {
          modelId: resolvedModelId,
          requestId,
          imagePreviewBase64: previewBase64,
          onStream,
          onToolStart: (toolCallId, name) => {
            tool(`⚙ ${name}, avviato`);
          },
          onToolComplete: (toolCallId, name, toolResult) => {
            tool(`⚙ ${formatToolResult(toolResult, name)}, fatto`);
          },
        });

        let result = await run((chunk) => {
          if (chunk.type === 'content' && chunk.content) {
            appendStream(streamId, chunk.content);
          } else if (chunk.type === 'tool_call' && chunk.toolCall) {
            tool(`⚙ ${formatToolCall(chunk.toolCall.function.name, safeJson(chunk.toolCall.function.arguments))}, avviato`);
          }
          options?.onStream?.(chunk);
        });

        const resultIsEmpty = !result.response?.content && (!result.response?.toolCalls || result.response.toolCalls.length === 0);
        if (resultIsEmpty) {
          info('⚠ Prima risposta vuota. Riprovo con prompt semplificato…', undefined, { requestId });
          const retryStreamId = startStream('Riprovo con prompt semplificato…', { requestId });
          result = await run((chunk) => {
            if (chunk.type === 'content' && chunk.content) appendStream(retryStreamId, chunk.content);
          });
          finalizeStream(retryStreamId, true, { detail: result.rawResponse?.slice(0, 2048) });
        }

        const tokens = result.response.usage
          ? { prompt: result.response.usage.promptTokens, completion: result.response.usage.completionTokens, total: result.response.usage.totalTokens }
          : undefined;
        const costUsd = tokens ? calculateCostUsd(resolvedModelId, result.response.usage) : 0;
        updateSessionId();
        finalizeStream(streamId, true, { tokens, costUsd, modelId: resolvedModelId, requestId, detail: result.rawResponse?.slice(0, 2048), hasImage: !!previewBase64, imagePreviewBase64: previewBase64 });

        if (userEmail && userEmail !== 'admin@gmail.com' && result.response.usage?.totalTokens) {
          setLastCostUsd(costUsd);
          dataService.trackTokens(userEmail, result.response.usage.totalTokens, costUsd);
        }

        const { toolCount, mergeChanges, errorKind } = parseResultChanges(result.changes);
        const hasRealModifications = mergeChanges.length > 0;

        if (errorKind) {
          error(describeAIError(errorKind), undefined, { requestId });
        }
        if (hasRealModifications) {
          const changeList = mergeChanges.map((c) => `• ${c}`).join('\n');
          success(`${mergeChanges.length} modifica${mergeChanges.length > 1 ? 'e' : ''} applicata${mergeChanges.length > 1 ? 'e' : ''}`, changeList, { requestId });
        } else if (toolCount === 0 && !errorKind) {
          // Modalita' analisi: il testo completo e' gia' nel dettaglio dello stream.
          info('Risposta AI ricevuta (vedi dettaglio sopra)', undefined, { requestId });
        }

        return result;
      } catch (err: any) {
        const msg = err.message || 'Errore AI';
        const hint = mapAiError(err);
        finalizeStream(streamId, false, { errorMsg: msg });
        logger.error('AI processPrompt failed', { route: 'useAI', err: msg });
        throw new Error(hint);
      }
    },
    [userEmail, info, startStream, appendStream, finalizeStream, success, error, tool, getOrchestrator, updateSessionId]
  );

  const resetChat = useCallback(() => {
    getOrchestrator().resetSession();
    setSessionId(null);
    clear();
  }, [getOrchestrator, clear]);

  return {
    processPrompt,
    resetChat,
    aiLogs,
    isProcessing,
    sessionId,
    availableModels,
    lastCostUsd,
  };
}
