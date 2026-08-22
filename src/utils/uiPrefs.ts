/**
 * Preferenze UI persistite (Phase 13b/14, REQ-DS-006 + REQ-AI-003).
 * Chiave versionata `pq_ui:v1` (CON-004). Niente immagini, solo booleani.
 *
 * TB-023: aggiunte preferenze AI harness:
 * - `aiProviderDefault`: provider ID preferito per orchestratori
 * - `aiVisionEnabled`: toggle vision feedback (screenshot → MiniMax M3)

 * - `aiAutoFallback`: se true, fallback automatico DeepSeek se Ollama 429
 */

export type EditorKind = 'editor' | 'card' | 'flyer' | 'logo' | 'social' | 'website';

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
  /** Livello di ragionamento AI (low/high/max). Default 'max'. */
  aiReasoningEffort?: 'low' | 'high' | 'max';
  /** t13: skill di progetto disattivate per kind editor (default: tutte attive). */
  aiSkillDisabledByKind?: Partial<Record<EditorKind, boolean>>;
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
    aiReasoningEffort: parsed.aiReasoningEffort,
    aiSkillDisabledByKind: parsed.aiSkillDisabledByKind ?? {},
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

/**
 * Provider default VALIDATO: se l'ID salvato non esiste più nel registry
 * (stale, es. provider rimosso), ritorna il default di registry e ripulisce
 * la pref. Senza, il badge/editor mostrano un ID morto (fallback silenzioso).
 */
export function getValidatedProviderDefault(
  registry: { listProviders(): { id: string }[]; getDefaultId(): string },
): string {
  const pref = getUiPrefs().aiProviderDefault;
  if (pref && registry.listProviders().some((p) => p.id === pref)) return pref;
  if (pref) setAiProviderDefault(registry.getDefaultId());
  return registry.getDefaultId();
}

export function setAiProviderDefault(providerId: string): void {
  const prefs = getUiPrefs();
  prefs.aiProviderDefault = providerId;
  save(prefs);
}

export const AI_IMAGE_MODELS = [
  { id: 'gemini-3.1-flash-image', name: 'Gemini Nano Banana', description: 'Qualità alta, dettagli ricchi' },
  { id: 'gemini-3.1-flash-lite-image', name: 'Gemini Nano Banana 2 Lite', description: 'Veloce ed economico, risoluzione 1K' },
  // Rimosso gemini-2.0-flash-preview-image-generation: ritirato da Google
  // (404 upstream). Il server normalizza pref stale → gemini-3.1-flash-image.
];

export function getAiImageModelDefault(): string {
  const pref = getUiPrefs().aiImageModelDefault;
  return pref && AI_IMAGE_MODELS.some((m) => m.id === pref) ? pref : AI_IMAGE_MODELS[0].id;
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

export function getAiReasoningEffort(): 'low' | 'high' | 'max' {
  return getUiPrefs().aiReasoningEffort ?? 'max';
}

export function setAiReasoningEffort(effort: 'low' | 'high' | 'max'): void {
  const prefs = getUiPrefs();
  prefs.aiReasoningEffort = effort;
  save(prefs);
}

// ─── t13: controllo utente sulle skill di progetto ─────────────

/** t13: la skill del kind è disattivata? Default: attiva. */
export function isAiSkillDisabled(kind: EditorKind): boolean {
  return getUiPrefs().aiSkillDisabledByKind?.[kind] ?? false;
}

export function setAiSkillDisabled(kind: EditorKind, disabled: boolean): void {
  const prefs = getUiPrefs();
  prefs.aiSkillDisabledByKind = { ...(prefs.aiSkillDisabledByKind ?? {}), [kind]: disabled };
  save(prefs);
}
