# T1 - Audit card editor (azioni + layout)

## Question

Tutte le azioni del card editor funzionano (fronte/retro, grid, AI rail,
save, export, placement, decorations) e il layout è coerente? Checklist:
ogni bottone/controllo ha effetto visibile; stati loading/error/empty;
toast su successo/errore; responsive 767/1023 (tab mobile, FAB,
MobileGridEditor); gerarchia form/preview/rail. Output: problemi trovati
+ fix piccoli applicati o ticket derivati.

## Resolution

Chiuso 2026-08-18. Esito: **verde, nessun issue P0-P1**.

- Funzionale: upload validato (mime allowlist + size 5MB con toast),
  toast su template/reset/AI (n modifiche applicate/nessuna modifica),
  verify/repair, export (pdf/cropMarks, png, svg, json) con stato
  exporting, autosave 30s, save-guard.
- Layout: rail AI destra `1fr 420px auto` coerente con flyer/website
  (spessore diverso 420px vs 320px, vedi nota), gerarchia
  form/preview/rail, tab mobile Anteprima/Modifica (tab "AI" rimosso
  2026-08-18: entry unica FAB), FAB+bottom sheet con badge unread.
- Responsive 767/1023: AC-001..006 breakpoints verdi (e2e), FAB z-90
  sopra toolbar z-80, no overlap.
- A11y: toolbar aria-label, tab role, preview aria-label; nessun
  controllo senza label nel percorso principale.
- Fix applicati nella sessione (già committati): double-AI entry rimosso,
  picker elemento visibile mobile (viewport-controls wrap), sheet AI
  vuota (forceExpanded).

Nota: advisory detector (font-size/colori hardcoded, ~68) = pattern
sistemico pre-token, non bloccante — vedere T5 per ticket derivato.
