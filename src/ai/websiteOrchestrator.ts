import { z } from 'zod';
import { BaseOrchestrator } from './BaseOrchestrator';
import { resolveSystemPrompt } from './skillLibrary';
import { buildWebsiteGeneratePrompt, buildWebsiteHtmlPrompt, buildWebsiteCssPrompt, buildWebsiteJsPrompt, buildWebsiteFixPrompt, buildWebsitePagePrompt, summarizeIndexHtml } from './prompts/websiteSystem';
import { ensureSeoMeta, stripSocialCanonical } from '../utils/website/seoMeta';
import { stripLogoFromHtml } from '../utils/website/logoInjection';
import { enforceMapIframe } from '../utils/website/sanitizeGenerated';
import { analyzeSiteCode, analyzeSiteRegression } from '../utils/website/siteAnalyser';
import { repairCssStructure, repairHtmlStructure } from '../utils/website/repairStructure';
import type { ElementContext } from '../utils/website/elementPicker';
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

/**
 * Prompt refine mirato: contesto = SOLO gli elementi selezionati (HTML + CSS
 * rules + computed), non il dump completo del sito. Gli edit devono toccare
 * esclusivamente quegli elementi.
 */
function buildElementRefinePrompt(ctxs: ElementContext[], instruction: string): string {
  const blocks = ctxs.map((ctx, i) => {
    const cssBlock = ctx.cssRules.length > 0
      ? `\n### CSS che tocca l'elemento:\n\`\`\`css\n${ctx.cssRules.join('\n')}\n\`\`\``
      : '';
    const similarBlock = ctx.similarRules.length > 0
      ? `\n### CSS di elementi simili (stesso tag, riferimento per "stesso effetto di prima"):\n\`\`\`css\n${ctx.similarRules.join('\n')}\n\`\`\``
      : '';
    const computedBlock = Object.keys(ctx.computed).length > 0
      ? `\n### Stile calcolato (proprietà chiave):\n\`\`\`\n${Object.entries(ctx.computed).map(([k, v]) => `${k}: ${v}`).join('\n')}\n\`\`\``
      : '';
    return [
      `## Elemento ${i + 1} di ${ctxs.length}`,
      '',
      `Pagina: ${ctx.page}`,
      `Viewport preview: ${ctx.viewport}`,
      '',
      '### HTML dell\'elemento:',
      '```html',
      ctx.html,
      '```',
      cssBlock,
      similarBlock,
      computedBlock,
    ].join('\n');
  });
  const parts = [...new Set(ctxs.map((c) => c.part))];
  const pages = [...new Set(ctxs.map((c) => c.page))];
  return [
    ...blocks,
    '',
    `Istruzione di modifica: ${instruction}`,
    '',
    'Rispondi SOLO con un oggetto JSON con UN SOLO campo "edits": un array di modifiche PUNTUALI.',
    'Ogni edit: { "part": "html"|"css"|"js"|"pagesHtml", "page": "nome pagina (solo per pagesHtml)", "find": "stringa ESATTA da cercare nel codice (min 3 caratteri)", "replace": "stringa sostitutiva" }.',
    'REGOLE:',
    '- Modifica SOLO gli elementi selezionati sopra. MAI toccare altri elementi, sezioni o pagine.',
    `- Per modificare l'HTML di un elemento: part DEVE essere "${parts.join('" o "')}"${pages.length === 1 && parts.includes('pagesHtml') ? ` e page DEVE essere "${pages[0]}"` : ''}.`,
    '- Per modificare lo stile di un elemento: part "css" (le regole CSS sopra), find = selettore + dichiarazioni esatte da copiare.',
    '- Se l\'istruzione chiede "stesso effetto di prima", copia lo stile dalla sezione "CSS di elementi simili".',
    '- find DEVE essere una stringa esatta presente nell\'HTML o nel CSS degli elementi sopra (copia-incolla).',
    '- Se la modifica è solo testuale, find = testo vecchio, replace = testo nuovo.',
    '- Max 10 edit. Se un edit non serve, omettilo.',
  ].join('\n');
}
/** Collassa whitespace (spazi/righe/tab) a un singolo spazio. Usato per il
 *  fallback find&replace: l'AI copia dal prompt dove il CSS è mostrato con
 *  whitespace collassato, ma il sorgente è multi-riga. */
function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Prompt repair: il codice è strutturalmente rotto. L'AI riscrive le parti
 *  rotte per intero (JSON con html/css/js), NON find&replace: su codice
 *  corrotto i find non combaciano → loop infinito. */
function buildRepairPrompt(
  site: { html: string; css: string; js: string; pages: string[]; pagesHtml: Record<string, string> },
  instruction: string,
): string {
  const pagesBlock = site.pages.length > 1
    ? Object.entries(site.pagesHtml).map(([name, pHtml]) => `### HTML ${name}:${pHtml ? `\n\`\`\`html\n${stripLogoFromHtml(pHtml)}\n\`\`\`` : ' (mancante)'}`).join('\n\n')
    : '';
  return [
    '## Codice corrente del sito (STRUTTURALMENTE ROTTO)',
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
    `Istruzione: ${instruction}`,
    '',
    'Rispondi SOLO con un oggetto JSON con questi campi (tutti opzionali, includi SOLO le parti da riparare):',
    '{ "html": "HTML index completo e corretto", "css": "CSS completo e corretto", "js": "JS completo e corretto", "pagesHtml": { "nomepagina": "HTML completo e corretto" } }',
    'REGOLE:',
    '- Riscrivi per INTERO la parte rotta (html/css/js/pagesHtml), non frammenti.',
    '- Bilancia TUTTE le parentesi CSS, nessuna regola annidata dentro un\'altra regola, nessun tag HTML orfano.',
    '- NON cambiare lo stile, i colori, i testi o la struttura: solo la sintassi.',
    '- Le parti non incluse nel JSON restano invariate.',
  ].join('\n');
}

/** Regex che matcherà il find nel sorgente originale tollerando differenze
 *  di whitespace: ogni run di whitespace nel find diventa \s+. Ritorna null
 *  se il find è troppo corto o non compilabile. */
function buildWhitespaceFlexibleRegex(find: string): RegExp | null {
  const trimmed = find.trim();
  if (trimmed.length < 3) return null;
  try {
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped.replace(/\s+/g, '\\s+'), 'g');
  } catch {
    return null;
  }
}

/** Estrae il selettore CSS da un frammento (es. `.contatti h2:hover {` →
 *  `.contatti h2:hover`). Ritorna null se non è un blocco CSS. */
function selectorOf(fragment: string): string | null {
  const m = fragment.trim().match(/^([^{]+)\{/);
  return m ? m[1].trim() : null;
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
    // t14: la skill di design segue lo stile del brief (brutalist →
    // industrial-brutalist-ui, minimal → minimalist-ui, editorial → gpt-taste).
    const websiteSystemPrompt = () => resolveSystemPrompt('website-system', { style });

    // ─── Step 1: HTML ───────────────────────────────────────────
    const htmlPrompt = buildWebsiteHtmlPrompt(brief, style, options.briefContext);
    options.onStep?.('html', htmlPrompt);
    if (options.scrapedReference) {
      changes.push(`scraped:${options.scrapedReference.length}chars`);
    }
    const htmlMessages = this.buildMessages(
      await websiteSystemPrompt(),
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
        // 'max' su MiniMax M3 consuma il budget num_predict nel thinking →
        // JSON troncato → parse fail → fallback silenzioso (sito "in
        // costruzione" + mappa, esattamente il bug segnalato 2026-08-17).
        // 'high' basta: output lungo su prompt medio (come lo step CSS).
        reasoningEffort: 'high',
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
      // TB-034: la pagina vede il riassunto deterministico dell'index (hero,
      // CTA, sezioni) per NON ripetere contenuto e restare coerente
      // (stesso CSS condiviso, stesse classi semantiche).
      const indexSummary = summarizeIndexHtml(html);
      for (const page of secondaryPages) {
        const pagePrompt = buildWebsitePagePrompt(page, {
          businessName: brief.businessName,
          description: brief.description,
          tone: brief.tone,
          target: brief.target,
          cta: brief.cta,
          contacts: brief.contacts,
          socials: brief.socials,
        }, navHtml, indexSummary);
        options.onStep?.(`page:${page}`, pagePrompt);
        const pageMessages: ChatMessage[] = [
          { role: 'system', content: await websiteSystemPrompt() },
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
              // 'high' come step html: 'max' mangia il budget nel thinking →
              // JSON troncato → pagina persa (best-effort, ma meglio no).
              reasoningEffort: 'high',
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
      { role: 'system', content: await websiteSystemPrompt() },
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
      { role: 'system', content: await websiteSystemPrompt() },
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

    // ─── Step 5: Verify (check deterministico + fix agent mirato) ───────
    // TB-032: la fonte di verità è l'analisi deterministica (analyze_site),
    // MAI il modello. Pipeline:
    // 1. check zero-AI: struttura html/css/js + sezione regressione (nav,
    //    mappa, form) — codice integro = verify:ok, ZERO costi AI.
    // 2. repair deterministico locale (CSS/HTML, istantaneo) se possibile.
    // 3. fix agent chiamato UNA volta con SOLO le parti rotte (mai il dump
    //    completo: un modello che vede solo il frammento rotto non può
    //    riscrivere codice integro né perdere sezioni).
    // 4. recheck deterministico finale → issue residue REALI nel pannello.
    const verifyStart = Date.now();
    let verifyIssues: string[] | undefined;
    let verifyFixesApplied: string[] | undefined;
    let currentCss = css;
    let currentJs = js;
    let verifyCost = 0;
    let lastVerifyResponse: AIResponse | null = null;

    const runCheck = () => {
      // allPagesHtml ricostruito da `html` CORRENTE: il repair deterministico
      // e il fix agent aggiornano `html`, mai la snapshot presa prima del verify.
      const htmlRes = analyzeSiteCode([html, ...Object.values(pagesHtml)].join('\n\n'), 'html');
      const cssRes = analyzeSiteCode(currentCss, 'css');
      const jsRes = analyzeSiteCode(currentJs, 'js');
      const reg = analyzeSiteRegression(html, brief.contacts);
      return {
        htmlIssues: htmlRes.issues,
        cssIssues: cssRes.issues,
        jsIssues: jsRes.issues,
        regIssues: reg.issues,
      };
    };

    options.onStep?.('verify', 'check deterministico zero-AI + fix agent mirato');
    let check = runCheck();

    // Repair deterministico locale prima di qualunque chiamata AI: parentesi
    // CSS sbilanciate e tag HTML orfani si sistemano in millisecondi,
    // zero costi. Se risolve, il fix agent non serve proprio.
    if (check.cssIssues.length > 0 && currentCss.trim() !== '') {
      const repairedCss = repairCssStructure(currentCss);
      if (repairedCss !== currentCss && analyzeSiteCode(repairedCss, 'css').ok) {
        currentCss = repairedCss;
        changes.push('verify:repair:css');
        check = runCheck();
      }
    }
    if (check.htmlIssues.length > 0) {
      const repairedHtml = repairHtmlStructure(html);
      if (repairedHtml !== html && analyzeSiteCode(repairedHtml, 'html').ok) {
        html = repairedHtml;
        changes.push('verify:repair:html');
        check = runCheck();
      }
    }

    const allIssues = [...check.regIssues, ...check.htmlIssues, ...check.cssIssues, ...check.jsIssues];
    if (allIssues.length === 0) {
      changes.push('verify:ok');
    } else {
      // Fix agent mirato: SOLO le parti rotte e non vuote, mai l'integro.
      const parts: Array<{ name: 'html' | 'css' | 'js'; issue: string; code: string }> = [];
      if (check.htmlIssues.length > 0 && html.trim() !== '') parts.push({ name: 'html', issue: check.htmlIssues[0], code: html });
      if (check.cssIssues.length > 0 && currentCss.trim() !== '') parts.push({ name: 'css', issue: check.cssIssues[0], code: currentCss });
      if (check.jsIssues.length > 0 && currentJs.trim() !== '') parts.push({ name: 'js', issue: check.jsIssues[0], code: currentJs });
      if (check.regIssues.length > 0) {
        const htmlPart = parts.find((p) => p.name === 'html');
        if (htmlPart) htmlPart.issue += ` | ${check.regIssues[0]}`;
        else parts.push({ name: 'html', issue: check.regIssues[0], code: html });
      }
      verifyIssues = allIssues.slice(0, 8);
      changes.push(`verify:${allIssues.length}issues:${allIssues.slice(0, 3).join(' | ')}`);
      if (parts.length > 0) {
        const fixMessages: ChatMessage[] = [
          { role: 'system', content: await websiteSystemPrompt() },
          { role: 'user', content: buildWebsiteFixPrompt(parts) },
        ];
        options.onStep?.('verify', 'fix agent (solo parti rotte)');
        let fixResponse: AIResponse | null = null;
        let fixError: unknown = null;
        try {
          // handleStream (SSE) — vedi nota step pagine: limite 300s Hobby.
          const fixResult = await this.executeWithFallback(
            primaryProviderId,
            fixMessages,
            {
              responseFormat: { type: 'json_object' },
              maxTokens: 16384,
              // 'high' basta per riparare sintassi su frammenti piccoli.
              reasoningEffort: 'high',
              customerId: options.customerId,
              ...runTrace('verify:fix'),
            },
            { onStream: streamSink, onFallback: (id, reason) => changes.push(`fallback:${id}:${reason.slice(0, 80)}`) },
          );
          fixResponse = fixResult.response;
        } catch (err) {
          fixError = err;
        }
        if (!fixResponse) {
          // Fix agent best-effort: un suo errore NON deve perdere il sito.
          changes.push(`verify:error:${fixError instanceof Error ? fixError.message.slice(0, 120) : 'unknown'}`);
        } else {
          verifyCost += this.trackUsage(fixResponse.usage, options.userEmail, options.modelId) || 0;
          lastVerifyResponse = fixResponse;
          const fixParsed = this.parseJsonResponse(fixResponse.content ?? '', z.object({
            fixes: z.object({
              html: z.string().optional(),
              css: z.string().optional(),
              js: z.string().optional(),
            }).optional(),
          }));
          // Applica i fixes con guardia anti-distruzione (stessa del loop
          // storico §26.16): il fixato deve essere deterministicamente
          // integro e non deve perdere sezioni (≥60% della parte rotta).
          if (fixParsed.ok && fixParsed.data?.fixes) {
            const fixes = fixParsed.data.fixes;
            if (fixes.html && fixes.html !== html && analyzeSiteCode(fixes.html, 'html').ok && fixes.html.length >= html.length * 0.6) {
              html = enforceMapIframe(fixes.html, brief.contacts);
              changes.push('verify:html:fixed');
              (verifyFixesApplied ??= []).push('html');
            }
            if (fixes.css && fixes.css !== currentCss && analyzeSiteCode(fixes.css, 'css').ok && fixes.css.length >= currentCss.length * 0.6) {
              currentCss = fixes.css;
              changes.push('verify:css:fixed');
              (verifyFixesApplied ??= []).push('css');
            }
            if (fixes.js && fixes.js !== currentJs && analyzeSiteCode(fixes.js, 'js').ok && fixes.js.length >= currentJs.length * 0.6) {
              currentJs = fixes.js;
              changes.push('verify:js:fixed');
              (verifyFixesApplied ??= []).push('js');
            }
          }
        }
      }

      // Recheck finale: fonte di verità = issue DETERMINISTICHE residue
      // (mai quelle inventate dal modello). Pulito → niente pannello.
      const recheck = runCheck();
      const residual = [...recheck.regIssues, ...recheck.htmlIssues, ...recheck.cssIssues, ...recheck.jsIssues];
      if (residual.length === 0) {
        verifyIssues = undefined;
        changes.push('verify:recheck:ok');
        changes.push('verify:ok');
      } else {
        verifyIssues = residual.slice(0, 8);
        changes.push(`verify:recheck:${residual.length}issues`);
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
      /** Elementi selezionati nella preview: il prompt usa SOLO questi come
       *  contesto (refine mirato), invece del dump completo del sito. */
      elementContext?: ElementContext[];
      /** Repair mode: il codice è strutturalmente rotto (parentesi, tag).
       *  L'AI RISC RIVE le parti rotte per intero (niente find&replace su
       *  codice corrotto → niente loop), il risultato è validato con
       *  analyzeSiteCode prima di essere applicato. */
      repairMode?: boolean;
    } & RunTraceOptions = {},
  ): Promise<WebsiteRefineResult> {
    const changes: string[] = [];
    const sessionId = this.ensureSession();
    const systemPrompt = await resolveSystemPrompt('website-system');
    const pagesBlock = site.pages.length > 1
      ? Object.entries(site.pagesHtml).map(([name, pHtml]) => `### HTML ${name}:${pHtml ? `\n\`\`\`html\n${stripLogoFromHtml(pHtml)}\n\`\`\`` : ' (mancante)'}`).join('\n\n')
      : '';
    const currentCode = options.repairMode
      ? buildRepairPrompt(site, instruction)
      : options.elementContext && options.elementContext.length > 0
      ? buildElementRefinePrompt(options.elementContext, instruction)
      : [
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
    if (options.repairMode) {
      const parsedRepair = this.parseJsonResponse(content, websiteAIRefineSchema);
      if (!parsedRepair.ok) {
        changes.push(`error:${parsedRepair.error}`);
        return { site, changes, response };
      }
      const merged = {
        html: parsedRepair.data.html ?? site.html,
        css: parsedRepair.data.css ?? site.css,
        js: parsedRepair.data.js ?? site.js,
        pages: parsedRepair.data.pages ?? site.pages,
        pagesHtml: { ...site.pagesHtml, ...(parsedRepair.data.pagesHtml ?? {}) },
      };
      // Validazione: il risultato deve essere strutturalmente sano, altrimenti
      // la riparazione è fallita → non applicare.
      const cssOk = analyzeSiteCode(merged.css, 'css').ok;
      const htmlOk = analyzeSiteCode(merged.html, 'html').ok;
      const jsOk = analyzeSiteCode(merged.js, 'js').ok;
      if (!cssOk || !htmlOk || !jsOk) {
        changes.push('repair:failed:risultato ancora corrotto');
        return { site, changes, response };
      }
      changes.push('repair:applied');
      this.trackUsage(response.usage, options.userEmail, options.modelId);
      return { site: merged, changes, response };
    }

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
      // Refine mirato: gli edit HTML/pagesHtml devono toccare una parte/pagina
      // tra quelle selezionate. CSS/JS sono globali: permessi se toccano
      // le regole degli elementi (mostrate nel prompt). Un edit HTML altrove
      // viola il contratto → scartato.
      if (options.elementContext && options.elementContext.length > 0 && (edit.part === 'html' || edit.part === 'pagesHtml')) {
        const editPart = edit.part === 'pagesHtml' ? 'pagesHtml' : edit.part;
        const editPage = edit.part === 'pagesHtml' ? (edit.page ?? 'index') : 'index';
        const allowed = options.elementContext.some(
          (c) => c.part === editPart && c.page === editPage,
        );
        if (!allowed) {
          changes.push(`refine:${edit.part}:skipped:fuori dagli elementi selezionati`);
          continue;
        }
      }
      const target = edit.part === 'pagesHtml'
        ? (edit.page ? merged.pagesHtml[edit.page] : undefined)
        : merged[edit.part];
      if (typeof target !== 'string') {
        changes.push(`refine:${edit.part}:skipped:pagina "${edit.page ?? '?'}" non trovata`);
        continue;
      }
      // Guardia anti-selettore (refine mirato): un edit CSS non deve allargare
      // lo stile ad altri elementi. Se il selettore del replace è più generico
      // del selettore del find (es. `.contatti h2:hover` → `h2:hover`), lo
      // stile toccherebbe TUTTI gli h2 → viola il contratto → scartato.
      if (options.elementContext && options.elementContext.length > 0 && edit.part === 'css') {
        const findSel = selectorOf(edit.find);
        const replaceSel = selectorOf(edit.replace);
        if (findSel && replaceSel && !replaceSel.includes(findSel)) {
          changes.push(`refine:css:skipped:selettore allargato (${findSel} → ${replaceSel})`);
          continue;
        }
      }
      const idx = target.indexOf(edit.find);
      if (idx === -1) {
        // Fallback: l'AI copia dal prompt dove il CSS è mostrato con
        // whitespace collassato, ma il sorgente è multi-riga. Regex con
        // \s+ wildcard: matcherà il sorgente originale e darà indici reali
        // (un indexOf su target normalizzato darebbe indici sbagliati →
        // slice corrotto).
        const re = buildWhitespaceFlexibleRegex(edit.find);
        const matches = re ? Array.from(target.matchAll(re)) : [];
        if (matches.length === 0) {
          changes.push(`refine:${edit.part}:skipped:find non trovato (${edit.find.slice(0, 40)}…)`);
          continue;
        }
        if (matches.length > 1) {
          changes.push(`refine:${edit.part}:skipped:find ambiguo (${edit.find.slice(0, 40)}…)`);
          continue;
        }
        const m = matches[0];
        const normReplace = normalizeWhitespace(edit.replace);
        const next = target.slice(0, m.index) + normReplace + target.slice(m.index + m[0].length);
        if (edit.part === 'pagesHtml' && edit.page) merged.pagesHtml[edit.page] = next;
        else if (edit.part === 'html') merged.html = next;
        else if (edit.part === 'css') merged.css = next;
        else if (edit.part === 'js') merged.js = next;
        applied++;
        changes.push(`refine:${edit.part}:applied:${edit.find.length}->${edit.replace.length}chars (whitespace-normalized)`);
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

