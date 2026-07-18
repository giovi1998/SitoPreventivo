/**
 * Preferenze UI persistite (Phase 13b/14, REQ-DS-006 + REQ-AI-003).
 * Chiave versionata `pq_ui:v1` (CON-004). Niente immagini, solo booleani.
 */

export type EditorKind = 'editor' | 'card' | 'flyer' | 'logo' | 'social';

export interface UiPrefs {
  version: 1;
  sidebarCollapsed: boolean;
  /** Stato espansione AI Console per editor (default: espansa). */
  aiConsoleExpanded: Partial<Record<EditorKind, boolean>>;
}

const KEY = 'pq_ui:v1';

const DEFAULTS: UiPrefs = {
  version: 1,
  sidebarCollapsed: false,
  aiConsoleExpanded: {},
};

export function getUiPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS, aiConsoleExpanded: {} };
    const parsed = JSON.parse(raw) as Partial<UiPrefs>;
    return {
      version: 1,
      sidebarCollapsed: parsed.sidebarCollapsed ?? DEFAULTS.sidebarCollapsed,
      aiConsoleExpanded: { ...(parsed.aiConsoleExpanded ?? {}) },
    };
  } catch {
    return { ...DEFAULTS, aiConsoleExpanded: {} };
  }
}

function save(prefs: UiPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // quota piena / storage disabilitato: le prefs UI non sono critiche
  }
}

export function getSidebarCollapsed(): boolean {
  return getUiPrefs().sidebarCollapsed;
}

export function setSidebarCollapsed(collapsed: boolean): void {
  const prefs = getUiPrefs();
  prefs.sidebarCollapsed = collapsed;
  save(prefs);
}

/**
 * Stato espansione AI Console per editor. `undefined` = mai toccato
 * dall'utente (il chiamante decide il default, es. espansa su doc vuoto).
 */
export function getAiConsoleExpanded(editor: EditorKind): boolean | undefined {
  return getUiPrefs().aiConsoleExpanded[editor];
}

export function setAiConsoleExpanded(editor: EditorKind, expanded: boolean): void {
  const prefs = getUiPrefs();
  prefs.aiConsoleExpanded[editor] = expanded;
  save(prefs);
}
