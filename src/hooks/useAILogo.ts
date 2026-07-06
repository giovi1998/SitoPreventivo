import { useRef, useCallback, useState } from 'react';
import type { Logo } from '../utils/documentSchemas';
import { LogoAIOrchestrator, type LogoProcessResult } from '../ai/logoOrchestrator';
import {
  StreamBuffer,
  createEntry,
  createStreamEntry,
  createErrorEntry,
  createSuccessEntry,
  createInfoEntry,
} from '../ai/eventLog';
import type { AILogEntry } from '../ai/types';

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
  logs: AILogEntry[];
  isProcessing: boolean;
  isGeneratingBg: boolean;
  availableModels: { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean }[];
}

const MAX_LOG_ENTRIES = 40;
const STREAM_UPDATE_THRESHOLD = 80; // chars

export function useAILogo(userEmail?: string): UseAILogoReturn {
  const orchestratorRef = useRef<LogoAIOrchestrator | null>(null);
  const [logs, setLogs] = useState<AILogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingBg, setIsGeneratingBg] = useState(false);
  const streamBufferRef = useRef(new StreamBuffer());
  const streamEntryIdRef = useRef<string | null>(null);
  const lastCharCountRef = useRef(0);
  const streamStartRef = useRef(0);

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

  const updateLog = useCallback((id: string, patch: Partial<AILogEntry>) => {
    setLogs((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );
  }, []);

  const generate = useCallback(
    async (logo: Logo, brief: string, options?: { sector?: string; onProgress?: (msg: string) => void }) => {
      setIsProcessing(true);
      const promptPreview = brief.length > 60 ? brief.slice(0, 57) + '...' : brief;
      addLog(createEntry('info', `Invio richiesta: "${promptPreview}"`, { detail: brief }));
      streamBufferRef.current.clear();
      streamEntryIdRef.current = null;
      lastCharCountRef.current = 0;

      try {
        const result = await getOrchestrator().generateLogo(logo, brief, {
          sector: options?.sector,
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

        // Completa la stream entry
        if (streamEntryIdRef.current) {
          const total = streamBufferRef.current.getRaw().length;
          const elapsed = ((Date.now() - streamStartRef.current) / 1000).toFixed(1);
          updateLog(streamEntryIdRef.current, {
            msg: `Risposta ricevuta · ${total} caratteri · ${elapsed}s`,
            status: 'done',
          });
        }

        if (result.applied) {
          const summary = [
            `Testo: ${result.logo.builder.primaryText || '(vuoto)'}`,
            `Icona: ${result.logo.builder.iconType}`,
            `Layout: ${result.logo.builder.layout}`,
            `Colori: ${result.logo.builder.primaryColor} + ${result.logo.builder.secondaryColor}`,
          ].join(' · ');
          addLog(createSuccessEntry('Logo generato', summary));
        } else {
          addLog(createErrorEntry('AI non ha restituito parametri validi', result.changes.join(',')));
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

  const generateBackground = useCallback(
    async (logo: Logo, context: { activity: string; mood: string; target: string; imagePrompt?: string }) => {
      setIsGeneratingBg(true);
      const promptPreview = context.imagePrompt ? context.imagePrompt.slice(0, 50) + '...' : `activity="${context.activity.slice(0, 40)}"`;
      addLog(createEntry('info', `Background AI: ${promptPreview}`));
      try {
        const result = await getOrchestrator().generateBackground(logo, context, { userEmail });
        if (result.applied) {
          addLog(createSuccessEntry('Background generato', `${result.logo.builder.backgroundImage?.length ?? 0} char base64`));
        } else {
          addLog(createErrorEntry('Background non generato', result.error ?? 'unknown'));
        }
        return result;
      } catch (err) {
        const msg = (err as Error)?.message || 'unknown';
        addLog(createErrorEntry(`Errore background: ${msg.slice(0, 200)}`));
        throw err;
      } finally {
        setIsGeneratingBg(false);
      }
    },
    [addLog, userEmail],
  );

  const reset = useCallback(() => {
    getOrchestrator().resetSession();
    setLogs([]);
    streamBufferRef.current.clear();
    streamEntryIdRef.current = null;
  }, []);

  return { generate, generateBackground, reset, logs, isProcessing, isGeneratingBg, availableModels };
}