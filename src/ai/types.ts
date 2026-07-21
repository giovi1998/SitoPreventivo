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

export interface ToolResult<T = unknown> {
  payload: T;
  changes: string;
}

export type ToolExecutor<T = unknown> = (args: Record<string, unknown>, payload: T) => ToolResult<T>;

export interface ChatOptions {
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: 'json_object' | 'text' };
  signal?: AbortSignal;
  stream?: boolean;
  /** Observability: client-generated request id propagated to the server. */
  requestId?: string;
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

export type AILogEntryType = 'info' | 'success' | 'error' | 'tool' | 'stream';

export interface AILogEntry {
  id: string;
  type: AILogEntryType;
  msg: string;
  time: string;
  status?: 'pending' | 'done' | 'error';
  durationMs?: number;
  detail?: string;
  // v2 observability fields
  requestId?: string;
  sessionId?: string;
  modelId?: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** TB-023: costo USD dell'operazione loggata (somma testo + immagini). */
  costUsd?: number;
  /** TB-023: flag operazione con immagine (vision, cover, hero, background). */
  hasImage?: boolean;
  /** TB-023: anteprima base64 dell'immagine allegata (screenshot cover/photo/cardImage/logoImage). */
  imagePreviewBase64?: string;
}

export interface ProcessResult {
  quote: unknown;
  response: AIResponse;
  sessionId: string;
  changes: string[];
  rawResponse?: string;
}

export interface FlyerProcessResult {
  flyer: unknown;
  response: AIResponse;
  sessionId: string;
  changes: string[];
  rawResponse?: string;
  applied: boolean;
}
