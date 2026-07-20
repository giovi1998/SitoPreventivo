import { useCallback, useRef, useState } from 'react';
import type { Flyer, FlyerSector, FlyerTone } from '../utils/documentSchemas';
import { FlyerAIOrchestrator, type FlyerRefineAction } from '../ai/flyerOrchestrator';
import { buildFlyerHeroPayload, getDefaultHeroSector, getDefaultHeroTone, renderFlyerScreenshot } from '../utils/flyer/heroImage';
import { useAILogs } from './useAILogs';
import dataService from '../utils/dataService';
import { isLocalhost } from '../utils/env';
import { logger } from '../utils/logger';
import { mapAiError } from '../utils/ai/mapAiError';
import { newRequestId } from '../utils/ai/requestId';
import { IMAGE_TOKEN_COST } from '../ai/costs';
import { resolveProviderId } from '../utils/resolveProviderId';
import { calculateCostUsd } from '../ai/providerPricing';
import { getAiImageModelDefault } from '../utils/uiPrefs';

interface UseAIFlyerReturn {
  generate: (
    flyer: Flyer,
    brief: string,
    tone: FlyerTone,
    options?: { modelId?: string }
  ) => Promise<{ flyer: Flyer; changes: string[]; rawResponse?: string; applied: boolean }>;
  refine: (
    flyer: Flyer,
    action: FlyerRefineAction,
    options?: { modelId?: string }
  ) => Promise<{ flyer: Flyer; changes: string[]; rawResponse?: string; applied: boolean }>;
  generateHero: (
    flyer: Flyer,
    options?: { sector?: FlyerSector; tone?: FlyerTone; promptOverride?: string; imageModel?: string }
  ) => Promise<{ flyer: Flyer; applied: boolean; error?: string }>;
  reset: () => void;
  logs: ReturnType<typeof useAILogs>['logs'];
  isProcessing: boolean;
  availableModels: { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean; supportsVision: boolean }[];
  lastCostUsd: number;
}

export function useAIFlyer(userEmail?: string): UseAIFlyerReturn {
  const { logs, isProcessing, startStream, appendStream, finalizeStream, info, success, error, clear } = useAILogs('useAIFlyer');
  const [lastCostUsd, setLastCostUsd] = useState(0);
  const availableModels = useRef(new FlyerAIOrchestrator().getProviderList()).current;
  const orchestratorRef = useRef<FlyerAIOrchestrator | null>(null);

  const getOrchestrator = useCallback(() => {
    if (!orchestratorRef.current) orchestratorRef.current = new FlyerAIOrchestrator();
    return orchestratorRef.current;
  }, []);

  const ensureTokenBudget = async (requestId: string) => {
    if (userEmail && userEmail !== 'admin@gmail.com' && !isLocalhost()) {
      const profile = await dataService.getUserProfile(userEmail);
      if (profile.error) throw new Error(profile.error);
      if (profile.tokensUsed >= profile.tokenLimit) {
        throw new Error("Limite token AI raggiunto. Contatta l'amministratore.");
      }
    }
  };

  const runWith = useCallback(
    async (
      label: string,
      run: (onStream: (chunk: any) => void) => Promise<{ flyer: Flyer; changes: string[]; rawResponse?: string; applied: boolean; response?: { usage?: { promptTokens: number; completionTokens: number; totalTokens: number } } }>,
      modelId?: string,
    ) => {
      const resolvedId = resolveProviderId(modelId);
      const requestId = newRequestId();
      await ensureTokenBudget(requestId);
      info(`📤 ${label}`, undefined, { requestId });
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
        finalizeStream(streamId, true, { tokens, detail: result.rawResponse?.slice(0, 2048) });

        if (userEmail && userEmail !== 'admin@gmail.com') {
          const total = tokens?.total ?? Math.max(1, Math.ceil((result.rawResponse?.length || 0) / 4));
          const cost = calculateCostUsd(resolvedId, result.response?.usage || { promptTokens: 0, completionTokens: 0, totalTokens: total });
          setLastCostUsd(cost);
          dataService.trackTokens(userEmail, total, cost).catch(() => {});
        }

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
        return result;
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
      return runWith(
        `Invio richiesta: "${trimmed.length > 60 ? trimmed.slice(0, 57) + '...' : trimmed}" (${tone})`,
        async (onStream) => getOrchestrator().generateCopy(flyer, trimmed, tone, { modelId: resolveProviderId(options?.modelId), onStream }),
        options?.modelId,
      );
    },
    [getOrchestrator, runWith]
  );

  const refine = useCallback(
    async (flyer: Flyer, action: FlyerRefineAction, options?: { modelId?: string }) => {
      return runWith(
        `Rifinisci copy: ${action}`,
        async (onStream) => getOrchestrator().refineCopy(flyer, action, { modelId: resolveProviderId(options?.modelId), onStream }),
        options?.modelId,
      );
    },
    [getOrchestrator, runWith]
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
        const apiBase = import.meta.env?.VITE_API_BASE || '';
        const res = await fetch(`${apiBase}/api/ai/flyer-hero`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Errore generazione hero' }));
          throw new Error(mapAiError(err.error || `Hero AI ${res.status}`));
        }
        const { data } = (await res.json()) as { data: { imageBase64: string; mimeType: string } };
        const heroImage = `data:${data.mimeType};base64,${data.imageBase64}`;
        const updated: Flyer = { ...flyer, content: { ...flyer.content, heroImage }, updatedAt: new Date().toISOString() };

        if (userEmail && userEmail !== 'admin@gmail.com') {
          dataService.trackTokens(userEmail, IMAGE_TOKEN_COST).catch(() => {});
          setLastCostUsd(0);
        }

        success('Hero AI generato', `${data.mimeType}, ${Math.round(data.imageBase64.length * 0.75 / 1024)}KB`, { requestId });
        return { flyer: updated, applied: true };
      } catch (err) {
        const hint = mapAiError(err);
        logger.error('Flyer AI generateHero failed', { route: 'useAIFlyer.generateHero', err: hint });
        error(hint, undefined, { requestId });
        return { flyer, applied: false, error: hint };
      }
    },
    [info, success, error, userEmail]
  );

  const reset = useCallback(() => {
    getOrchestrator().resetSession();
    clear();
  }, [getOrchestrator, clear]);

  return { generate, refine, generateHero, reset, logs, isProcessing, availableModels, lastCostUsd };
}
