# Ticket: Post-check deterministico su output AI — flyer + logo (t22)

Labels: `wayfinder:ticket`, `wayfinder:task`
Blocked by: —
Status: closed (2026-08-20, resolution below)

## Risoluzione

Implementato (2026-08-20). Nota lean-code: i floors esistevano già
(`scaledFontBounds` flyer, hex `hexColorSchema`, grid clamp card). Il gap
vero era che Zod **rigettava** gli output oltre limite → `applied=false`
o placeholder "Brand" senza motivo. Fix = **pre-clamp prima dello schema**
(non più validazione):

- **Logo** (`logoOrchestrator.ts`): `clampLogoAIOutput` tronca
  primaryText/tagline/monogram/iconName/imagePrompt/qualityScore/
  scoreReason ai limiti `logoAIOutputSchema` → un tagline da 70 char non
  fa più fallire l'intero parse (bug storico placeholder "Brand").
- **Flyer** (`flyerOrchestrator.ts`): `clampFlyerCopy` tronca
  headline/subheadline/body/cta.label ai limiti `flyerAIOutputSchema`
  (headline 200, subheadline 300, body 2000, cta 50) → `applied=true`
  con copy troncata invece di `error:invalid_flyer`. Applicato nei 2
  path (direct + follow-up tools).
- Non toccati: `scaledFontBounds` (già clampato a print floors),
  `textScale` schema (già 0.7-1.5), grid card (già clampata).
- Test: logo (truncate+parse ok, qualityScore clamp) + flyer (truncate,
  valido invariato) + aggiornato il vecchio test che si aspettava il
  rigetto. 53 verdi, typecheck 0.

## Question

`cardMerge.ts` clampa già i risultati AI card (dimensioni font,
posizioni, collisioni). Flyer e logo non hanno ancora validazione oltre
Zod schema — il modello può restituire output che rompe i limiti di
qualità (dimensioni testo troppo grandi, colori invalidi, collisioni
tra layout block).

**Scope (deciso in sessione 2026-08-20: sì flyer+logo):**

**Flyer**: clamp fontSize headline/body a floor stampa (10pt body),
validazione colori hex, clamp collisioni layoutEngine, fallback
font safe.

**Logo**: validazione `getViewBox` dynamic + clamp tagline length,
palette color validation (hex), clamp iconScale (0.5-2.0), fallback
se builder.backgroundImage manca ma era atteso.

**Costo**: zero (deterministico, runtime). Nessun test necessario
(deterministico per definizione — test esistenti coprono).

**Dove**: `src/utils/flyer/layoutEngine.ts` (clamp) +
`src/utils/logo/svgBuilder.ts` (clamp). Deliverable: output flyer/logo
sempre dentro i limiti, anche se l'AI sbaglia.

Linked: t18 (verify con AI) — t22 è deterministico, complementare:
il verdetto AI (t18) verifica qualità estetica; t22 garantisce i limiti
tecnici sempre validi.