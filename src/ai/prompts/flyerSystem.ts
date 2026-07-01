import type { FlyerTone, FlyerLayout, FlyerSize } from '../../utils/documentSchemas';

const TONE_DESCRIPTIONS: Record<FlyerTone, string> = {
  formale: 'tono formale e professionale, rivolto a un pubblico adulto, lessico curato',
  giovanile: 'tono fresco e giovanile, rivolto a under-35, linguaggio diretto, contrazioni ammesse',
  tecnico: 'tono tecnico e preciso, includi numeri e specifiche misurabili quando possibile',
};

export interface FlyerCopyContext {
  layout: FlyerLayout;
  size: FlyerSize;
  sector?: string;
  bodyCharBudget: number;
}

/**
 * Sanitize a user-provided brief before it hits the LLM prompt. The
 * brief is free text entered by the user: we strip HTML tags (XSS
 * payload in case the response is later rendered with dangerouslySetInnerHTML
 * — currently it's rendered as text, but defensive in depth) and trim
 * excessive whitespace. The brief is logged server-side for debugging
 * but never persisted in the DB (see `chatStore.addMessage` path).
 */
export function sanitizeFlyerBrief(brief: string): string {
  return brief
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build the LLM prompt that asks DeepSeek to produce flyer copy.
 * Pure function, no I/O — easy to unit-test and to swap to another
 * provider if needed.
 *
 * Output contract (enforced by the model via `response_format: json_object`):
 * {
 *   headline: string (max 60 char),       // main hook
 *   subheadline: string (max 100 char),   // supporting line
 *   body: string (max {bodyCharBudget} char, \\n for paragraphs),
 *   cta: { label: string (max 30 char) }  // CTA label only, url is user-supplied
 * }
 */
export function buildFlyerCopyPrompt(
  brief: string,
  tone: FlyerTone,
  context: FlyerCopyContext
): string {
  const safeBrief = sanitizeFlyerBrief(brief).slice(0, 500);
  const toneLine = TONE_DESCRIPTIONS[tone] ?? TONE_DESCRIPTIONS.formale;
  const layoutLine = layoutGuidance(context.layout);
  return `Sei un copywriter italiano esperto in volantini pubblicitari.
Genera il copy per un volantino da questo brief:

Brief: "${safeBrief || 'Volantino generico'}"

Tono: ${toneLine}
Formato: ${context.size} ${context.layout === 'centered' ? 'tipografico centrato' : context.layout}
${layoutLine}

Restituisci SOLO un oggetto JSON valido con questa struttura esatta:
{
  "headline": "titolo principale, max 60 caratteri, accattivante e d'impatto",
  "subheadline": "sottotitolo, max 100 caratteri, complementare all'headline",
  "body": "corpo del testo, max ${context.bodyCharBudget} caratteri, usa \\\\n per andare a capo tra paragrafi",
  "cta": { "label": "call to action, max 30 caratteri, verbo all'imperativo" }
}

Vincoli:
- Non includere il campo url in cta (verrà aggiunto manualmente dall'utente).
- Non includere markdown, commenti, spiegazioni, codici o testo fuori dal JSON.
- Lingua: italiano.
- Niente emoji o caratteri speciali non italiani.
- Non inventare date specifiche se non presenti nel brief.
- Restituisci ESCLUSIVAMENTE il JSON.`;
};

function layoutGuidance(layout: FlyerLayout): string {
  switch (layout) {
    case 'classic':
      return 'Layout classico: headline in alto, body sotto, CTA in fondo. Struttura lineare, perfetta per eventi e promozioni.';
    case 'centered':
      return 'Layout centrato tipografico: tutto centrato, headline come titolo principale, niente immagine hero. Perfetto per annunci e comunicati.';
    case 'split':
      return 'Layout split 50/50: immagine hero a sinistra, copy a destra (o viceversa). Hero image è il punto focale, copy breve e diretto.';
    case 'magazine':
      return 'Layout magazine a 3 colonne: body distribuito su 3 blocchi paralleli. Perfetto per listini, menù o cataloghi.';
  }
}

/**
 * Build the system prompt for the flyer AI assistant. Currently used
 * by the orchestrator's first message in the session so the model
 * understands the broader context (no tools, JSON round-trip).
 */
export function buildFlyerSystemPrompt(): string {
  return `Sei l'assistente AI per la creazione di volantini (flyer) dell'app Quickbrand.

REGOLE GENERALI:
- Rispondi SEMPRE in italiano.
- Modalità supportate: GENERA (nuovo copy da brief) o MODIFICA (riffina copy esistente).
- Lo strumento di output è ESCLUSIVAMENTE un oggetto JSON valido (response_format: json_object).
- Niente markdown, niente spiegazioni, niente codice: SOLO JSON.

MODALITÀ GENERA:
- L'utente fornisce un brief e un tono. Genera { headline, subheadline, body, cta: { label } }.
- Rispetta i limiti di lunghezza indicati nel prompt utente.

MODALITÀ MODIFICA (azioni rapide):
- "Semplifica": riduci il body, mantieni headline/subheadline, mantieni CTA label.
- "Più formale": riformula in tono professionale, mantieni la struttura.
- "Più giovanile": riformula in tono fresco e diretto, mantieni la struttura.
- "Aggiungi urgenza": aggiungi espressioni di scarsità/tempo limitato al body e alla CTA label.

VINCOLI:
- Massimo 60 caratteri per headline.
- Massimo 100 caratteri per subheadline.
- Massimo 500 caratteri per body (può aumentare in base al formato).
- Massimo 30 caratteri per cta.label.
- Non includere il campo url in cta (è sempre inserito manualmente dall'utente).
- Non inventare date, luoghi, prezzi, numeri di telefono se non sono nel brief dell'utente.
- Lingua: italiano. Niente emoji.

OUTPUT:
- Rispondi con il JSON completo del volantino aggiornato.`;
}
