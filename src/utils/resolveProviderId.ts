import { providerRegistry } from '../ai/providers/registry';
import { getAiProviderDefault } from './uiPrefs';

/**
 * Risolve l'ID provider da usare per una chiamata AI.
 * Priorità:
 * 1. `modelId` esplicito passato dall'utente
 * 2. `getAiProviderDefault()` da localStorage
 * 3. fallback `providerRegistry.getDefaultId()`
 *
 * Se il provider preferito non è registrato, fallback default.
 */
export function resolveProviderId(modelId?: string): string {
  if (modelId) return normalizeProviderId(modelId);
  const id = getAiProviderDefault() || providerRegistry.getDefaultId();
  return normalizeProviderId(id);
}

function normalizeProviderId(id: string): string {
  if (providerRegistry.getProviderCount() === 0) return id;
  if (providerRegistry.listProviders().some((p) => p.id === id)) return id;
  return providerRegistry.getDefaultId();
}

/**
 * CON-MM-002: true se il provider risolto supporta input vision (immagini).
 * Gli hook AI lo usano per evitare di catturare screenshot preview che
 * verrebbero scartati silenziosamente da provider text-only (es. DeepSeek).
 */
export function providerSupportsVision(providerId: string): boolean {
  try {
    const provider = providerRegistry.getProvider(providerId);
    return (provider as { supportsVision?: boolean }).supportsVision ?? false;
  } catch {
    return false;
  }
}
