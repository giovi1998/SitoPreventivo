# Done — Quickbrand

Colonna "Done" della kanban. Dettaglio tecnico: `docs/agent-gotchas.md`
(sezioni indicate per voce). Storico completo: git history.

## 2026-07-30

- **Refactor strutturale** (questa sessione): split `logoGenerator.ts` →
  `utils/logo/svgBuilder.ts` + `utils/logo/exporters.ts` (facade), split
  `card/svgRenderer.ts` → `frontSvg.ts`/`backSvg.ts`/`fontEmbed.ts`/
  `svgShared.ts` (facade), `escapeXml` deduplicato in `utils/xml.ts`,
  `ai/index.ts` rinominato `ai/quoteOrchestrator.ts`, dead code rimosso
  (`quoteAdapter.ts`, `constants.js`), `docs/to-be-done.md` consolidato
  in questo file + root `to-be-done.md`.

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
  (gotchas §17, spec `spec-architecture-crm-auto-build.md`).
- **TB-019** Intake pipeline → porta ingresso CRM: tabella `intakes`,
  `/api/intake` pubblico, IntakeList in CRM, intake → record cliente
  (spec `spec-intake-pipeline.md`).

## 2026-07-27

- **TB-023** Harness AI unificata (useAIHarness + AIHarnessConsole),
  multi-provider registry, 5 pattern decorativi SVG + DecorationPicker,
  drag foto grid-mode + wheel scale, icona AI 1K e2e (gotchas §14,
  verifica `docs/tb023-verification.md`).
- **TB-024** Export logo multi-formato: PDF vettoriale, favicon ZIP, ICO,
  JPG sfondo, SVG ottimizzato (gotchas §14).
- **TB-025** Collection preview SVG inline logo/card/flyer/quote
  (gotchas §15).
- **TB-026** Cost tracker per-document `aiStats` + badge Collection
  (gotchas §16).
- **TB-004** Test helper `backgroundImage.ts` (logo).
- **TB-005** Test cardCover client (`aiCoverImage.test.ts`).
- **TB-006** Audit condivisione componenti UI (`docs/audit-ui-components.md`).
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
