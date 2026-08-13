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
import { saveGeneratedImage } from '../utils/saveGeneratedImage';
import { buildCardPhotoBrief } from '../utils/card/photoBrief';
import { newRequestId } from '../utils/ai/requestId';
import { IMAGE_TOKEN_COST } from '../ai/costs';
import { resolveProviderId, providerSupportsVision } from '../utils/resolveProviderId';
import { calculateCostUsd } from '../ai/providerPricing';
import { getAiVisionEnabled } from '../utils/uiPrefs';
import { getAiImageModelDefault } from '../utils/uiPrefs';
import type { AiCallKind } from '../utils/aiStats';

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
    aiCall?: { kind: AiCallKind; costUsd: number };
  }>;
  generateCover: (
    card: BusinessCard,
    side?: 'front' | 'back',
    prompt?: string,
    options?: { onProgress?: (msg: string) => void; imageModel?: string }
  ) => Promise<{ dataUrl: string; aiCall: { kind: AiCallKind; costUsd: number } }>;
  generatePhoto: (
    card: BusinessCard,
    options?: { promptOverride?: string; onProgress?: (msg: string) => void; imageModel?: string }
  ) => Promise<{ dataUrl: string; aiCall: { kind: AiCallKind; costUsd: number } }>;
  resetCardChat: () => void;
  cardAiLogs: ReturnType<typeof useAILogs>['logs'];
  isCardProcessing: boolean;
  availableModels: { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean; supportsVision: boolean }[];
  /** TB-023: costo USD totale cumulato nella sessione card AI. */
  totalCostUsd: number;
  /** TB-023: costo USD dell'ultima operazione card AI. */
  lastCostUsd: number;
}

export function useAICard(userEmail?: string, sessionId?: string): UseAICardReturn {
  const { logs: cardAiLogs, isProcessing: isCardProcessing, totalCostUsd, lastCostUsd, startStream, appendStream, finalizeStream, info, success, error, clear } = useAILogs('useAICard');
  const setLastCostUsd = useCallback((value: number) => {
    // no-op: lastCostUsd viene gestito internamente da useAILogs tramite meta.costUsd
    void value;
  }, []);
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

  const trackImageTokens = useCallback(
    (costUsd?: number) => {
      if (userEmail && userEmail !== 'admin@gmail.com') {
        Promise.resolve(dataService.trackTokens(userEmail, IMAGE_TOKEN_COST, costUsd) as unknown as Promise<unknown>).catch(() => {});
      }
    },
    [userEmail]
  );

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

        const resolvedModelId = resolveProviderId(options?.modelId);
        // TB-023: cattura screenshot preview per vision/analysis mode.
        // CON-MM-002: solo se il provider risolto supporta vision — con un
        // provider text-only (es. DeepSeek) lo screenshot verrebbe catturato
        // e poi scartato silenziosamente dall'orchestratore.
        let previewBase64: string | undefined;
        const visionEnabled = getAiVisionEnabled() && providerSupportsVision(resolvedModelId);
        if (visionEnabled) {
          try {
            const { renderCardSideDataUrl } = await import('../utils/card/pngExport');
            const [frontUrl, backUrl] = await Promise.all([
              renderCardSideDataUrl(card, 'front', 800, 450),
              renderCardSideDataUrl(card, 'back', 800, 450)
            ]);
            const canvas = document.createElement('canvas');
            canvas.width = 800;
            canvas.height = 940; // 450 + 40 gap + 450
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#f8fafc';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              
              const loadImg = (src: string) => new Promise<HTMLImageElement>((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.src = src;
              });
              
              const [frontImg, backImg] = await Promise.all([loadImg(frontUrl), loadImg(backUrl)]);
              ctx.drawImage(frontImg, 0, 0, 800, 450);
              ctx.drawImage(backImg, 0, 490, 800, 450);
              
              previewBase64 = canvas.toDataURL('image/jpeg', 0.85);
            }
          } catch (e) {
            console.warn('Failed to capture card preview:', e);
          }
        }

        info(`📤 Invio richiesta: "${promptPreview}"`, prompt, { requestId, hasImage: !!previewBase64, imagePreviewBase64: previewBase64 });
        const streamId = startStream('Generazione in corso…', { requestId });

        try {
          const orchestrator = getOrchestrator();
          options?.onProgress?.('🤖 Chiamata AI in corso...');

        const result = await orchestrator.processPrompt(card, prompt, {
          modelId: resolvedModelId,
          userEmail,
          requestId,
          sessionId,
          imagePreviewBase64: previewBase64,
          onStream: (chunk: AIStreamChunk) => {
            if (chunk.type === 'content' && chunk.content) {
              appendStream(streamId, chunk.content);
            }
            options?.onStream?.(chunk);
          },
        });

        // Fix error:empty: risposta vuota (deepseek-v4-flash:cloud) → retry
        // automatico con prompt semplificato (stesso pattern di useAI quote).
        let finalResult = result;
        const resultIsEmpty = !result.response?.content && (!result.response?.toolCalls || result.response.toolCalls.length === 0);
        if (resultIsEmpty) {
          info('⚠ Prima risposta vuota. Riprovo con prompt semplificato…', undefined, { requestId });
          const retryStreamId = startStream('Riprovo con prompt semplificato…', { requestId });
          finalResult = await orchestrator.processPrompt(card, prompt, {
            modelId: resolvedModelId,
            userEmail,
            requestId,
            sessionId,
            imagePreviewBase64: previewBase64,
            onStream: (chunk: AIStreamChunk) => {
              if (chunk.type === 'content' && chunk.content) appendStream(retryStreamId, chunk.content);
            },
          });
          finalizeStream(retryStreamId, true, { detail: finalResult.rawResponse?.slice(0, 16384) });
        }

        const textCost = finalResult.costUsd ?? calculateCostUsd(resolvedModelId, finalResult.response.usage);
        setLastCostUsd(textCost);
        // Fallback tracking per orchestratori mock/legacy che non ritornano costUsd.
        if (finalResult.costUsd == null && userEmail && userEmail !== 'admin@gmail.com' && finalResult.response.usage?.totalTokens) {
          Promise.resolve(dataService.trackTokens(userEmail, finalResult.response.usage.totalTokens, textCost) as unknown as Promise<unknown>).catch(() => {});
        }

        const tokens = finalResult.response.usage
          ? { prompt: finalResult.response.usage.promptTokens, completion: finalResult.response.usage.completionTokens, total: finalResult.response.usage.totalTokens }
          : undefined;
        finalizeStream(streamId, true, { tokens, costUsd: textCost, detail: finalResult.rawResponse?.slice(0, 16384), modelId: resolvedModelId, requestId, hasImage: !!previewBase64, imagePreviewBase64: previewBase64 });

        const realChanges = finalResult.changes.filter((c: string) => !c.startsWith('error:'));
        const errorChanges = finalResult.changes.filter((c: string) => c.startsWith('error:'));

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
          // In modalita' analisi il testo completo e' gia' nel log stream (dettaglio).
          // Evitiamo di duplicarlo come info separato; mostriamo solo una riga sintetica.
          info('Risposta AI ricevuta (vedi dettaglio sopra)', undefined, { requestId });
        }

        return { card: finalResult.card, changes: finalResult.changes, rawResponse: finalResult.rawResponse, aiCall: { kind: 'text' as const, costUsd: textCost } };
      } catch (err: any) {
        const msg = err.message || 'Errore AI';
        const hint = mapAiError(err);
        finalizeStream(streamId, false, { errorMsg: msg });
        logger.error('Card AI processPrompt failed', { route: 'useAICard', err: msg });
        throw new Error(hint);
      }
    },
    [userEmail, ensureTokenBudget, info, startStream, appendStream, finalizeStream, success, error, getOrchestrator, sessionId]
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
        if (sessionId) payload.sessionId = sessionId;

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
        const imageCost = calculateCostUsd('gemini-nano-banana', undefined, 1);
        setLastCostUsd(imageCost);
        trackImageTokens(imageCost);
        success(`Cover AI (${side}) generata`, `${data.mimeType}, ${Math.round(data.imageBase64.length * 0.75 / 1024)}KB`, { requestId, costUsd: imageCost, hasImage: true, modelId: imageModel });
        const dataUrl = `data:${data.mimeType};base64,${data.imageBase64}`;
        saveGeneratedImage(userEmail, dataUrl, 'cards', 'cover', coverPrompt).catch(() => {});
        return { dataUrl, aiCall: { kind: 'cover' as const, costUsd: imageCost } };
      } catch (err: any) {
        const hint = mapAiError(err);
        logger.error('Card AI generateCover failed', { route: 'useAICard.generateCover', err: err?.message });
        error(`❌ ${hint}`, undefined, { requestId });
        throw new Error(hint);
      }
    },
    [userEmail, ensureTokenBudget, trackImageTokens, info, success, error, sessionId]
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
            ...(sessionId ? { sessionId } : {}),
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `Errore generazione foto (${res.status})` }));
          throw new Error(err.error || `Photo AI ${res.status}`);
        }

        const { data } = (await res.json()) as { data: { imageBase64: string; mimeType: string } };
        const imageCost = calculateCostUsd('gemini-nano-banana', undefined, 1);
        setLastCostUsd(imageCost);
        trackImageTokens(imageCost);
        success('Foto AI generata', `${data.mimeType}, ${Math.round(data.imageBase64.length * 0.75 / 1024)}KB`, { requestId, costUsd: imageCost, hasImage: true, modelId: imageModel });
        const dataUrl = `data:${data.mimeType};base64,${data.imageBase64}`;
        saveGeneratedImage(userEmail, dataUrl, 'cards', 'photo', prompt).catch(() => {});
        return { dataUrl, aiCall: { kind: 'photo' as const, costUsd: imageCost } };
      } catch (err: any) {
        const hint = mapAiError(err);
        logger.error('Card AI generatePhoto failed', { route: 'useAICard.generatePhoto', err: err?.message });
        error(`❌ ${hint}`, undefined, { requestId });
        throw new Error(hint);
      }
    },
    [userEmail, ensureTokenBudget, trackImageTokens, info, success, error, sessionId]
  );

  return {
    processCardPrompt,
    generateCover,
    generatePhoto,
    resetCardChat,
    cardAiLogs,
    isCardProcessing,
    availableModels,
    totalCostUsd,
    lastCostUsd,
  };
}
