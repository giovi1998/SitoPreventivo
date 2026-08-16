# To Be Done — Quickbrand

Colonna "To do" della kanban. Completati → **[done.md](done.md)**.

## 🔴 Da fare (prodotto)

### 🎯 Langfuse follow-up (2026-08-11, da CSV export)

- [x] **Costi Gemini = 0 in Langfuse**: le trace `card-cover`/`image-flash`
  hanno `costDetails: {}` e `totalCost: 0` — Gemini sembra gratis. Il
  `computeCostUsd` server-side calcola il costo ma il dev proxy Gemini
  (vite.config.js) non lo passa: `traceDev` per i 5 endpoint Gemini non
  include `costUsd` calcolato (solo `body.costUsd` override, mai inviato
  dal client). Fix: calcolare `computeCostUsd('gemini', model, undefined, 1)`
  nel dev proxy (come fa il server handler) e passarlo a `traceDev`.
  Verificare anche che il server handler prod lo faccia (sì, ma testare).
- [x] **`generate-image-flash` nome vecchio + `subfeature:chat` errato**:
  la trace `generate-image-flash` (21:09) ha ancora il nome vecchio e
  `subfeature:chat` invece di `subfeature:icon|hero|flash`. Il server
  handler `src/server/ai.ts` non è stato aggiornato (solo il dev proxy
  vite.config.js lo era). Fix: rinominare in `image-flash` + subfeature
  corretta in `ai.ts` (stesso mapping del dev proxy).
- [x] **Media ancora placeholder**: `image: "[immagine allegata]"` nelle
  trace Gemini — l'upload media fallisce ancora (400?). Verificare il
  payload `POST /api/public/media` (sha256Hash+field+traceId) con
  credenziali reali e il formato `traceId` (base64 OTLP vs hex atteso).
- [x] **Sessioni vuote**: le trace chat/cover non hanno `sessionId` — il
  wiring `sessionId=docId` è stato aggiunto ma il CSV mostra sessioni
  vuote (trace del 21:19, dopo il fix?). Verificare che `loadedIdRef.current`
  sia valorizzato al momento della chiamata e che il body arrivi al server.
- [x] **`costDetails` per DeepSeek/Ollama**: chat `card-ai-chat` ha
  `costDetails: {}` — `computeCostUsd` per Ollama flat → 0 (corretto), ma
  per DeepSeek via Ollama (`deepseek-v4-flash:cloud`) il costo è 0 perché
  il provider è `ollama` (flat). **Decisione (2026-08-16)**: con Ollama
  Pro il costo è flat $20/mo — il costo per-token di `deepseek-v4-flash:cloud`
  via Ollama è già incluso nell'abbonamento. Resta 0, corretto. Nessun
  costo per-token per modelli serviti da Ollama.

### 🎯 Sprint prossima settimana (priorità utente 2026-08-01)

- [ ] **3. "Genera bozze AI" in PROD non funziona (debug)**: la sequenza
  logo→card→flyer→website da CRM (`/app/customers/:id` → Genera bozze AI)
  fallisce o produce errori in produzione, mentre in locale probabilmente
  va. Non è ancora mai stato validato live E2E (vedi **TB-027h follow-up**
  più sotto).
  **Fix parziali fatti (non ancora validati live in prod)**:
  - **2026-08-12 (root cause website confermato + fix deployato)**: il
    website falliva con 400 su OGNI step in PROD — `max_tokens` Zod
    server max 8192 vs `maxTokens: 16384` mandati dal websiteOrchestrator
    (in locale il dev proxy Vite non valida il body → sembrava solo prod).
    Fix: max 16384 in entrambi gli schemi `/ai/chat` (commit faacc42,
    gotcha §26.27). **⚠️ Da validare live**: riprovare "Genera bozze AI"
    con 1 cliente reale dopo il deploy.
  - 2026-08-01: icona card falliva con `TypeError: Cannot destructure
    property 'accentColor' of '...style'` — `photoBrief.ts` usa
    `card.style ?? createEmptyCard().style` (fallback difensivo) e
    `useAutoBuildGenerate` passa il card `merged`. Regression test aggiunti.
  - **2026-08-05 (fix sospettato ma NON confermato live)**: diagnosi
    timeout — Vercel Hobby limita le richieste **sincrone** a 60s, quelle
    **streaming** a 300s. Gli step website CSS/JS/Verify/pagine usavano
    `provider.chat` (sincrono) → CSS 100-130s / JS ~90s uccisi dal
    timeout → website falliva (logo/card/flyer ok perché più corti).
    Fix applicato: `onStream` SEMPRE attivo nel websiteOrchestrator
    (no-op se assente) → tutti gli step website su SSE. In auto-build
    `onStream` era undefined → anche l'HTML cadeva su chat sincrona.
    Test: matrice 3 provider aggiornata (tutti gli step via SSE nei mock),
    541 verdi. **⚠️ NON validato live**: serve riprovare "Genera bozze AI"
    in prod con 1 cliente reale.
  Cosa controllare nell'ordine (se ancora fallisce):
  1. **Log Vercel**: errori 500/503, `FUNCTION_INVOCATION_FAILED`, quota
     (MiniMax M3/DeepSeek/Gemini), JSON parse, vision (screenshot preview
     solo se `getAiVisionEnabled()` + provider vision — CON-MM-002).
  2. **Env vars Vercel**: `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`,
     `OLLAMA_API_KEY`, `FIRECRAWL_API_KEY` settate in dashboard (mancanti →
     503/500 in prod). `VITE_*` NON basta in prod (server-side only).
  3. **Envelope jsonb → `hydrateDocument`**: record salvati in prod con
     shape envelope vs FLAT; possibile mismatch su lettura (gotchas §23).
     Attenzione: il website draft ora salva `pagesHtml` (nuovo campo) —
     verificare che il roundtrip PROD lo preservi.
  4. **bundle/lazy import**: orchestratori in `manualChunks`, `await
     import()` solo per moduli on-demand (gotcha §25) — errore
     `ERR_MODULE_NOT_FOUND` → pre-push build green non basta.
  5. Riprodurre con 1 cliente reale (non fixture), leggere `/api/logs`,
     correggere, aggiungere regression test dove possibile.
  Output atteso: E2E PROD funzionante + nota in `docs/done.md`.

- [ ] **4. Generazione SITO bozza + build Netlify (TB-012 step 2 pilota)**:
  prima landing page reale per un cliente, generata dagli asset esistenti
  invece che da zero. Porta d'ingresso dati già pronta: **`webAnswers`**
  (headline/offer/cta/tone/wantsPage) dal form intake, + asset del draft
  (logo/card/flyer) già nel CRM. Cosa include:
  - **Template HTML/CSS statico** (singolo file o mini-folder): hero
    headline+CTA, sezione offerta, contatti, footer; stile derivato da
    palette/logo del draft (o da `preferredColors`); zero dipendenze runtime
    (JS puro, nessun framework).
  - **Mapper brief → sito**: `webAnswers` + flyer text + card data → sezioni
    pagina; fallback sensato quando un campo è vuoto.
  - **Bozza locale**: pulsante "Genera sito bozza" che produce cartella/ZIP
    (simile export flyer/card), preview HTML nel browser.
  - **Build + deploy Netlify**: skill `netlify-deploy` — `netlify deploy`
    (draft/preview) per condivisione link col cliente; struttura dist per
    `netlify build` (o `ntl build`) funzionante con la cartella generata.
  - **Fuori scope**: builder self-service, publish su dominio cliente,
    multi-pagina — solo bozza + preview Netlify.
  - Nota: valutare se anticipare vs backlog (priorità utente 2026-07-30:
    sito clienti = obiettivo confermato).

### Backlog tecnico corrente

- [ ] **Website Builder — follow-up multi-pagina (2026-08-05)**: possibile
  raffinamento quando si vede il risultato reale: qualità delle pagine
  secondarie (contenuti), nav identica, asset condivisi. Base fatta
  (→ done.md).
- [ ] **Website Builder — verify agent alternativo (idee 2026-08-05)**:
  il modello continua a generare false positive ("troncato") e fix
  dannosi; il tool deterministico `analyze_site` è già la fonte di verità.
  Opzioni future se la qualità resta insufficiente: (a) **agent di fix
  dedicato** che riceve SOLO le issue del tool (mai il codice intero) e
  riscrive la parte indicata; (b) validazione HTML reale con parser
  (es. DOMParser in browser / regex più rigorosa) invece dello stack
  custom; (c) sezione HTML di regressione nel verify (mappa/contatti/
  form devono esistere — oggi il tool non la controlla).
- [ ] **Card flusso completo in clienti**: auto-build → Genera bozze AI →
  preview/editor senza errori quota/JSON/vision. Verificare E2E con
  Playwright su cliente reale.
- [ ] **Logo flusso completo in clienti**: upload manuale → propagazione a
  card/flyer → generazione AI con background persistente (no strip quota).
- [ ] **Creazione oggetti senza clienti**: flusso standalone (Collection →
  Nuovo) deve restare invariato e funzionante dopo le modifiche CRM.
- [ ] **Miglioria caricamento immagine logo in clienti**: preview persistente
  anche dopo navigazione, compressione ottimale, opzione "usa questo logo
  ovunque" (card/flyer/logo).
- [ ] **TB-027h follow-up**: verifica end-to-end flusso CRM auto-build in
  PROD (envelope jsonb → `hydrateDocument`, mai provato live). Record
  legacy doppia-shape in localStorage: si sanano al primo save; se serve,
  migrazione one-shot da console (snippet in gotchas §23).
  - Stato 2026-08-03: log `[doc-debug]` rimossi (commit bb7ea3b).
    Diagnosi completata via log server-side: i 3 sintomi erano:
    (a) `DELETE /documents/:id` 404 → documenti fantasma da POST
    auto-build fallito (schema/rete/rate-limit). `deleteDocument` tratta
    404 come successo (idempotente), nessun crash. **Non riproducibile in
    locale** — solo in PROD quando il POST fallisce ma il client mantiene
    lo stato ottimistico.
    (b) `hydrateDocument: nessun contenuto` per `tpl_*` → falsi positivi
    (template quote legacy con `data:null`, zero impatto).
    (c) `hydrateDocument: nessun contenuto` per logo/flyer → documenti
    CRM auto-build con `data:null` in DB (creati da versione precedente).
    **Verifica**: deployare in PROD, aprire CollectionView, controllare
    che non compaiano più i warning in console. Per i documenti fantasma
    esistenti, refresh pagina li rimuove dall'UI (GET /documents non li
    restituisce).
- [ ] **TB-009 residuo**: conferma una tantum costi reali Gemini in
  dashboard Google AI Studio / GCP billing al primo volume produttivo
  (i `perImage` in `providerPricing.ts` sono stime conservative). No codice.

## 🟢 Backlog business (da `business-plan.md`)

Ordine: validazione → portfolio → monetizzazione.

- [x] **TB-022** Privacy policy + cookie banner (~3h). Serve prima
  dell'outreach (form intake raccoglie PII). ✅ 2026-08-16: `PrivacyPage`
  (route `/privacy`, sezioni GDPR, contatto), `CookieBanner` (consenso in
  `pq_cookie_consent:v1`, solo cookie tecnici/localStorage, link privacy),
  banner su HomePage + AppShell, link nel footer. Test: CookieBanner +
  PrivacyPage.
- [ ] **TB-017** Landing vendita Apertura €349 (~4h, solo copy/struttura).
- [ ] **TB-018** Portfolio 5 esempi settore (8-10h) — DEFERRED, trigger:
  1 cliente reale in outreach.
- [ ] **TB-011** Stripe Checkout + subscription Pro (spec parziale in
  `spec/spec-api-saas-monetization.md`; trigger: 15+ transazioni/mese).
- [ ] **TB-012** Landing page generator interno (~40h step 2: da flyer →
  HTML statico → ZIP; NO builder self-service). Step 3 (publish 1-click
  `nome.quickbrand.it` via Vercel API, ~80h) solo dopo 5+ siti/mese.
  **Priorità utente 2026-07-30**: il sito per clienti è un obiettivo
  confermato — valutare di anticipare rispetto al backlog.
  **Dato d'ingresso pronto**: `webAnswers` dal form intake (headline/offer/cta/
  tone/wantsPage) è salvato su customers e visibile in CRM → usarlo come
  brief base per la generazione.
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
- **Equity a collaboratori esterni**: app e brand restano proprietà
  esclusiva; solo rev-share o fee a progetto (BP §F).

---

Storico dettagliato dei task completati: `done.md` +
`agent-gotchas.md`. Il vecchio `docs/to-be-done.md` (gap analysis
2026-07-18, cancellato nel refactor 2026-07-30) resta recuperabile in git
history: `git show c61b66d:docs/to-be-done.md`.
