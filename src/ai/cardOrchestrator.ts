import type { BusinessCard } from '../utils/documentSchemas';
import type { AIProvider, ChatMessage, AIResponse, AIStreamChunk, AIToolCall } from './types';
import { providerRegistry } from './providers/registry';
import { chatStore } from './chat/store';
import { buildCardSystemPrompt } from './prompts/cardSystem';
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
}

const CARD_TOOLS = [
  'card_apply_palette',
  'card_switch_layout',
  'card_add_service',
  'card_remove_empty_socials',
];

export class CardAIOrchestrator extends ToolAwareOrchestrator<BusinessCard> {
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
      onStream?: (chunk: AIStreamChunk) => void;
      onToolStart?: (toolCallId: string, name: string) => void;
      onToolComplete?: (toolCallId: string, name: string, result: string) => void;
      requestId?: string;
    },
  ): Promise<CardProcessResult> {
    const provider = providerRegistry.getProvider(options?.modelId);
    const prompt = userPrompt.trim();
    const changes: string[] = [];

    if (!this.activeSessionId) {
      this.activeSessionId = chatStore.createSession().id;
    }

    const { payload, relevantFields } = buildCardAIContext(card, prompt);

    const session = chatStore.getSession(this.activeSessionId)!;
    if (session.messages.length === 0) {
      session.messages.push({
        role: 'system',
        content: buildCardSystemPrompt(),
      });
    }

    const userMsg: ChatMessage = {
      role: 'user',
      content: `Bigliettino (campi: ${relevantFields.join(', ')}):\n${JSON.stringify(payload)}\n\nRichiesta: ${prompt}`,
    };
    chatStore.addMessage(this.activeSessionId, userMsg);

    const wantsAnalysis = needsAnalysis(prompt);
    const wantsTools = !wantsAnalysis && provider.supportsTools && needsCardTools(prompt);
    const toolsDefs = wantsTools ? this.toolRegistry.getDefinitions() : undefined;

    let aiResponse: AIResponse;
    let streamedContent = '';
    let streamedToolCalls = new Map<string, AIToolCall>();
    let streamedUsage: AIResponse['usage'] | undefined;

    const canStream = !!options?.onStream && provider.supportsStreaming;

    if (canStream) {
      for await (const chunk of provider.stream(session.messages, {
        temperature: wantsAnalysis ? 0.3 : 0.4,
        tools: toolsDefs,
        responseFormat: wantsTools ? undefined : (wantsAnalysis ? undefined : { type: 'json_object' }),
        requestId: options?.requestId,
      })) {
        options.onStream!(chunk);

        if (chunk.type === 'content') {
          streamedContent += chunk.content || '';
        } else if (chunk.type === 'tool_call' && chunk.toolCall) {
          streamedToolCalls.set(chunk.toolCall.id, chunk.toolCall);
        } else if (chunk.type === 'done' && chunk.usage) {
          streamedUsage = chunk.usage;
        } else if (chunk.type === 'error') {
          throw new Error(chunk.error);
        }
      }

      aiResponse = {
        content: streamedContent || null,
        toolCalls: streamedToolCalls.size > 0 ? [...streamedToolCalls.values()] : undefined,
        usage: streamedUsage,
      };
    } else {
      aiResponse = await provider.chat(session.messages, {
        temperature: wantsAnalysis ? 0.3 : 0.4,
        tools: toolsDefs,
        responseFormat: wantsTools ? undefined : (wantsAnalysis ? undefined : { type: 'json_object' }),
        requestId: options?.requestId,
      });
    }

    let currentCard = { ...card };

    // ─── ANALYSIS MODE ─────────────────────────────────
    if (wantsAnalysis) {
      chatStore.addMessage(this.activeSessionId!, {
        role: 'assistant',
        content: aiResponse.content || '',
      });
      return {
        card: currentCard,
        response: aiResponse,
        sessionId: this.activeSessionId!,
        changes: [],
        rawResponse: aiResponse.content || undefined,
      };
    }

    // ─── TOOL MODE ─────────────────────────────────────
    if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
      chatStore.addMessage(this.activeSessionId!, {
        role: 'assistant',
        content: aiResponse.content || '',
        toolCalls: aiResponse.toolCalls,
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
          temperature: 0.4,
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

      return {
        card: currentCard,
        response: aiResponse,
        sessionId: this.activeSessionId!,
        changes,
        rawResponse: aiResponse.content || undefined,
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

    return {
      card: currentCard,
      response: aiResponse,
      sessionId: this.activeSessionId!,
      changes,
      rawResponse: aiResponse.content || undefined,
    };
  }
}
