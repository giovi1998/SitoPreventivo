import { z } from 'zod';
import { chatStore } from './chat/store';
import { providerRegistry } from './providers/registry';
import { ToolRegistry } from './tools/registry';
import dataService from '../utils/dataService';
import { calculateCostUsd } from './providerPricing';
import { getAiAutoFallback } from '../utils/uiPrefs';
import type { ChatMessage, AIResponse, AIStreamChunk, AIProvider, AIToolCall, ToolExecutor, ToolResult, RunTraceOptions } from './types';

type AIUsage = NonNullable<AIResponse['usage']>;

/**
 * Base abstract class for all AI orchestrators (quote, card, flyer,
 * future logo/social/onboarding). Centralizes the boilerplate that
 * was duplicated across 3 orchestrators (~150 LOC of pure waste):
 *
 * - session management via chatStore
 * - sanitizeAIResponse (markdown fence + JSON extraction)
 * - parseJsonResponse with optional Zod schema
 * - handleStream for real-time stream chunks (content/tool/done/error)
 * - getProviderList delegation to providerRegistry
 * - trackUsage with admin short-circuit
 *
 * Subclasses (AIOrchestrator, CardAIOrchestrator, FlyerAIOrchestrator,
 * future LogoAIOrchestrator / SocialAIOrchestrator /
 * OnboardingAIOrchestrator) implement their own `processPrompt` /
 * `generate*` / `refine*` methods, optionally calling the protected
 * helpers to keep the flow DRY.
 *
 * NOTE: Tool-aware subclasses should also extend `ToolAwareOrchestrator`
 * (defined below), which adds the shared `registerTools` /
 * `toolRegistry` plumbing. Base itself does NOT know about tools: that
 * concern belongs to the next level of the hierarchy.
 */
export abstract class BaseOrchestrator {
  protected activeSessionId: string | null = null;
  protected chatStore = chatStore;
  /** TB-029: feature tag Langfuse per l'orchestratore (override nei subclass). */
  protected aiKind = 'chat';

  getCurrentSessionId(): string | null {
    return this.activeSessionId;
  }

  resetSession(): void {
    if (this.activeSessionId) {
      this.chatStore.clearSession(this.activeSessionId);
    }
    this.activeSessionId = null;
  }

  /**
   * Returns the active session id, creating a fresh one in chatStore
   * if none exists. Pure helper for subclasses.
   */
  protected ensureSession(): string {
    if (!this.activeSessionId) {
      this.activeSessionId = this.chatStore.createSession().id;
    }
    return this.activeSessionId;
  }

  /**
   * Strip markdown code fences and extract the first balanced JSON
   * object or array. Defensive in depth: DeepSeek occasionally wraps
   * responses in ```json ... ``` even when json_object is requested,
   * and may prepend/append a short explanation. Arrays are valid for
   * logo concepts and other multi-output prompts.
   */
  protected sanitizeAIResponse(raw: string): string {
    let s = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    const extracted = extractBalancedJson(s);
    return extracted ?? s;
  }

  /**
   * Parse a (sanitized) AI response string into a typed object.
   * If a Zod schema is provided, `safeParse` is used and a non-ok
   * result returns `{ ok: false, error: <issues> }` without throwing.
   */
  protected parseJsonResponse<T>(
    raw: string,
    schema?: z.ZodType<T>
  ): { ok: true; data: T } | { ok: false; error: string } {
    const clean = this.sanitizeAIResponse(raw);
    let parsed: unknown;
    try {
      parsed = JSON.parse(clean);
    } catch (err) {
      return { ok: false, error: `not_json: ${(err as Error).message?.slice(0, 100) || 'unknown'}` };
    }
    if (schema) {
      const result = schema.safeParse(parsed);
      if (!result.success) {
        const details = result.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join(' | ');
        return { ok: false, error: `schema_fail: ${result.error.issues.length} issues (${details})` };
      }
      return { ok: true, data: result.data };
    }
    return { ok: true, data: parsed as T };
  }


  /**
   * Build the initial system+user message pair and persist them in the
   * active session. Returns the messages array ready to be sent to the
   * provider. The caller is responsible for any follow-up messages
   * (e.g. tool results) and for closing the assistant turn.
   */
  protected buildMessages(
    systemPrompt: string,
    userPrompt: string,
    extras?: ChatMessage[]
  ): ChatMessage[] {
    const sessionId = this.ensureSession();
    const session = this.chatStore.getSession(sessionId);
    if (!session) {
      throw new Error(`Sessione non trovata: ${sessionId}`);
    }
    const messages: ChatMessage[] = [];
    if (session.messages.length === 0) {
      const systemMsg: ChatMessage = { role: 'system', content: systemPrompt };
      messages.push(systemMsg);
      this.chatStore.addMessage(sessionId, systemMsg);
    } else {
      messages.push(...session.messages);
    }
    const userMsg: ChatMessage = { role: 'user', content: userPrompt };
    messages.push(userMsg);
    this.chatStore.addMessage(sessionId, userMsg);
    if (extras) {
      for (const m of extras) {
        messages.push(m);
        this.chatStore.addMessage(sessionId, m);
      }
    }
    return messages;
  }

  /**
   * Consume a stream from a provider, accumulating content/toolCalls/usage
   * into a single AIResponse. Mirrors the inline streaming logic that was
   * duplicated in AIOrchestrator and CardAIOrchestrator.
   *
   * TB-023: se `autoFallback` è abilitato e la chiamata fallisce con errore
   * transitorio (429/504/network/timeout), riprova automaticamente con il
   * provider di fallback una sola volta.
   */
  protected async executeWithFallback(
    primaryProviderId: string,
    messages: ChatMessage[],
    options: {
      tools?: unknown;
      reasoningEffort?: 'low' | 'high' | 'max';
      responseFormat?: { type: 'json_object' };
      requestId?: string;
      customerId?: string;
      sessionId?: string;
      kind?: string;
    } & RunTraceOptions = {},
    callbacks: {
      onStream?: (chunk: AIStreamChunk) => void;
      onFallback?: (fallbackId: string, reason: string) => void;
    } = {}
  ): Promise<{ response: AIResponse; providerId: string; didFallback: boolean }> {
    const autoFallback = getAiAutoFallback();
    const run = async (providerId: string) => {
      const provider = providerRegistry.getProvider(providerId);
      const response = await this.handleStream(provider, messages, options, callbacks);
      return { response, providerId, didFallback: false };
    };

    try {
      return await run(primaryProviderId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!autoFallback || !isTransientAiError(msg)) throw err;
      const fallback = providerRegistry.getFallbackProvider(primaryProviderId);
      if (!fallback) throw err;
      callbacks.onFallback?.(fallback.id, msg);
      const result = await run(fallback.id);
      return { ...result, didFallback: true };
    }
  }

  /**
   * Consume a stream from a provider, accumulating content/toolCalls/usage
   * into a single AIResponse. Mirrors the inline streaming logic that was
   * duplicated in AIOrchestrator and CardAIOrchestrator.
   */
  protected async handleStream(
    provider: AIProvider,
    messages: ChatMessage[],
    options: {
      tools?: unknown;
      reasoningEffort?: 'low' | 'high' | 'max';
      maxTokens?: number;
      responseFormat?: { type: 'json_object' };
      requestId?: string;
      /** TB-029: attribuzione Langfuse per-cliente. */
      customerId?: string;
      /** TB-029: sessione Langfuse (docId: raggruppa chat+immagini del documento). */
      sessionId?: string;
      /** TB-029: feature tag Langfuse (quote/card/flyer/...). */
      kind?: string;
    } & RunTraceOptions = {},
    callbacks: {
      onStream?: (chunk: AIStreamChunk) => void;
    } = {}
  ): Promise<AIResponse> {
    let content = '';
    let reasoningContent = '';
    const toolCalls = new Map<string, AIToolCall>();
    let usage: AIUsage | undefined;
    const providerOptions = { ...options, kind: options.kind ?? this.aiKind } as Parameters<AIProvider['chat']>[1];

    if (callbacks.onStream && provider.supportsStreaming) {
      for await (const chunk of provider.stream(messages, providerOptions)) {
        callbacks.onStream(chunk);
        if (chunk.type === 'content') {
          content += chunk.content || '';
          reasoningContent += chunk.reasoningContent || '';
        } else if (chunk.type === 'tool_call' && chunk.toolCall) {
          toolCalls.set(chunk.toolCall.id, chunk.toolCall);
        } else if (chunk.type === 'done' && chunk.usage) {
          usage = chunk.usage;
        } else if (chunk.type === 'error') {
          throw new Error(chunk.error);
        }
      }
      const toolCallsList = [...toolCalls.values()];
      return {
        content: content || null,
        toolCalls: toolCallsList.length > 0 ? toolCallsList : undefined,
        reasoningContent: reasoningContent || undefined,
        usage,
      };
    }

    return await provider.chat(messages, providerOptions);
  }

  /**
   * Track token usage server-side, skipping the admin who never gets
   * charged. Defers the actual call to dataService so the same
   * accounting happens regardless of which orchestrator produced the
   * usage. Silent on errors to avoid breaking the user-facing flow.
   *
   * TB-023: calcola costUsd tramite providerPricing e lo passa a
   * dataService.trackTokens. Ritorna il costo calcolato così i chiamanti
   * possono loggarlo inline nelle AILogEntry.
   */
  protected trackUsage(
    usage: AIUsage | undefined,
    userEmail?: string,
    providerId?: string,
  ): number {
    if (!usage) return 0;
    const totalTokens = usage.totalTokens ?? (usage.promptTokens + usage.completionTokens);
    if (!totalTokens) return 0;
    const costUsd = providerId ? calculateCostUsd(providerId, usage) : 0;
    // Admin non viene tracciato server-side ma il costo va comunque calcolato
    // per mostrarlo nel badge (lastCostUsd).
    if (!userEmail || userEmail === 'admin@gmail.com') return costUsd;
    try {
      dataService.trackTokens(userEmail, totalTokens, costUsd);
    } catch {
      // Silent on errors to avoid breaking the user-facing flow.
    }
    return costUsd;
  }

  getProviderList(): { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean; supportsVision: boolean }[] {
    return providerRegistry.listProviders();
  }
}

/**
 * Shared orchestrator subclass that adds tool support. Subclasses provide:
 * - `applicableTools()`: which tool names this orchestrator exposes
 * - `registerExecutors(registry)`: which executors handle those tools
 *
 * This replaces the per-orchestrator inline registerTools in AIOrchestrator
 * and extends tool calling to CardAIOrchestrator and FlyerAIOrchestrator.
 */
export abstract class ToolAwareOrchestrator<T = unknown> extends BaseOrchestrator {
  private _toolRegistry: ToolRegistry<T>;

  constructor() {
    super();
    this._toolRegistry = new ToolRegistry<T>();
    this._toolRegistry.filterDefinitions(this.applicableTools());
    this.registerExecutors(this._toolRegistry);
  }

  protected abstract applicableTools(): string[];
  protected abstract registerExecutors(registry: ToolRegistry<T>): void;

  get toolRegistry(): ToolRegistry<T> {
    return this._toolRegistry;
  }

  set toolRegistry(registry: ToolRegistry<T>) {
    this._toolRegistry = registry;
  }

  protected executeTool(toolCall: AIToolCall, payload: T): ToolResult<T> {
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch {
      return { payload, changes: `error:invalid_args:${toolCall.function.name}:args non JSON` };
    }
    return this.toolRegistry.execute(toolCall.function.name, args, payload);
  }
}

function isTransientAiError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('429') ||
    m.includes('504') ||
    m.includes('timeout') ||
    m.includes('timed out') ||
    m.includes('errore di rete') ||
    m.includes('networkerror') ||
    m.includes('failed to fetch') ||
    m.includes('troppe richieste') ||
    m.includes('gateway')
  );
}

/**
 * Extract the first balanced JSON object or array from a string that may
 * contain surrounding text/markdown. Handles nested braces/brackets and
 * quoted strings (including escaped quotes).
 */
function extractBalancedJson(s: string): string | null {
  const trimmed = s.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    return trimmed;
  }
  const startObj = s.indexOf('{');
  const startArr = s.indexOf('[');
  let start = -1;
  let openChar = '';
  let closeChar = '';
  if (startObj === -1) {
    start = startArr;
    openChar = '[';
    closeChar = ']';
  } else if (startArr === -1) {
    start = startObj;
    openChar = '{';
    closeChar = '}';
  } else {
    start = Math.min(startObj, startArr);
    openChar = start === startObj ? '{' : '[';
    closeChar = openChar === '{' ? '}' : ']';
  }
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (c === '\\') {
        escaped = true;
      } else if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === openChar) {
      depth++;
    } else if (c === closeChar) {
      depth--;
      if (depth === 0) {
        return s.slice(start, i + 1);
      }
    }
  }
  return null;
}
