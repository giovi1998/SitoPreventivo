import { useCallback, useState } from 'react';
import { useAILogs } from './useAILogs';
import { captureElementAsBase64 } from '../utils/ai/captureElement';
import { newRequestId } from '../utils/ai/requestId';
import { mapAiError } from '../utils/ai/mapAiError';
import { logger } from '../utils/logger';
import { calculateCostUsd } from '../ai/providerPricing';
import { resolveProviderId } from '../utils/resolveProviderId';

export interface DesignReviewSuggestion {
  field: string;
  value: string;
  reason: string;
}

export interface UseAIDesignReviewReturn {
  review: DesignReviewSuggestion[];
  isReviewing: boolean;
  error: string | null;
  runDesignReview: (options: {
    docType: 'card' | 'flyer';
    docJson: string;
    previewRef: React.RefObject<HTMLElement | null>;
    userEmail?: string;
  }) => Promise<void>;
  clearReview: () => void;
  lastCostUsd: number;
}

/**
 * TB-023: vision feedback screenshot preview via MiniMax M3 (Ollama Pro).
 * Cattura la preview del documento e la invia all'endpoint `/api/ai/design-review`.
 */
export function useAIDesignReview(): UseAIDesignReviewReturn {
  const [review, setReview] = useState<DesignReviewSuggestion[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCostUsd, setLastCostUsd] = useState(0);
  const { startStream, finalizeStream, success, error: logError } = useAILogs('useAIDesignReview');

  const runDesignReview = useCallback(
    async (options: {
      docType: 'card' | 'flyer';
      docJson: string;
      previewRef: React.RefObject<HTMLElement | null>;
      userEmail?: string;
    }) => {
      setError(null);
      setIsReviewing(true);
      const requestId = newRequestId();
      const streamId = startStream('Analisi visiva preview in corso...', { requestId });

      try {
        const screenshot = await captureElementAsBase64(options.previewRef.current, {
          maxWidth: 1024,
          quality: 0.85,
          type: 'image/jpeg',
        });
        if (!screenshot) {
          throw new Error('Impossibile catturare la preview. Assicurati che sia visibile.');
        }

        const apiBase = import.meta.env?.VITE_API_BASE || '';
        const res = await fetch(`${apiBase}/api/ai/design-review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
          body: JSON.stringify({
            docType: options.docType,
            docJson: options.docJson.slice(0, 50_000),
            screenshotBase64: screenshot,
            userEmail: options.userEmail,
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
          // Se non è JSON valido, mostriamo il testo grezzo come unico suggerimento.
          suggestions = [{ field: 'review', value: data.suggestions, reason: 'Risposta AI' }];
        }

        const cost = calculateCostUsd('ollama-minimax-m3', undefined, 1);
        setLastCostUsd(cost);
        setReview(suggestions);
        success(`Design review completata`, `${suggestions.length} suggerimenti`, { requestId, costUsd: cost, hasImage: true, modelId: resolveProviderId() });
        finalizeStream(streamId, true, { costUsd: cost });
      } catch (err: any) {
        const hint = mapAiError(err);
        setError(hint);
        logError(`❌ ${hint}`, undefined, { requestId });
        finalizeStream(streamId, false, { errorMsg: hint });
        logger.error('Design review failed', { route: 'useAIDesignReview', err: err?.message });
      } finally {
        setIsReviewing(false);
      }
    },
    [startStream, finalizeStream, success, logError]
  );

  const clearReview = useCallback(() => {
    setReview([]);
    setError(null);
  }, []);

  return {
    review,
    isReviewing,
    error,
    runDesignReview,
    clearReview,
    lastCostUsd,
  };
}
