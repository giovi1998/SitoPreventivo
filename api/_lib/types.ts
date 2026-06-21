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
