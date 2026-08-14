// T9: agente orchestratore con harness (tools) per generare i 4 oggetti.
// L'AI pianifica e decide cosa generare (generate_logo/card/flyer/website);
// ogni tool delega all'orchestratore esistente e il risultato torna al
// modello come messaggio tool per il passo successivo. Niente LangGraph
// (T1): loop plan→act a max iterazioni su ToolAwareOrchestrator nativo.
// Il salvataggio resta al chiamante (useAutoBuildGenerate via onToolResult).

import { z } from 'zod';
import { BaseOrchestrator } from './BaseOrchestrator';
import { LogoAIOrchestrator } from './logoOrchestrator';
import { CardAIOrchestrator } from './cardOrchestrator';
import { FlyerAIOrchestrator } from './flyerOrchestrator';
import { WebsiteOrchestrator } from './websiteOrchestrator';
import { providerRegistry } from './providers/registry';
import { newSpanId } from './runTrace';
import type { AIResponse, AIStreamChunk, AIToolCall, RunTraceOptions } from './types';
import type { BusinessCard, Flyer, FlyerTone, Logo } from '../utils/documentSchemas';

export interface AgentToolResult {
  name: string;
  ok: boolean;
  summary: string;
  data?: unknown;
}

export interface AgentContext {
  modelId?: string;
  customerId?: string;
  sessionId?: string;
  userEmail?: string;
  /** T7: trace gerarchica — l'agente è il root, ogni tool uno step span. */
  runTrace?: RunTraceOptions;
}

export interface AgentDoc {
  logo: Logo;
  card: BusinessCard;
  flyer: Flyer;
  website?: { html: string; css: string; js: string; pages: string[]; pagesHtml: Record<string, string> };
}

export interface AgentBrief {
  businessName: string;
  sector: string;
  description: string;
  tone: string;
  target: string;
  preferredColors: string;
  cta: string;
  contacts: string;
  pages: string;
  features: string;
  socials: string[];
  notes: string;
  website?: {
    style?: string;
    logoBase64?: string;
    briefContext?: string;
  };
}

export interface AgentRunOptions {
  /** Oggetti da generare (default: tutti i presenti nel brief). */
  include?: Array<'logo' | 'card' | 'flyer' | 'website'>;
  onStream?: (chunk: AIStreamChunk) => void;
  /** Chiamato a ogni tool completato (il chiamante salva il doc). */
  onToolResult?: (result: AgentToolResult) => void | Promise<void>;
}

const MAX_TOOL_ROUNDS = 6;

const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'generate_logo',
      description: 'Genera 3 concept logo AI per l\'attività (struttura, testi, stile). Ritorna i concept pronti.',
      parameters: {
        type: 'object',
        properties: { focus: { type: 'string', description: 'Aspetto da enfatizzare (es. "pasteleria elegante")' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_card',
      description: 'Genera il biglietto da visita completo per l\'attività (layout fronte/retro, testi, stile, palette).',
      parameters: {
        type: 'object',
        properties: { focus: { type: 'string', description: 'Aspetto da enfatizzare (es. "contatti e servizi")' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_flyer',
      description: 'Genera il copy del volantino (headline, subheadline, body, CTA) coerente con il brand.',
      parameters: {
        type: 'object',
        properties: { tone: { type: 'string', enum: ['formale', 'giovanile', 'tecnico'], description: 'Tono del copy' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_website',
      description: 'Genera il sito web completo (HTML multi-pagina, CSS, JS, verify) per l\'attività.',
      parameters: {
        type: 'object',
        properties: { pages: { type: 'string', description: 'Pagine da generare (es. "index, chi-siamo, contatti")' } },
        required: [],
      },
    },
  },
] as const;

function toolToOpenAi(tool: (typeof AGENT_TOOLS)[number]) {
  return { type: 'function' as const, function: { name: tool.function.name, description: tool.function.description, parameters: tool.function.parameters } };
}

export class AgentOrchestrator extends BaseOrchestrator {
  protected aiKind = 'agent';

  async run(brief: AgentBrief, docs: AgentDoc, ctx: AgentContext, options: AgentRunOptions = {}): Promise<{ results: AgentToolResult[]; response: AIResponse; sessionId: string }> {
    const sessionId = this.ensureSession();
    const provider = providerRegistry.getProvider(ctx.modelId);
    const include = options.include ?? ['logo', 'card', 'flyer', 'website'];
    const tools = AGENT_TOOLS.filter((t) => include.includes(t.function.name.replace('generate_', '') as any)).map(toolToOpenAi);
    const messages = this.buildMessages(AGENT_SYSTEM_PROMPT, buildAgentUserPrompt(brief, include));
    const results: AgentToolResult[] = [];
    let response: AIResponse = { content: null, toolCalls: undefined, usage: undefined };

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      response = await this.handleStream(provider, messages, {
        tools,
        reasoningEffort: 'max',
        sessionId: ctx.sessionId,
        customerId: ctx.customerId,
        kind: 'agent',
        runId: ctx.runTrace?.runId,
        runName: ctx.runTrace?.runName ?? 'auto-build',
        startRun: round === 0 ? ctx.runTrace?.startRun : false,
        rootSpanId: ctx.runTrace?.rootSpanId,
        stepName: 'plan',
        stepSpanId: newSpanId(),
      }, { onStream: options.onStream });

      const toolCalls = response.toolCalls ?? [];
      if (toolCalls.length === 0) break;

      for (const tc of toolCalls) {
        const toolDoc = tc.function.name.replace('generate_', '') as (typeof include)[number];
        if (!include.includes(toolDoc)) continue;
        const result = await this.executeTool(tc, brief, docs, ctx);
        results.push(result);
        messages.push({ role: 'assistant', content: response.content ?? '', toolCalls: [tc] });
        messages.push({ role: 'tool', content: JSON.stringify(result.summary), toolCallId: tc.id, name: tc.function.name });
        await options.onToolResult?.(result);
      }
    }

    return { results, response, sessionId };
  }

  private async executeTool(tc: AIToolCall, brief: AgentBrief, docs: AgentDoc, ctx: AgentContext): Promise<AgentToolResult> {
    const name = tc.function.name;
    const runTrace = { ...ctx.runTrace, stepName: name.replace('generate_', ''), stepSpanId: newSpanId() };
    try {
      switch (name) {
        case 'generate_logo': {
          const result = await new LogoAIOrchestrator().generateLogo(docs.logo, brief.description, {
            modelId: ctx.modelId,
            customerId: ctx.customerId,
            sessionId: ctx.sessionId,
            ...runTrace,
          });
          const selected = result.concepts[result.selected];
          return {
            name,
            ok: result.applied,
            summary: result.applied && selected
              ? `Logo generato: concept "${selected.primaryText}" (layout ${selected.layout}).`
              : `Logo non applicato: ${result.changes || 'nessun concept valido'}`,
            data: result,
          };
        }
        case 'generate_card': {
          const prompt = `Genera il biglietto da visita completo per ${brief.businessName} (${brief.sector}). ${brief.description}. Palette: ${brief.preferredColors || 'coerente col settore'}.`;
          const result = await new CardAIOrchestrator().processPrompt(docs.card, prompt, {
            modelId: ctx.modelId,
            customerId: ctx.customerId,
            sessionId: ctx.sessionId,
            ...runTrace,
          });
          const style = (result.card as any)?.style;
          return {
            name,
            ok: true,
            summary: `Card generata: layout ${style?.layout ?? 'default'}, palette #${style?.bgColor?.replace('#', '') ?? '?'}/${style?.accentColor?.replace('#', '') ?? '?'}.`,
            data: { card: result.card },
          };
        }
        case 'generate_flyer': {
          const tone: FlyerTone = brief.tone === 'formale' ? 'formale' : brief.tone === 'tecnico' ? 'tecnico' : 'giovanile';
          const result = await new FlyerAIOrchestrator().generateCopy(docs.flyer, brief.description, tone, {
            modelId: ctx.modelId,
            customerId: ctx.customerId,
            sessionId: ctx.sessionId,
            ...runTrace,
          });
          return {
            name,
            ok: result.applied,
            summary: result.applied
              ? `Flyer copy generata: headline "${docs.flyer.content.headline}".`
              : `Flyer copy non valida: ${result.changes || 'schema fail'}`,
            data: { flyer: result.flyer },
          };
        }
        case 'generate_website': {
          const result = await new WebsiteOrchestrator().generateSite(
            {
              businessName: brief.businessName,
              sector: brief.sector,
              description: brief.description,
              tone: brief.tone,
              target: brief.target,
              pages: brief.pages,
              preferredColors: brief.preferredColors,
              font: '',
              cta: brief.cta,
              sections: 'hero, chi_siamo, contatti',
              features: brief.features,
              contacts: brief.contacts,
              socials: (brief.socials ?? []).map((s) => ({ platform: s, url: s })),
              mapsUrl: '',
              notes: brief.notes,
            },
            {
              style: brief.website?.style ?? 'modern',
              briefContext: brief.website?.briefContext,
              modelId: ctx.modelId,
              logoBase64: brief.website?.logoBase64,
              customerId: ctx.customerId,
              sessionId: ctx.sessionId,
              ...runTrace,
            },
          );
          return {
            name,
            ok: true,
            summary: `Sito generato: ${result.site.pages.join(', ')} (html ${result.site.html.length}ch, css ${result.site.css.length}ch, js ${result.site.js.length}ch).`,
            data: { site: result.site },
          };
        }
        default:
          return { name, ok: false, summary: `Tool sconosciuto: ${name}` };
      }
    } catch (err) {
      return { name, ok: false, summary: `Errore ${name}: ${err instanceof Error ? err.message.slice(0, 200) : 'unknown'}` };
    }
  }
}

const AGENT_SYSTEM_PROMPT = `Sei l'agente orchestratore di Quickbrand. Generi l'identità completa di un'attività: logo, biglietto da visita, volantino e sito web.

Regole:
- Analizza il brief e DECIDI quali oggetti generare, in ordine di dipendenza (logo → card → flyer → website).
- Usa i tool disponibili per generare ogni oggetto. Un oggetto per tool call.
- Dopo ogni tool call ricevi il riepilogo del risultato. Se un oggetto fallisce, riprova con focus diverso al massimo una volta.
- Alla fine riepiloga brevemente cosa è stato generato.`;

function buildAgentUserPrompt(brief: AgentBrief, include: Array<'logo' | 'card' | 'flyer' | 'website'>): string {
  return `# Brief attività
- Nome: ${brief.businessName}
- Settore: ${brief.sector}
- Descrizione: ${brief.description}
- Tono: ${brief.tone || 'non specificato'}
- Target: ${brief.target || 'non specificato'}
- Colori preferiti: ${brief.preferredColors || 'non specificati'}
- CTA principale: ${brief.cta || 'non specificata'}
- Contatti: ${brief.contacts || 'non specificati'}
- Social: ${brief.socials?.join(', ') || 'non specificati'}
- Pagine sito: ${brief.pages || 'index'}
- Note: ${brief.notes || 'nessuna'}

Genera questi oggetti: ${include.join(', ')}.`;
}
