import { z } from 'zod';
import type { AIStreamChunk, AIResponse } from './types';
import { promptRegistry } from './prompts/registry';
import {
  buildSocialGenerateAllPrompt,
  type SocialSource,
  type SocialTone,
  type SocialPlatform,
} from './prompts/socialSystem';
import { BaseOrchestrator } from './BaseOrchestrator';
import { providerRegistry } from './providers/registry';

/**
 * Social AI cross-module orchestrator. Reads data from a Card or
 * Flyer and produces 3 social posts (Instagram, Facebook, LinkedIn)
 * coordinated with the source brand. Spec 12.
 */
export const socialPostSchema = z.object({
  platform: z.enum(['instagram', 'facebook', 'linkedin']),
  caption: z.string().max(2000),
  hashtags: z.array(z.string()).max(10),
  tone: z.enum(['professional', 'casual', 'promotional']),
});
export type SocialPost = z.infer<typeof socialPostSchema>;

export const socialPackOutputSchema = z.object({
  posts: z.array(socialPostSchema).length(3),
});
export type SocialPackOutput = z.infer<typeof socialPackOutputSchema>;

export interface SocialProcessResult {
  posts: SocialPost[];
  response: AIResponse;
  sessionId: string;
  changes: string[];
  rawResponse?: string;
  applied: boolean;
}

export class SocialAIOrchestrator extends BaseOrchestrator {
  protected aiKind = 'social';

  async generatePosts(
    source: SocialSource,
    tone: SocialTone,
    options: {
      modelId?: string;
      onStream?: (chunk: AIStreamChunk) => void;
      userEmail?: string;
      imagePreviewBase64?: string;
    } = {},
  ): Promise<SocialProcessResult> {
    const changes: string[] = [];
    const sessionId = this.ensureSession();
    const systemPrompt = promptRegistry.getPrompt('social-system');
    const userPrompt = buildSocialGenerateAllPrompt(source, tone);

    const provider = providerRegistry.getProvider(options.modelId);
    const hasImagePreview = !!options.imagePreviewBase64;
    const useVision = hasImagePreview && (provider as { supportsVision?: boolean }).supportsVision;
    const userContentParts: string[] = [];
    if (useVision && options.imagePreviewBase64) {
      userContentParts.push(`Anteprima documento allegata (base64 JPEG): ${options.imagePreviewBase64}`);
    }
    userContentParts.push(userPrompt);
    const messages = this.buildMessages(systemPrompt, userContentParts.join('\n\n'));

    const response = await this.handleStream(
      provider,
      messages,
      { reasoningEffort: 'max', responseFormat: { type: 'json_object' } },
      { onStream: options.onStream },
    );

    const parsed = this.parseJsonResponse(response.content ?? '', socialPackOutputSchema);
    this.chatStore.addMessage(sessionId, {
      role: 'assistant',
      content: response.content ?? '',
    });
    this.trackUsage(response.usage, options.userEmail);

    if (!parsed.ok) {
      changes.push(`error:${parsed.error}`);
      return {
        posts: [],
        response,
        sessionId,
        changes,
        rawResponse: response.content ?? '',
        applied: false,
      };
    }
    return {
      posts: parsed.data.posts,
      response,
      sessionId,
      changes: [`social:generated:${parsed.data.posts.length}`],
      rawResponse: response.content ?? '',
      applied: true,
    };
  }
}

/** Re-export helpers so callers can import them from a single path. */
export type { SocialSource, SocialTone, SocialPlatform };
