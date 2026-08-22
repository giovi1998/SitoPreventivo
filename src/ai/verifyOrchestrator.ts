// t18: orchestratore di verifica visione post-loop per CRM auto-build.
// 1 sola call AI con i 3 preview (logo/card/flyer) allegati come
// immagini: la risposta è un verdict per oggetto ('pass' | 'retry').
// Se retry, il chiamante (useAutoBuildGenerate) rigenera SOLO quello
// (max 1 volta) passando la motivazione come focus aggiuntivo.
import { BaseOrchestrator } from './BaseOrchestrator';
import { providerRegistry } from './providers/registry';
import { getAiVisionEnabled } from '../utils/uiPrefs';
import { resolveProviderId, providerSupportsVision } from '../utils/resolveProviderId';
import { logger } from '../utils/logger';
import type { Logo, BusinessCard, Flyer } from '../utils/documentSchemas';
import type { AIProvider } from './types';

export type VerifyVerdict = 'pass' | 'retry';

export interface VerifyDraft {
  draft: Logo | BusinessCard | Flyer;
  preview: string;
}

export interface VerifyInput {
  brief: string;
  drafts: {
    logo?: VerifyDraft;
    card?: VerifyDraft;
    flyer?: VerifyDraft;
  };
  maxRetries?: number;
}

export interface VerifyOutput {
  logo?: { verdict: VerifyVerdict; reason?: string };
  card?: { verdict: VerifyVerdict; reason?: string };
  flyer?: { verdict: VerifyVerdict; reason?: string };
}

const SYSTEM_PROMPT = `Sei un revisore grafico post-generazione. Per ogni oggetto allegato (logo / biglietto da visita / flyer) restituisci un verdetto secco "pass" o "retry" (e una sola motivazione breve in italiano, max 120 caratteri, SOLO se retry).

Criteri "pass":
- testi leggibili (no overflow, no tagli)
- contrasto sufficiente WCAG 4.5:1
- allineamento gerarchia tipografica (titolo > sottotitolo > corpo)
- nessun placeholder o evidente artefatto AI

Criteri "retry": uno dei 4 manca o è mediocre. La motivazione è l'unica cosa che il rigeneratore userà come focus.

Output JSON striato (nessun commento, nessun markdown):
{"logo":{"verdict":"pass"|"retry","reason":string?},"card":{...},"flyer":{...}}`;

function parseVerdictJson(raw: string): VerifyOutput {
  const cleaned = raw.replace(/^```json\n?|\n?```$/g, '').trim();
  const parsed = JSON.parse(cleaned) as VerifyOutput;
  return parsed;
}

export class VerifyOrchestrator extends BaseOrchestrator {
  protected aiKind = 'verify';

  async verifyDrafts(input: VerifyInput, options?: { userEmail?: string; modelId?: string }): Promise<VerifyOutput> {
    const { brief, drafts } = input;
    const modelId = options?.modelId ?? resolveProviderId();
    const visionOk = options?.modelId ? true : getAiVisionEnabled() && providerSupportsVision(modelId);
    if (!visionOk) {
      logger.warn('verify orchestrator: vision non abilitata o modello non vision', {
        route: 'verifyOrchestrator',
        modelId,
      });
      return {};
    }
    const provider = providerRegistry.getProvider(modelId);
    const images: string[] = [];
    const labels: string[] = [];
    if (drafts.logo) { labels.push('logo'); images.push(drafts.logo.preview); }
    if (drafts.card) { labels.push('card'); images.push(drafts.card.preview); }
    if (drafts.flyer) { labels.push('flyer'); images.push(drafts.flyer.preview); }
    if (images.length === 0) return {};

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      {
        role: 'user' as const,
        content: `Oggetti: ${labels.join(', ')}.\nBrief: ${brief.slice(0, 400)}`,
        images,
      },
    ];
    const response = await provider.chat(messages, {
      kind: 'verify',
      responseFormat: { type: 'json_object' },
      reasoningEffort: 'low',
      maxTokens: 600,
    });
    this.trackUsage(response.usage, options?.userEmail);
    const text = response.content ?? '';
    try {
      const verdict = parseVerdictJson(text);
      return verdict;
    } catch (err) {
      logger.warn('verify orchestrator: JSON non parsabile', { route: 'verifyOrchestrator', err: String(err), sample: text.slice(0, 200) });
      return {};
    }
  }
}
