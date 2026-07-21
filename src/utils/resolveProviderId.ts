import { providerRegistry } from '../ai/providers/registry';
import { getAiProviderDefault, getAiABTestingEnabled } from './uiPrefs';

/**
 * TB-023: risolve l'ID provider da usare per una chiamata AI.
 * Priorità:
 * 1. `modelId` esplicito passato dall'utente (es. A/B provider)
 * 2. A/B testing se abilitato
 * 3. `getAiProviderDefault()` da localStorage
 * 4. fallback `providerRegistry.getDefaultId()`
 *
 * Se il provider preferito non è registrato, fallback default.
 */
export function resolveProviderId(modelId?: string, salt?: string): string {
  if (modelId) return normalizeProviderId(modelId);
  if (getAiABTestingEnabled()) {
    return resolveABProviderInternal(salt);
  }
  const id = getAiProviderDefault() || providerRegistry.getDefaultId();
  return normalizeProviderId(id);
}

function normalizeProviderId(id: string): string {
  if (providerRegistry.getProviderCount() === 0) return id;
  if (providerRegistry.listProviders().some((p) => p.id === id)) return id;
  return providerRegistry.getDefaultId();
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

const CHALLENGER_PAIRS: Array<{ primary: string; challenger: string }> = [
  { primary: 'deepseek-chat', challenger: 'ollama-deepseek-v4-pro' },
  { primary: 'ollama-minimax-m3', challenger: 'deepseek-v4-pro' },
];

function resolveABProviderInternal(salt?: string): string {
  const preferred = getAiProviderDefault() || providerRegistry.getDefaultId();
  const pair = CHALLENGER_PAIRS.find((p) => p.primary === preferred) || {
    primary: preferred,
    challenger: 'deepseek-chat',
  };
  const seed = simpleHash(salt || preferred);
  return normalizeProviderId(seed % 2 === 0 ? pair.primary : pair.challenger);
}