import { calculateCostUsd, geminiImagePricingId } from '../../ai/providerPricing';
import { IMAGE_TOKEN_COST } from '../../ai/costs';
import dataService from '../dataService';

/**
 * t16: fetch unico per gli endpoint immagine AI (`/api/ai/*`).
 * Copre il pattern identico ripetuto in useAICard/useAIFlyer/useAISocial/
 * useAIIconHero: POST con requestId, error mapping, calcolo costo,
 * trackTokens (admin escluso), ritorno dataUrl + costUsd.
 */
export async function postAiImage(opts: {
  endpoint: string;
  payload: Record<string, unknown>;
  requestId: string;
  imageModel: string;
  userEmail?: string;
  fallbackError: string;
  /** Messaggio custom se l'endpoint risponde 404 (es. route mancante in locale). */
  notFoundHint?: string;
}): Promise<{ dataUrl: string; costUsd: number; mimeType: string; sizeKB: number }> {
  const apiBase = import.meta.env?.VITE_API_BASE || '';
  const res = await fetch(`${apiBase}${opts.endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Request-Id': opts.requestId },
    body: JSON.stringify(opts.payload),
  });
  if (!res.ok) {
    if (res.status === 404 && opts.notFoundHint) throw new Error(opts.notFoundHint);
    const err = await res.json().catch(() => ({ error: `${opts.fallbackError} (${res.status})` }));
    throw new Error(err.error || opts.fallbackError);
  }
  const { data } = (await res.json()) as { data: { imageBase64: string; mimeType: string } };
  const dataUrl = `data:${data.mimeType};base64,${data.imageBase64}`;
  const costUsd = calculateCostUsd(geminiImagePricingId(opts.imageModel), undefined, 1);
  if (opts.userEmail && opts.userEmail !== 'admin@gmail.com') {
    Promise.resolve(dataService.trackTokens(opts.userEmail, IMAGE_TOKEN_COST, costUsd) as unknown as Promise<unknown>).catch(() => {});
  }
  return { dataUrl, costUsd, mimeType: data.mimeType, sizeKB: Math.round(data.imageBase64.length * 0.75 / 1024) };
}
