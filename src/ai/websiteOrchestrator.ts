import { z } from 'zod';
import { BaseOrchestrator } from './BaseOrchestrator';
import { promptRegistry } from './prompts/registry';
import { buildWebsiteGeneratePrompt } from './prompts/websiteSystem';
import { providerRegistry } from './providers/registry';
import type { AIStreamChunk, AIResponse } from './types';

export const websiteAIOutputSchema = z.object({
  html: z.string().min(1, 'HTML richiesto'),
  css: z.string().default(''),
  js: z.string().default(''),
  pages: z.array(z.string()).min(1).default(['index']),
  heroPrompts: z.array(z.string()).max(5).optional(),
  description: z.string().optional(),
});
export type WebsiteAIOutput = z.infer<typeof websiteAIOutputSchema>;

export const websiteAIRefineSchema = z.object({
  html: z.string().optional(),
  css: z.string().optional(),
  js: z.string().optional(),
  pages: z.array(z.string()).optional(),
  description: z.string().optional(),
});
export type WebsiteAIRefine = z.infer<typeof websiteAIRefineSchema>;

export interface WebsiteProcessResult {
  site: { html: string; css: string; js: string; pages: string[] };
  response: AIResponse;
  sessionId: string;
  changes: string[];
  heroImages: Array<{ prompt: string; base64: string }>;
  aiCall?: { kind: 'websiteCode'; costUsd: number };
  heroCalls?: Array<{ kind: 'hero'; costUsd: number }>;
}

export interface WebsiteRefineResult {
  site: { html: string; css: string; js: string; pages: string[] };
  changes: string[];
  response: AIResponse;
}

export class WebsiteOrchestrator extends BaseOrchestrator {
  async generateSite(
    brief: {
      businessName: string;
      sector: string;
      description: string;
      tone: string;
      target: string;
      pages: string;
      preferredColors: string;
      font: string;
      cta: string;
      sections: string;
      features: string;
      contacts: string;
      social: string;
      notes: string;
    },
    options: {
      style?: string;
      briefContext?: string;
      modelId?: string;
      onStream?: (chunk: AIStreamChunk) => void;
      userEmail?: string;
      logoBase64?: string;
    } = {},
  ): Promise<WebsiteProcessResult> {
    const changes: string[] = [];
    const sessionId = this.ensureSession();
    const systemPrompt = promptRegistry.getPrompt('website-system');
    const userPrompt = buildWebsiteGeneratePrompt(brief, options.style || 'modern', options.briefContext);
    const provider = providerRegistry.getProvider(options.modelId);
    const hasVision = options.logoBase64 && (provider as { supportsVision?: boolean }).supportsVision;
    const userContentParts: string[] = [];
    if (hasVision && options.logoBase64) {
      userContentParts.push(`Logo/immagine del brand (base64 JPEG): ${options.logoBase64}`);
    }
    userContentParts.push(userPrompt);
    if (hasVision) {
      userContentParts.push('Analizza il logo/immagine SOLO per estrarre la palette colori (primary, secondary, accent) e lo stile del font (serif/sans-serif, grassetto/leggero, elegante/moderno). NON usare il logo per decidere layout, contenuti o struttura del sito — quelli vanno dal brief. Applica i colori e lo stile font estratti al CSS del sito.');
    }
    const messages = this.buildMessages(systemPrompt, userContentParts.join('\n\n'));

    const response = await this.handleStream(
      provider,
      messages,
      { temperature: 0.7, responseFormat: { type: 'json_object' } },
      { onStream: options.onStream },
    );

    const content = response.content ?? '';
    const parsed = this.parseJsonResponse(content, websiteAIOutputSchema);
    let output: WebsiteAIOutput;
    if (!parsed.ok) {
      changes.push(`error:${parsed.error}`);
      output = fallbackWebsiteOutput(brief.businessName);
    } else {
      output = parsed.data;
    }

    const costUsd = this.trackUsage(response.usage, options.userEmail, options.modelId);
    changes.push(`website:generated:pages=${output.pages.length}`);

    return {
      site: { html: output.html, css: output.css, js: output.js, pages: output.pages },
      response,
      sessionId,
      changes,
      heroImages: [],
      aiCall: { kind: 'websiteCode', costUsd },
    };
  }

  async refineSite(
    site: { html: string; css: string; js: string; pages: string[] },
    instruction: string,
    options: {
      modelId?: string;
      onStream?: (chunk: AIStreamChunk) => void;
      userEmail?: string;
    } = {},
  ): Promise<WebsiteRefineResult> {
    const changes: string[] = [];
    const sessionId = this.ensureSession();
    const systemPrompt = promptRegistry.getPrompt('website-system');
    const currentCode = [
      '## Codice corrente del sito',
      '',
      '### HTML:',
      '```html',
      site.html,
      '```',
      '',
      '### CSS:',
      '```css',
      site.css,
      '```',
      '',
      '### JS:',
      '```js',
      site.js,
      '```',
      '',
      `Pagine: ${site.pages.join(', ')}`,
      '',
      `Istruzione di modifica: ${instruction}`,
      '',
      'Rispondi SOLO con un oggetto JSON. Includi SOLO i campi che devono cambiare (html, css, js, pages).',
      'Se un campo non cambia, omettilo.',
    ].join('\n');

    const provider = providerRegistry.getProvider(options.modelId);
    const messages = this.buildMessages(systemPrompt, currentCode);

    const response = await this.handleStream(
      provider,
      messages,
      { temperature: 0.7, responseFormat: { type: 'json_object' } },
      { onStream: options.onStream },
    );

    const content = response.content ?? '';
    const parsed = this.parseJsonResponse(content, websiteAIRefineSchema);
    if (!parsed.ok) {
      changes.push(`error:${parsed.error}`);
      return { site, changes, response };
    }

    const refine = parsed.data;
    const merged = {
      html: refine.html ?? site.html,
      css: refine.css ?? site.css,
      js: refine.js ?? site.js,
      pages: refine.pages ?? site.pages,
    };

    this.trackUsage(response.usage, options.userEmail, options.modelId);
    changes.push('website:refined');

    return { site: merged, changes, response };
  }
}

function fallbackWebsiteOutput(businessName: string): WebsiteAIOutput {
  const name = businessName || 'Il mio sito';
  return {
    html: `<header><nav><a href="index.html">Home</a></nav></header><main><section class="hero"><h1>${name}</h1><p>Benvenuto nel nostro sito. Siamo in costruzione.</p></section></main><footer><p>© ${new Date().getFullYear()} ${name}</p></footer>`,
    css: `:root { --primary: #01696F; --secondary: #1a1a2e; --accent: #E11D48; --bg: #FFFFFF; --text: #1a1a2e; --font: 'Inter', sans-serif; } * { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: var(--font); color: var(--text); background: var(--bg); } .hero { min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: linear-gradient(135deg, var(--primary), var(--secondary)); color: #fff; padding: 2rem; } .hero h1 { font-size: 2.5rem; margin-bottom: 1rem; } @media (max-width: 768px) { .hero h1 { font-size: 1.8rem; } }`,
    js: '',
    pages: ['index'],
  };
}
