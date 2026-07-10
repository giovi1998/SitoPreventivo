export interface MergeSummary {
  count: number;
  breakdown: { tools: number; textEdits: number; errors: number };
  summary: string;
}

import { mapAiError } from './ai/mapAiError';

export function summarizeMergeChanges(changes: string[]): MergeSummary {
  let tools = 0;
  let errors = 0;
  let textEdits = 0;
  for (const c of changes) {
    if (c.startsWith('tool:')) tools++;
    else if (c.startsWith('error:')) errors++;
    else textEdits++;
  }
  const count = tools + textEdits;
  const parts: string[] = [];
  if (tools > 0) parts.push(`${tools} tool`);
  if (textEdits > 0) parts.push(`${textEdits} modifiche testo`);
  const summary = parts.length > 0
    ? `${count} modifiche applicate (${parts.join(', ')}). Vedi log.`
    : 'nessuna modifica applicata';
  return { count, breakdown: { tools, textEdits, errors }, summary };
}

export function buildErrorSuggestion(errorMessage: string): string {
  return mapAiError(errorMessage);
}
