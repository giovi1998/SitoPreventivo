import { describe, it, expect, vi } from 'vitest';
import { socialPackOutputSchema, SocialAIOrchestrator } from '../socialOrchestrator';
import { buildSocialGenerateAllPrompt } from '../prompts/socialSystem';

let fakeProvider: any;
vi.mock('../providers/registry', () => ({
  providerRegistry: {
    getProvider: () => fakeProvider,
    listProviders: () => [{ id: 'fake', name: 'Fake', model: 'fake-model', supportsStreaming: false, supportsTools: false, supportsVision: false }],
  },
}));

const VALID_PACK = JSON.stringify({
  posts: [
    { platform: 'instagram', caption: 'Ciao', hashtags: ['#food'], tone: 'casual' },
    { platform: 'facebook', caption: 'Welcome', hashtags: [], tone: 'promotional' },
    { platform: 'linkedin', caption: 'Pro', hashtags: [], tone: 'professional' },
  ],
});

describe('socialPackOutputSchema (spec 12)', () => {
  it('accepts a valid 3-post pack', () => {
    const parsed = socialPackOutputSchema.safeParse({
      posts: [
        { platform: 'instagram', caption: 'Ciao', hashtags: ['#food'], tone: 'casual' },
        { platform: 'facebook', caption: 'Welcome', hashtags: [], tone: 'promotional' },
        { platform: 'linkedin', caption: 'Pro', hashtags: ['#pro'], tone: 'professional' },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects fewer than 3 posts', () => {
    const parsed = socialPackOutputSchema.safeParse({
      posts: [
        { platform: 'instagram', caption: 'Ciao', hashtags: [], tone: 'casual' },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects more than 10 hashtags', () => {
    const parsed = socialPackOutputSchema.safeParse({
      posts: [
        { platform: 'instagram', caption: 'Ciao', hashtags: Array(11).fill('#tag'), tone: 'casual' },
        { platform: 'facebook', caption: 'x', hashtags: [], tone: 'promotional' },
        { platform: 'linkedin', caption: 'x', hashtags: [], tone: 'professional' },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects invalid platform', () => {
    const parsed = socialPackOutputSchema.safeParse({
      posts: [
        { platform: 'tiktok', caption: 'x', hashtags: [], tone: 'casual' },
        { platform: 'facebook', caption: 'x', hashtags: [], tone: 'promotional' },
        { platform: 'linkedin', caption: 'x', hashtags: [], tone: 'professional' },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts optional imagePrompt per post (social images)', () => {
    const parsed = socialPackOutputSchema.safeParse({
      posts: [
        { platform: 'instagram', caption: 'Ciao', hashtags: [], tone: 'casual', imagePrompt: 'flat lay of artisan pastries, warm light' },
        { platform: 'facebook', caption: 'x', hashtags: [], tone: 'promotional' },
        { platform: 'linkedin', caption: 'x', hashtags: [], tone: 'professional' },
      ],
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.posts[0].imagePrompt).toContain('pastries');
  });

  it('rejects imagePrompt over 500 chars', () => {
    const parsed = socialPackOutputSchema.safeParse({
      posts: [
        { platform: 'instagram', caption: 'x', hashtags: [], tone: 'casual', imagePrompt: 'a'.repeat(501) },
        { platform: 'facebook', caption: 'x', hashtags: [], tone: 'promotional' },
        { platform: 'linkedin', caption: 'x', hashtags: [], tone: 'professional' },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});

describe('SocialAIOrchestrator (spec 12)', () => {
  it('instantiable and provides provider list', () => {
    const o = new SocialAIOrchestrator();
    expect(o.getProviderList().length).toBeGreaterThan(0);
  });

  it('appends user prompt with priority when options.userPrompt is set', async () => {
    fakeProvider = {
      id: 'fake',
      name: 'Fake',
      model: 'fake-model',
      supportsStreaming: false,
      supportsTools: false,
      supportsVision: false,
      chat: vi.fn().mockResolvedValue({ content: VALID_PACK, usage: undefined }),
    };
    const o = new SocialAIOrchestrator();
    const result = await o.generatePosts(
      { type: 'card', sourceId: 'C1', data: { name: 'Mario', title: 'Chef', company: 'Trattoria', accentColor: '#fff' } },
      'casual',
      { userPrompt: 'Concentrati solo sulla cucina thai' },
    );
    expect(result.applied).toBe(true);
    const messages = fakeProvider.chat.mock.calls[0][0] as Array<{ role: string; content: string }>;
    const userMsg = messages.find((m) => m.role === 'user')!.content as string;
    expect(userMsg).toContain('Istruzioni aggiuntive dell\'utente');
    expect(userMsg).toContain('Concentrati solo sulla cucina thai');
    expect(userMsg).toContain(buildSocialGenerateAllPrompt(
      { type: 'card', sourceId: 'C1', data: { name: 'Mario', title: 'Chef', company: 'Trattoria', accentColor: '#fff' } },
      'casual',
    ).slice(0, 20));
  });
});

describe('useAISocial (spec 12)', () => {
  it('hook import works', async () => {
    const mod = await import('../../hooks/useAISocial');
    expect(typeof mod.useAISocial).toBe('function');
  });
});
