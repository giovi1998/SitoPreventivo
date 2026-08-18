# T2 - Audit flyer editor (azioni + layout)

## Question

Tutte le azioni del flyer editor funzionano (template, AI copy/hero,
manuale, export PDF/PNG, formati) e il layout è coerente? Checklist:
ogni controllo ha effetto; stati loading/error/empty; toast; responsive;
coerenza con gli altri editor (rail AI, ActionBar). Output: problemi +
fix o ticket derivati.

## Resolution

Chiuso 2026-08-18. Esito: **verde, nessun issue P0-P1**.

- Funzionale: template per settore con toast, AI copy (brief vuoto →
  toast info), AI hero (prompt → save con toast), copy per azione
  (tone/rewrite/translate), export PDF/PNG con success/error, save-guard
  `flyerHasContent` ("Compila almeno il titolo o il copy"), reset, verify
  (budget) con toast success/info.
- Layout: rail destra `1fr 420px auto` (shell.css) — coerente con card.
- Mobile: bottom bar + `.editor-mobile-panel` (50vh scroll) + preview.
- A11y: label AI tab in bottom bar, panel aria-label.
- Advisory detector: 24 (token hardcoded) — stesso pattern di card, vedi
  ticket derivato in T5.
