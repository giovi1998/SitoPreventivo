import type { BusinessCard } from '../documentSchemas';
import { isHttpUrl } from '../qrGenerator';

export function resolveCardQrPayload(card: BusinessCard): string {
  if (card.back.qrPayload && card.back.qrPayload.trim().length > 0) {
    return card.back.qrPayload;
  }
  return card.back.website || '';
}

export function getEffectiveQrPayload(card: BusinessCard): string {
  const resolved = resolveCardQrPayload(card);
  if (!resolved) return '';
  if (isHttpUrl(resolved)) return resolved;
  return resolved;
}
