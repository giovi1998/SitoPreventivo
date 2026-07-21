# To Be Done — Gap analysis spec ↔ codebase

Snapshot 2026-07-18. Cross-check degli spec in `spec/` con
l'implementazione attuale di `src/`, `api/`, `e2e/`.

> **Cleanup 2026-07-18**: gli 8 spec marcati DONE qui sotto sono stati
> **cancellati da `spec/`** dopo verifica (traccia in git history).
> **Cleanup 2026-07-18 (sera)**: anche `spec-design-ai-first-ux-redesign.md`
> (fasi 12-14) è stato cancellato dopo completamento — vedi riga spec #14.
> Spec attivi: `spec-design-flyer-refactor-preview-ai.md` (gap TB-007),
> `spec-api-saas-monetization.md` (NOT-STARTED, track futuro).

## Legenda stato

- **DONE** — tutti i REQ funzionali coperti, test verdi
- **PARTIAL** — parte implementata, gap specifici elencati
- **NOT-STARTED** — solo spec scritta, nessun codice/test
- **SUPERSEDED** — sostituito da spec successivo (vedi footer)

---

## Stato per spec

| # | Spec | Stato | Note |
|---|------|-------|------|
| 1 | `spec-ai-assist-unification.md` | **DONE** | Hero flyer spostato SOLO in `FlyerAiPanel`; manual panel mostra solo upload manuale. Audit UI rimane in backlog (TB-006). |
| 2 | `spec-design-ai-card-context-aware-cover.md` | **DONE** | `cardImage`+`logoImage` end-to-end |
| 3 | `spec-design-ai-card-cover-image.md` | **SUPERSEDED → 2** | Sostituito da spec vision-grounded |
| 4 | `spec-design-ai-card-text-vision-split.md` | **DONE** | Architettura isolata, buildCardAIContext già striscia base64 |
| 5 | `spec-design-ai-card-vision-input.md` | **DONE** | Multimodal Gemini immagini di riferimento |
| 6 | `spec-design-ai-flyer-hero-image.md` | **DONE** | Endpoint, hook, heroImage persist |
| 7 | `spec-design-ai-flyer-vision-grounded-hero.md` | **DONE** | Endpoint `/ai/flyer-hero` coperto da `api/__tests__/flyerHero.test.ts` (text-only, image, aspect ratio, 413, 429, 504) |
| 8 | `spec-design-ai-logo-vision-grounded-background.md` | **DONE** | Endpoint `/ai/logo-background` coperto da `api/__tests__/logoBackground.test.ts` |
| 9 | `spec-design-card-grid-layout-event-audit.md` | **DONE** | Harness, events, audit, WYSIWYG, 8 e2e file migrati |
| 10 | `spec-design-flyer-refactor-preview-ai.md` | **DONE** (gap storico noto) | 12/12 utils + 11/11 components, test 4/10 (vedi AGENTS §11) |
| 11 | `spec-design-logo-text-auto-positioning.md` | **DONE** | `hasBgImage` + `textColorMode` + `textBackdrop` + `unionTextBox` |
| 12 | `spec-tool-ai-card-flyer-tools.md` | **DONE** | `ToolAwareOrchestrator` wired end-to-end in `AIOrchestrator`, `CardAIOrchestrator`, `FlyerAIOrchestrator`; test tool path e fallback verdi. Gap residuo UI: callback `onToolStart/Complete` non passati da `useAICard` → assorbito in REQ-LOG-001 spec #14 |
| 13 | `spec-api-saas-monetization.md` | **NOT-STARTED** | Zero Stripe/api-key in `api/` (verificato 2026-07-18). Track futuro separato, mantenuto in `spec/` |
| 14 | `spec-design-ai-first-ux-redesign.md` | **DONE** | Fase 12 ✅ (useAILogs, 6 hook migrati, AILogEntry v2, trackUsage ESM, IMAGE_TOKEN_COST, X-Request-Id, ghost rate limit fix). Fase 13 ✅ (ToastProvider, token The Classic + purge teal/blu, ai-ui.css, ActionBar logo/QR, sidebar gruppi + pq_ui:v1, breakpoint canonici, font lazy, copy AI-first, HomePage AIDA + motion). Fase 14 ✅ (AIConsole rail in social/flyer/card/quote, logo tab AI-first, AIProviderBadge, suggestedPrompt doc vuoto, onboarding AI-first). Deviazioni documentate in AGENTS.md §13-14. Spec cancellato dopo verifica (185 file, 2177 test verdi). |
| 15 | `spec-design-ai-harness-upgrade.md` | **NOT-STARTED** | TB-023. Multi-provider (Ollama Pro $20/mo flat + MiniMax M3 multimodale + Gemini 2.0 Flash), tracking costi reale, 5 pattern decorativi SVG, drag foto card grid-mode, icone stilizzate AI, RAG clienti (pgvector), A/B provider, vision feedback screenshot. ~45h, sprint 2-3. |

---

## Triage per priorità

### 🔴 P0 — Bloccante produzione / impatta costi

#### TB-001 Wiring `ToolAwareOrchestrator` end-to-end ✅ COMPLETED
- **Spec**: #12 (tool-ai-card-flyer-tools.md) REQ-003/004/005/006
- **Implementato**: `ToolAwareOrchestrator<T>` aggiunto a `BaseOrchestrator.ts`;
  `AIOrchestrator`, `CardAIOrchestrator`, `FlyerAIOrchestrator` estendono la
  classe generica; tool registrati e multi-turn con tool funzionante.
- **Test**: `cardOrchestrator.test.ts` e `flyerOrchestrator.test.ts` includono
  caso tool path e no-tool fallback.
- **Commit/PR**: pronto per push dopo verifica typecheck+test.

#### TB-002 Test server `cardCover`, `logoBackground`, `flyerHero`, `cardPhoto` ✅ COMPLETED
- **Spec**: #2/5/7/8 (tutte le vision-grounded) §6
- **Implementato**: 4 nuovi test in `api/__tests__/` con shared harness
  `api/__tests__/helpers/apiTest.ts` che mocka Drizzle + GoogleGenAI.
- **Casi coperti**: text-only vs parts input, grounding, 500KB clamp,
  rate-limit 429, copyright filter 400, timeout 504, aspect ratio.

#### TB-003 Flyer hero bottone in MANUAL panel (contro REQ-020 spec #1) ✅ COMPLETED
- **Spec**: #1 REQ-020/REQ-007 + V-007
- **Implementato**: rimosso bottone "Genera hero AI" da `FlyerManualPanel`;
  ora mostra solo upload manuale + rimando "usa il pannello AI Assist".
  `FlyerAiPanel` è il single entry point. Test `FlyerManualPanel.test.tsx`
  e `FlyerAiPanel.test.tsx` aggiornati e verdi.

---

### 🟡 P1 — Quality / coverage gap

#### TB-004 Test helper `backgroundImage.ts` (logo)
- **Spec**: #8 REQ-002/003/004 + §6
- **Gap**: `src/utils/logo/backgroundImage.ts` ha
  `renderLogoScreenshot`, `compressPreviousBackground`,
  `buildLogoBackgroundPayload`. **Nessun test file**.
  `compressForAI.test.ts` esiste come helper, ma la composizione
  specifica del logo no.
- **Test da creare**: `src/utils/logo/__tests__/backgroundImage.test.ts`
  - `renderLogoScreenshot` ritorna data URL quando `builderToSvg` OK
  - `renderLogoScreenshot` ritorna undefined quando builder vuoto (no text)
  - `compressPreviousBackground` ritorna undefined quando `backgroundImage` null
  - `buildLogoBackgroundPayload` include `logoImage` + `previousBackground` se presenti
  - Body-size fallback (AC-004 spec #8): drop `previousBackground` prima, poi `logoImage`

#### TB-005 Test `cardCover.test.ts` lato client
- **Spec**: #2 §6, #5 §6
- **Gap**: `useAICard.test.ts` testa `generateCover` ma
  `buildCoverRequest` (REQ-005 spec #2) non esiste come unit isolata.
  La composizione payload + fallback body-size non è testata in
  isolamento.
- **Test da creare**: `src/utils/card/__tests__/aiCoverImage.test.ts`
  - `buildCoverRequest` ritorna `{ prompt, context, cardImage, logoImage, side }` corretto per AC-002/003/004
  - Body-size fallback: drop logoImage prima, poi cardImage, poi text-only
  - `compressForAI` re-encodes 1MB PNG → JPEG < 400KB

#### TB-006 Audit condivisione REQ-040/041 (spec #1)
- **Spec**: #1 AC-040 — "produce documento che elenca minimo 5 pattern
  duplicati con proposta di astrazione per ciascuno"
- **Gap**: `doc/audit-ui-components.md` non esiste.
  **Stato noto** (analisi statica di questa sessione):
  1. **Font picker**: estratto ✅ in `ai-ui/AiFontPicker.tsx`
  2. **Color picker**: vedo usi sparsi (`CardStyleFields`, `FlyerStyleFields`, `BuilderPanel`, `EditorView`) ma nessun `AiColorPicker` centralizzato
  3. **Tier guard**: esiste `AiTierGuard` in `ai-ui/` ma `CardFormFields`/`FlyerManualPanel`/logo AI fanno check `tier === 'unlocked'` inline (vedi `FlyerManualPanel.tsx:234` vs `FlyerAiPanel.tsx:100`)
  4. **AI panel "section + tier guard + helper text" pattern**: replicato 5+ volte (card, flyer, logo, social, onboarding) — potrebbe diventare composable unico
  5. **Prompt library** (salva/applica/elimina brief AI): replicato in `LogoAiPanel` (logo) e `FlyerEditorShell` (flyer hero) — stessa shape `PromptLibraryEntry`, due storage separati
  6. **Hero upload + preview + remove**: replicato 2x (card photo + flyer hero)
- **Impatto**: 5 pattern duplicati, ma con scope e API diversi. La
  priorità è fare un documento di audit + identificare quale estrarre
  per prima. Raccomandato partire da **prompt library** (più
  duplicato, refactor indolore) e **tier guard** (già esiste, basta
  usarlo ovunque).

#### TB-007 Test mancanti per refactor flyer (spec #10)
- **Spec**: #10 §6 — `geometry.test.ts`, `svgRenderer.test.ts`,
  `templateCatalog.test.ts` (oltre a quelli esistenti)
- **Stato noto** (AGENTS.md §11 fase 11): test matrix 4/10. Mancano
  i 6 file elencati sopra.
- **Impatto**: il layout engine è il "source of truth" della geometria
  del flyer. Senza unit test esaustivi, qualsiasi modifica al fitting
  testo può rompere output. Le fix recenti sui gotcha volantino (vedi
  AGENTS.md "Volantino rendering gotchas" punti 1-9) sono il tipo di
  bug che test mancanti lasciano passare.

---

### 🟢 P2 — Polish / nice to have

#### TB-008 README privacy section per spec vision-grounded
- **Spec**: #2/5/7/8 §COM-001 follow-up
- **Gap**: card screenshot (con PII nome/cognome/email) e logo
  screenshot (con brand) sono inviati a Google Gemini API. Manca
  disclosure in `README.md`.
- **Impatto**: GDPR/privacy compliance. Non blocca, ma va fatto.

#### TB-009 Verifica costi Gemini vision-grounded
- **Spec**: #2/5/7/8 §11 — tutte avvertono "must be confirmed in
  dashboard"
- **Gap**: numeri `~$0.04/call` non verificati. Nessun `costTracker`
  né budget alert.
- **Impatto**: rampa produzione potrebbe costare più del previsto. Da
  fare una tantum guardando dashboard.

#### TB-010 `cardHarness` estensioni (spec #9 §4.1)
- **Spec**: #9 REQ-HAR-002 — il harness ha 15 funzioni elencate
- **Stato**: le 15 funzioni ci sono (`e2e/helpers/cardHarness.ts`).
  Possibile estensione: helper per `parseCardSvg` (esiste già come
  pura, da verificare copertura 8 file e2e).

---

## Spec cancellati

Cleanup eseguito in due ondate (traccia in git history):

1. **Prima ondata**: `spec-design-ai-card-cover-image.md` (SUPERSEDED),
   `spec-design-ai-card-text-vision-split.md` (MERGED),
   `spec-design-ai-card-vision-input.md` (MERGED).
2. **2026-07-18**: spec #1, #2, #6, #7, #8, #9, #11, #12 della tabella
   sopra — tutti DONE e verificati. Il gap residuo di #12 (callback tool
   non esposti in UI) è assorbito in REQ-LOG-001 dello spec #14.

---

## Roadmap raccomandata

### Sprint tecnici (qualità — prima di tutto)

```
Sprint 1 ✅ done:    TB-001 wiring ToolAwareOrchestrator
                    TB-003 rimuove bottone hero da manual panel
                    TB-002 test 4 endpoint Gemini (regression gratis)

Sprint 2 (next):    TB-023a multi-provider (Ollama Pro + MiniMax M3 +
                    Gemini Flash) + selector UI + pricing (~12h)
                    TB-023b pattern decorativi lib + picker (~10h)

Sprint 3:           TB-023c export pattern + AI v2 prompt + drag foto
                    card + icone AI + RAG clienti + test (~23h)
                    TB-024 più formati export logo (PDF vettoriale, favicon)
                    TB-004 + TB-005 test helper mancanti
                    TB-006 audit-ui-components.md (doc-only)

Sprint 4 (opz):     TB-007 test flyer refactor (6 file)
                    TB-008 README privacy
                    TB-009 verifica costi
```

### Sprint business (dopo qualità prodotto)

```
Fase 1 validazione: TB-018 portfolio 5 esempi settore (8-10h)
                    TB-022 privacy policy + cookie banner (3h)
                    TB-017 landing vendita Apertura €349 (4h)
                    → 30 contatti diretti CCIAA + giro fisico
                    → Obiettivo: 2 clienti paganti in 60 giorni

Fase 2 semi-auto:   TB-019 intake pipeline Google Form/Tally (20h)
                    → SOLO dopo 5+ clienti reali (volume giustifica infra)

Fase 3 prodotto+:  TB-012 landing generator (40h, chiude gap vs Durable)
                    TB-013 QR menu ristoranti (15h)
                    TB-014 GMB helper (10h)
                    TB-015 multi-lingua EN/DE (20h)

Fase 4 monetiz:     TB-016 Meta Ads test €300 (dopo 5 consegne)
                    TB-011 Stripe Checkout (dopo 15+ transazioni/mese)
                    TB-020 P.IVA (dopo 2 clienti paganti o €5k/anno)
                    TB-021 Fatturazione elettronica (post-P.IVA, €30k+)

Fase 5 collaboraz:  Tipografie (dopo 3-5 clienti con stampa, no esclusiva)
                    Collaboratori vendita (rev-share, no equity)
```

**Principio guida**: qualità prodotto prima, infrastruttura dopo,
monetizzazione automatizzata per ultima. L'intake pipeline (TB-019)
è infrastruttura che serve quando hai volume — non prima.

**Effort rimanente**: ~2-3 giorni tecnici (P1+P2) + qualità prodotto
(TB-023 ~45h con spec scritta, TB-024 ~12h) + business fasi 1-2 (~35h).

**Quick win già fatti**: TB-003 + 4 file test Gemini.

---

## Roadmap business / go-to-market (dal BP appendice luglio 2026)

Item tecnici e commerciali emersi dall'analisi di mercato 2026-07
(`doc/business-plan.md` §A-G). Non sono bug: sono la strada per i
primi clienti paganti.

### Feature prodotto (in ordine di priorità)

#### TB-011 Stripe Checkout automatico 🔴 P0 business
- **Perché**: vendita online senza email manuali; sblocca la gamba SaaS.
- **Trigger BP**: 15+ transazioni/mese OPPURE retainer > €500/mese. La
  spec va preparata ORA anche se l'attivazione è post-validazione.
- **Scope**: tabella `payments`, `POST /api/checkout`,
  `POST /api/stripe/webhook` (genera codice QB- automatico),
  subscription Pro €9/mese. Costo Stripe 1.5% + €0.25 EU.
- **Effort**: ~20h. Spec parziale in `spec-api-saas-monetization.md`.

#### TB-012 Landing page generator interno 🔴 P0 business
- **Perché**: gap più grosso vs Durable. Il pacchetto Apertura €349
  include "sito 1 pagina" ma oggi è lavoro manuale 2-3h/cliente.
- **Scope step 2 (BP §E)**: nuovo modulo app — da dati flyer → HTML
  statico → export ZIP. Admin deploya per il cliente (Netlify/Vercel
  free). 30 min/cliente invece di 2-3h.
- **Step 3 (dopo 5+ siti/mese)**: publish 1-click su
  `nome.quickbrand.it` via Vercel API (~80h, non ora).
- **NON fare**: website builder self-service (step 4 BP) — trappola
  che ci mette contro Durable/10Web.
- **Effort step 2**: ~40h.

#### TB-013 QR menu ristoranti 🟡 P1
- **Perché**: verticale forte del target (bar/ristoranti in apertura).
- **Scope**: tipo documento `qrMenu`: QR → menu PDF/landing. Riusa
  QREditor + flyer engine per il layout menu.
- **Effort**: ~15h.

#### TB-014 Google Business Profile helper 🟡 P1
- **Perché**: incluso nel pacchetto Presenza €690 ma oggi 100% manuale.
- **Scope**: checklist guidata + export dati formattati (NAP,
  categorie, descrizione AI da dati brand) pronti da copiare in GMB.
- **Effort**: ~10h.

#### TB-015 Multi-lingua EN/DE export 🟡 P1
- **Perché**: turismo Sardegna = tedeschi/inglesi; i B&B pagano per
  materiali bilingui.
- **Scope**: traduzione AI (DeepSeek) dei campi testo card/flyer/social,
  toggle lingua in export. Valutare anche UI inglese (post-validazione).
- **Effort**: ~20h.

### Marketing (non-codice, ma tracciato qui)

#### TB-016 Meta Ads test €300 🟡 P1 (dopo prima consegna reale)
- **Setup**: campagna Lead Generation (form nativo Meta), geo 25km
  Cagliari, 25-55 anni, interessi piccola impresa/ristorazione.
- **Budget**: €10/giorno × 30gg. Atteso: 15-40 lead, 1-3 clienti.
- **Gate**: CPA < €25 e ≥2 mesi positivi prima di scalare a €20-30/gg.
- **Creatività**: carosello prima/dopo fatto con Quickbrand stesso.
- **Regole BP §D**: mai ads prima di 5 consegne reali; Q4 (nov-dic)
  ridurre budget (+40% costi e-commerce); Q1-Q3 concentrare.

#### TB-017 Landing vendita Apertura €349 🔴 P0 business
- **Perché**: serve UNA pagina con UNA offerta per l'outreach diretto.
- **Scope**: adattare HomePage (già AIDA da Phase 13b) o landing
  dedicata: offerta Apertura, 3-5 esempi portfolio, form
  contatto/WhatsApp, 3 recensioni.
- **Effort**: ~4h (no codice nuovo, solo copy/struttura).

### Qualità prodotto (PRIORITÀ ALTA — prima delle infra)

#### TB-023 Migliorare harness AI 🟡 P1 — spec scritta
- **Spec**: `spec/spec-design-ai-harness-upgrade.md` (2026-07-20)
- **Perché**: oggi DeepSeek + Gemini soli. Qualità AI è il differenziale
  vs Durable/Canva. Le 4 foto biglietti reali (Alice Cinofila onda blu,
  Money360 header editoriale, ASMS sfondo full) mostrano pattern
  decorativi che l'app oggi non sa generare né esporre.
- **Provider scelti** (post-analisi costi 2026-07-20):
  - **DeepSeek V4 Pro** (già integrato, pay-per-token ~$0.55/1M input,
    $2.19/1M output) — resta per copy breve + fallback
  - **Ollama Pro Cloud** ($20/mo flat, 50x free usage, 3 modelli
    concorrenti, zero data retention) — nuovo, API `https://ollama.com/api`,
    env `OLLAMA_API_KEY`. Modelli: `minimax-m3:cloud` (default, multimodale
    Text+Image, 512K ctx, sostituto ufficiale gemini-3-flash-preview
    ritirato 15 luglio 2026), `deepseek-v4-pro:cloud`, `qwen-3.5`
  - **Gemini 2.0 Flash immagini** (`gemini-2.0-flash-preview-image-
    generation`, ~$0.02/immagine, alternativa economica a Nano Banana 3.1
    per icone/illustrazioni piccole)
- **Scope completo** (vedi spec per REQ dettagliati):
  - Multi-provider + selector UI in `AIProviderBadge` (REQ-MP-001..006)
  - MiniMax M3 multimodale: screenshot preview → AI vision feedback
    (REQ-MM-001..005) + `useAIDesignReview` hook
  - Tracking costi reale: `providerPricing.ts`, colonna DB
    `tokens_cost_usd`, endpoint admin cost-breakdown (REQ-TC-001..006)
  - Pattern decorativi (5): wave-bottom, wave-split, blob-corner,
    splash-corners, full-overlay — SVG programmatici, selezionabili
    manualmente + via AI (REQ-PD-001..008)
  - Drag mouse foto in card grid-mode: `photoPlacement {x,y,scale}`
    normalizzato -1..+1, pointer events, export coerente (REQ-DF-001..006)
  - Icone stilizzate AI: `iconOrchestrator` per card.builder.iconUrl +
    flyer.style.heroIllustration (es. frutta/oggetti/animali flat 2-colori)
    (REQ-IS-001..007)
  - A/B provider: confronto side-by-side in modal (REQ-AB-001..003)
- **Effort**: ~45h (sprint 2-3)
  - Sprint 2 (~22h): provider Ollama+MiniMax, Gemini Flash, selector UI,
    pricing, pattern lib + picker
  - Sprint 3 (~23h): export pattern, AI v2 prompt, drag foto, icone AI,
    test
- **Prereq**: nessuno tecnico. Business:订阅 Ollama Pro $20/mo +
  `OLLAMA_API_KEY` in Vercel env.
- **Costi ricorrenti**: $20/mo Ollama Pro (flat) + DeepSeek pay-per-token
  esistente + Gemini per-image. Atteso ~$25-30/mo total a volume 100
  clienti/mese (vs $80+ con solo DeepSeek pay-per-token).

#### TB-024 Più formati export logo 🟡 P1
- **Perché**: oggi SVG + PNG 512/1024/2048. Tipografie e siti web
  richiedono più formati.
- **Scope**:
  - **PDF vettoriale** (stampa tipografia, non raster) — prioritario
  - **Favicon set** (16/32/64/180/512) — per siti web
  - **ICO** (Windows, vecchio ma richiesto)
  - **SVG ottimizzato** (SVGO, ~40% più piccolo)
  - **JPG con sfondo colorato** (per social quando serve sfondo)
  - Verifica: PNG trasparente già c'è?
- **Effort**: ~12h (logoGenerator.ts + export actions)

#### TB-018 Portfolio 5 esempi settore 🔴 P0 business
- **Perché**: senza portfolio niente credibilità (BP §G settimana 1-2).
- **Scope**: ristorante, B&B, bar, negozio, studio professionale —
  fatti con l'app stessa (logo+card+flyer per ciascuno).
- **Effort**: ~8-10h con gli strumenti AI esistenti.

#### TB-019 Intake pipeline (Google Form → Quickbrand) 🔴 P0 business
- **Spec**: `spec/spec-intake-pipeline.md` (nuova, Architettura A ibrida)
- **Perché**: sostituisce l'intake manuale (email/WhatsApp) con form
  strutturato. Brief → Postgres → badge Collection → admin apre editor
  pre-compilato → 1 click "Genera" per modulo → export. Match con BP
  "consegna in 3 giorni con quality check".
- **Scope**: tabella `intakes`, `/api/intake` (pubblico, rate-limitato),
  `/api/intakes` admin, IntakeList in Collection, pre-compilazione
  editor, Apps Script snippet (gratis). ~880 righe, ~20h.
- **Out of scope**: full-auto (Architettura B, Puppeteer + backend
  esterno €15-30/mo — valutare dopo 10+ clienti), sito publish
  (TB-012), email/WhatsApp notifica (badge basta in v1).
- **Costo ricorrente**: €0 (Google Form + Apps Script + Neon free).
- **Effort**: ~20h.

### Compliance / fiscale (non-codice)

#### TB-020 Partita IVA — quando aprire
- **Trigger**: 2 clienti paganti che chiedono fattura, o superati
  €5.000/anno di ricavi. Sotto: prestazione occasionale (forfettaria
  5%, fino a €30k/anno) o ritenuta d'arte.
- **Regime**: forfettaria 5% (costo ~€1.500/anno INPS fissa + commercialista).
  Ha senso sopra €5-8k/anno fatturati regolarmente.
- **Setup**: P.IVA si somma al lavoro dipendente, non sostituisce.
  Aprire quando il flusso è stabile, non per il primo cliente.
- **Azione**: niente codice, solo decisione. Fare dopo validazione
  (dopo 2 clienti paganti reali).

#### TB-021 Fatturazione elettronica (post-P.IVA)
- **Trigger**: quando P.IVA attiva e fatturato > €30k/anno.
- **Scope**: integrazione Fatture in Cloud o Aruba API per emissione
  automatica fattura allo sblocco codice (Stripe webhook → fattura).
- **Effort**: ~15h (post-validazione).

#### TB-022 Privacy policy + cookie banner
- **Perché**: GDPR Italia. Form intake raccoglie PII (nome, email, telefono).
- **Scope**: pagina `/privacy` con policy, cookie banner iubenda o custom,
  link dal form Google e dalla HomePage.
- **Effort**: ~3h (doc + 1 componente).

### Esclusi deliberatamente (con motivazione)

- **Marketplace template community**: niente domanda, complessità alta.
- **Chatbot clienti**: scope creep, nessun cliente l'ha chiesto.
- **App mobile nativa**: la webapp mobile è sufficiente.
- **Website builder generico self-service**: guerra persa vs
  Durable/10Web/Framer AI (vedi BP §B).
- **Equity a collaboratori esterni**: l'app e il brand restano di
  proprietà esclusiva; collaborazioni solo rev-share su clienti
  portati o fee a progetto (BP §F).

---

## Note su come migliorare la "harness della codebase"

1. **Mancano fixture builders condivisi**. Ogni test e2e ricrea da zero
   la card. Creare `e2e/fixtures/` con:
   - `giovanniTemplate.json` (snapshot di `createGiovanniCardTemplate`)
   - `sampleFlyer.json`
   - `sampleQuote.json`
   - `adminUser.json` / `freeUser.json` / `unlockedUser.json`
   Permette test deterministici senza dipendere da `createXxx()`.

2. **`test:db` mancante**. `dataService.js` ha `IS_LOCAL` per
   localStorage vs API. I test usano localStorage (ok) ma nessun
   reset esplicito. Aggiungere `globalThis.beforeEach` con reset
   chiavi conosciute (`precisionQuote_documents:v1`,
   `userSettings_*`, ecc.) — oggi fatto inline in alcuni file.

3. **Coverage report non in CI**. `vitest.config.ts` ha threshold?
   Verificare; se manca, aggiungere `--coverage` in `npm run test`
   e threshold 60% su `src/`.

4. **E2E `__screenshots__/` è committed** (vedi spec #9 §REQ-E2E-004).
   Se le PNG pesano > 1MB ciascuna, valutare LFS o rigenerazione on
   demand. Corrente: `< 500KB` per file, OK.

5. **`api/__tests__/` manca `setup.ts` comune**. Ogni test fa
   `vi.mock('@/lib/db')` (o simile) inline. Estrarre in
   `api/__tests__/setup.ts` con mock Drizzle standardizzati.

6. **Manca `test:e2e:ci`** in `package.json`. Aggiungere:
   ```json
   "test:e2e:ci": "playwright test --reporter=line --workers=1"
   ```
   Per CI seriale (debug) e `"test:e2e:local": "playwright test"`
   per dev parallelo.

7. **Mock DeepSeek / Gemini centralizzato**. Ogni orchestrator test
   ricrea il mock provider. Estrarre in `src/ai/__mocks__/` con
   factory `createMockProvider(opts)`.
