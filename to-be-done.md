# To Be Done — Quickbrand

Colonna "To do" della kanban. Completati → **[docs/done.md](docs/done.md)**.

## 🔴 Da fare (prodotto)

- [ ] **Card flusso completo in clienti**: auto-build → Genera bozze AI →
  preview/editor senza errori quota/JSON/vision. Verificare E2E con
  Playwright su cliente reale.
- [ ] **Logo flusso completo in clienti**: upload manuale → propagazione a
  card/flyer → generazione AI con background persistente (no strip quota).
- [ ] **Creazione oggetti senza clienti**: flusso standalone (Collection →
  Nuovo) deve restare invariato e funzionante dopo le modifiche CRM.
- [ ] **RAG avanzato**: usare `customer_knowledge` (chunk Firecrawl) con
  embedding `gemini-embedding-2` per retrieval contestuale negli orchestratori.
- [ ] **Miglioria caricamento immagine logo in clienti**: preview persistente
  anche dopo navigazione, compressione ottimale, opzione "usa questo logo
  ovunque" (card/flyer/logo).
- [ ] **TB-027h follow-up**: verifica end-to-end flusso CRM auto-build in
  PROD (envelope jsonb → `hydrateDocument`, mai provato live). Record
  legacy doppia-shape in localStorage: si sanano al primo save; se serve,
  migrazione one-shot da console (snippet in gotchas §23).
- [ ] **TB-009 residuo**: conferma una tantum costi reali Gemini in
  dashboard Google AI Studio / GCP billing al primo volume produttivo
  (i `perImage` in `providerPricing.ts` sono stime conservative). No codice.

## 🟡 Debito tecnico / refactor

- [ ] **`dataService.js` (1322 righe)**: 4 domini (auth / documenti /
  CRM-intakes / image compression) in un file, 44 branch `IS_LOCAL`.
  Split in moduli `.js` (vincolo test CJS, gotchas §23) + helper
  `localOrApi`. Facade per non toccare gli import.
- [ ] **`documentSchemas.ts` (1315 righe)**: 6 tipi documento in un file.
  Split per tipo in `schemas/` (card + grid preset separati), facade.
- [ ] **`CardEditorShell.tsx` (~1170 righe)**: god component. Estrarre
  hook `useCardAiImages` + `useCardPromptLibrary`; target <600 righe.
- [ ] **`CustomerDetail.tsx` (~840 righe)**: estrarre research/webData
  panel e log helpers in sub-componenti/hook.
- [ ] **`LogoAiPanel.tsx` (~520 righe)**: estrarre `ConceptCard` e
  persistenza stato in file propri.
- [ ] **Componenti flyer orfani** (`FlyerContentFields`, `FlyerExportActions`,
  `FlyerFormatControls`, `FlyerLayoutControls`, `FlyerTemplatePicker`):
  nessun import — sono il layout previsto dallo spec TB-007
  (`spec-design-flyer-refactor-preview-ai.md`). Cablare o cancellare
  quando lo spec evolve.
- [ ] **Test harness** (da vecchia gap analysis):
  - fixture builders e2e condivisi (`e2e/fixtures/`: giovanniTemplate,
    sampleFlyer, sampleQuote, adminUser/freeUser/unlockedUser);
  - `api/__tests__/setup.ts` comune (mock Drizzle standardizzati);
  - mock provider centralizzato in `src/ai/__mocks__/` (`createMockProvider`);
  - reset globale chiavi localStorage in `beforeEach` (`test:db`);
  - coverage `--coverage` in `npm run test` + threshold 60% su `src/`;
  - script `test:e2e:ci` (playwright seriale `--workers=1`) in package.json.
- [ ] **TB-010** Estensioni `cardHarness` e2e (verifica copertura
  `parseCardSvg` sugli 8 file e2e).

## 🟢 Backlog business (da `docs/business-plan.md`)

Ordine: validazione → portfolio → monetizzazione.

- [ ] **TB-022** Privacy policy + cookie banner (~3h). Serve prima
  dell'outreach (form intake raccoglie PII).
- [ ] **TB-017** Landing vendita Apertura €349 (~4h, solo copy/struttura).
- [ ] **TB-018** Portfolio 5 esempi settore (8-10h) — DEFERRED, trigger:
  1 cliente reale in outreach.
- [ ] **TB-011** Stripe Checkout + subscription Pro (spec parziale in
  `spec-api-saas-monetization.md`; trigger: 15+ transazioni/mese).
- [ ] **TB-012** Landing page generator interno (~40h step 2: da flyer →
  HTML statico → ZIP; NO builder self-service). Step 3 (publish 1-click
  `nome.quickbrand.it` via Vercel API, ~80h) solo dopo 5+ siti/mese.
  **Priorità utente 2026-07-30**: il sito per clienti è un obiettivo
  confermato — valutare di anticipare rispetto al backlog.
- [ ] **TB-013** QR menu ristoranti (~15h).
- [ ] **TB-014** Google Business Profile helper (~10h).
- [ ] **TB-015** Multi-lingua EN/DE export (~20h).
- [ ] **TB-016** Meta Ads test €300 (dopo 5 consegne reali).
- [ ] **TB-020/021** P.IVA (dopo 2 clienti paganti o €5k/anno) →
  fatturazione elettronica (> €30k/anno).
- [ ] **TB-028** Vision auto-generazione brand kit (~60h; prereq: TB-027
  stabilizzato in prod). Pipeline: scraper etico sito (robots.txt, no SSRF
  SEC-003) → RAG `customer_knowledge` (embedding) → modello vision
  (Gemini/MiniMax M3) → 3 draft logo/card/flyer/palette già popolati.
  Endpoint `/customers/:id/auto-generate` rate-limit 1/giorno, admin review
  obbligatoria. Costo ~$5-20/mese a volume basso. Rischio: qualità
  immagini AI per brand reali → gating umano + fallback placeholder.
- [ ] **Fase 5 collaborazioni** (post 3-5 clienti con stampa): partnership
  tipografie (no esclusiva), collaboratori vendita solo rev-share
  (no equity — vedi "Esclusi" sotto).

## ⛔ Esclusi deliberatamente (non riproporre senza nuova domanda)

- **Marketplace template community**: niente domanda, complessità alta.
- **Chatbot clienti**: scope creep, nessun cliente l'ha chiesto.
- **App mobile nativa**: la webapp mobile è sufficiente.
- **Website builder generico self-service**: guerra persa vs
  Durable/10Web/Framer AI (BP §B).
- **Equity a collaboratori esterni**: app e brand restano proprietà
  esclusiva; solo rev-share o fee a progetto (BP §F).

---

Storico dettagliato dei task completati: `docs/done.md` +
`docs/agent-gotchas.md`. Il vecchio `docs/to-be-done.md` (gap analysis
2026-07-18) resta recuperabile in git history (`git show HEAD:docs/to-be-done.md`).
