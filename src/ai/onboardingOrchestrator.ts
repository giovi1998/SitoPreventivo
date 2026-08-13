import { z } from 'zod';
import type { AIStreamChunk, AIResponse } from './types';
import { promptRegistry } from './prompts/registry';
import { buildOnboardingSuggestPrompt } from './prompts/onboardingSystem';
import { BaseOrchestrator } from './BaseOrchestrator';
import { providerRegistry } from './providers/registry';

/**
 * Onboarding AI suggester. Generates 3 company/profession options +
 * a default color based on the user's name and optional sector.
 * Spec 13. Pure data layer; UI opt-in via "Suggerisci da nome" button.
 */
export const onboardingSuggestSchema = z.object({
  displayName: z.string().max(40).default(''),
  companySuggestions: z.array(z.string().max(60)).length(3),
  professionSuggestions: z.array(z.string().max(50)).length(3),
  defaultColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type OnboardingSuggestions = z.infer<typeof onboardingSuggestSchema>;

export interface OnboardingSuggestResult {
  suggestions: OnboardingSuggestions;
  response: AIResponse;
  sessionId: string;
  changes: string[];
  rawResponse?: string;
  applied: boolean;
}

export class OnboardingAIOrchestrator extends BaseOrchestrator {
  protected aiKind = 'onboarding';

  async suggest(
    name: string,
    sector: string | undefined,
    options: {
      modelId?: string;
      onStream?: (chunk: AIStreamChunk) => void;
      userEmail?: string;
    } = {},
  ): Promise<OnboardingSuggestResult> {
    const sessionId = this.ensureSession();
    const systemPrompt = promptRegistry.getPrompt('onboarding-system');
    const userPrompt = buildOnboardingSuggestPrompt(name, sector);
    const messages = this.buildMessages(systemPrompt, userPrompt);

    const provider = providerRegistry.getProvider(options.modelId);
    const response = await this.handleStream(
      provider,
      messages,
      { reasoningEffort: 'max', responseFormat: { type: 'json_object' } },
      { onStream: options.onStream },
    );

    const parsed = this.parseJsonResponse(response.content ?? '', onboardingSuggestSchema);
    this.chatStore.addMessage(sessionId, {
      role: 'assistant',
      content: response.content ?? '',
    });
    this.trackUsage(response.usage, options.userEmail);

    if (!parsed.ok) {
      return {
        suggestions: { displayName: '', companySuggestions: [], professionSuggestions: [], defaultColor: '#1A1A1A' },
        response,
        sessionId,
        changes: [`error:${parsed.error}`],
        rawResponse: response.content ?? '',
        applied: false,
      };
    }
    return {
      suggestions: parsed.data,
      response,
      sessionId,
      changes: [`onboarding:suggested:${parsed.data.companySuggestions.length}`],
      rawResponse: response.content ?? '',
      applied: true,
    };
  }
}
