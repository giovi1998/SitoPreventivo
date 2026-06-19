/**
 * Event-based AI logging helpers.
 * Raw stream content stays in buffers — never emitted to the user log.
 */

export class StreamBuffer {
  private parts: string[] = [];

  append(chunk: string): void {
    if (chunk) this.parts.push(chunk);
  }

  getRaw(): string {
    return this.parts.join('');
  }

  clear(): void {
    this.parts = [];
  }
}

/** Synthetic one-line summary of merge changes (rule 3). */
export function summarizeMergeChanges(changes: string[]): string {
  if (changes.length === 0) return '';

  const areas = new Set<string>();
  for (const c of changes) {
    const lower = c.toLowerCase();
    if (lower.includes('cliente') || lower.includes('emittente')) areas.add('anagrafica');
    if (
      lower.includes('opzione') ||
      lower.includes('→') ||
      lower.includes('voce') ||
      lower.includes('prezzo') ||
      lower.includes('quantità')
    ) {
      areas.add('opzioni');
    }
    if (lower.includes('clausola')) areas.add('clausole');
    if (lower.includes('pagamento') || lower.includes('iban') || lower.includes('scadenze')) areas.add('pagamenti');
    if (lower.includes('nota') || lower.includes('descrizione') || lower.includes('titolo')) areas.add('testi');
    if (lower.includes('colore') || lower.includes('tema')) areas.add('tema');
    if (lower.includes('stato') || lower.includes('valido fino')) areas.add('stato');
  }

  const areaList = areas.size > 0 ? [...areas].join(', ') : 'preventivo';
  return `Modifiche applicate: ${changes.length} (${areaList})`;
}

/** Human-readable error without raw AI payload (rules 5–7). */
export function describeAIError(kind: 'empty' | 'not_json' | 'invalid_json'): string {
  switch (kind) {
    case 'empty':
      return '⚠ L\'AI non ha restituito contenuto. Riprova con una richiesta più specifica.';
    case 'not_json':
      return '⚠ L\'AI ha risposto a testo libero invece di applicare modifiche. Riprova.';
    case 'invalid_json':
      return '⚠ Risposta AI non valida. Le modifiche potrebbero non essere state applicate.';
  }
}
