import { useRef, useCallback, useState } from 'react';
import { WebsiteOrchestrator, type WebsiteProcessResult, type WebsiteRefineResult } from '../ai/websiteOrchestrator';
import { useAILogs } from './useAILogs';
import { mapAiError } from '../utils/ai/mapAiError';
import { newRequestId } from '../utils/ai/requestId';
import { resolveProviderId } from '../utils/resolveProviderId';
import { calculateCostUsd } from '../ai/providerPricing';

export interface UseAIWebsiteReturn {
  generate: (
    brief: {
      businessName: string;
      sector: string;
      description: string;
      tone: string;
      target: string;
      pages: string;
      preferredColors: string;
      font: string;
      cta: string;
      sections: string;
      features: string;
      contacts: string;
      socials: { platform: string; url: string }[];
      mapsUrl: string;
      notes: string;
    },
    options?: {
      style?: string;
      briefContext?: string;
      modelId?: string;
      onProgress?: (msg: string) => void;
      scrapedReference?: string;
    },
  ) => Promise<WebsiteProcessResult>;
  refine: (
    site: { html: string; css: string; js: string; pages: string[] },
    instruction: string,
    options?: { modelId?: string; onProgress?: (msg: string) => void },
  ) => Promise<WebsiteRefineResult>;
  reset: () => void;
  logs: ReturnType<typeof useAILogs>['logs'];
  isProcessing: boolean;
  availableModels: { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean; supportsVision: boolean }[];
  lastCostUsd: number;
}

export function useAIWebsite(userEmail?: string): UseAIWebsiteReturn {
  const orchestratorRef = useRef<WebsiteOrchestrator | null>(null);
  const [lastCostUsd, setLastCostUsd] = useState(0);
  const {
    logs,
    isProcessing,
    startStream,
    appendStream,
    finalizeStream,
    info,
    success,
    error,
    clear,
  } = useAILogs('useAIWebsite');

  const getOrchestrator = (): WebsiteOrchestrator => {
    if (!orchestratorRef.current) orchestratorRef.current = new WebsiteOrchestrator();
    return orchestratorRef.current;
  };

  const availableModels = getOrchestrator().getProviderList();

  const generate = useCallback(
    async (
      brief: {
        businessName: string;
        sector: string;
        description: string;
        tone: string;
        target: string;
        pages: string;
        preferredColors: string;
        font: string;
        cta: string;
        sections: string;
        features: string;
        contacts: string;
        socials: { platform: string; url: string }[];
        mapsUrl: string;
        notes: string;
      },
      options?: {
        style?: string;
        briefContext?: string;
        modelId?: string;
        onProgress?: (msg: string) => void;
        scrapedReference?: string;
      },
    ) => {
      const requestId = newRequestId();
      const promptPreview = brief.description.length > 60 ? brief.description.slice(0, 57) + '...' : brief.description;
      const resolvedModelId = resolveProviderId(options?.modelId);

      info(`Generazione sito: "${brief.businessName}" — "${promptPreview}"`, undefined, { requestId });
      const streamId = startStream('Generazione sito in corso…', {
        requestId,
        sessionId: getOrchestrator().getCurrentSessionId() ?? undefined,
      });

      try {
        const result = await getOrchestrator().generateSite(brief, {
          style: options?.style,
          briefContext: options?.briefContext,
          modelId: resolvedModelId,
          scrapedReference: options?.scrapedReference,
          onStream: (chunk) => {
            if (chunk.type === 'content' && chunk.content) {
              appendStream(streamId, chunk.content);
              options?.onProgress?.(`Generazione in corso… ${chunk.content.length} caratteri`);
            } else if (chunk.type === 'error' && chunk.error) {
              throw new Error(chunk.error);
            }
          },
          userEmail,
        });

        const cost = result.response?.usage ? calculateCostUsd(resolvedModelId, result.response.usage) : 0;
        setLastCostUsd(cost);
        finalizeStream(streamId, true, {
          costUsd: cost,
          modelId: resolvedModelId,
          requestId,
          detail: `Pagine: ${result.site.pages.join(', ')}`,
        });

        success('Sito generato', `${result.site.pages.length} pagine, ${result.site.html.length} caratteri HTML`, { requestId });
        return result;
      } catch (err) {
        const hint = mapAiError(err);
        finalizeStream(streamId, false, { errorMsg: hint });
        throw new Error(hint);
      }
    },
    [info, startStream, appendStream, finalizeStream, success, error, userEmail],
  );

  const refine = useCallback(
    async (
      site: { html: string; css: string; js: string; pages: string[] },
      instruction: string,
      options?: { modelId?: string; onProgress?: (msg: string) => void },
    ) => {
      const requestId = newRequestId();
      const resolvedModelId = resolveProviderId(options?.modelId);
      const promptPreview = instruction.length > 60 ? instruction.slice(0, 57) + '...' : instruction;

      info(`Raffinamento sito: "${promptPreview}"`, undefined, { requestId });
      const streamId = startStream('Raffinamento in corso…', {
        requestId,
        sessionId: getOrchestrator().getCurrentSessionId() ?? undefined,
      });

      try {
        const result = await getOrchestrator().refineSite(site, instruction, {
          modelId: resolvedModelId,
          onStream: (chunk) => {
            if (chunk.type === 'content' && chunk.content) {
              appendStream(streamId, chunk.content);
              options?.onProgress?.(`Raffinamento… ${chunk.content.length} caratteri`);
            } else if (chunk.type === 'error' && chunk.error) {
              throw new Error(chunk.error);
            }
          },
          userEmail,
        });

        const cost = result.response?.usage ? calculateCostUsd(resolvedModelId, result.response.usage) : 0;
        setLastCostUsd(cost);
        finalizeStream(streamId, true, { costUsd: cost, modelId: resolvedModelId, requestId });

        success('Sito raffinato', instruction.slice(0, 80), { requestId });
        return result;
      } catch (err) {
        const hint = mapAiError(err);
        finalizeStream(streamId, false, { errorMsg: hint });
        throw new Error(hint);
      }
    },
    [info, startStream, appendStream, finalizeStream, success, error, userEmail],
  );

  const reset = useCallback(() => {
    getOrchestrator().resetSession();
    clear();
  }, [clear]);

  return { generate, refine, reset, logs, isProcessing, availableModels, lastCostUsd };
}
