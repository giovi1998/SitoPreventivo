import type { BusinessCard } from '../utils/documentSchemas';
import type { AIProvider, ChatMessage, AIResponse, AIStreamChunk } from './types';
import { providerRegistry } from './providers/registry';
import { chatStore } from './chat/store';
import { buildCardSystemPrompt } from './prompts/cardSystem';
import { buildCardAIContext } from './prompts/cardContext';
import { aiCardInputSchema } from './aiCardInputSchema';
import { mergeCardAIResponse } from './cardMerge';
import { needsAnalysis } from './promptUtils';

function sanitizeAIResponse(raw: string): string {
  let s = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    s = s.slice(firstBrace, lastBrace + 1);
  }
  return s;
}

export interface CardProcessResult {
  card: BusinessCard;
  response: AIResponse;
  sessionId: string;
  changes: string[];
  rawResponse?: string;
}

export class CardAIOrchestrator {
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

  async processPrompt(
    card: BusinessCard,
    userPrompt: string,
    options?: {
      modelId?: string;
      onStream?: (chunk: AIStreamChunk) => void;
    },
  ): Promise<CardProcessResult> {
    const provider = providerRegistry.getProvider(options?.modelId);
    const prompt = userPrompt.trim();
    const changes: string[] = [];

    if (!this.activeSessionId) {
      this.activeSessionId = chatStore.createSession().id;
    }

    const { payload, relevantFields } = buildCardAIContext(card, prompt);

    const session = chatStore.getSession(this.activeSessionId)!;
    if (session.messages.length === 0) {
      session.messages.push({
        role: 'system',
        content: buildCardSystemPrompt(),
      });
    }

    const userMsg: ChatMessage = {
      role: 'user',
      content: `Bigliettino (campi: ${relevantFields.join(', ')}):\n${JSON.stringify(payload)}\n\nRichiesta: ${prompt}`,
    };
    chatStore.addMessage(this.activeSessionId, userMsg);

    const wantsAnalysis = needsAnalysis(prompt);
    let aiResponse: AIResponse;
    let streamedContent = '';
    let streamedUsage: AIResponse['usage'] | undefined;

    const canStream = !!options?.onStream && provider.supportsStreaming;

    if (canStream) {
      for await (const chunk of provider.stream(session.messages, {
        temperature: wantsAnalysis ? 0.3 : 0.4,
        responseFormat: wantsAnalysis ? undefined : { type: 'json_object' },
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
        temperature: wantsAnalysis ? 0.3 : 0.4,
        responseFormat: wantsAnalysis ? undefined : { type: 'json_object' },
      });
    }

    let currentCard = { ...card };

    // ─── ANALYSIS MODE ─────────────────────────────────
    if (wantsAnalysis) {
      chatStore.addMessage(this.activeSessionId!, {
        role: 'assistant',
        content: aiResponse.content || '',
      });
      return {
        card: currentCard,
        response: aiResponse,
        sessionId: this.activeSessionId!,
        changes: [],
        rawResponse: aiResponse.content || undefined,
      };
    }

    // ─── MODIFY MODE ───────────────────────────────────
    chatStore.addMessage(this.activeSessionId!, {
      role: 'assistant',
      content: aiResponse.content || '',
    });

    if (aiResponse.content) {
      const cleanJson = sanitizeAIResponse(aiResponse.content);
      try {
        const modified = JSON.parse(cleanJson);
        const validation = aiCardInputSchema.safeParse(modified);
        if (!validation.success) {
          changes.push(`error:invalid_card:${validation.error.issues.length}`);
        } else {
          const { card: merged, changes: mergeChanges } = mergeCardAIResponse(currentCard, modified);
          currentCard = merged;
          changes.push(...mergeChanges);
        }
      } catch {
        changes.push('error:not_json');
      }
    } else {
      changes.push('error:empty');
    }

    return {
      card: currentCard,
      response: aiResponse,
      sessionId: this.activeSessionId!,
      changes,
      rawResponse: aiResponse.content || undefined,
    };
  }
}
