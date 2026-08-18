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

// TB-032: versione prompt fissata per un cliente (promptVersions). In
// locale i customers vivono in localStorage (pq_customers:v1); in prod il
// server la risolve da DB via customerId — il param è ridondante ma copre
// il dev proxy (che non ha DB).
export function getCustomerPromptVersion(customerId: string, promptId: string): number | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    const raw = localStorage.getItem('pq_customers:v1');
    if (!raw) return undefined;
    const list = JSON.parse(raw);
    const found = Array.isArray(list)
      ? list.find((c: Record<string, unknown>) => c.id === customerId)
      : (list as Record<string, unknown>)[customerId];
    const versions = (found as Record<string, unknown> | undefined)?.promptVersions as Record<string, number> | undefined;
    const v = versions?.[promptId];
    return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}

export async function getRemoteSystemPrompt(
  name: string,
  vars: PromptVars = {},
  customerId?: string,
  version?: number,
): Promise<string | null> {
  const localFallback = (): string | null => {
    if (promptRegistry.hasPrompt(name)) return promptRegistry.getPrompt(name);
    return null;
  };

  try {
    // TB-029 fase 3: customerId → il server fa override label con
    // promptLabels del cliente (A/B testing per cliente).
    // TB-032: version esplicita (override su label) per test prompt×modello.
    const customerParam = customerId ? `&customerId=${encodeURIComponent(customerId)}` : '';
    const versionParam = version !== undefined ? `&version=${version}` : '';
    const res = await fetch(`/api/ai/prompt?name=${encodeURIComponent(name)}&label=${RESOLVED_LABEL}${customerParam}${versionParam}`);
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

// Id già applicati dal remoto: il prefetch gira all'avvio app E all'apertura
// di ogni cliente → senza questo Set, register() spammeria "id sovrascritto".
const appliedRemote = new Set<string>();

// Prefetch dei prompt pilota: chiamato all'avvio app e quando si apre un
// cliente (customerId → override label A/B + versione TB-032).
// Fallimento = silenzioso.
//
// Con customerId il prefetch è FORZATO (ignora appliedRemote): i prompt
// applicati all'avvio app (label ambiente) devono essere ri-registrati con
// la versione/label del cliente, altrimenti l'override non avrebbe mai
// effetto (bug: AppliedRemote skippava il re-fetch → i test prompt×modello
// usavano sempre la label ambiente).
export async function prefetchRemotePrompts(customerId?: string): Promise<void> {
  await Promise.all(
    REMOTE_PROMPT_PILOT.map(async (id) => {
      if (!customerId && appliedRemote.has(id)) return;
      try {
        // TB-032: versione del cliente (promptVersions) passata al server,
        // che la usa come override (come promptLabels). Il server la legge
        // anche da DB via customerId; il param esplicito copre il dev proxy.
        const version = customerId ? getCustomerPromptVersion(customerId, id) : undefined;
        const remote = await getRemoteSystemPrompt(id, {}, customerId, version);
        if (remote == null) return;
        const isQuote = id === 'quote-system';
        promptRegistry.register(id, (ctx) =>
          isQuote
            ? compileClientPrompt(remote, { compact: (ctx?.compact ?? true) === true })
            : remote,
          `Prompt remoto Langfuse (label ${RESOLVED_LABEL}${customerId ? `, cliente ${customerId}` : ''}${version ? `, v${version}` : ''})`
        );
        appliedRemote.add(id);
      } catch {
        // Builder locale già registrato: nessun crash.
      }
    })
  );
}
