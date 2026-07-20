import { useRef, useCallback, useState } from 'react';
import type { BusinessCard } from '../utils/documentSchemas';
import type { AIStreamChunk } from '../ai/types';
import { CardAIOrchestrator } from '../ai/cardOrchestrator';
import { useAILogs } from './useAILogs';
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
import { newRequestId } from '../utils/ai/requestId';
import { IMAGE_TOKEN_COST } from '../ai/costs';
import { resolveProviderId } from '../utils/resolveProviderId';
import { calculateCostUsd } from '../ai/providerPricing';
import { getAiImageModelDefault } from '../utils/uiPrefs';

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
  generateCover: (
    card: BusinessCard,
    side?: 'front' | 'back',
    prompt?: string,
    options?: { onProgress?: (msg: string) => void; imageModel?: string }
  ) => Promise<string>;
  generatePhoto: (
    card: BusinessCard,
    options?: { promptOverride?: string; onProgress?: (msg: string) => void; imageModel?: string }
  ) => Promise<string>;
  resetCardChat: () => void;
  cardAiLogs: ReturnType<typeof useAILogs>['logs'];
  isCardProcessing: boolean;
  availableModels: { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean; supportsVision: boolean }[];
  lastCostUsd: number;
}

export function useAICard(userEmail?: string): UseAICardReturn {
  const { logs: cardAiLogs, isProcessing: isCardProcessing, startStream, appendStream, finalizeStream, info, success, error, clear } = useAILogs('useAICard');
  const [lastCostUsd, setLastCostUsd] = useState(0);
  const availableModels = useRef(new CardAIOrchestrator().getProviderList()).current;
  const orchestratorRef = useRef<CardAIOrchestrator | null>(null);

  const getOrchestrator = useCallback(() => {
    if (!orchestratorRef.current) orchestratorRef.current = new CardAIOrchestrator();
    return orchestratorRef.current;
  }, []);

  const ensureTokenBudget = useCallback(async () => {
    if (userEmail && userEmail !== 'admin@gmail.com' && !isLocalhost()) {
      const profile = await dataService.getUserProfile(userEmail);
      if (profile.error) throw new Error(profile.error);
      if (profile.tokensUsed >= profile.tokenLimit) {
        throw new Error("Limite token AI raggiunto. Contatta l'amministratore.");
      }
    }
  }, [userEmail]);

  const trackImageTokens = useCallback(() => {
    if (userEmail && userEmail !== 'admin@gmail.com') {
      Promise.resolve(dataService.trackTokens(userEmail, IMAGE_TOKEN_COST) as unknown as Promise<unknown>).catch(() => {});
    }
  }, [userEmail]);

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
      if (!prompt.trim()) throw new Error("Inserisci un prompt per l'AI.");
      const requestId = newRequestId();
      await ensureTokenBudget();

      const promptPreview = prompt.length > 60 ? prompt.slice(0, 57) + '...' : prompt;
      info(`📤 Invio richiesta: "${promptPreview}"`, prompt, { requestId });
      const streamId = startStream('Generazione in corso…', { requestId });

      try {
        const orchestrator = getOrchestrator();
        options?.onProgress?.('🤖 Chiamata AI in corso...');

        const result = await orchestrator.processPrompt(card, prompt, {
          modelId: resolveProviderId(options?.modelId),
          requestId,
          onStream: (chunk: AIStreamChunk) => {
            if (chunk.type === 'content' && chunk.content) {
              appendStream(streamId, chunk.content);
            }
            options?.onStream?.(chunk);
          },
        });

        if (userEmail && userEmail !== 'admin@gmail.com' && result.response.usage?.totalTokens) {
          const cost = calculateCostUsd(resolveProviderId(options?.modelId), result.response.usage);
          setLastCostUsd(cost);
          Promise.resolve(dataService.trackTokens(userEmail, result.response.usage.totalTokens, cost) as unknown as Promise<unknown>).catch(() => {});
        }

        const tokens = result.response.usage
          ? { prompt: result.response.usage.promptTokens, completion: result.response.usage.completionTokens, total: result.response.usage.totalTokens }
          : undefined;
        finalizeStream(streamId, true, { tokens, detail: result.rawResponse?.slice(0, 2048) });

        const realChanges = result.changes.filter((c: string) => !c.startsWith('error:'));
        const errorChanges = result.changes.filter((c: string) => c.startsWith('error:'));

        if (realChanges.length > 0) {
          const changeList = realChanges.map((c: string) => `• ${c}`).join('\n');
          success(
            `${realChanges.length} modifica${realChanges.length > 1 ? 'e' : ''} applicata${realChanges.length > 1 ? 'e' : ''}`,
            changeList,
            { requestId }
          );
        }
        if (errorChanges.length > 0) {
          error('Alcune modifiche non sono state applicate (formato non valido)', errorChanges.join('; '), { requestId });
        }
        if (realChanges.length === 0 && errorChanges.length === 0) {
          const aiText = (result.rawResponse || '').trim();
          info(aiText || 'Nessuna modifica applicata', undefined, { requestId });
        }

        return { card: result.card, changes: result.changes, rawResponse: result.rawResponse };
      } catch (err: any) {
        const msg = err.message || 'Errore AI';
        const hint = mapAiError(err);
        finalizeStream(streamId, false, { errorMsg: msg });
        logger.error('Card AI processPrompt failed', { route: 'useAICard', err: msg });
        throw new Error(hint);
      }
    },
    [userEmail, ensureTokenBudget, info, startStream, appendStream, finalizeStream, success, error, getOrchestrator]
  );

  const resetCardChat = useCallback(() => {
    getOrchestrator().resetSession();
    clear();
  }, [getOrchestrator, clear]);

  const generateCover = useCallback(
    async (card: BusinessCard, side: 'front' | 'back' = 'front', promptOverride?: string, options?: { onProgress?: (msg: string) => void; imageModel?: string }) => {
      const requestId = newRequestId();
      await ensureTokenBudget();

      const { prompt: coverPrompt, context: coverContext } =
        promptOverride ? { prompt: promptOverride, context: '' } : buildCardCoverBrief(card, side);

      info(`🎨 Generazione cover AI in corso (${side})...`, coverPrompt, { requestId });
      options?.onProgress?.(`🎨 Generazione cover AI in corso (${side})...`);

      try {
        const [cardImage, logoImage] = await Promise.all([
          renderCardCoverScreenshot(card, side),
          side === 'front' ? resolveCardCoverLogo(card) : Promise.resolve(undefined),
        ]);

        const imageModel = options?.imageModel || getAiImageModelDefault();
        const payload = buildCardCoverPayload(coverPrompt, coverContext, { cardImage, logoImage }, side, userEmail, imageModel);

        const apiBase = import.meta.env?.VITE_API_BASE || '';
        const res = await fetch(`${apiBase}/api/ai/card-cover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Errore generazione cover' }));
          throw new Error(err.error || `Cover AI ${res.status}`);
        }

        const { data } = (await res.json()) as { data: { imageBase64: string; mimeType: string } };
        trackImageTokens();
        success(`Cover AI (${side}) generata`, `${data.mimeType}, ${Math.round(data.imageBase64.length * 0.75 / 1024)}KB`, { requestId });
        return `data:${data.mimeType};base64,${data.imageBase64}`;
      } catch (err: any) {
        const hint = mapAiError(err);
        logger.error('Card AI generateCover failed', { route: 'useAICard.generateCover', err: err?.message });
        error(`❌ ${hint}`, undefined, { requestId });
        throw new Error(hint);
      }
    },
    [userEmail, ensureTokenBudget, trackImageTokens, info, success, error]
  );

  const generatePhoto = useCallback(
    async (card: BusinessCard, options?: { promptOverride?: string; onProgress?: (msg: string) => void; imageModel?: string }) => {
      const requestId = newRequestId();
      await ensureTokenBudget();

      const brief = buildCardPhotoBrief(card);
      const override = options?.promptOverride?.trim();
      const prompt = override && override.length > 0 ? override.slice(0, 1000) : brief.prompt;
      const context = override && override.length > 0 ? '' : brief.context;
      info('🖼️ Generazione foto AI in corso...', prompt, { requestId });
      options?.onProgress?.('🖼️ Generazione foto AI in corso...');

      try {
        const apiBase = import.meta.env?.VITE_API_BASE || '';
        const imageModel = options?.imageModel || getAiImageModelDefault();
        const res = await fetch(`${apiBase}/api/ai/card-photo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
          body: JSON.stringify({
            prompt,
            context: context || undefined,
            userEmail: userEmail || undefined,
            imageModel,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `Errore generazione foto (${res.status})` }));
          throw new Error(err.error || `Photo AI ${res.status}`);
        }

        const { data } = (await res.json()) as { data: { imageBase64: string; mimeType: string } };
        trackImageTokens();
        success('Foto AI generata', `${data.mimeType}, ${Math.round(data.imageBase64.length * 0.75 / 1024)}KB`, { requestId });
        return `data:${data.mimeType};base64,${data.imageBase64}`;
      } catch (err: any) {
        const hint = mapAiError(err);
        logger.error('Card AI generatePhoto failed', { route: 'useAICard.generatePhoto', err: err?.message });
        error(`❌ ${hint}`, undefined, { requestId });
        throw new Error(hint);
      }
    },
    [userEmail, ensureTokenBudget, trackImageTokens, info, success, error]
  );

  return {
    processCardPrompt,
    generateCover,
    generatePhoto,
    resetCardChat,
    cardAiLogs,
    isCardProcessing,
    availableModels,
    lastCostUsd,
  };
}
