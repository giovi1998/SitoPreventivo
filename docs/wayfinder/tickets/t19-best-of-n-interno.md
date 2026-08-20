# Ticket: Best-of-N interno per copy (flyer + card + logo) (t19)

Labels: `wayfinder:ticket`, `wayfinder:task`
Blocked by: —
Status: open, unassigned

## Question

Generiamo 3 varianti in una call invece di 1, auto-giudizio del modello
sceglie la migliore. Zero costi extra (1 call, no N chiamate).

Scope (deciso in sessione 2026-08-20):
- **Flyer**: 3 varianti headline+subheadline+body+CTA in una call
  (`generateCopy`). Modello auto-seleziona la migliore. Schema più
  grande → rischio parse error (lesson "logo:fallback_concepts" 2026-08-13
  insegna); fallback: se parse fallisce, prima variante.
- **Card**: 3 varianti gridPreset/layout in una call (`generate_card`).
  Modello auto-seleziona. Nessun costo extra.
- **Logo**: già genera 3 concept con auto-selezione (`generateLogo`).
  Miglioramento: aggiungere `qualityScore` auto-giudicato nel concept
  (0-1) + motivazione.

Vincolo: il prompt deve richiedere `bestOf: 3` + selezione in un campo
`selected`. Schema JSON cresce → clamp del prompt per evitare parse
error (>schema size). Test: parse valido per mock 3-varianti+selezione,
fallback per parse fail, costo identico.

Da NON fare (candidates rimossi): N chiamate separate (costoso).
