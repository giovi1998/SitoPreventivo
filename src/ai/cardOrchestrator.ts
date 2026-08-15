import type { BusinessCard } from '../utils/documentSchemas';
import type { AIProvider, ChatMessage, AIResponse, AIStreamChunk, AIToolCall, RunTraceOptions } from './types';
import { providerRegistry } from './providers/registry';
import { chatStore } from './chat/store';
import { promptRegistry } from './prompts/registry';
import { buildCardAIContext } from './prompts/cardContext';
import { aiCardInputSchema } from './aiCardInputSchema';
import { mergeCardAIResponse } from './cardMerge';
import { needsAnalysis, needsCardTools } from './promptUtils';
import { ToolAwareOrchestrator } from './BaseOrchestrator';
import {
  executeCardApplyPalette,
  executeCardSwitchLayout,
  executeCardAddService,
  executeCardRemoveEmptySocials,
} from './tools/cardFlyerExecutors';
import type { ToolRegistry } from './tools/registry';

export interface CardProcessResult {
  card: BusinessCard;
  response: AIResponse;
  sessionId: string;
  changes: string[];
  rawResponse?: string;
  /** TB-023: costo USD calcolato per questa operazione. */
  costUsd?: number;
}

/** Prompt completo per generare una card da zero (struttura grid + testi +
 * stile). Unica sorgente condivisa: auto-build non-agente e tool
 * `generate_card` dell'agente (senza struttura l'AI ometteva layout/grid →
 * rendering fallback legacy non centrato, bug visivo 2026-08-13). */
export function buildCardDraftPrompt(brief: string): string {
  return [
    'Crea il biglietto da visita completo per questa attività partendo dal brief.',
    'Definisci TUTTI e tre gli aspetti:',
    '- STRUTTURA: layout fronte più adatto e disposizione elementi (grid) senza sovrapposizioni;',
    '- TESTI: nome, titolo/ruolo, servizi (back.services) plausibili per il settore;',
    '- STILE: palette coerente (bgColor, textColor, accentColor in #RRGGBB), fontFamily, eventuale decorazione.',
    `Brief: ${brief}`,
  ].join('\n');
}

const CARD_TOOLS = [
  'card_apply_palette',
  'card_switch_layout',
  'card_add_service',
  'card_remove_empty_socials',
];

export class CardAIOrchestrator extends ToolAwareOrchestrator<BusinessCard> {
  protected aiKind = 'card';

  protected applicableTools(): string[] {
    return CARD_TOOLS;
  }

  protected registerExecutors(registry: ToolRegistry<BusinessCard>): void {
    registry.register('card_apply_palette', executeCardApplyPalette);
    registry.register('card_switch_layout', executeCardSwitchLayout);
    registry.register('card_add_service', executeCardAddService);
    registry.register('card_remove_empty_socials', executeCardRemoveEmptySocials);
  }

  async processPrompt(
    card: BusinessCard,
    userPrompt: string,
    options?: {
      modelId?: string;
      userEmail?: string;
      onStream?: (chunk: AIStreamChunk) => void;
      onToolStart?: (toolCallId: string, name: string) => void;
      onToolComplete?: (toolCallId: string, name: string, result: string) => void;
      requestId?: string;
      /** TB-029: attribuzione Langfuse per-cliente. */
      customerId?: string;
      /** TB-029: sessione Langfuse (docId: raggruppa chat+immagini del documento). */
      sessionId?: string;
      /** TB-023: anteprima base64 screenshot preview per vision/analysis. */
      imagePreviewBase64?: string;
    } & RunTraceOptions,
  ): Promise<CardProcessResult> {
    const primaryProviderId = options?.modelId || providerRegistry.getDefaultId();
    const provider = providerRegistry.getProvider(primaryProviderId);
    const prompt = userPrompt.trim();
    const changes: string[] = [];

    if (!this.activeSessionId) {
      this.activeSessionId = chatStore.createSession().id;
    }

    const wantsAnalysis = needsAnalysis(prompt);

    const { payload, relevantFields, briefSection } = buildCardAIContext(card, prompt);

    const session = chatStore.getSession(this.activeSessionId)!;
    if (session.messages.length === 0) {
      session.messages.push({
        role: 'system',
        // TB-029 fase 2: passa dal promptRegistry → override remoto Langfuse
        // (prefetchRemotePrompts) possibile; builder locale = fallback.
        content: promptRegistry.getPrompt('card-system'),
      });
    }

    const hasImagePreview = !!options?.imagePreviewBase64;
    const useVision = hasImagePreview && (provider as { supportsVision?: boolean }).supportsVision;

    const userContentParts: string[] = [];
    if (useVision && options?.imagePreviewBase64) {
      // L'immagine viene allegata come base64 nella content string. I provider
      // vision-enabled (Ollama MiniMax M3, Gemini, GPT-4o, ecc.) la ricevono
      // nel prompt; DeepSeek la ignora ma non rompe. Il log a parte mostra
      // l'anteprima con `hasImage` + `imagePreviewBase64`.
      userContentParts.push(`Anteprima bigliettino allegata (base64 JPEG): ${options.imagePreviewBase64}`);
    }
    userContentParts.push(`Bigliettino (campi: ${relevantFields.join(', ')}):\n${JSON.stringify(payload)}\n\nRichiesta: ${prompt}`);
    if (briefSection) {
      userContentParts.push(briefSection);
      // TB-027 auto-build: il brief deve guidare l'intera card, non solo i testi.
      userContentParts.push(
        'Usa il contesto cliente sopra per definire TUTTI gli aspetti del bigliettino: ' +
        'STRUTTURA (layout fronte e posizioni grid senza collisioni), TESTI (nome, titolo, servizi) ' +
        'e STILE (palette bgColor/textColor/accentColor, fontFamily, decorazioni). Non limitarti al copy.',
      );
    }

    const userMsg: ChatMessage = {
      role: 'user',
      content: userContentParts.join('\n\n'),
    };
    chatStore.addMessage(this.activeSessionId, userMsg);

    const wantsTools = !wantsAnalysis && provider.supportsTools && needsCardTools(prompt);
    const toolsDefs = wantsTools ? this.toolRegistry.getDefinitions() : undefined;

    const { response: aiResponse, providerId: finalProviderId } = await this.executeWithFallback(
      primaryProviderId,
      session.messages,
      {
        reasoningEffort: 'max',
        tools: toolsDefs,
        responseFormat: wantsTools ? undefined : (wantsAnalysis ? undefined : { type: 'json_object' }),
        requestId: options?.requestId,
        customerId: options?.customerId,
        sessionId: options?.sessionId,
        runId: options?.runId,
        runName: options?.runName,
        startRun: options?.startRun,
        rootSpanId: options?.rootSpanId,
        stepName: options?.stepName,
        stepSpanId: options?.stepSpanId,
      },
      { onStream: options?.onStream }
    );

    let currentCard = { ...card };

    // ─── ANALYSIS MODE ─────────────────────────────────
    if (wantsAnalysis) {
      chatStore.addMessage(this.activeSessionId!, {
        role: 'assistant',
        content: aiResponse.content || '',
      });
      const costUsd = this.trackUsage(aiResponse.usage, options?.userEmail, finalProviderId);
      return {
        card: currentCard,
        response: aiResponse,
        sessionId: this.activeSessionId!,
        changes: [],
        rawResponse: aiResponse.content || undefined,
        costUsd,
      };
    }

    // ─── TOOL MODE ─────────────────────────────────────
    if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
      chatStore.addMessage(this.activeSessionId!, {
        role: 'assistant',
        content: aiResponse.content || '',
        toolCalls: aiResponse.toolCalls,
        reasoningContent: aiResponse.reasoningContent,
      });

      for (const toolCall of aiResponse.toolCalls) {
        options?.onToolStart?.(toolCall.id, toolCall.function.name);
        const result = this.executeTool(toolCall, currentCard);
        chatStore.addMessage(this.activeSessionId!, {
          role: 'tool',
          content: result.changes,
          name: toolCall.function.name,
          toolCallId: toolCall.id,
        });
        options?.onToolComplete?.(toolCall.id, toolCall.function.name, result.changes);
        if (result.changes && !result.changes.startsWith('error:')) {
          changes.push(`tool:${toolCall.function.name}`);
        }
        currentCard = result.payload;
      }

      // Multi-turn: ask AI to produce final JSON after tools executed.
      try {
        const { payload: postToolPayload } = buildCardAIContext(currentCard, prompt);
        chatStore.addMessage(this.activeSessionId!, {
          role: 'user',
          content: `Bigliettino AGGIORNATO dopo i tool (usa QUESTO stato come base):\n${JSON.stringify(postToolPayload)}\n\nGenera il JSON finale del bigliettino. Mantieni le modifiche applicate dai tool e applica solo eventuali modifiche testuali aggiuntive richieste dal prompt.`,
        });

        const followUp = await provider.chat(session.messages, {
          reasoningEffort: 'max',
          responseFormat: { type: 'json_object' },
        });

        if (followUp.usage && aiResponse.usage) {
          aiResponse.usage = {
            promptTokens: aiResponse.usage.promptTokens + followUp.usage.promptTokens,
            completionTokens: aiResponse.usage.completionTokens + followUp.usage.completionTokens,
            totalTokens: aiResponse.usage.totalTokens + followUp.usage.totalTokens,
          };
        }

        if (followUp.content) {
          chatStore.addMessage(this.activeSessionId!, {
            role: 'assistant',
            content: followUp.content,
          });
          const cleanJson = this.sanitizeAIResponse(followUp.content);
          try {
            const modified = JSON.parse(cleanJson);
            const validation = aiCardInputSchema.safeParse(modified);
            if (!validation.success) {
              changes.push(`error:invalid_card_followup:${validation.error.issues.length}`);
            } else {
              const { card: merged, changes: mergeChanges } = mergeCardAIResponse(currentCard, modified);
              currentCard = merged;
              changes.push(...mergeChanges);
            }
          } catch {
            changes.push('error:followup_not_json');
          }
        }
      } catch (err) {
        changes.push(`error:followup_failed:${(err as Error).message?.slice(0, 100) || 'unknown'}`);
      }

      const costUsd = this.trackUsage(aiResponse.usage, options?.userEmail, finalProviderId);
      return {
        card: currentCard,
        response: aiResponse,
        sessionId: this.activeSessionId!,
        changes,
        rawResponse: aiResponse.content || undefined,
        costUsd,
      };
    }

    // ─── DIRECT MODIFY MODE ────────────────────────────
    chatStore.addMessage(this.activeSessionId!, {
      role: 'assistant',
      content: aiResponse.content || '',
    });

    if (aiResponse.content) {
      const cleanJson = this.sanitizeAIResponse(aiResponse.content);
      try {
        const modified = JSON.parse(cleanJson);
        const validation = aiCardInputSchema.safeParse(modified);
        if (!validation.success) {
          changes.push(`error:invalid_card:${validation.error.issues.length}`);
        } else {
          const { card: merged, changes: mergeChanges } = mergeCardAIResponse(currentCard, modified);
          currentCard = merged;
          changes.push(...mergeChanges);
        }
      } catch {
        changes.push('error:not_json');
      }
    } else {
      changes.push('error:empty');
    }

    const costUsd = this.trackUsage(aiResponse.usage, options?.userEmail, finalProviderId);
    return {
      card: currentCard,
      response: aiResponse,
      sessionId: this.activeSessionId!,
      changes,
      rawResponse: aiResponse.content || undefined,
      costUsd,
    };
  }
}
