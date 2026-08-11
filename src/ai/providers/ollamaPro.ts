import { BaseAIProvider } from './base';
import type { ChatMessage, ChatOptions, AIResponse, AIStreamChunk } from '../types';
import { getAiReasoningEffort } from '../../utils/uiPrefs';
import dataService from '../../utils/dataService';
import { currentUserEmail } from '../../utils/dataService/core';

/**
 * Ollama Pro Cloud provider (TB-023, spec-design-ai-harness-upgrade.md).
 *
 * API: https://ollama.com/api/chat (compatibile OpenAI/Ollama).
 * Auth: Bearer $OLLAMA_API_KEY (env, server-side only).
 * Pricing: $20/mo flat, 50x free usage, zero data retention.
 *
 * Body shape (Ollama ChatRequest):
 *   { model, messages, stream, tools, format, options }
 *
 * Response shape (Ollama ChatResponse):
 *   { model, created_at, message: { role, content, tool_calls },
 *     done, prompt_eval_count, eval_count, total_duration }
 *
 * Tokens: Ollama usa `prompt_eval_count` (input) + `eval_count` (output),
 * NON `usage.prompt_tokens` come DeepSeek. `parseOllamaUsage` normalizza.
 *
 * Multimodale (REQ-MM-001): MiniMax M3 supporta immagini base64 nei
 * messaggi user (`images: [base64]`). Metodo `chatWithImages` esposto.
 *
 * Streaming: NDJSON (newline-delimited JSON), NON SSE `data:` come
 * DeepSeek. Ogni chunk è un JSON object con `message.content` parziale.
 */
const API_URL = 'https://ollama.com/api/chat';
function isLocalhost() {
  if (typeof window !== 'undefined') {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }
  return false;
}
const IS_LOCAL = isLocalhost();

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface OllamaChatMessage extends ChatMessage {
  images?: string[];
}

export class OllamaProProvider extends BaseAIProvider {
  readonly name = 'Ollama';
  readonly model: string;
  readonly supportsStreaming = true;
  readonly supportsTools = true;
  readonly supportsVision: boolean;

  constructor(model = 'minimax-m3:cloud') {
    super();
    this.model = model;
    // MiniMax M3 e qwen-3.5 supportano vision; deepseek-v4-pro no.
    this.supportsVision = /minimax-m3|qwen-3\.5|gemma4|qwen3-vl/i.test(model);
  }

  async chat(
    messages: ChatMessage[],
    options?: ChatOptions & { images?: string[] }
  ): Promise<AIResponse> {
    const body = this.buildOllamaBody(messages, options, false);
    const requestId = options?.requestId ?? newRequestId();

    if (IS_LOCAL) {
      return this.callLocal(body, requestId);
    }
    return this.callProxy(body, requestId);
  }

  async *stream(
    messages: ChatMessage[],
    options?: ChatOptions & { images?: string[] }
  ): AsyncGenerator<AIStreamChunk> {
    const body = this.buildOllamaBody(messages, options, true);
    const requestId = options?.requestId ?? newRequestId();

    if (IS_LOCAL) {
      yield* this.streamLocal(body, requestId);
    } else {
      yield* this.streamProxy(body, requestId);
    }
  }

  /**
   * Multimodale (REQ-MM-001): invia immagini base64 inline nei messaggi
   * user. Solo per modelli con supportsVision=true (MiniMax M3).
   */
  async chatWithImages(
    messages: ChatMessage[],
    images: string[],
    options?: ChatOptions
  ): Promise<AIResponse> {
    if (!this.supportsVision) {
      return {
        content: null,
        usage: undefined,
        error: `Modello ${this.model} non supporta vision (immagini)`,
      } as any;
    }
    const enriched: OllamaChatMessage[] = messages.map((m, i) =>
      i === messages.length - 1 && m.role === 'user'
        ? { ...m, images }
        : { ...m }
    );
    return this.chat(enriched, options);
  }

  private buildOllamaBody(
    messages: ChatMessage[],
    options: ChatOptions & { images?: string[] } | undefined,
    stream: boolean
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: messages.map((m) => {
        const msg: Record<string, unknown> = { role: m.role, content: m.content };
        if (m.toolCallId) msg.tool_call_id = m.toolCallId;
        if (m.name) msg.name = m.name;
        if (m.reasoningContent) msg.thinking = m.reasoningContent;
        if (m.toolCalls && m.toolCalls.length > 0) {
          msg.tool_calls = m.toolCalls.map((tc) => ({
            function: { name: tc.function.name, arguments: tc.function.arguments },
          }));
        }
        // Images inline (multimodal) — Ollama vuole base64 PURO, senza
        // prefisso "data:image/...;base64," (400 illegal base64 altrimenti).
        const om = m as OllamaChatMessage;
        if (om.images && om.images.length > 0) {
          msg.images = om.images.map((img: string) => {
            const idx = img.indexOf(',');
            return img.startsWith('data:') && idx !== -1 ? img.slice(idx + 1) : img;
          });
        }
        return msg;
      }),
      stream,
      think: options?.reasoningEffort ?? getAiReasoningEffort(),
      ...(options?.maxTokens ? { options: { num_predict: options.maxTokens } } : {}),
      ...(options?.jsonSchema ? { format: options.jsonSchema } : {}),
      ...(options?.responseFormat?.type === 'json_object' ? { format: 'json' } : {}),
      ...(options?.tools && this.supportsTools ? { tools: options.tools } : {}),
      ...(options?.customerId ? { customerId: options.customerId } : {}),
      ...(options?.sessionId ? { sessionId: options.sessionId } : {}),
      ...(options?.kind ? { kind: options.kind } : {}),
    };
    return body;
  }

  private async callLocal(
    body: Record<string, unknown>,
    requestId: string
  ): Promise<AIResponse> {
    // In locale, passa per il dev proxy di Vite (/api/ai/chat con provider=ollama)
    // che gira server-side con OLLAMA_API_KEY. Stesso pattern DeepSeek.
    return this.callProxy(body, requestId);
  }

  private async callProxy(
    body: Record<string, unknown>,
    requestId: string
  ): Promise<AIResponse> {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
        'X-Provider': 'ollama',
      },
      body: JSON.stringify({ ...body, provider: 'ollama', requestId, userEmail: currentUserEmail() }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: 'unknown' }));
      const errMsg = (errBody as { error?: string }).error ?? `http_${res.status}`;
      if (res.status === 429) {
        throw new Error('Quota Ollama Pro superato. Riprova tra qualche ora o passa a DeepSeek.');
      }
      if (res.status === 503) {
        throw new Error('Ollama non configurato. Configura OLLAMA_API_KEY su Vercel.');
      }
      throw new Error(`Ollama (${res.status}): ${errMsg}`);
    }

    const data = await res.json();
    return this.parseOllamaResult(data);
  }

  private parseOllamaResult(data: any): AIResponse {
    // Proxy normalizza già in formato DeepSeek-like per parity.
    // Se il proxy passa through il body Ollama grezzo, adattiamo:
    if (data.choices?.[0]) {
      // Formato normalizzato (DeepSeek-like) dal proxy
      const choice = data.choices[0];
      return {
        content: choice.message?.content || null,
        toolCalls: this.parseToolCalls(choice),
        reasoningContent: choice.message?.reasoning_content || choice.message?.thinking || undefined,
        usage: this.parseUsage(data),
      };
    }
    // Formato Ollama raw
    const content = data.message?.content || null;
    const reasoningContent = data.message?.thinking || undefined;
    const toolCalls = data.message?.tool_calls?.map((tc: any) => ({
      id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'function' as const,
      function: {
        name: tc.function?.name || '',
        arguments:
          typeof tc.function?.arguments === 'string'
            ? tc.function.arguments
            : JSON.stringify(tc.function?.arguments ?? {}),
      },
    }));
    return {
      content,
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      reasoningContent,
      usage: this.parseOllamaUsage(data),
    };
  }

  private parseOllamaUsage(data: any): AIResponse['usage'] | undefined {
    const prompt = data.prompt_eval_count ?? 0;
    const completion = data.eval_count ?? 0;
    if (!prompt && !completion) return undefined;
    return {
      promptTokens: prompt,
      completionTokens: completion,
      totalTokens: prompt + completion,
    };
  }

  private async *streamLocal(
    body: Record<string, unknown>,
    requestId: string
  ): AsyncGenerator<AIStreamChunk> {
    yield* this.streamProxy(body, requestId);
  }

  private async *streamProxy(
    body: Record<string, unknown>,
    requestId: string
  ): AsyncGenerator<AIStreamChunk> {
    const res = await fetch('/api/ai/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
        'X-Provider': 'ollama',
      },
      body: JSON.stringify({ ...body, provider: 'ollama', requestId, userEmail: currentUserEmail() }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Stream error' }));
      yield { type: 'error', error: (err as { error?: string }).error || `Errore stream (${res.status})` };
      return;
    }

    // Il proxy normalizza SSE `data:` per parity col client DeepSeek.
    yield* this.parseSSEStream(res);
  }

  private async *parseSSEStream(res: Response): AsyncGenerator<AIStreamChunk> {
    const reader = res.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'Stream non disponibile' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let finalUsage: AIStreamChunk['usage'] | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') {
            yield { type: 'done', usage: finalUsage };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            // Formato normalizzato dal proxy (DeepSeek-like)
            if (parsed.usage) {
              finalUsage = {
                promptTokens: parsed.usage.prompt_tokens ?? 0,
                completionTokens: parsed.usage.completion_tokens ?? 0,
                totalTokens: parsed.usage.total_tokens ?? 0,
              };
            }
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.reasoning_content) {
              yield { type: 'content', content: '', reasoningContent: delta.reasoning_content };
            }
            if (delta?.thinking) {
              yield { type: 'content', content: '', reasoningContent: delta.thinking };
            }
            if (delta?.content) {
              yield { type: 'content', content: delta.content };
            }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                yield {
                  type: 'tool_call',
                  toolCall: {
                    id: tc.id || `call_${Date.now()}`,
                    type: 'function',
                    function: { name: tc.function.name, arguments: tc.function.arguments },
                  },
                };
              }
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
      yield { type: 'done', usage: finalUsage };
    } catch (err) {
      yield { type: 'error', error: err instanceof Error ? err.message : 'Errore stream' };
    }
  }
}