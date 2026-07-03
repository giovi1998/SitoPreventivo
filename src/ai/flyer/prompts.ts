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
  headlineMaxChars?: number;
  subheadlineMaxChars?: number;
  ctaMaxChars?: number;
  densityTarget?: 'low' | 'medium';
  layoutAdvice?: string;
}

export function sanitizeFlyerBrief(brief: string): string {
  return brief
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildFlyerCopyPrompt(brief: string, tone: FlyerTone, context: FlyerCopyContext): string {
  const safeBrief = sanitizeFlyerBrief(brief).slice(0, 500);
  const toneLine = TONE_DESCRIPTIONS[tone] ?? TONE_DESCRIPTIONS.formale;
  const layoutLine = layoutGuidance(context.layout);
  const headlineMax = context.headlineMaxChars ?? 60;
  const subheadlineMax = context.subheadlineMaxChars ?? 100;
  const ctaMax = context.ctaMaxChars ?? 30;
  const advice = context.layoutAdvice ? `\nAttenzione layout: ${context.layoutAdvice}` : '';
  const density = context.densityTarget ? `\nDensità target: ${context.densityTarget}.` : '';
  return `Sei un copywriter italiano esperto in volantini pubblicitari.
Genera il copy per un volantino da questo brief:

Brief: "${safeBrief || 'Volantino generico'}"

Tono: ${toneLine}
Formato: ${context.size} ${context.layout === 'centered' ? 'tipografico centrato' : context.layout}
${layoutLine}${advice}${density}

Restituisci SOLO un oggetto JSON valido con questa struttura esatta:
{
  "headline": "titolo principale, max ${headlineMax} caratteri, accattivante e d'impatto",
  "subheadline": "sottotitolo, max ${subheadlineMax} caratteri, complementare all'headline",
  "body": "corpo del testo, max ${context.bodyCharBudget} caratteri, usa \\n per andare a capo tra paragrafi",
  "cta": { "label": "call to action, max ${ctaMax} caratteri, verbo all'imperativo" }
}

Vincoli:
- Non superare i limiti di caratteri per il formato/layout attuale.
- Non includere il campo url in cta (verrà aggiunto manualmente dall'utente).
- Non includere markdown, commenti, spiegazioni, codici o testo fuori dal JSON.
- Lingua: italiano.
- Niente emoji o caratteri speciali non italiani.
- Non inventare date specifiche se non presenti nel brief.
- Restituisci ESCLUSIVAMENTE il JSON.`;
}

function layoutGuidance(layout: FlyerLayout): string {
  switch (layout) {
    case 'classic': return 'Layout classico: headline in alto, body sotto, CTA in fondo. Struttura lineare, perfetta per eventi e promozioni.';
    case 'centered': return 'Layout centrato tipografico: tutto centrato, headline come titolo principale, niente immagine hero. Perfetto per annunci e comunicati.';
    case 'split': return 'Layout split 50/50: immagine hero a sinistra, copy a destra (o viceversa). Hero image è il punto focale, copy breve e diretto.';
    case 'magazine': return 'Layout magazine a colonne: body distribuito su colonne parallele. Perfetto per listini, menù o cataloghi.';
  }
}

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
- Rispetta i limiti di caratteri indicati nel prompt utente (headline, subheadline, body, cta.label), che sono calcolati dal layout engine in base al formato e al layout selezionati.
- Non includere il campo url in cta (è sempre inserito manualmente dall'utente).
- Non inventare date, luoghi, prezzi, numeri di telefono se non sono nel brief dell'utente.
- Se il brief è troppo denso per il formato, restituisci copy più breve e, se necessario, suggerisci un formato più grande o un layout diverso.
- Lingua: italiano. Niente emoji.

OUTPUT:
- Rispondi con il JSON completo del volantino aggiornato.`;
}
