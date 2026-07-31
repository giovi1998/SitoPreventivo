# Done — Quickbrand

Colonna "Done" della kanban. Dettaglio tecnico: `agent-gotchas.md`
(sezioni indicate per voce). Storico completo: git history.

## 2026-07-31

- **Audit responsiveness + migrazione breakpoint canonici** (spec:
  `docs/spec/spec-design-breakpoint-migration.md`): tutti i breakpoint
  storici (900/899/880/1100/1180*/1200/1279/1400/768/760/680/640/600)
  migrati ai canonici `max-width:767px` / `max-width:1023px`
  (*mantenuti: `@1180` topbar btn-label, `@480` eccezione small-phone
  documentata). Fix: dead zone nav 769–900px (shell switch unificato a
  1023: sidebar hide + mobile-topbar show + `.topbar{display:none}`,
  niente doppia header); `Layout.tsx` sidebar/drawer in conditional
  render via `useIsMobileWorkspace()`; `CardEditorShell` hook 900 →
  `useIsMobileWorkspace()`; `.editor-col` → `clamp(280px,30vw,380px)`
  (gradini 1400/1200 eliminati); flyer dead zone 768–899 (blocco mobile
  bar a 1023) + `FlyerPreview` auto-fit ResizeObserver (pattern
  `CardPreviewSurface`); `LogoAiPanel.css` primo blocco `@767`
  (concept 1col, variants menu full-width); AdminDashboard nth-child
  hiding eliminato → scroll orizzontale; `crm.css` palette grid
  `minmax(min(340px,100%),1fr)`. Micro-fix taste: em-dash in copy
  HomePage, tagline LoginPage aggiornata (brand kit, non solo
  preventivi), gate `prefers-reduced-motion` per `auth-dot`.
  Test: 4 unit aggiornati/nuovi (Layout.mobile-shell, useMediaQuery
  costanti, FlyerPreview auto-fit, CardEditor.responsive 1023) + nuovo
  `e2e/breakpoints.spec.ts` (7 test AC-001..007). Gate:
  typecheck + vitest + e2e regressioni (layout-mobile, card parity,
  topbar) verdi. Gotcha §6 aggiornato.

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
- **CardEditorShell batch 1**: estratti `useCardPromptLibrary` +
  `useCardAiImages` da `CardEditorShell.tsx` (1281 → 1121 righe), 26 test
  nuovi. Shell test invariato e verde. Seams residui in to-be-done.
- **Fix icona AI**: `useAIIconHero` chiedeva `size: '1K'` → PNG >500KB →
  413 clamp server (gotcha §2-3 impone `'512'`). Ora `'512'`. Aggiunto
  `saveGeneratedImage` (mancava: l'icona era l'unica immagine AI non
  persistita → tab Collection "Immagini Generate" sempre vuota). 3 test.
- **Fix preview generatedImage in Collection**: `hydrateDocument` non
  riconosceva `imageData` come chiave flat-domain → il doc veniva
  annidato sotto `data` e la preview spariva (bug latente, emerso ora
  che le icone AI si salvano). Regression test in
  `dataService.documents.test.ts`. I record esistenti si sistemano da
  soli (fix in lettura).
- **Fix UI Collection/logo**: thumb `generatedImage` `objectFit: cover` →
  `contain` (nel tab a 1 elemento la card full-width tagliava l'icona a
  una fetta ingrandita); `<p>` → `<div>` wrapper AIProviderBadge in
  LogoAiPanel (warning validateDOMNesting).
- **Riorganizzazione docs** (utente): spec → `docs/spec/`,
  `AI_ARCHITECTURE.md` e `to-be-done.md` → `docs/`;
  `docs/post-tb023-known-issues.md` e `docs/tb023-verification.md`
  eliminati (recuperabili in git history). Riferimenti aggiornati in
  AGENTS.md/README/scripts. Regola kanban: task completato → da
  `to-be-done.md` a questo file, stessa sessione.

- **TB-027h** Storage locale canonico FLAT logo/card/flyer; fix Collection
  non aggiornata dopo "Genera bozze AI" (gotchas §23).
- **CardEditorShell batch 2**: estratti `useCardGridEditor`,
  `useCardBackContent`, `useCardAutoSave` (+ `cardHasContent`/
  `defaultCardTitle`) e `<CardFormSections>` — shell 1121 → 658 righe.
- **CustomerDetail split**: estratti `CustomerAiLogPanel`,
  `CustomerResearchSection`, `CustomerWebDataPanel` + hook
  `useCustomerLogger` (~840 → 766 righe).
- **LogoAiPanel split**: estratti `src/components/logo/ConceptCard.tsx` e
  `src/utils/logo/logoAiPersistence.ts` (chiavi per-doc, TTL 24h, quota
  fallback senza bgImages).
- **Fix leak stato AI tra documenti (LogoEditor)**: `aiStateRef` ora
  taggato con `docId`; il remount intermedio del pannello (chiave
  `resetKey-docId`) non eredita più la chat del documento precedente.
  Regression test esistente ("doc A → doc B") tornato verde.
- **Componenti flyer "orfani": verificato NON orfani** — tutti e 5
  cablati in `FlyerManualPanel` (layout dello spec TB-007). Rimossi dal
  debito tecnico.
- **Test harness**: fixture e2e condivise (`e2e/fixtures/`: `testUser`
  aggiunto, `adminUser`/`freeUser`/`unlockedUser`, `giovanniTemplate`,
  `sampleFlyer`, `sampleQuote`) cablate in `cardHarness` (24 spec) +
  admin/ai-log-preview/url-routing/home/flyer-visual;
  `api/__tests__/setup.ts` (`createMockDrizzleDb`, 6 consumer); reset
  globale localStorage/sessionStorage in `src/test-setup.ts`
  (`beforeEach`, guard per environment node); script `test:e2e:ci` in
  package.json; **`npm run test` ora include `--coverage` con threshold
  60% globali** in `vitest.config.ts` (misurato: 68.5 stmts / 62.4 branch
  / 65.1 funcs / 70.5 lines — costo runtime ~nullo, 451s vs 455s).
  `createMockProvider` centralizzato valutato ed **eliminato**: zero
  consumer, shape senza `supportsTools`; i mock inline per-orchestratore
  (chunk `AIStreamChunk`, code di risposte per-test) restano superiori.
- **Fix test stale/flaky**: `home.spec.ts` CTA anon allineate al flag
  `VITE_REGISTRATION_ENABLED=false` (TB-027, attese `/login` o
  `/login?register=1`); `cardGenerator.test.ts` "handles all 3 size
  presets" timeout 15s → 60s (3 PDF in loop, flaky solo sotto carico di
  suite intera).
- **Fix prod CRM**: query string malformata in `getCustomers`/
  `getIntakes` senza filtro status (`/customers&adminEmail` → 404, ora
  `URLSearchParams`); timeout `api()` default 5s troppo corto per
  `research` (Firecrawl fino a 120s → abort client + slot rate-limit
  orario consumato) → 130s, e `ai-fill` → 60s. Regression test
  `dataService.crm.test.ts` (URL 4 casi + timeout estesi).
- **TB-010**: `parseCardSvg` + `assertInside` aggiunti a
  `card-grid-export-roundtrip.spec.ts` → copertura 8/8 file e2e.

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
