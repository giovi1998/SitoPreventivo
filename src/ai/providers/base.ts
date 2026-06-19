import type { AIProvider, ChatMessage, ChatOptions, AIResponse, AIStreamChunk, AIToolCall } from '../types';

export abstract class BaseAIProvider implements AIProvider {
  abstract readonly name: string;
  abstract readonly model: string;
  abstract readonly supportsStreaming: boolean;
  abstract readonly supportsTools: boolean;

  abstract chat(messages: ChatMessage[], options?: ChatOptions): Promise<AIResponse>;

  abstract stream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<AIStreamChunk>;

  protected buildRequestBody(
    messages: ChatMessage[],
    options?: ChatOptions & { stream?: boolean }
  ): Record<string, unknown> {
    return {
      model: this.model,
      messages: messages.map((m) => {
        const msg: Record<string, unknown> = {
          role: m.role,
          content: m.content,
        };
        if (m.toolCallId) msg.tool_call_id = m.toolCallId;
        if (m.name) msg.name = m.name;
        if (m.toolCalls && m.toolCalls.length > 0) {
          msg.tool_calls = m.toolCalls.map((tc: AIToolCall) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          }));
        }
        return msg;
      }),
      ...(options?.tools && this.supportsTools ? { tools: options.tools } : {}),
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : { temperature: 0.7 }),
      ...(options?.maxTokens ? { max_tokens: options.maxTokens } : {}),
      ...(options?.responseFormat ? { response_format: options.responseFormat } : {}),
      ...(options?.stream ? { stream: true } : {}),
    };
  }

  protected parseToolCalls(choice: any): AIResponse['toolCalls'] {
    if (!choice?.message?.tool_calls) return undefined;
    return choice.message.tool_calls.map((tc: any) => ({
      id: tc.id,
      type: 'function' as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));
  }

  protected parseUsage(data: any): AIResponse['usage'] | undefined {
    if (!data?.usage) return undefined;
    return {
      promptTokens: data.usage.prompt_tokens ?? 0,
      completionTokens: data.usage.completion_tokens ?? 0,
      totalTokens: data.usage.total_tokens ?? 0,
    };
  }
}
