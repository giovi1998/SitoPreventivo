# T5 - Audit editor minori + azioni globali (preventivo, QR, social, Collection)

## Question

Preventivo (EditorView), QR editor, social editor (incluse immagini post
2026-08-18) e le azioni globali (Collection: tab/filtri/ricerca/export
ZIP/preview; ActionBar save/export; login/settings) funzionano e sono
coerenti? Checklist per superficie: ogni azione ha effetto + feedback;
stati vuoti coerenti; responsive; stessi pattern UI (bottoni, toast,
rail AI). Output: problemi + fix o ticket derivati.

## Resolution

Chiuso 2026-08-18. Esito: **verde, nessun issue P0-P1**.

- Preventivo (EditorView): rail AI destra (AIHarnessConsole), tab
  AI/Manuale, preview, mobile bottom bar + editor-mobile-panel custom
  (non il drawer condiviso, mappato in ai-rail-scroll/screenshots).
- QR: 7 tipi, export PNG/SVG con success/error toast, save-guard
  "Compila almeno il payload", template Giovanni, reset con toast,
  free-tier guard, logo overlay validato (mime + size).
- Social: empty state "Nessun documento sorgente" con CTA (Crea
  bigliettino/volantino), sourceId guard, generazione post con toast,
  caption copy to clipboard, immagini post (2026-08-18) con loading
  per-post e download.
- Collection: tab/filtri (stato, data, ordina)/ricerca/selection bulk/
  delete bulk/rename/preview SVG/export ZIP, empty state per-tab
  (Nessun documento ancora + CTA), bulk download immagini solo nel tab
  immagini, toast su ogni azione.
- ActionBar: cluster fisso bottom-right desktop, sticky mobile, Escape/
  click-outside chiude menu, menuitem role; usato da logo/QR/website.
- Settings: tab account/security, validazione (campi obbligatori,
  password non coincidenti, requisiti), redeem code con busy state,
  message success/error inline.
- A11y: tablist/aria-label, toolbar role, empty-state role=status.

Ticket derivato (design system, da T1/T2): advisory detector ~100
(font-size/colori/radius hardcoded nei CSS editor) — pattern sistemico
pre-token. Non bloccante; azione quando si introduce DESIGN.md tokens:
`c06-design-tokens-editor.md` (vedi mappa Decisions so far).
