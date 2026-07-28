/**
 * TB-023: tabella costi reale per provider AI.
 * Vedi spec-design-ai-harness-upgrade.md REQ-TC-001.
 *
 - DeepSeek: pay-per-token, prezzi ufficiali 2026-07
 - Ollama Pro: $20/mo flat, 50x free usage. costUsd per chiamata = 0
   (costo fisso mensile tracciato separatamente in admin dashboard)
 - Gemini immagini: per-image, prezzi stimati (variabili, verify in dashboard)
 */
export type PricingUnit = 'per_1m_tokens' | 'per_image' | 'flat_monthly';

export interface ProviderPricing {
  input: number;
  output: number;
  unit: PricingUnit;
  perImage?: number;
}

export const PRICING: Record<string, ProviderPricing> = {
  'deepseek-chat': { input: 0.14, output: 0.28, unit: 'per_1m_tokens' },
  'deepseek-v4-pro': { input: 0.55, output: 2.19, unit: 'per_1m_tokens' },
  // Ollama Pro è $20/mo flat — costUsd per chiamata è 0 nel tracking
  // (il costo fisso mensile è visibility separata in admin dashboard)
  'ollama-minimax-m3': { input: 0, output: 0, unit: 'flat_monthly' },
  'ollama-deepseek-v4-pro': { input: 0, output: 0, unit: 'flat_monthly' },
  'ollama-qwen-3.5': { input: 0, output: 0, unit: 'flat_monthly' },
  // Provider ID nel registry è 'ollama-minimax-m3' ma il model è
  // 'minimax-m3:cloud' — pricing lookup usa provider ID
  'gemini-nano-banana': { input: 0, output: 0, unit: 'per_image', perImage: 0.04 },
  'gemini-flash-image': { input: 0, output: 0, unit: 'per_image', perImage: 0.02 },
};

export const OLLAMA_PRO_FLAT_MONTHLY = 20;

/**
 * Calcola il costo USD di una chiamata AI dato il provider ID e l'usage.
 * Ritorna 0 per provider flat (Ollama Pro).
 */
export function calculateCostUsd(
  providerId: string,
  usage: { promptTokens: number; completionTokens: number } | undefined,
  imageCount = 0
): number {
  const pricing = PRICING[providerId];
  if (!pricing) return 0;

  if (pricing.unit === 'per_image') {
    return Math.round((imageCount * (pricing.perImage ?? 0)) * 1_000_000) / 1_000_000;
  }

  if (!usage) return 0;

  if (pricing.unit === 'per_1m_tokens') {
    const inputCost = (usage.promptTokens / 1_000_000) * pricing.input;
    const outputCost = (usage.completionTokens / 1_000_000) * pricing.output;
    return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
  }

  // flat_monthly → 0 per chiamata
  return 0;
}

/**
 * Formatta un costo USD in stringa compatta ($0.003, $1.50, $0.00012).
 */
export function formatCostUsd(cost: number): string {
  if (cost === 0) return '$0';
  if (cost < 0.01) return `$${cost.toFixed(5).replace(/0+$/, '').replace(/\.$/, '')}`;
  if (cost < 1) return `$${cost.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Ritorna label human-readable del pricing per UI tooltip.
 */
export function getPricingLabel(providerId: string): string {
  const p = PRICING[providerId];
  if (!p) return 'Prezzo non disponibile';
  if (p.unit === 'flat_monthly') return `$${OLLAMA_PRO_FLAT_MONTHLY}/mese flat`;
  if (p.unit === 'per_image') return `$${p.perImage}/immagine`;
  return `$${p.input}/1M input · $${p.output}/1M output`;
}