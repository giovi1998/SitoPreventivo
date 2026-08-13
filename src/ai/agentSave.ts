// T11: wiring agente → flusso CRM "Genera bozze AI".
// Helper puri: costruiscono il brief dell'agente dai doc/customer e
// mappano il risultato di ogni tool in dati da salvare sul documento.
// Il save vero (saveDraft + aiStats + compressione) resta nel hook.

import type { AgentBrief, AgentToolResult } from './agentOrchestrator';

type BriefDoc = { data?: Record<string, unknown> | null };
type BriefCustomer = { businessName?: string; aiSuggestedFields?: Record<string, unknown> | null };

const DOC_TYPE_OF_TOOL: Record<string, string> = {
  generate_logo: 'logo',
  generate_card: 'businessCard',
  generate_flyer: 'flyer',
  generate_website: 'website',
};

export function docTypeOfTool(toolName: string): string {
  return DOC_TYPE_OF_TOOL[toolName] ?? '';
}

function firstBrief(docs: BriefDoc[]): string {
  for (const d of docs) {
    const b = d.data?.briefContext;
    if (typeof b === 'string' && b.trim()) return b.trim();
  }
  return '';
}

function strField(data: Record<string, unknown> | null | undefined, key: string): string {
  const v = data?.[key];
  return typeof v === 'string' ? v : '';
}

/** Brief best-effort dal primo doc con briefContext + customer. */
export function buildAgentBrief(docs: BriefDoc[], customer: BriefCustomer): AgentBrief {
  const main = docs.find((d) => typeof d.data?.briefContext === 'string' && String(d.data?.briefContext).trim())?.data ?? {};
  const suggested = customer.aiSuggestedFields ?? {};
  const websiteDoc = docs.find((d) => d.data?.source === 'ai' || d.data?.html);
  return {
    businessName: customer.businessName || strField(main, 'businessName') || 'Attività',
    sector: strField(main, 'sector'),
    description: firstBrief(docs),
    tone: strField(main, 'tone'),
    target: strField(main, 'target'),
    preferredColors: strField(main, 'preferredColors'),
    cta: strField(main, 'cta'),
    contacts: strField(main, 'contacts'),
    pages: strField(main, 'pages') || 'index',
    features: strField(main, 'features'),
    socials: Array.isArray(main.socials) ? main.socials.map((s) => String(s)) : [],
    notes: strField(suggested, 'notes') || '',
    website: {
      style: strField(main, 'style') || 'modern',
      briefContext: firstBrief(docs),
    },
  };
}

/** Mappa tool result → dati da salvare sul documento (null = niente da salvare). */
export function agentResultData(docType: string, result: AgentToolResult): Record<string, unknown> | null {
  const d = result.data as Record<string, unknown> | null | undefined;
  if (!result.ok || !d) return null;
  switch (docType) {
    case 'logo': {
      const concepts = (d.concepts ?? []) as Array<Record<string, unknown>>;
      const selected = typeof d.selected === 'number' ? d.selected : 0;
      const builder = concepts[selected];
      if (!builder) return null;
      return { builder, concepts };
    }
    case 'businessCard': {
      const card = d.card as Record<string, unknown> | undefined;
      if (!card) return null;
      return { ...card };
    }
    case 'flyer': {
      const flyer = d.flyer as Record<string, unknown> | undefined;
      if (!flyer) return null;
      return { ...flyer };
    }
    case 'website': {
      const site = d.site as Record<string, unknown> | undefined;
      if (!site || typeof site.html !== 'string') return null;
      return {
        html: site.html,
        css: site.css ?? '',
        js: site.js ?? '',
        pages: site.pages ?? ['index'],
        pagesHtml: site.pagesHtml ?? {},
        source: 'ai',
      };
    }
    default:
      return null;
  }
}
