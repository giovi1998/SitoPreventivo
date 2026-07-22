/**
 * Preferenze UI persistite (Phase 13b/14, REQ-DS-006 + REQ-AI-003).
 * Chiave versionata `pq_ui:v1` (CON-004). Niente immagini, solo booleani.
 *
 * TB-023: aggiunte preferenze AI harness:
 * - `aiProviderDefault`: provider ID preferito per orchestratori
 * - `aiVisionEnabled`: toggle vision feedback (screenshot → MiniMax M3)

 * - `aiAutoFallback`: se true, fallback automatico DeepSeek se Ollama 429
 */

export type EditorKind = 'editor' | 'card' | 'flyer' | 'logo' | 'social';

export interface UiPrefs {
  version: 1;
  sidebarCollapsed: boolean;
  /** Stato espansione AI Console per editor (default: espansa). */
  aiConsoleExpanded: Partial<Record<EditorKind, boolean>>;
  // TB-023
  aiProviderDefault?: string;
  aiImageModelDefault?: string;
  aiVisionEnabled?: boolean;

  aiAutoFallback?: boolean;
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
    aiProviderDefault: parsed.aiProviderDefault,
    aiImageModelDefault: parsed.aiImageModelDefault,
    aiVisionEnabled: parsed.aiVisionEnabled,

    aiAutoFallback: parsed.aiAutoFallback,
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

// ─── TB-023: AI Harness prefs ─────────────────────────────────

export function getAiProviderDefault(): string | undefined {
  return getUiPrefs().aiProviderDefault;
}

export function setAiProviderDefault(providerId: string): void {
  const prefs = getUiPrefs();
  prefs.aiProviderDefault = providerId;
  save(prefs);
}

export const AI_IMAGE_MODELS = [
  { id: 'gemini-3.1-flash-image', name: 'Gemini Nano Banana', description: 'Qualità alta, dettagli ricchi' },
  { id: 'gemini-2.0-flash-preview-image-generation', name: 'Gemini 2.0 Flash', description: 'Più veloce e economico' },
];

export function getAiImageModelDefault(): string {
  return getUiPrefs().aiImageModelDefault ?? AI_IMAGE_MODELS[0].id;
}

export function setAiImageModelDefault(modelId: string): void {
  const prefs = getUiPrefs();
  prefs.aiImageModelDefault = modelId;
  save(prefs);
}

export function getAiVisionEnabled(): boolean {
  return getUiPrefs().aiVisionEnabled ?? false;
}

export function setAiVisionEnabled(enabled: boolean): void {
  const prefs = getUiPrefs();
  prefs.aiVisionEnabled = enabled;
  save(prefs);
}



export function getAiAutoFallback(): boolean {
  return getUiPrefs().aiAutoFallback ?? true;
}

export function setAiAutoFallback(enabled: boolean): void {
  const prefs = getUiPrefs();
  prefs.aiAutoFallback = enabled;
  save(prefs);
}
