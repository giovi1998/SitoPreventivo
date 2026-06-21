/**
 * Event-based AI logging helpers.
 * Raw stream content stays in buffers — never emitted to the user log.
 * Entries can be created in 'pending' state and updated in place
 * (see createStreamEntry / updateStreamProgress / completeStreamEntry).
 */

import type { AILogEntry } from './types';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `log-${Date.now()}-${counter}`;
}

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
export function describeAIError(kind: 'empty' | 'not_json' | 'invalid_json' | 'followup_not_json' | 'followup_failed'): string {
  switch (kind) {
    case 'empty':
      return "⚠ L'AI non ha restituito contenuto. Riprova con una richiesta più specifica.";
    case 'not_json':
      return "⚠ L'AI ha risposto a testo libero invece di applicare modifiche. Riprova.";
    case 'invalid_json':
      return "⚠ Risposta AI non valida. Le modifiche potrebbero non essere state applicate.";
    case 'followup_not_json':
      return '⚠ La sintesi AI non è in formato valido. Le modifiche dei tool sono state applicate.';
    case 'followup_failed':
      return '⚠ Sintesi AI fallita. Le modifiche dei tool sono state applicate.';
  }
}

export function nowTime(): string {
  return new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function createStreamEntry(): AILogEntry {
  return {
    id: nextId(),
    type: 'stream',
    msg: 'Generazione in corso...',
    status: 'pending',
    time: nowTime(),
  };
}

export function createEntry(type: AILogEntry['type'], msg: string, opts: Partial<AILogEntry> = {}): AILogEntry {
  return {
    id: nextId(),
    type,
    msg,
    status: 'done',
    time: nowTime(),
    ...opts,
  };
}

export function createErrorEntry(msg: string, detail?: string): AILogEntry {
  return createEntry('error', msg, { detail });
}

export function createSuccessEntry(msg: string, detail?: string): AILogEntry {
  return createEntry('success', msg, { detail });
}

export function createToolEntry(msg: string, durationMs?: number, detail?: string): AILogEntry {
  return createEntry('tool', msg, { durationMs, detail });
}

export function createInfoEntry(msg: string): AILogEntry {
  return createEntry('info', msg);
}
