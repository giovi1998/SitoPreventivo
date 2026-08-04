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
      logoBase64?: string;
      scrapedReference?: string;
      visionPreviews?: string[];
    },
  ) => Promise<WebsiteProcessResult>;
  refine: (
    site: { html: string; css: string; js: string; pages: string[] },
    instruction: string,
    options?: { modelId?: string; onProgress?: (msg: string) => void; visionPreviews?: string[] },
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
        logoBase64?: string;
        scrapedReference?: string;
        visionPreviews?: string[];
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
          logoBase64: options?.logoBase64,
          scrapedReference: options?.scrapedReference,
          visionPreviews: options?.visionPreviews,
          onStream: (chunk) => {
            if (chunk.type === 'content' && chunk.content) {
              appendStream(streamId, chunk.content);
              options?.onProgress?.(`Generazione in corso… ${chunk.content.length} caratteri`);
            } else if (chunk.type === 'error' && chunk.error) {
              throw new Error(chunk.error);
            }
          },
          onStep: (step, promptText) => {
            const preview = promptText.length > 300 ? promptText.slice(0, 300) + '…' : promptText;
            if (step === 'html') info('Prompt HTML', preview, { requestId });
            else if (step === 'css') info('Prompt CSS', preview, { requestId });
            else if (step === 'js') info('Prompt JS', preview, { requestId });
            else if (step === 'verify') info('Prompt Verify', preview, { requestId });
          },
          onStepResult: (step, content, meta) => {
            const preview = content.length > 500 ? content.slice(0, 500) + '…' : content;
            const detail = `${(meta?.durationMs ?? 0) / 1000}s${meta?.tokens ? ` · ${meta.tokens} tok` : ''}\n${preview}`;
            if (step === 'html') info('Risposta HTML', detail, { requestId });
            else if (step === 'css') info('Risposta CSS', detail, { requestId });
            else if (step === 'js') info('Risposta JS', detail, { requestId });
            else if (step === 'verify') info('Risposta Verify', detail, { requestId });
          },
          userEmail,
        });

        // Log each step from changes array
        for (const change of result.changes) {
          if (change.startsWith('html:')) info('HTML generato', `${result.site.html.length} caratteri, ${result.site.pages.length} pagine`, { requestId });
          else if (change.startsWith('css:')) info('CSS generato', `${result.site.css.length} caratteri`, { requestId });
          else if (change.startsWith('js:')) info('JS generato', `${result.site.js.length} caratteri`, { requestId });
          else if (change.startsWith('verify:')) info('Verifica completata', change.replace('verify:', ''), { requestId });
          else if (change.startsWith('error:')) error('Errore generazione', change.replace('error:', ''), { requestId });
        }

        const cost = result.aiCall?.costUsd ?? (result.response?.usage ? calculateCostUsd(resolvedModelId, result.response.usage) : 0);
        setLastCostUsd(cost);
        finalizeStream(streamId, true, {
          costUsd: cost,
          modelId: resolvedModelId,
          requestId,
          detail: `Pagine: ${result.site.pages.join(', ')}, HTML ${result.site.html.length}ch, CSS ${result.site.css.length}ch, JS ${result.site.js.length}ch`,
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
      options?: { modelId?: string; onProgress?: (msg: string) => void; visionPreviews?: string[] },
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
          visionPreviews: options?.visionPreviews,
          onStream: (chunk) => {
            if (chunk.type === 'content' && chunk.content) {
              appendStream(streamId, chunk.content);
              options?.onProgress?.(`Raffinamento… ${chunk.content.length} caratteri`);
            } else if (chunk.type === 'error' && chunk.error) {
              throw new Error(chunk.error);
            }
          },
          onStep: (step, promptText) => {
            if (step === 'refine') {
              const preview = promptText.length > 300 ? promptText.slice(0, 300) + '…' : promptText;
              info('Prompt Raffina', preview, { requestId });
            }
          },
          onStepResult: (step, content, meta) => {
            if (step === 'refine') {
              const preview = content.length > 500 ? content.slice(0, 500) + '…' : content;
              const detail = `${(meta?.durationMs ?? 0) / 1000}s${meta?.tokens ? ` · ${meta.tokens} tok` : ''}\n${preview}`;
              info('Risposta Raffina', detail, { requestId });
            }
          },
          userEmail,
        });

        const cost = result.response?.usage ? calculateCostUsd(resolvedModelId, result.response.usage) : 0;
        setLastCostUsd(cost);
        finalizeStream(streamId, true, { costUsd: cost, modelId: resolvedModelId, requestId });

        // Log modifiche per parte (html/css/js)
        for (const change of result.changes) {
          if (change.startsWith('refine:html:')) info('Modifica HTML', change.replace('refine:html:', ''), { requestId });
          else if (change.startsWith('refine:css:')) info('Modifica CSS', change.replace('refine:css:', ''), { requestId });
          else if (change.startsWith('refine:js:')) info('Modifica JS', change.replace('refine:js:', ''), { requestId });
          else if (change.startsWith('refine:pages:')) info('Modifica Pagine', '', { requestId });
        }

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
