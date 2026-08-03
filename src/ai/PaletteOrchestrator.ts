// TB-027 B5: palette AI orchestrator. Genera 3 palette suggerite da brief.
// Riusa BaseOrchestrator (handleStream, parseJsonResponse, trackUsage).
// ponytail: niente tools, niente image gen (SVG preview è client-side puro).

import { z } from 'zod';
import { BaseOrchestrator } from './BaseOrchestrator';
import { promptRegistry } from './prompts/registry';
import { buildPaletteSystemPrompt, buildPaletteUserPrompt, type PaletteBrief } from './prompts/paletteSystem';
import type { AIResponse, AIStreamChunk } from './types';
import { providerRegistry } from './providers/registry';

export const paletteConceptSchema = z.object({
  name: z.string().min(1).max(30),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  bg: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  text: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  rationale: z.string().max(160),
});

export const paletteConceptsSchema = z.array(paletteConceptSchema).length(3);

export type PaletteConcept = z.infer<typeof paletteConceptSchema>;

export interface PaletteProcessResult {
  concepts: PaletteConcept[];
  response: AIResponse;
  sessionId: string;
  costUsd: number;
}

// Registra il prompt nel registry (idempotente: sovrascrive se esiste)
if (!promptRegistry.hasPrompt('palette-system')) {
  promptRegistry.register('palette-system', () => buildPaletteSystemPrompt(), 'Palette system prompt');
}

export class PaletteAIOrchestrator extends BaseOrchestrator {
  async generatePalettes(
    brief: PaletteBrief,
    options: {
      modelId?: string;
      onStream?: (chunk: AIStreamChunk) => void;
      userEmail?: string;
    } = {},
  ): Promise<PaletteProcessResult> {
    const sessionId = this.ensureSession();
    const systemPrompt = promptRegistry.getPrompt('palette-system');
    const userPrompt = buildPaletteUserPrompt(brief);
    const providerId = options.modelId || 'deepseek-v4-flash';
    const provider = providerRegistry.getProvider(providerId);
    const messages = this.buildMessages(systemPrompt, userPrompt);
    const { response, providerId: finalProviderId } = await this.executeWithFallback(
      providerId, messages,
      { reasoningEffort: 'max', responseFormat: { type: 'json_object' } },
      { onStream: options.onStream },
    );
    const raw = response.content || '[]';
    const parsed = this.parseJsonResponse(raw, paletteConceptsSchema);
    if (!parsed.ok) {
      throw new Error(`Palette parse fail: ${parsed.error}`);
    }
    const costUsd = this.trackUsage(response.usage, options.userEmail, finalProviderId);
    return {
      concepts: parsed.data,
      response,
      sessionId,
      costUsd,
    };
  }
}