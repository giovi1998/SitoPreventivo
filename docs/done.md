# Done — Quickbrand

Colonna "Done" della kanban. Dettaglio tecnico: `agent-gotchas.md`
(sezioni indicate per voce). Storico completo: git history.

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

## 2026-08-05

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
