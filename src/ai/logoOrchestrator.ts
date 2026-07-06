import { z } from 'zod';
import type { Logo, LogoBuilder } from '../utils/documentSchemas';
import { promptRegistry } from './prompts/registry';
import { buildLogoGeneratePrompt, sanitizeLogoBrief } from './prompts/logoSystem';
import { BaseOrchestrator } from './BaseOrchestrator';
import { isValidLucideIcon } from '../utils/logoGenerator';
import type { AIStreamChunk, AIResponse } from './types';

/**
 * Logo AI v2 orchestrator. Wraps BaseOrchestrator and produces a
 * structured `LogoAIOutput` payload validated against logoAIOutputSchema.
 * Guarded client-side: if `REPLICATE_API_TOKEN` is missing on the
 * server, the proxy endpoint returns 503; the orchestrator surfaces
 * the error and `applied: false`. Spec 11.
 */
export const logoAIOutputSchema = z.object({
  primaryText: z.string().max(30).default(''),
  tagline: z.string().max(60).default(''),
  iconType: z.enum(['none', 'shape', 'monogram', 'lucide']).default('none'),
  iconShape: z.enum(['circle', 'square', 'rounded', 'hex']).optional(),
  iconName: z.string().optional(),
  monogram: z.string().max(2).optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#01696F'),
  secondaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#1a1a2e'),
  layout: z.enum(['horizontal', 'vertical', 'stacked']).default('horizontal'),
  backgroundColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  gradientFill: z.boolean().optional(),
  decorativeElements: z.array(z.enum(['underline', 'dotRing', 'topAccent'])).optional(),
  imagePrompt: z.string().max(600).optional(),
});
export type LogoAIOutput = z.infer<typeof logoAIOutputSchema>;

export const logoAIConceptsSchema = z.array(logoAIOutputSchema).length(3);
export type LogoAIConcepts = z.infer<typeof logoAIConceptsSchema>;

export interface LogoProcessResult {
  logo: Logo;
  response: AIResponse;
  sessionId: string;
  changes: string[];
  rawResponse?: string;
  applied: boolean;
  concepts: LogoBuilder[];
  selected: number;
}

export class LogoAIOrchestrator extends BaseOrchestrator {
  async generateLogo(
    logo: Logo,
    brief: string,
    options: {
      sector?: string;
      modelId?: string;
      onStream?: (chunk: AIStreamChunk) => void;
      userEmail?: string;
    } = {},
  ): Promise<LogoProcessResult> {
    const changes: string[] = [];
    const sessionId = this.ensureSession();
    const systemPrompt = promptRegistry.getPrompt('logo-system');
    const userPrompt = buildLogoGeneratePrompt(brief, options.sector);
    const messages = this.buildMessages(systemPrompt, userPrompt);

    const response = await this.handleStream(
      await import('./providers/registry').then((m) => m.providerRegistry.getProvider(options.modelId)),
      messages,
      { temperature: 0.7, responseFormat: { type: 'json_object' } },
      { onStream: options.onStream },
    );

    const parsed = this.parseJsonResponse(response.content ?? '', logoAIConceptsSchema);
    if (!parsed.ok) {
      chatStoreAddMessage(this.chatStore, sessionId, {
        role: 'assistant',
        content: response.content ?? '',
      });
      changes.push(`error:${parsed.error}`);
      return { logo, response, sessionId, changes, rawResponse: response.content ?? '', applied: false, concepts: [], selected: -1 };
    }

    const concepts = ensureThreeDistinctConcepts(parsed.data).map((c) => convertAIOutputToBuilder(c));
    const first = concepts[0];
    const merged = first ? { ...logo, builder: first, updatedAt: new Date().toISOString() } : logo;
    this.trackUsage(response.usage, options.userEmail);
    chatStoreAddMessage(this.chatStore, sessionId, {
      role: 'assistant',
      content: response.content ?? '',
    });
    return {
      logo: merged,
      response,
      sessionId,
      changes: [`logo:generated:concepts=${concepts.length}`],
      rawResponse: response.content ?? '',
      applied: true,
      concepts,
      selected: -1,
    };
  }

  /**
   * Generate an artistic background via Gemini Nano Banana (server-side
   * proxy). The text stays SVG and is composed on top client-side. The
   * prompt explicitly forbids text in the image to keep the AI output
   * purely decorative. Spec v2.1.
   */
  async generateBackground(
    logo: Logo,
    context: { activity: string; mood: string; target: string; imagePrompt?: string },
    options: { userEmail?: string } = {},
  ): Promise<{ logo: Logo; applied: boolean; error?: string }> {
    const prompt = context.imagePrompt && context.imagePrompt.trim().length > 10
      ? `${context.imagePrompt.trim()}\nNO text, NO letters, NO words, NO readable typography. 1024x340 px, 3:1 aspect ratio.`
      : buildBackgroundPrompt(context, logo.builder.primaryColor, logo.builder.secondaryColor);
    let apiBase = '/api';
    if (typeof window !== 'undefined' && window.location?.origin) {
      apiBase = `${window.location.origin}/api`;
    }
    try {
      const res = await fetch(`${apiBase}/ai/logo-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, userEmail: options.userEmail }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: 'unknown' }));
        return { logo, applied: false, error: (errBody as { error?: string }).error ?? `http_${res.status}` };
      }
      const body = (await res.json()) as { data?: { imageBase64: string; mimeType: string } };
      const imageBase64 = body.data?.imageBase64;
      if (!imageBase64) return { logo, applied: false, error: 'no_image' };
      const merged: Logo = {
        ...logo,
        builder: { ...logo.builder, backgroundImage: `data:${body.data!.mimeType};base64,${imageBase64}` },
        updatedAt: new Date().toISOString(),
      };
      return { logo: merged, applied: true };
    } catch (err) {
      return { logo, applied: false, error: (err as Error)?.message ?? 'fetch_failed' };
    }
  }
}

/**
 * Defensive merge: only the editor-relevant builder fields are
 * overwritten; user-uploaded `logoUrl` (base64) is preserved, as
 * with card AI parity. The `selected` concept index is untouched
 * (AI re-runs are independent of user curation).
 */
export function mergeLogoAIResponse(logo: Logo, parsed: LogoAIOutput): Logo {
  const builder = convertAIOutputToBuilder(parsed);
  return {
    ...logo,
    builder: {
      ...logo.builder,
      ...builder,
      // Preserve any user-uploaded base64 or already set backgroundImage
      backgroundImage: builder.backgroundImage ?? logo.builder.backgroundImage,
    },
    edits: {
      ...logo.edits,
      primaryText: parsed.primaryText,
      primaryColor: parsed.primaryColor,
      secondaryColor: parsed.secondaryColor,
    },
    brief: sanitizeLogoBrief(logo.brief ?? '') || '',
    updatedAt: new Date().toISOString(),
  };
}

function convertAIOutputToBuilder(parsed: LogoAIOutput): LogoBuilder {
  return {
    primaryText: parsed.primaryText || '',
    tagline: parsed.tagline || '',
    iconType: parsed.iconType,
    iconShape: parsed.iconShape ?? 'circle',
    iconGlyph: parsed.iconType === 'lucide'
      ? normalizeIconName(parsed.iconName ?? '')
      : parsed.iconType === 'monogram'
        ? (parsed.monogram ?? '')
        : '',
    primaryColor: parsed.primaryColor,
    secondaryColor: parsed.secondaryColor,
    layout: parsed.layout,
    fontFamily: 'Inter',
    icons: [],
    backgroundImage: null,
    backgroundColor: parsed.backgroundColor ?? null,
    gradientFill: parsed.gradientFill ?? false,
    decorativeElements: parsed.decorativeElements ?? [],
    imagePrompt: parsed.imagePrompt ?? null,
  };
}

function normalizeIconName(name: string): string {
  if (!name) return '';
  const kebab = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/_/g, '-').toLowerCase();
  return isValidLucideIcon(kebab) ? kebab : name.toLowerCase();
}

function ensureThreeDistinctConcepts(concepts: LogoAIOutput[]): LogoAIOutput[] {
  if (concepts.length >= 3) return concepts.slice(0, 3);
  const base = concepts[0];
  if (!base) return [fallbackConcept(), fallbackConcept(), fallbackConcept()];
  while (concepts.length < 3) {
    const i = concepts.length;
    const variant = structuredClone
      ? structuredClone(base)
      : JSON.parse(JSON.stringify(base));
    // Vary layout and a color to guarantee distinctness.
    variant.layout = i === 1 ? 'vertical' : 'stacked';
    variant.primaryColor = shiftHue(variant.primaryColor, i * 30);
    variant.decorativeElements = i === 1 ? ['underline'] : ['dotRing'];
    concepts.push(variant);
  }
  return concepts.slice(0, 3);
}

function fallbackConcept(): LogoAIOutput {
  return {
    primaryText: 'Brand',
    tagline: 'Il tuo nuovo logo',
    iconType: 'shape',
    iconShape: 'circle',
    primaryColor: '#01696F',
    secondaryColor: '#1a1a2e',
    layout: 'horizontal',
  };
}

function shiftHue(hex: string, degrees: number): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  h = (h + degrees / 360) % 1;
  if (h < 0) h += 1;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const rr = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const gg = Math.round(hue2rgb(p, q, h) * 255);
  const bb = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
}

// Local helper to keep the import list narrow without polluting the top.
function chatStoreAddMessage(
  store: import('./chat/store').ChatStore | typeof import('./chat/store').chatStore,
  sessionId: string,
  msg: import('./types').ChatMessage,
): void {
  store.addMessage(sessionId, msg);
}

/**
 * Build the prompt sent to Gemini Nano Banana to generate a logo image.
 * Per v2.2: genera immagini artistiche complete del logo (non solo
 * background decorativo). L'immagine include elementi visivi coerenti
 * col settore + composizione logo. 1024x340 px 3:1 per adattarsi al
 * viewBox del logo. NO testo leggibile (il testo SVG resta editabile).
 */
function buildBackgroundPrompt(
  ctx: { activity: string; mood: string; target: string },
  primaryColor: string,
  secondaryColor: string,
): string {
  const sectorHint = inferSectorFromActivity(ctx.activity);
  const styleHints: Record<string, string> = {
    food: 'warm appetizing tones, food-related abstract motifs (steam, plates, ingredients), organic shapes, cozy atmosphere',
    tech: 'circuit traces, digital particles, geometric grids, futuristic gradients, clean modern lines',
    wellness: 'flowing waves, soft curves, breathing space, calming natural gradient, zen balance',
    education: 'abstract open-book motif, layered paper, knowledge rays, scholarly warm tones',
    fitness: 'dynamic motion lines, energy pulses, athletic texture, speed streaks, bold contrasts',
    real_estate: 'abstract skyline silhouette, structural grid, architectural layers, trustworthy solidity',
    generic: 'abstract geometric shapes, high contrast, subtle texture, modern minimal composition',
  };
  return `Professional artistic LOGO image (no text, no letters, no readable typography). The image should look like a decorative logo crest/emblem/background for a brand.
Activity/business: ${ctx.activity || 'generic business'}
Mood: ${ctx.mood || 'minimal'}
Target audience: ${ctx.target || 'general audience'}
Brand colors: ${primaryColor}, ${secondaryColor}
Style direction: ${styleHints[sectorHint]}.
Visual qualities: decorative emblem suitable as logo background, NOT photographic; high contrast with brand colors; rich texture (not flat); should suggest motion or activity; panoramic 3:1 aspect ratio; 1024x340 px resolution. Make it look like a polished brand visual, not a plain abstract wallpaper.`;
}

function inferSectorFromActivity(activity: string): string {
  const a = activity.toLowerCase();
  if (/pizza|ristor|trattoria|cucina|food|bar|chef|gelato|pasticcer/.test(a)) return 'food';
  if (/tech|software|app|web|code|saas|digital|cloud|ai|startup/.test(a)) return 'tech';
  if (/wellness|spa|yoga|beauty|salute|cura/.test(a)) return 'wellness';
  if (/scuola|educaz|studio|pedagog|tutor|formaz|lezion/.test(a)) return 'education';
  if (/fitness|palestra|sport|allen|gym|corso/.test(a)) return 'fitness';
  if (/immobil|real|casa|appartament|agenzia/.test(a)) return 'real_estate';
  return 'generic';
}
