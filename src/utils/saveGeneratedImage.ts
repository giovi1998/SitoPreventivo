import dataService from './dataService';
import { compressDataUrl } from './card/imageCompress';

export type ImageCategory = 'cards' | 'flyers' | 'logos';
export type ImageSource = 'cover' | 'photo' | 'hero' | 'background' | 'icon';

const SOURCE_LABELS: Record<ImageSource, string> = {
  cover: 'Cover',
  photo: 'Foto',
  hero: 'Hero',
  background: 'Sfondo',
  icon: 'Icona',
};

const CATEGORY_LABELS: Record<ImageCategory, string> = {
  cards: 'Bigliettino',
  flyers: 'Volantino',
  logos: 'Logo',
};

let imageCounter = 0;

function generateId(): string {
  return `genimg_${Date.now()}_${++imageCounter}`;
}

/**
 * Auto-save an AI-generated image as a "generatedImage" document in the collection.
 * Compresses the image to ≤400KB/1024px before saving to avoid localStorage QuotaExceeded.
 * Fire-and-forget: failures are logged but never block the caller.
 */
export async function saveGeneratedImage(
  userEmail: string | undefined,
  imageDataUrl: string,
  category: ImageCategory,
  source: ImageSource,
  prompt?: string,
): Promise<void> {
  if (!userEmail || !imageDataUrl) return;
  const title = `${CATEGORY_LABELS[category] || category} · ${SOURCE_LABELS[source] || source}`;
  const compressed = await compressDataUrl(imageDataUrl, 1024, 400_000);
  const finalDataUrl = compressed || imageDataUrl;
  console.log(`[saveGeneratedImage] ${category}/${source}: raw=${Math.round(imageDataUrl.length * 0.75 / 1024)}KB → compressed=${Math.round(finalDataUrl.length * 0.75 / 1024)}KB`);
  const doc = {
    id: generateId(),
    documentType: 'generatedImage' as const,
    title,
    userEmail,
    imageData: finalDataUrl,
    imageCategory: category,
    imageSource: source,
    prompt: prompt?.slice(0, 500) || undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  try {
    const result = await dataService.saveDocument(userEmail, doc);
    if (result?.error) {
      console.warn('[saveGeneratedImage] save returned error:', result.error);
    }
  } catch (err: any) {
    console.warn('[saveGeneratedImage] auto-save failed:', err?.message || err);
  }
}
