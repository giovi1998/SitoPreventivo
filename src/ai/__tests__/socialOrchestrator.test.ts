import { describe, it, expect } from 'vitest';
import { socialPackOutputSchema, SocialAIOrchestrator } from '../socialOrchestrator';

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
});

describe('useAISocial (spec 12)', () => {
  it('hook import works', async () => {
    const mod = await import('../../hooks/useAISocial');
    expect(typeof mod.useAISocial).toBe('function');
  });
});
