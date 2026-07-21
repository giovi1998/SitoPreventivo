/**
 * Shared AI prompt library (localStorage, versioned keys).
 * Used by logo brief, card photo, flyer hero, etc.
 */

export interface PromptLibraryEntry {
  id: string;
  label: string;
  createdAt: number;
  /** Free-text prompt body (card photo, flyer hero, advanced image prompt). */
  prompt?: string;
  /** Structured logo-style fields. */
  activity?: string;
  mood?: string;
  target?: string;
  sector?: string;
  tone?: string;
  module?: string;
}

export function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[promptLibrary] setItem('${key}') failed`, (err as Error)?.message);
    return false;
  }
}

export function loadPromptLibrary(key: string): PromptLibraryEntry[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePromptLibrary(key: string, items: PromptLibraryEntry[]): boolean {
  return safeLocalStorageSet(key, JSON.stringify(items));
}

export function addPromptEntry(
  key: string,
  entry: Omit<PromptLibraryEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: number },
): PromptLibraryEntry[] {
  const items = loadPromptLibrary(key);
  const next: PromptLibraryEntry = {
    ...entry,
    id: entry.id || `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: entry.createdAt || Date.now(),
  };
  const updated = [next, ...items].slice(0, 50);
  savePromptLibrary(key, updated);
  return updated;
}

export function removePromptEntry(key: string, id: string): PromptLibraryEntry[] {
  const updated = loadPromptLibrary(key).filter((e) => e.id !== id);
  savePromptLibrary(key, updated);
  return updated;
}

export const PROMPT_LIBRARY_KEYS = {
  logo: 'logoPromptLibrary:v1',
  cardPhoto: 'cardPhotoPromptLibrary:v1',
  cardIcon: 'cardIconPromptLibrary:v1',
  cardCover: 'cardCoverPromptLibrary:v1',
  flyerHero: 'flyerHeroPromptLibrary:v1',
} as const;
