# Done — Quickbrand

Colonna "Done" della kanban. Dettaglio tecnico: `agent-gotchas.md`
(sezioni indicate per voce). Storico completo: git history.


- **TB-032 Verify agent alternativo — fix agent mirato + repair deterministico + regressione struttura** (da 	o-be-done.md "Verify agent alternativo"; gotchas §26.28):
  - **Verify zero-AI su codice integro**: nalyzeSiteCode + nuova nalyzeSiteRegression (struttura obbligatoria: nav, menu-toggle, footer, .current-year, mappa, form, href relativi) → codice integro = erify:ok con ZERO chiamate AI (prima 1-2 sempre).
  - **Repair deterministico locale pre-AI**: epairCssStructure/epairHtmlStructure sistemano parentesi CSS/tag orfani in millisecondi (erify:repair:css|html).
  - **Fix agent mirato** (uildWebsiteFixPrompt): riceve SOLO le parti rotte dal tool, mai il dump completo → il modello non può riscrivere codice integro né perdere sezioni. Una chiamata, easoningEffort: 'high', guardia anti-distruzione §26.16 invariata (integro + ≥60%).
  - **Recheck 100% deterministico**: issue residue REALI nel pannello; parte vuota (es. CSS fallito) → issue residua, niente chiamata inutile.
  - **website-verify prompt/registry rimossi** (dead code).
  - Costi: 3 chiamate AI (integro) invece di 4-5; verify 0s invece di 30-194s.
  - Test: siteAnalyser 24, orchestrator 40, matrice provider 6 (niente tools/tool_calls, garanzia anti-400). Gate: typecheck + 3300 verdi.

## 2026-08-17

- **Spec chiusa: Langfuse Observability (2026-08-17)**: spec
  `docs/spec/spec-langfuse-observability.md` cancellata — implementazione
  completa (tracing TB-029, prompt management fase 2 con label ambiente,
  A/B per-cliente `promptLabels` + `promptVersions` TB-032, admin CRUD,
  media multi-modale). Nota: `spec-design-flyer-refactor-preview-ai.md`
  resta attiva (Phase 11 parziale, gap test matrix).

- **Fix pannello AI non scrollabile** (da `to-be-done.md`): `.ai-console`
  (flex child) senza `min-height: 0` cresceva col contenuto invece di
  scrollare → rail AI card/flyer/logo non scrollabile (segnalato in PROD).
  Fix in `AIConsole.css`: `min-height: 0; height: 100%` su `.ai-console`,
  `min-height: 0` su `.ai-console__panel`. Pattern già corretto nel
  website rail (era l'unico editor che scrollava).

- **Fix sito web generato troncato** (da `to-be-done.md`): "Genera sito da
  cliente" poteva produrre un sito minimale (header + mappa). Analisi
  matrice 3 provider × 2 reasoning (`scripts/debug-matrix.ts`):
  - `reasoningEffort: 'max'` su MiniMax M3/DeepSeek 0731: JSON HTML
    troncato o output povero (DeepSeek 'max' = 5 sezioni vs 'high' = 7).
  - Fix: `reasoningEffort: 'high'` sugli step html + pagine secondarie in
    `websiteOrchestrator.ts` (allineato allo step CSS, dove 'max' era già
    stato tolto per tempo/qualità). Validato 7/7 generazioni reali Pad
    Thai complete (6-8 sezioni + footer), 49 test orchestratore verdi.
  - Nota: il costo `$0.0001` NON è indicatore di fallback (default
    `trackUsage || 0.0001` su Ollama flat) — indizio falso scartato.

- **Revert `817cddd`** (system prompt "preserva tutti gli elementi del
  brief" — experiment non riuscito): il commit aveva rotto 7 test
  (`system.test.ts` compact 2536>2500 chars + regex, flyerSystem,
  logoSystem, socialSystem, websiteSystem, cardSystem) e allungato i
  prompt oltre i limiti. Revert `556ff08` su branch
  `fix/revert-prompts-817cddd` → merge in master (fast-forward). 131/131
  test prompt verdi. Da riprovare con prompt più corti se si vuole
  mantenere il vincolo "preserva tutti gli elementi".

- **Fix preview viewport mobile su desktop** (segnalato 2026-08-17):
  `viewport` inizializzato una volta al mount con `matchMedia(MQ_WORKSPACE)`
  → finestra aperta <1024px restava `375px` anche allargata a desktop
  ("dopo rigenera vedo mobile"). Fix in `WebsiteEditor.tsx`:
  `viewportTouchedRef` + `useEffect` che segue `isMobileWorkspace` finché
  l'utente non sceglie un viewport manualmente.

## 2026-08-16

- **TB-017 Landing vendita Apertura €349** (da `to-be-done.md`):
  - `src/pages/AperturaPage.tsx` + route `/apertura`: hero offerta €349,
    6 item inclusi (logo, biglietti, 250 volantini, sito 1 pagina, post
    social, file stampa), 4 step, FAQ, CTA `mailto:webdevcagliari@gmail.com`.
  - Card "Apertura" in HomePage ora punta a `/apertura` (era mailto diretto).
  - Test: `AperturaPage.test.tsx` (4).

- **TB-022 Privacy policy + cookie banner** (da `to-be-done.md`):
  - `src/pages/PrivacyPage.tsx` + route `/privacy`: sezioni GDPR (titolare,
    dati raccolti, cookie/storage locale, finalità, conservazione, diritti),
    contatto `info@quickbrand.it`.
  - `src/components/CookieBanner.tsx`: banner fisso con consenso in
    `pq_cookie_consent:v1` (accepted/declined), solo cookie tecnici +
    localStorage, link alla privacy. Montato su HomePage (pubblica) e
    AppShell (app). Link "Privacy Policy" nel footer HomePage.
  - Test: `CookieBanner.test.tsx` (4) + `PrivacyPage.test.tsx` (2).

## 2026-08-14

- **Card centrata in agent mode + website editor mobile (T8, wayfinder
  `qualita-oggetti-map.md`)**:
  - `buildCardDraftPrompt` condiviso (auto-build non-agente + tool
    `generate_card` dell'agente): prompt strutturale STRUTTURA grid +
    TESTI + STILE — prima l'agente usava un prompt generico → card non
    centrata (preview legacy ≠ export).
  - `ensureCardGrid` (`schemas/card.ts`): garantisce grid mode su card
    generata (deriva grid dal layout, `useGrid` su entrambi i lati);
    applicata in `agentSave.ts` + `useAutoBuildGenerate.ts`. Card già in
    grid invariate.
  - `gridElements.ts` null-safety (`front`/`back`/`grid.elements` — l'AI
    può salvare `grid: {}`).
  - `useDocumentLoader` ritorna `initialDoc: null` durante fetch di doc
    mancante → `WebsitePage` fallback "Sito non trovato" (prima crash su
    `.html`).
  - Website editor mobile: viewport default 375px su workspace mobile,
    tab default `preview` se il doc ha contenuto, grid stack su
    `@media 1023px` (era `1fr 320px` → iframe 38px invisibile).
  - Guardia anti-regressione: e2e `AC-007` (iframe preview website
    full-width a 390px).

## 2026-08-13

- **Qualità oggetti card/flyer/logo — verifica live end-to-end + catena di
  fix (2026-08-13)** (mappa wayfinder `docs/wayfinder/qualita-oggetti-map.md`,
  ticket T1-T7; da `to-be-done.md` "Verifica visiva modifiche AI" e #2
  "Immagini AI pixelate — residuo verifica"):
  - **Verifica live ALL CHECKS PASS** su cliente demo "La Chiccheria":
    Phase A endpoint 4/4 (1K JPEG), Phase B immagini persistite tutte
    ≥1000px, quality card 22/16/14 + contatti 19px + 0 overflow, flyer
    floor stampa + 0 out-of-bounds, logo ratio tagline 0.417; export reali
    logo 1024, card 1004×650, flyer 1819×2551.
  - **Agent mode CRM riparato** ("Genera bozze AI" non salvava nulla):
    dev proxy Ollama droppava i `tool_calls` in risposta (stream +
    non-stream) → loop plan→act morto; history normalizzata
    camelCase→snake_case con arguments oggetto (era 400 Ollama);
    `useAutoBuildGenerate` passava docs `{}` ai tool (TypeError flyer);
    include filtrava `generate_card` ('businessCard'≠'card'); data shape
    tool→save disallineata; logo `selected:-1` mai salvato.
  - **Immagini AI in agent mode** (T6): `enrichAgentDocWithImages` (logo
    bg + pill, card photo/cover, flyer hero) + compressione saveDraft
    path-aware 1536/1024px (era 768px piatta → sotto soglia qualità).
  - **Clamp immagini 1MB → 1.2MB** (T5): 16:9 1K JPEG varia fino a
    ~1.05MB → 413 intermittenti su logo-background.
  - **Pill textBackdrop disallineata** su logo horizontal+bgImage
    (anchor middle: box dal centro invece che dal bordo sinistro).
  - **Embeddings 502** (T7): SDK `@google/genai` ritorna `embeddings[]`
    plurale; parsing singolare → sempre vuoto. Fix 3 siti (ai.ts, crm.ts,
    dev proxy) + live 200.
  - **Script di verifica robusti**: profilo Playwright persistente
    condiviso (riuso customer/docs, zero doppia spesa AI), contact sheet
    data-URL (era file:// → broken), soglia logo export 1024×1 (layout
    orizzontale non quadrato), poll 20 min, click generate solo se
    pending, login per presenza campo.
  - Test: +20 (proxy tool_calls/normalizzazione, agentSave, hook T6/T11,
    embeddings plurale, pill regression, clamp boundary). **3181 verdi**,
    typecheck 0.

- **RAG pipeline completa — chunking/embedding/retrieval + tracing Langfuse
  + UI (2026-08-13)** (da `to-be-done.md` "RAG avanzato"):
  - **Embedding server-side**: `saveCustomerKnowledge` embedda ogni chunk
    con `gemini-embedding-2` (`embedText` in `crm.ts`, chiave mai nel
    browser, best-effort [] su errore). Colonna `embedding` jsonb
    finalmente popolata.
  - **Retrieval cosine top-k**: nuovo modulo condiviso
    `src/utils/knowledgeTopK.js` (cosine + top-k + `mergeKnowledgeIntoBrief`,
    fallback ordine di inserimento). Server: `getBestKnowledgeChunks`
    sostituisce `chunks[0]` in ai-fill e auto-build. Locale: stesso modulo
    in `crm.js`.
  - **Chunk nel briefContext di TUTTI i draft**: auto-build (server
    `handler.ts` + locale `crm.js`) inietta top-k chunk in logo/card/flyer/
    website. WebsiteEditor carica chunk live al mount (idempotente).
  - **Tracing Langfuse**: ai-fill tracciato (`crm-ai-fill`, feature crm,
    usage+costUsd); embedding tracciato con observation type `embedding`
    (nuovo campo `observationType` in `langfuse.ts`, docs v4); dev proxy
    `/api/ai/embeddings` aggiunto alla allowlist con trace.
  - **UI**: `CustomerKnowledgePanel` in CustomerDetail (lista chunk +
    badge conteggio + dimensione embedding). Fix route mancante
    `GET /customers/:id/knowledge` (prima 404 in prod).
  - Test: 3086 verdi, typecheck 0, build zero-warning.

## 2026-08-12

- **Wayfinder Langfuse agenti — trace gerarchica agente→sub-agente
  (2026-08-12)** (mappa `docs/wayfinder/langfuse-agentic-map.md`, ticket
  T1-T7 chiusi):
  - **Decisioni research**: LangChain/LangGraph **DON'T ADOPT** (nested
    span = solo `parentSpanId` OTLP, ~15-25 LOC; LangGraph 12MB/AI SDK
    7MB/OTel 1-2MB contro §25; SDK v5 richiede flush pre-exit peggiore
    della fire-and-forget 2s). Next.js **DON'T MIGRATE** (~90-140h, SPA
    pura, monolite §1 load-bearing, Langfuse non Next-gated).
  - **T6 fix trace**: `generate-flyer-copy` usage spaccato
    prompt/completion reale (era tutto in completion), identità
    userEmail/customerId/sessionId nel body (era `undefined`), tag
    `status:ok|error` nel payload Langfuse.
  - **T7 trace gerarchica implementata**: `src/ai/runTrace.ts`
    (newRunId/newSpanId hex); `useAutoBuildGenerate` genera runId/
    rootSpanId per run + stepSpanId per step e propaga via
    `RunTraceOptions` (types.ts) → orchestratori → `ChatOptions` → body
    `/api/ai/chat`; server Zod (runId 32-hex, spanId 16-hex) su chat e
    chat/stream + dev proxy; `buildLangfusePayload` emette root
    `agent:auto-build` + step `agent:auto-build:<step>` + generation
    parent-linked, traceId=runId (media inclusi), backward-compat senza
    campi run. Website: ogni chiamata interna (html/pages/css/js/verify)
    è un sub-step con stepSpanId nuovo.
  - Test: 3 payload gerarchico + 4 Zod run fields + 7 expected tags
    aggiornati. **3026 test verdi**, typecheck 0, build zero-warning.

- **Wayfinder Langfuse agenti round 2 — agente con harness tools +
  bug prod website + trace test no-cloud (2026-08-12)** (ticket T9/T10,
  dettaglio gotcha §26.27):
  - **T9 agente orchestratore** (`src/ai/agentOrchestrator.ts`): 4 tools
    `generate_logo/card/flyer/website`, loop plan→act max 6 round su
    `BaseOrchestrator` (zero LangGraph), tool fail → `{ok:false}` senza
    crash, `onToolResult` per save client, trace `stepName:'plan'` +
    step per tool. **Non ancora collegato alla UI** (wiring CRM =
    prossimo step).
  - **Bug PROD website sbloccato**: Zod server `max_tokens` max 8192 vs
    16384 mandati dal websiteOrchestrator → 400 su OGNI step website in
    prod (dev proxy locale non valida → solo prod). Fix: max 16384 in
    entrambi gli schemi `/ai/chat` + test. **Deployato faacc42**.
  - **T10 trace test no-cloud**: `resetApiTests` azzera le 6 env
    Langfuse → le trace `prompt:"p"`/`sizeKB:0.0029` su cloud erano
    test unitari che uscivano (fallback VITE_*). Regression test in
    `flyerHero.test.ts`.
  - Test: +5 agente, +4 Zod max_tokens, +1 regression no-cloud.
    **3033 test verdi**, typecheck 0, build zero-warning. Push faacc42.

- **Langfuse follow-up round 2 — media upload funzionante + sessioni
  complete + latency reale (2026-08-12)** (da `to-be-done.md` Langfuse
  follow-up, verifiche empiriche su `cloud.langfuse.com`):
  - **Media upload FIX (root cause 400 + 403, verificato end-to-end con
    probe reale)**: `src/server/langfuse.ts` inviava `sha256Hash` hex (64
    char) → 400 `invalid_format` (regex Langfuse `{44}` = base64 del digest
    binario); PUT senza `x-amz-checksum-sha256` → 403 (media resta
    pending); mancava PATCH `uploadHttpStatus` post-upload e
    `contentLength` era arrotondato (ora = byte reali). traceId media ora
    32-hex W3C (era base64 OTLP). Flusso completo verificato: POST 201 →
    PUT 200 (checksum) → PATCH 200 → GET 200.
  - **Sessioni vuote FIX**: root cause doppio — (1) server `ai.ts` non
    accettava `sessionId` nei body dei 5 endpoint Gemini (zod lo
    strippava) + design-review: aggiunto `sessionId` a card-cover,
    card-photo, logo-background, flyer-hero, image-flash, design-review
    (schema + trace); (2) closure stale client: `sessionId` mancante nelle
    deps `useCallback` di useAICard/useAILogo/useAIFlyer/useAIWebsite →
    chiamate dopo doc-switch usavano il docId precedente. `useAISocial`
    non passava proprio sessionId all'orchestratore (aggiunto options +
    handleStream). `useAIIconHero` ora accetta sessionId (wiring
    CardEditorShell con `loadedIdRef.current`).
  - **Latency reale**: `endTime` default = payload build time (era
    `endTime ?? startTime` → tutte le trace a 0ms).
  - **Design-review allineato**: nome trace `design-review` (era
    `generate-design-review`) + subfeature `review` + sessionId.
  - **Dead code**: rimosso `buildTags` duplicato in `ai.ts` (tags
    definiti una volta sola in `buildLangfusePayload`).
  - Test: aggiornati (media sha base64/PATCH/checksum/contentLength,
    latency, sessionId server card-cover, sessionId useAIIconHero).
    **3013 test verdi**, typecheck pulito.

- **Langfuse follow-up — costi Gemini dev proxy + nomi trace server + tipi
  multimodali (2026-08-12)** (da `to-be-done.md` Langfuse follow-up):
  - **Costi Gemini nel dev proxy**: `vite.config.js` ora calcola il costo
    per immagine inline (`GEMINI_PER_IMAGE` 0.04/0.02, `geminiCost(model)`)
    nei 5 endpoint Gemini (logo-background, card-cover, flyer-hero,
    card-photo, image-flash) — prima `body.costUsd` (mai inviato dal
    client) → Gemini risultava gratis in locale. Stessa tabella del server
    handler.
  - **Nomi trace server allineati**: `src/server/ai.ts` — `flyer-hero`,
    `card-photo`, `image-flash` (era `generate-*` + `subfeature:chat`
    errato) + `costUsd` Gemini su tutti e 3. Ora server handler e dev
    proxy hanno nomi/subfeature/costi identici.
  - **Tipi multimodali Langfuse**: `LangfuseMessage.content` ora è
    `string | LangfuseContentPart[]` (parti OpenAI-style `{type:'text'}`
    / `{type:'image_url'}` — formato documentato Langfuse per generazioni
    text+image). `sanitizeInput` e `resolveMediaRefs` gestiscono le parti
    image_url: placeholder senza upload, token `@@@langfuseMedia@@@` con
    upload (mai base64 raw). Fix bug sanitize: placeholder solo su
    messaggi con `images[]` (prima appeso anche ai messaggi senza).
  - Test: +3 (dev proxy costUsd 0.04, parti image_url placeholder, parti
    image_url → token media), fix 1 (sanitize PII). **3011 test verdi**,
    typecheck pulito. Commit `—` (da fare).

## 2026-08-11

- **Langfuse — nomi trace specifici + tags strutturati + costi + sessioni + fix error:empty (2026-08-11)**
  (spec §3-4-9-11):
  - **Nomi trace verb-first specifici**: chat → `{kind}-ai-chat`
    (card-ai-chat, quote-ai-chat, flyer-ai-chat...), immagini →
    `card-cover`, `card-photo`, `logo-background`, `flyer-hero`,
    `image-flash`, `design-review`, `flyer-copy` (server ai.ts + dev
    proxy). Niente più `generate-response`/`generate-stream` generici.
  - **Tags strutturati**: `feature:X`, `subfeature:chat|cover|photo|bg|
    hero|icon|flash|review`, `provider:deepseek|ollama|gemini`,
    `streaming:true|false` (buildLangfusePayload + tutti i trace point).
  - **Costi reali**: `computeCostUsd` server-side (tabella inline
    DeepSeek/Gemini, gotcha §1.1) → `cost_details` nelle trace; body
    `costUsd` client come override opzionale. Ollama flat → 0.
  - **Sessioni attive**: `sessionId=docId` propagato da editor
    (CardEditorShell, FlyerEditorShell, LogoEditor/LogoAiPanel,
    WebsiteEditor, AppShell quote) + auto-build (`doc.id`) → chat e
    immagini dello stesso documento nella stessa sessione Langfuse.
    `customerId` resta fallback + metadata.
  - **Fix error:empty**: retry automatico con prompt semplificato in
    `useAICard` (stesso pattern di useAI quote) — deepseek-v4-flash:cloud
    che risponde vuoto ora riprova.
  - Test: +2 API (nomi/tags/costi/session), fix 4 esistenti (tags nuovi,
    options auto-build). **3006 test verdi**. Commit `—` (da fare).

- **Langfuse — tracing completo dev proxy (5 endpoint Gemini + design-review) + PII content-string (2026-08-11)**
  (spec §11):
  - **Root cause cover/sfondo non tracciati in locale**: il dev proxy Vite
    gestisce TUTTI gli endpoint AI in dev (il server handler di prod non
    gira) ma tracciava solo la chat Ollama. Fix: `traceDev()` helper +
    trace su `logo-background`, `card-cover`, `flyer-hero`, `card-photo`,
    `image-flash` (success + errori, `generate-*` nome stabile, tag
    feature, `imageBase64` → media token inline, `requestId` da header
    `X-Request-Id` via `devReqId(req)`).
  - **Design review in dev**: prima 404 (non in `handledPaths`) → ora ramo
    Ollama `minimax-m3:cloud` vision con trace (`generate-design-review`,
    screenshot → media).
  - **PII content-string**: le anteprime vision passano come base64 raw nel
    content string ("Anteprima card allegata (base64 JPEG): data:...") →
    `resolveMediaRefs` ora sostituisce TUTTI i data URI inline nel content
    con token media/placeholder (regex `DATA_URI_RE`, replace sincrono
    dopo risoluzione Promise). Mai base64 raw in trace.
  - **Cache media dedup per mime+contenuto** (stesso b64 con mime diverso =
    media diverso).
  - Fix `proxyOllamaChat(req, res, body, isStream)` (`req is not defined`).
  - Test: +1 PII content-string, +1 flusso vision card completo (system +
    prompt + anteprima→token + tool_calls + usage), viteDevProxy 5 verdi.
    **3004 test verdi**. Commit `—` (da fare).

- **Langfuse — fix tracing ESM + tags prompt + tracing dev proxy (2026-08-11)**
  (spec §8-11):
  - **Root cause zero-trace in locale**: `src/server/langfuse.ts` usava
    `require('node:crypto')` dentro `cryptoMd5` → in ESM (vite dev/tsx)
    `require is not defined` → `ingestLangfuse` crashava prima del fetch →
    in locale zero trace (in prod, bundle CJS, passava). Fix: usa l'import
    statico `crypto` già presente. Verificato end-to-end: trace reale
    inviata da script tsx e presente in Langfuse (`generate-stream`,
    userId=admin@gmail.com, usage 100/50).
  - **Tags per prompt** (`scripts/sync-prompts.ts`): ogni prompt ora ha
    `quickbrand` + `environment:<label>` (staging/production). All'inizio
    identici tra ambienti, possono divergere in futuro. Upload reale:
    staging v2, production v3, tutti e 8. Verifica CLI: labels
    `production,latest`, tags `quickbrand,environment:production`.
  - **Tracing dev proxy** (`vite.config.js` `proxyOllamaChat`): il dev proxy
    sostituisce il server handler in locale → ora traccia anche lui
    (stream/non-stream/errori, usage, kind, customerId, userEmail) via
    `ssrLoadModule('/src/server/langfuse.ts')`. In locale le trace ci sono.
  - Gate: typecheck + build + 3002 test verdi. Commit `—` (da fare).

- **Langfuse — migrazione completa prompt (2026-08-11)** (spec §8, skill
  prompt-migration): 5 nuovi system prompt migrati su Langfuse
  (`logo-system`, `social-system`, `onboarding-system`, `website-system`,
  `palette-system`) oltre ai 3 pilota (`card-system`, `quote-system`,
  `flyer-system`) = **8 prompt gestiti** con label per ambiente
  (production/staging). Upload reale su Langfuse cloud (staging v1) +
  verifica roundtrip via CLI e `fetchRemotePrompt` (fallback:false).
  **Esclusi deliberatamente**: i 5 user-prompt website
  (`website-html/css/js/page/verify`) incorporano HTML/CSS/JS dinamico
  5-50KB → variabili giganti ineditabili, restano hardcoded
  (`website-system` migrato come riferimento). Test: +1 fallback locale
  copre i 5 nuovi. Commit `—` (da fare).

## 2026-08-10

- **Langfuse observability — tracing AI + costi per cliente (2026-08-10)**
  (spec `docs/spec/spec-langfuse-observability.md`): ogni chiamata AI
  (chat/stream/copy-flyer/design-review/5 endpoint Gemini) → trace OTLP
  Langfuse v4 con usage, costi, errori, `user_id`, `session_id=customerId`,
  tag feature, env. `src/server/langfuse.ts` (payload OTLP manuale, zero
  dipendenze, fire-and-forget timeout 2s, no-op senza chiavi; fallback
  `VITE_LANGFUSE_*` per dev locale). Identity client: `userEmail` auto dal
  localStorage, `customerId` propagato via ChatOptions fino all'auto-build
  CRM, `kind` per orchestratore. Env:
  `LANGFUSE_PUBLIC_KEY`/`LANGFUSE_SECRET_KEY`/`LANGFUSE_BASE_URL`.
  Test: 13 unit langfuse + 3 API integrazione + 4 wiring = 20 nuovi.
- **Langfuse Prompt Management — Fase 2 (2026-08-10)** (spec §8):
  prompt pilota (`card-system`, `quote-system`, `flyer-system`) versionati
  su Langfuse con **label per ambiente**: `production` (Vercel) vs
  `staging` (locale) → template diversi in prod e local.
  `GET /api/ai/prompt` (cache 60s + fallback builder locali), dev proxy,
  client `src/utils/ai/remotePrompt.ts` (prefetch in AppShell, override
  `promptRegistry`, `compileClientPrompt` {{var}}), script
  `scripts/sync-prompts.ts` (`npm run prompts:sync[:staging|:prod]`).
  Test: 7 server + 8 client = 15 nuovi. Commit `—` (da fare).
- **Langfuse — Fase 3 A/B per cliente + CRUD prompt + media (2026-08-10)**
  (spec §9-11): `customers.promptLabels` jsonb + PATCH + override label in
  `/api/ai/prompt?customerId=`; UI CRM selettore default/production/
  experiment per prompt pilota; admin CRUD `POST/GET/DELETE /api/ai/prompts`;
  media multi-modale (upload base64 → token `@@@langfuseMedia` con dedup,
  placeholder se upload fallisce — mai raw base64 in trace); stream trace
  ora include `tool_calls` (Ollama NDJSON + DeepSeek SSE fragmentata).
  Migrazione `20260811143934_lyrical_misty_knight`. Test: +10 server
  (media, tool_calls, roundtrip carica→servi→cancella, override label),
  +1 UI CRM = 2997 verdi totali. Commit `—` (da fare).
- **Langfuse — fix root cause prompt remoti mai applicati (2026-08-10)**
  (spec §8): gli orchestratori card/quote/flyer usavano i builder diretti
  (`buildCardSystemPrompt()` ecc.) invece di `promptRegistry` → il prefetch
  remoto registrava gli override ma nessuno li leggeva, e le modifiche fatte
  su Langfuse non arrivavano al sito. Fix: i 3 orchestratori pilota ora
  passano da `promptRegistry.getPrompt('card-system'|'quote-system'|
  'flyer-system')` (builder locali restano come fallback registrato nel
  registry). Inoltre le immagini generate Gemini ora entrano nella trace:
  output `{mimeType, sizeKB, imageBase64}` → upload media → token
  `@@@langfuseMedia` renderizzato inline nella UI (placeholder se upload
  fallisce, mai base64 raw). Test: +1 card orchestrator (system prompt dal
  registry), +2 media output, +1 prefetch→registry roundtrip =
  **3001 verdi**. Commit `—` (da fare).

- **Server entrypoint Vercel — RISOLTO con framework=node (2026-08-10)**
  (gotchas §1.3): uscita dal monolite `api/index.ts` con pattern
  `server.ts` alla root. Prima diagnosi di fallimento (404 su `/api/*`,
  lambda bundle vuoto) = `framework: null` → trattato static-only; la
  detection automatica del framework avviene solo alla creazione progetto.
  **Fix**: PATCH project settings `framework: "node"` (preset Node,
  runtime `@vercel/backends`). Validato con progetto minimale poi su
  preview reale: GET config/logo-config 200, POST users/login 401
  (routing+body+DB ok), **SSE chat/stream 200 streaming**, SPA fallback
  200, 404 JSON. Build log: "Using server.ts as the root entrypoint".
  `server.ts` (http + body reader 4MB + statici dist/ + SPA fallback) +
  `src/server/handler.ts` (ex api/index.ts). Test API in
  `src/server/__tests__/`. 2947 test verdi + typecheck + build ok.
  Commit `de7fd94`. Progetti di test eliminati (srvtest, srvtest2).

## 2026-08-06

- **AI image quality — risoluzione per-uso 1K/2K, JPEG q85, Nano Banana 2
  Lite (2026-08-06)** (spec `spec-ai-image-quality`, gotchas §2.5):
  - Generazione per-endpoint: card-cover/card-photo/image-flash 1K (clamp
    500KB), flyer-hero/logo-background 2K (clamp 1.5MB, timeout 45s);
    `image_output_options` JPEG q85 su tutte le chiamate. Dev proxy
    allineato (dev == prod).
  - Deviazione dalla spec: `imageOutputOptions` camelCase NON esiste nel
    tipo SDK 2.10 (`ImageConfig_2`, interactions API) e il models API lo
    rifiuta lato Gemini API → usato snake_case `image_output_options`
    (wire verbatim) + cast TS, come da esempio §9 della spec stessa.
  - Nano Banana 2 Lite (`gemini-3.1-flash-lite-image`): registrato in
    `AI_IMAGE_MODELS` (default resta Nano Banana 2), pricing
    `gemini-nano-banana-lite` $0.02, forzato a 1K ovunque
    (`resolveImageSize` / `resolveGeminiImageSize`), mapping costi
    centralizzato `geminiImagePricingId` (3 ternari duplicati rimossi +
    costo hardcoded in `useAIIconHero`).
  - Fix bug latenti: retry auto-build `['512','256']` → `['1K','512']`
    (`'256'` non valido per zod → 400 silenzioso ad ogni retry);
    `aspectRatio` `'3:1'` rimosso dall'enum (non supportato da Gemini 3.1).
  - Persistenza path-aware: `compressDataUrl` default 1024px/400KB;
    background/hero 1536px/400KB; PNG con alpha resta PNG (downscale
    iterativo, mai fallback JPEG); website 1024/300KB.
  - Residuo: verifica Playwright densità px + live Gemini (to-be-done #2).

- **Design review tipografica card / logo / flyer + qualità output AI (2026-08-06)**
  (gotchas §27, criteri in `docs/design-criteria.md`):
  - **Card** (§27.1): reference frame unificato `CARD_REF 640×414`
    (export era ~22% più grande della preview); contatti retro 12.8→19px
    logici (≥7pt stampa); floor shrink frazionari DPI-independent; front
    export con wrap+clip; gerarchia 22/16/14; v2.19 socials/services al
    floor 16px logici.
  - **Logo** (§27.2): tagline = 0.42× wordmark fittato (era <40% e mai
    fittata → clipping/inversione); TEXT_AREA_EXTRA dedup; centramento
    verticale; backdrop per luminanza testo; font embed in export raster;
    thumbnail merge defaults.
  - **Flyer** (§27.3): floor stampa tutti i formati (headline 24pt/body
    10pt min, A6 max alzati); `scaledFontBounds` (fontScale non aggira i
    minimi); budget coerente; body export PDF/PNG ripristinato
    (`renderBodyAsText` — spariva nel PDF); `bodyPromptMaxChars` al font
    max ×0.85 per il prompt AI (era al min → body clippato senza ellipsis).
  - **Auto-build AI** (§27.4-27.5): textBackdrop 'pill' default su logo
    con backgroundImage; "text legibility zone" nel prompt immagini logo;
    sezione gerarchia/leggibilità cover in cardSystem; logo placeholder
    ("Brand") mai più salvato come successo (throw + badge errore).
  - Verifica: screenshot prima/dopo (`e2e/design-review.spec.ts`, browser
    reale) + run live AI su cliente demo "La Chiccheria"
    (`scripts/design-review-ai-gen.mjs`) + validazione template Giovanni
    no-AI. Test: typecheck + suite verde.



- **Auto-build website PROD — timeout 60s sincrono → SSE (2026-08-05)**
  (gotchas §26.24):
  - "Genera bozze AI" in PROD falliva sul website: Vercel Hobby limita le
    richieste sincrone a 60s (streaming 300s) → CSS 100-130s/JS 90s
    uccisi. Fix: `onStream` SEMPRE attivo (no-op se assente) → tutti gli
    step website (html/css/js/page/verify) su SSE anche in auto-build.
  - `generateWebsiteDraft` salva `pagesHtml` (mancava) + costo da
    `aiCall.costUsd`.
  - Test: matrice 3 provider con tutti gli step SSE. Gate: typecheck +
    541 test verdi. Validazione live PROD da fare (to-be-done #3).
- **Website verify — fix automatici di qualità + guardia anti-distruzione (2026-08-05)**
  (gotchas §26.23):
  - Il verify segnalava 5 problemi reali (iframe title, emoji CTA,
    aria-label, hero senza classe) ma NON li risolveva: la guardia §26.16
    rifiutava i fixes perché il codice originale era integro.
  - **Guardia basata sul FIXATO**: fix accettato se integro
    (`analyzeSiteCode(fix).ok`) E ≥60% dell'originale (blocca le
    riscritture che perdono mappa/contatti). I fixes di qualità ora
    passano; quelli distruttivi vengono bloccati.
  - **Pass 2 applica i fixes** e il pannello mostra le issue
    DETERMINISTICHE residue del recheck (mai false-positive).
  - Test: orchestrator 23 (fix qualità accettato, distruttivo rifiutato,
    recheck deterministico). Gate: typecheck + suite verde.
- **Website — velocità reasoning per-step + verify senza tools + ERR_INVALID_URL hardening (2026-08-05)**
  (gotchas §26.22):
  - **Lentezza 16 min**: causa = `reasoningEffort: 'max'` (think:max) su
    tutti gli step (CSS 180s, JS 91s, Verify 194s). Fix: `max` solo per
    HTML/pages/refine, `high` per CSS/JS/Verify. maxTokens RESTA 16384
    (8k troncherebbe il JSON → 400/parse-fail → CSS/JS persi).
  - **Verify 400 "can't find closing '}'" — causa definitiva**: formato
    tool_calls divergente (Ollama = arguments OBJECT + tool_name; DeepSeek
    = arguments string + tool_call_id). Fix radicale: **eliminati i
    tool_calls precompilati** — i risultati `analyze_site` passano nel
    messaggio user. Zero 400, niente retry, niente follow-up.
  - **ERR_INVALID_URL hardening**: regex `imageNormalize` estesa (src
    senza quote, prefisso sporco, apici singoli); logo upload compresso a
    ≤140K (sotto soglia preview); onclone html2canvas con placeholder 1px.
  - Test: orchestrator 23 + matrice 3 provider 6 (verify senza tools +
    RISULTATI nel prompt = anti-400) + imageNormalize 9 + verifyBody 3.
    Gate: typecheck + 541 test verdi.
- **Website — timeout Ollama 600s + step best-effort (2026-08-05)** (gotchas
  §26.20):
  - **502 "This operation was aborted"** (6 min): dev proxy timeout 300s
    troppo corto per Ollama thinking 'max' + 16k tok → alzato a 600s
    (vite.config.js). **Prod `api/index.ts` timeout Ollama 60s → 600s**
    (a 60s il CSS da 100-130s falliva SEMPRE in prod — sito mai generato).
  - **Step CSS/JS/pagine best-effort**: timeout/errore → changes
    `error:css/js/page:<msg>`, campo vuoto, sito COMUNQUE generato
    (solo HTML e Verify critici). Mai più sito perso per uno step.
  - `totalCost` null-safe (response null da step falliti).
  - Test: orchestrator 24 (CSS/JS/pagina falliti → sito ok). ⚠️ Riavvio
    dev server richiesto.
- **Website verify — dev proxy tools + test 3 provider (2026-08-05)**
  (gotchas §26.19):
  - **Causa 400 finale**: il dev proxy (`proxyOllamaChat`) NON propagava
    `tools` nel body upstream → Ollama rifiutava i tool_calls precompilati
    (400 "can't find closing '}' symbol"). Fix in `vite.config.js`
    (PROD già OK in `api/index.ts:1373`).
  - **Test 3 provider**: `verifyBody.test.ts` (serializzazione body con
    content '' + tools per minimax-m3/0731/deepseek-v4-flash),
    `websiteOrchestrator.providers.test.ts` (flusso completo generateSite
    con provider reali, incluso step HTML via SSE con onStream),
    regressione `viteDevProxy.test.ts` (tools propagati upstream).
  - ⚠️ Serve **riavvio dev server** per applicare il fix vite.config.
  - Gate: typecheck + 533 test verdi.
- **Website vision — ERR_INVALID_URL risolto (2026-08-05)** (gotchas
  §26.18.5): la causa era il **base64 wrapped** (whitespace letterali nel
  payload data URL) che Chrome rifiuta in about:srcdoc/clone html2canvas.
  Nuova util `imageNormalize.ts` (`normalizeInlineImages`): strip
  whitespace dai payload base64 (src img + background-image inline) e
  img >50KB → 1px GIF. Applicata alla srcDoc dell'iframe vision + doppia
  difesa nel onclone html2canvas. Test `imageNormalize.test.ts` (5).
- **Website verify — content '' per Ollama + retry + best-effort (2026-08-05)**
  (gotchas §26.18):
  - **Bug: generazione moriva sul verify** — `content: null` nei messaggi
    assistant con tool_calls = body JSON malformato per Ollama → 400
    "can't find closing '}' symbol" → eccezione → SITO PERSO (html/css/js
    validi buttati). Ora `content: ''` (stesso pattern card/flyer che
    funzionano in prod).
  - **Retry senza tools**: se la chiamata con tools fallisce, retry una
    volta senza tools (changes `verify:tools-retry`).
  - **Verify best-effort**: se anche il retry fallisce, il sito viene
    comunque restituito (verify saltato, `verify:error:<msg>` nei log) —
    mai più perdere un sito per colpa della verifica.
  - **ERR_INVALID_URL html2canvas**: data URL >300KB troncato nel clone
    iframe → sostituito con placeholder trasparente via `onclone` (DOM
    reale intatto, rumore console eliminato).
  - Test: orchestrator 21 (retry 400, best-effort, content ''). Gate:
    typecheck + 193 test impattati verdi.
- **Website verify — tools dichiarati + maxTokens (2026-08-05)** (gotchas
  §26.17):
  - **Bug: verify morto dopo "pass 1 (con analyze_site)"** — tool_calls
    precompilati NON dichiarati in `tools` → Ollama/DeepSeek rifiutano
    (400 silenzioso, nessun log, costo mai aggiornato). Ora `tools:
    ANALYZE_SITE_TOOLS` dichiarato nella richiesta.
  - **Bug: 400 "can't find closing '}' symbol"** — HTML 97s troncato da
    `maxTokens: 8192` (il sito completo usa >10k tok) → JSON incompleto
    rifiutato da format:json. Ora 16384 su tutti gli step.
  - **Tool-call del modello gestiti**: se il verify invoca analyze_site da
    solo (content null + toolCalls), il tool viene eseguito e si fa una
    chiamata finale senza tools. Prima → verify morto su parseJson.
  - Costo: verifyCost include verify + follow-up; badge $0/flat con Ollama
    (corretto, non è un bug: `showCost = !isFlat`).
  - Test: orchestrator 19 (tools dichiarati, tool-call gestito).
    Gate: typecheck + suite impattata verde.
- **Website verify — fix AI rifiutati se codice integro (2026-08-05)**
  (gotchas §26.16):
  - **Bug reale**: il modello segnalava "troncato" (false positive) anche
    col codice completo, e i suoi fixes RISCOSCRIVEVANO il sito buono
    (persi mappa/contatti/form); canonical verso Instagram inventata;
    og:description con emoji.
  - **Tool deterministico = fonte di verità**: fix AI applicato SOLO se
    `analyze_site` conferma il problema su quella parte (parte integra →
    fix rifiutato, codice buono preservato). Recheck deterministico nel
    pass 2: codice integro → issue del modello scartate, niente pannello
    allarmi; solo problemi reali residui mostrati.
  - **`stripSocialCanonical`**: canonical verso social rimossa
    (l'AI la inventa dal brief → SEO critico).
  - **`ensureSeoMeta` sanitizza anche i meta GIÀ generati** (emoji/a capo
    nei content, es. brief "🦐 Tre coni\n@gambero_rosso").
  - Test: orchestrator 18 (fix rifiutato/accettato, recheck), seoMeta 13
    (canonical, sanitize). Gate: typecheck + 531 test verdi.
- **Website verify determinismo — analyze_site tool + loop 2 pass (2026-08-05)**
  (gotchas §26.15):
  - **Root cause "HTML/CSS/JS troncati"**: il prompt verify TRONCAVA il
    codice (`slice(0, 2000/1000)`) → il verify agent segnalava problemi
    inesistenti e "fixava" roba non rotta. Ora il codice passato è COMPLETO.
  - **Tool deterministico `analyze_site`** (DeepSeek e Ollama lo
    supportano): verifica pura lato client — tag HTML bilanciati,
    parentesi CSS/JS (troncamenti reali), ::before/::after con content
    non vuoto, img senza alt, iframe senza title, emoji nel testo.
    Risultati precompilati come toolCalls+tool results nel messaggio.
  - **Loop verify max 2 pass**: pass 1 issue+fix, pass 2 recheck; pannello
    solo se restano problemi RESIDUI (prima mostrava le issue anche se
    risolte). Costo 2 pass sommato.
  - **SEO meta fix**: contenuto sanitizzato (niente emoji/a capo
    letterali — il brief produceva og:description malformato e
    incoerente), OG dopo charset/viewport, og:description coerente con la
    meta description esistente.
  - Test: siteAnalyser 12, seoMeta 9, orchestrator 15 (tool+loop), prompts
    12. Gate: typecheck + 524 test verdi.
- **Website Builder — multi-pagina reale + regole stile verify (2026-08-05)**
  (gotchas §26.14):
  - **Multi-pagina reale**: nuovo campo schema `pagesHtml`
    (`Record<nome, html>`); orchestrator genera HTML DEDICATO per ogni
    pagina secondaria (step `page:<nome>`, prompt `website-page`, nav
    identica estratta da index, SEO meta anche sulle pagine). CSS/JS/Verify
    ora vedono TUTTE le pagine (prima solo index → pagine senza stile).
    Editor: page switcher in preview (link relativi funzionano, asset
    condivisi) e nel code editor, logo iniettato su ogni pagina, save
    dedupe immagini su tutte. Export ZIP: `about.html` con contenuto vero
    (prima era index svuotato). Refine con merge `pagesHtml`. Costo pagine
    sommato. Fallback robusto se una pagina fallisce.
  - **Prompt verify**: check espliciti 12-14 — NIENTE `::before/::after`
    con content testo/icone/emoji (`content: ""` obbligatorio), NIENTE
    `<svg>` salvo richiesta del brief, niente emoji nel testo. Prompt
    HTML/CSS allineati (divieto SVG esplicito).
  - **Bug latente fixato**: `cleanupGhostDocuments` ora conserva i website
    FLAT (`html/css` al top level) — prima li avrebbe cancellati come
    fantasma.
  - **Fix lampeggio step indicator**: `currentStep` non si resetta più tra
    gli step (reset esplicito a fine generate/refine).
  - Test: orchestrator 12 (multi-pagina happy/fallita, refine pagesHtml),
    websiteSystem 13 (page prompt, verify rules, SVG ban), export 8
    (contenuto dedicato + fallback), roundtrip 8 (save/load pagesHtml +
    export reale), hook 6. Gate: typecheck + 521 test verdi.
- **Website Builder — backlog miglioramenti (2026-08-05)** (gotchas §26.13):
  - **Test unitari mancanti**: `websiteOrchestrator.test.ts` (8: happy path
    con SEO, verify fixes applicati, issues senza fixes, fallback html
    non-JSON, onStep 4 step, refine merge parziale/errore/onStep) +
    `useAIWebsite.test.ts` (6: stato iniziale, step wiring, log/costo,
    errore → hint, refine, reset). Regola AGENTS ≥60% soddisfatta.
  - **Verify feedback → fix applicati**: i `fixes` del Verify agent ora
    vengono applicati al codice finale (html/css/js), non solo loggati.
    Fix identico al codice = saltato (no changes fantasma).
    `verifyFixesApplied` espone le parti corrette.
  - **SEO head post-process**: `ensureSeoMeta` inietta `meta description` +
    OG tags dal brief se l'AI li omette (mai duplicati, escape XML,
    `og:type=website` di default). Applicato prima del CSS/JS/Verify.
    Log `seo:meta-injected`. Test `seoMeta.test.ts` (7).
  - **Accessibilità nel prompt verify**: check WCAG AA espliciti (alt,
    form label, aria-label su icon-button, iframe title, contrasto,
    raggiungibilità tastiera).
  - **Step progress UI**: `useAIWebsite.currentStep` (html/css/js/verify/
    refine) → indicatore con spinner + label sotto "Genera sito".
  - **Vision preview cache**: screenshot riusati se html+css+js invariati
    (html2canvas ~700ms × 2 viewport saltati a ogni refine/generate).
  - **Provider default stale**: `getValidatedProviderDefault(registry)` —
    pref `aiProviderDefault` morta in `pq_ui:v1` → default registry +
    pref ripulita. Usato da AIProviderBadge, AppShell, CardEditorShell,
    WebsiteEditor (il badge prima mostrava un ID vecchio). Test uiPrefs (3).
  - **Save quota dedupe**: già risolto in §26.12 (nessun codice nuovo).
  - Non fatto (deciso): **multi-pagina reale** → single-page accettata
    (backlog residuo in to-be-done.md).
  - Gate: typecheck + 675 test verdi (suite impattata).

- **Website Builder — preview SVG reale + fixes save/export (2026-08-05)**:
  - **Preview Collection/CRM reale**: `buildWebsitePreviewSvg` ora renderizza
    HTML/CSS del sito dentro `<foreignObject>` (contenuti, colori, layout
    veri, non più mockup). CSS scoped con parser custom (`scopeCss`):
    `:root`/`body`/`html` → wrapper `.ws-preview`, selettori prefixati,
    `@media`/`@supports` ricorsivi, `@keyframes`/`@font-face` globali.
    `<script>` e `on*` attrs strippati (sandbox). Viewport fedele: media
    query mobile nel CSS → 375px (layout mobile vero), altrimenti 320px.
    Badge pagine overlay se multi-pagina. Fallback placeholder se sito
    senza codice o HTML vuoto dopo strip. Test `docPreviewSvg.test.ts` (9).
  - **Memoizzazione preview**: `DocPreview` component in CollectionView
    (`useMemo` su `[doc]`) — 1 chiamata per card, niente ricalcolo a ogni
    re-render; altezza preview website 160px.
  - **Export ZIP da Collection** (REQ-060): bottone ZIP sul card website;
    `src/utils/websiteExport.ts` condiviso editor+Collection
    (`exportWebsiteZip`, `buildWebsiteFullDocument`), JSZip/saveAs rimossi
    dall'editor. Bottone disabilitato se sito senza codice.
  - **Fix save quota localStorage**: (a) `handleSave` dedupes le immagini
    già iniettate nell'HTML (non restano in `images[]` — doppione → quota);
    (b) `compressPayloadImages` esteso ai campi website: immagini base64
    dentro `html`, `logoUrl`, `images[]` compressi a 768px/200KB pre-save
    (prima nessun path fisso li copriva → QuotaExceededError → save
    falliva silenziosamente). try/catch su compressione (immagine non
    comprimibile resta originale).
  - **Fix test stale TB-028**: `CollectionView.tabs.test.tsx` (8 tab admin,
    7 non-admin, "Siti Web" incluso), `useRouteView.test.tsx` (11 chiavi
    ROUTE_PATHS).
  - Test: `docPreviewSvg.test.ts` (9), `websiteExport.test.ts` (5),
    `websiteRoundtrip.test.ts` (6 — save/load/export integrazione JSZip
    reale). Typecheck verde.

## 2026-08-04

- **Harness upgrade v2 — thinking/tool/KV-cache/structured (allineamento
  doc ufficiali DeepSeek + Ollama)**: 
  - **CRITICO fix multi-round tool calls**: `handleStream` ora accumula
    `reasoningContent` dai chunk e gli orchestratori (quote/card/flyer) lo
    ripassano nel messaggio assistant con `toolCalls`. Senza, DeepSeek
    thinking-mode risponde 400 su richieste con `tools` (doc thinking_mode →
    tool_calls).
  - **KV cache DeepSeek**: `parseUsage` legge `prompt_cache_hit_tokens` →
    `usage.cachedTokens` (client + proxy stream). Basis per costo reale
    cache hit futuro.
  - **Structured outputs Ollama**: nuovo `ChatOptions.jsonSchema` →
    `format: <schema>` (doc structured-outputs, non solo `'json'`).
  - **Streaming Ollama proxy**: `message.thinking` propagato come
    `delta.reasoning_content` nel SSE (doc streaming → thinking).
  - Test: `BaseOrchestrator.reasoning.test.ts` (4), base cache tokens,
    ollamaPro jsonSchema. Vedi `docs/agent-gotchas.md` §26.
- **Provider `ollama-deepseek-v4-flash-0731`**: tag mensile Ollama Pro Cloud
  `deepseek-v4-flash:0731-cloud` (flat $20/mo), label UI "V4 Flash 0731",
  pricing, test registry. Model corretto da `:0731` → `:0731-cloud`
  (suffisso `-cloud` obbligatorio per Ollama Pro Cloud).
- **Selettore UI reasoningEffort (Veloce/Profondo/Massimo)**: aggiunto nel
  dropdown `AIProviderBadge` — selettore a 3 livelli che persiste in
  `pq_ui:v1` (`aiReasoningEffort`, default `max`). Priority chain:
  `options.reasoningEffort` → `getAiReasoningEffort()` → `'max'`.
  Ollama `think` e server proxy mappano `reasoning_effort`. Test: uiPrefs,
  AIProviderBadge, base. Vedi `docs/agent-gotchas.md` §26.
- **Website Builder — fixes prompt, mappa, logo, font, costo (2026-08-04)**:
  - **Mappa Google con pin**: `maps.app.goo.gl/<codice>` non funziona come
    `q` nell'iframe (mondo senza pin). Fix: iframe già completo e
    sanitizzato nel prompt + `sanitizeMapAddress()` (strip emoji, indirizzo
    + città) → `q=Via+Dante+5%2FA+Cagliari`. Test dedicato.
  - **Emoji vietate nel brand/hero**: prompt HTML vieta emoji nel testo
    visibile (prima l'AI metteva 🍦 dal brief).
  - **Font del brief con priorità massima**: la firma stile descrive solo
    peso/forma/lettering; `--font` DEVE essere il font richiesto dal brief.
  - **Logo**: l'AI non genera mai `<img>`/`<svg>` logo/`brand-mark`; il
    `.brand` contiene solo il nome. Iniezione dopo via `injectLogoIntoHtml`.
  - **Stile pill senza refine automatico**: `updateStyle` salva solo la
    preferenza + toast "Premi Raffina"; il refine parte solo su click.
  - **Costo admin corretto**: `trackUsage` calcola e ritorna il costo anche
    per admin (solo `trackTokens` server-side saltato) → badge non più $0
    con DeepSeek. `aiCall.costUsd` = somma 4 step.
  - **Log AI dettagliati**: preview 300/500 char, durata + token per step,
    prime 3 issue verify nel log.
  - Test: `websiteSystem.test.ts` (7), `BaseOrchestrator.cost.test.ts` (6).
    Vedi `docs/agent-gotchas.md` §26.
- **Website Builder — gallery, vision preview, salvataggio, export (2026-08-04,
  commit 28e6259 → 97289b1)**:
  - **Gallery immagini**: `injectImagesIntoHtml` riempie i `.gallery-item`
    (div o button) con le immagini caricate; se non c'è gallery aggiunge una
    sezione `#gallery`; rimuove i placeholder vuoti. Prompt: gallery-item
    vuoti senza `<img>`/emoji/`<button>`.
  - **Vision preview via html2canvas**: container offscreen → iframe srcdoc
    ISOLATO (il CSS del sito non contamina il DOM app — bug colore bottoni
    risolto). Cattura desktop (1024) + mobile (375), compresse a 40KB
    (evita ERR_CONNECTION_RESET sul body proxy). Fallback foreignObject.
    Attivo solo se vision ON + provider vision.
  - **Salvataggio >1MB**: bodyParser API `1mb` → `4mb` (limite Vercel
    Hobby). Compressione immagini upload 512px/60KB (duplicate inline+array,
    quota localStorage).
  - **Ollama images base64 puro**: `buildOllamaBody` strippa il prefisso
    `data:...;base64,` dalle immagini (400 illegal base64 altrimenti).
  - **Export ZIP con assets/**: nuova `src/utils/websiteExport.ts` condivisa
    editor+Collection — immagini/logo in `assets/` con src relativi,
    file `.html` per pagina. Test `websiteExport.test.ts` (5).
  - **Dev proxy ERR_HTTP_HEADERS_SENT**: errore stream inviato come SSE se
    gli header sono già partiti (no crash server).
  - **Sandbox iframe preview**: `allow-scripts allow-same-origin` (Google
    Maps embed funzionante).
  - **Logo robusto**: classe unica `qb-site-logo` + inline `!important`
    (il CSS AI non lo sovrascrive).
  - **Pseudo-elementi emoji vietati**: prompt + `sanitizeGeneratedWebsite`
    post-generazione (rimuove `::before/::after` con content emoji, div
    decorativi vuoti).
  - **Stile pill → precompila refine**: clic su stile compila il prompt
    "Applica lo stile X" (basta premere Raffina).
  - **Verify issues nella UI**: pannello toast con le issue del Verify
    agent dopo generate/refine (`verifyIssues` nel result).
  - Test: `imageInjection.test.ts` (7), `sanitizeGenerated.test.ts` (7),
    `websiteExport.test.ts` (5).

## 2026-08-03

- **Selettore UI reasoningEffort (Veloce/Profondo/Massimo)**: aggiunto nel
  dropdown `AIProviderBadge` — selettore a 3 livelli che persiste in
  `pq_ui:v1` (`aiReasoningEffort`, default `max`). `BaseAIProvider.buildRequestBody`
  legge `options.reasoningEffort ?? getAiReasoningEffort()`. Test: uiPrefs
  (persistenza + default), AIProviderBadge (render selettore + click),
  base (default e custom). Vedi `docs/agent-gotchas.md` §26.
- **Website 4-step generation (spec-design-website-4step-generation)**: HTML → CSS → JS → Verify con 4 agenti separati, fresh session per step, non-stream per CSS/JS/Verify (solo HTML stream), `reasoningEffort: 'max'`, `maxTokens: 8192` per tutti, `onStep` callback per log separati, maps embed URL conversion, brand flex rule, rail padding-bottom 72px per ActionBar. Spec creata e cancellata.
- **Website Builder (TB-028) — implementazione completa**: nuovo tipo documento `website` con editor dedicato, AI orchestrator, preview iframe con viewport toggle (375/768/100%), code editor (CodeMirror 6 installato), export ZIP multi-pagina, integrazione CRM auto-build + Collection + CustomerDetail. 6 file creati, 18 modificati. Spec `spec-design-website-builder.md` v1.2 (cancellata 2026-08-06).
  - Upload logo/immagine brand (sidebar, compressDataUrl, `logoUrl` nello schema)
  - Vision AI sul logo: estrazione SOLO palette colori e stile font (non layout/contenuti)
  - Logo iniettato nell'HTML generato dopo `<nav>`/`<header>`/`<body>`
  - AIProviderBadge nella sidebar per selezione provider AI
  - Auto-save saltato durante generazione AI (`isProcessingRef` guard)
  - Raffina: modifica sito esistente con merge parziale (non rigenera da zero)
- **TB-027i — rimosso avviso "Brief da lavorare" da Collection**: IntakeList
  rimosso da CollectionView, file `IntakeList.tsx` cancellato, CSS intake
  rimosso da `crm.css`. I brief sono visibili solo via CRM.
- **TB-027i — API intake upsert by sourceRef**: `POST /api/intake` ora
  UPDATE il record esistente se sourceRef già noto (invece di 409). Risposta
  200 con `updated: true`. Script `intake-google-form.gs`: helper
  `sendToWebhook(payload)` condiviso, funzione `aggiornaRiga(row)` per
  correzioni foglio. Test aggiornati (idempotency 200, upsert campi).
- **TB-027i — auto-refetch su focus tab**: hook `useRefetchOnFocus` creato
  (visibilitychange → visible). Usato in CustomersPage (refetch lista) e
  CollectionView (refreshDocuments). Zero polling.

## 2026-08-01

- **Google Form intake operativo** (TB-019, spec `spec-google-form-intake-operativo.md`
  completata e rimossa 2026-08-01, script `scripts/intake-google-form.gs`
  mantenuto e versionato): form 4 sezioni + branching sito (via
  `item.createChoice`, NON `FormApp.createChoice` — non esiste in runtime),
  Sheet risposte collegato, trigger `onFormSubmit` → `POST /api/intake`
  (webhook provider-agnostico). Bootstrap testato live: form creato,
  risposta inviata, webhook raggiunto. Fix in questa sessione:
  `makeFormPublic()` (Access ANYONE_WITH_LINK — i form `FormApp.create`
  non sono pubblici di default, "Non condiviso"); `item.createChoice` per il
  go-to-section; `reconnectFormSheet()` (ri-collega form esistente a nuovo
  Sheet + trigger dopo cancellazione foglio); `resendRowToWebhook(N)` per
  re-inviare righe fallite dal foglio (onFormSubmit è un trigger, non si
  lancia a mano); **dedup customer** nel webhook: stesso email (fallback
  businessName) → UPDATE del customer esistente invece di duplicato;
  `mood` ("Stile/atmosfera") era `varchar(100)`/`max(100)` e rifiutava i
  testi liberi del form → `text()`/`max(1000)` + migrazione + `errors` nel
  body 400. Guida: `docs/intake-google-form-setup.md` (progetto Apps Script
  da nominare **Quickbrandformv1**). Nota API: clienti esterni non vengono
  importati — l'intake è l'unica porta d'ingresso automatica.

## 2026-07-31

- **Audit responsiveness + migrazione breakpoint canonici** (spec completata
  e rimossa 2026-07-31): tutti i breakpoint
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
  (gotchas §17, spec `spec-architecture-crm-auto-build.md`, cancellata 2026-08-06).
- **TB-019** Intake pipeline → porta ingresso CRM: tabella `intakes`,
  `/api/intake` pubblico, IntakeList in CRM, intake → record cliente
  (spec `spec-intake-pipeline.md`, cancellata 2026-08-06).

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
  ai-first-ux-redesign, ai-harness-upgrade, card-nudge-layout-template,
  architecture-crm-auto-build, intake-pipeline, design-website-builder.
