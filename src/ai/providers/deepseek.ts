import { BaseAIProvider } from './base';
import type { ChatMessage, ChatOptions, AIResponse, AIStreamChunk } from '../types';
import dataService from '../../utils/dataService';

const API_URL = 'https://api.deepseek.com/v1/chat/completions';
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export class DeepSeekProvider extends BaseAIProvider {
  readonly name = 'DeepSeek';
  readonly model: string;
  readonly supportsStreaming = true;
  readonly supportsTools = true;

  constructor(model = 'deepseek-chat') {
    super();
    this.model = model;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<AIResponse> {
    const body = this.buildRequestBody(messages, options);

    if (IS_LOCAL) {
      return this.callLocal(body);
    }

    return this.callProxy(body);
  }

  async *stream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<AIStreamChunk> {
    const body = this.buildRequestBody(messages, { ...options, stream: true });

    if (IS_LOCAL) {
      yield* this.streamLocal(body);
    } else {
      yield* this.streamProxy(body);
    }
  }

  private async callLocal(body: Record<string, unknown>): Promise<AIResponse> {
    const key = await dataService.getDeepseekKey();
    if (!key) {
      return {
        content: null,
        usage: undefined,
        error: 'Chiave DeepSeek non configurata',
      } as any;
    }

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });

    return this.handleResponse(res);
  }

  private async callProxy(body: Record<string, unknown>): Promise<AIResponse> {
    const result = await dataService.chatWithAI(body as any);
    if (result.error) throw new Error(result.error);
    return this.parseResult(result);
  }

  private async handleResponse(res: Response): Promise<AIResponse> {
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      if (res.status === 402) throw new Error('Credito DeepSeek esaurito. Ricarica su platform.deepseek.com');
      if (res.status === 401) throw new Error('Chiave API DeepSeek non valida');
      if (res.status === 429) throw new Error('Troppe richieste a DeepSeek. Attendi qualche secondo e riprova.');
      throw new Error(`DeepSeek (${res.status}): ${errBody.substring(0, 200)}`);
    }
    const data = await res.json();
    return this.parseResult(data);
  }

  private parseResult(data: any): AIResponse {
    const choice = data.choices?.[0];
    return {
      content: choice?.message?.content || null,
      toolCalls: this.parseToolCalls(choice),
      usage: this.parseUsage(data),
    };
  }

  private async *streamLocal(body: Record<string, unknown>): AsyncGenerator<AIStreamChunk> {
    const key = await dataService.getDeepseekKey();
    if (!key) {
      yield { type: 'error', error: 'Chiave DeepSeek non configurata' };
      return;
    }

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });

    yield* this.parseSSEStream(res);
  }

  private async *streamProxy(body: Record<string, unknown>): AsyncGenerator<AIStreamChunk> {
    const res = await fetch('/api/ai/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Stream error' }));
      yield { type: 'error', error: err.error || `Errore stream (${res.status})` };
      return;
    }

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
    let toolCallBuffer: Record<string, string> = {};

    const flushToolCalls = function* (): Generator<AIStreamChunk> {
      const toolCalls = Object.entries(toolCallBuffer).reduce<
        Record<string, { id?: string; name?: string; args?: string }>
      >((acc, [key, val]) => {
        const sep = key.indexOf('_');
        if (sep === -1) return acc;
        const idx = key.slice(0, sep);
        const prop = key.slice(sep + 1);
        if (!acc[idx]) acc[idx] = {};
        acc[idx][prop as 'id' | 'name' | 'args'] = val;
        return acc;
      }, {});

      for (const tc of Object.values(toolCalls)) {
        if (tc.name && tc.args) {
          try {
            JSON.parse(tc.args);
          } catch {
            continue;
          }
          yield {
            type: 'tool_call',
            toolCall: {
              id: tc.id || `call_${Date.now()}`,
              type: 'function',
              function: { name: tc.name, arguments: tc.args },
            },
          };
        }
      }
    };

    try {
      let finalUsage: AIStreamChunk['usage'] | undefined;
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
            yield* flushToolCalls();
            yield { type: 'done', usage: finalUsage };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;

            if (parsed.usage) {
              finalUsage = {
                promptTokens: parsed.usage.prompt_tokens ?? 0,
                completionTokens: parsed.usage.completion_tokens ?? 0,
                totalTokens: parsed.usage.total_tokens ?? 0,
              };
            }

            if (!delta) continue;

            if (delta.content) {
              yield { type: 'content', content: delta.content };
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const index = tc.index ?? 0;
                const idxKey = String(index);

                if (tc.id) {
                  toolCallBuffer[`${idxKey}_id`] = tc.id;
                }
                if (tc.function?.name) {
                  toolCallBuffer[`${idxKey}_name`] = tc.function.name;
                }
                if (tc.function?.arguments) {
                  toolCallBuffer[`${idxKey}_args`] = (toolCallBuffer[`${idxKey}_args`] || '') + tc.function.arguments;
                }
              }
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      yield* flushToolCalls();
      yield { type: 'done', usage: finalUsage };
    } catch (err) {
      yield { type: 'error', error: err instanceof Error ? err.message : 'Errore stream' };
    }
  }
}
