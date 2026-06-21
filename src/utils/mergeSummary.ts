export interface MergeSummary {
  count: number;
  breakdown: { tools: number; textEdits: number; errors: number };
  summary: string;
}

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
  const lower = errorMessage.toLowerCase();
  if (lower.includes('402') || lower.includes('payment') || lower.includes('credito')) {
    return 'Credito DeepSeek esaurito. Ricarica su platform.deepseek.com e riprova.';
  }
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('troppe')) {
    return 'Troppe richieste AI. Attendi 30s e riprova.';
  }
  if (lower.includes('timeout') || lower.includes('network') || lower.includes('fetch')) {
    return 'Connessione assente o lenta. Verifica la rete e riprova.';
  }
  if (lower.includes('json') || lower.includes('parse')) {
    return 'AI non ha restituito JSON valido. Prova con un prompt più specifico (es. "cambia il titolo in X" invece di "migliora").';
  }
  return 'Errore AI. Riprova, o modifica manualmente dalla colonna di sinistra.';
}
