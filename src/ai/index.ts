import type { PremiumQuote } from '../utils/quoteSchema';
import { recalculateQuote } from '../utils/quoteSchema';
import type { AIProvider, ChatMessage, AIResponse, AIStreamChunk, AIToolCall, ProcessResult } from './types';
import { providerRegistry } from './providers/registry';
import { ToolRegistry } from './tools/registry';
import type { ToolResult } from '../utils/quoteTools';
import { chatStore } from './chat/store';
import { buildSystemPrompt } from './prompts/system';
import { buildAIContext } from './prompts/context';
import { mergeAIResponse } from './merge';

import {
  applyDiscount,
  adjustMargin,
  duplicateOption,
  recalculateTotals,
  reorderOptions,
  removeEmptyItems,
  mergeDuplicateItems,
  roundPrices,
  calculateAnnualCost,
  checkConsistency,
  validateQuoteTool,
  generateSummary,
} from '../utils/quoteTools';

function needsTools(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  const numericKeywords = ['sconto', 'discount', 'margine', 'margin', 'arrotonda', 'round',
    'ricalcola', 'recalculate', 'riordina', 'reorder', 'duplica', 'duplicate',
    'annuale', 'annual', 'unisci', 'merge'];
  return numericKeywords.some(kw => lower.includes(kw));
}

function sanitizeAIResponse(raw: string): string {
  let s = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    s = s.slice(firstBrace, lastBrace + 1);
  }
  return s;
}

export class AIOrchestrator {
  private activeSessionId: string | null = null;

  constructor() {
    this.registerTools();
  }

  private registerTools(): void {
    const registry = new ToolRegistry();

    registry.register('apply_discount', (args, quote) => {
      const { type, value, scope, targetId } = args as any;
      return applyDiscount(quote, { type, value, scope, targetId });
    });

    registry.register('adjust_margin', (args, quote) => {
      return adjustMargin(quote, args.targetMarginPercent as number);
    });

    registry.register('duplicate_option', (args, quote) => {
      return duplicateOption(quote, args.optionId as string);
    });

    registry.register('recalculate_totals', (_args, quote) => {
      return recalculateTotals(quote);
    });

    registry.register('reorder_options', (args, quote) => {
      return reorderOptions(quote, (args.sortBy as any) || 'price_asc');
    });

    registry.register('remove_empty_items', (_args, quote) => {
      return removeEmptyItems(quote);
    });

    registry.register('merge_duplicate_items', (_args, quote) => {
      return mergeDuplicateItems(quote);
    });

    registry.register('round_prices', (args, quote) => {
      return roundPrices(quote, (args.nearest as number) || 5);
    });

    registry.register('calculate_annual_cost', (_args, quote) => {
      return calculateAnnualCost(quote);
    });

    registry.register('check_consistency', (_args, quote) => {
      return checkConsistency(quote);
    });

    // validate_quote deliberately excluded: it never modifies the quote and misleads the AI

    (this as any)._toolRegistry = registry;
  }

  get toolRegistry(): ToolRegistry {
    return (this as any)._toolRegistry;
  }

  set toolRegistry(r: ToolRegistry) {
    (this as any)._toolRegistry = r;
  }

  getCurrentSessionId(): string | null {
    return this.activeSessionId;
  }

  resetSession(): void {
    if (this.activeSessionId) {
      chatStore.clearSession(this.activeSessionId);
    }
    this.activeSessionId = null;
  }

  async processPrompt(
    quote: PremiumQuote,
    userPrompt: string,
    options?: {
      modelId?: string;
      onStream?: (chunk: AIStreamChunk) => void;
      onToolStart?: (toolCallId: string, name: string) => void;
      onToolComplete?: (toolCallId: string, name: string, result: string) => void;
    }
  ): Promise<ProcessResult> {
    const provider = providerRegistry.getProvider(options?.modelId);
    const prompt = userPrompt.trim();
    const changes: string[] = [];

    if (!this.activeSessionId) {
      this.activeSessionId = chatStore.createSession().id;
    }

    const { payload, relevantFields } = buildAIContext(quote, prompt);

    const session = chatStore.getSession(this.activeSessionId)!;
    if (session.messages.length === 0) {
      session.messages.push({
        role: 'system',
        content: buildSystemPrompt(true),
      });
    }

    const userMsg: ChatMessage = {
      role: 'user',
      content: `Preventivo (campi: ${relevantFields.join(', ')}):\n${JSON.stringify(payload)}\n\nRichiesta: ${prompt}`,
    };
    chatStore.addMessage(this.activeSessionId, userMsg);

    const wantsTools = needsTools(prompt);
    let toolsDefs = (provider.supportsTools && wantsTools) ? this.toolRegistry.getDefinitions() : undefined;

    let aiResponse: AIResponse;
    let streamedContent = '';
    const streamedToolCalls = new Map<string, AIToolCall>();

    // Stream solo se servono tool e il provider supporta streaming.
    // Per edit testuali (wantsTools === false) usa chat sincrona con json_object.
    const canStream = wantsTools && options?.onStream && provider.supportsStreaming;

    if (canStream) {
      for await (const chunk of provider.stream(session.messages, {
        tools: toolsDefs,
        temperature: 0.7,
      })) {
        options.onStream!(chunk);

        if (chunk.type === 'content') {
          streamedContent += chunk.content || '';
        } else if (chunk.type === 'tool_call' && chunk.toolCall) {
          streamedToolCalls.set(chunk.toolCall.id, chunk.toolCall);
        } else if (chunk.type === 'error') {
          throw new Error(chunk.error);
        }
      }

      const toolCallsList = [...streamedToolCalls.values()];
      aiResponse = {
        content: streamedContent || null,
        toolCalls: toolCallsList.length > 0 ? toolCallsList : undefined,
      };
    } else {
      aiResponse = await provider.chat(session.messages, {
        tools: toolsDefs,
        temperature: wantsTools ? 0.7 : 0.2,
        responseFormat: wantsTools ? undefined : { type: 'json_object' },
      });
    }

    let currentQuote = { ...quote };

    if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
      chatStore.addMessage(this.activeSessionId!, {
        role: 'assistant',
        content: aiResponse.content || '',
        toolCalls: aiResponse.toolCalls,
      });

      for (const toolCall of aiResponse.toolCalls) {
        options?.onToolStart?.(toolCall.id, toolCall.function.name);

        let args: Record<string, unknown>;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = {};
        }

        const result: ToolResult = this.toolRegistry.execute(
          toolCall.function.name,
          args,
          currentQuote
        );

        chatStore.addMessage(this.activeSessionId!, {
          role: 'tool',
          content: result.changes,
          name: toolCall.function.name,
          toolCallId: toolCall.id,
        });

        options?.onToolComplete?.(toolCall.id, toolCall.function.name, result.changes);

        if (result.changes) {
          changes.push(`tool:${toolCall.function.name}`);
        }
        currentQuote = result.quote as PremiumQuote;
      }

      if (!currentQuote.updatedAt || currentQuote.updatedAt === quote.updatedAt) {
        currentQuote = { ...currentQuote, updatedAt: new Date().toISOString() };
      }

      return {
        quote: currentQuote,
        response: aiResponse,
        sessionId: this.activeSessionId!,
        changes,
        rawResponse: aiResponse.content || undefined,
      };
    }

    chatStore.addMessage(this.activeSessionId!, {
      role: 'assistant',
      content: aiResponse.content || 'Modifiche applicate.',
    });

    if (aiResponse.content) {
      const cleanJson = sanitizeAIResponse(aiResponse.content);
      try {
        const modified = JSON.parse(cleanJson);
        const { quote: merged, changes: mergeChanges } = mergeAIResponse(currentQuote, modified);
        currentQuote = merged;
        changes.push(...mergeChanges);
      } catch {
        changes.push(`error:not_json`);
      }
    } else {
      changes.push(`error:empty`);
    }

    if (!currentQuote.updatedAt || currentQuote.updatedAt === quote.updatedAt) {
      currentQuote = { ...currentQuote, updatedAt: new Date().toISOString() };
    }

    return {
      quote: currentQuote,
      response: aiResponse,
      sessionId: this.activeSessionId,
      changes,
      rawResponse: aiResponse.content || undefined,
    };
  }

  getProviderList(): { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean }[] {
    return providerRegistry.listProviders();
  }
}
