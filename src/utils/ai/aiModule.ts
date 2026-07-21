/**
 * AI Module — unified client-side AI harness (TB-023 follow-up).
 *
 * Centralizes:
 * - provider resolution (default, A/B, fallback)
 * - screenshot preview capture for vision feedback
 * - design review wiring
 * - cost tracking normalization
 * - AI preferences wiring (vision, auto-fallback, A/B)
 *
 * Editors consume this module instead of configuring provider/vision/fallback
 * directly in each hook.
 */
import { useCallback, useMemo, useState } from 'react';
import { useAILogs } from '../../hooks/useAILogs';
import { resolveProviderId } from '../resolveProviderId';
import { captureElementAsBase64 } from '../ai/captureElement';
import { newRequestId } from '../ai/requestId';
import { mapAiError } from '../ai/mapAiError';
import { logger } from '../logger';
import { providerRegistry } from '../../ai/providers/registry';
import { calculateCostUsd, getPricingLabel } from '../../ai/providerPricing';
import type { DesignReviewSuggestion } from '../../hooks/useAIDesignReview';
import {
  getAiVisionEnabled,
  setAiVisionEnabled,
  getAiAutoFallback,
  setAiAutoFallback,
  getAiABTestingEnabled,
  setAiABTestingEnabled,
  getAiProviderDefault,
  setAiProviderDefault,
  getAiImageModelDefault,
  setAiImageModelDefault,
  AI_IMAGE_MODELS,
} from '../uiPrefs';

export interface AIRequestOptions {
  modelId?: string;
  /** Salt per A/B testing deterministico (es. docId). */
  abSalt?: string;
  /** Selettore DOM per l'elemento preview. */
  previewSelector?: string;
}

export interface AIHarnessState {
  /** Provider risolto per la prossima chiamata. */
  providerId: string;
  /** Label pricing per UI tooltip. */
  providerPricingLabel: string;
  /** Indica se la capture preview è abilitata. */
  visionEnabled: boolean;
  /** Indica se l'auto-fallback è abilitato. */
  autoFallbackEnabled: boolean;
  /** Base64 della preview catturata (undefined se assente o fallita). */
  previewBase64?: string;
  /** Costo totale cumulato nella sessione (dai log). */
  totalCostUsd: number;
  /** Costo dell'ultima operazione. */
  lastCostUsd: number;
  /** Lista provider disponibili. */
  availableProviders: ReturnType<typeof providerRegistry.listProviders>;
  /** Lista modelli immagine disponibili. */
  availableImageModels: typeof AI_IMAGE_MODELS;
}

export interface UseAIHarnessReturn extends AIHarnessState {
  /** Cattura la preview e restituisce base64 (se possibile e abilitata). */
  capturePreview: (selector?: string) => Promise<string | undefined>;
  /** Esegue design review su un elemento preview. */
  runDesignReview: (docType: 'card' | 'flyer', docJson: string, previewSelector: string) => Promise<void>;
  /** Suggerimenti design review correnti. */
  designReview: DesignReviewSuggestion[];
  /** Stato design review. */
  isReviewing: boolean;
  /** Errore design review. */
  designReviewError: string | null;
  /** Pulisce design review. */
  clearDesignReview: () => void;
  /** Selezione provider. */
  setProvider: (providerId: string) => void;
  /** Selezione modello immagine default. */
  setImageModel: (modelId: string) => void;
  /** Toggle vision. */
  setVision: (enabled: boolean) => void;
  /** Toggle auto-fallback. */
  setAutoFallback: (enabled: boolean) => void;
  /** Toggle A/B testing. */
  setABTesting: (enabled: boolean) => void;
  /** Ricalcola lo stato (da chiamare quando cambiano preferenze esterne). */
  refresh: () => void;
}

export function useAIHarness(): UseAIHarnessReturn {
  const { logs, isProcessing: _isProcessing, totalCostUsd, lastCostUsd: logsLastCost, startStream, finalizeStream, success, error: logError } = useAILogs('useAIHarness');
  const [designReview, setDesignReview] = useState<DesignReviewSuggestion[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [designReviewError, setDesignReviewError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const state = useMemo((): AIHarnessState => {
    const providerId = resolveProviderId();
    return {
      providerId,
      providerPricingLabel: getPricingLabel(providerId),
      visionEnabled: getAiVisionEnabled(),
      autoFallbackEnabled: getAiAutoFallback(),
      totalCostUsd,
      lastCostUsd: logsLastCost,
      availableProviders: providerRegistry.listProviders(),
      availableImageModels: AI_IMAGE_MODELS,
    };
  }, [totalCostUsd, logsLastCost, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const setProvider = useCallback((providerId: string) => {
    setAiProviderDefault(providerId);
    refresh();
  }, [refresh]);

  const setImageModel = useCallback((modelId: string) => {
    setAiImageModelDefault(modelId);
    refresh();
  }, [refresh]);

  const setVision = useCallback((enabled: boolean) => {
    setAiVisionEnabled(enabled);
    refresh();
  }, [refresh]);

  const setAutoFallback = useCallback((enabled: boolean) => {
    setAiAutoFallback(enabled);
    refresh();
  }, [refresh]);

  const setABTesting = useCallback((enabled: boolean) => {
    setAiABTestingEnabled(enabled);
    refresh();
  }, [refresh]);

  const capturePreview = useCallback(async (selector?: string) => {
    if (!state.visionEnabled) return undefined;
    if (!selector) return undefined;
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) return undefined;
    try {
      return (await captureElementAsBase64(el, { maxWidth: 1024, quality: 0.85, type: 'image/jpeg' })) ?? undefined;
    } catch {
      return undefined;
    }
  }, [state.visionEnabled]);

  const runDesignReview = useCallback(
    async (docType: 'card' | 'flyer', docJson: string, previewSelector: string) => {
      setDesignReviewError(null);
      setIsReviewing(true);
      const requestId = newRequestId();
      const streamId = startStream('Analisi visiva preview in corso...', { requestId });

      try {
        const previewEl = document.querySelector<HTMLElement>(previewSelector);
        const screenshot = previewEl
          ? await captureElementAsBase64(previewEl, { maxWidth: 1024, quality: 0.85, type: 'image/jpeg' })
          : null;
        if (!screenshot) {
          throw new Error('Impossibile catturare la preview. Assicurati che sia visibile.');
        }

        const apiBase = import.meta.env?.VITE_API_BASE || '';
        const res = await fetch(`${apiBase}/api/ai/design-review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
          body: JSON.stringify({
            docType,
            docJson: docJson.slice(0, 50_000),
            screenshotBase64: screenshot,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Errore design review' }));
          throw new Error(err.error || `Design review ${res.status}`);
        }

        const { data } = (await res.json()) as { data: { suggestions: string } };
        let suggestions: DesignReviewSuggestion[] = [];
        try {
          suggestions = JSON.parse(data.suggestions) as DesignReviewSuggestion[];
        } catch {
          suggestions = [{ field: 'review', value: data.suggestions, reason: 'Risposta AI' }];
        }

        const cost = calculateCostUsd('ollama-minimax-m3', undefined, 1);
        setDesignReview(suggestions);
        success('Design review completata', `${suggestions.length} suggerimenti`, { requestId, costUsd: cost, hasImage: true, modelId: state.providerId });
        finalizeStream(streamId, true, { costUsd: cost });
      } catch (err: any) {
        const hint = mapAiError(err);
        setDesignReviewError(hint);
        logError(`❌ ${hint}`, undefined, { requestId });
        finalizeStream(streamId, false, { errorMsg: hint });
        logger.error('Design review failed', { route: 'useAIHarness.runDesignReview', err: err?.message });
      } finally {
        setIsReviewing(false);
      }
    },
    [startStream, finalizeStream, success, logError, state.providerId]
  );

  const clearDesignReview = useCallback(() => {
    setDesignReview([]);
    setDesignReviewError(null);
  }, []);

  return {
    ...state,
    capturePreview,
    runDesignReview,
    designReview,
    isReviewing,
    designReviewError,
    clearDesignReview,
    setProvider,
    setImageModel,
    setVision,
    setAutoFallback,
    setABTesting,
    refresh,
  };
}

export { providerRegistry } from '../../ai/providers/registry';
export { calculateCostUsd, getPricingLabel } from '../../ai/providerPricing';
export {
  getAiVisionEnabled,
  setAiVisionEnabled,
  getAiAutoFallback,
  setAiAutoFallback,
  getAiABTestingEnabled,
  setAiABTestingEnabled,
  getAiProviderDefault,
  setAiProviderDefault,
  getAiImageModelDefault,
  setAiImageModelDefault,
  AI_IMAGE_MODELS,
} from '../uiPrefs';
