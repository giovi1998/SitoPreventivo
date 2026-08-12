export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: MessageRole;
  content: string | null;
  toolCallId?: string;
  name?: string;
  toolCalls?: AIToolCall[];
  images?: string[];
  reasoningContent?: string;
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
  reasoningContent?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    /** DeepSeek KV cache: token input serviti da cache (non ricalcolati). */
    cachedTokens?: number;
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
  reasoningEffort?: 'low' | 'high' | 'max';
  maxTokens?: number;
  responseFormat?: { type: 'json_object' | 'text' };
  /** Ollama structured outputs: JSON schema passato in `format` (oltre a `'json'`). */
  jsonSchema?: Record<string, unknown>;
  signal?: AbortSignal;
  stream?: boolean;
  /** Observability: client-generated request id propagated to the server. */
  requestId?: string;
  /** TB-029: customerId per Langfuse (session grouping + metadata). */
  customerId?: string;
  /** TB-029: sessione Langfuse (docId: raggruppa chat+immagini del documento). */
  sessionId?: string;
  /** TB-029: feature orchestrator (quote/card/flyer/...) per tag Langfuse. */
  kind?: string;
  /** T7: trace gerarchica agente — campi run condivisi (vedi RunTraceOptions). */
  runId?: string;
  runName?: string;
  startRun?: boolean;
  rootSpanId?: string;
  stepName?: string;
  stepSpanId?: string;
}

/** T7: campi trace gerarchica agente, propagati dalle options degli
 * orchestratori fino a ChatOptions → body `/api/ai/chat`. */
export interface RunTraceOptions {
  /** 32-hex traceId condiviso per tutto il run agente. */
  runId?: string;
  /** Nome stabile del task (es. auto-build) → trace `agent:<runName>`. */
  runName?: string;
  /** true solo sulla prima chiamata del run → span root. */
  startRun?: boolean;
  /** 16-hex stabile per tutto il run (parent di ogni step span). */
  rootSpanId?: string;
  /** Sub-agente corrente (es. logo|card|flyer|website). */
  stepName?: string;
  /** 16-hex NUOVO per ogni chiamata (parent della generation). */
  stepSpanId?: string;
}

export interface AIStreamChunk {
  type: 'content' | 'tool_call' | 'done' | 'error';
  content?: string;
  toolCall?: AIToolCall;
  reasoningContent?: string;
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
  /** TB-026: call AI da registrare in document.aiStats. */
  aiCall?: { kind: 'quoteCopy'; costUsd: number };
}

export interface FlyerProcessResult {
  flyer: unknown;
  response: AIResponse;
  sessionId: string;
  changes: string[];
  rawResponse?: string;
  applied: boolean;
}
