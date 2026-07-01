import { z } from 'zod';
import type { Flyer, FlyerTone, FlyerLayout, FlyerSize } from '../utils/documentSchemas';
import { FLYER_HEADLINE_MAX, FLYER_SUBHEADLINE_MAX, FLYER_BODY_MAX, FLYER_CTA_LABEL_MAX } from '../utils/documentSchemas';
import type { AIProvider, ChatMessage, AIResponse, AIStreamChunk } from './types';
import { providerRegistry } from './providers/registry';
import { chatStore } from './chat/store';
import { buildFlyerSystemPrompt, buildFlyerCopyPrompt, type FlyerCopyContext } from './prompts/flyerSystem';

/**
 * Zod schema for the AI response shape. Used to validate the LLM JSON
 * output and surface clear errors to the user (vs. letting a partial /
 * malformed payload silently overwrite the flyer).
 *
 * Intentionally permissive: only what's strictly needed for the copy
 * fields. `url` is user-supplied, never AI-generated, so it's not in
 * the AI input/output schema. Lengths match the file's zod field caps
 * to keep the merge step lossless.
 */
export const flyerAIOutputSchema = z.object({
  headline: z.string().max(FLYER_HEADLINE_MAX).default(''),
  subheadline: z.string().max(FLYER_SUBHEADLINE_MAX).default(''),
  body: z.string().max(FLYER_BODY_MAX).default(''),
  cta: z.object({
    label: z.string().max(FLYER_CTA_LABEL_MAX).default(''),
  }).strict(),
});
export type FlyerAIOutput = z.infer<typeof flyerAIOutputSchema>;

export interface FlyerProcessResult {
  flyer: Flyer;
  response: AIResponse;
  sessionId: string;
  changes: string[];
  rawResponse?: string;
  /** True when the AI produced a parseable JSON payload (vs analysis text). */
  applied: boolean;
}

export type FlyerRefineAction = 'simplify' | 'formal' | 'young' | 'urgent';

const REFINE_INSTRUCTIONS: Record<FlyerRefineAction, string> = {
  simplify:
    'Semplifica il copy: riduci il body a max 200 caratteri mantenendo il messaggio principale. Lascia headline e subheadline invariate se possibile.',
  formal:
    'Riformula in tono formale e professionale: lessico curato, niente contrazioni, niente espressioni colloquiali. Mantieni la struttura.',
  young:
    'Riformula in tono giovane e diretto: contrazioni ammesse, frasi brevi, energico. Mantieni la struttura.',
  urgent:
    'Aggiungi un senso di urgenza: usa "solo oggi", "ultimi posti", "offerta limitata", "non perdere" nel body e nella CTA label. Mantieni la struttura.',
};

const REFINE_CHANGE_LABEL: Record<FlyerRefineAction, string> = {
  simplify: 'Semplificato',
  formal: 'Più formale',
  young: 'Più giovanile',
  urgent: 'Aggiunta urgenza',
};

function sanitizeAIResponse(raw: string): string {
  let s = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    s = s.slice(firstBrace, lastBrace + 1);
  }
  return s;
}

function bodyCharBudgetFor(size: FlyerSize): number {
  // Larger formats get more body budget. Square gets slightly more
  // (equal aspect means more vertical room). A5 default = 500.
  if (size === 'A4' || size === 'Letter') return 800;
  if (size === 'Square') return 600;
  if (size === 'A6') return 300;
  return 500;
}

export class FlyerAIOrchestrator {
  private activeSessionId: string | null = null;

  getCurrentSessionId(): string | null {
    return this.activeSessionId;
  }

  resetSession(): void {
    if (this.activeSessionId) {
      chatStore.clearSession(this.activeSessionId);
    }
    this.activeSessionId = null;
  }

  getProviderList(): { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean }[] {
    return providerRegistry.listProviders();
  }

  /**
   * Generate fresh copy from a brief + tone. Used by the "Genera copy"
   * button in the editor. The output is merged into the flyer's
   * `content` field; `url` is preserved from the current flyer (or
   * stays empty) since AI never invents URLs.
   */
  async generateCopy(
    flyer: Flyer,
    brief: string,
    tone: FlyerTone,
    options?: { modelId?: string; onStream?: (chunk: AIStreamChunk) => void }
  ): Promise<FlyerProcessResult> {
    return this.runPrompt(flyer, () => {
      const ctx: FlyerCopyContext = {
        layout: flyer.style.layout,
        size: flyer.size,
        bodyCharBudget: bodyCharBudgetFor(flyer.size),
      };
      return buildFlyerCopyPrompt(brief, tone, ctx);
    }, options);
  }

  /**
   * Refine the current copy using a preset action. Builds a prompt that
   * embeds the current flyer's copy and asks the model to rewrite it
   * according to the action.
   */
  async refineCopy(
    flyer: Flyer,
    action: FlyerRefineAction,
    options?: { modelId?: string; onStream?: (chunk: AIStreamChunk) => void }
  ): Promise<FlyerProcessResult> {
    return this.runPrompt(flyer, () => {
      const currentJson = JSON.stringify({
        headline: flyer.content.headline,
        subheadline: flyer.content.subheadline,
        body: flyer.content.body,
        cta: { label: flyer.content.cta.label },
      }, null, 2);
      return `Copy attuale del volantino:
${currentJson}

Azione richiesta: ${REFINE_INSTRUCTIONS[action]}

Restituisci SOLO il JSON aggiornato con la stessa struttura.`;
    }, options, REFINE_CHANGE_LABEL[action]);
  }

  /**
   * Internal: shared prompt→stream→parse→merge pipeline. Both generate
   * and refine use this so the merge + validation logic lives in one
   * place.
   */
  private async runPrompt(
    flyer: Flyer,
    buildPrompt: () => string,
    options?: { modelId?: string; onStream?: (chunk: AIStreamChunk) => void },
    changeLabel?: string
  ): Promise<FlyerProcessResult> {
    const provider: AIProvider = providerRegistry.getProvider(options?.modelId);
    const prompt = buildPrompt();
    const changes: string[] = [];

    if (!this.activeSessionId) {
      this.activeSessionId = chatStore.createSession().id;
    }
    const session = chatStore.getSession(this.activeSessionId)!;
    if (session.messages.length === 0) {
      session.messages.push({
        role: 'system',
        content: buildFlyerSystemPrompt(),
      });
    }
    chatStore.addMessage(this.activeSessionId, { role: 'user', content: prompt });

    let aiResponse: AIResponse;
    let streamedContent = '';
    let streamedUsage: AIResponse['usage'] | undefined;
    const canStream = !!options?.onStream && provider.supportsStreaming;

    if (canStream) {
      for await (const chunk of provider.stream(session.messages, {
        temperature: 0.7,
        responseFormat: { type: 'json_object' },
      })) {
        options.onStream!(chunk);
        if (chunk.type === 'content') {
          streamedContent += chunk.content || '';
        } else if (chunk.type === 'done' && chunk.usage) {
          streamedUsage = chunk.usage;
        } else if (chunk.type === 'error') {
          throw new Error(chunk.error);
        }
      }
      aiResponse = {
        content: streamedContent || null,
        usage: streamedUsage,
      };
    } else {
      aiResponse = await provider.chat(session.messages, {
        temperature: 0.7,
        responseFormat: { type: 'json_object' },
      });
    }

    chatStore.addMessage(this.activeSessionId!, {
      role: 'assistant',
      content: aiResponse.content || '',
    });

    let currentFlyer: Flyer = { ...flyer };
    let applied = false;

    if (aiResponse.content) {
      const clean = sanitizeAIResponse(aiResponse.content);
      try {
        const parsed = JSON.parse(clean);
        const validation = flyerAIOutputSchema.safeParse(parsed);
        if (!validation.success) {
          changes.push(`error:invalid_flyer:${validation.error.issues.length}`);
        } else {
          const out = validation.data;
          currentFlyer = {
            ...currentFlyer,
            content: {
              ...currentFlyer.content,
              headline: out.headline,
              subheadline: out.subheadline,
              body: out.body,
              cta: {
                ...currentFlyer.content.cta,
                label: out.cta.label,
              },
            },
            updatedAt: new Date().toISOString(),
          };
          applied = true;
          changes.push(changeLabel || 'copy_generated');
        }
      } catch {
        changes.push('error:not_json');
      }
    } else {
      changes.push('error:empty');
    }

    return {
      flyer: currentFlyer,
      response: aiResponse,
      sessionId: this.activeSessionId!,
      changes,
      rawResponse: aiResponse.content || undefined,
      applied,
    };
  }
}
