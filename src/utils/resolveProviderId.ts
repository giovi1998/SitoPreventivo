import { providerRegistry } from '../ai/providers/registry';
import { getAiProviderDefault } from './uiPrefs';

/**
 * TB-023: risolve l'ID provider da usare per una chiamata AI.
 * Priorità:
 * 1. `modelId` esplicito passato dall'utente (es. A/B provider)
 * 2. `getAiProviderDefault()` da localStorage
 * 3. fallback `providerRegistry.getDefaultId()`
 *
 * Se il provider preferito non è registrato, fallback default.
 */
export function resolveProviderId(modelId?: string): string {
  const id = modelId || getAiProviderDefault() || providerRegistry.getDefaultId();
  if (providerRegistry.getProviderCount() === 0) return id;
  if (providerRegistry.listProviders().some((p) => p.id === id)) return id;
  return providerRegistry.getDefaultId();
}