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

// Nano Banana 2 Lite supporta SOLO la risoluzione 1K (docs Google):
// chiedere 2K/512 fallirebbe o verrebbe ignorato.
export const GEMINI_LITE_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';

export function resolveImageSize(model: string, requestedSize: string): string {
  return model === GEMINI_LITE_IMAGE_MODEL ? '1K' : requestedSize;
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
    timeoutMs = 45_000,
    images: Array<{ data: string; mimeType: string }> = [],
  ): Promise<GeminiImageResult> {
    // 1K (short side 1024): 2K è 2752×1536 ~3.2MB → 4.4MB base64, oltre il
    // limite risposta Vercel 4.5MB (probe live 2026-08-07).
    return this.generateImage(prompt, { image_size: '1K', aspect_ratio: '16:9' }, timeoutMs, images);
  }

  async generateCardCover(
    prompt: string,
    timeoutMs = 30_000,
    images: Array<{ data: string; mimeType: string }> = [],
  ): Promise<GeminiImageResult> {
    // Business cards are landscape rectangles (~85×55mm); a 1:1 image
    // still works because preserveAspectRatio="xMidYMid slice" crops it to
    // fill. 1K copre i 1004×650px @300dpi dell'export con margine.
    return this.generateImage(prompt, { image_size: '1K', aspect_ratio: '1:1' }, timeoutMs, images);
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
          generation_config: {
            image_config: {
              image_size: resolveImageSize(this.model, imageConfig.image_size),
              aspect_ratio: imageConfig.aspect_ratio,
            },
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
