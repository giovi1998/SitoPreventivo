/**
 * Gemini image generation provider (Nano Banana 2).
 * Server-side only: `GEMINI_API_KEY` env var. The browser never sees
 * the key — it calls the `/ai/logo-background` proxy endpoint.
 *
 * Uses @google/genai SDK with interactions.create() API pattern.
 */

import { GoogleGenAI } from '@google/genai';

export interface GeminiImageResult {
  imageBase64: string;
  mimeType: string;
}

export class GeminiImageProvider {
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor(
    apiKey: string,
    model: string = 'gemini-3.1-flash-image',
  ) {
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async generateBackground(
    prompt: string,
    timeoutMs = 30_000,
    images: Array<{ data: string; mimeType: string }> = [],
  ): Promise<GeminiImageResult> {
    return this.generateImage(prompt, { image_size: '512', aspect_ratio: '16:9' }, timeoutMs, images);
  }

  async generateCardCover(
    prompt: string,
    timeoutMs = 30_000,
    images: Array<{ data: string; mimeType: string }> = [],
  ): Promise<GeminiImageResult> {
    // Business cards are landscape rectangles (~85×55mm); a 1:1 image
    // still works because preserveAspectRatio="xMidYMid slice" crops it to
    // fill. We keep 512px to stay under the 500KB base64 clamp.
    return this.generateImage(prompt, { image_size: '512', aspect_ratio: '1:1' }, timeoutMs, images);
  }

  async generateImage(
    prompt: string,
    imageConfig: { image_size: string; aspect_ratio: string },
    timeoutMs = 30_000,
    images: Array<{ data: string; mimeType: string }> = [],
  ): Promise<GeminiImageResult> {
    try {
      const input = this.buildInput(prompt, images);
      const interaction = await this.ai.interactions.create(
        {
          model: this.model,
          input,
          // Request the smallest resolution tier (512 = 0.5K) instead of
          // the 1K default. Nano Banana output size is highly variable
          // (400KB-2MB+) and our /ai/* endpoints clamp at 500KB (Vercel
          // response + Postgres jsonb storage budget), so asking for 512px
          // upfront avoids most 413 rejections instead of gambling on a
          // random 1K/2K output and discarding it after the fact.
          // See https://ai.google.dev/gemini-api/docs/image-generation
          generation_config: {
            image_config: imageConfig,
          },
          response_modalities: ['text', 'image'],
        },
        { timeout: timeoutMs },
      );

      const image = interaction.output_image;
      if (!image || !image.data) {
        throw new Error('GEMINI_NO_IMAGE_IN_RESPONSE');
      }

      return {
        imageBase64: image.data,
        mimeType: image.mime_type || 'image/png',
      };
    } catch (err) {
      const msg = (err as Error)?.message || '';
      if (msg.includes('GEMINI_NO_IMAGE_IN_RESPONSE')) {
        throw err;
      }
      if (msg.includes('401') || msg.includes('UNAUTHENTICATED')) {
        throw new Error('GEMINI_INVALID_KEY');
      }
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        throw new Error('GEMINI_QUOTA_EXCEEDED');
      }
      if (msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('timed out')) {
        throw new Error('GEMINI_TIMEOUT');
      }
      throw err;
    }
  }

  private buildInput(
    prompt: string,
    images: Array<{ data: string; mimeType: string }>,
  ): string | Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mime_type: string }> {
    if (!images.length) return prompt;
    const parts: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mime_type: string }> = [
      { type: 'text', text: prompt },
    ];
    for (const img of images) {
      const b64 = img.data.includes(',') ? img.data.split(',')[1] : img.data;
      parts.push({ type: 'image', data: b64, mime_type: img.mimeType });
    }
    return parts;
  }
}
