// Tipi condivisi server (VercelRequest/Response = compat con vecchio handler api/).
export type VercelRequest = {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
};
export type VercelResponse = {
  status(code: number): VercelResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string | number): void;
  write(chunk: string | Uint8Array): boolean;
  end(): void;
  writableEnded: boolean;
};
export type RouteHandler = (
  path: string,
  method: string,
  req: VercelRequest,
  res: VercelResponse,
  body: Record<string, unknown>
) => Promise<void>;
export interface AILogPayload {
  tag: string;
  requestId: string;
  email?: string;
  model?: string;
  durationMs: number;
  tokens?: number;
  outcome: 'ok' | 'error';
  errorKind?: string;
  sizeKB?: number;
  provider?: string;
  costUsd?: number;
}
export type GeminiInputStep = {
  type: 'user_input';
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; data: string; mime_type: string }
  >;
};

export type GeminiInputPart =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mime_type: string };

export type FirecrawlResult = {
  markdown?: string;
  screenshot?: string | null;
  branding?: { logo?: string; colors?: Record<string, unknown>; fonts?: string[]; images?: string[] };
  images?: string[];
  links?: string[];
  json?: Record<string, unknown>;
  title?: string;
  description?: string;
  status: 'ok' | 'no_key' | 'fail' | 'no_website';
};

export const FIRECRAWL_WEBDATA_SCHEMA = {
  type: 'object',
  required: [],
  properties: {
    company_name: { type: 'string' },
    company_description: { type: 'string' },
    emails: { type: 'array', items: { type: 'string' } },
    phones: { type: 'array', items: { type: 'string' } },
    addresses: { type: 'array', items: { type: 'string' } },
    colors: { type: 'array', items: { type: 'string' } },
    fonts: { type: 'array', items: { type: 'string' } },
    social_links: { type: 'array', items: { type: 'string' } },
  },
};

