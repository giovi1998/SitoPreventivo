import { z } from 'zod';
import { FLYER_HEADLINE_MAX, FLYER_SUBHEADLINE_MAX, FLYER_BODY_MAX, FLYER_CTA_LABEL_MAX } from '../../utils/documentSchemas';

export const flyerAIOutputSchema = z.object({
  headline: z.string().max(FLYER_HEADLINE_MAX).default(''),
  subheadline: z.string().max(FLYER_SUBHEADLINE_MAX).default(''),
  body: z.string().max(FLYER_BODY_MAX).default(''),
  cta: z.object({
    label: z.string().max(FLYER_CTA_LABEL_MAX).default(''),
  }).strict(),
  layoutAdvice: z.object({
    recommendedLayout: z.enum(['classic', 'centered', 'split', 'magazine']).optional(),
    recommendedSize: z.enum(['A6', 'A5', 'A4', 'Letter', 'Square']).optional(),
    reason: z.string().optional(),
  }).optional(),
  density: z.enum(['low', 'medium', 'high']).optional(),
});

export type FlyerAIOutputV2 = z.infer<typeof flyerAIOutputSchema>;
