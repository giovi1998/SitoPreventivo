import type { BusinessCard } from '../documentSchemas';
import { buildCardCoverBrief } from './coverBrief';

export interface CardCoverPromptBrief {
  prompt: string;
  context: string;
}

export function buildCardCoverPromptBrief(card: BusinessCard, side: 'front' | 'back' = 'front'): CardCoverPromptBrief {
  return buildCardCoverBrief(card, side);
}
