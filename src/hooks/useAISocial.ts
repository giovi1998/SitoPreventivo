import { useRef, useCallback, useState } from 'react';
import {
  SocialAIOrchestrator,
  type SocialPost,
  type SocialProcessResult,
} from '../ai/socialOrchestrator';
import type { SocialSource, SocialTone } from '../ai/prompts/socialSystem';
import { createEntry } from '../ai/eventLog';
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

export function useAISocial(userEmail?: string): UseAISocialReturn {
  const orchestratorRef = useRef<SocialAIOrchestrator | null>(null);
  const [logs, setLogs] = useState<AILogEntry[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

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

  const generate = useCallback(
    async (source: SocialSource, tone: SocialTone, options?: { onProgress?: (msg: string) => void }) => {
      setIsProcessing(true);
      addLog(createEntry('info', 'social_ai_generate_start'));
      try {
        const result = await getOrchestrator().generatePosts(source, tone, {
          onStream: (chunk) => {
            if (chunk.type === 'content' && chunk.content) {
              addLog(createEntry('stream', chunk.content.slice(0, 200)));
            }
          },
          userEmail,
        });
        if (result.applied) {
          setPosts(result.posts);
          addLog(createEntry('success', `social_ai_generated:${result.posts.length}`));
        } else {
          addLog(createEntry('error', 'social_ai_failed', { detail: result.changes.join(',') }));
        }
        return result;
      } catch (err) {
        const msg = (err as Error)?.message || 'unknown';
        addLog(createEntry('error', 'social_ai_exception', { detail: msg.slice(0, 200) }));
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
    setPosts([]);
  }, []);

  return { generate, reset, logs, posts, isProcessing };
}
