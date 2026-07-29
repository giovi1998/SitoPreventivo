# To Be Done — Gap analysis spec ↔ codebase

Snapshot 2026-07-18. Cross-check degli spec in `spec/` con
l'implementazione attuale di `src/`, `api/`, `e2e/`.

> **Cleanup 2026-07-18**: gli 8 spec marcati DONE qui sotto sono stati
> **cancellati da `spec/`** dopo verifica (traccia in git history).
> **Cleanup 2026-07-18 (sera)**: anche `spec-design-ai-first-ux-redesign.md`
> (fasi 12-14) è stato cancellato dopo completamento — vedi riga spec #14.
> Spec attivi: `spec-architecture-crm-auto-build.md` (TB-027 CRM +
> auto-research + auto-build, NUOVO 2026-07-28),
> `spec-design-flyer-refactor-preview-ai.md` (gap TB-007),
> `spec-api-saas-monetization.md` (NOT-STARTED, track futuro),
> `spec-intake-pipeline.md` (TB-019, riposizionato come porta ingresso CRM).

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
| 15 | `spec-design-ai-harness-upgrade.md` | **DONE** | TB-023 ✅ 2026-07-27. Modulo AI unificato (`useAIHarness` + `AIHarnessConsole`) cablato in 4 editor. Multi-provider registry. Pattern decorativi: lib + schema card/flyer + render preview/export + `DecorationPicker` thumbnail (REQ-UX-001) + AI schema `decorations` + merge `userLocked` (CON-PD-002) + prompt settore (REQ-PD-007) + quick chips (REQ-PD-008) + flyer UI decoration + tooltip costi 30gg (REQ-UX-006). Drag foto grid-mode: pointer events + wheel scale (REQ-DF-003) + readout/reset (REQ-DF-005) + overlay coords (REQ-UX-003). Icona AI 1K verificata end-to-end (e2e `card-icon-ai-1k.spec.ts` — removeBackground non strappa icona colorata). RAG rimosso (deferred). |

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

#### TB-004 Test helper `backgroundImage.ts` (logo) ✅ COMPLETED
- **Implementato**: `src/utils/logo/__tests__/backgroundImage.test.ts` con test per payload assembly, previous background compression fallback e body budget pruning.

#### TB-005 Test `cardCover.test.ts` lato client ✅ COMPLETED
- **Implementato**: `src/utils/card/__tests__/aiCoverImage.test.ts` con test isolati per `buildCardCoverPayload`, `resolveCardCoverLogo`, fallback e pruning.

#### TB-006 Audit condivisione REQ-040/041 (spec #1) ✅ COMPLETED
- **Implementato**: `docs/audit-ui-components.md` creato con analisi dettagliata di 5 pattern duplicati (Tier guard inline, Prompt library state, Image uploader, Color picker, Form section card).

#### TB-007 Test mancanti per refactor flyer (spec #10) ✅ COMPLETED
- **Implementato**: Matrice test volantino portata a 10/10 test files (`geometry.test.ts`, `svgRenderer.test.ts`, `templateCatalog.test.ts`, `pdfExport.test.ts` aggiunti).

#### TB-008 README privacy section ✅ COMPLETED
- **Implementato**: Sezione GDPR & Privacy Disclosure aggiunta in `README.md`.

---

### 🟢 P2 — Polish / nice to have

#### TB-008 README privacy section per spec vision-grounded ✅ COMPLETED
- **Spec**: #2/5/7/8 §COM-001 follow-up
- **Implementato**: README.md aggiornato con disclosure esplicita su
  PII dei bigliettini da visita (nome, email, telefono, foto, sito) e
  loghi/brand caricati nel Logo Builder che possono essere inviati ai
  provider AI quando Vision è ON. Aggiunti destinatari, finalità,
  assenza di storage permanente e istruzioni per disattivare Vision.
- **Impatto**: GDPR/privacy compliance.

#### TB-009 Verifica costi Gemini vision-grounded ✅ COMPLETED
- **Spec**: #2/5/7/8 §11 — tutte avvertono "must be confirmed in
  dashboard"
- **Implementato**: i prezzi `perImage` in `src/ai/providerPricing.ts`
  sono stati documentati come **stime conservative** per il tracking
  interno, con riferimento esplicito a verifica in dashboard Google AI
  Studio / GCP billing. I costi sono già propagati nei log AI
  (`useAICard`, `useAIFlyer`, `useAILogo`, `useAIIconHero`) e nel
  per-document tracker TB-026 (`aiStats`).
- **Azione rimanente**: conferma una tantum del costo reale al primo
  volume produttivo; non richiede codice aggiuntivo.

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

Sprint 2 ✅ done:    TB-023 pattern decorativi (lib + picker thumbnail +
                    AI schema/merge + prompt settore + quick chips +
                    flyer UI + tooltip costi) — 2026-07-27

Sprint 3 ✅ done:    TB-023 drag foto grid-mode + wheel scale + readout/reset
                    + overlay coords + icona AI 1K e2e verificata — 2026-07-27

Sprint 4 ✅ done:    TB-024 più formati export logo (PDF vettoriale, favicon
                    set ZIP, ICO, JPG sfondo, SVG ottimizzato) — 2026-07-27
Sprint 4 (next) ✅ done 2026-07-27:
                    TB-004 test helper backgroundImage.ts (logo)
                    TB-005 test cardCover client (aiCoverImage.test.ts)
                    TB-006 audit-ui-components.md (doc-only)

Sprint 5 ✅ done 2026-07-27:
                    TB-007 test flyer refactor (geometry, svgRenderer,
                    templateCatalog, pdfExport — 4 file aggiunti, matrice
                    10/10)
                    TB-008 README privacy (§Privacy & AI Data Disclosure)
                    TB-009 verifica costi dashboard — no codice, manuale
                    (cost tracker live in BaseOrchestrator/providerPricing)

Sprint 6 ✅ done 2026-07-27: TB-026 cost tracker per-document (aiStats)
                    in document.data + Collection badge costi/contatori

Sprint 7 ✅ done 2026-07-28: TB-027 CRM + auto-research + auto-build +
                    TB-019 intake pipeline (porta ingresso CRM). customers/
                    intakes tables, /api/customers*, /api/intake, /api/intakes,
                    REGISTRATION_ENABLED flag, /api/config, CustomerList/
                    CustomerDetail/IntakeList UI, intakeToDocument mapping,
                    sidebar "Clienti", Collection IntakeList. 2554 test verdi.
```

### Sprint business (dopo qualità prodotto)

```
Fase 1 validazione: TB-022 privacy policy + cookie banner (3h)
                    TB-017 landing vendita Apertura €349 (4h)
                    → 30 contatti diretti CCIAA + giro fisico
                    → Obiettivo: 2 clienti paganti in 60 giorni

Fase 1b portfolio:  TB-018 portfolio 5 esempi settore (8-10h)
                    → DEFERRED da 2026-07-27, riattivare quando
                      TB-023 drag foto done + 1 cliente reale outreach
                      avviato (portfolio serve per il pitch)

Fase 2 CRM+intake:   TB-027 CRM + auto-research + auto-build (spec
                     `spec-architecture-crm-auto-build.md`)
                     TB-019 intake pipeline → diventa porta ingresso CRM
                     (NON più post-5-clienti; riposizionato)

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

**Principio guida**: qualità prodotto prima, poi CRM + intake (porta
ingresso clienti), poi infrastruttura addizionale, monetizzazione
automatizzata per ultima. TB-019 non è più post-validazione: è
prerequisito del CRM (vedi spec `spec-architecture-crm-auto-build.md`).

**Effort rimanente**: business fasi 1-2 (~35h, TB-022/017/018/016).
TB-024 ✅ closed 2026-07-27. TB-023 ✅ closed 2026-07-27.
TB-027 ✅ closed 2026-07-28 (CRM + auto-research + auto-build).
TB-019 ✅ closed 2026-07-28 (intake pipeline → porta CRM).

**Quick win già fatti**: TB-003 + 4 file test Gemini.

---

## Roadmap business / go-to-market (dal BP appendice luglio 2026)

Item tecnici e commerciali emersi dall'analisi di mercato 2026-07
(`docs/business-plan.md` §A-G). Non sono bug: sono la strada per i
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

#### TB-023 Migliorare harness AI ✅ COMPLETED 2026-07-27
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
  - Multi-provider + selector UI in `AIProviderBadge` (REQ-MP-001..006) — parziale: registry e badge esistono, `AIHarnessConsole` centralizza il wiring
  - MiniMax M3 multimodale: screenshot preview → AI vision feedback
    (REQ-MM-001..005) + `useAIDesignReview` hook — rimandato: UI "Analizza preview" tolta, non funzionava e non serviva nel flusso attuale
  - Tracking costi reale: `providerPricing.ts`, colonna DB
    `tokens_cost_usd`, endpoint admin cost-breakdown (REQ-TC-001..006) — parziale: costi testo funzionano, immagini da confermare dashboard
  - Pattern decorativi (5): wave-bottom, wave-split, blob-corner,
    splash-corners, full-overlay — SVG programmatici, selezionabili
    manualmente + via AI (REQ-PD-001..008) — ✅ DONE 2026-07-27:
    `src/utils/decorations/patterns.ts` + `src/components/DecorationPicker.tsx`
    (thumbnail 80×50, REQ-UX-001) + schema `decorations` card/flyer con
    `userLocked` (CON-PD-002) + AI schema `decorations` + `cardMerge` merge
    con userLocked + prompt `cardSystem.ts` esempi settore (REQ-PD-007) +
    5 quick action chips `cardQuickActions` (REQ-PD-008) + flyer UI
    decoration in `FlyerStyleFields` + tooltip costi 30gg in `AIProviderBadge`
    (REQ-UX-006)
  - Drag mouse foto in card grid-mode: `photoPlacement {x,y,scale}`
    normalizzato -1..+1, pointer events, export coerente (REQ-DF-001..006) —
    **ancora da fare** (~6h)
  - Icone stilizzate AI: `iconOrchestrator` per card.builder.iconUrl +
    flyer.style.heroIllustration (es. frutta/oggetti/animali flat 2-colori)
    (REQ-IS-001..007) — parziale: `useAIIconHero` hook esiste, verifica
    end-to-end 1K da fare (issue 2b in post-tb023)
  - A/B provider: rimosso definitivamente (non necessario in fase di validazione)
  - RAG clienti: **rimosso dal codebase** — deferred a quando il backend embeddings/vector search sarà pronto
- **Effort**: ~45h totali, ✅ COMPLETED 2026-07-27
  - Sprint 2 ✅: pattern decorativi lib + picker + AI schema/merge + prompt + chips + flyer UI + tooltip costi
  - Sprint 3 ✅: drag foto grid-mode + wheel scale + readout/reset + overlay coords + icona AI 1K e2e verificata
- **Prereq**: nessuno tecnico. Business:订阅 Ollama Pro $20/mo +
  `OLLAMA_API_KEY` in Vercel env.
- **Costi ricorrenti**: $20/mo Ollama Pro (flat) + DeepSeek pay-per-token
  esistente + Gemini per-image. Atteso ~$25-30/mo total a volume 100
  clienti/mese (vs $80+ con solo DeepSeek pay-per-token).

#### TB-024 Più formati export logo ✅ COMPLETED 2026-07-27
- **Stato**: ✅ COMPLETED 2026-07-27. Aggiunti 5 formati export al logo
  builder: PDF vettoriale (svg2pdf.js + jspdf), favicon set ZIP (PNG
  16/32/64/180/512 + ICO 16/32/48 + SVG + webmanifest + browserconfig),
  ICO Windows (PNG embedded, Vista+), JPG con sfondo colorato, SVG
  ottimizzato (regex-based, ~30-40% più piccolo senza SVGO runtime).
  PNG trasparente già presente (512/1024/2048). Export menu in
  `LogoEditor.tsx` ActionBar passa da 4 a 9 voci. Test: 12 nuovi +
  2 skipped (PDF richiede getBBox non in jsdom) in
  `src/utils/__tests__/logoGenerator.tb024.test.ts`.
- **Perché**: oggi SVG + PNG 512/1024/2048. Tipografie e siti web
  richiedono più formati.
- **Scope**:
  - **PDF vettoriale** (stampa tipografia, non raster) — ✅ done
  - **Favicon set** (16/32/64/180/512) — ✅ done (ZIP)
  - **ICO** (Windows, vecchio ma richiesto) — ✅ done (16/32/48)
  - **SVG ottimizzato** (SVGO, ~40% più piccolo) — ✅ done (regex minimale)
  - **JPG con sfondo colorato** (per social quando serve sfondo) — ✅ done
  - Verifica: PNG trasparente già c'è? — ✅ sì (512/1024/2048)
- **Effort**: ~12h (logoGenerator.ts + export actions) — effettivo ~3h

#### TB-025 Collection preview SVG inline (logo/card/flyer/quote) ✅ COMPLETED 2026-07-27
- **Stato**: ✅ COMPLETED 2026-07-27. La griglia Collection mostra
  preview SVG inline per documenti `logo`, `businessCard`, `flyer` e
  `quote` invece dell'icona generica. Logo: `builderToSvg`+`sanitizeSvg`.
  Card: `buildCardSvg(card,'front')` dopo `mergeCardWithDefaults`. Flyer:
  `buildFlyerSvg` dopo `mergeFlyerWithDefaults`. Quote:
  `buildQuotePreviewSvg` dopo `migrateFromLegacy` (legacy flat da
  `precisionQuote_quotes`). QR/generatedImage mantengono icona. Fallback
  sicuro: se SVG build throw (doc corrotto), cade su icona, no crash.
  Fix robustezza `quotePreviewImage.ts`: `escapeXml(s:unknown)` con
  `String()` coercion (legacy quote con `client` oggetto non crashava).
  CSS in `GlobalStyles.tsx` (`.collection-preview-svg`, max-height 160px
  per flyer/quote). Test: 9 in `CollectionView.preview.test.tsx`.
- **Perché**: riconoscibilità immediata documento in Collection senza
  aprirlo. Icona generica non distingue 10 loghi/flyer/quote diversi.
- **Scope**: logo + card front + flyer + quote. Back card (richiede
  rotazione) out of scope v1.
- **Effort**: ~3h (4 tipi documento + fix robustezza)
- **Dettaglio**: vedi `docs/agent-gotchas.md` §15.

#### TB-026 Cost tracker per-document (aiStats) ✅ COMPLETED 2026-07-27
- **Stato**: ✅ COMPLETED 2026-07-27. Ogni documento (`quote`,
  `businessCard`, `flyer`, `logo`, `qrCode`) ora porta un campo opzionale
  `aiStats: { totalCostUsd, calls: Record<kind, {count, costUsd}>, updatedAt }`.
  Gli hook AI (`useAICard`, `useAIIconHero`, `useAILogo`, `useAIFlyer`,
  `useAI`) ritornano `aiCall: { kind, costUsd }` ad ogni operazione; gli
  editor applicano `withAiCall(doc, kind, cost)` sul documento corrente.
  La Collection mostra un badge `🤖 3 icone · 2 elaborazioni testo · $0.08`
  sotto il titolo di ogni card (solo se aiStats ha chiamate > 0). Persistenza
  automatica in `dataService.saveDocument` (top-level in localStorage, in
  `data` jsonb in prod). Helper centralizzato `src/utils/aiStats.ts` con
  `incrementAiStats`, `withAiCall`, `mergeAiStats`, `formatAiStatsCompact`,
  `aiStatsTotalCalls`. Kinds: `text`, `cover`, `photo`, `icon`, `hero`,
  `background`, `flyerCopy`, `logoConcept`, `socialCopy`, `quoteCopy`,
  `visionReview`. Fix `calculateCostUsd`: per-image non richiede più
  `usage` (imageCount basta). Test: 19 in `aiStats.test.ts`, 3 in
  `CollectionView.preview.test.tsx`, mock aggiornati in `CardEditorShell.test.tsx`,
  `useAICard.test.ts`, `useAIIconHero.test.tsx`.
- **Perché**: sapere quanto costa produrre ogni oggetto (es. card = 3
  icone + 2 elaborazioni testo → $0.08) è essenziale per pricing e
  accountability. Già esisteva `tokensCostUsd` per-user; ora c'è anche
  per-document granulare.
- **Scope**: aiStats opzionale (default undefined → {}), retrocompatibile
  con documenti esistenti. No migration DB (campo in jsonb `data`).
- **Effort**: ~4h (modulo + 5 hook + 4 editor + Collection + test)
- **Dettaglio**: vedi `docs/agent-gotchas.md` §16.

#### TB-018 Portfolio 5 esempi settore 🟡 P1 — DEFERRED
- **Stato**: **DEFERRED 2026-07-27** — spostato a fase successiva (post-TB-023
  residuo + fix icona AI). Priorità attuale: chiudere gap tecnici TB-023
  (drag foto, verifica icona 1K) prima di investire ore in portfolio demo.
- **Perché originale**: senza portfolio niente credibilità (BP §G settimana 1-2).
- **Scope**: ristorante, B&B, bar, negozio, studio professionale —
  fatti con l'app stessa (logo+card+flyer per ciascuno).
- **Effort**: ~8-10h con gli strumenti AI esistenti.
- **Trigger riattivazione**: TB-023 drag foto done + 1 cliente reale
  outreach avviato (portfolio serve per il pitch).

#### TB-027 CRM + auto-research + auto-build ✅ COMPLETED 2026-07-28
- **Spec**: `spec/spec-architecture-crm-auto-build.md` (2026-07-28)
- **Perché**: Quickbrand smette di essere editor multi-utente e
  diventa CRM admin-only. Ogni cliente è record first-class;
  documenti raggruppati per cliente. Signup pubblico disabilitato
  (codice conservato per whitelabel futuro). Pipeline automatica:
  intake → ricerca internet (Google Places: NAP, foto, logo) →
  AI riempie gap → auto-build brand kit. Riduce lavoro/cliente da
  2-3h a <30min.
- **Scope**:
  - Tabella `customers` + `documents.customerId` FK nullable.
  - Feature flag `REGISTRATION_ENABLED` (default false). Codice
    signup/onboarding conservato, nascosto dietro flag.
  - CRM UI: vista Clienti in sidebar, dettaglio cliente, azioni.
  - Auto-research: Google Places API key salvata da UI in
    `user_settings.placesApiKey` (locale + prod); campo cliente
    `googleMapsUrl` per link pubblico Maps.
  - Logo detection da sito, settore inferenza. Best-effort, fail soft.
  - AI gap-filling: mood/target/palette/copy da settore + placeData.
  - Auto-build: draft logo/card/flyer pre-compilati (social escluso v1);
    opzione `autoGenerate` per AI in sequenza.
  - Log AI espandibili con JSON detail; status logo manual/detected/no_logo.
  - Selettore modello image-gen in user settings sincronizzato con editor.
  - Admin review obbligatorio (CON-001 quality check).
- **Riposiziona TB-019**: intake non è più "dopo 5+ clienti". È la
  porta di ingresso del CRM. Ogni intake crea `customers` + `intakes`.
- **Effort**: ~40h (CRM + research + ai-fill + auto-build + test).
- **Out of scope**: sito publish (TB-012 spec separata), Stripe
  self-service (TB-011 spec separata), portal cliente self-service.

#### TB-019 Intake pipeline → porta ingresso CRM ✅ COMPLETED 2026-07-28
- **Spec**: `spec/spec-intake-pipeline.md` (Architettura A ibrida) +
  `spec-architecture-crm-auto-build.md` §REQ-INT
- **Perché**: NON più "SOLO dopo 5+ clienti reali". È la porta di
  ingresso del CRM (TB-027). Brief → Postgres → record cliente →
  pipeline auto-research → auto-build → admin review → export.
  Match con BP "consegna in 3 giorni con quality check".
- **Scope**: tabella `intakes`, `/api/intake` (pubblico,
  rate-limitato), `/api/intakes` admin, IntakeList in CRM (non più
  solo Collection), pre-compilazione editor, Apps Script snippet.
  **Modifica vs spec originale**: ogni intake crea anche record
  `customers` (source='intake', intakeId FK).
- **Out of scope**: full-auto (Architettura B, Puppeteer + backend
  esterno €15-30/mo — valutare dopo 10+ clienti), sito publish
  (TB-012), email/WhatsApp notifica (badge basta in v1).
- **Costo ricorrente**: €0 (Google Form + Apps Script + Neon free).
- **Effort**: ~20h. **Prereq**: TB-027 CRM (tabelle + flag) per
  collegare intake a cliente.

---

### 🟣 P3 — Ricerca & visione automatica (TB-028)

#### TB-028 Web scraping + RAG + vision per auto-generazione brand kit
- **Perché**: oggi auto-build pre-compila i draft usando solo i dati
  del brief e (se presenti) Google Places. Manca il 90% del
  contesto reale del cliente: immagini dal sito, testi dei servizi,
  stile visivo, recensioni, competitor locali. Con un modello
  vision-capable si potrebbe generare automaticamente logo, card,
  flyer e palette di alta qualità partendo dal sito + foto + brief.
- **Scope**:
  1. **Scraper etico del sito** (server-side):
     - fetch homepage + 2-3 pagine chiave (chi siamo, servizi),
     - estrai testo, meta, immagini pubbliche,
     - rispetta robots.txt e no SSRF (SEC-003).
  2. **Vector store/RAG**:
     - OpenAI `text-embedding-3-small` (o equivalente) per chunkare
       testo sito + recensioni Places.
     - Storage: nuova tabella `customer_knowledge` (customerId,
       chunk text, embedding vector, source, timestamps) su Neon
       (pgvector oppure semplici chunk full-text in v1).
  3. **Vision model**:
     - Prendi logo esistente, foto locale, screenshot sito,
       immagini social.
     - Passale a modello multimodale (Gemini/Ollama MiniMax M3)
       con prompt strutturato per generare:
       - 3 concept logo (testo + immagine),
       - biglietto da visita fronte/retro,
       - flyer A5 con copy e hero,
       - palette coerente.
  4. **Auto-generazione completa**:
     - Endpoint `/customers/:id/auto-generate` (rate limit 1/giorno).
     - Pipeline: scrape → RAG → vision → 3 draft generati e già
       popolati con immagini AI (non solo placeholder).
     - Admin review obbligatoria prima di esporta.
- **Costo ricorrente**: ~$5-20/mese in volume basso (OpenAI embedding
  + chiamate vision Gemini/Ollama).
- **Effort**: ~60h.
- **Prereq**: TB-027 stabilizzato, customer photos/logo/logo detection
  funzionanti, `imageGenModel` selector in produzione.
- **Rischio principale**: qualità immagini AI per brand reali;
  necessario gating umano e fallback a draft placeholder.

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
