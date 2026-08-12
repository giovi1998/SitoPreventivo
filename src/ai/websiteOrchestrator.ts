import { z } from 'zod';
import { BaseOrchestrator } from './BaseOrchestrator';
import { promptRegistry } from './prompts/registry';
import { buildWebsiteGeneratePrompt, buildWebsiteHtmlPrompt, buildWebsiteCssPrompt, buildWebsiteJsPrompt, buildWebsiteVerifyPrompt, buildWebsitePagePrompt } from './prompts/websiteSystem';
import { ensureSeoMeta, stripSocialCanonical } from '../utils/website/seoMeta';
import { stripLogoFromHtml } from '../utils/website/logoInjection';
import { enforceMapIframe } from '../utils/website/sanitizeGenerated';
import { analyzeSiteCode } from '../utils/website/siteAnalyser';
import { providerRegistry } from './providers/registry';
import type { AIStreamChunk, AIResponse, ChatMessage, RunTraceOptions } from './types';
import { newSpanId } from './runTrace';

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
  pagesHtml: z.record(z.string(), z.string()).optional(),
  description: z.string().optional(),
});
export type WebsiteAIRefine = z.infer<typeof websiteAIRefineSchema>;

// TB-031 refine puntuale: il modello propone edit find&replace, l'orchestratore
// li applica deterministicamente. Mai riscrittura del documento completo.
export const websiteAIRefineEditSchema = z.object({
  edits: z.array(z.object({
    part: z.enum(['html', 'css', 'js', 'pagesHtml']),
    page: z.string().optional(),
    find: z.string().min(3, 'find troppo corto'),
    replace: z.string(),
  })).min(1).max(10),
});
export type WebsiteAIRefineEdit = z.infer<typeof websiteAIRefineEditSchema>;

export interface WebsiteProcessResult {
  site: { html: string; css: string; js: string; pages: string[]; pagesHtml: Record<string, string> };
  response: AIResponse;
  sessionId: string;
  changes: string[];
  heroImages: Array<{ prompt: string; base64: string }>;
  aiCall?: { kind: 'websiteCode'; costUsd: number };
  heroCalls?: Array<{ kind: 'hero'; costUsd: number }>;
  verifyIssues?: string[];
  verifyFixesApplied?: string[];
}

export interface WebsiteRefineResult {
  site: { html: string; css: string; js: string; pages: string[]; pagesHtml: Record<string, string> };
  changes: string[];
  response: AIResponse;
  verifyIssues?: string[];
  verifyFixesApplied?: string[];
}

export class WebsiteOrchestrator extends BaseOrchestrator {
  protected aiKind = 'website';

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
      onStepResult?: (step: string, responseText: string, meta: { durationMs: number; tokens?: number }) => void;
      userEmail?: string;
      logoBase64?: string;
      scrapedReference?: string;
      visionPreviews?: string[];
      /** TB-029: attribuzione Langfuse per-cliente. */
      customerId?: string;
      /** TB-029: sessione Langfuse (docId). */
      sessionId?: string;
      /** Genera hero image via Gemini (Nano Banana) per heroPrompts[]. */
      generateHeroImages?: (prompt: string) => Promise<string | null>;
    } & RunTraceOptions = {},
  ): Promise<WebsiteProcessResult> {
    const changes: string[] = [];
    const sessionId = this.ensureSession();
    const provider = providerRegistry.getProvider(options.modelId);
    const primaryProviderId = options.modelId ?? providerRegistry.getDefaultId();
    const style = options.style || 'modern';
    const hasVision = options.logoBase64 && (provider as { supportsVision?: boolean }).supportsVision;

    const stepMeta = (start: number, response: AIResponse) => ({
      durationMs: Date.now() - start,
      tokens: response.usage?.totalTokens,
    });

    // T7: ogni chiamata interna del website è un sub-step del run agente
    // (stepSpanId nuovo per chiamata, parent = rootSpanId). startRun solo
    // sulla prima chiamata del run (html).
    let firstCall = true;
    const runTrace = (step: string) => {
      const trace = {
        runId: options.runId,
        runName: options.runName,
        startRun: firstCall ? options.startRun : false,
        rootSpanId: options.rootSpanId,
        stepName: step,
        stepSpanId: options.stepSpanId ?? newSpanId(),
      };
      firstCall = false;
      return trace;
    };

    // ─── Step 1: HTML ───────────────────────────────────────────
    const htmlPrompt = buildWebsiteHtmlPrompt(brief, style, options.briefContext);
    options.onStep?.('html', htmlPrompt);
    if (options.scrapedReference) {
      changes.push(`scraped:${options.scrapedReference.length}chars`);
    }
    const htmlMessages = this.buildMessages(
      promptRegistry.getPrompt('website-system'),
      htmlPrompt,
    );
    if (hasVision && options.logoBase64) {
      const last = htmlMessages[htmlMessages.length - 1];
      if (last) last.images = [options.logoBase64];
    }
    if (options.visionPreviews && options.visionPreviews.length > 0) {
      const last = htmlMessages[htmlMessages.length - 1];
      if (last) last.images = [...(last.images ?? []), ...options.visionPreviews];
    }
    const htmlStart = Date.now();
    // onStream SEMPRE attivo (no-op se non fornito): `handleStream` usa il
    // path stream (SSE) SOLO se onStream è presente. Su Vercel Hobby lo
    // streaming ha limite 300s, la chat sincrona 60s → senza onStream
    // l'auto-build in PROD (dove onStream è undefined) falliva sempre.
    const streamSink = options.onStream ?? (() => {});
    const htmlResult = await this.executeWithFallback(
      primaryProviderId,
      htmlMessages,
      {
        responseFormat: { type: 'json_object' },
        // 8192 non bastano: il sito completo (head SEO + hero + sezioni) può
        // superare i 10k token e Ollama con format:json rifiuta il JSON
        // troncato (400 "can't find closing '}' symbol").
        maxTokens: 16384,
        // Struttura del sito: ragionamento pieno ('max').
        reasoningEffort: 'max',
        customerId: options.customerId,
        ...runTrace('html'),
      },
      { onStream: streamSink, onFallback: (id, reason) => changes.push(`fallback:${id}:${reason.slice(0, 80)}`) },
    );
    const htmlResponse = htmlResult.response;
    if (htmlResult.didFallback) changes.push('fallback:html:ok');
    const htmlParsed = this.parseJsonResponse(htmlResponse.content ?? '', z.object({
      html: z.string().min(1),
      pages: z.array(z.string()).min(1).default(['index']),
      heroPrompts: z.array(z.string()).max(5).optional(),
    }));
    if (!htmlParsed.ok) {
      changes.push(`error:html:${htmlParsed.error}`);
      return this.fallbackResult(brief.businessName, htmlResponse, sessionId, changes);
    }
    const { html: rawHtml, pages, heroPrompts } = htmlParsed.data;
    changes.push(`html:generated:pages=${pages.length}`);
    options.onStepResult?.('html', htmlResponse.content ?? '', stepMeta(htmlStart, htmlResponse));
    // SEO head post-process: l'AI omette spesso meta description/OG → inietta
    // quelli dal brief (solo se assenti, mai duplicare). Rimuove anche la
    // canonical che l'AI inventa verso social (Instagram ecc.) — problema
    // SEO critico (i motori tratterebbero il profilo come sito ufficiale).
    let html = ensureSeoMeta(stripSocialCanonical(rawHtml), { businessName: brief.businessName, description: brief.description });
    if (html !== rawHtml) changes.push('seo:meta-injected');
    // Mappa deterministica: l'AI omette la città (q=Via Dante → Monza/Rozzano).
    // Forzata qui PRIMA del verify così le issues non la flaggano più.
    const htmlWithMap = enforceMapIframe(html, brief.contacts);
    if (htmlWithMap !== html) {
      html = htmlWithMap;
      changes.push('map:iframe-forced');
    }

    // ─── Step 2: Pagine secondarie (multi-pagina reale) ───────────
    // Ogni pagina ha il suo HTML dedicato (nav+footer condivisi); CSS/JS
    // restano comuni e vengono generati vedendo TUTTE le pagine.
    const pagesHtml: Record<string, string> = {};
    let pagesCost = 0;
    const secondaryPages = pages.filter((p) => p !== 'index');
    if (secondaryPages.length > 0) {
      const navHtml = extractNavFromHtml(html);
      for (const page of secondaryPages) {
        const pagePrompt = buildWebsitePagePrompt(page, {
          businessName: brief.businessName,
          description: brief.description,
          tone: brief.tone,
          target: brief.target,
          cta: brief.cta,
          contacts: brief.contacts,
          socials: brief.socials,
        }, navHtml);
        options.onStep?.(`page:${page}`, pagePrompt);
        const pageMessages: ChatMessage[] = [
          { role: 'system', content: promptRegistry.getPrompt('website-system') },
          { role: 'user', content: pagePrompt },
        ];
        const pageStart = Date.now();
        let pageResponse: AIResponse | null = null;
        let pageParsed: { ok: boolean; error?: string; data?: { html: string } } = { ok: false, error: 'fetch failed' };
        try {
          // handleStream (SSE): su Vercel Hobby le richieste sincrone hanno
          // limite 60s, quelle streaming 300s. CSS/JS/verify/pagine possono
          // superare 60s → senza stream l'auto-build in PROD falliva (gotcha §26.24).
          const pageResult = await this.executeWithFallback(
            primaryProviderId,
            pageMessages,
            {
              responseFormat: { type: 'json_object' },
              maxTokens: 16384,
              reasoningEffort: 'max',
              customerId: options.customerId,
              ...runTrace(`page:${page}`),
            },
            { onStream: streamSink, onFallback: (id, reason) => changes.push(`fallback:${id}:${reason.slice(0, 80)}`) },
          );
          pageResponse = pageResult.response;
          pagesCost += this.trackUsage(pageResponse.usage, options.userEmail, pageResult.providerId) || 0;
          pageParsed = this.parseJsonResponse(pageResponse.content ?? '', z.object({
            html: z.string().min(1),
          }));
        } catch (err) {
          // Pagina best-effort: un suo errore NON deve perdere il sito
          changes.push(`error:page:${page}:${err instanceof Error ? err.message.slice(0, 120) : 'unknown'}`);
        }
        const pageHtml = pageParsed.ok && pageParsed.data ? ensureSeoMeta(enforceMapIframe(pageParsed.data.html, brief.contacts), { businessName: brief.businessName, description: brief.description }) : '';
        if (pageHtml) pagesHtml[page] = pageHtml;
        changes.push(pageParsed.ok ? `page:${page}:generated` : `error:page:${page}`);
        options.onStepResult?.('page', pageResponse?.content ?? '', stepMeta(pageStart, pageResponse ?? { usage: undefined } as AIResponse));
      }
    }
    const allPagesHtml = [html, ...Object.values(pagesHtml)].join('\n\n');

    // ─── Step 3: CSS (non-stream, sessione fresca) ────────────────
    const cssPrompt = buildWebsiteCssPrompt(allPagesHtml, style, brief);
    options.onStep?.('css', cssPrompt);
    const cssMessages: ChatMessage[] = [
      { role: 'system', content: promptRegistry.getPrompt('website-system') },
      { role: 'user', content: cssPrompt },
    ];
    const cssStart = Date.now();
    let cssResponse: AIResponse | null = null;
    let cssParsed: { ok: boolean; data?: { css?: string } } = { ok: false };
    try {
      // handleStream (SSE) — vedi nota step pagine: limite 300s Hobby.
      const cssResult = await this.executeWithFallback(
        primaryProviderId,
        cssMessages,
        {
          responseFormat: { type: 'json_object' },
          maxTokens: 16384,
          // CSS = output lungo su prompt piccolo: 'high' basta, 'max' costa
          // il doppio del tempo (180s osservati).
          reasoningEffort: 'high',
          customerId: options.customerId,
          ...runTrace('css'),
        },
        { onStream: streamSink, onFallback: (id, reason) => changes.push(`fallback:${id}:${reason.slice(0, 80)}`) },
      );
      cssResponse = cssResult.response;
      cssParsed = this.parseJsonResponse(cssResponse.content ?? '', z.object({
        css: z.string().default(''),
      }));
    } catch (err) {
      // CSS best-effort: un timeout/errore NON deve perdere il sito
      // (solo HTML e Verify sono critici). Il sito resta usabile senza.
      changes.push(`error:css:${err instanceof Error ? err.message.slice(0, 120) : 'unknown'}`);
    }
    let css = cssParsed.ok && cssParsed.data?.css ? cssParsed.data.css : '';
    changes.push(`css:${css.length}chars`);
    options.onStepResult?.('css', cssResponse?.content ?? '', stepMeta(cssStart, cssResponse ?? { usage: undefined } as AIResponse));

    // ─── Step 4: JS (non-stream, sessione fresca) ─────────────────
    const jsPrompt = buildWebsiteJsPrompt(allPagesHtml);
    options.onStep?.('js', jsPrompt);
    const jsMessages: ChatMessage[] = [
      { role: 'system', content: promptRegistry.getPrompt('website-system') },
      { role: 'user', content: jsPrompt },
    ];
    const jsStart = Date.now();
    let jsResponse: AIResponse | null = null;
    let jsParsed: { ok: boolean; data?: { js?: string } } = { ok: false };
    try {
      // handleStream (SSE) — vedi nota step pagine: limite 300s Hobby.
      const jsResult = await this.executeWithFallback(
        primaryProviderId,
        jsMessages,
        {
          responseFormat: { type: 'json_object' },
          maxTokens: 16384,
          reasoningEffort: 'high',
          customerId: options.customerId,
          ...runTrace('js'),
        },
        { onStream: streamSink, onFallback: (id, reason) => changes.push(`fallback:${id}:${reason.slice(0, 80)}`) },
      );
      jsResponse = jsResult.response;
      jsParsed = this.parseJsonResponse(jsResponse.content ?? '', z.object({
        js: z.string().default(''),
      }));
    } catch (err) {
      // JS best-effort: un timeout/errore NON deve perdere il sito.
      changes.push(`error:js:${err instanceof Error ? err.message.slice(0, 120) : 'unknown'}`);
    }
    let js = jsParsed.ok && jsParsed.data?.js ? jsParsed.data.js : '';
    changes.push(`js:${js.length}chars`);
    options.onStepResult?.('js', jsResponse?.content ?? '', stepMeta(jsStart, jsResponse ?? { usage: undefined } as AIResponse));

    // ─── Step 5: Verify (non-stream, sessione fresca) ─────────────
    // Loop di verifica (max 2 pass). I risultati del tool deterministico
    // analyze_site vengono passati NEL PROMPT come messaggio user (NON
    // come tool_calls precompilati: il formato richiesto da Ollama —
    // arguments object + tool_name — diverge da DeepSeek e causava 400
    // "can't find closing '}' symbol"). Al primo giro vengono applicati i
    // fixes; al secondo si verifica che non restino problemi reali.
    const verifyStart = Date.now();
    let verifyIssues: string[] | undefined;
    let verifyFixesApplied: string[] | undefined;
    let currentCss = css;
    let currentJs = js;
    let verifyCost = 0;
    let lastVerifyResponse: AIResponse | null = null;
    for (let pass = 0; pass < 2; pass++) {
      // Fonte di verità deterministico (sempre calcolato lato client)
      const toolResults: Array<{ part: string; result: { ok: boolean; issues: string[] } }> = [
        { part: 'html', result: analyzeSiteCode(allPagesHtml, 'html') },
        { part: 'css', result: analyzeSiteCode(currentCss, 'css') },
        { part: 'js', result: analyzeSiteCode(currentJs, 'js') },
      ];
      const analyzeSummary = toolResults
        .map((tr) => `analyze_site("${tr.part}"): ${JSON.stringify(tr.result)}`)
        .join('\n');
      const verifyMessages: ChatMessage[] = [
        { role: 'system', content: promptRegistry.getPrompt('website-system') },
        { role: 'user', content: `${buildWebsiteVerifyPrompt(allPagesHtml, currentCss, currentJs)}\n\nRISULTATI ANALISI DETERMINISTICA (fonte di verità, calcolati lato client):\n${analyzeSummary}` },
      ];
      options.onStep?.('verify', `pass ${pass + 1} (con analyze_site)`);
      let verifyResponse: AIResponse | null = null;
      let verifyError: unknown = null;
      try {
        // handleStream (SSE) — vedi nota step pagine: limite 300s Hobby.
        const verifyResult = await this.executeWithFallback(
          primaryProviderId,
          verifyMessages,
          {
            responseFormat: { type: 'json_object' },
            maxTokens: 16384,
            // reasoning 'high' (non 'max'): il verify lavora su prompt da
            // 50-60K token e con think:max impiegava 194s — 'high' basta.
            reasoningEffort: 'high',
            customerId: options.customerId,
            ...runTrace(`verify:pass${pass + 1}`),
          },
          { onStream: streamSink, onFallback: (id, reason) => changes.push(`fallback:${id}:${reason.slice(0, 80)}`) },
        );
        verifyResponse = verifyResult.response;
      } catch (err) {
        verifyError = err;
      }
      if (!verifyResponse) {
        // Verify è best-effort: un suo errore NON deve perdere il sito
        // già generato (html/css/js/pages restano quelli buoni).
        changes.push(`verify:error:${verifyError instanceof Error ? verifyError.message.slice(0, 120) : 'unknown'}`);
        break;
      }
      verifyCost += this.trackUsage(verifyResponse.usage, options.userEmail, options.modelId) || 0;
      lastVerifyResponse = verifyResponse;
      const verifyParsed = this.parseJsonResponse(verifyResponse.content ?? '', z.object({
        issues: z.array(z.string()).default([]),
        fixes: z.object({
          html: z.string().optional(),
          css: z.string().optional(),
          js: z.string().optional(),
        }).optional(),
      }));
      if (!verifyParsed.ok) {
        if (pass === 0) changes.push(`verify:error:${verifyParsed.error}`);
        break;
      }
      const { issues, fixes } = verifyParsed.data;

      // Applica i fixes dell'AI con guardia anti-distruzione:
      // 1. il fixato deve essere deterministicamente integro
      //    (analyzeSiteCode(fix).ok) — fixes di qualità/accessibilità
      //    (title iframe, aria-label, emoji) passano anche su codice valido;
      // 2. il fixato non deve perdere sezioni: lunghezza ≥50% dell'originale
      //    (una riscrittura che taglia mappa/contatti/form viene bloccata).
      const applyVerifyFixes = (): void => {
        if (fixes?.html && fixes.html !== html && analyzeSiteCode(fixes.html, 'html').ok && fixes.html.length >= html.length * 0.6) {
          html = enforceMapIframe(fixes.html, brief.contacts);
          changes.push('verify:html:fixed');
          (verifyFixesApplied ??= []).push('html');
        }
        if (fixes?.css && fixes.css !== currentCss && analyzeSiteCode(fixes.css, 'css').ok && fixes.css.length >= currentCss.length * 0.6) {
          currentCss = fixes.css;
          changes.push('verify:css:fixed');
          (verifyFixesApplied ??= []).push('css');
        }
        if (fixes?.js && fixes.js !== currentJs && analyzeSiteCode(fixes.js, 'js').ok && fixes.js.length >= currentJs.length * 0.6) {
          currentJs = fixes.js;
          changes.push('verify:js:fixed');
          (verifyFixesApplied ??= []).push('js');
        }
      };

      if (issues.length === 0) {
        if (pass === 1) verifyIssues = undefined; // recheck pulito: problemi risolti, niente pannello
        changes.push('verify:ok');
        break;
      }
      if (pass === 0) {
        verifyIssues = issues;
        changes.push(`verify:${issues.length}issues:${issues.slice(0, 3).join(' | ')}`);
        applyVerifyFixes();
      } else {
        // Secondo pass: applica i fixes ANCHE qui (il primo fix può essere
        // stato parziale) e verifica coi recheck deterministico.
        applyVerifyFixes();
        const recheck = [
          analyzeSiteCode(allPagesHtml, 'html'),
          analyzeSiteCode(currentCss, 'css'),
          analyzeSiteCode(currentJs, 'js'),
        ];
        if (recheck.every((r) => r.ok)) {
          verifyIssues = undefined;
          changes.push('verify:recheck:ok');
          break;
        }
        // Fonte di verità finale = issue DETERMINISTICHE residue (non le
        // inventate dal modello): il pannello mostra problemi reali.
        verifyIssues = recheck.flatMap((r) => r.issues);
        changes.push(`verify:recheck:${verifyIssues.length}issues`);
        break;
      }
    }
    css = currentCss;
    js = currentJs;
    const verifyOutcome = verifyIssues ? `issues:${verifyIssues.length}` : 'ok';
    options.onStepResult?.('verify', lastVerifyResponse?.content ?? verifyOutcome, stepMeta(verifyStart, lastVerifyResponse ?? { usage: undefined } as AIResponse));

    const totalCost = (this.trackUsage(htmlResponse.usage, options.userEmail, options.modelId) || 0.0001)
      + (cssResponse ? this.trackUsage(cssResponse.usage, options.userEmail, options.modelId) || 0 : 0)
      + (jsResponse ? this.trackUsage(jsResponse.usage, options.userEmail, options.modelId) || 0 : 0)
      + verifyCost
      + pagesCost;

    // ─── Step 6: Hero images via Nano Banana (best-effort) ─────────
    // Il modello può suggerire heroPrompts[] nel JSON HTML. Se il brief
    // chiede immagini fotografiche, le genera con Gemini image e le
    // inietta come background della sezione hero. Mai fatale: fallimento
    // = sito senza hero image (gradient fallback già nel CSS).
    const heroImages: Array<{ prompt: string; base64: string }> = [];
    if (heroPrompts && heroPrompts.length > 0 && options.generateHeroImages) {
      for (const prompt of heroPrompts.slice(0, 2)) {
        try {
          const img = await options.generateHeroImages(prompt);
          if (img) heroImages.push({ prompt, base64: img });
        } catch {
          // best-effort
        }
      }
      if (heroImages.length > 0) {
        const heroBg = heroImages[0].base64;
        html = html.replace(/(<section[^>]*class\s*=\s*"[^"]*\bhero\b[^"]*"[^>]*>)/i, `$1\n<div class="hero-bg" style="background-image:url('${heroBg}');background-size:cover;background-position:center;position:absolute;inset:0;z-index:-1;"></div>`);
        changes.push(`hero:images:${heroImages.length}`);
      }
    }

    return {
      site: { html, css, js, pages, pagesHtml },
      response: htmlResponse,
      sessionId,
      changes,
      heroImages,
      aiCall: { kind: 'websiteCode', costUsd: totalCost },
      verifyIssues,
      verifyFixesApplied,
    };
  }

  async refineSite(
    site: { html: string; css: string; js: string; pages: string[]; pagesHtml: Record<string, string> },
    instruction: string,
    options: {
      modelId?: string;
      onStream?: (chunk: AIStreamChunk) => void;
      onStep?: (step: string, promptText: string) => void;
      onStepResult?: (step: string, responseText: string, meta: { durationMs: number; tokens?: number }) => void;
      userEmail?: string;
      visionPreviews?: string[];
      /** TB-029: attribuzione Langfuse per-cliente. */
      customerId?: string;
    } & RunTraceOptions = {},
  ): Promise<WebsiteRefineResult> {
    const changes: string[] = [];
    const sessionId = this.ensureSession();
    const systemPrompt = promptRegistry.getPrompt('website-system');
    const pagesBlock = site.pages.length > 1
      ? Object.entries(site.pagesHtml).map(([name, pHtml]) => `### HTML ${name}:${pHtml ? `\n\`\`\`html\n${stripLogoFromHtml(pHtml)}\n\`\`\`` : ' (mancante)'}`).join('\n\n')
      : '';
    const currentCode = [
      '## Codice corrente del sito',
      '',
      '### HTML (index):',
      '```html',
      stripLogoFromHtml(site.html),
      '```',
      '',
      pagesBlock,
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
      'Rispondi SOLO con un oggetto JSON con UN SOLO campo "edits": un array di modifiche PUNTUALI.',
      'Ogni edit: { "part": "html"|"css"|"js"|"pagesHtml", "page": "nome pagina (solo per pagesHtml)", "find": "stringa ESATTA da cercare nel codice (min 3 caratteri)", "replace": "stringa sostitutiva" }.',
      'REGOLE:',
      '- MAI riscrivere il documento completo: solo frammenti piccoli (find e replace brevi).',
      '- find DEVE essere una stringa esatta presente nel codice (copia-incolla dal codice sopra).',
      '- Se la modifica è solo testuale (es. rinomina brand), find = testo vecchio, replace = testo nuovo.',
      '- Max 10 edit. Se un edit non serve, omettilo.',
    ].join('\n');
    options.onStep?.('refine', currentCode);

    const provider = providerRegistry.getProvider(options.modelId);
    const primaryProviderId = options.modelId ?? providerRegistry.getDefaultId();
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: currentCode },
    ];
    if (options.visionPreviews && options.visionPreviews.length > 0) {
      const last = messages[messages.length - 1];
      if (last) last.images = options.visionPreviews;
    }

    const refineStart = Date.now();
    const refineResult = await this.executeWithFallback(
      primaryProviderId,
      messages,
      {
        responseFormat: { type: 'json_object' },
        maxTokens: 16384,
        reasoningEffort: 'max',
        customerId: options.customerId,
        runId: options.runId,
        runName: options.runName,
        startRun: options.startRun,
        rootSpanId: options.rootSpanId,
        stepName: options.stepName ?? 'refine',
        stepSpanId: options.stepSpanId ?? newSpanId(),
      },
      { onStream: options.onStream, onFallback: (id, reason) => changes.push(`fallback:${id}:${reason.slice(0, 80)}`) },
    );
    const response = refineResult.response;
    options.onStepResult?.('refine', response.content ?? '', {
      durationMs: Date.now() - refineStart,
      tokens: response.usage?.totalTokens,
    });

    const content = response.content ?? '';
    const parsed = this.parseJsonResponse(content, websiteAIRefineEditSchema);
    if (!parsed.ok) {
      changes.push(`error:${parsed.error}`);
      return { site, changes, response };
    }

    // Applica gli edit puntuali find&replace deterministicamente. Ogni edit
    // è validato: find deve esistere (una sola occorrenza), replace non deve
    // essere una riscrittura (≤20x la lunghezza di find). Un edit invalido
    // viene scartato, gli altri restano applicati.
    const merged = {
      html: site.html,
      css: site.css,
      js: site.js,
      pages: site.pages,
      pagesHtml: { ...site.pagesHtml },
    };
    let applied = 0;
    for (const edit of parsed.data.edits) {
      const target = edit.part === 'pagesHtml'
        ? (edit.page ? merged.pagesHtml[edit.page] : undefined)
        : merged[edit.part];
      if (typeof target !== 'string') {
        changes.push(`refine:${edit.part}:skipped:pagina "${edit.page ?? '?'}" non trovata`);
        continue;
      }
      const idx = target.indexOf(edit.find);
      if (idx === -1) {
        changes.push(`refine:${edit.part}:skipped:find non trovato (${edit.find.slice(0, 40)}…)`);
        continue;
      }
      if (target.indexOf(edit.find, idx + 1) !== -1) {
        changes.push(`refine:${edit.part}:skipped:find ambiguo (${edit.find.slice(0, 40)}…)`);
        continue;
      }
      if (edit.replace.length > edit.find.length * 20) {
        changes.push(`refine:${edit.part}:skipped:replace troppo grande (riscrittura)`);
        continue;
      }
      const next = target.slice(0, idx) + edit.replace + target.slice(idx + edit.find.length);
      if (edit.part === 'pagesHtml' && edit.page) merged.pagesHtml[edit.page] = next;
      else if (edit.part === 'html') merged.html = next;
      else if (edit.part === 'css') merged.css = next;
      else if (edit.part === 'js') merged.js = next;
      applied++;
      changes.push(`refine:${edit.part}:applied:${edit.find.length}->${edit.replace.length}chars`);
    }
    if (applied === 0) {
      changes.push('refine:no-edits-applied');
      return { site, changes, response };
    }

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
      site: { html: fb.html, css: fb.css, js: fb.js, pages: fb.pages, pagesHtml: {} },
      response,
      sessionId,
      changes,
      heroImages: [],
      aiCall: { kind: 'websiteCode', costUsd: 0.0001 },
    };
  }
}

/**
 * Estrae la nav (header/nav fino a /nav o /header) dall'HTML index per
 * riusarla identica nelle pagine secondarie (stesso brand, stessi link).
 */
function extractNavFromHtml(html: string): string {
  const navMatch = html.match(/<(header|nav)[\s\S]*?<\/(?:header|nav)>/i);
  return navMatch ? navMatch[0] : '';
}

function fallbackWebsiteOutput(businessName: string): WebsiteAIOutput {  const name = businessName || 'Il mio sito';
  return {
    html: `<header><nav><a href="index.html">Home</a></nav></header><main><section class="hero"><h1>${name}</h1><p>Benvenuto nel nostro sito. Siamo in costruzione.</p></section></main><footer><p>© ${new Date().getFullYear()} ${name}</p></footer>`,
    css: `:root { --primary: #01696F; --secondary: #1a1a2e; --accent: #E11D48; --bg: #FFFFFF; --text: #1a1a2e; --font: 'Inter', sans-serif; } * { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: var(--font); color: var(--text); background: var(--bg); } .hero { min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: linear-gradient(135deg, var(--primary), var(--secondary)); color: #fff; padding: 2rem; } .hero h1 { font-size: 2.5rem; margin-bottom: 1rem; } @media (max-width: 768px) { .hero h1 { font-size: 1.8rem; } }`,
    js: '',
    pages: ['index'],
  };
}

