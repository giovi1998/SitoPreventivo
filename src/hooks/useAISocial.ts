import { useRef, useCallback, useState } from 'react';
import {
  SocialAIOrchestrator,
  type SocialPost,
  type SocialProcessResult,
} from '../ai/socialOrchestrator';
import type { SocialSource, SocialTone } from '../ai/prompts/socialSystem';
import {
  StreamBuffer,
  createEntry,
  createStreamEntry,
  createErrorEntry,
  createSuccessEntry,
} from '../ai/eventLog';
import type { AILogEntry } from '../ai/types';

export interface UseAISocialReturn {
  generate: (
    source: SocialSource,
    tone: SocialTone,
    options?: { onProgress?: (msg: string) => void },
  ) => Promise<SocialProcessResult>;
  reset: () => void;
  logs: AILogEntry[];
  posts: SocialPost[];
  isProcessing: boolean;
}

const MAX_LOG_ENTRIES = 40;
const STREAM_UPDATE_THRESHOLD = 80;

export function useAISocial(userEmail?: string): UseAISocialReturn {
  const orchestratorRef = useRef<SocialAIOrchestrator | null>(null);
  const [logs, setLogs] = useState<AILogEntry[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const streamBufferRef = useRef(new StreamBuffer());
  const streamEntryIdRef = useRef<string | null>(null);
  const lastCharCountRef = useRef(0);
  const streamStartRef = useRef(0);

  const getOrchestrator = (): SocialAIOrchestrator => {
    if (!orchestratorRef.current) orchestratorRef.current = new SocialAIOrchestrator();
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

  const generate = useCallback(
    async (source: SocialSource, tone: SocialTone, options?: { onProgress?: (msg: string) => void }) => {
      setIsProcessing(true);
      const label = source.type === 'card'
        ? `card "${source.data.name}"`
        : `flyer "${source.data.headline}"`;
      addLog(createEntry('info', `Invio richiesta: 3 post da ${label}, tone=${tone}`));
      streamBufferRef.current.clear();
      streamEntryIdRef.current = null;
      lastCharCountRef.current = 0;

      try {
        const result = await getOrchestrator().generatePosts(source, tone, {
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
          setPosts(result.posts);
          const platforms = result.posts.map((p) => p.platform).join(', ');
          addLog(createSuccessEntry(`${result.posts.length} post generati`, platforms));
        } else {
          addLog(createErrorEntry('AI non ha generato post validi', result.changes.join(',')));
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
    setPosts([]);
    streamBufferRef.current.clear();
    streamEntryIdRef.current = null;
  }, []);

  return { generate, reset, logs, posts, isProcessing };
}