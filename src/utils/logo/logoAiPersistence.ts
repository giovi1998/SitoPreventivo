import type { LogoBuilder, LogoSector } from '../../utils/documentSchemas';
import { safeLocalStorageSet } from '../../utils/promptLibrary';

export type Step = 'chat' | 'result' | 'applied';

export interface ChatAnswers {
  activity: string;
  mood: string;
  target: string;
  sector: LogoSector;
}

export interface LogoAiState {
  answers: ChatAnswers;
  step: Step;
  concepts: LogoBuilder[];
  selected: number;
  bgImages: (string | null)[];
  bgErrors: (string | null)[];
}

export interface PersistedState {
  answers: ChatAnswers;
  step: Step;
  concepts: LogoBuilder[];
  selected: number;
  bgImages: (string | null)[];
  ts: number;
}

export const LS_KEY = 'logoAiChat:v1';
export const LS_TTL_MS = 24 * 60 * 60 * 1000;

export function storageKeyFor(docId?: string): string {
  return docId ? `${LS_KEY}:${docId}` : LS_KEY;
}

export function persistState(key: string, payload: PersistedState): void {
  const ok = safeLocalStorageSet(key, JSON.stringify(payload));
  if (!ok) {
    safeLocalStorageSet(key, JSON.stringify({ ...payload, bgImages: payload.bgImages.map(() => null) }));
  }
}
