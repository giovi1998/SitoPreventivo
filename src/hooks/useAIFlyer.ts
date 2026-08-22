import { useCallback, useRef, useState } from 'react';
import type { Flyer, FlyerSector, FlyerTone } from '../utils/documentSchemas';
import { FlyerAIOrchestrator, type FlyerRefineAction } from '../ai/flyerOrchestrator';
import { buildFlyerHeroPayload, getDefaultHeroSector, getDefaultHeroTone, renderFlyerScreenshot } from '../utils/flyer/heroImage';
import { useAILogs } from './useAILogs';
import dataService from '../utils/dataService';
import { isLocalhost } from '../utils/env';
import { logger } from '../utils/logger';
import { mapAiError } from '../utils/ai/mapAiError';
import { saveGeneratedImage } from '../utils/saveGeneratedImage';
import { newRequestId } from '../utils/ai/requestId';
import { resolveProviderId, providerSupportsVision } from '../utils/resolveProviderId';
import { calculateCostUsd } from '../ai/providerPricing';
import { getAiImageModelDefault, getAiVisionEnabled } from '../utils/uiPrefs';
import { renderFlyerPreviewImage } from '../utils/flyer/flyerPreviewImage';
import type { AiCallKind } from '../utils/aiStats';
import { ensureTokenBudget } from '../utils/ai/tokenBudget';
import { postAiImage } from '../utils/ai/imageCall';

export interface FlyerAiCall {
  kind: AiCallKind;
  costUsd: number;
}

interface UseAIFlyerReturn {
  generate: (
    flyer: Flyer,
    brief: string,
    tone: FlyerTone,
    options?: { modelId?: string }
  ) => Promise<{ flyer: Flyer; changes: string[]; rawResponse?: string; applied: boolean; aiCall?: FlyerAiCall }>;
  refine: (
    flyer: Flyer,
    action: FlyerRefineAction,
    options?: { modelId?: string }
  ) => Promise<{ flyer: Flyer; changes: string[]; rawResponse?: string; applied: boolean; aiCall?: FlyerAiCall }>;
  generateHero: (
    flyer: Flyer,
    options?: { sector?: FlyerSector; tone?: FlyerTone; promptOverride?: string; imageModel?: string }
  ) => Promise<{ flyer: Flyer; applied: boolean; error?: string; aiCall?: FlyerAiCall }>;
  reset: () => void;
  logs: ReturnType<typeof useAILogs>['logs'];
  isProcessing: boolean;
  availableModels: { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean; supportsVision: boolean }[];
  lastCostUsd: number;
}

export function useAIFlyer(userEmail?: string, sessionId?: string): UseAIFlyerReturn {
  const { logs, isProcessing, startStream, appendStream, finalizeStream, info, success, error, clear } = useAILogs('useAIFlyer');
  const [lastCostUsd, setLastCostUsd] = useState(0);
  const availableModels = useRef(new FlyerAIOrchestrator().getProviderList()).current;
  const orchestratorRef = useRef<FlyerAIOrchestrator | null>(null);

  const getOrchestrator = useCallback(() => {
    if (!orchestratorRef.current) orchestratorRef.current = new FlyerAIOrchestrator();
    return orchestratorRef.current;
  }, []);

  const runWith = useCallback(
    async (
      label: string,
      run: (onStream: (chunk: any) => void) => Promise<{ flyer: Flyer; changes: string[]; rawResponse?: string; applied: boolean; response?: { usage?: { promptTokens: number; completionTokens: number; totalTokens: number } } }>,
      modelId?: string,
      imagePreviewBase64?: string,
      detail?: string,
    ) => {
      const resolvedId = resolveProviderId(modelId);
      const requestId = newRequestId();
      await ensureTokenBudget(userEmail);
      info(`📤 ${label}`, detail, { requestId, hasImage: !!imagePreviewBase64, imagePreviewBase64 });
      const streamId = startStream('Generazione in corso…', { requestId });

      try {
        const result = await run((chunk) => {
          if (chunk.type === 'content' && chunk.content) {
            appendStream(streamId, chunk.content);
          }
        });

        const tokens = result.response?.usage
          ? { prompt: result.response.usage.promptTokens, completion: result.response.usage.completionTokens, total: result.response.usage.totalTokens }
          : undefined;
        const total = tokens?.total ?? Math.max(1, Math.ceil((result.rawResponse?.length || 0) / 4));
        const cost = calculateCostUsd(resolvedId, result.response?.usage || { promptTokens: 0, completionTokens: 0, totalTokens: total });
        if (userEmail && userEmail !== 'admin@gmail.com') {
          dataService.trackTokens(userEmail, total, cost).catch(() => {});
        }
        setLastCostUsd(cost);
        finalizeStream(streamId, true, { tokens, detail: result.rawResponse?.slice(0, 16384), costUsd: cost, modelId: resolvedId, requestId, hasImage: !!imagePreviewBase64, imagePreviewBase64 });

        const realChanges = result.changes.filter((c) => !c.startsWith('error:'));
        const errorChanges = result.changes.filter((c) => c.startsWith('error:'));
        if (result.applied && realChanges.length > 0) {
          success(`${realChanges.length} modifica applicata (copy aggiornato)`, realChanges.join('\n'), { requestId });
        }
        if (errorChanges.length > 0) {
          error('Risposta AI non valida (formato non riconosciuto). Riprova con un brief più chiaro.', errorChanges.join('; '), { requestId });
        }
        if (!result.applied && errorChanges.length === 0) {
          info('Nessuna modifica applicata', undefined, { requestId });
        }
        return { ...result, aiCall: { kind: 'flyerCopy' as const, costUsd: cost } };
      } catch (err: any) {
        const msg = err?.message || 'Errore AI';
        const hint = mapAiError(err);
        finalizeStream(streamId, false, { errorMsg: msg });
        logger.error('Flyer AI failed', { route: 'useAIFlyer', err: msg });
        throw new Error(hint);
      }
    },
    [userEmail, info, startStream, appendStream, finalizeStream, success, error]
  );

  const generate = useCallback(
    async (flyer: Flyer, brief: string, tone: FlyerTone, options?: { modelId?: string }) => {
      const trimmed = brief.trim();
      if (!trimmed) throw new Error('Inserisci un brief per generare il copy.');
      const resolvedModelId = resolveProviderId(options?.modelId);
      // CON-MM-002: cattura lo screenshot solo se il provider risolto supporta
      // vision — con un provider text-only verrebbe catturato e scartato.
      let imagePreviewBase64: string | undefined;
      const visionEnabled = getAiVisionEnabled() && providerSupportsVision(resolvedModelId);
      if (visionEnabled && flyer.content.headline) {
        try {
          imagePreviewBase64 = await renderFlyerPreviewImage(flyer, { maxWidth: 1024, quality: 0.8, type: 'image/jpeg' }) ?? undefined;
        } catch {
          imagePreviewBase64 = undefined;
        }
      }
      return runWith(
        `Invio richiesta: "${trimmed.length > 60 ? trimmed.slice(0, 57) + '...' : trimmed}" (${tone})`,
        async (onStream) => getOrchestrator().generateCopy(flyer, trimmed, tone, { modelId: resolvedModelId, onStream, imagePreviewBase64, sessionId }),
        options?.modelId,
        imagePreviewBase64,
        trimmed,
      );
    },
    [getOrchestrator, runWith, sessionId]
  );

  const refine = useCallback(
    async (flyer: Flyer, action: FlyerRefineAction, options?: { modelId?: string }) => {
      const resolvedModelId = resolveProviderId(options?.modelId);
      // CON-MM-002: cattura lo screenshot solo se il provider risolto supporta
      // vision — con un provider text-only verrebbe catturato e scartato.
      let imagePreviewBase64: string | undefined;
      const visionEnabled = getAiVisionEnabled() && providerSupportsVision(resolvedModelId);
      if (visionEnabled && flyer.content.headline) {
        try {
          imagePreviewBase64 = await renderFlyerPreviewImage(flyer, { maxWidth: 1024, quality: 0.8, type: 'image/jpeg' }) ?? undefined;
        } catch {
          imagePreviewBase64 = undefined;
        }
      }
      return runWith(
        `Rifinisci copy: ${action}`,
        async (onStream) => getOrchestrator().refineCopy(flyer, action, { modelId: resolvedModelId, onStream, imagePreviewBase64, sessionId }),
        options?.modelId,
        imagePreviewBase64,
        `Azione: ${action}`,
      );
    },
    [getOrchestrator, runWith, sessionId]
  );

  const generateHero = useCallback(
    async (flyer: Flyer, options?: { sector?: FlyerSector; tone?: FlyerTone; promptOverride?: string; imageModel?: string }) => {
      const requestId = newRequestId();
      const sector = options?.sector || getDefaultHeroSector(flyer);
      const tone = options?.tone || getDefaultHeroTone(flyer);
      const promptPreview = options?.promptOverride
        ? `prompt override (${options.promptOverride.length} char)`
        : `sector="${sector}" tone="${tone}"`;
      info('🖼️ Generazione hero AI: ' + promptPreview, undefined, { requestId });

      try {
        const flyerImage = await renderFlyerScreenshot(flyer);
        const imageModel = options?.imageModel || getAiImageModelDefault();
        const payload = buildFlyerHeroPayload(flyer, sector, tone, { flyerImage }, userEmail, options?.promptOverride, imageModel);
        if (sessionId) payload.sessionId = sessionId;
        const { dataUrl, costUsd, mimeType, sizeKB } = await postAiImage({
          endpoint: '/api/ai/flyer-hero',
          payload,
          requestId,
          imageModel,
          userEmail,
          fallbackError: 'Errore generazione hero',
        });
        const heroImage = dataUrl;
        const updated: Flyer = { ...flyer, content: { ...flyer.content, heroImage }, updatedAt: new Date().toISOString() };

        setLastCostUsd(costUsd);

        success('Hero AI generato', `${mimeType}, ${sizeKB}KB`, { requestId, modelId: imageModel, costUsd, hasImage: true });
        saveGeneratedImage(userEmail, heroImage, 'flyers', 'hero').catch(() => {});
        return { flyer: updated, applied: true, aiCall: { kind: 'hero' as const, costUsd } };
      } catch (err) {
        const hint = mapAiError(err);
        logger.error('Flyer AI generateHero failed', { route: 'useAIFlyer.generateHero', err: hint });
        error(hint, undefined, { requestId });
        return { flyer, applied: false, error: hint };
      }
    },
    [info, success, error, userEmail, sessionId]
  );

  const reset = useCallback(() => {
    getOrchestrator().resetSession();
    clear();
  }, [getOrchestrator, clear]);

  return { generate, refine, generateHero, reset, logs, isProcessing, availableModels, lastCostUsd };
}
