import type { PremiumQuote } from '../utils/quoteSchema';
import { recalculateQuote } from '../utils/quoteSchema';
import { aiInputQuoteSchema } from './aiQuoteInputSchema';
import type { AIProvider, ChatMessage, AIResponse, AIStreamChunk, AIToolCall, ProcessResult } from './types';
import { providerRegistry } from './providers/registry';
import { ToolRegistry } from './tools/registry';
import { getToolDefinition } from './tools/definitions';
import type { ToolResult } from '../utils/quoteTools';
import { chatStore } from './chat/store';
import { buildSystemPrompt } from './prompts/system';
import { buildAIContext } from './prompts/context';
import { mergeAIResponse } from './merge';
import { needsAnalysis } from './promptUtils';

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
  splitQuoteByOption,
  mergeOptions,
  validateQuoteTool,
} from '../utils/quoteTools';

export function needsTools(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  const numericKeywords = ['sconto', 'discount', 'margine', 'margin', 'arrotonda', 'round',
    'ricalcola', 'recalculate', 'riordina', 'reorder', 'duplica', 'duplicate',
    'annuale', 'annual', 'unisci', 'merge',
    'rimuovi', 'remove', 'vuot', 'zero', 'empty',
    'verific', 'verify', 'consisten', 'coeren', 'check',
    'lascia solo', 'mantieni solo', 'split', 'togli opzion'];
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

/**
 * Validate a tool's arguments against the JSON schema declared in
 * TOOL_DEFINITIONS. Returns the parsed args if valid, or null if invalid
 * (or the tool is not registered).
 *
 * The AI sometimes returns malformed arguments (missing required fields,
 * wrong types, etc.). Without this check, the tool would receive a
 * partial object and the resulting calculation would silently produce
 * NaN or stale data, corrupting the quote. Better to skip the tool
 * and surface an error to the user.
 */
function validateToolArgs(name: string, rawArgs: string): { ok: true; args: Record<string, unknown> } | { ok: false; error: string } {
  const def = getToolDefinition(name);
  if (!def) return { ok: false, error: `Tool non registrato: ${name}` };

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArgs);
  } catch {
    return { ok: false, error: `args non è JSON valido: ${rawArgs.slice(0, 100)}` };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: `args deve essere un oggetto, ricevuto: ${typeof parsed}` };
  }
  const args = parsed as Record<string, unknown>;

  const params = def.function.parameters as {
    required?: string[];
    properties?: Record<string, { type?: string; enum?: unknown[]; minimum?: number; min?: number }>;
  } | undefined;
  const required = params?.required ?? [];
  for (const key of required) {
    if (!(key in args)) {
      return { ok: false, error: `manca campo required: ${key}` };
    }
    const v = args[key];
    if (v === undefined || v === null) {
      return { ok: false, error: `campo required null/undefined: ${key}` };
    }
  }

  // Validate type/enum for all provided args (bug #3)
  const properties = params?.properties ?? {};
  for (const [key, value] of Object.entries(args)) {
    const schema = properties[key];
    if (!schema) continue;
    if (schema.type === 'string' && typeof value !== 'string') {
      return { ok: false, error: `campo ${key}: expected string, got ${typeof value}` };
    }
    if (schema.type === 'number' && typeof value !== 'number') {
      return { ok: false, error: `campo ${key}: expected number, got ${typeof value}` };
    }
    if (schema.type === 'boolean' && typeof value !== 'boolean') {
      return { ok: false, error: `campo ${key}: expected boolean, got ${typeof value}` };
    }
    if (schema.enum && !schema.enum.includes(value)) {
      return { ok: false, error: `campo ${key}: valore "${String(value)}" non valido, ammessi: ${schema.enum.join(', ')}` };
    }
    if (schema.type === 'number') {
      const min = schema.minimum ?? schema.min;
      if (min !== undefined && typeof value === 'number' && value < min) {
        return { ok: false, error: `campo ${key}: valore ${value} minore del minimo ${min}` };
      }
    }
  }
  return { ok: true, args };
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

    registry.register('split_quote', (args, quote) => {
      return splitQuoteByOption(quote, args.optionIds as string[]);
    });

    registry.register('merge_options', (args, quote) => {
      return mergeOptions(quote, args.optionIds as string[]);
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

    const wantsAnalysis = needsAnalysis(prompt);
    const wantsTools = !wantsAnalysis && needsTools(prompt);
    let toolsDefs = (provider.supportsTools && wantsTools) ? this.toolRegistry.getDefinitions() : undefined;

    let aiResponse: AIResponse;
    let streamedContent = '';
    const streamedToolCalls = new Map<string, AIToolCall>();
    let streamedUsage: AIResponse['usage'] | undefined;

    // Stream sempre se il provider supporta streaming e l'hook ha passato onStream.
    // Questo dà feedback real-time all'utente sia per le risposte testuali che per i tool.
    const canStream = !!options?.onStream && provider.supportsStreaming;

    if (canStream) {
      for await (const chunk of provider.stream(session.messages, {
        tools: toolsDefs,
        temperature: wantsTools ? 0.7 : 0.2,
        responseFormat: wantsTools ? undefined : (wantsAnalysis ? undefined : { type: 'json_object' }),
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

      const toolCallsList = [...streamedToolCalls.values()];
      aiResponse = {
        content: streamedContent || null,
        toolCalls: toolCallsList.length > 0 ? toolCallsList : undefined,
        usage: streamedUsage,
      };
    } else {
      aiResponse = await provider.chat(session.messages, {
        tools: toolsDefs,
        temperature: wantsTools ? 0.7 : 0.2,
        responseFormat: wantsTools ? undefined : (wantsAnalysis ? undefined : { type: 'json_object' }),
      });
    }

    let currentQuote = { ...quote };

    // ─── MODALITÀ ANALISI ─────────────────────────────────
    // Se l'utente ha chiesto suggerimenti/analisi (parole chiave in
    // promptUtils.needsAnalysis), NON eseguiamo tool e NON applichiamo
    // merge. La risposta AI è solo testo libero. Il client la mostra
    // all'utente come suggerimento, non come modifica del preventivo.
    if (wantsAnalysis) {
      chatStore.addMessage(this.activeSessionId!, {
        role: 'assistant',
        content: aiResponse.content || '',
      });
      return {
        quote: currentQuote, // nessuna modifica
        response: aiResponse,
        sessionId: this.activeSessionId!,
        changes: [], // nessuna modifica applicata
        rawResponse: aiResponse.content || undefined,
      };
    }

    if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
      chatStore.addMessage(this.activeSessionId!, {
        role: 'assistant',
        content: aiResponse.content || '',
        toolCalls: aiResponse.toolCalls,
      });

      for (const toolCall of aiResponse.toolCalls) {
        options?.onToolStart?.(toolCall.id, toolCall.function.name);

        const validated = validateToolArgs(toolCall.function.name, toolCall.function.arguments);
        if (!validated.ok) {
          // args malformati: logga e skip. Il quote non viene corrotto.
          changes.push(`error:invalid_args:${toolCall.function.name}:${validated.error}`);
          chatStore.addMessage(this.activeSessionId!, {
            role: 'tool',
            content: `Argomenti non validi: ${validated.error}`,
            name: toolCall.function.name,
            toolCallId: toolCall.id,
          });
          options?.onToolComplete?.(toolCall.id, toolCall.function.name, `Error: ${validated.error}`);
          continue;
        }

        const result: ToolResult = this.toolRegistry.execute(
          toolCall.function.name,
          validated.args,
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

      // ─── MULTI-TURN OBBLIGATORIO ───────────────────
      // L'AI riceve i risultati dei tool eseguiti e genera la sintesi finale.
      // Usa json_object (non tool calling) per evitare loop infiniti.
      //
      // IMPORTANTE: aggiungiamo un messaggio user con lo stato POST-TOOL del
      // preventivo, così l'AI genera il JSON finale basandosi sullo stato
      // aggiornato (con sconti/margini/arrotondamenti già applicati).
      // Senza questo, l'AI userebbe il quote originale visto nel primo
      // messaggio user e revertirebbe le modifiche dei tool (bug #2).
      try {
        const { payload: postToolPayload } = buildAIContext(currentQuote, prompt);
        chatStore.addMessage(this.activeSessionId!, {
          role: 'user',
          content: `Preventivo AGGIORNATO dopo l'esecuzione dei tool (usa QUESTO stato come base, non il precedente):\n${JSON.stringify(postToolPayload)}\n\nGenera il JSON finale del preventivo. Mantieni le modifiche applicate dai tool (sconti, prezzi, ecc.) e applica solo eventuali modifiche testuali aggiuntive richieste dal prompt originale.`,
        });

        const followUp = await provider.chat(session.messages, {
          temperature: 0.4,
          responseFormat: { type: 'json_object' },
        });

        if (followUp.usage) {
          const prev = aiResponse.usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
          aiResponse.usage = {
            promptTokens: prev.promptTokens + followUp.usage.promptTokens,
            completionTokens: prev.completionTokens + followUp.usage.completionTokens,
            totalTokens: prev.totalTokens + followUp.usage.totalTokens,
          };
        }

        if (followUp.content) {
          chatStore.addMessage(this.activeSessionId!, {
            role: 'assistant',
            content: followUp.content,
          });

          const cleanJson = sanitizeAIResponse(followUp.content);
          try {
            const modified = JSON.parse(cleanJson);
            const validation = aiInputQuoteSchema.safeParse(modified);
            if (!validation.success) {
              changes.push(`error:invalid_quote_followup:${validation.error.issues.length}`);
            } else {
              const { quote: merged, changes: mergeChanges } = mergeAIResponse(currentQuote, modified, { preserveNumeric: true });
              currentQuote = merged;
              changes.push(...mergeChanges);
            }
          } catch {
            changes.push('error:followup_not_json');
          }
        }
      } catch (err) {
        changes.push(`error:followup_failed:${(err as Error).message?.slice(0, 100) || 'unknown'}`);
      }

      if (changes.length === 0) {
        return {
          quote,
          response: aiResponse,
          sessionId: this.activeSessionId!,
          changes,
          rawResponse: aiResponse.content || undefined,
        };
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
        const validation = aiInputQuoteSchema.safeParse(modified);
        if (!validation.success) {
          changes.push(`error:invalid_quote:${validation.error.issues.length}`);
        } else {
          const { quote: merged, changes: mergeChanges } = mergeAIResponse(currentQuote, modified);
          currentQuote = merged;
          changes.push(...mergeChanges);
        }
      } catch {
        changes.push(`error:not_json`);
      }
    } else {
      changes.push(`error:empty`);
    }

    // Bug #14: only bump updatedAt if there were actual modifications.
    // Filter out error entries, they don't count as real changes.
    const hasRealChanges = changes.some((c) => !c.startsWith('error:'));
    if (hasRealChanges && (!currentQuote.updatedAt || currentQuote.updatedAt === quote.updatedAt)) {
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
