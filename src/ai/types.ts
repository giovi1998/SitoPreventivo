export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: MessageRole;
  content: string | null;
  toolCallId?: string;
  name?: string;
  toolCalls?: AIToolCall[];
}

export interface AIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface AIResponse {
  content: string | null;
  toolCalls?: AIToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatOptions {
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: 'json_object' | 'text' };
  signal?: AbortSignal;
  stream?: boolean;
}

export interface AIStreamChunk {
  type: 'content' | 'tool_call' | 'done' | 'error';
  content?: string;
  toolCall?: AIToolCall;
  usage?: AIResponse['usage'];
  error?: string;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  readonly supportsStreaming: boolean;
  readonly supportsTools: boolean;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<AIResponse>;
  stream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<AIStreamChunk>;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export type AILogEntryType = 'info' | 'success' | 'error' | 'tool';

export interface AILogEntry {
  type: AILogEntryType;
  msg: string;
  time: string;
}

export interface ProcessResult {
  quote: unknown;
  response: AIResponse;
  sessionId: string;
  changes: string[];
  rawResponse?: string;
}
