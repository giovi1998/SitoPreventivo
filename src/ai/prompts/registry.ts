import { buildSystemPrompt } from './system';
import { buildCardSystemPrompt } from './cardSystem';
import { buildFlyerSystemPrompt, buildFlyerCopyPrompt } from './flyerSystem';
import { buildLogoSystemPrompt } from './logoSystem';
import { buildSocialSystemPrompt } from './socialSystem';
import { buildOnboardingSystemPrompt } from './onboardingSystem';
import { buildWebsiteSystemPrompt, buildWebsiteHtmlPrompt, buildWebsiteCssPrompt, buildWebsiteJsPrompt, buildWebsiteVerifyPrompt } from './websiteSystem';

export type PromptContext = Record<string, unknown>;
export type PromptBuilder = (ctx?: PromptContext) => string;

export interface PromptEntry {
  id: string;
  description: string;
}

/**
 * Centralized registry for all AI prompt builders in the project,
 * modeled after AIProviderRegistry. Subclasses/hooks call
 * `promptRegistry.getPrompt(id, ctx)` to fetch a system or user
 * prompt without coupling to a specific file. This enables A/B
 * testing, env-driven overrides, and prompt versioning in the
 * future without refactoring each orchestrator.
 *
 * New prompts must be registered in the constructor (or via
 * `register(id, builder, description)`) to be reachable through
 * the registry.
 */
export class AIPromptRegistry {
  private builders = new Map<string, PromptBuilder>();
  private descriptions = new Map<string, string>();
  private defaultId: string | null = null;

  register(id: string, builder: PromptBuilder, description: string = ''): void {
    if (this.builders.has(id) && typeof console !== 'undefined') {
      console.warn(`[promptRegistry] id sovrascritto: ${id}`);
    }
    this.builders.set(id, builder);
    this.descriptions.set(id, description);
  }

  getPrompt(id: string, ctx?: PromptContext): string {
    const b = this.builders.get(id);
    if (!b) {
      throw new Error(`Prompt non registrato: ${id}`);
    }
    return b(ctx);
  }

  hasPrompt(id: string): boolean {
    return this.builders.has(id);
  }

  listPrompts(): PromptEntry[] {
    return [...this.builders.keys()].map((id) => ({
      id,
      description: this.descriptions.get(id) ?? '',
    }));
  }

  setDefaultId(id: string): void {
    if (!this.builders.has(id)) {
      throw new Error(`Prompt non registrato: ${id}`);
    }
    this.defaultId = id;
  }

  getDefaultId(): string {
    return this.defaultId ?? '';
  }
}

export const promptRegistry = new AIPromptRegistry();

promptRegistry.register(
  'quote-system',
  (ctx) => buildSystemPrompt((ctx?.compact as boolean | undefined) ?? true),
  'Quote system prompt (compact default)'
);
promptRegistry.register(
  'card-system',
  () => buildCardSystemPrompt(),
  'Card system prompt'
);
promptRegistry.register(
  'flyer-system',
  () => buildFlyerSystemPrompt(),
  'Flyer system prompt'
);
promptRegistry.register(
  'flyer-copy',
  (ctx) => {
    const brief = String(ctx?.brief ?? '');
    const tone = (ctx?.tone as Parameters<typeof buildFlyerCopyPrompt>[1]) ?? 'formale';
    const context = (ctx?.context as Parameters<typeof buildFlyerCopyPrompt>[2]) ?? {
      layout: 'classic',
      size: 'A5',
      bodyCharBudget: 500,
    };
    return buildFlyerCopyPrompt(brief, tone, context);
  },
  'Flyer copy user prompt'
);

promptRegistry.setDefaultId('quote-system');
promptRegistry.register('logo-system', () => buildLogoSystemPrompt(), 'Logo system prompt (v2 ready)');
promptRegistry.register('social-system', () => buildSocialSystemPrompt(), 'Social system prompt');
promptRegistry.register('onboarding-system', () => buildOnboardingSystemPrompt(), 'Onboarding system prompt');
promptRegistry.register('website-system', () => buildWebsiteSystemPrompt(), 'Website system prompt');
promptRegistry.register('website-html', () => buildWebsiteHtmlPrompt({} as any, 'modern'), 'Website HTML agent prompt');
promptRegistry.register('website-css', () => buildWebsiteCssPrompt('', 'modern', {}), 'Website CSS agent prompt');
promptRegistry.register('website-js', () => buildWebsiteJsPrompt(''), 'Website JS agent prompt');
promptRegistry.register('website-verify', () => buildWebsiteVerifyPrompt('', '', ''), 'Website verify agent prompt');
