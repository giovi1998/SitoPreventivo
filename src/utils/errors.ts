export class AppError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AppError';
  }
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Errore sconosciuto';
}

export async function tryCatch<T>(
  fn: () => Promise<T>,
  errorMessage?: string
): Promise<{ data?: T; error?: string }> {
  try {
    const data = await fn();
    return { data };
  } catch (err) {
    const msg = errorMessage || getErrorMessage(err);
    console.error(`[tryCatch] ${msg}`, err);
    return { error: msg };
  }
}
