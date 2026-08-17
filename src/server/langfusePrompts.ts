// Prompt Management Langfuse (TB-029 fase 2): fetch prompt remoti per
// label (production/staging) con fallback ai builder locali. I template
// locali restano la fonte di verità per il fallback e per i prompt non
// migrati. Zero dipendenze: fetch Public API con cache in-memory 60s.
import { buildCardSystemPrompt } from '../ai/prompts/cardSystem';
import { buildSystemPrompt } from '../ai/prompts/system';
import { buildFlyerSystemPrompt } from '../ai/prompts/flyerSystem';
import { buildLogoSystemPrompt } from '../ai/prompts/logoSystem';
import { buildSocialSystemPrompt } from '../ai/prompts/socialSystem';
import { buildOnboardingSystemPrompt } from '../ai/prompts/onboardingSystem';
import { buildWebsiteSystemPrompt } from '../ai/prompts/websiteSystem';
import { buildPaletteSystemPrompt } from '../ai/prompts/paletteSystem';

export type LangfusePromptMessage = { role: string; content: string };

export interface ResolvedPrompt {
  name: string;
  version: number;
  prompt: LangfusePromptMessage[];
  fallback: boolean;
  /** Label della versione risolta (es. "experiment"). */
  labels?: string[];
  /** Descrizione della versione (commitMessage Langfuse). */
  commitMessage?: string | null;
}

// Substitution {{var}} → valore. Chiave assente → placeholder letterale
// (visibile > silenzioso); chiave presente ma undefined/null → stringa vuota.
export function compilePrompt(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    if (!(key in vars)) return `{{${key}}}`;
    const value = vars[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

const LOCAL_BUILDERS: Record<string, (vars: Record<string, unknown>) => string> = {
  'card-system': () => buildCardSystemPrompt(),
  'quote-system': (vars) => buildSystemPrompt(vars.compact !== false),
  'flyer-system': () => buildFlyerSystemPrompt(),
  'logo-system': () => buildLogoSystemPrompt(),
  'social-system': () => buildSocialSystemPrompt(),
  'onboarding-system': () => buildOnboardingSystemPrompt(),
  'website-system': () => buildWebsiteSystemPrompt(),
  'palette-system': () => buildPaletteSystemPrompt(),
};

export function localPromptFallback(name: string): LangfusePromptMessage[] | null {
  const builder = LOCAL_BUILDERS[name];
  if (!builder) return null;
  return [{ role: 'system', content: builder({}) }];
}

const cache = new Map<string, { ts: number; data: ResolvedPrompt }>();
const TTL_MS = 60_000;

function publicKey() {
  return process.env.LANGFUSE_PUBLIC_KEY || process.env.VITE_LANGFUSE_PUBLIC_KEY || '';
}
function secretKey() {
  return process.env.LANGFUSE_SECRET_KEY || process.env.VITE_LANGFUSE_SECRET_KEY || '';
}
function baseUrl() {
  return process.env.LANGFUSE_BASE_URL || process.env.VITE_LANGFUSE_BASE_URL || '';
}

export async function fetchRemotePrompt(name: string, label = 'production', version?: number): Promise<ResolvedPrompt> {
  const key = `${name}:${label}${version !== undefined ? `:v${version}` : ''}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.data;

  const fallbackMessages = localPromptFallback(name);
  if (!publicKey() || !secretKey() || !baseUrl()) {
    if (!fallbackMessages) throw new Error(`Prompt non registrato: ${name}`);
    const data: ResolvedPrompt = { name, version: version ?? 0, prompt: fallbackMessages, fallback: true };
    cache.set(key, { ts: Date.now(), data });
    return data;
  }

  try {
    const query = version !== undefined ? `?label=${label}&version=${version}` : `?label=${label}`;
    const res = await fetch(`${baseUrl()}/api/public/v2/prompts/${name}${query}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${publicKey()}:${secretKey()}`).toString('base64')}`,
      },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error(`Langfuse ${res.status}`);
    const body = (await res.json()) as {
      name?: string;
      version?: number;
      prompt?: string | Array<{ role: string; content: string }>;
      labels?: string[];
      commitMessage?: string | null;
    };
    const prompt = Array.isArray(body.prompt)
      ? body.prompt
      : typeof body.prompt === 'string'
        ? [{ role: 'system', content: body.prompt }]
        : null;
    if (!prompt) throw new Error('Prompt vuoto');
    const data: ResolvedPrompt = {
      name: String(body.name ?? name),
      version: Number(body.version ?? 0),
      prompt,
      fallback: false,
      labels: Array.isArray(body.labels) ? body.labels : undefined,
      commitMessage: typeof body.commitMessage === 'string' ? body.commitMessage : null,
    };
    cache.set(key, { ts: Date.now(), data });
    return data;
  } catch {
    // Fallback ai builder locali: Langfuse down non deve mai rompere i prompt.
    if (!fallbackMessages) throw new Error(`Prompt non registrato: ${name}`);
    const data: ResolvedPrompt = { name, version: version ?? 0, prompt: fallbackMessages, fallback: true };
    cache.set(key, { ts: Date.now(), data });
    return data;
  }
}
