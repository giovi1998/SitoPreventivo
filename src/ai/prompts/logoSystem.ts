/**
 * Logo AI system prompt (v2-ready). Consumed by the future
 * LogoAIOrchestrator (spec 11) once REPLICATE_API_TOKEN is configured.
 * In v1 the AI Generation tab in LogoEditor is disabled; this builder
 * is exported so the prompt is registered and the orchestrator can
 * pick it up when wired in.
 */

const LUCIDE_ALLOWLIST = [
  'Coffee', 'Pizza', 'Utensils', 'ChefHat', 'Wheat', 'Cookie',
  'Cloud', 'Code', 'Cpu', 'Database', 'Server', 'Terminal',
  'Shirt', 'Watch', 'Glasses', 'Crown', 'Diamond', 'Gem',
  'Briefcase', 'Building', 'ChartLine', 'Handshake', 'TrendingUp', 'Users',
  'Leaf', 'TreePine', 'Mountain', 'Sun', 'Waves', 'Flower2',
  'Camera', 'Music', 'Headphones', 'Gamepad2', 'BookOpen', 'Pen',
  'Heart', 'Star', 'Smile', 'Zap', 'Target', 'Compass',
  'Anchor', 'Plane', 'Car', 'Bike', 'Home', 'Sparkles',
];

export function buildLogoSystemPrompt(): string {
  return `Sei l'assistente AI per la generazione di loghi Quickbrand.
Output: SOLO JSON valido con questo contract:
{
  "primaryText": "string, max 30 char, nome brand",
  "tagline": "string, max 60 char, slogan",
  "iconType": "none" | "shape" | "monogram" | "lucide",
  "iconShape": "circle" | "square" | "rounded" | "hex" (solo se iconType=shape o monogram),
  "iconName": "string (solo se iconType=lucide, DEVE essere nella allowlist sotto)",
  "monogram": "string 1-2 lettere (solo se iconType=monogram)",
  "primaryColor": "#RRGGBB",
  "secondaryColor": "#RRGGBB",
  "layout": "horizontal" | "vertical" | "stacked"
}

ALLOWLIST LUCIDE (48 nomi): ${LUCIDE_ALLOWLIST.join(', ')}.

SETTORI PREDEFINITI (usa come default se settore specificato nel brief):
- tech: iconType=shape, layout=horizontal, primaryColor=#01696F, secondaryColor=#1A1A1A
- food: iconType=shape, layout=stacked, primaryColor=#E62020, secondaryColor=#1A1A1A
- fashion: iconType=lucide, layout=vertical, primaryColor=#1A1A1A, secondaryColor=#E62020
- professionista: iconType=monogram, layout=horizontal, primaryColor=#1e3a5f, secondaryColor=#1A1A1A

REGOLE:
- NON inventare iconName fuori allowlist.
- NON inventare campi fuori contract (no url, font, size, ecc.).
- Colori: SOLO #RRGGBB 6 cifre esadecimali.
- Se il brief è vuoto: genera logo neutro (iconType=shape, colori grigio/blu).
- Lingua output: italiano per primaryText/tagline.`;
}

export function buildLogoGeneratePrompt(brief: string, sector?: string): string {
  const safeBrief = sanitizeLogoBrief(brief);
  const safeSector = sector ? sector.toLowerCase() : '';
  return `Genera un logo per il seguente brief:

Brief: "${safeBrief || 'Logo per attività generica'}"
${safeSector ? `Settore: ${safeSector}` : ''}

Rispondi con SOLO il JSON del contract (vedi system prompt).
Rispetta l'allowlist lucide se usi iconType=lucide.`;
}

export function sanitizeLogoBrief(brief: string): string {
  return brief
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}
