import { GOLDEN_SOCIAL_EXAMPLE } from './goldenExamples';

/**
 * Social AI system + generate prompt (cross-module). Generates 3
 * coordinated social posts (Instagram, Facebook, LinkedIn) starting
 * from a CardSnapshot or FlyerSnapshot. Consumed by future
 * SocialAIOrchestrator (spec 12).
 */

export type SocialTone = 'professional' | 'casual' | 'promotional';
export type SocialPlatform = 'instagram' | 'facebook' | 'linkedin';
export type SocialSourceType = 'card' | 'flyer' | 'website';

export type CardSnapshot = {
  name: string;
  title: string;
  company: string;
  accentColor: string;
  services?: string[];
};

export type FlyerSnapshot = {
  headline: string;
  subheadline: string;
  body: string;
  ctaLabel: string;
  sector?: string;
};

export type WebsiteSnapshot = {
  businessName: string;
  sector?: string;
  description?: string;
  target?: string;
  cta?: string;
  features?: string;
  contact?: string;
};

export type SocialSource =
  | { type: 'card'; data: CardSnapshot; sourceId: string }
  | { type: 'flyer'; data: FlyerSnapshot; sourceId: string }
  | { type: 'website'; data: WebsiteSnapshot; sourceId: string };

const PLATFORM_CAPTION_MAX: Record<SocialPlatform, number> = {
  instagram: 500,
  facebook: 1000,
  linkedin: 1500,
};

export function buildSocialSystemPrompt(): string {
  return `Sei l'assistente AI per la generazione di social post Quickbrand.
Generi 3 post (uno per piattaforma: Instagram, Facebook, LinkedIn) coordinati
con un documento sorgente (bigliettino da visita, volantino o sito web).

Output: SOLO JSON valido con questo contract:
{
  "posts": [
    {
      "platform": "instagram" | "facebook" | "linkedin",
      "caption": "string (max 500/1000/1500 per piattaforma)",
      "hashtags": ["#word", ...] (max 10 per post),
      "tone": "professional" | "casual" | "promotional",
      "imagePrompt": "string OBBLIGATORIA (max 500, IN INGLESE): descrizione visuale CONCRETA per generare la foto del post — soggetto specifico tratto dai servizi/prodotti della sorgente, setting, luce, stile fotografico. Esempio per un ristorante thai: 'Steaming pad thai noodles with shrimp and peanuts on a rustic wooden table, warm restaurant lighting, shallow depth of field, professional food photography'. MAI testo scritto, loghi o watermark nell'immagine. MAI descrizioni vaghe tipo 'visual coerente col brand'"
    }
  ]
}

REGOLE:
- 3 post, uno per piattaforma.
- I 3 post DEVONO essere DIVERSI tra loro, non ripetizioni:
  - Instagram: caption breve e visuale, emoji ammessi, 5-10 hashtag, tono engaging. Focus su estetica e immagine.
  - Facebook: caption più discorsivo, contesto e storia, 3-5 hashtag, tono amichevole e community.
  - LinkedIn: caption professionale, valore e insight business, 2-3 hashtag, tono formale e autorevole.
- Caption coerente col documento sorgente (nome brand, servizi/headline).
- Hashtag: max 10 per post, formato #word (no spazi, no punteggiatura interna).
 - NON INVENTARE prezzi, date, luoghi non presenti nel documento sorgente.
 - imagePrompt: visuale coerente col brand/servizi della sorgente, in inglese,
   fotografico o illustrato, SENZA testo scritto né loghi nell'immagine.
 - Lingua caption: italiano.

${GOLDEN_SOCIAL_EXAMPLE}`;
}

export function buildSocialGeneratePrompt(
  document: SocialSource,
  tone: SocialTone,
  platform: SocialPlatform,
): string {
  const sourceSummary = document.type === 'card'
    ? `Bigliettino di ${document.data.name} (${document.data.title}) @ ${document.data.company}. Servizi: ${document.data.services?.join(', ') || 'n/d'}.`
    : document.type === 'flyer'
      ? `Volantino "${document.data.headline}". Sub: ${document.data.subheadline}. Body: ${document.data.body}. CTA: ${document.data.ctaLabel}.`
      : `Sito web di ${document.data.businessName}. Settore: ${document.data.sector || 'n/d'}. Descrizione: ${document.data.description || 'n/d'}. Target: ${document.data.target || 'n/d'}. CTA: ${document.data.cta || 'n/d'}. Servizi: ${document.data.features || 'n/d'}. Contatti: ${document.data.contact || 'n/d'}.`;

  return `Genera un post per la piattaforma ${platform} (tone: ${tone}).

Sorgente: ${sourceSummary}

Limiti: caption max ${PLATFORM_CAPTION_MAX[platform]} char, max 10 hashtag.
Rispondi con SOLO l'oggetto JSON: { platform, caption, hashtags, tone }.`;
}

export function buildSocialGenerateAllPrompt(document: SocialSource, tone: SocialTone): string {
  const sourceSummary = document.type === 'card'
    ? `Bigliettino di ${document.data.name} (${document.data.title}) @ ${document.data.company}. Servizi: ${document.data.services?.join(', ') || 'n/d'}.`
    : document.type === 'flyer'
      ? `Volantino "${document.data.headline}". Sub: ${document.data.subheadline}. Body: ${document.data.body}. CTA: ${document.data.ctaLabel}.`
      : `Sito web di ${document.data.businessName}. Settore: ${document.data.sector || 'n/d'}. Descrizione: ${document.data.description || 'n/d'}. Target: ${document.data.target || 'n/d'}. CTA: ${document.data.cta || 'n/d'}. Servizi: ${document.data.features || 'n/d'}. Contatti: ${document.data.contact || 'n/d'}.`;

  return `Genera 3 social post (Instagram, Facebook, LinkedIn) per:

Sorgente: ${sourceSummary}
Tone: ${tone}

Limiti: caption max 500/1000/1500 char rispettivamente. Max 10 hashtag per post.
Rispondi con SOLO il JSON: { posts: [{ platform, caption, hashtags, tone }, ...] }.`;
}
