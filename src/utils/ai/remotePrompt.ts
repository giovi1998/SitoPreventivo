// Remote Prompt Management (TB-029 fase 2): il client tenta di caricare i
// prompt da Langfuse via /api/ai/prompt (label: production in prod,
// staging in locale — prompt diversi per ambiente), con fallback ai
// builder locali registrati in promptRegistry. Fallimento remoto = mai
// rompere il flusso: si usa il template locale.
import { promptRegistry } from '../../ai/prompts/registry';

export type PromptVars = Record<string, unknown>;

export function compileClientPrompt(template: string, vars: PromptVars): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    if (!(key in vars)) return `{{${key}}}`;
    const value = vars[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

// Prompt diversi per ambiente: staging in locale, production in prod.
export const RESOLVED_LABEL: string = isLocalhost() ? 'staging' : 'production';

export async function getRemoteSystemPrompt(name: string, vars: PromptVars = {}, customerId?: string): Promise<string | null> {
  const localFallback = (): string | null => {
    if (promptRegistry.hasPrompt(name)) return promptRegistry.getPrompt(name);
    return null;
  };

  try {
    // TB-029 fase 3: customerId → il server fa override label con
    // promptLabels del cliente (A/B testing per cliente).
    const customerParam = customerId ? `&customerId=${encodeURIComponent(customerId)}` : '';
    const res = await fetch(`/api/ai/prompt?name=${encodeURIComponent(name)}&label=${RESOLVED_LABEL}${customerParam}`);
    if (!res.ok) return localFallback();
    const body = (await res.json()) as {
      data?: { prompt?: Array<{ role: string; content: string }>; fallback?: boolean };
    };
    const data = body.data;
    const prompt = data?.prompt;
    if (!prompt) return localFallback();
    // Fallback flag = il server ha usato i builder locali → stessa cosa
    // del fallback client, ma il contenuto è già il template locale.
    if (data.fallback) {
      const content = prompt.find((m) => m.role === 'system')?.content;
      return content ? compileClientPrompt(content, vars) : localFallback();
    }
    const system = prompt.find((m) => m.role === 'system');
    if (!system) return localFallback();
    return compileClientPrompt(system.content, vars);
  } catch {
    return localFallback();
  }
}

// Prompt gestiti in Langfuse (label per ambiente). I 5 user-prompt website
// (website-html/css/js/page/verify) NON sono qui: incorporano HTML/CSS/JS
// dinamico (5-50KB) — come variabile Langfuse sarebbero template giganti
// ineditabili con cache inutile. Restano hardcoded col builder locale.
export const REMOTE_PROMPT_PILOT: string[] = [
  'card-system', 'quote-system', 'flyer-system',
  'logo-system', 'social-system', 'onboarding-system', 'website-system', 'palette-system',
];

// Prefetch dei prompt pilota: chiamato all'avvio app e quando si apre un
// cliente (customerId → override label A/B). Fallimento = silenzioso.
export async function prefetchRemotePrompts(customerId?: string): Promise<void> {
  await Promise.all(
    REMOTE_PROMPT_PILOT.map(async (id) => {
      try {
        const remote = await getRemoteSystemPrompt(id, {}, customerId);
        if (remote == null) return;
        const isQuote = id === 'quote-system';
        promptRegistry.register(id, (ctx) =>
          isQuote
            ? compileClientPrompt(remote, { compact: (ctx?.compact ?? true) === true })
            : remote,
          `Prompt remoto Langfuse (label ${RESOLVED_LABEL}${customerId ? `, cliente ${customerId}` : ''})`
        );
      } catch {
        // Builder locale già registrato: nessun crash.
      }
    })
  );
}
