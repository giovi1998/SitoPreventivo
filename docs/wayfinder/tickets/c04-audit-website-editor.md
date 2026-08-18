# T4 - Audit website editor (azioni + layout)

## Question

Tutte le azioni del website builder funzionano (brief 14 campi, genera,
multi-pagina, verify, fix, element picker, refine, export ZIP, viewport
toggle, upload logo) e il layout è coerente? Include regression scroll
rail AI (fix 2026-08-18). Checklist: ogni controllo ha effetto; stati
loading/error/empty; responsive (tab preview mobile); coerenza rail AI
con altri editor. Output: problemi + fix o ticket derivati.

## Resolution

Chiuso 2026-08-18. Esito: **verde, nessun issue P0-P1**.

- Funzionale: brief 14 campi, genera/rigenera con step indicator, verify
  zero-AI deterministico (TB-032), fix mirato (issue residue nel panel),
  element picker cross-realm (§26.29), refine singolo/elementi selezionati,
  export ZIP, viewport toggle, upload logo con compressione.
- Fix sessione (già committati): rail AI scrollabile desktop (overflow-y
  auto), mobile → FAB+bottom sheet (pattern card, forceExpanded),
  picker visibile a 390px (viewport-controls wrap).
- Layout: rail destra 320px (coerente card/flyer), header pagina,
  tab Brief/Preview/Codice.
- Responsive: AC-007 + AC-008 (picker dentro viewport) verdi.
- Advisory detector: 0 finding su WebsiteEditor.tsx.
