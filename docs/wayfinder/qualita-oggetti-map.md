# wayfinder:map — Qualità output card/flyer/logo

## Destination

Qualità degli oggetti **card / flyer / logo** verificata **live** e
migliorata: script di verifica allineati al codice corrente (merge
2026-08-13: `image_size` 1K uniforme, clamp 1MB, Nano Banana 2 Lite,
niente `image_output_options`), run live su cliente demo "La Chiccheria"
con report verde, problemi visivi trovati fixati, residui tipografici
§27.1 chiusi o ticketati. Deciso con l'utente il 2026-08-13
(opzione "Verifica live + fix guidati").

## Notes

- Dominio: generatori client-side card/flyer/logo + endpoint Gemini
  (`src/server/ai.ts`), preview/export SVG/PNG, tipografia
  (`docs/design-criteria.md`, gotchas §27).
- **Esecuzione in-sessione autorizzata**: l'utente ha scelto di portare
  l'esecuzione dentro questa mappa (override di "Plan, don't do") —
  i ticket task si risolvono nella stessa sessione, uno alla volta.
- Chiamate AI live autorizzate dall'utente (Gemini/Ollama reali,
  ~€0.20-0.50, dev server locale).
- Skill da consultare: `lean-code` (ogni fix), `pdf-client-side`
  (export), gotchas §2.5/§6/§27 prima di toccare i moduli.
- Script di riferimento: `scripts/ai-image-quality-verify.mjs` (check
  automatici, exit 0/1), `scripts/design-review-ai-gen.mjs` (screenshot
  preview/export + contact sheet `compare/`).
- Kanban correlata: `docs/to-be-done.md` task "Verifica visiva modifiche
  AI" e #2 "Immagini AI pixelate (residuo: verifica Playwright)".

## Decisions so far

<!-- una riga per ticket chiuso: titolo link + gist -->

- [T1 — Allineare gli script di verifica al codice merged](tickets/t01-allinea-script-verifica-codice.md) — soglie persistite → 1000 uniforme (1K gen + cap 1024/1536), header/stop-rule aggiornati al probe 2026-08-07; design-review-ai-gen confermato (soglie export-side).
- [T5 — Clamp 1MB troppo stretto: logo-background 16:9 va in 413](tickets/t05-clamp-1mb-stretto-16-9.md) — clamp 1MB→1.2MB (core+proxy+messaggi+test), 413 intermittenti risolti, verificato live Phase A 4/4.
- [T2 — Eseguire la verifica live su "La Chiccheria"](tickets/t02-esegui-verifica-live-chiccheria.md) — ALL CHECKS PASS; catena di bug live fixati (proxy tool_calls droppati + normalizzazione history, agent docs `{}`, include card, logo selected:-1, data shape wrapped, script profile/timeout/login).
- [T6 — Agent mode non genera immagini AI](tickets/t06-agent-mode-immagini-ai.md) — `enrichAgentDocWithImages` (logo bg+card photo/cover+flyer hero) + compressione saveDraft path-aware 1536/1024 (era 768 piatta); live: tutte persistite ≥1000.
- [T3 — Review report + contact sheet, decidere i fix](tickets/t03-review-report-contact-sheet.md) — card/flyer OK; trovato+fixato pill textBackdrop disallineata su horizontal+bgImage (anchor middle); regression test.
- [T4 — Residui tipografici §27.1/§27.4 card e logo](tickets/t04-residui-tipografici-card-logo.md) — safe margin wontfix-migrazione, socials 16px ok (7pt = domanda aperta), thumbnail front-only wontfix YAGNI, no-grid congelato legacy.
- [T7 — 502 /api/ai/embeddings: SDK ritorna `embeddings[]` plurale](tickets/t07-embeddings-502-sdk-plurale.md) — parsing singolare→plurale+fallback in 3 siti (ai.ts, crm.ts, dev proxy); live 200.
- [T8 — Card non centrata in agent mode + website editor mobile rotto](tickets/t08-grid-centering-website-mobile.md) — `buildCardDraftPrompt` condiviso (agente+auto-build), `ensureCardGrid` (grid derivata, useGrid su entrambi i lati), null-safety `gridElements`, `useDocumentLoader` null + fallback "Sito non trovato", website editor mobile (viewport 375px, tab preview, grid stack @1023px); guardia AC-007.
- [T9 - Guardia anti-regressione permanente: soglie asset/tipografiche in CI](tickets/t09-guardia-qualita-asset-ci.md) - `e2e/ai-image-quality-guard.spec.ts` (4 test fixture-based, zero AI) porta le soglie Phase B dello script manuale nel gate critico (28/28): gerarchia card, floor contatti/flyer, ratio tagline logo, immagini persistite >=1000px.

## Not yet specified

- **Fix emergenti dalla verifica live**: T8 chiuso 2026-08-14 (card
  centrata + website mobile); nessun altro aperto.
- **Socials/services retro a 7pt pieno (19px)**: da v2.19 sono a 16px
  (6pt). Alzare base+floor a 19px = +19% di ingombro: tradeoff design da
  decidere con l'utente (criterio `design-criteria.md` 7pt contatti vs
  densità informazione retro).
- **Grid v3 a coordinate relative**: sbloccherebbe il safe margin 4mm
  (30px) senza migrare a mano i documenti esistenti. Candidato futuro.
- **Verifica "Genera bozze AI" in PROD** (to-be-done #3): molti dei
  blocker trovati qui erano dev-only (proxy), ma il fix Zod max_tokens
  (faacc42) e l'agent wiring vanno validati live in produzione.

## Out of scope

- Website builder (qualità pagine secondarie, verify agent): effort
  separato, backlog dedicato in to-be-done.
- Langfuse follow-up (costi DeepSeek/Ollama): altra mappa
  (`langfuse-agentic-map.md`).
- Flussi CRM end-to-end (card/logo "flusso completo in clienti"):
  coperti dalla kanban, non da questa mappa.