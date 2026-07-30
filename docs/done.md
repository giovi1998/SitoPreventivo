# Done — Quickbrand

Colonna "Done" della kanban. Dettaglio tecnico: `agent-gotchas.md`
(sezioni indicate per voce). Storico completo: git history.

## 2026-07-30

- **Refactor strutturale batch 1**: split `logoGenerator.ts` →
  `utils/logo/svgBuilder.ts` + `utils/logo/exporters.ts` (facade), split
  `card/svgRenderer.ts` → `frontSvg.ts`/`backSvg.ts`/`fontEmbed.ts`/
  `svgShared.ts` (facade), `escapeXml` deduplicato in `utils/xml.ts`,
  `ai/index.ts` rinominato `ai/quoteOrchestrator.ts`, dead code rimosso
  (`quoteAdapter.ts`, `constants.js`), vecchio `docs/to-be-done.md`
  (gap analysis 2026-07-18) consolidato in kanban.
- **Refactor strutturale batch 2**: split `dataService.js` (1322) →
  facade + `dataService/` (core, auth, documents, settings, ai, crm,
  images — solo `.js` per vincolo CJS gotchas §23); split
  `documentSchemas.ts` (1315) → facade + `schemas/` (shared, qr, card,
  logo, flyer, social). API pubbliche invariate, export list identiche.
- **Fix tainted canvas**: `inlineSvgExternalImages` in
  `utils/ai/compressForAI.ts` — immagini http(s) dentro SVG → inline data
  URL prima del raster (hero flyer con URL remota bloccava `toBlob` con
  `SecurityError`, screenshot AI saltava). 5 regression test.
  Gotcha §7.0.
- **Riorganizzazione docs** (utente): spec → `docs/spec/`,
  `AI_ARCHITECTURE.md` e `to-be-done.md` → `docs/`;
  `docs/post-tb023-known-issues.md` e `docs/tb023-verification.md`
  eliminati (recuperabili in git history). Riferimenti aggiornati in
  AGENTS.md/README/scripts. Regola kanban: task completato → da
  `to-be-done.md` a questo file, stessa sessione.

- **TB-027h** Storage locale canonico FLAT logo/card/flyer; fix Collection
  non aggiornata dopo "Genera bozze AI" (gotchas §23).

## 2026-07-29

- **TB-027c** briefContext negli orchestratori, sequenza "Genera bozze AI"
  CRM, logo status load fix, embedding `gemini-embedding-2` (gotchas §18).
- **TB-027e** dev proxy Ollama M3, research errori/immagini/colori,
  ai-fill AI reale, flyer text-only, auto-build dedupe, dataService
  SSR-safe (gotchas §20).

## 2026-07-28

- **TB-027** CRM + auto-research + auto-build: tabella `customers`,
  flag `REGISTRATION_ENABLED`, CRM UI, Firecrawl scraping →
  `customer_knowledge`, AI gap-filling, auto-build draft logo/card/flyer
  (gotchas §17, spec `spec/spec-architecture-crm-auto-build.md`).
- **TB-019** Intake pipeline → porta ingresso CRM: tabella `intakes`,
  `/api/intake` pubblico, IntakeList in CRM, intake → record cliente
  (spec `spec/spec-intake-pipeline.md`).

## 2026-07-27

- **TB-023** Harness AI unificata (useAIHarness + AIHarnessConsole),
  multi-provider registry, 5 pattern decorativi SVG + DecorationPicker,
  drag foto grid-mode + wheel scale, icona AI 1K e2e (gotchas §14,
  verifica in git history, file eliminato 2026-07-30).
- **TB-024** Export logo multi-formato: PDF vettoriale, favicon ZIP, ICO,
  JPG sfondo, SVG ottimizzato (gotchas §14).
- **TB-025** Collection preview SVG inline logo/card/flyer/quote
  (gotchas §15).
- **TB-026** Cost tracker per-document `aiStats` + badge Collection
  (gotchas §16).
- **TB-004** Test helper `backgroundImage.ts` (logo).
- **TB-005** Test cardCover client (`aiCoverImage.test.ts`).
- **TB-006** Audit condivisione componenti UI (`audit-ui-components.md`).
- **TB-007** Test flyer refactor: matrice 10/10.
- **TB-008** README privacy/GDPR disclosure.
- **TB-009** Verifica costi Gemini (stime documentate, cost tracker live).

## 2026-07-18 e precedenti

- **TB-001** Wiring `ToolAwareOrchestrator` end-to-end (card/flyer/quote).
- **TB-002** Test server 4 endpoint Gemini (`cardCover`, `logoBackground`,
  `flyerHero`, `cardPhoto`) con harness `api/__tests__/helpers/apiTest.ts`.
- **TB-003** Flyer hero: `FlyerAiPanel` unico entry point AI.
- **Fasi 0-10, 12-15** roadmap originale (preventivi, QR, card, logo,
  flyer, polish, AI-first UX redesign) — tabella completa in gotchas §10.
- Spec completati e cancellati da `spec/` (traccia in git history):
  ai-assist-unification, card-context-aware-cover, card-text-vision-split,
  card-vision-input, flyer-hero-image, flyer-vision-grounded-hero,
  logo-vision-grounded-background, card-grid-layout-event-audit,
  logo-text-auto-positioning, tool-ai-card-flyer-tools,
  ai-first-ux-redesign, ai-harness-upgrade.
