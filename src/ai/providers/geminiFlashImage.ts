/**
 * Gemini 2.0 Flash image generation provider (TB-023, REQ-MP-003).
 *
 * Alternative economica a Nano Banana 3.1 per icone/illustrazioni
 * piccole. Modello: `gemini-2.0-flash-preview-image-generation`.
 * Costo ~$0.02/immagine (vs $0.04 Nano Banana).
 *
 * Riusa `GeminiImageProvider` con modello diverso. Stesso SDK
 * `@google/genai`, stessa API `interactions.create()`, stesso
 * clamp 512px per restare sotto 500KB.
 */
import { GeminiImageProvider } from './gemini';

export const GEMINI_FLASH_MODEL = 'gemini-2.0-flash-preview-image-generation';

export class GeminiFlashImageProvider extends GeminiImageProvider {
  constructor(apiKey: string) {
    super(apiKey, GEMINI_FLASH_MODEL);
  }

  /**
   * Genera un'icona stilizzata flat 2-colori per card/flyer (REQ-IS-002).
   * Default 256x256, aspect 1:1, size 512 per clamp.
   */
  async generateIcon(
    prompt: string,
    options: { primaryColor: string; secondaryColor: string; style?: string },
    timeoutMs = 30_000,
  ): Promise<{ imageBase64: string; mimeType: string }> {
    const styleHint = options.style ?? 'minimalist';
    const fullPrompt = `Stylized flat illustration of ${prompt}. Two colors only: ${options.primaryColor} and ${options.secondaryColor}. Transparent background. No text, no border, no gradients, no shadows. Simple geometric shapes. 256x256 px. Style: ${styleHint}.`;
    return this.generateImage(
      fullPrompt,
      { image_size: '512', aspect_ratio: '1:1' },
      timeoutMs,
    );
  }

  /**
   * Genera un'illustrazione hero per flyer (REQ-IS-006). Più grande
   * di un'icona, aspect 16:9 per hero banner.
   */
  async generateHeroIllustration(
    prompt: string,
    options: { primaryColor: string; secondaryColor: string; style?: string },
    timeoutMs = 30_000,
  ): Promise<{ imageBase64: string; mimeType: string }> {
    const styleHint = options.style ?? 'minimalist';
    const fullPrompt = `Stylized flat hero illustration of ${prompt}. Two colors only: ${options.primaryColor} and ${options.secondaryColor}. Transparent background. No text, no border. Simple geometric shapes, editorial style. 1024x576 px (16:9). Style: ${styleHint}.`;
    return this.generateImage(
      fullPrompt,
      { image_size: '512', aspect_ratio: '16:9' },
      timeoutMs,
    );
  }
}