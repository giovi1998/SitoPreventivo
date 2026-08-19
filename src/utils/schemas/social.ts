import { z } from 'zod';

// ─── SOCIAL PACK (Phase 12) ──────────────────────────────────
// Cross-module AI: 3 social post coordinati col documento sorgente (card, flyer o sito web).
export const socialPlatformSchema = z.enum(['instagram', 'facebook', 'linkedin']);
export const socialToneSchema = z.enum(['professional', 'casual', 'promotional']);
export const socialPostSchema = z.object({
  platform: socialPlatformSchema,
  caption: z.string().max(2000).default(''),
  hashtags: z.array(z.string().max(40)).max(10).default([]),
  tone: socialToneSchema,
});
export const socialSourceTypeSchema = z.enum(['card', 'flyer', 'website']);
export type SocialSourceType = z.infer<typeof socialSourceTypeSchema>;

export const socialPackSchema = z.object({
  documentType: z.literal('socialPack'),
  id: z.string().min(1),
  userEmail: z.string().email().optional(),
  title: z.string().default(''),
  posts: z.array(socialPostSchema).length(3),
  sourceDocumentId: z.string().optional(),
  sourceDocumentType: socialSourceTypeSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SocialPlatform = z.infer<typeof socialPlatformSchema>;
export type SocialTone = z.infer<typeof socialToneSchema>;
export type SocialPost = z.infer<typeof socialPostSchema>;
export type SocialPack = z.infer<typeof socialPackSchema>;

export function createEmptySocialPack(sourceId?: string, sourceType?: SocialSourceType): SocialPack {
  const now = new Date().toISOString();
  return {
    documentType: 'socialPack',
    id: `social_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: 'Social Pack',
    posts: [
      { platform: 'instagram', caption: '', hashtags: [], tone: 'casual' },
      { platform: 'facebook', caption: '', hashtags: [], tone: 'promotional' },
      { platform: 'linkedin', caption: '', hashtags: [], tone: 'professional' },
    ],
    sourceDocumentId: sourceId,
    sourceDocumentType: sourceType,
    createdAt: now,
    updatedAt: now,
  };
}
