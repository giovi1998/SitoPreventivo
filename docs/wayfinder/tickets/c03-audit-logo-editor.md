# T3 - Audit logo editor (azioni + layout)

## Question

Tutte le azioni del logo editor funzionano (builder manuale, AI 3-step,
concept card, export 9 formati, upload background) e il layout è
coerente? Checklist: ogni controllo ha effetto; stati loading/error/
empty (placeholder mai salvato come successo, §27); toast; responsive;
persistenza chat AI (TTL 24h). Output: problemi + fix o ticket derivati.

## Resolution

Chiuso 2026-08-18. Esito: **verde, nessun issue P0-P1**.

- Funzionale: save-guard `logoHasContent` ("Compila almeno il testo o
  l'icona"), export 9 formati (SVG/PNG 512-2048/PDF/JPG/ICO/FaviconZIP)
  con toast success e compressDataUrl pre-save (path-aware §2.5),
  verify/repair backdrop/colori con toast, placeholder mai salvato come
  successo (guard §27).
- Layout: tabs Builder/AI, LogoAiPanel in flusso (tab AI) sia desktop che
  mobile — pattern custom coerente.
- Persistenza: chat AI per-doc con TTL 24h (logoAiChat:v1:<docId>).
- Responsive: AC-006 (375px, no overflow orizzontale) verde.
- A11y: tab role, concept card aria-label, AI bg badge.
- Advisory detector: 0 finding su LogoEditor.tsx.
