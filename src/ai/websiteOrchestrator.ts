import { z } from 'zod';
import { BaseOrchestrator } from './BaseOrchestrator';
import { promptRegistry } from './prompts/registry';
import { buildWebsiteGeneratePrompt, buildWebsiteHtmlPrompt, buildWebsiteCssPrompt, buildWebsiteJsPrompt, buildWebsiteVerifyPrompt } from './prompts/websiteSystem';
import { providerRegistry } from './providers/registry';
import type { AIStreamChunk, AIResponse, ChatMessage } from './types';

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
      socials: { platform: string; url: string }[];
      mapsUrl: string;
      notes: string;
    },
    options: {
      style?: string;
      briefContext?: string;
      modelId?: string;
      onStream?: (chunk: AIStreamChunk) => void;
      onStep?: (step: string, promptText: string) => void;
      onStepResult?: (step: string, responseText: string) => void;
      userEmail?: string;
      logoBase64?: string;
      scrapedReference?: string;
    } = {},
  ): Promise<WebsiteProcessResult> {
    const changes: string[] = [];
    const sessionId = this.ensureSession();
    const provider = providerRegistry.getProvider(options.modelId);
    const style = options.style || 'modern';
    const hasVision = options.logoBase64 && (provider as { supportsVision?: boolean }).supportsVision;

    // ─── Step 1: HTML ───────────────────────────────────────────
    const htmlPrompt = buildWebsiteHtmlPrompt(brief, style, options.briefContext);
    options.onStep?.('html', htmlPrompt);
    if (options.scrapedReference) {
      changes.push(`scraped:${options.scrapedReference.length}chars`);
    }
    const htmlMessages = this.buildMessages(
      promptRegistry.getPrompt('website-html'),
      htmlPrompt,
    );
    if (hasVision && options.logoBase64) {
      const last = htmlMessages[htmlMessages.length - 1];
      if (last) last.images = [options.logoBase64];
    }
    const htmlResponse = await this.handleStream(provider, htmlMessages, {
      reasoningEffort: 'max',
      responseFormat: { type: 'json_object' },
      maxTokens: 8192,
    }, { onStream: options.onStream });
    const htmlParsed = this.parseJsonResponse(htmlResponse.content ?? '', z.object({
      html: z.string().min(1),
      pages: z.array(z.string()).min(1).default(['index']),
    }));
    if (!htmlParsed.ok) {
      changes.push(`error:html:${htmlParsed.error}`);
      return this.fallbackResult(brief.businessName, htmlResponse, sessionId, changes);
    }
    const { html, pages } = htmlParsed.data;
    changes.push(`html:generated:pages=${pages.length}`);
    options.onStepResult?.('html', htmlResponse.content ?? '');

    // ─── Step 2: CSS (non-stream, sessione fresca) ───────────────
    const cssPrompt = buildWebsiteCssPrompt(html, style, brief);
    options.onStep?.('css', cssPrompt);
    const cssMessages: ChatMessage[] = [
      { role: 'system', content: promptRegistry.getPrompt('website-css') },
      { role: 'user', content: cssPrompt },
    ];
    const cssResponse = await provider.chat(cssMessages, {
      reasoningEffort: 'max',
      responseFormat: { type: 'json_object' },
      maxTokens: 8192,
    });
    const cssParsed = this.parseJsonResponse(cssResponse.content ?? '', z.object({
      css: z.string().default(''),
    }));
    const css = cssParsed.ok ? cssParsed.data.css : '';
    changes.push(`css:${css.length}chars`);
    options.onStepResult?.('css', cssResponse.content ?? '');

    // ─── Step 3: JS (non-stream, sessione fresca) ─────────────────
    const jsPrompt = buildWebsiteJsPrompt(html);
    options.onStep?.('js', jsPrompt);
    const jsMessages: ChatMessage[] = [
      { role: 'system', content: promptRegistry.getPrompt('website-js') },
      { role: 'user', content: jsPrompt },
    ];
    const jsResponse = await provider.chat(jsMessages, {
      reasoningEffort: 'max',
      responseFormat: { type: 'json_object' },
      maxTokens: 8192,
    });
    const jsParsed = this.parseJsonResponse(jsResponse.content ?? '', z.object({
      js: z.string().default(''),
    }));
    const js = jsParsed.ok ? jsParsed.data.js : '';
    changes.push(`js:${js.length}chars`);
    options.onStepResult?.('js', jsResponse.content ?? '');

    // ─── Step 4: Verify (non-stream, sessione fresca) ─────────────
    const verifyPrompt = buildWebsiteVerifyPrompt(html, css, js);
    options.onStep?.('verify', verifyPrompt);
    const verifyMessages: ChatMessage[] = [
      { role: 'system', content: promptRegistry.getPrompt('website-verify') },
      { role: 'user', content: verifyPrompt },
    ];
    const verifyResponse = await provider.chat(verifyMessages, {
      reasoningEffort: 'max',
      responseFormat: { type: 'json_object' },
      maxTokens: 8192,
    });
    const verifyParsed = this.parseJsonResponse(verifyResponse.content ?? '', z.object({
      issues: z.array(z.string()).default([]),
      fixes: z.object({
        html: z.string().optional(),
        css: z.string().optional(),
        js: z.string().optional(),
      }).optional(),
    }));
    if (verifyParsed.ok) {
      const { issues, fixes } = verifyParsed.data;
      if (issues.length > 0) {
        changes.push(`verify:${issues.length}issues`);
        if (fixes?.html) changes.push('verify:html:fixed');
        if (fixes?.css) changes.push('verify:css:fixed');
        if (fixes?.js) changes.push('verify:js:fixed');
      } else {
        changes.push('verify:ok');
      }
    }

    const totalCost = (this.trackUsage(htmlResponse.usage, options.userEmail, options.modelId) || 0.0001)
      + (this.trackUsage(cssResponse.usage, options.userEmail, options.modelId) || 0)
      + (this.trackUsage(jsResponse.usage, options.userEmail, options.modelId) || 0)
      + (this.trackUsage(verifyResponse.usage, options.userEmail, options.modelId) || 0);

    return {
      site: { html, css, js, pages },
      response: htmlResponse,
      sessionId,
      changes,
      heroImages: [],
      aiCall: { kind: 'websiteCode', costUsd: totalCost },
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
      { reasoningEffort: 'max', responseFormat: { type: 'json_object' }, maxTokens: 4096 },
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

  private fallbackResult(
    businessName: string,
    response: AIResponse,
    sessionId: string,
    changes: string[],
  ): WebsiteProcessResult {
    const fb = fallbackWebsiteOutput(businessName);
    return {
      site: { html: fb.html, css: fb.css, js: fb.js, pages: fb.pages },
      response,
      sessionId,
      changes,
      heroImages: [],
      aiCall: { kind: 'websiteCode', costUsd: 0.0001 },
    };
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
