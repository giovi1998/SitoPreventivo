# Ticket: Post-check deterministico su output AI — flyer + logo (t22)

Labels: `wayfinder:ticket`, `wayfinder:task`
Blocked by: —
Status: open, unassigned

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