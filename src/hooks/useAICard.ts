import { useState, useRef, useCallback } from 'react';
import type { BusinessCard } from '../utils/documentSchemas';
import type { AIStreamChunk, AILogEntry } from '../ai/types';
import { CardAIOrchestrator } from '../ai/cardOrchestrator';
import {
  StreamBuffer,
  createEntry,
  createStreamEntry,
  createErrorEntry,
  createSuccessEntry,
  createInfoEntry,
} from '../ai/eventLog';
import dataService from '../utils/dataService';
import { buildCardCoverBrief } from '../utils/card/coverBrief';
import {
  buildCardCoverPayload,
  renderCardCoverScreenshot,
  resolveCardCoverLogo,
} from '../utils/card/coverImage';
import { logger } from '../utils/logger';
import { isLocalhost } from '../utils/env';
import { mapAiError } from '../utils/ai/mapAiError';
import { buildCardPhotoBrief } from '../utils/card/photoBrief';

const MAX_LOG_ENTRIES = 40;

interface UseAICardReturn {
  processCardPrompt: (
    card: BusinessCard,
    prompt: string,
    options?: {
      modelId?: string;
      onProgress?: (msg: string) => void;
      onStream?: (chunk: AIStreamChunk) => void;
    }
  ) => Promise<{
    card: BusinessCard;
    changes: string[];
    rawResponse?: string;
  }>;
  // Spec v2.4: generate an AI cover image for the front or back of the card.
  generateCover: (
    card: BusinessCard,
    side?: 'front' | 'back',
    prompt?: string,
    options?: { onProgress?: (msg: string) => void }
  ) => Promise<string>;
  /** Profession-style illustration that replaces the portrait photo. */
  generatePhoto: (
    card: BusinessCard,
    options?: { promptOverride?: string; onProgress?: (msg: string) => void }
  ) => Promise<string>;
  resetCardChat: () => void;
  cardAiLogs: AILogEntry[];
  isCardProcessing: boolean;
  availableModels: { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean }[];
}

export function useAICard(userEmail?: string): UseAICardReturn {
  const [cardAiLogs, setCardAiLogs] = useState<AILogEntry[]>([]);
  const [isCardProcessing, setIsCardProcessing] = useState(false);
  const [availableModels] = useState(() => {
    const orch = new CardAIOrchestrator();
    return orch.getProviderList();
  });

  const orchestratorRef = useRef<CardAIOrchestrator | null>(null);
  const streamBufferRef = useRef(new StreamBuffer());
  const streamEntryIdRef = useRef<string | null>(null);
  const streamStartRef = useRef<number>(0);
  const lastCharCountRef = useRef<number>(0);

  const getOrchestrator = useCallback(() => {
    if (!orchestratorRef.current) {
      orchestratorRef.current = new CardAIOrchestrator();
    }
    return orchestratorRef.current;
  }, []);

  const addLog = useCallback((entry: AILogEntry) => {
    setCardAiLogs((prev) => [...prev.slice(-(MAX_LOG_ENTRIES - 1)), entry]);
  }, []);

  const updateLog = useCallback((id: string, patch: Partial<AILogEntry>) => {
    setCardAiLogs((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const processCardPrompt = useCallback(
    async (
      card: BusinessCard,
      prompt: string,
      options?: {
        modelId?: string;
        onProgress?: (msg: string) => void;
        onStream?: (chunk: AIStreamChunk) => void;
      }
    ) => {
      if (!prompt.trim()) {
        throw new Error("Inserisci un prompt per l'AI.");
      }

      setIsCardProcessing(true);

      // Token check (skip for admin and localhost)
      if (userEmail && userEmail !== 'admin@gmail.com' && !isLocalhost()) {
        try {
          const profile = await dataService.getUserProfile(userEmail);
          if (profile.error) {
            throw new Error(profile.error);
          } else if (profile.tokensUsed >= profile.tokenLimit) {
            throw new Error("Limite token AI raggiunto. Contatta l'amministratore.");
          }
        } catch (err: any) {
          setIsCardProcessing(false);
          throw err;
        }
      }

      const promptPreview = prompt.length > 60 ? prompt.slice(0, 57) + '...' : prompt;
      addLog(createEntry('info', `📤 Invio richiesta: "${promptPreview}"`, { detail: prompt }));
      streamBufferRef.current.clear();
      streamEntryIdRef.current = null;
      lastCharCountRef.current = 0;

      try {
        const orchestrator = getOrchestrator();
        options?.onProgress?.('🤖 Chiamata AI in corso...');

        const result = await orchestrator.processPrompt(card, prompt, {
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
              options?.onStream?.(chunk);
              return;
            }
            if (chunk.type === 'error' && chunk.error) {
              addLog(createErrorEntry(chunk.error));
            }
            options?.onStream?.(chunk);
          },
        });

        // Track tokens
        if (userEmail && userEmail !== 'admin@gmail.com' && result.response.usage?.totalTokens) {
          dataService.trackTokens(userEmail, result.response.usage.totalTokens);
        }

        // Finalize stream entry
        const streamId = streamEntryIdRef.current;
        if (streamId) {
          const elapsed = ((Date.now() - streamStartRef.current) / 1000).toFixed(1);
          const tokens = result.response.usage?.totalTokens ?? 0;
          updateLog(streamId, {
            status: 'done',
            msg: `✅ Risposta ricevuta, ${tokens.toLocaleString('it-IT')} token · ${elapsed}s`,
            detail: result.rawResponse,
          });
        }

        // Log changes
        const realChanges = result.changes.filter((c: string) => !c.startsWith('error:'));
        const errorChanges = result.changes.filter((c: string) => c.startsWith('error:'));

        if (realChanges.length > 0) {
          const changeList = realChanges.map((c: string) => `• ${c}`).join('\n');
          addLog(createSuccessEntry(
            `${realChanges.length} modifica${realChanges.length > 1 ? 'e' : ''} applicata${realChanges.length > 1 ? 'e' : ''}`,
            changeList
          ));
        }

        if (errorChanges.length > 0) {
          addLog(createErrorEntry('Alcune modifiche non sono state applicate (formato non valido)'));
        }

        if (realChanges.length === 0 && errorChanges.length === 0) {
          const aiText = (result.rawResponse || '').trim();
          if (aiText) {
            addLog(createInfoEntry(aiText));
          } else {
            addLog(createInfoEntry('Nessuna modifica applicata'));
          }
        }

        return {
          card: result.card,
          changes: result.changes,
          rawResponse: result.rawResponse,
        };
      } catch (err: any) {
        const msg = err.message || 'Errore AI';
        const hint = mapAiError(err);

        const streamId = streamEntryIdRef.current;
        if (streamId) {
          updateLog(streamId, { status: 'error', msg: '❌ Generazione fallita', detail: msg });
        }
        logger.error('Card AI processPrompt failed', { route: 'useAICard', err: msg });
        addLog(createErrorEntry(hint));
        throw new Error(hint);
      } finally {
        setIsCardProcessing(false);
        streamEntryIdRef.current = null;
      }
    },
    [userEmail, addLog, getOrchestrator, updateLog]
  );

  const resetCardChat = useCallback(() => {
    const orch = getOrchestrator();
    orch.resetSession();
    setCardAiLogs([]);
    streamBufferRef.current.clear();
    streamEntryIdRef.current = null;
  }, [getOrchestrator]);

  const generateCover = useCallback(
    async (card: BusinessCard, side: 'front' | 'back' = 'front', promptOverride?: string, options?: { onProgress?: (msg: string) => void }) => {
      if (userEmail && userEmail !== 'admin@gmail.com' && !isLocalhost()) {
        const profile = await dataService.getUserProfile(userEmail);
        if (profile.error) throw new Error(profile.error);
        if (profile.tokensUsed >= profile.tokenLimit) {
          throw new Error("Limite token AI raggiunto. Contatta l'amministratore.");
        }
      }

      const { prompt: coverPrompt, context: coverContext } =
        promptOverride ? { prompt: promptOverride, context: '' } : buildCardCoverBrief(card, side);

      addLog(createEntry('info', `🎨 Generazione cover AI in corso (${side})...`, { detail: coverPrompt }));
      options?.onProgress?.(`🎨 Generazione cover AI in corso (${side})...`);

      try {
        const [cardImage, logoImage] = await Promise.all([
          renderCardCoverScreenshot(card, side),
          side === 'front' ? resolveCardCoverLogo(card) : Promise.resolve(undefined),
        ]);

        const payload = buildCardCoverPayload(coverPrompt, coverContext, { cardImage, logoImage }, side, userEmail);

        const apiBase = import.meta.env?.VITE_API_BASE || '';
        const res = await fetch(`${apiBase}/api/ai/card-cover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Errore generazione cover' }));
          throw new Error(err.error || `Cover AI ${res.status}`);
        }

        const { data } = (await res.json()) as { data: { imageBase64: string; mimeType: string } };
        addLog(createSuccessEntry(`Cover AI (${side}) generata`, `${data.mimeType}, ${Math.round(data.imageBase64.length * 0.75 / 1024)}KB`));
        return `data:${data.mimeType};base64,${data.imageBase64}`;
      } catch (err: any) {
        const hint = mapAiError(err);
        logger.error('Card AI generateCover failed', { route: 'useAICard.generateCover', err: err?.message });
        addLog(createErrorEntry(`❌ ${hint}`));
        throw new Error(hint);
      }
    },
    [userEmail, addLog]
  );

  const generatePhoto = useCallback(
    async (card: BusinessCard, options?: { promptOverride?: string; onProgress?: (msg: string) => void }) => {
      if (userEmail && userEmail !== 'admin@gmail.com' && !isLocalhost()) {
        const profile = await dataService.getUserProfile(userEmail);
        if (profile.error) throw new Error(profile.error);
        if (profile.tokensUsed >= profile.tokenLimit) {
          throw new Error("Limite token AI raggiunto. Contatta l'amministratore.");
        }
      }

      const brief = buildCardPhotoBrief(card);
      const override = options?.promptOverride?.trim();
      const prompt = override && override.length > 0 ? override.slice(0, 1000) : brief.prompt;
      const context = override && override.length > 0 ? '' : brief.context;
      addLog(createEntry('info', '🖼️ Generazione foto AI in corso...', { detail: prompt }));
      options?.onProgress?.('🖼️ Generazione foto AI in corso...');

      try {
        const apiBase = import.meta.env?.VITE_API_BASE || '';
        const res = await fetch(`${apiBase}/api/ai/card-photo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            context: context || undefined,
            userEmail: userEmail || undefined,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `Errore generazione foto (${res.status})` }));
          throw new Error(err.error || `Photo AI ${res.status}`);
        }

        const { data } = (await res.json()) as { data: { imageBase64: string; mimeType: string } };
        addLog(createSuccessEntry(
          'Foto AI generata',
          `${data.mimeType}, ${Math.round(data.imageBase64.length * 0.75 / 1024)}KB`,
        ));
        return `data:${data.mimeType};base64,${data.imageBase64}`;
      } catch (err: any) {
        const hint = mapAiError(err);
        logger.error('Card AI generatePhoto failed', { route: 'useAICard.generatePhoto', err: err?.message });
        addLog(createErrorEntry(`❌ ${hint}`));
        throw new Error(hint);
      }
    },
    [userEmail, addLog]
  );

  return {
    processCardPrompt,
    generateCover,
    generatePhoto,
    resetCardChat,
    cardAiLogs,
    isCardProcessing,
    availableModels,
  };
}
