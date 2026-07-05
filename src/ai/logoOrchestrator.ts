import { z } from 'zod';
import type { Logo } from '../utils/documentSchemas';
import { promptRegistry } from './prompts/registry';
import { buildLogoGeneratePrompt, sanitizeLogoBrief } from './prompts/logoSystem';
import { BaseOrchestrator } from './BaseOrchestrator';
import type { AIStreamChunk, AIResponse } from './types';

/**
 * Logo AI v2 orchestrator. Wraps BaseOrchestrator and produces a
 * structured `LogoAIOutput` payload validated against logoAIOutputSchema.
 * Guarded client-side: if `REPLICATE_API_TOKEN` is missing on the
 * server, the proxy endpoint returns 503; the orchestrator surfaces
 * the error and `applied: false`. Spec 11.
 */
export const logoAIOutputSchema = z.object({
  primaryText: z.string().max(30).default(''),
  tagline: z.string().max(60).default(''),
  iconType: z.enum(['none', 'shape', 'monogram', 'lucide']).default('none'),
  iconShape: z.enum(['circle', 'square', 'rounded', 'hex']).optional(),
  iconName: z.string().optional(),
  monogram: z.string().max(2).optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#01696F'),
  secondaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#1a1a2e'),
  layout: z.enum(['horizontal', 'vertical', 'stacked']).default('horizontal'),
});
export type LogoAIOutput = z.infer<typeof logoAIOutputSchema>;

export interface LogoProcessResult {
  logo: Logo;
  response: AIResponse;
  sessionId: string;
  changes: string[];
  rawResponse?: string;
  applied: boolean;
}

export class LogoAIOrchestrator extends BaseOrchestrator {
  async generateLogo(
    logo: Logo,
    brief: string,
    options: {
      sector?: string;
      modelId?: string;
      onStream?: (chunk: AIStreamChunk) => void;
      userEmail?: string;
    } = {},
  ): Promise<LogoProcessResult> {
    const changes: string[] = [];
    const sessionId = this.ensureSession();
    const systemPrompt = promptRegistry.getPrompt('logo-system');
    const userPrompt = buildLogoGeneratePrompt(brief, options.sector);
    const messages = this.buildMessages(systemPrompt, userPrompt);

    const response = await this.handleStream(
      // The actual provider is loaded inside handleStream from the registry
      // via a thin wrapper. The Logo AI v2 wire-up uses DeepSeek by default
      // (logo AI generation in v1 reuses the existing LLM contract; Replicate
      // is the v2 image model and is out of scope for this skeleton).
      await import('./providers/registry').then((m) => m.providerRegistry.getProvider(options.modelId)),
      messages,
      { temperature: 0.7, responseFormat: { type: 'json_object' } },
      { onStream: options.onStream },
    );

    const parsed = this.parseJsonResponse(response.content ?? '', logoAIOutputSchema);
    if (!parsed.ok) {
      chatStoreAddMessage(this.chatStore, sessionId, {
        role: 'assistant',
        content: response.content ?? '',
      });
      changes.push(`error:${parsed.error}`);
      return { logo, response, sessionId, changes, rawResponse: response.content ?? '', applied: false };
    }

    const merged = mergeLogoAIResponse(logo, parsed.data);
    this.trackUsage(response.usage, options.userEmail);
    chatStoreAddMessage(this.chatStore, sessionId, {
      role: 'assistant',
      content: response.content ?? '',
    });
    return {
      logo: merged,
      response,
      sessionId,
      changes: [`logo:generated:iconType=${parsed.data.iconType}`],
      rawResponse: response.content ?? '',
      applied: true,
    };
  }
}

/**
 * Defensive merge: only the editor-relevant builder fields are
 * overwritten; user-uploaded `logoUrl` (base64) is preserved, as
 * with card AI parity. The `selected` concept index is untouched
 * (AI re-runs are independent of user curation).
 */
export function mergeLogoAIResponse(logo: Logo, parsed: LogoAIOutput): Logo {
  return {
    ...logo,
    builder: {
      ...logo.builder,
      primaryText: parsed.primaryText || logo.builder.primaryText,
      tagline: parsed.tagline || logo.builder.tagline,
      iconType: parsed.iconType,
      iconShape: parsed.iconShape ?? logo.builder.iconShape,
      iconGlyph: parsed.iconType === 'lucide'
        ? (parsed.iconName ?? logo.builder.iconGlyph)
        : parsed.iconType === 'monogram'
          ? (parsed.monogram ?? logo.builder.iconGlyph)
          : '',
      primaryColor: parsed.primaryColor,
      secondaryColor: parsed.secondaryColor,
      layout: parsed.layout,
    },
    edits: {
      ...logo.edits,
      primaryText: parsed.primaryText,
      primaryColor: parsed.primaryColor,
      secondaryColor: parsed.secondaryColor,
    },
    brief: sanitizeLogoBrief(logo.brief ?? '') || '',
    updatedAt: new Date().toISOString(),
  };
}

// Local helper to keep the import list narrow without polluting the top.
function chatStoreAddMessage(
  store: import('./chat/store').ChatStore | typeof import('./chat/store').chatStore,
  sessionId: string,
  msg: import('./types').ChatMessage,
): void {
  store.addMessage(sessionId, msg);
}
