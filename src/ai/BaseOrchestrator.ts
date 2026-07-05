import { z } from 'zod';
import { chatStore } from './chat/store';
import { providerRegistry } from './providers/registry';
import type { ChatMessage, AIResponse, AIStreamChunk, AIProvider, AIToolCall } from './types';

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
   * Strip markdown code fences and extract the first balanced {...}
   * substring. Defensive in depth: DeepSeek occasionally wraps responses
   * in ```json ... ``` even when json_object is requested, and may
   * prepend/append a short explanation.
   */
  protected sanitizeAIResponse(raw: string): string {
    let s = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    const firstBrace = s.indexOf('{');
    const lastBrace = s.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      s = s.slice(firstBrace, lastBrace + 1);
    }
    return s;
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
        return { ok: false, error: `schema_fail: ${result.error.issues.length} issues` };
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
   */
  protected async handleStream(
    provider: AIProvider,
    messages: ChatMessage[],
    options: {
      tools?: unknown;
      temperature?: number;
      responseFormat?: { type: 'json_object' };
    } = {},
    callbacks: {
      onStream?: (chunk: AIStreamChunk) => void;
    } = {}
  ): Promise<AIResponse> {
    let content = '';
    const toolCalls = new Map<string, AIToolCall>();
    let usage: AIUsage | undefined;

    if (callbacks.onStream && provider.supportsStreaming) {
      for await (const chunk of provider.stream(messages, options as Parameters<AIProvider['stream']>[1])) {
        callbacks.onStream(chunk);
        if (chunk.type === 'content') {
          content += chunk.content || '';
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
        usage,
      };
    }

    return await provider.chat(messages, options as Parameters<AIProvider['chat']>[1]);
  }

  /**
   * Track token usage server-side, skipping the admin who never gets
   * charged. Defers the actual call to dataService so the same
   * accounting happens regardless of which orchestrator produced the
   * usage. Silent on errors to avoid breaking the user-facing flow.
   */
  protected trackUsage(usage: AIUsage | undefined, userEmail?: string): void {
    if (!usage) return;
    if (!userEmail || userEmail === 'admin@gmail.com') return;
    const totalTokens = usage.totalTokens ?? (usage.promptTokens + usage.completionTokens);
    if (!totalTokens) return;
    try {
      const mod = require('../utils/dataService') as typeof import('../utils/dataService');
      mod.default?.trackTokens?.(userEmail, totalTokens);
    } catch {
      // dataService is client-only; in tests/serverless it may not be reachable
    }
  }

  getProviderList(): { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean }[] {
    return providerRegistry.listProviders();
  }
}
