import { describe, it, expect } from 'vitest';
import { calculateCostUsd, geminiImagePricingId, OLLAMA_PRO_FLAT_MONTHLY } from '../providerPricing';

describe('providerPricing calculateCostUsd (spec TB-023 §6.1)', () => {
  it('AC-TC-001: DeepSeek pay-per-token (600 input + 400 output → 0.000196)', () => {
    const cost = calculateCostUsd('deepseek-v4-flash', { promptTokens: 600, completionTokens: 400 });
    // (600/1M)*0.14 + (400/1M)*0.28 = 0.000084 + 0.000112 = 0.000196
    expect(cost).toBe(0.000196);
  });

  it('Ollama Pro flat: costo per chiamata sempre 0 anche con usage alto', () => {
    const usage = { promptTokens: 100_000, completionTokens: 50_000 };
    expect(calculateCostUsd('ollama-minimax-m3', usage)).toBe(0);
    expect(calculateCostUsd('ollama-deepseek-v4-pro', usage)).toBe(0);
    expect(calculateCostUsd('ollama-qwen-3.5', usage)).toBe(0);
    expect(calculateCostUsd('ollama-kimi-k2.7-code', usage)).toBe(0);
    expect(OLLAMA_PRO_FLAT_MONTHLY).toBe(20);
  });

  it('ollama-kimi-k3: pay-per-token extra usage (3.0 in / 15.0 out per 1M)', () => {
    // (100k/1M)*3.0 + (50k/1M)*15.0 = 0.3 + 0.75 = 1.05
    const cost = calculateCostUsd('ollama-kimi-k3', { promptTokens: 100_000, completionTokens: 50_000 });
    expect(cost).toBe(1.05);
  });

  it('Gemini per-image: 1 immagine → perImage value', () => {
    const usage = { promptTokens: 0, completionTokens: 0 };
    expect(calculateCostUsd('gemini-nano-banana', usage, 1)).toBe(0.04);
    expect(calculateCostUsd('gemini-flash-image', usage, 1)).toBe(0.02);
    expect(calculateCostUsd('gemini-nano-banana', usage, 3)).toBe(0.12);
  });

  it('modello sconosciuto: fallback 0 (nessun pricing registrato)', () => {
    const cost = calculateCostUsd('modello-inesistente', { promptTokens: 1000, completionTokens: 1000 });
    expect(cost).toBe(0);
  });

  it('usage undefined → 0 per provider a consumo (text); per-image ignora usage', () => {
    expect(calculateCostUsd('deepseek-v4-flash', undefined)).toBe(0);
    // TB-026: per-image non richiede usage, conta solo imageCount
    expect(calculateCostUsd('gemini-nano-banana', undefined, 2)).toBe(0.08);
    expect(calculateCostUsd('gemini-nano-banana', undefined, 0)).toBe(0);
  });

  it('Nano Banana 2 Lite: $0.02/immagine (metà di Nano Banana 2)', () => {
    expect(calculateCostUsd('gemini-nano-banana-lite', undefined, 1)).toBe(0.02);
  });

  it('geminiImagePricingId: mapping modello → pricingId a 3 vie', () => {
    expect(geminiImagePricingId('gemini-3.1-flash-lite-image')).toBe('gemini-nano-banana-lite');
    expect(geminiImagePricingId('gemini-2.0-flash-preview-image-generation')).toBe('gemini-flash-image');
    expect(geminiImagePricingId('gemini-3.1-flash-image')).toBe('gemini-nano-banana');
    expect(geminiImagePricingId(undefined)).toBe('gemini-nano-banana');
  });
});
