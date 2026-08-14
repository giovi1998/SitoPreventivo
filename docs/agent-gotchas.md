# Agent Gotchas (dettaglio completo)

Dettaglio completo delle regole/gotchas riassunte in `AGENTS.md`.
Contenuto spostato qui per mantenere AGENTS.md sotto i 32 KB.
Leggere la sezione pertinente prima di toccare il modulo corrispondente.

---

## 1. Vercel function bundling — lessons learned

Quattro tentativi storici di refactorare la struttura API ruppero la
produzione; il quinto (server entrypoint, 2026-08-10) ha FUNZIONATO.

1. `f004e5e` (split in `api/lib/` + `api/routes/`): superato il limite di 12
   funzioni Hobby. Vercel conta ogni `.ts` in `api/` come funzione.
2. `036ae25` (codice condiviso in `api/_lib/` + `api/_routes/` con underscore):
   il prefisso `_` esclude i file SIA dal conteggio SIA dal bundle. Le
   funzioni non trovavano il codice condiviso → `ERR_MODULE_NOT_FOUND`
   a runtime ("Cannot find module '/var/task/api/_lib/handler'").
3. `5e2971f` (`vercel.json` `functions.includeFiles`): copia i file ma non
   li transpila. Ancora `ERR_MODULE_NOT_FOUND`.
4. `05b17e6` (rollback al monolite): rimosse le rewrite
   `{"source": "/api/(.*)", "destination": "/api"}` insieme allo split.
   Senza di esse, Vercel cadeva sulla catch-all SPA `/(.*) -> /index.html`
   e rispondeva **405 Method Not Allowed** a ogni POST `/api/*` (index.html
   è uno static asset che non accetta POST).

**Conclusione attuale (2026-08-10, commit `de7fd94`)**: il pattern
"server entrypoint" (docs/functions/runtimes/node-js) è la via giusta:
`server.ts` alla root + preset framework `node` nel project settings
(runtime `@vercel/backends`) = UNA Vercel Function che riceve tutto, con
import da `src/` risolti (la root della funzione è la root del progetto).
Niente rewrites in `vercel.json` — il server gestisce `/api/*` + statici
`dist/` + SPA fallback. Dettagli e setup in §1.3. Regression test:
`src/__tests__/vercelConfig.test.ts`.

### 1.1 Cross-boundary `api/` → `src/` — SUPERATO

Il cross-boundary era specifico del vecchio setup `api/index.ts` (il
bundler tracciava `api/` come entry point separato → `src/` fuori dal
bundle, `ERR_MODULE_NOT_FOUND`). Con il server entrypoint (`server.ts` alla
root) la root della funzione è la root del progetto: **gli import da
`src/` funzionano**. `api/` è stata eliminata (commit `de7fd94`). La
costante `OLLAMA_PRO_FLAT_MONTHLY` resta inlined in `src/server/handler.ts`
per coerenza con i test che la importano.

### 1.3 Server entrypoint `server.ts` — RISOLTO (2026-08-10, framework=node)

Il pattern documentato (`docs/functions/runtimes/node-js`: `server.ts` alla
root con `server.listen()` = unica Vercel Function; root funzione = root
progetto → import da `src/` risolvono) FUNZIONA, ma richiede il preset
framework **`node`** esplicito nel project settings.

**Prima diagnosi (errata)**: deploy con `framework: null` → 404 su `/api/*`,
lambda `entrypoint: "."` con `output: []` (bundle vuoto). Causa reale: la
detection automatica del framework avviene SOLO alla creazione del progetto
(dashboard/git import); al deploy CLI con progetto esistente Vercel usa le
settings così come sono → `framework: null` = trattato come static-only.

**Fix**: `PATCH /v9/projects/<name>` con `{"framework": "node",
"outputDirectory": null}` (il preset Node, `slug: 'node'` in
`packages/frameworks/src/frameworks.ts`, usa il runtime `@vercel/backends`
e rileva `server.ts`/`server.js`/`server.mjs` alla root o in `src/`).
Build log conferma: `Build complete - Using server.ts as the root
entrypoint.`

**Setup attuale** (commit `de7fd94`):
- `server.ts` alla root: http server + body reader 4MB + statici da `dist/`
  + SPA fallback. `src/server/handler.ts`: ex `api/index.ts` verbatim.
- `vercel.json`: SOLO `buildCommand` (niente rewrites, niente
  outputDirectory — il server serve `dist/` a runtime).
- Project settings: `framework: "node"`, `buildCommand:
  "npm run db:migrate && npm run build"`, `outputDirectory: null`.
- Test API in `src/server/__tests__/` (path import `../handler`).
- Validato su preview: GET config/logo-config 200, POST users/login 401
  (routing+body+DB ok), SSE chat/stream 200 streaming, SPA fallback 200,
  404 JSON. Import da `src/` risolvono (cross-boundary §1.1 superato per
  il server; `api/` non esiste più).

⚠️ Se il progetto venisse ricreato da zero: `vercel link` + PATCH framework
`node` (o import git che auto-detecta). Mai `framework: null`.

### 1.2 Lazy `getDb()` — operator precedence (§1.2)

Quando `getDb()` diventa async (per dynamic import di
`drizzle-orm/neon-http` ESM-only), il pattern:

```ts
// ❌ SBAGLIATO — await copre solo getDb(), NON la catena query
const [row] = (await getDb()).select().from(table).where(cond);
```

Fallisce con `object is not iterable` perché `.where()` restituisce la
chain (thenable), non l'array. La distruzione `const [row] = chain`
cerca `Symbol.iterator` sulla chain, che non ha iteratore.

**Fix**: aggiungere `await` sulla catena query:

```ts
// ✅ CORRETTO — await risolve la query Drizzle (NeonQueryPromise → Array)
const [row] = await (await getDb()).select().from(table).where(cond);
```

**Regola**: OGNI chiamata DB in `src/server/handler.ts` deve avere `await` prima
della catena query (select, insert.values().returning(),
update.set().where().returning(), delete.where()). Anche le fire-and-forget
(devono avere `await` per propagare errori). Pattern corretto:

```ts
await (await getDb()).update(table).set({...}).where(cond);
await (await getDb()).delete(table).where(cond);
const [row] = await (await getDb()).select().from(table).where(cond);
const list = await (await getDb()).select().from(table).orderBy(cond);
```

**Test mock**: la select chain mock DEVE avere `then(resolve)` per essere
thenable (`await chain` → `chain.then(resolve)` → risultato). Senza
`then()`, `await chain` restituisce la chain stessa e la distruzione fallisce.
Pattern mock:

```ts
function makeSelectChain() {
  const chain: any = {
    from: vi.fn(function (this: any) { return this; }),
    where: vi.fn(function (this: any) { return this; }),
    orderBy: vi.fn(function (this: any) {
      return mockDbState.selectResults.shift() ?? [];
    }),
    then(resolve: any) {
      const result = mockDbState.selectResults.shift() ?? [];
      resolve(result);
    },
  };
  return chain;
}
```

Se `.orderBy()` è chiamato prima di `then()`, il mock deve fare shift
una sola volta (`.orderBy()` restituisce direttamente l'array, `then()` non
viene invocato perché `.orderBy()` rompe la catena con un valore non-chain).
Verificare che il numero di `selectResults` preparati corrisponda alle
query effettive nel code path testato.

## 2. Logo AI / Gemini background gotchas

Due bug distinti hanno bloccato la generazione background per un intero
ciclo; nessuno era nel provider Gemini in sé.

1. **Path proxy dev deve combaciare char-per-char col client/prod**. Client
   (`LogoAiPanel.tsx`) e `src/server/handler.ts` usano `/api/ai/logo-config` +
   `/api/ai/logo-background`. Il middleware dev in `vite.config.js`
   intercettava `/api/logo-config` (senza `/ai/`): fetch falliva
   silenziosamente, `config.provider` restava `'none'`, ramo background
   skippato lato client senza nessun log.
2. **`process.env` non popolato di default nel dev server**. Vite espone
   `.env` solo via `import.meta.env`; il codice server in `vite.config.js`
   vede `process.env` vuoto. Fix: `loadEnv(mode, process.cwd(), '')` in
   testa a `vite.config.js`, merge manuale in `process.env`.
3. **Non duplicare la logica del provider nel middleware dev**. In passato
   il middleware aveva una chiamata REST inline a Gemini (modello/API
   diversi da `gemini.ts`), dev e prod divergevano. Ora usa
   `server.ssrLoadModule('/src/ai/providers/gemini.ts')` e riusa la stessa
   classe di produzione.
4. **`interactions.create()` vuole `response_modalities` minuscolo**
   (`['text', 'image']`), non `['TEXT', 'IMAGE']` (vecchia REST
   `generateContent`). Maiuscolo → `400: value 'TEXT' is not supported`.
5. **Risoluzione 1K uniforme + Nano Banana 2 Lite (spec ai-image-quality,
   2026-08-06; correzione probe live 2026-08-07)**: la pipeline era
   bloccata a 512px → immagini pixelate su aree grandi (card 1004×650,
   hero A4 2362×1358, logo export 2048). Ora tutti gli endpoint chiedono
   `image_size: '1K'` (1K JPEG ~550-990KB misurati) con clamp uniforme
   **1.2MB** (`GEMINI_IMG_CLAMP_BYTES` in `src/server/core.ts`); logo-background e
   flyer-hero con timeout 45s. Il 2K non si usa mai: 2752×1536 ≈ 3.2MB →
   ~4.4MB base64 supera il limite risposta Vercel 4.5MB. **Clamp 1MB era
   troppo stretto**: 16:9 1K JPEG varia 850KB-1.05MB → 413 intermittenti
   su logo-background (verifica live 2026-08-13) → alzato a 1.2MB
   (~1.6MB on the wire, margine ampio sul 4.5MB).
   - **Mai `image_output_options`/`output_mime_type` sulle interactions
     API**: probe live 2026-08-07 → `400 Unknown parameter`. JPEG è già
     l'output default di `gemini-3.1-flash-image`, nessun output control
     necessario.
   - **Nano Banana 2 Lite (`gemini-3.1-flash-lite-image`)**: solo 1K →
     `resolveGeminiImageSize` (server) / `resolveImageSize` (provider)
     forzano `'1K'` su qualunque endpoint. Pricing
     `gemini-nano-banana-lite` $0.02; mapping centralizzato
     `geminiImagePricingId` in `providerPricing.ts`.
   - `image-flash` zod: `size` enum `['512','1K']` default `'1K'` (`'256'`
     non valido — il vecchio retry auto-build `['512','256']` falliva con
     400 silenzioso; ora `['1K','512']`); `aspectRatio` enum esteso ai
     rapporti supportati da Gemini 3.1 (rimosso `'3:1'`).
   - Persistenza path-aware: `compressDataUrl` default 1024px/400KB;
     background/hero 1536px/400KB (`dataService/images.js`); PNG con alpha
     resta PNG (downscale iterativo, mai fallback JPEG). **Anche il save
     CRM auto-build è path-aware** (2026-08-13): `DRAFT_IMAGE_PATHS` in
     `useAutoBuildGenerate.ts` — cover/background/hero 1536px/400KB,
     photo/logoUrl 1024px/400KB (era 768px/200KB piatto → immagini 1K
     declassate sotto soglia qualità, trovato dalla verifica live).
6. **`await import('../src/...')` non risolto in prod Vercel**. L'import
   dinamico di un modulo sotto `src/` da `src/server/handler.ts` fallisce in
   produzione (`Cannot find module '/var/task/src/...'`) anche se gli
   import **statici** da `src/` funzionano. Sintomo: 404
   `{"error":"Endpoint AI non trovato"}` o 502. Fix:
   `await import('@google/genai')` diretto (node_modules sempre bundled) e
   logica provider inlinata.
7. **Import statico di `@google/genai` crasha l'intera funzione**. Il
   pacchetto v2.10.0 è ESM-only; l'import statico in cima a `src/server/handler.ts`
   rompe il bundle Vercel: OGNI endpoint `/api/*` ritorna
   `FUNCTION_INVOCATION_FAILED` (anche `/api/ping`). Fix: solo import
   dinamico dentro l'handler della route.
8. **Prompt cover: metafore artistiche triggerano filtro copyright**.
   Frasi tipo `"watercolor wash"`, `"drifts between"`, `"like diffuse ink
   on wet paper"` → `400: Image generation blocked due to
   copyright/recitation`. Fix: prompt neutro e piano (v2.8), poi v3.0 con
   formula Nano-Banana (Subject+Action+Context+Composition+Lighting+Style)
   e Negative Constraint Logic ("Ensure the background remains free
   of...") invece di liste "no X". Le proibizioni card-like (no text, no
   QR, no logos, no faces) sono OK; le metafore artistiche no.
9. **Cache bundle JS browser dopo fix API**. Se un fix cambia path/body di
   un endpoint, il vecchio bundle può ancora chiamare l'endpoint vecchio.
   `Ctrl+F5` non sempre basta (Service Worker / cache HTTP): DevTools →
   Application → Clear storage, oppure incognito.
10. **`coverImageUrl` (base64 cover AI) non deve mai raggiungere DeepSeek**.
    Il base64 (150KB+) nel contesto veniva riprodotto nella risposta JSON,
    rompendo la validazione Zod (`error:invalid_card`). Fix:
    `buildCardAIContext` (`src/ai/prompts/cardContext.ts`) strippa
    `coverImageUrl` insieme a `photoUrl` e `logoUrl`.
11. **Context limit disallineato validatore vs builder**. Zod
    `context: z.string().max(N)` in `src/server/handler.ts` e `MAX_CONTEXT_LEN` in
    `coverBrief.ts` devono coincidere (ora 2000). Verificare SEMPRE dopo
    modifiche a `buildCoverContext`.
12. **`LogoAiPanel`: background AI perso cambiando tab AI → Builder → AI**.
    Bug già in prod quando scoperto. Cause + fix (tutti in
    `LogoAiPanel.tsx` / `LogoEditor.tsx`):
    - `bgImages` mancava dalle dipendenze dell'effect di persistenza:
      primo persist catturava `[null,null,null]`, gli update successivi
      non ritriggeravano. Al remount (cambio tab) si ricaricava lo
      snapshot senza immagini.
    - Race sul debounce 500ms: cambio tab entro 500ms dall'arrivo
      dell'immagine → cleanup cancellava il timer prima della scrittura.
      Fix parziale: `latestStateRef` + flush-on-unmount.
    - Spinner condiviso sui 3 concept durante rigenerazione singola:
      `bgLoading` usava solo `isGeneratingBg` (bool globale). Fix:
      `bgLoading = regeneratingIdx === i || (isGeneratingBg &&
      regeneratingIdx === null && !bgImages[i] && !bgErrors[i])`.
    - `SaveDialog` non si chiudeva dopo salvataggio riuscito: mancava
      `setShowSaveDialog(false)` dopo il toast.
    - **Causa radice: `localStorage` non è il posto giusto per immagini
      base64**. Payload con 3 immagini base64 →
      `QuotaExceededError` su `setItem` NON catturato → crash intera app
      (la cleanup sincrona flush-on-unmount propagava fino
      all'`ErrorBoundary` al cambio tab; lo stesso errore nel setTimeout
      del debounce finiva solo in console).
      **Fix definitivo**: (a) stato sollevato al genitore — `LogoAiPanel`
      accetta `initialState`/`onStateChange` (`LogoAiState`), `LogoEditor`
      tiene `aiStateRef` (mai smontato al cambio tab): meccanismo PRIMARIO,
      nessuna serializzazione; (b) `localStorage` solo backup best-effort
      per F5, sempre in try/catch via `safeLocalStorageSet()`; se quota,
      retry senza `bgImages`.
      **Regola generale**: nessun dato con immagini base64 (screenshot,
      background AI, cover, hero) deve avere `localStorage` come unica
      persistenza in-sessione. Fonte primaria = stato sollevato al
      componente genitore stabile; localStorage = cache opzionale wrappata.
    Regression test: `LogoAiPanel.test.tsx` ("persistenza bgImages su
    cambio tab", "spinner durante generazione background"),
    `LogoEditor.test.tsx` (stato sollevato via `aiStateRef`, no-throw su
    QuotaExceededError al cambio tab). Verificati disattivando i fix.

## 3. Cover AI Card gotchas

1. Endpoint 404 in prod = §2.6 (import dinamico `../src/` non risolto).
2. FUNCTION_INVOCATION_FAILED ovunque = §2.7 (import statico
   `@google/genai`).
3. 400 copyright/recitation = §2.8 (prompt con metafore). Fix prompt
   neutro v2.8 (`coverBrief.ts`).

## 4. Card export SVG gotchas (`svgRenderer.ts` `buildBackSvg`)

Bug rendering retro card export vs preview (label/valore non allineati).

1. **`dominant-baseline` contatti = `alphabetic`, non `text-before-edge`**.
   La preview usa `.card-back-line { align-items: baseline }`: label e
   valore di font diverso condividono la baseline alfabetica. Con
   `text-before-edge` su entrambi, il valore più grande ha baseline più
   bassa → label "galleggiante". Fix: `alphabetic` su label+valore,
   `y = cy + valAscent + pad*0.25` (`valAscent ≈ valSize * 0.8`). Gli
   altri `<text>` del retro (eyebrow, services, socials, QR label)
   restano `text-before-edge` (righe singole). NON cambiare tutto il
   file a `alphabetic`: romperesti services/socials.
2. **`wrapTextAtWhitespace` non spezzava email/URL senza spazi** (ora
   hard-breaka i token lunghi per chunk — gotcha obsoleto, ma ricordare:
   la preview usa `overflow-wrap: break-word`).
3. **`colLabelWFor` può rubare spazio al valore**: `ks*6` troppo largo su
   celle strette. Se il valore esce, ridurre a `ks*4` o calcolare la
   larghezza reale `key.length * keySize * 0.6`.

Regression test: `svgRenderer.test.ts` "contact label and value share the
same baseline (alphabetic, v2.9 regression)".

## 5. Preview/export parity v2.14 (`svgRenderer.ts` / `previewHelpers.ts`)

Quattro fix insieme per allineare preview React e export SVG/PNG/PDF.

1. **`gridPlacement` axis swap per celle text (`flex-direction: column`)**.
   In column mode il main axis flex è verticale: `justifyContent` =
   verticale, `alignItems` = orizzontale. Senza swap, `alignV='top'` non
   aveva effetto sulle celle testo. Fix: parametro `flexDirection` in
   `gridPlacement()`; quando `'column'`, swap `justifyContent=vMap[alignV]`,
   `alignItems=hMap[alignH]`. CardPreview passa `'column'` per tutte le
   celle text. NON dimenticare `'column'` per nuove celle text.
2. **Font-size fronte rem-based (proporzionale a pxH), non cell-relative**:
   name `16/340`, title `12.48/340`, company `11.52/340` (erano frazioni
   di cellH → export ~50% troppo grande). `fontSize = fs(pxH * sizePct,
   fontScale)`.
3. **Front export grid padding + cell gap**: preview ha `padding:16px;
   gap:4px`. `frontGridPad = pxH*(16/340)`, `frontCellGap = pxH*(4/340)`,
   celle offset via `cellX()`/`cellY()`. Padding interno celle text:
   `cellPadX = 10/340`, `cellPadY = 6/340`.
4. **Back export font-size allineate ai rem grid-mode**: contacts key
   `9.6/340`, val `11.52/340`, services `13.6/340`, servicesLabel
   `11.2/340`, socials `10.88/340`.

Regression test: `previewHelpers.test.ts` (swap assi), `svgRenderer.test.ts`
describe "v2.14 preview/export parity". `layoutAudit.ts` LOGO_TOO_SMALL
threshold 0.35→0.30 per lo shrink da padding+gap.

## 6. v2.15 / v2.16 card details

- **v2.15 short-contacts collapse**: `effectiveBackGridForRender` in
  `src/utils/card/backLayout.ts` riduce la cella `contacts` h:2→h:1 e
  sposta `services`/`socials` su di una riga quando i contatti visibili
  sono ≤2. >2 contatti → cella resta h:2.
- **v2.15 QR label export parity**: label sotto QR in export
  `font-size = pxH * (9.6/340)`; spazio riservato `pxH * (18/340)`.
- **v2.15 generic element placement**: `CardGridElement.placement
  {x,y,scale}` (oltre al legacy `photoPlacement`); frecce nudge + zoom
  per `photo` e `qr` in `CardGridControls`; export applica offset/scale
  a foto e QR.
- **v2.16 fix** (verifica TB-023): QR fgColor → `card.style.textColor`,
  placement QR in preview, wash fronte mid-stop 0.4→0.25, bordo accent
  foto in export, espansione servizi su contenuti socials, logo fallback
  in cella foto, `logoBackground:'card'` in cella logo preview.
  Regression: `svgRenderer.test.ts` + `CardPreview.test.tsx` describe
  "v2.16 preview/export parity fixes (TB-023)", e2e
  `card-preview-export-parity.spec.ts`.
- **v2.16 placement universale nudge+zoom** (spec
  `spec-card-nudge-layout-template.md` v2.0): `placement {x,y,scale}` su
  TUTTI gli elementi grid (non più solo photo/qr); per i testi scale =
  fattore font-size locale (slider "Dimensione" in `CardGridControls`).
  Export SVG applica nudge+scale anche ai testi fronte e retro
  (contacts/services/socials). Slider globale "Dimensione testo" rimosso
  da `CardStyleFields.tsx`; `fontScale` resta campo LEGACY (default 1,
  clamp 0.7–1.5, ancora usato da preview/export/AI merge) — non rimuoverlo
  dallo schema senza migrazione dati.
- **v2.16 wrap export via `textMeasure.ts`**: `wrapTextAtWhitespace` usa
  canvas `measureText` per la larghezza reale dei glyph; il fattore 0.52
  resta solo come fallback senza canvas (jsdom, test deterministici).
  Mismatch 0.52 ridotto ma NON eliminato: i mismatch residui sotto restano
  validi.
- **cardMerge preserva placement (CON-AI-001)**: quando l'AI riposiziona
  un elemento grid, merge con l'elemento corrente invece di replace →
  `placement` esistente sopravvive a un move AI; placement fornito
  dall'AI accettato clampato ai limiti schema, omesso = "keep current".
  Stessa famiglia di regole di CON-IS-001 (merge AI mai distruttivo).
- **Mismatch residui preview/export** (da documentare finché non esiste un
  layout engine condiviso): (1) wrapping testo diverso CSS vs export (ora
  via `textMeasure` canvas: ridotto ma residuo, metriche reali solo in
  browser); (2) font metrics baseline/line-height
  approssimati in export; (3) font preview ridotti su mobile ≤1023px
  (preview-only, `cardBase.css` — soglia migrata a quella canonica
  workspace nel pass 2026-07-31, vedi §24).

## 7. Volantino rendering gotchas (`src/utils/flyer/`)

Violare queste regole reintroduce overflow del testo fuori dai box.

0. **Canvas tainted con immagini remote**: se l'SVG del flyer contiene
   `<image href="https://...">` (hero da URL esterna), il raster su canvas
   contamina il canvas → `toBlob`/`toDataURL` lancia `SecurityError` e lo
   screenshot AI salta (fallback text-only). Fix centralizzato:
   `inlineSvgExternalImages` in `src/utils/ai/compressForAI.ts` — inline
   fetch → data URL prima di rasterizzare, drop dell'immagine se il fetch
   fallisce. Vale per OGNI pipeline SVG→canvas→AI.

1. **Unità `font-size` in SVG con viewBox in mm**: `font-size="8.5pt"` o
   `"3mm"` vengono convertiti in px a 96dpi e interpretati come user unit
   (= mm) → font ~3.78× troppo grande. Fix: **unitless**,
   `font-size="${fontSizePt * MM_PER_PT}"`. Stessa regola per
   `foreignObject` body CSS: `font-size: ${...}px` (px = user unit).
2. **Metriche font Arial calibrate** (`scripts/flyer-calibrate-real.mjs`):
   `boldUpper: 0.69`, `boldUpperCta: 0.67`, `regularBody: 0.46`,
   `regularMixed: 0.50`. `charWidthMm = factor * fontSizePt * MM_PER_PT`.
3. **Altezza glyph reale** ≈ 1.15× font-size. `GLYPH_HEIGHT_FACTOR = 1.15`;
   altezza box = `(lines-1) * fontSize * lineHeight + fontSize *
   GLYPH_HEIGHT_FACTOR`, NON `lines * fontSize * lineHeight`.
4. **`dominant-baseline="text-before-edge"`** su tutti i `<text>` nativi:
   senza, il testo "sale" ~0.7em sopra il box.
5. **`clip-path`** con rect in mm: taglia il side-bearing negativo del
   primo glifo (~0.3mm tollerabile).
6. **Budget copy al font minimo è un hard limit**: `getFlyerCopyBudget`
   usa `bounds.X.min`; al font reale (da `fitText`) entrano molti meno
   char — il campo body mostra "1758 CAR. RESIDUI" ma a 13pt ne entrano
   ~500. Mitigazioni possibili: budget al font reale, troncamento con
   warning, copy AI più corto.
7. **Subheadline è mixed-case**: `kind: 'regular'` in `fitText`, non
   `'boldUpper'` (mix causa wrap errato).
8. **CTA fitting**: usare `fitCtaText` (shrink + ellipsis centrale).
9. **Verifier Playwright**: `getBBox()` (user unit) vs `clipPath` rect;
   tolleranza orizz. 0.3mm, vert. 0.6mm.

## 8. Card layout/event harness + known issues aperti

- Harness e2e unificato: `e2e/helpers/cardHarness.ts` (login, fill, grid,
  export, parse SVG).
- Event logging: `src/utils/card/layoutEvents.ts`; in test mode o
  `localStorage['pq_card_layout_debug']='1'` → `window.__cardLayoutEvents`.
- Layout audit: `src/utils/card/layoutAudit.ts` (ratio font
  contatti/socials, overlap label/valore, posizione QR, logo piccolo).
- WYSIWYG test command:
  `npx playwright test e2e/card-export-inspection.spec.ts
  e2e/card-wysiwyg-visual.spec.ts e2e/card-grid-export-roundtrip.spec.ts
  e2e/card-grid-behavior.spec.ts e2e/card-layout-audit.spec.ts
  e2e/card-grid-behavior-audit.spec.ts`

Issue aperti (scope minore):
- Mobile grid editor: molte frecce/tap; valutare drag-and-drop diretto.
- `selectedGridElement` è `useState` locale in CardEditor → si perde
  cambiando tab. Fix: persistere in `card.selectedGridElement` o alzare
  in AppShell.
- CardPreview test QR in jsdom: `generateQrSvg` non gira; i test
  verificano solo il placeholder. Fix: mock `qrcode`.

## 9. Post-TB-023 known issues

Dettagli in `docs/post-tb023-known-issues.md` (eliminato 2026-07-30, in git history). Stato: fixati cover PNG
export, wash opacity retro, icona AI pixelata, header CONTATTI stacking
(`position:relative; z-index:2` su `.card-back-header`). Aperti:
- Log image preview persa al refresh (by design, QuotaExceeded).
- Modulo AI unificato: feature TB-023 (provider, vision, fallback)
  frammentate in silos per editor; serve modulo trasversale (§4 del doc).

## 10. Phase status & roadmap (storico completo)

Spec attivi in `docs/spec/`: `spec-design-flyer-refactor-preview-ai.md`
(Phase 11, solo gap test TB-007), `spec-api-saas-monetization.md`
(NOT-STARTED), `spec-intake-pipeline.md` (TB-019, NOT-STARTED). Gli spec
implementati sono cancellati dopo verifica (traccia in git history +
`docs/to-be-done.md`); anche `spec-design-ai-first-ux-redesign.md`
(Fasi 12-14) cancellato il 2026-07-18 dopo completamento.

| Fase | Stato | Note |
|------|-------|------|
| 0, Auto-save fix | ✅ | `processingRef`/`cooldownRef` in EditorView, toast merge. |
| 1, QR Code | ✅ | 7 tipi, export SVG/PNG, migration DB `documents`. |
| 2, Business Card | ✅ (2.2 refactor) | Master switch, init-from-layout, QR sizing, fontScale, servicesLabel, parity mobile, AI parity. |
| 3, Volantino | ✅ | 4 layout × 5 formati, bleed 3mm, AI copy via `POST /ai/copy-flyer` (10/min/IP). PDF+PNG client-side. |
| 4, Logo SVG Builder | ✅ | v1 senza AI (Replicate deferred). Tab "AI Generation" disabilitato con messaggio. |
| 5, Tier System | ✅ | Watermark free, unlock code via admin, tier guard su save. |
| 6, Unified Collection | ✅ | `documents` table rinominata, collection unificata. |
| 7, Polish | ✅ | Onboarding step 5, HomePage "Perché noi", `preferredDocumentType` in DB. `LogoAiDocsPage` pubblica rimossa deliberatamente. |
| 8, Quickbrand Rebrand | ✅ | Rename + palette "The Classic" (Red & Ink), HomePage/LoginPage rebrand, test. |
| 9, Card Refactor Submodules | ✅ | 11 utils + 9 components `src/utils/card/*` + `src/components/card/*`, barrel/shell. |
| 10, Card Grid UX Alignment | ✅ | alignH/alignV (9-pos), preset retro separato, e2e. |
| 11, Flyer Refactor Preview/AI | ⚠️ parziale | 12/12 utils + 11/11 components + 5/5 CSS. Gap: test matrix 4/10, `ai/flyer/budgets.ts` in `utils/flyer/budgets.ts` (deviazione equivalente). |
| 12, AI Observability | ✅ | `useAILogs` condiviso, fix `trackUsage`, `IMAGE_TOKEN_COST`, `X-Request-Id` end-to-end, log server JSON, rate limit ghost fix, `pq_ai_logs:v1`. 6 hook AI migrati. |
| 13, Design System & UX | ✅ | Token "The Classic" + ghost in `GlobalStyles :root`, purge teal/blu (`designTokens.test.ts`), Outfit/Inter/JetBrains Mono, font picker lazy, kit `ai-ui/ai-ui.css`, ToastProvider, sidebar gruppi + collapsed in `pq_ui:v1`, `BP_SHELL=768`/`BP_WORKSPACE=1024`, `AILogPanel` prop `theme`, copy AI-first, unlock `QB-` (PQ- legacy validi), HomePage AIDA + bento, `ActionBar` (logo+QR). Deviazioni: token esistenti non rimappati; breakpoint storici migrati progressivamente; card/flyer/quote mantengono cluster azioni. |
| 14, AI Console & AI-first | ✅ | `AIConsole` rail (collapse per editorKind, suggestedPrompt+focus, hidePrompt, quickActions, AIProviderBadge). Migrati social/flyer/card/quote. Onboarding AI-first. Deviazioni: logo mantiene tab Builder/AI top-level (tab default `ai` su logo vuoto); QR resta manuale (eccezione documentata); mobile mantiene bottom sheet/overlay. |
| 15, AI Harness Upgrade (TB-023) | ✅ | Spec `spec/spec-design-ai-harness-upgrade.md`. Multi-provider (Ollama Pro + DeepSeek), badge provider menu (apre verso il basso, fix clipping), tracking costi, 5 pattern decorativi SVG preview+export, generic `placement`, Icona AI card, dev-proxy `/api/ai/chat(/stream)` + `/api/ai/image-flash`. **A/B provider rimosso deliberatamente** (commit `15aa0d5`): `resolveProviderId` è solo resolver modelId→pref→default. **Bottone "Analizza preview" rimosso deliberatamente**: `/api/ai/design-review` + `useAIDesignReview` restano orfani (vedi `docs/post-tb023-known-issues.md`, eliminato 2026-07-30, in git history). **v2.16**: screenshot preview allegato ai log e inviato al modello vision-enabled tramite `data-*-preview` + `captureElementAsBase64`; `imagePreviewBase64` nel dettaglio log; `hasImage`/`modelId`/`costUsd` propagati. Verifica completa 2026-07-22: `docs/tb023-verification.md` (eliminato 2026-07-30, in git history). |

## 11. Notes su skill e scope AI (storico)

- **UX namelix-like**: implementata solo in onboarding
  (`BrandNameGenerator.tsx`) e, in variante semplificata (3 domande), nel
  tab AI del logo. Per card/flyer/social il flusso AI è diretto
  (parametri → genera → applica). Estensione fattibile ma fuori scope.
- **Skill taste (leonxlnx/taste-skill)**: solo per l'agente di coding,
  guidano il design di HomePage/Editor/Preview. Nessun impatto runtime:
  l'app usa DeepSeek (testo) e Gemini Nano Banana (immagini) via proxy
  server-side.
- **Gemini Nano Banana scope**: attualmente wireato solo a logo
  background (`/ai/logo-background`, `LogoAIOrchestrator.generateBackground()`)
  più cover card / icona AI card (TB-023). Flyer usa hero statiche
  (picsum.photos). Estensione a flyer hero AI fattibile ma fuori scope.

## 12. Gotchas dev/localhost AI (dettaglio)

1. **Flyer copy AI in localhost**: richiede `VITE_DEEPSEEK_API_KEY` in
   `.env` (o `deepseekApiKey` in localStorage). Il token-check in
   `useAIFlyer.ts` esclude `localhost` (`!isLocalhost()`), come
   `useAICard`; senza l'esclusione un utente non-admin in dev veniva
   bloccato da `dataService.getUserProfile`.
2. **Cover "entrambi i lati" NON parallela**: due chiamate simultanee a
   Gemini via dev proxy → `502 Bad Gateway`. Fix: serializzare
   fronte → retro (`CardEditorShell.handleGenerateCover('both')`).
3. **Background AI logo non sovrascritto a null**: i concept DeepSeek
   hanno `backgroundImage: null`; `LogoAiPanel.applyConcept` non deve
   spreadarlo (cancellerebbe il background Gemini pagato). Escludere dal
   patch di default; settarlo solo se `bgImages[idx]` disponibile.
4. **`vite.config.js` va riavviato dopo modifiche al dev proxy**: Vite
   non ricarica i middleware custom su hot-reload. Sintomo: 404/502 su
   `/api/ai/card-cover` ecc.
5. **Dev proxy `/api/ai/card-cover` truncava `context` a 1000 char**
   mentre server e `coverBrief.ts` accettano 2000. Tenere allineati.

## 13. OWASP Top 10 (stato)

- A01 Access Control ✅ /users, /quotes/all, /users/limits, /users/tokens
- A02 Crypto ✅ bcrypt 12, constant-time compare admin
- A03 Injection ✅ Zod su tutti gli input
- A04 Insecure Design 🟡 threat modeling mancante (TODO)
- A05 Misconfiguration ✅ CORS ristretto, body 1MB, no stack trace
- A06 Vulnerable Components 🟡 audit dipendenze non fatto (TODO)
- A07 Auth Failures ✅ rate-limit login + tokens + aistream
- A08 Data Integrity ✅ env server-side only
- A09 Logging ✅ logger strutturato, /api/logs client→server
- A10 SSRF ✅ solo outbound hardcoded (DeepSeek/Ollama/Gemini)

## 14. Logo export multi-formato (TB-024, v2.5)

Aggiunti 5 formati export al logo builder. Regole da rispettare quando
si tocca `logoGenerator.ts`:

1. **PDF vettoriale (`svgToPdf`)**: usa `svg2pdf.js` + `jspdf` (import
   statico OK, bundled lato client, NO Vercel boundary). Importante:
   `svg2pdf.js` richiede `getBBox()` su elementi SVG, **non disponibile
   in jsdom** → test skip condizionale su jsdom (`supportsSvgBBox`).
   Verifica reale via Playwright o manuale. Dimensioni PDF in pt =
   viewBox SVG (preserva proporzioni, scalabile).
2. **ICO (`svgToIco`)**: formato manuale, no dep. Header ICONDIR (6B) +
   ICONDIRENTRY (16B/entry) + PNG embedded (Vista+). Size range 1..256;
   `width=0` significa 256. Non usare BMP legacy (più ingombrante).
3. **Favicon ZIP (`svgToFaviconZip`)**: dynamic `import('jszip')` (no
   bundle bloat se path non preso). Contenuto: PNG 16/32/64/180/512,
   ICO 16/32/48, SVG, `site.webmanifest`, `browserconfig.xml`. Il
   `site.webmanifest` ha `theme_color`/`background_color` hardcoded
   `#01696F`/`#FFFFFF` — se il logo ha colori brand diversi, l'utente
   può editare a mano il manifest.
4. **JPG (`svgToJpg`)**: fill canvas con `bgColor` (default bianco)
   prima di `drawImage`. JPG non supporta trasparenza. Watermark
   tier-aware applicato.
5. **SVG ottimizzato (`optimizeSvg`)**: regex minimale, ~30-40% più
   piccolo. Rimuove commenti/metadata/dichiarazione XML, collassa
   whitespace, rimuove attributi default (`stroke="none"`, `fill=""`).
   No SVGO runtime (pesante, ~1MB). Per SVG generati da `builderToSvg`
   (subset controllato) è sicuro; per SVG arbitrari utente usare prima
   `sanitizeSvg` (security).
6. **Watermark**: PDF usa `svg2pdf` (no canvas, watermark non applicato
   su vettoriale — tier-aware non supportato su PDF vettoriale). JPG
   usa `applyWatermarkToCanvas` come PNG. ICO/Favicon: watermark su
   PNG interni. Se in futuro si vuole watermark su PDF, usare
   `pdf.text()` di jspdf nel documento finale.
7. **Tier limit**: `getMaxPngSideForTier` clampa PNG/JPG. ICO/Favicon
   richiamano `svgToPng` internamente → rispettano il limite. PDF
   vettoriale non ha limite (scalabile, no pixel).
8. **Test**: `src/utils/__tests__/logoGenerator.tb024.test.ts`. Mock
   canvas deve includere `measureText` (svg2pdf lo usa). PDF test
   skip in jsdom. Header verificati: PNG (`89 50 4E 47`), JPG
   (`FF D8 FF`), ICO (ICONDIR `00 00 01 00`), ZIP (`50 4B 03 04`),
   PDF (`%PDF-`).

## 15. Collection preview SVG inline (TB-025)

Preview logo/card/flyer/quote nella griglia Collection: render SVG
inline invece di icona generica. Regole:

1. **Scope**: `logo`, `businessCard`, `flyer`, `quote` hanno preview
   SVG. QR/generatedImage mantengono icona (o thumb per immagini AI).
2. **Logo**: `builderToSvg(doc.builder)` + `sanitizeSvg`.
3. **Card**: `mergeCardWithDefaults(doc)` + `buildCardSvg(card,'front',
   320,200,{embeddedFontCss:''})` — `embeddedFontCss:''` salta @import
   font Google (pesante, non necessario in thumbnail).
4. **Flyer**: `mergeFlyerWithDefaults(doc)` + `buildFlyerSvg(flyer)`.
   `SvgRenderOptions` non ha `embeddedFontCss` (a differenza di card) —
   non passarlo. Flyer SVG ha viewBox in mm; CSS scala via `contain`.
   Altezza container 160px (più alto di card/logo per aspect A5/A6).
5. **Quote**: `buildQuotePreviewSvg(quote)`. Doc unificato ha
   `doc.quote` (PremiumQuote); legacy flat (da `precisionQuote_quotes`)
   va migrato via `migrateFromLegacy(doc)`. Preview usa `legacy.title`
   (piatto) non `legacy.project.title` per il titolo — `migrateFromLegacy`
   mappa `legacy.title → project.title`. Se seed test usa
   `project:{title:'X'}` senza `title` flat → preview mostra 'Preventivo'
   (default), non 'X'. Test quote devono usare `title` flat.
6. **escapeXml robusto** (`quotePreviewImage.ts`): `escapeXml(s:unknown)`
   con `String(s ?? '')` — legacy quote può avere `client` come oggetto
   annidato o stringa, `project.title` undefined, ecc. Mai crash su
   `s.replace` non-function. Stesso pattern per `formatEuro` (Number
   coercion). Fix TB-025: preview quote prima crashava su
   `client: {name: 'X'}` (legacy parziale) → ora safe.
7. **Card idratazione**: `mergeCardWithDefaults` SEMPRE applicato prima
   di `buildCardSvg`. Card salvata parziale → defaults idratati →
   preview renderizza (non crash).
8. **Fallback sicuro**: `buildPreviewSvg` wrappa in try/catch. Se
   `builderToSvg`/`buildCardSvg`/`buildFlyerSvg`/`buildQuotePreviewSvg`/
   `migrateFromLegacy` throw (doc corrotto), ritorna '' → render
   condizionale cade su icona. Mai crash Collection.
9. **dangerouslySetInnerHTML**: usato per inline SVG. Sicuro perché:
   - Logo: `sanitizeSvg` rimuove script/event handler.
   - Card: `buildCardSvg` genera da template controllato.
   - Flyer: `buildFlyerSvg` da template + `escapeHtml`/`escapeXmlAttr`.
   - Quote: `buildQuotePreviewSvg` usa `escapeXml` su ogni input utente.
10. **CSS**: `.collection-preview-svg svg` width 100%, max-height 160px
    (flyer/quote più alti), `object-fit:contain`. Container flex center.
    Card/quote sfondo bianco + bordo (preview su bianco); logo/flyer
    sfondo trasparente (rispetta brand).
11. **Quote admin-only**: quote visibili solo admin (filtro Phase 7).
    Test preview quote devono usare `renderCollection({role:'admin'})`.
    Seed in `precisionQuote_quotes` non `precisionQuote_documents:v1`.
12. **Test**: `src/components/__tests__/CollectionView.preview.test.tsx`
    (9 test). Logo/card/flyer renderizzano SVG + contenuto. Quote
    renderizza SVG + title (usa `title` flat legacy). Malformed di
    ogni tipo → fallback icona o preview idratata, no crash. QR → no
    preview SVG.

## 16. Cost tracker per-document (TB-026)

Ogni documento salva il proprio costo AI cumulato (`aiStats`). Regole:

1. **Schema**: campo opzionale `aiStats` su `businessCardSchema`,
   `logoSchema`, `flyerSchema`, `qrCodeSchema` (documentSchemas.ts) e
   `quoteSchema` (quoteSchema.ts, inline per evitare import cross-file).
   Shape: `{ totalCostUsd: number, calls: Record<AiCallKind, {count, costUsd}>, updatedAt?: string }`.
   Default: `undefined` (non `EMPTY_AI_STATS`) — documenti esistenti non
   rompono. `aiStatsSchema` in `src/utils/aiStats.ts` è `z.object().default({})`.
2. **Helper** (`src/utils/aiStats.ts`):
   - `incrementAiStats(stats, kind, cost)` → nuovo AiStats con kind+1
     e costo accumulato (round 6 decimali).
   - `withAiCall(doc, kind, cost)` → `{...doc, aiStats: incrementAiStats(...)}`.
   - `mergeAiStats(a, b)` → somma due stats (utile per split/merge).
   - `formatAiStatsCompact(stats)` → stringa "3 icone · 2 elaborazioni
     testo · $0.08" per Collection badge.
   - `aiStatsTotalCalls(stats)` → numero totale chiamate.
   - `AI_CALL_LABELS` → label singular/plural per ogni kind.
   - `AI_CALL_KINDS` → 11 kinds: text, cover, photo, icon, hero,
     background, flyerCopy, logoConcept, socialCopy, quoteCopy, visionReview.
3. **Hook AI**: ogni hook ritorna `aiCall: {kind, costUsd}` ad ogni
   operazione riuscita. L'editor (non l'hook) applica `withAiCall` sul
   documento — scelta: hook resta pure, editor è owner dello stato doc.
   - `useAICard.processCardPrompt` → `aiCall.kind='text'`
   - `useAICard.generateCover` → `aiCall.kind='cover'`
   - `useAICard.generatePhoto` → `aiCall.kind='photo'`
   - `useAIIconHero.generate(kind='icon')` → `aiCall.kind='icon'`/`'hero'`
   - `useAILogo.generate` → `result.aiCall.kind='logoConcept'`
   - `useAILogo.generateBackground` → `result.aiCall.kind='background'`
   - `useAIFlyer.generate/refine` → `result.aiCall.kind='flyerCopy'`
   - `useAIFlyer.generateHero` → `result.aiCall.kind='hero'`
   - `useAI.processPrompt` → `result.aiCall.kind='quoteCopy'`
   - `useAISocial` non persiste aiStats (social posts non sono documenti
     salvati — output generato, no doc social schema).
4. **Editor wiring**:
   - `CardEditorShell` usa `recordAiOnCard(kind, cost, transform)` per
     applicare aiCall + transform in un singolo `setCard`. Cover/photo/icon
     passano `transform` per applicare `dataUrl` e aiCall insieme (evita
     race tra `patchFront` e `setCard`).
   - `LogoEditor` passa `onAiCall` prop a `LogoAiPanel` e `BuilderPanel`.
   - `FlyerEditorShell` applica `withAiCall(result.flyer, ...)` su
     generate/refine/generateHero.
   - `AppShell` (quote) applica `incrementAiStats` su result.quote.
5. **Persistenza**: `dataService.saveDocument` preserva `aiStats`
   automaticamente (spread del doc). In IS_LOCAL: top-level in
   `precisionQuote_documents:v1`. In prod: entra in `data` jsonb via
   `toApiDocument` (non destrutturato in `rest` → `domain` → `payload`).
   `hydrateDocument` rimette aiStats a top-level in entrambi i path. No
   migration DB necessaria (campo opzionale in jsonb).
6. **Collection badge**: `CollectionView` renderizza `<p class="card-ai-stats">`
   sotto `<p class="card-meta">` per `logo`, `businessCard`, `flyer`, `quote`.
   Mostra sempre "🤖 Nessun costo AI" se nessuna chiamata registrata;
   altrimenti conteggi per kind + costo totale. Testid:
   `ai-stats-${doc.id}`.
7. **calculateCostUsd fix** (`providerPricing.ts`): per-image non
   richiede più `usage` — `imageCount` basta. Prima
   `calculateCostUsd('gemini-nano-banana', undefined, 1)` ritornava 0
   (bug!); ora ritorna 0.04. Per-text provider (DeepSeek) ancora
   ritorna 0 se `usage=undefined` (corretto — non c'è modo di stimare
   token senza usage).
8. **Retrocompat**: documenti salvati prima di TB-026 non hanno `aiStats`
    → schema parse OK (opzionale). Collection mostra "Nessun costo AI".
    Se utente genera nuova chiamata AI su doc vecchio, `withAiCall(undefined stats)`
    → parte da `EMPTY_AI_STATS` (gestito in `incrementAiStats`).
9. **Editor widgets**: `DocumentAiStats` è montato in:
    - `CardEditorShell` header (accanto a titolo e reset).
    - `LogoEditor` header (accanto ad ActionBar).
    - `FlyerManualPanel` sotto il titolo del volantino.
    - `Topbar` per la quote view (`view === 'editor'`), passato da
      `AppShell` tramite prop `aiStats={quote.aiStats}`.
    Mostra "🤖 Nessun costo AI" quando vuoto, altrimenti conteggio kind
    e costo. Per tutti gli editor, aiStats si aggiorna in tempo reale
    quando l'utente lancia una chiamata AI; non serve salvare per vedere
    il badge (perché `withAiCall` modifica lo stato locale del doc).
10. **No tracking doppio**: `dataService.trackTokens` (per-user)
    rimane — ora c'è sia per-user (`users.tokensCostUsd`) che
    per-document (`doc.aiStats.totalCostUsd`). Per-user = budget
    billing; per-document = accountability costo produzione.
11. **Test**: 19 in `src/utils/__tests__/aiStats.test.ts` (helper),
    3 in `CollectionView.preview.test.tsx` (badge render condizionale),
    mock aggiornati in `CardEditorShell.test.tsx` (aiCall nei mock
    useAICard/useAIIconHero), `useAICard.test.ts` (assert aiCall
    kind/cost), `useAIIconHero.test.tsx` (url → r.dataUrl),
    `providerPricing.test.ts` (per-image senza usage).
 12. **Social escluso**: post social non sono documenti salvati nella
     Collection (sono output generati, copiabili). Se in futuro si
     vuole persistere post social come documenti, aggiungere
     `socialSchema` + aiStats — per ora out of scope.

## 17. CRM + intake pipeline (TB-027 + TB-019, v2.17)

TB-027 (CRM admin-only + auto-research + auto-build) e TB-019 (intake
pipeline → porta ingresso CRM) implementati 2026-07-28. App smette di
essere editor multi-utente con signup pubblica → diventa CRM founder-only.
Codice signup/onboarding **conservato** dietro feature flag
`REGISTRATION_ENABLED` (default `false`).

**Spec**: `docs/spec/spec-architecture-crm-auto-build.md` (TB-027),
`docs/spec/spec-intake-pipeline.md` (TB-019, riposizionato come prereq CRM).

### TB-027 CRM

1. **Schema**: `db/schema.ts` tabella `customers` (id, businessName,
   ownerName, sector, activity, mood, target, preferredColors, contacts
   JSONB, package, source `'manual'|'intake'`, intakeId FK nullable,
   status `new|researching|researched|building|done|rejected`, logoUrl,
   placeId, placeData JSONB, customerPhotos JSONB, detectedLogoUrl,
   researchStatus JSONB, aiSuggestedFields JSONB, notes, assignedTo,
   timestamps). Colonna `documents.customerId` (FK nullable,
   retrocompatibile). Mirror in `src/server/handler.ts` (`customersTable`,
   `documentsTable` aggiornata).
2. **Endpoint** (tutti admin, guard `requireAdmin` helper):
   - `GET /api/customers?status=&adminEmail=` — lista filtrata.
   - `POST /api/customers` — crea manuale (`CreateCustomerSchema`).
   - `GET /api/customers/:id?adminEmail=` — dettaglio + documenti collegati.
   - `PATCH /api/customers/:id` — update (`UpdateCustomerSchema`).
     - `POST /api/customers/:id/research` — auto-research pipeline
       (Firecrawl scraping sito + chunking RAG + logo detection). Rate limit
       1/ora/cliente. Best-effort: `FIRECRAWL_API_KEY` assente →
       `researchStatus.web='no_key'`, pipeline non blocca. `fetchFirecrawlPage`/
       `saveCustomerKnowledge`/`detectLogo` server-side only. SEC-003 anti-SSRF:
       reject IP privati in `detectLogo` e `fetchFirecrawlPage`. Logo clamp 200KB.
       Chunk markdown salvati in `customer_knowledge` con
       source=`firecrawl:homepage`; embedding futuro via `POST /api/ai/embeddings`
       (Gemini `gemini-embedding-2`). **TB-027b**: nessuna chiave salvata in UI;
       l'env `FIRECRAWL_API_KEY` è server-side only.
    - `POST /api/customers/:id/ai-fill` — AI riempie campi vuoti (mood,
      target, preferredColors, activity). Basato su settore (lookup
      table, no chiamata AI in v1 per costi). Rate limit 5/ora.
   - `POST /api/customers/:id/auto-build` — crea 4 draft (logo, card,
     flyer, social) pre-compilati con `customerId`. `autoGenerate=true`
     flag accettato ma deferred (CON-001: AI generation manuale nell'
     editor). Rate limit 3/ora.
3. **Feature flag registrazione**: `REGISTRATION_ENABLED` env (default
   `false`). `POST /api/users/register` → 403 se false (commento
   `// WHITELABEL`). `GET /api/config` endpoint pubblico ritorna
   `{ registrationEnabled }`. LoginPage nasconde tab registrati se false
   (TODO frontend: integrare flag in UI — v1 lato server enforced).
4. **dataService.js**: `getCustomers`, `createCustomer`, `getCustomer`,
   `updateCustomer`, `researchCustomer`, `aiFillCustomer`,
   `autoBuildCustomer`, `getConfig`. LOCAL usa `pq_customers:v1`
   (localStorage), PROD API. Stesso pattern `IS_LOCAL` esistente.
5. **UI**: `src/components/crm/CustomerList.tsx` (lista card con status
   badge + form creazione inline), `CustomerDetail.tsx` (brief + contatti
   + research status + campi AI + bottoni research/ai-fill/auto-build +
   documenti collegati), `IntakeList.tsx` (TB-019, vedi sotto). CSS in
   `crm/crm.css`. Route `/app/customers` + `/app/customers/:customerId`,
   `AdminRoute` guard. Sidebar: voce "Clienti" sopra "Documenti"
   (admin-only) sia desktop che mobile drawer. `ROUTE_PATHS.customers`
   in `useRouteView.ts` (auto-mappa via `pathToView`).
  6. **Auto-research best-effort**: Lean-code — Firecrawl fallisce → status
     `no_key`/`fail`/`no_website`, cliente non bloccato, auto-build
     procede con AI fill. Logo detection: fetch favicon.ico, clamp 200KB,
     reject SSRF verso `127.*|10.*|192.168.*|169.254.*|localhost`.
     `AbortSignal.timeout(8000)` per non impicciare la lambda.
     **Google Maps URL**: il cliente ha un campo `googleMapsUrl` (link
     pubblico, es. `https://maps.app.goo.gl/...`) editabile inline; il sito
     web è letto da `contacts.website` o fallback `googleMapsUrl`.
     Se nessuno dei due è presente → `web: no_website`.
 7. **Auto-build draft**: 3 documenti (logo/card/flyer) con `customerId`
    popolato, `documentTheme='corporate'`, campi pre-compilati da customer +
    research (detectedLogoUrl → logoUrl, customerPhotos[0] →
    card.photoUrl/flyer.heroImage). Social escluso da v1. AI generation NON
    lanciata qui (CON-001 quality check): l'admin apre ogni draft nell'
    editor e attiva AI manualmente.
 8. **CustomerDetail UI v2**:
    - Inline edit di tutti i campi brief/contatti/Google Maps URL.
    - Upload logo/foto con preview logo grande e check verde.
    - Log AI persistente in `sessionStorage` (`pq_crm_log:<customerId>`),
      espandibile: click su riga mostra payload/response JSON.
    - Status logo: `manual` se `logoUrl` caricato, `detected` se
      `detectedLogoUrl` trovato online, `no_logo` altrimenti.
    - Selettore provider text per palette AI (`deepseek-v4-flash`, `ollama-*`).
    - Selettore modello image-gen (`gemini-3.1-flash-image`,
      `gemini-2.0-flash-preview-image-generation`) salvato in user settings
      e sincronizzato con pannelli AI logo/card/flyer.
  9. **Test**: `api/__tests__/customers.test.ts` (17: CRUD guard, research
     no_website/no_key/ok, ai-fill, auto-build 3 draft no social, registration flag
     false/true, /config). `src/components/__tests__/CustomerList.test.tsx`
     (4: render, empty, click, create). `CustomerDetail.test.tsx` (16:
     dettaglio, bottoni azione, errore, research log, upload, palette, log
     detail, Google Maps URL, image model, logo status).
     `api/__tests__/embeddings.test.ts` (3: missing key, valid input, too long).

### TB-019 Intake

1. **Schema**: `db/schema.ts` tabella `intakes` (id, status
   `new|in_progress|done|rejected`, businessName, ownerName, sector,
   activity, mood, target, preferredColors, contacts JSONB, package,
   sourceRef UNIQUE nullable, notes, assignedTo, timestamps). Mirror in
   `src/server/handler.ts` (`intakesTable`).
2. **Endpoint**:
   - `POST /api/intake` (pubblico, rate limit 5/ora/IP via
     `consumeRateLimit(ip, 'intake', 5, 60*60*1000)`). Zod
     `IntakeSchema`. Idempotency via `sourceRef` unique: se esiste →
     409. Se `sourceRef` assente, genera `auto_<uuid>`. **TB-027**: ogni
     intake crea anche record `customers` (source='intake', intakeId FK).
     SEC-002: log senza PII (solo id, sourceRef, customerId, businessName).
   - `GET /api/intakes?status=&adminEmail=` (admin) — lista filtrata.
   - `GET /api/intakes/:id?adminEmail=` (admin) — dettaglio.
   - `PATCH /api/intakes/:id` (admin) — update status/notes/assignedTo.
3. **dataService.js**: `getIntakes`, `getIntake`, `updateIntake`. LOCAL
   usa `pq_intakes:v1`, PROD API.
4. **intakeToDocument.ts**: `intakeToLogo`/`intakeToCard`/`intakeToFlyer`/
   `intakeToSocial`/`intakeToAllDocuments`. Riusa `createEmpty*`
   factories, sovrascrive campi brief. Nessuna generazione AI qui
   (CON-001). Tipo `IntakeBrief` + `IntakeDocumentDraft`.
5. **IntakeList in CollectionView**: (RIMOSSO 2026-08-01) `crm/IntakeList.tsx`
   era montato in `CollectionView.tsx` sopra la griglia (admin-only, lazy).
   Mostrava brief `status='new'`. Click "Apri" → `intakeToAllDocuments` +
   salva 4 draft via `dataService.saveDocument` + PATCH intake status
   `in_progress`. Sostituito da upsert API + CRM workflow.
6. **Test**: `api/__tests__/intake.test.ts` (7: POST valido, idempotency
   409, validation 400, GET admin/non-admin, PATCH valido/invalido).
   `src/utils/__tests__/intakeToDocument.test.ts` (6: mappa logo/card/
   flyer/social, all documents, fallback vuoto).

### Gotchas specifici

- **z.record 2 args**: zod v3 richiede `z.record(z.string(), z.unknown())`
  non `z.record(z.unknown())` (TS error in src/server/handler.ts mirror).
- **b&b come key object**: `b&b` non quotato in TS rompe il parser
  (`&` → TS1005). Quota: `'b&b': '...'`.
- **mock DB select.where**: chain mock in test deve ritornare array con
  `.orderBy` attached (non `this`), perché il handler chiama
  `.where().orderBy()`. Pattern: `where: vi.fn(() => { const r = shift();
  r.orderBy = () => r; return r; })`.
- **REGISTRATION_ENABLED false in test**: `beforeEach` setta
  `process.env.REGISTRATION_ENABLED='false'` (test register 403); test
  flag true lo override a `'true'`. Reset tra test per evitare leak.
- **FIRECRAWL_API_KEY in test**: `delete process.env.FIRECRAWL_API_KEY` in
  beforeEach → research pipeline salta, status `no_key`. Test non
  chiama Firecrawl reale; mock `globalThis.fetch` per test ok.
- **ROUTE_PATHS 10 keys**: `useRouteView.test.tsx` aggiornato a 10
  (aggiunto `customers`). Verifica count ogni volta che si aggiunge view.
- **autoGenerate → client-side (TB-027c, vedi §18)**: flag `autoGenerate` attiva `autoGeneratePending` sui draft; generazione AI lanciata dal CRM (`useAutoBuildGenerate`), NON dall'API. Server resta draft-only (CON-001).
- **B1 shape allineata a createEmpty***: auto-build e intakeToDocument
  DEVONO usare shape nested (`card.front.name`, `card.back.phone`,
  `logo.builder.primaryText`, `flyer.content.headline`). Scrivere campi
  al top-level (`card.name`, `card.contacts`) → `mergeCardWithDefaults`
  resetta a vuoto → card vuota nell'editor. Entrambi i path (api auto-
  build + utility intake) devono allinearsi a `createEmpty*()` factories.
- **B3 LOCAL bypass registration**: `dataService.register` branch
  `IS_LOCAL` scrive localStorage senza chiamare `/users/register` →
  flag server-side bypassato in dev. Fix: `App.tsx` `register()` chiama
  `dataService.getConfig()` prima (LOCAL legge `VITE_REGISTRATION_ENABLED`,
  PROD legge `/api/config`). `LoginPage` nasconde tab "Registrati" se
  false. `HomePage` link "Registrati" condizionali su `authHref`.
- **B5 PaletteOrchestrator provider.id**: `AIProvider` non ha `id`.
  Usa `options.modelId || 'deepseek-v4-flash'` come `providerId` string per
  `executeWithFallback`. `trackUsage` accetta `providerId` string.
- **B5 paletteConceptsSchema length(3)**: zod `.length(3)` valida
  array esattamente 3. `.min(1)` su `name` per rifiutare stringa vuota.
- **B7 detectLogo img parsing**: favicon primo, poi parse homepage HTML
  con regex `<img ... src|alt|class|id contains "logo" ...>`. Anti-SSRF
  su URL assoluti (reject IP privati). `AbortSignal.timeout(8000)`.
  Best-effort: fallisce silenziosamente, customer non bloccato.

## 18. TB-027c — briefContext wiring + sequenza auto-generate + embedding v2 (2026-07-29)

- **briefContext finalmente consumato**: auto-build/intake scrivevano
  `data.briefContext` ma Zod lo strippava al parse (campo non in schema)
  e nessun orchestrator lo leggeva. Ora `briefContext` +
  `autoGeneratePending` sono in `businessCardSchema`/`flyerSchema`/
  `logoSchema` (opzionali). Consumo:
  - card: `buildCardAIContext` ritorna `briefSection` (additivo),
    `cardOrchestrator` lo appende come user-content part
    `Contesto cliente (brief attività):` dopo `Richiesta:`.
  - flyer: `resolveFlyerBrief` — brief vuoto → `flyer.briefContext`;
    entrambi → `brief + 

Contesto cliente:
` + briefContext.
  - logo: `generateLogo` fallback brief → `logo.briefContext`;
    `buildLogoGeneratePrompt(brief, sector?, briefContext?)` terzo
    param opzionale (backward compat, senza → output byte-identico).
- **Sequenza `useAutoBuildGenerate`**: bottone "Genera bozze AI" in
  `CustomerDetail` → logo → card → flyer. Logo: concept selezionato →
  builder. Card: `front.logoUrl` = data URL SVG via `builderToSvg`
  (logo generato) o `detectedLogoUrl`; icona AI `/api/ai/card-photo`
  in `photoUrl` se vuota (CON-IS-001, best-effort: fallimento icona
  NON marca la card error). Flyer: `generateCopy` con tone da
  `aiSuggestedFields.mood`. Save via `dataService.saveDocument`
  (NON esiste updateDocument). `autoGeneratePending:false` prima di
  ogni save. Errore di un doc non blocca gli altri. `generateOne`
  su card usa solo `detectedLogoUrl` (il builder del logo generato
  vive solo dentro una run `generateAll`).
- **Preview SVG condivisa**: `src/utils/docPreviewSvg.ts` estratto da
  CollectionView (usato anche da CustomerDetail thumbnails).
- **Logo status load fix**: doc-change effect in LogoEditor ora resetta
  `aiStateRef` + `aiPanelResetKey` + tab (pattern `handleNew`);
  `logoHasContent` conta `backgroundImage`; `logoAiChat:v1` è
  namespaced `logoAiChat:v1:<docId>` (globale = fallback lettura).
- **Embedding `gemini-embedding-2`**: sostituisce `text-embedding-004`
  in `POST /ai/embeddings` (zod enum, call `models/gemini-embedding-2`,
  fallback response). Colonna `embedding jsonb` → nessuna migrazione.
  RAG completo (populate embedding + retrieval + iniezione chunk nei
  prompt) RIMANDATO: endpoint `GET /customers/:id/knowledge` ancora
  mancante, `generateEmbedding` client senza caller.
- **Draft quality (api + dataService LOCAL)**: card `back.qrPayload` =
  website contatti; flyer `subheadline` = `cust.mood` (prima
  duplicava `activity` in subheadline+body).

## 19. TB-027d — CRM live fixes (2026-07-29): routing, dev research, vision M3, log UX

- **Default provider = MiniMax M3**: `providerRegistry.defaultId` flip
  `deepseek-v4-flash` → `ollama-minimax-m3` (vision, flat rate). DeepSeek
  resta fallback (`getFallbackProvider`) e selezionabile. Test con
  default hardcodato (`resolveProviderId.test.ts`) deve asserire
  `providerRegistry.getDefaultId()`, non stringa fissa.
- **Route `/app/customers/:customerId` reale**: `CustomersPage` deriva
  selezione da `useParams()` (prima stato interno → URL mai aggiornato,
  deep-link rotto). handleSelect/handleBack → `navigate()`.
- **Research dev reale**: branch LOCAL di `researchCustomer` usa
  `VITE_FIRECRAWL_API_KEY` (browser, dev-only come `VITE_GEMINI_API_KEY`)
  via `src/utils/firecrawlLocal.js` (chunkMarkdown DUPLICATO da
  src/server/handler.ts — boundary Vercel, annotato). Chunks →
  `pq_customer_knowledge:v1`. Logo detection solo da risposta Firecrawl
  (branding/metadata, URL remoto, niente fetch HTML cross-origin).
  Status: `no_key` senza key, `no_website` senza sito, `error` su
  fetch fallita (mai throw).
- **Vision nella sequenza bozze**: `useAutoBuildGenerate` rasterizza
  (builderToSvg/buildPreviewSvg → svgToPng → base64 raw) e passa
  `imagePreviewBase64` a card (logo) e flyer (card) SE
  `getAiVisionEnabled() && providerSupportsVision(resolveProviderId())`
  (CON-MM-002). Rasterizzazione wrappata try/catch: mai fatale.
  `generateOne` flyer: immagine card solo se card generata nella
  stessa sessione (cardDataRef).
- **CRM log UX**: Copia (clipboard + fallback execCommand) / Cancella
  in `crm-ai-log-head`. Log resta sessionStorage per-customer.
- **Palette provider default**: select CRM default
  `providerRegistry.getDefaultId()` (M3), non più DeepSeek hardcoded.

## 20. TB-027e — E2E live fixes (2026-07-29): dev proxy Ollama, research errori, flyer text-only

- **Dev proxy Ollama / M3** (`vite.config.js`):
  - `json()` helper fuori scope nel fallback Ollama → 502 "json is not defined".
    Fix: hoistato in scope `configureServer`.
  - `/api/logs` 404 in dev: aggiunto handler POST che logga su console server.
  - Client invia `provider: 'ollama'` ma il registry ha `ollama-minimax-m3`;
    normalizzato prima del lookup.
  - SSR: `OllamaProProvider` chiama `fetch('/api/ai/chat')` relativo, che in
    SSR fallisce. Fix: in dev proxy, per provider Ollama si bypassa il
    provider e si chiama direttamente l'upstream `proxyOllamaChat`.
  - Timeout Ollama aumentato a 5 min (card con vision + immagine base64).
- **`dataService.js` SSR-safe**: `IS_LOCAL` guardato con `typeof window`;
  prima il dev proxy non poteva fare SSR di `providerRegistry` perché
  importava dataService che toccava `window`.
- **Research**: se il cliente ha logo manuale (`logoUrl`), lo status resta
  `manual` anche se Firecrawl non trova un logo. WebData include `colors` e
  `images` da Firecrawl branding. Log CRM mostra status dettagliato.
- **ai-fill**: ora AI reale in local e prod; ritorna `fromAI` per UI.
- **Flyer in auto-generate**: text-only, niente vision per affidabilità
  schema JSON.
- **Auto-build dedupe**: rerun sostituisce i draft BOZZA esistenti.

## 21. TB-027f — Firecrawl full webData (2026-07-29): markdown completo + screenshot + JSON + links

- **Endpoint**: Firecrawl **v2** (`https://api.firecrawl.dev/v2/scrape`).
  Formati richiesti: `markdown`, `screenshot`, `branding`, `images`,
  `{ type: 'json', schema }`, `links`. `parsers: ['pdf']`. Se la chiamata
  completa fallisce, retry con payload minimale `markdown/branding/screenshot/links`.
- **Timeout**: scrape v2 completo può superare 30s. Client
  (`firecrawlLocal.js`) e server (`fetchFirecrawlPage`) usano
  `AbortSignal.timeout(120000)`.
- **Persistenza `webData`**: `markdownFull` (intero, no più solo preview 500),
  `screenshot`, `links`, `json`, `branding`, `brandingColors`,
  `brandingFonts`, `brandingLogo`, `images`.
- **UI CustomerDetail**: screenshot visibile, logo branding, toggle markdown
  completo, JSON espandibile, lista links, griglia immagini (max 12),
  swatch colori, font.
- **Locale (`src/utils/firecrawlLocal.js`)**: `scrapeFirecrawlLocal` mirror di
  `fetchFirecrawlPage` con fallback payload; parsing robusto screenshot /
  links / json / images.
- **API (`src/server/handler.ts`)**: `fetchFirecrawlPage` ritorna `FirecrawlResult`
  arricchito; research endpoint salva tutto in `webData` e usa
  `branding.logo` o `json.logo` per `detectedLogoUrl`.
- **UI layout**: sezione "Dati dal sito" su 2 colonne (main/side). Main:
  titolo, descrizione (fallback `json.company_description`), markdown toggle,
  JSON toggle, links, colori, font. Side: screenshot, logo branding, griglia
  immagini. Mobile 1 colonna.
- **Log CRM**: research logga messaggio riassuntivo (`titolo · N chunk ·
  N colori · N immagini`) e detail con description/links/screenshot/
  markdownChars/jsonFields.
- **briefContext**: `buildBriefContextApi` include `webData` (titolo,
  descrizione, `json.company_description`, branding colors/fonts, links,
  markdownPreview) così gli orchestratori AI usano il contesto Firecrawl.
  I colori sito sono marcati come `Colori sito (prioritari)` prima di
  `Palette preferita cliente`.

## 22. TB-027g — Genera bozze AI provider-aware + immagini (2026-07-29)

- **Provider AI unificato**: select CRM "Provider AI" (era "per palette").
  Usato per palette e per `useAutoBuildGenerate.generateAll/generateOne`
  (`options.providerId` → `modelId` orchestratori).
- **Card AI**: prompt libero chiede struttura/testi/stile; se
  `front.coverImageUrl` manca, genera cover via `/api/ai/image-flash`
  (kind `hero`, 16:9) con palette `style.accentColor/bgColor`.
- **Flyer AI**: dopo copy, se `content.heroImage` manca, genera hero via
  `/api/ai/image-flash` (kind `hero`).
- **Compressione pre-save**: `useAutoBuildGenerate.compressDraftImages` e
  `dataService.saveDocument` comprimono campi base64 noti (`photoUrl`,
  `logoUrl`, `coverImageUrl`, `backgroundImage`, `heroImage`) se > ~300KB
  per evitare `QuotaExceededError`. Fallback `lsSet` intatto.
- **Log CRM**: `handleGenerateAll`/`handleGenerateOne` loggano provider,
  costo per-doc e errore completo.
- **customerId preservato**: `dataService.saveDocument` (IS_LOCAL) preserva
  `customerId` dal documento esistente se il caller non lo passa. Inoltre
  `saveDraft`/`propagateLogoToDrafts`/`handleApplyPalette` lo passano
  esplicitamente. Senza, i documenti collegati sparivano dal cliente dopo
  generazione/propagazione o salvataggio editor.
- **Flyer robustness**: `generateFlyerDraft` normalizza `size/style/content`
  mancanti con `createEmptyFlyer()` prima di `generateCopy` e usa
  `flyerInput` come base del salvataggio — evita
  `Cannot read properties of undefined` e `fontFamily` mancante in editor.
- **Duplicate key colori**: `brandingColors` deduplicato con `Array.from(new Set(...))`
  prima del render swatch — evita warning React per colori ripetuti
  (es. primary = accent).
- **Image-flash 413**: `generateFlashImage` prova `size: '512'` poi `'256'`
  se il proxy risponde 413 (immagine >500KB). Prompt clampato a 800 char.
- **Compressione pre-save più aggressiva**: soglia 300K chars (~225KB raw),
  output max 768px / 200KB — riduce `QuotaExceededError` con cover/hero/icona.
- **Logo AI background**: `generateLogoDraft` chiama `generateBackground`
  (Gemini) dopo il concept; passa `imagePrompt` breve (≤300 char) invece di
  `activity` per evitare 400 (prompt >1000). Se fallisce o non applica,
  fallback su `/api/ai/image-flash` kind `hero`. Se entrambi falliscono o
  `localStorageNearlyFull()`, resta l'icona SVG (non fatale). Log espliciti
  per capire perché il background manca.
- **Colori sito prioritari**: `buildBriefContextApi` emette
  `Colori sito (USA QUESTI per logo/card/flyer)` prima di
  `Palette preferita cliente (secondaria)` — l'AI deve usare i colori reali
  del sito quando disponibili.
- **Quota retry**: `saveDraft` ritenta con compressione 512px/100KB se il
  primo save fallisce per `Spazio locale esaurito`/`QuotaExceededError`;
  ultima spiaggia rimuove immagini opzionali (background/cover/hero).
- **Editor stale cache**: `useDocumentLoader` ora ricarica sempre da
  `dataService.getDocument` al mount / cambio `docId` invece di fidarsi di
  `ctxDoc` in cache. Prima l'editor mostrava la versione vecchia del
  documento (es. logo senza background AI) anche se il CRM l'aveva
  rigenerato.
- **Apri editor durante generazione**: in `CustomerDetail` il bottone
  "Apri editor" è disabilitato mentre `genStatus === 'running'` — evita che
  l'utente apra l'editor su un draft ancora non salvato (vedrebbe la
  versione vecchia).
- **Logo AI parsing tollerante + fallback**: `logoAIConceptsSchema` accetta
  array di 1-3 concept; `generateLogo` wrappa un singolo oggetto in array
  prima della validazione. Se il provider risponde con testo non JSON o
  schema non rispettato, usa `fallbackConcept()` per non bloccare la
  pipeline — il logo viene comunque generato e il background AI applicato.
  `ensureThreeDistinctConcepts` normalizza a 3 varianti.
- **imageCompress jsdom**: `compressDataUrl` salta il caricamento `Image`
  se il payload base64 è <100 char (stub test) — evita Promise mai
  risolte in jsdom.
- **Test**: `useAutoBuildGenerate.test.ts` providerId/immagini/compressione/
  customerId/flyer robustness/retry 413; `dataService.documents.test.ts`
  compressione pre-save + customerId preserve; `customers.test.ts`
  briefContext colori prioritari; `CustomerDetail.test.tsx` provider AI
  generale + providerId/customerId passato.
- **Test**: `api/__tests__/customers.test.ts` research mockato verifica
  `webData.markdownFull`/`screenshot`/`links`/`json`/`images` e briefContext
  con webData; `src/utils/__tests__/firecrawlLocal.test.js` copre scrape,
  fallback, extract logo/images, knowledge chunks; `CustomerDetail.test.tsx`
  verifica screenshot/JSON/links UI.

## 23. TB-027h — Storage locale canonico FLAT per logo/card/flyer (2026-07-30)

Bug: CRM "Genera bozze AI" logo — il background AI veniva generato e salvato,
ma la Collection mostrava sempre il logo vecchio ("non si aggiorna mai").

**Causa**: doppia shape nello stesso record localStorage
(`precisionQuote_documents:v1`). Gli editor salvano FLAT (`builder` top
level), il CRM `saveDraft` salvava ENVELOPE (`data.builder`). Il merge
`{...existing, ...document}` in `saveDocument` (IS_LOCAL) non rimuoveva mai
le chiavi dell'altro formato → record con **flat stale + envelope fresco**.
`hydrateDocument` (branch `hasFlatDomain`) preferisce il flat → Collection
(e `getDocument`/editor) leggevano il builder vecchio; il CRM
(`getCustomer` raw → `doc.data`) quello nuovo. Evidenza dai log debug:
`flatBuilder: true, envelopeData: true, flatBgLen: 0, envBgLen: 27035`.
Card/flyer non mostravano il problema in modo evidente perché
`buildPreviewSvg` usa `mergeCardWithDefaults`/`mergeFlyerWithDefaults`
(tollerano campi mancanti e renderizzano comunque un SVG) e perché al primo
passaggio nell'editor l'auto-save risalva flat "sanando" il record; il logo
invece richiede `doc.builder` esplicito → preview vuota/icona fallback.

**Regole ora in vigore (path IS_LOCAL)**:

- Storage **canonico FLAT** per `logo`/`businessCard`/`flyer`: dominio al
  top level, **mai** chiave `data`. `saveDocument` appiattisce l'envelope in
  ingresso (`incoming = {...incoming, ...incoming.data}`) e fa
  `delete toStore.data` dopo il merge (pulisce anche i record legacy doppi
  al primo risalvataggio). QR/quote esclusi: i QR locali usano `data`
  legittimamente (`{type, payload}`).
- `getCustomer` (IS_LOCAL) ritorna i doc con **shim envelope**
  `{...d, data: d}` quando `data` manca: `CustomerDetail` e
  `useAutoBuildGenerate` leggono `doc.data.*` — non rompere questo shim.
- `autoBuildCustomer` (IS_LOCAL) crea i draft direttamente flat (spread
  `...d.data` + meta dopo).
- `getDocuments` (IS_LOCAL) applica `hydrateDocument` come già faceva il
  path PROD: i record envelope legacy (mai risalvati) vengono comunque
  appiattiti in lettura. `hydrateDocument` preserva
  `customerId`/`status`/`documentTheme` nel branch envelope (CollectionView
  filtra per `status`).
- Record legacy in doppia forma: si sanano al primo save; in alternativa
  migrazione manuale da console (spread `...d.data` + meta top-level).
- PROD invariato: API ritorna envelope jsonb `data`, `hydrateDocument`
  appiattisce; shim solo nel branch IS_LOCAL.
- **Mai importare `src/utils/logger.ts` da `dataService.js`**: alcuni test
  (`TierLimitModal.test.tsx`) caricano dataService via `require()` CJS e la
  risoluzione extensionless di `./logger` fallisce. Per log debug temporanei
  in dataService usare `console.*` e rimuoverli a fine diagnosi.
- **Test**: `dataService.documents.test.ts` describe "storage canonico flat"
  (regression doppio formato, QR intatto, shim getCustomer) + "getDocuments
  hydration"; `dataService.autoBuildLocal.test.ts` attese flat.

## 24. Breakpoint canonici responsive (2026-07-31)

Spec completata e rimossa (2026-07-31). Migrazione
completata: nei CSS di layout esistono **solo** `@media(max-width:767px)`
(MQ_SHELL) e `@media(max-width:1023px)` (MQ_WORKSPACE), più due eccezioni
documentate: `@1180` (topbar `btn-label`, range desktop 1024–1180) e
`@480` (small-phone, cover-grid card + admin stats, commento
`/* ≤480 small-phone exception (canonical 767/1023) */`).

Regole:

- **Shell switch a 1023**: a ≤1023 `.sidebar` e `.topbar` nascoste,
  `.mobile-topbar` visibile. `Layout.tsx` fa conditional render di
  sidebar/mobile-topbar/drawer via `useIsMobileWorkspace()`; la `.topbar`
  resta CSS-hidden (`display:none` nel blocco `@1023` di GlobalStyles) —
  differenza intenzionale, e2e `breakpoints.spec.ts` asserisce
  `.sidebar` assente dal DOM ma `.topbar` solo hidden.
- **Mai reintrodurre breakpoint storici** (900/899/880/1100/1200/1279/
  1400/768/760/680/640/600 come `max-width`). Hook JS: solo
  `useIsMobileShell()` / `useIsMobileWorkspace()`, mai
  `useMediaQuery('(max-width: Npx)')` ad hoc. Regression test:
  `Layout.collapsed-styling.test.tsx`.
- **`.editor-mobile-*` CSS-gated** (preventivo/flyer): pannelli piccoli,
  `display:none` di default, visibili nel blocco `@1023`. NON convertirli
  a conditional render JS senza motivo (CON-004 spec).
- **`.editor-col` fluido**: `width:clamp(280px,30vw,380px)` — niente
  gradini a breakpoint.
- **Preview auto-fit**: card (`CardPreviewSurface`) e flyer
  (`FlyerPreview`) misurano il container via ResizeObserver con guard
  `typeof ResizeObserver === 'undefined'` → default costante (jsdom).
- **Card parity mobile/desktop**: il tab system card
  (`useIsMobileWorkspace` in `CardEditorShell`) e i CSS card
  (`cardResponsive.css` ecc.) usano la stessa soglia 1023 — tenerle
  allineate o `card-mobile-desktop-parity.spec.ts` rompe.
- E2E di riferimento: `e2e/breakpoints.spec.ts` (AC-001..007: nav a
  800px, singola header a 375px, tab card/flyer a 800px, no overflow
  logo a 375px).

## 25. Build zero-warning + bundle vendor split (2026-08-01)

Obiettivo: `npm run build` senza warning. Due classi di warning
eliminate + una prevenzione npm 12.

### 25.1 Dynamic+static import mismatch ("will not move module into another chunk")

Causa: un modulo **staticamente** importato nel main chunk (da
AppShell/hook/orchestrator) veniva anche **dinamicamente** importato
altrove. Il `import()` non poteva splittarlo (già nel main) → Vite
avvisava. Fix: uniformare l'import.

- **Orchestrators** (`logo/social/onboarding/Palette`): `await
  import('./providers/registry')` → `import { providerRegistry }`
  statico. Registry è già nel main (BaseOrchestrator, AppShell, ecc.).
- **`useAISocial.ts`**: `await import('../utils/ai/captureElement')` →
  statico (aiModule lo importa già staticamente).
- **`pdfjs-dist`**: `pdfWorkerSetup.ts` lo importava staticamente,
  `pdfImporter.ts` dinamicamente → reso **tutto lazy**: `setupPdfWorker`
  è ora `async` e fa `await import('pdfjs-dist')` internamente
  (`parsePDF` fa `await setupPdfWorker()`). pdfjs esce dal main chunk →
  chunk dedicato ~472kB caricato solo all'import PDF.

**Regola**: prima di scrivere un `await import('./...')` per moduli
già importati staticamente (registry, providerPricing, resolveProviderId,
captureElement, pdfjs), valutare se lo split è reale. Se il modulo è già
nel main → import statico; se è grosso e usato solo on-demand (pdfjs,
tesseract) → tutto lazy (nessun import statico residuo).

**Nota (2026-08-01)**: il warning di `drizzle-kit migrate` in build
Vercel — `'@neondatabase/serverless' can only connect ... through a
websocket` — è **informativo e hardcoded**: finché
`@neondatabase/serverless` è dipendenza del progetto, drizzle-kit lo
sceglie (auto-detect, config postgres non ha override driver) e stampa
quel messaggio. Migration OK. Non è un warning di build Vite → non
viola §25. Non inseguirlo.

### 25.2 Eccezione documentata: crm.js import dinamici (§23 CJS)

`src/utils/dataService/crm.js` importa `registry` / `resolveProviderId` /
`providerPricing` **dinamicamente dentro la funzione** per vincolo §23
(require() CJS dei test). Quei moduli sono nel main chunk → il warning
resterebbe. Silenziato in `vite.config.js` via `customLogger.warn` con
filtro selettivo sulla stringa `dynamic import will not move module into
another chunk` (commento nel codice spiega il motivo). **NON rimuovere** il
filtro senza prima risolvere il vincolo CJS — riappariranno 3 warning.

Nota: il filtro va in `customLogger`, NON in `build.rollupOptions.onwarn`
(quel warning non passa da Rollup onwarn, arriva via logger di Vite).

### 25.3 manualChunks vendor

Main chunk era 4.2MB → warning "chunks larger than 500kB". Fix in
`vite.config.js` → `build.rollupOptions.output.manualChunks`:

- `react-vendor` (react, react-dom, scheduler), `router-vendor`,
  `lucide`, `zod`, `pdfmake`, `pdf-libs` (jspdf, svg2pdf.js), `docx`,
  `tesseract`, `html2canvas`, `dnd-kit`, `qrcode`.
- Risultato: main **712kB** (gzip 209kB), vendor cacheable separati,
  `chunkSizeWarningLimit: 2500`.

Regola: nuovi moduli grossi vendored (node_modules) → aggiungere al
`manualChunks` se superano quota e non sono già lazy.

### 25.4 npm 12 `allowScripts` (install-scripts bloccati)

npm ≥12 blocca di default gli install-scripts delle dipendenze →
esbuild senza postinstall = binario mancante = build rotta in fresh
install/CI. `package.json` ha `allowScripts` **name-only** (no `@version`)
per: `@google/genai`, `core-js`, `esbuild`, `protobufjs`, `tesseract.js`.

Regole:

- **Mai pin con `@versione`** (`"esbuild@0.25.12": true`): smette di
  matcherare al bump → warning torna + binario esbuild mancante.
  `npm approve-scripts` di default scrive pinned: usare
  `npm approve-scripts --no-allow-scripts-pin <pkg>` o editare a mano.
- Nuova dipendenza con install-script → aggiungerla a `allowScripts`
  (name-only) **e committare**, altrimenti fresh install la silenzia
  senza errori visibili (solo lista in fondo all'install).
- Verifica: rimuovere `node_modules` + `package-lock.json`, `npm install`
  pulito, poi `npm run build` — binario esbuild presente
  (`node_modules/esbuild/bin/esbuild.exe`) e zero warning.

### 25.5 Trappola: `npm install` pulito aggiorna le dipendenze

`^1.0.0-beta.22` su `drizzle-orm`/`drizzle-kit` risolve anche le **rc**
(es. rc.4) che hanno API breaking (`drizzle(url, { schema })` →
TS2345). Il `package-lock.json` pinnato a beta.22 tiene ferma la
versione. **Mai cancellare il lockfile** in install puliti; se serve
ripristino: `git checkout -- package-lock.json && npm install`. npm 12
riscrive comunque il lockfile (pruning optional/peer deps: pg,
@opentelemetry, ecc.) — innocuo, versioni core invariate.

## 26. Thinking mode sempre attivo — no temperature (2026-08-03)

Tutte le chiamate AI usano **thinking mode al massimo livello**.
`temperature` rimosso ovunque (DeepSeek thinking mode lo ignora, Ollama
non serve). Dettaglio per provider:

### DeepSeek (API `api.deepseek.com/v1/chat/completions`)

- Body include: `reasoning_effort: 'max'` + `extra_body: { thinking: { type: 'enabled' } }`
- `temperature`/`top_p`/`presence_penalty`/`frequency_penalty` non supportati
  in thinking mode (ignorati silenziosamente dall'API)
- `reasoning_content` nel response: presente in `choices[0].message.reasoning_content`
- **Multi-turn con tool calls**: `reasoning_content` DEVE essere ripassato
  nell'assistant message (`reasoning_content` field). Senza tool calls,
  viene ignorato dall'API. Con `tools` nel body, **mancarlo → 400**
  (doc ufficiale thinking_mode → tool_calls). Implementato:
  - `ChatMessage.reasoningContent` serializzato come `reasoning_content`
  - `handleStream` accumula `reasoningContent` dai chunk streaming
  - Orchestratori quote/card/flyer lo ripassano nell'assistant con toolCalls
- **Streaming**: chunk include `delta.reasoning_content` → propagato come
  `AIStreamChunk.reasoningContent`
- **KV cache (doc ufficiale kv_cache)**: abilitata di default server-side.
  `usage.prompt_cache_hit_tokens` / `prompt_cache_miss_tokens` parsati in
  `usage.cachedTokens` (client + proxy stream). Cache hit = prefisso
  riutilizzato integralmente; i token cache-hit costano meno in fatturazione.

### Ollama (API `ollama.com/api/chat`)

- Body include: `think: <effort>` (sostituisce `options.temperature`).
  Valore: `options.reasoningEffort ?? getAiReasoningEffort()` (default `'max'`)
- `think` accetta booleano o stringa (`low`/`medium`/`high`/`max`).
  `max` = massimo sforzo di ragionamento
- `message.thinking` nel response: contiene la traccia di ragionamento
- **Streaming**: chunk include `message.thinking` → propagato come
  `AIStreamChunk.reasoningContent`
- **Structured outputs (doc ufficiale)**: `format` accetta `'json'` o un
  **JSON schema** (Ollama `format: <schema>`). `ChatOptions.jsonSchema`
  passa lo schema; `responseFormat.json_object` resta mappato a `'json'`.
  Cloud attualmente NON supporta structured outputs (doc ufficiale nota) —
  schema passato solo a runtime locale/self-host
- **Tool calling**: thinking + tools funzionano insieme; `reasoningContent`
  va ripassato come `thinking` nel messaggio assistant
- **Streaming proxy**: `message.thinking` Ollama è propagato come
  `delta.reasoning_content` nel SSE normalizzato (parity client)

### Selettore UI effort (2026-08-04)

- Dropdown `AIProviderBadge` ha un selettore a 3 livelli:
  `Veloce` (`low`) / `Profondo` (`high`) / `Massimo` (`max`)
- Persistito in `pq_ui:v1` campo `aiReasoningEffort` (getter/setter in
  `uiPrefs.ts`: `getAiReasoningEffort` / `setAiReasoningEffort`).
  Default `'max'`
- Priority chain effettiva: `options.reasoningEffort` (orchestratore)
  → `getAiReasoningEffort()` (pref utente) → `'max'`
- Mappatura per provider: DeepSeek accetta `low`/`high`/`max`; Ollama
  `low`/`medium`/`high`/`max` (`medium` solo Ollama — il selettore UI
  non lo espone, resta via options esplicite)
- Server proxy (`src/server/handler.ts`): `reasoning_effort` nel body è accettato
  anche per provider `ollama` e mappato a `think` (`reasoning_effort ?? 'max'`)
- Dev proxy (`vite.config.js`): propaga `think`/`format`/`num_predict` e
  `reasoningEffort` nelle options verso il provider Ollama

### Provider registrati (7 totali)

| ID | Provider class | Model | Vision | Pricing |
|---|---|---|---|---|
| `deepseek-v4-flash` | DeepSeekProvider | deepseek-v4-flash | no | $0.14/$0.28 per 1M tok |
| `deepseek-v4-pro` | DeepSeekProvider | deepseek-v4-pro | no | $0.55/$2.19 per 1M tok |
| `ollama-minimax-m3` | OllamaProProvider | minimax-m3:cloud | sì | $20/mo flat |
| `ollama-deepseek-v4-flash` | OllamaProProvider | deepseek-v4-flash:cloud | no | $20/mo flat |
| `ollama-deepseek-v4-flash-0731` | OllamaProProvider | deepseek-v4-flash:0731-cloud | no | $20/mo flat |
| `ollama-deepseek-v4-pro` | OllamaProProvider | deepseek-v4-pro:cloud | no | $20/mo flat |
| `ollama-qwen-3.5` | OllamaProProvider | qwen-3.5 | sì | $20/mo flat |

### Regole per modifiche future

1. **Mai reintrodurre `temperature`** in `ChatOptions` o body request.
   Thinking mode è sempre attivo, `temperature` non ha effetto.
2. **`reasoningEffort`** in `ChatOptions` (tipo `'low' | 'high' | 'max'`).
   Priority: `options.reasoningEffort` → `getAiReasoningEffort()` (pref
   utente `pq_ui:v1`) → `'max'`. Mai hardcodare `'max'` in chiamate che
   devono rispettare la preferenza utente.
3. **`reasoningContent`** in `ChatMessage` va popolato quando si ripassano
   messaggi assistant con tool calls (DeepSeek richiede `reasoning_content`
   nel messaggio). Per Ollama, il field si chiama `thinking` nel body API
   ma è mappato a `reasoningContent` internamente.
4. **Streaming**: entrambi i provider emettono `reasoningContent` nei chunk.
   `handleStream` lo accumula; gli orchestratori DEBBONO ripassarlo
   nell'assistant message quando ci sono `toolCalls` (DeepSeek → 400 se
   manca). Nuovo orchestratore tool-aware: seguire lo stesso pattern.
5. **`ollama-deepseek-v4-flash`** è un Ollama Pro provider che usa il model
   `deepseek-v4-flash:cloud` (DeepSeek V4 Flash via Ollama Cloud, flat rate).
   Non va confuso con `deepseek-v4-flash` (DeepSeekProvider, pay-per-token).
6. **`ollama-deepseek-v4-flash-0731`** usa il tag mensile Ollama Pro Cloud
   `deepseek-v4-flash:0731-cloud` (snapshot build del mese). Stesso flat rate.
   Tag nuovi vanno registrati in `registry.ts` + `providerPricing.ts` +
   `providerModelShort` (UI label). **Suffisso `-cloud` è obbligatorio**
   per i model Ollama Pro Cloud (`:0731` → 404/`Provider non trovato`).
7. **KV cache**: `usage.cachedTokens` = `prompt_cache_hit_tokens` (DeepSeek).
   Se un giorno si tracciano costi reali, i token cache-hit vanno fatturati
   a tariffa cache (più bassa), non a quella full.

---

## 26. Website Builder — prompt & mappa (2026-08-04)

Dettagli per `src/ai/prompts/websiteSystem.ts` e `src/ai/websiteOrchestrator.ts`.

### 26.1 Google Maps embed

- `maps.app.goo.gl/<codice>` è un redirect short-link: **NON funziona come
  parametro `q`** nell'iframe (`google.com/maps?q=...`). L'AI che copia il
  codice goo.gl produce la mappa del mondo senza pin.
- Fix: nel prompt HTML l'iframe va fornito **già completo e sanitizzato**,
  con istruzione "usa ESATTAMENTE questo iframe, NON costruirne un altro".
- `sanitizeMapAddress(contacts)`: rimuove emoji/icone (regex range
  `\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}`) e prende indirizzo +
  città (primi 2 elementi separati da virgola) → `q=Via+Dante+5%2FA+Cagliari`.
  Google geocodifica il testo con pin, non il codice breve.
- Le emoji nei contatti del brief (`📍 Via Dante 5/A`) finivano nel `q` se
  non sanitizzate — sempre passare da `sanitizeMapAddress`.

### 26.2 Logo & emoji nel brand

- L'AI tende a generare emoji (es. 🍦) nel brand/hero quando il brief le
  contiene nella descrizione. Prompt HTML ora vieta: "🚫 EMOJI NEL TESTO:
  NON usare emoji nel brand, nei titoli o nel testo visibile".
- Logo: l'AI NON deve mai generare `<img>`, `<svg>` logo, `<span
  class="brand-mark">` o placeholder. Il logo reale è iniettato dopo via
  `injectLogoIntoHtml` (brand/nav-inner/header). Il `.brand` deve contenere
  solo il testo del nome attività.

### 26.3 Font del brief vs firma stile

- Il selettore stile (13 stili, `styleVisualSignature`) descrive
  peso/forma/lettering, MAI il nome del font. Se il brief richiede un font,
  `--font` DEVE essere quel font — la firma stile non lo sovrascrive.
- Prompt CSS: "Font preferito (OBBLIGATORIO, massima priorità)" + nota
  "NON sostituirlo con la firma dello stile" + "NON importare altri font Google".
- Test: `src/ai/prompts/__tests__/websiteSystem.test.ts` (7 test: mappa
  sanitized, social obbligatori, firma stile, fallback modern, font priority,
  emoji vietate).

### 26.4 Stile pill → precompila refine

- `updateStyle` in `WebsiteEditor` salva la preferenza `style` e, se il sito
  ha contenuto, **pre-compila il prompt di refine** "Applica lo stile visivo
  X..." — l'utente preme solo "Raffina". Il refine NON parte da solo.

### 26.5 Costo per admin

- `BaseOrchestrator.trackUsage`: admin (`admin@gmail.com`) non traccia
  `trackTokens` server-side ma il **costo va comunque calcolato e ritornato**
  per il badge `lastCostUsd`. Bug storico: early return 0 per admin →
  badge sempre $0 con DeepSeek pay-per-token.
- `WebsiteOrchestrator.generateSite` somma `trackUsage` dei 4 step in
  `aiCall.costUsd`; il hook usa `result.aiCall?.costUsd` (non solo l'usage
  del primo step).

### 26.6 Step generation (riepilogo stato)

- 4 step sequenziali: HTML (stream) → CSS (non-stream) → JS (non-stream) →
  Verify (non-stream). Ognuno con array messaggi **fresco**
  (`[{system},{user}]`), mai `buildMessages` (accumula storia → AI confusa).
- `reasoningEffort`: non hardcodato negli step — fallisce su
  `options.reasoningEffort ?? getAiReasoningEffort()` (selettore UI).
- `onStep`/`onStepResult` con meta `{durationMs, tokens}` per log dettagliati
  (preview 300/500 char, durata, token, prime 3 issue verify).
- `verifyIssues`/`verifyFixesApplied` nel `WebsiteProcessResult`/`RefineResult`
  → pannello UI in WebsiteEditor.

### 26.7 Gallery immagini

- `injectImagesIntoHtml` (`src/utils/website/imageInjection.ts`) riempie i
  `.gallery-item` (div **o button**, con o senza contenuto) con le immagini
  caricate; se non c'è gallery aggiunge sezione `#gallery` prima del footer;
  rimuove i placeholder vuoti (loop per wrapper annidati); non tocca item
  che hanno già `<img>` (doppio-inject evitato).
- Prompt HTML: gallery-item come `<div class="gallery-item"></div>` VUOTI,
  senza `<img>`/emoji/`<button>`.
- Test: `src/utils/website/__tests__/imageInjection.test.ts` (7).

### 26.8 Vision preview (html2canvas, iframe isolato)

- La preview vision per il refine usa un **`<iframe srcDoc>`** posizionato
  fuori schermo: documento ISOLATO → il CSS del sito NON contamina il DOM
  dell'app (bug storico: `:root` del sito sovrascriveva `--accent` ecc. e
  colorava i bottoni dell'editor).
- Cattura desktop (1024) + mobile (375) via `html2canvas` su
  `iframe.contentDocument.body`, poi `compressDataUrl(640px, 40KB)` —
  il body `/api/ai/chat/stream` deve stare sotto il limite proxy
  (altrimenti `ERR_CONNECTION_RESET` e crash dev server).
- Attivo solo se `getAiVisionEnabled() && providerSupportsVision(model)`.
- Ollama vuole **base64 puro** in `images` (senza prefisso `data:...;base64,`)
  → `buildOllamaBody` strippa il prefisso inline (400 illegal base64 altrimenti).

### 26.9 Export ZIP condiviso

- `src/utils/websiteExport.ts` (`exportWebsiteZip`, `buildWebsiteFullDocument`)
  condiviso da editor + Collection: immagini/logo base64 → `assets/` con
  `src` relativi, `.html` per pagina. Test: `websiteExport.test.ts` (5).
- `src/server/handler.ts` (ex api) bodyParser `1mb` → `4mb` (documenti website con immagini
  inline superavano 1MB → salvataggio 413).

### 26.10 Dev proxy: ERR_HTTP_HEADERS_SENT

- Quando uno stream AI fallisce DOPO l'invio degli header SSE, `json()` su
  quella response lancia `ERR_HTTP_HEADERS_SENT` → **crash del dev server**.
- Fix (vite.config.js, entrambi i path stream — DeepSeek SSR + proxyOllamaChat):
  flag `streamStarted`; se true, l'errore viene scritto come **evento SSE**
  (`data: {error}` + `[DONE]`) invece di `json()`.

### 26.11 Sanitize post-generazione

- `src/utils/website/sanitizeGenerated.ts`:
  - `sanitizeGeneratedCss`: rimuove blocchi `X::before/::after` con
    `content: "<emoji>"` (regex range emoji).
  - `sanitizeGeneratedHtml`: rimuove (in loop) div/span vuoti decorativi
    (`.shape`, `.hero-shapes`, `.dot`, `.blob`, ...).
  - Applicato in `handleGenerate` prima di inject logo/immagini.
- Prompt CSS/HTML vietano ::before emoji e div decorativi (doppia difesa:
  prompt + sanitize).
- Test: `src/utils/website/__tests__/sanitizeGenerated.test.ts` (7).

### 26.12 Preview SVG reale (foreignObject) + compressione website (2026-08-05)

**Preview Collection/CRM (`src/utils/docPreviewSvg.ts`)**:
- `buildWebsitePreviewSvg` renderizza HTML/CSS reali dentro `<foreignObject>`
  (320×200 o 375×234 se il CSS ha media query mobile → layout mobile vero).
- `scopeCss(css, '.ws-preview')`: parser CSS custom (no dipendenze) che
  scopa TUTTE le regole con prefisso `.ws-preview` — `:root`/`html`/`body`
  → wrapper, altri selettori prefixati, `@media`/`@supports` ricorsivi,
  `@keyframes`/`@font-face`/`@page` globali, `@import`/`@charset` drop
  con contenuto. Se NON scoppi, il CSS del sito contamina l'app host
  (stesso bug del vision iframe §26.8).
- `stripScripts(html)` rimuove `<script>` e `on*` attrs — MAI `dangerouslySetInnerHTML`
  con HTML sito non sanitizzato. `</style` escape per non chiudere il tag host.
- Fallback `buildWebsitePlaceholderSvg` se nessun codice o HTML vuoto dopo strip.
- `DocPreview` component in CollectionView: `useMemo` su `[doc]` (1 sola
  chiamata per card, prima `buildPreviewSvg(doc)` girava 2× per card + a
  ogni re-render). Altezza card website 160px.
- **Nota Safari**: `foreignObject` non renderizzato su Safari < 14 — fallback
  placeholder solo su browser vecchi (accettato).

**Save quota localStorage (bug 2026-08-05: save website falliva silenziosamente)**:
- Sintomi: "Spazio locale esaurito (immagine troppo grande)" a salvare sito
  con hero/gallery; ZIP vuoto (draft mai salvato). Cause doppie:
  1. `handleSave` (WebsiteEditor) NON dedupava più le immagini iniettate
     nell'HTML da `images[]` → doppione ≈ 2× spazio (la dedupe era nel
     vecchio codice pre-refactor export).
  2. `compressPayloadImages` (dataService/images.js) copriva solo path
     fissi (`front.*`, `builder.backgroundImage`, `content.heroImage`) —
     i campi website (`html` con src base64 inline, `logoUrl`, `images[]`)
     NON erano compressi → un sito superava quota subito.
- Fix: (a) dedupe in `handleSave` (`inlineImages` da `html` → filter
  `images[]`); (b) `compressPayloadImages` esteso: src `data:image/` >300K
  chars dentro `html` compressi a 768px/200KB (Set per src duplicati),
  `logoUrl` e ogni `images[]` grande compressi. try/catch per immagine
  non comprimibile (resta originale, no crash).
- `cleanupGhostDocuments` (documents.js:248) filtra solo
  `front/builder/content != null` → website flat con solo `html/css/js`
  verrebbe cancellato. Nessun chiamante oggi, ma se riattivato va
  esteso a `html != null || css != null`.
- Regressione: `websiteRoundtrip.test.ts` (6) — save/load/export con JSZip
  reale (mock `file-saver` cattura blob, zip ispezionato con `JSZip.loadAsync`).
- Test stale TB-028 fixati: tabs Collection (8 admin/7 non-admin con "Siti
  Web"), `useRouteView` ROUTE_PATHS 11 chiavi.

### 26.13 Website backlog 2026-08-05 — verify fixes, SEO, step UI, cache, provider stale

**Verify fixes applicati al codice** (`websiteOrchestrator.generateSite`):
- I `fixes` del Verify agent (html/css/js) ora vengono APPLICATI al sito
  finale (prima erano solo loggati). `html`/`css`/`js` sono `let`; il fix
  viene saltato se identico al codice corrente (niente changes fantasma).
  `verifyFixesApplied` espone le parti corrette (pannello issue).
- SEO post-process: `ensureSeoMeta` (`src/utils/website/seoMeta.ts`) inietta
  nel `<head>` `meta description` + OG tags (`og:title/description/type/
  site_name`) dal brief se l'AI li omette — MAI duplicare tag esistenti
  (regex name/property), escape XML, `og:type=website` sempre se assente.
  Log `seo:meta-injected` in changes. Applicato SUBITO dopo lo step HTML
  (prima di CSS/JS/Verify → il verify vede già i meta).
- Prompt verify con check ACCESSIBILITÀ espliciti (WCAG AA): `alt` su ogni
  img, label su form, aria-label su icon-button, `title` su iframe,
  contrasto 4.5:1/3:1, interattivi raggiungibili da tastiera.
- Test: `websiteOrchestrator.test.ts` (8: happy path con SEO, fixes applicati,
  issues senza fixes, fallback html non-JSON, onStep 4 step, refine merge
  parziale/errore/onStep), `seoMeta.test.ts` (7).

**Step progress UI**: `useAIWebsite` espone `currentStep` (set su `onStep`,
reset su `onStepResult`/errore/`reset`). WebsiteEditor mostra indicatore
con spinner + label (html/css/js/verify/refine) sotto il bottone Genera.
CSS: `.website-step-indicator` (+ keyframes spin).

**Vision preview cache**: `captureVisionPreviews` (WebsiteEditor) riusa gli
screenshot dell'ultima chiamata se `html+css+js` sono invariati (cacheKey
join `|`); ref `lastVisionCacheRef` locale all'editor + `lastVisionCache`
dal hook (sync solo on mount — cache ref dell'editor è la fonte reale,
il valore dal hook è snapshot). html2canvas ~700ms × 2 viewport saltati
se il codice non è cambiato (es. refine che tocca solo prompt).

**Provider default stale**: `getValidatedProviderDefault(registry)` in
`uiPrefs.ts`: se `aiProviderDefault` salvato in `pq_ui:v1` non esiste più
nel registry, ritorna il default di registry e RIPULISCE la pref (il badge
prima mostrava un ID morto, fallback silenzioso). Usato da AIProviderBadge,
AppShell, CardEditorShell, WebsiteEditor. Test: uiPrefs (3 nuovi casi).

**Save quota dedupe**: già risolto in §26.12 (handleSave filter
`inlineImages` da `images[]` + `compressPayloadImages` esteso) — nessun
codice nuovo qui.

**Multi-pagina reale (2026-08-05, risolto)**: vedi §26.14.

### 26.14 Multi-pagina reale + regole stile verify (2026-08-05)

**Multi-pagina reale** (risolve il backlog "export ZIP generava pagine con
lo stesso HTML"):
- Schema website: nuovo campo `pagesHtml` (`Record<nomePagina, html>`),
  index resta in `html`. Shape FLAT locale e envelope PROD passano dal
  dataService senza modifiche (già `{...body}` / flat top-level).
- Orchestrator: step `page:<nome>` DOPO l'HTML (prima di CSS/JS/Verify),
  uno per pagina secondaria (da `pages` dell'AI, senza `index`). Prompt
  `buildWebsitePagePrompt` (`promptRegistry` id `website-page`): la pagina
  DEVE avere head+viewport+meta description, nav IDENTICA alla index
  (estratta con `extractNavFromHtml`), footer con `.current-year`, divieti
  logo/SVG/emoji/div decorativi, link relativi (`about.html`). `ensureSeoMeta`
  applicato anche alle pagine secondarie. Pagina fallita → `error:page:<nome>`
  in changes (le altre proseguono).
- CSS/JS/Verify ora ricevono TUTTE le pagine concatenate
  (`allPagesHtml`) → le classi di about/contact vengono stilizzate e
  verificate davvero (prima il CSS vedeva solo la index).
- Costo: `pagesCost` accumulato per pagina e sommato ad `aiCall.costUsd`.
- Editor (`WebsiteEditor`): `pagesHtml` salvato, injection logo su ogni
  pagina (gallery immagini solo su index), preview con page switcher
  (`previewPage`, `srcDoc` = pagina corrente → i link `about.html` si
  vedono in anteprima), code editor con switcher per pagina, save dedupe
  immagini su TUTTE le pagine, vision cacheKey include le pagine.
- Export ZIP (`websiteExport.ts`): `about.html` usa `pagesHtml['about']`
  (fallback index se assente). Test aggiornati (mock jszip + roundtrip
  JSZip reale: contenuto dedicato, no fallback al `#0000` di prima).
- Refine: `pagesHtml` merge parziale (`{...site.pagesHtml, ...refine.pagesHtml}`),
  blocco `### HTML <nome>` nel prompt per ogni pagina, change
  `refine:pagesHtml:changed`.

**Regole stile nel prompt verify (§26.13 + questa)**: check espliciti
12-14: NESSUN `::before/::after` con content contenente testo/icone/emoji
(`content: ""` obbligatorio, solo gradienti), NESSUN tag `<svg>`/SVG salvo
richiesta esplicita del brief, nessuna emoji nel testo. Prompt HTML/CSS
allineati (divieto SVG esplicito). NIENTE strip SVG nel sanitize: il brief
può richiederli legittimamente (notes) — prompt + verify bastano (decisione).

**Bug latente fixato**: `cleanupGhostDocuments` (documents.js:248) filtro
esteso a `html != null || css != null` — prima un website FLAT senza
`data/front/builder/content` sarebbe stato cancellato come fantasma
(nota §26.12, oggi nessun chiamante attivo).

**Fix lampeggio step indicator**: `onStepResult` NON resetta più
`currentStep` (lampeggio a ogni step: reset → set → reset); ora reset
esplicito a fine generate/refine (successo o errore).

### 26.15 Verify determinismo — analyze_site + loop 2 pass (2026-08-05)

**Causa radice issue "HTML/CSS/JS troncati" (bug segnalato 2026-08-05)**: NON
era il sito rotto — era il PROMPT che troncava il codice!
`buildWebsiteVerifyPrompt` faceva `html.slice(0, 2000)`, `css.slice(0, 2000)`,
`js.slice(0, 1000)`. Con HTML 2306ch/CSS 2204ch/JS 1788ch il verify agent
vedeva codice tagliato a metà paragrafo/regola/chiamata → segnalava
"troncato" (false positive) e "fixava" roba non rotta.

**Fix**:
1. **Niente slice nel prompt verify**: il codice passato è COMPLETO e il
   prompt lo dice esplicitamente ("mai troncato: se noti che termina a metà,
   è un problema REALE del sito, non del prompt").
2. **Tool deterministico `analyze_site`** (`src/utils/website/siteAnalyser.ts`,
   definizione in `TOOL_DEFINITIONS`): controllo puro lato client — tag HTML
   bilanciati (stack, void/self-closing), parentesi CSS (braces), JS
   (paren/bracket/brace + stringhe non chiuse → troncamento REALE),
   `::before/::after` con content non vuoto (regola stile), img senza alt,
   iframe senza title, emoji nel testo visibile. I risultati (html/css/js)
   vengono PRECOMPILATI nel messaggio come assistant toolCalls + tool
   results (DeepSeek e Ollama li supportano; con provider senza tools si
   salta e il loop resta valido). Con tool messages niente `responseFormat`
   json_object (stesso pattern cardOrchestrator — Ollama può rompersi).
3. **Loop verify max 2 pass**: pass 1 = analyze_site + issue + fixes
   applicati; pass 2 (solo se issue) = recheck sul codice fixato. Recheck
   pulito → `verify:ok` e `verifyIssues = undefined` (pannello solo per
   problemi RESIDUI dopo i fix). Costo: `verifyCost` somma entrambi i pass.
   Changes: `verify:recheck:Nissues`.
4. **SEO meta fix** (`ensureSeoMeta`): (a) contenuto sanitizzato — niente
   emoji, niente a capo letterali (il brief "🦐 Tre coni\n@gambero_rosso…"
   produceva un og:description malformato e incoerente col title);
   (b) OG inseriti DOPO charset/viewport (ordine head valido, prima
   comparivano prima); (c) `og:description` coerente — usa la `meta
   description` esistente se presente (mai contraddizioni brief/pagina).
   `META_DESC_RE` + `sanitizeMetaText`.
5. **Prompt verify check 15-16**: contenuti duplicati e ordine meta nel
   head (charset → viewport → altri).

### 26.16 Verify — fix AI rifiutati se il codice è integro (2026-08-05)

**Bug reale osservato (log 16:50/16:53, seconda generazione)**: il modello
continuava a segnalare "HTML/CSS/JS troncato" (false positive) anche con il
codice completo nel prompt, e i suoi fixes RISCOSCRIVEVANO il sito buono —
es. HTML 2114ch "fixato" perdendo mappa/contatti/form; canonical verso
Instagram inventata; og:description con emoji del brief.

**Fix (tool deterministico = fonte di verità, NON l'AI)**:
1. **Fix applicati solo se il tool conferma il problema**: `analyze_site`
   ricalcolato lato client (pass 0) → `toolOk {html,css,js}`. Il fix AI su
   una parte che il tool dichiara INTEGRA viene RIFIUTATO (il codice buono
   resta, niente sezioni perse). Solo le parti realmente rotte vengono
   corrette. Changes: nessun `verify:html:fixed` se rifiutato.
2. **Recheck deterministico nel pass 2**: dopo i fixes, `analyze_site`
   ricalcolato sui codici fixati. Se le 3 parti sono integre →
   `verify:recheck:ok`, issue del modello scartate, `verifyIssues =
   undefined` (niente pannello allarmi). Solo se il tool trova ancora
   problemi reali restano `verifyIssues` + `verify:recheck:Nissues`.
3. **`stripSocialCanonical`** (seoMeta): rimuove `<link rel="canonical">`
   verso domini social (instagram/facebook/tiktok/linkedin/x/twitter/
   youtube) — l'AI la inventa dal social del brief e i motori
   tratterebbero il profilo come sito ufficiale (SEO critico).
4. **`ensureSeoMeta` sanitizza anche i meta GIÀ presenti**: emoji/a capo
   nei content dei tag generati dall'AI (es. brief "🦐 Tre coni\n...")
   puliti con la stessa `sanitizeMetaText` (era solo sui tag iniettati).
5. **Niente troncamento**: il prompt verify riceve il codice COMPLETO
   (§26.15). Gli step intermedi (log Prompt/Risposta per html/css/js/
   verify) restano tutti visibili nel pannello AI — il log citato
   (16:50) era la versione pre-fix: il "Prompt Verify" in quel log mostra
   ancora il vecchio formato senza "COMPLETO e INTEGRALE".

**Test**: `websiteOrchestrator.test.ts` (18 — fix rifiutato su parte valida,
fix applicato solo su parte rotta, recheck deterministico ok/fallito,
tool precompilati), `seoMeta.test.ts` (13 — canonical social rimossa/
mantenuta, sanitize meta esistenti), `siteAnalyser.test.ts` (12). Gate:
typecheck + 531 test impattati verdi.

### 26.17 Verify — tools dichiarati + maxTokens (2026-08-05)

**Bug reale (log 17:17, dopo §26.16)**: verify MORTO dopo "pass 1 (con
analyze_site)" — nessuna "Risposta Verify", nessun "Sito generato", costo
mai aggiornato. Causa: i tool_calls precompilati nel messaggio NON erano
dichiarati in `tools` della richiesta → Ollama/DeepSeek li rifiutano
(400 silenzioso, il verify fallisce senza log). Secondo bug nello stesso
log: `Ollama (400): {"error": "Value looks like object, but can't find
closing '}' symbol"}` sullo step HTML — generazione lunga (97s) troncata
dal `maxTokens: 8192` → JSON incompleto → `format: json` lo rifiuta.
(L'HTML riuscito usava 8207 tok: oltre il budget.)

**Fix**:
1. `tools: ANALYZE_SITE_TOOLS` dichiarato nella richiesta verify quando ci
   sono tool results (senza → 400). `getToolDefinition('analyze_site')`
   dalla registry esistente, niente definizione duplicata.
2. **maxTokens 8192 → 16384** su TUTTI gli step website (html/css/js/
   page/verify/refine): il sito completo (head SEO + hero + sezioni +
   footer) supera 10k token; JSON troncato = 400 Ollama o fallback inutile.
3. **Gestione tool-call del modello**: se il verify risponde con content
   null + toolCalls (invoca analyze_site da solo), esegui il tool lato
   client, appendi i risultati e fai una chiamata finale con
   `responseFormat: json_object` senza tools. Prima `parseJsonResponse`
   falliva su content null → verify morto.
4. **Costo**: `verifyCost` ora include entrambe le chiamate (verify + 
   eventuale follow-up tool). Con Ollama flat il badge mostra $0/`flat`
   (corretto: `showCost = !isFlat` in AIProviderBadge) — per i provider
   pay-per-token si aggiorna sempre.

**Test**: `websiteOrchestrator.test.ts` (19 — tools dichiarati nella
richiesta, tool-call del modello gestito con follow-up). Gate: typecheck +
suite impattata verde.

### 26.18 Verify — content '' per Ollama + retry senza tools + best-effort (2026-08-05)

**Bug reale (log 18:04, dopo §26.17)**: la generazione MORIVA sul verify —
`Ollama (400): {"error": "Value looks like object, but can't find closing
'}' symbol"}` su `websiteOrchestrator.ts:275` (la `provider.chat` del verify
pass 1). Causa: nei messaggi assistant con `tool_calls` precompilati usavo
`content: null` — il body JSON risultante è malformato per il parser Ollama
(400 su TUTTI i tool_calls, non solo quelli dichiarati). Il 400 propagava
fino all'utente: **sito perso** (html/css/js validi buttati).

**Fix**:
1. **`content: ''` (stringa vuota) nei messaggi assistant con tool_calls**,
   mai `null` — stesso pattern `cardOrchestrator`/`flyerOrchestrator` che
   funzionano in prod (i log card/flyer non hanno mai avuto questo 400).
   Vale sia per i tool_calls precompilati sia per il follow-up dei
   tool-call del modello.
2. **Retry senza tools**: se la chiamata con tools fallisce (400 o altro),
   retry UNA volta con `baseVerifyMessages` senza tools e senza
   responseFormat tool (stessa domanda, `json_object`). Changes:
   `verify:tools-retry`. Ollama resta usable anche se i tool_calls
   precompilati non passano.
3. **Verify best-effort**: se anche il retry fallisce, il verify viene
   SALTATO con `verify:error:<msg>` in changes e il sito generato viene
   comunque restituito (html/css/js/pages integri). Prima l'eccezione
   propagava e perdeva tutto. Il pannello issue resta pulito
   (`verifyIssues` undefined) — meglio nessuna verifica che perdere il sito.
4. **`ERR_INVALID_URL` da html2canvas**: data URL immagine gigante (>300KB,
   foto EXIF da camera) troncato nel clone iframe (about:srcdoc) →
   `GET data:image/... net::ERR_INVALID_URL` rumoroso. Fix: `onclone`
   sostituisce nel clone le img data-URL >300KB con placeholder
   trasparente (soglia abbassata da 800KB: il troncamento avviene anche
   sotto 1MB). Il DOM reale non viene toccato. Rumore console eliminato,
   cattura vision invariata (l'immagine gigante non serve alla preview).
5. **`ERR_INVALID_URL` definitivo (2026-08-05)**: l'errore persisteva anche
   con img PICCOLE — la causa è il data URL con **base64 wrapped**
   (whitespace letterali nel payload, `\n`/spazi a ogni 76 char): Chrome
   lo rifiuta in `about:srcdoc` e nel clone html2canvas. Fix:
   `src/utils/website/imageNormalize.ts` (`normalizeInlineImages`):
   (a) strip di TUTTI i whitespace dal payload base64 dei `src` img e dei
   `background-image` inline; (b) img data-URL >50KB sostituite con
   1px GIF (non servono al feedback vision e gonfiano il body proxy).
   Applicata alla `srcDoc` dell'iframe vision (`WebsiteEditor`). Nel clone
   html2canvas, `onclone` fa la stessa normalizzazione + rimozione
   background-image inline con data: (il clone parte dal DOM reale, già
   normalizzato, ma il `src` modificato via attribute setter non passa
   dagli attrs HTML → doppia difesa). Test `imageNormalize.test.ts` (5).

**Test**: `websiteOrchestrator.test.ts` (21 — retry senza tools su 400,
verify best-effort con sito preservato, content '' nei tool_calls).
Gate: typecheck + 193 test impattati verdi.

### 26.19 Dev proxy tools + test 3 provider + flusso completo (2026-08-05)

**Causa radice 400 finale (log 18:04, `POST /api/ai/chat 400`)**: il DEV
proxy (`vite.config.js` `proxyOllamaChat`) NON propagava `tools` nel body
upstream — `ollamaReq = { model, messages, stream: true }` e basta. I
tool_calls precompilati (verify analyze_site) arrivavano a Ollama senza
`tools` dichiarato → 400 "Value looks like object, but can't find closing
'}' symbol". In PROD `src/server/handler.ts:1373` i tools erano già propagati
(§26.17) — il bug era solo dev. Fix: `if (Array.isArray(body.tools) &&
body.tools.length > 0) ollamaReq.tools = body.tools;`.

**⚠️ Regola §12**: modifiche a `vite.config.js` → **riavviare `npm run dev`**
(il proxy è letto a startup). Senza riavvio i fix verify restano invisibili
in locale.

**Test per i 3 provider (richiesta utente)**:
- `src/ai/providers/__tests__/verifyBody.test.ts` (3): serializzazione
  body verify con `content: ''` + tool_calls precompilati + tools per
  **ollama minimax-m3**, **ollama deepseek-v4-flash-0731**, **deepseek
  v4-flash**. Verifica: content è STRINGA (mai null — il 400 Ollama),
  tool_calls presenti (3), tool results presenti (3), tools dichiarati.
- `src/ai/__tests__/websiteOrchestrator.providers.test.ts` (4): flusso
  COMPLETO `generateSite` con provider reali (fetch mockato):
  deepseek-v4-flash (chat), ollama-minimax-m3, ollama-deepseek-v4-flash-
  0731 (verify con tools), e deepseek-v4-flash **con onStream** (step
  HTML via SSE `/api/ai/chat/stream` o `api.deepseek.com`, resto via
  chat). Assert: sito generato (html/css/js), `verify:ok`, tools
  dichiarati nel verify pass 1.
- `src/__tests__/viteDevProxy.test.ts` (5, +1): regressione dev proxy
  che PROPAGA tools + tool_calls precompilati al body upstream (il 400
  di prima non deve tornare).
- Gate: typecheck + 533 test impattati verdi. La validazione LIVE
  (generazione reale sul sito dell'utente) resta da fare a mano dopo
  riavvio dev server — i mock coprono la serializzazione, non la rete.

### 26.20 Timeout Ollama + step best-effort (2026-08-05)

**Bug reale (log 18:40, dopo §26.19)**: `Ollama (502): Ollama error: This
operation was aborted` (359808ms ≈ 6 min) sullo step CSS — il dev proxy
`proxyOllamaChat` ha timeout `300_000ms` (5 min) e Ollama con thinking
'max' + output 16k tok per CSS lunghi (100-130s reali nei log precedenti,
ma con coda/concorrenza può sforare) → abort → 502 → **eccezione propagata
→ sito perso** (HTML generato buttato).

**Fix**:
1. **Timeout dev proxy 300s → 600s** (`vite.config.js`): 10 min per
   generazioni Ollama lunghe. In PROD `src/server/handler.ts:1340` il timeout
   Ollama è **60s** — per CSS da 100-130s fallirebbe SEMPRE: va alzato
   alla prossima deploy (TODO prod, gotcha §1 regola vercel).
2. **Step CSS/JS/pagine BEST-EFFORT**: un loro timeout/errore NON perde
   più il sito — try/catch → changes `error:css:<msg>` /
   `error:js:<msg>` / `error:page:<nome>:<msg>`, il campo resta vuoto
   (sito usabile senza CSS/JS, sezione mancante). Solo HTML e Verify
   restano critici: HTML fallito → fallbackResult, Verify fallito →
   best-effort (§26.18). Costo: `trackUsage` saltato se response null.
3. **`totalCost` null-safe**: `cssResponse`/`jsResponse` possono essere
   null → guardie.

**Regressione prod 2026-08-13 (stream 60s)**: il path **non-stream**
(`/api/ai/chat`) era già a 600s, ma lo **stream** (`/api/ai/chat/stream`,
usato da `useAIWebsite` e auto-build) era rimasto a **60s** in
`src/server/ai.ts` → abort a 60s → stream troncato → JSON incompleto →
`not_json: Unexpected end of JSON input` → **sito fallback placeholder
(237ch HTML, CSS 609ch)** da "Rigenera" in CRM. In dev funzionava perché
il proxy Vite ha 600s. Fix: timeout stream Ollama 60s → 600s
(`src/server/ai.ts`, allineato al path non-stream) + regression test
`ollamaStream.test.ts` (fake timers: a 60s lo stream DEVE essere vivo, a
600s abort). Vale per entrambi i branch (master e
migliorie-LayoutOggettiCardFlyerLogo).

**Test**: `websiteOrchestrator.test.ts` (24 — CSS/JS/pagina falliti →
sito generato con changes error, verify error doppio best-effort). Gate:
typecheck + suite impattata verde. ⚠️ Riavvio dev server obbligatorio
(modifica vite.config.js).

### 26.21 Matrice provider + ERR_INVALID_URL definitivo (2026-08-05)

**Timeout per-step (risposta alla domanda)**: il timeout è GIÀ per-request
— ogni step (html/css/js/page/verify/refine) è una fetch separata con il
suo AbortController, quindi "si resetta" naturalmente tra step. Il valore
era solo troppo basso: 300s (dev) / 60s (prod) con Ollama thinking 'max' +
16k tok → abort → 502 → sito perso. Ora 600s in entrambi (vite.config.js
+ src/server/handler.ts). In prod la durata massima Vercel Hobby per una funzione è
60s **solo per funzioni sincrone** — con streaming/flush il limite si
allunga; se dovesse restare il 502 in prod, il piano Hobby è il tetto
(vedi to-be-done: valutare pro/streaming serverless).

**Matrice test 3 provider (richiesta utente)** — `websiteOrchestrator.providers.test.ts`
(6 test): flusso END-TO-END `generateSite` con provider REALI (fetch
mockato) per **ollama-deepseek-v4-flash-0731**, **ollama-minimax-m3** e
**deepseek-v4-flash**:
1. Sito completo: HTML via SSE stream (body.stream=true → mock SSE;
   discrimine `body.stream`, NON l'URL — DeepSeek chat va sullo stesso
   `api.deepseek.com`), CSS/JS/Verify via chat JSON. Assert: html/css/js
   corretti, `verify:ok`, tools dichiarati nel verify (3 tool_calls con
   content STRINGA), streamed > 0.
2. Verify con issue: css rotto (parentesi non chiuse) → fix CSS applicato
   solo su css (`verifyFixesApplied = ['css']`), html integro preservato.
- `verifyBody.test.ts` (3): serializzazione body verify per i 3 provider.
- `viteDevProxy.test.ts` (5): dev proxy propaga tools upstream.
- `websiteOrchestrator.test.ts` (24): fallimenti step best-effort ecc.

**ERR_INVALID_URL — colpevole definitivo**: il log mostrava
`about:srcdoc:1227` = l'iframe **PREVIEW principale** (tab Preview), non
quello vision (già normalizzato). `fullDocument` (preview + "Nuova tab")
usava `buildWebsiteFullDocument` NON normalizzato → data URL con base64
wrapped (whitespace) rifiutato da Chrome in srcdoc. Fix: `fullDocument` e
`handleOpenInNewTab` passano da `normalizeInlineImages(..., 200_000)` —
strip whitespace SEMPRE (valido ovunque), sostituzione >200KB solo
nell'iframe vision (50KB) per il body proxy. Le foto gallery (~60KB)
restano visibili in preview. Test `imageNormalize.test.ts` (5).

### 26.22 Velocità + verify senza tools + ERR_INVALID_URL hardening (2026-08-05)

**Lentezza (16 min in locale — risposta a "8k per CSS/JS/verify")**:
- **NON ridurre maxTokens a 8192**: il JSON `{"css":"..."}` troncato = 400
  Ollama `format:json` o parse-fail → CSS/JS persi (il CSS reale misura
  27K token di OUTPUT). maxTokens limita l'output, non il contesto.
- **Causa reale = `reasoningEffort: 'max'` (think:max) su TUTTI gli step**:
  CSS 180s/27K tok, JS 91s/15K tok, Verify 194s/20K tok (2 pass su prompt
  da 50-60K token). Fix: **reasoningEffort per-step** —
  `max` solo per HTML/pages/refine (struttura del sito), `high` per
  CSS/JS/Verify (output lungo su prompt piccolo: 'high' basta, 'max' costa
  il doppio). Il selettore globale (badge) resta per l'utente.
- Timeout: già per-request (ogni step = fetch col suo AbortController).

**Verify 400 "can't find closing '}'" — causa DEFINITIVA** (doc ufficiali
webfetch: docs.ollama.com/capabilities/tool-calling e
api-docs.deepseek.com/guides/tool_calls):
- Ollama tool_calls in ingresso: `arguments` è un **OBJECT** (non stringa),
  messaggio tool usa **`tool_name`** (non `name`), niente `id`/`tool_call_id`.
- DeepSeek (OpenAI): `arguments` **stringa**, `id` obbligatorio,
  `tool_call_id` nel tool result.
- Il codice serializzava in formato DeepSeek per TUTTI → Ollama 400.
  **Fix: eliminati i tool_calls precompilati dal verify** — i risultati
  `analyze_site` sono passati come messaggio USER strutturato
  ("RISULTATI ANALISI DETERMINISTICA: analyze_site(\"html\"): {...}").
  Zero formato da validare, zero 400, niente retry (`verify:tools-retry`
  rimosso), niente follow-up tool-call. Il tool `analyze_site` resta in
  `TOOL_DEFINITIONS` per card/flyer (li il formato DeepSeek è corretto).

**ERR_INVALID_URL — hardening finale**:
- `normalizeInlineImages` copre ora: src con quote doppie/singole, **src
  senza quote** (l'AI lo genera), whitespace nel **prefisso**
  (`data:image/jpeg; base64,`), payload con apici interni; >maxChars →
  placeholder GIF 1px. Limite noto: base64 wrapped SENZA quote è
  irrecuperabile (l'HTML parser chiude l'attributo al primo spazio) — non
  accade coi data URL generati dal codice (sempre quotati).
- **Logo upload compresso a ≤140K** (`compressDataUrl(dataUri, 512,
  140_000)`): sotto la soglia preview 200K (mai sostituito dal
  placeholder) e lontano dal limite ~2MB dei data URL Chrome.
- **onclone html2canvas**: img >50K → placeholder GIF 1px (non più
  `display:none` che lasciava buchi nel layout).

**Test**: `websiteOrchestrator.test.ts` (23 — risultati analyze nel prompt
user, niente tools/tool_calls, fix solo su parte rotta, best-effort),
`websiteOrchestrator.providers.test.ts` (6 — matrice 3 provider: verify
SENZA tools dichiarati e con RISULTATI ANALISI nel prompt = garanzia
anti-400), `imageNormalize.test.ts` (9 — src no-quote, prefisso sporco,
apici singoli, placeholder), `verifyBody.test.ts` (3 — serializzazione
card/flyer invariata). Gate: typecheck + 541 test impattati verdi.

### 26.23 Verify — fix automatici di qualità + guardia anti-distruzione (2026-08-05)

**Bug segnalato dall'utente**: il verify segnalava 5 problemi reali
(iframe senza title, emoji nel CTA, aria-label mancante, id hero senza
classe, indirizzo duplicato) ma NON li risolveva in automatico — il
fix-guard §26.16 rifiutava i fixes perché il codice ORIGINALE era integro.

**Fix — guardia basata sul FIXATO, non sull'originale**:
1. Un fix viene ACCETTATO se: (a) il RISULTATO è deterministicamente
   integro (`analyzeSiteCode(fix).ok`) — i fixes di qualità/accessibilità
   (title iframe, aria-label, rimozione emoji) passano anche su codice
   valido; (b) il fixato non perde sezioni: lunghezza ≥60% dell'originale
   (una riscrittura che taglia mappa/contatti/form viene bloccata —
   regressione §26.16: `<h1>PERSA LA MAPPA</h1>` è HTML valido ma corto).
2. **Pass 2 applica i fixes ANCHE lui** (il primo fix può essere
   parziale) e il pannello finale mostra le **issue DETERMINISTICHE
   residue del recheck** (`recheck.flatMap(issues)`), non le inventate
   dal modello → il pannello mostra problemi reali e veri, mai più
   false-positive "troncato".
3. Soglia lunghezza 0.5 → 0.6 (il caso `// perso` = 8/16 = 50% passava).

**Test**: `websiteOrchestrator.test.ts` (23): fix di qualità ACCETTATO su
codice valido (con fixato integro+lungo), fix distruttivo RIFIUTATO (corto),
fix rotto rifiutato, recheck con issue deterministiche residue, matrice 3
provider. Gate: typecheck + suite verde.

### 26.24 Auto-build website in PROD — timeout 60s (2026-08-05)

**Bug (to-be-done #3, mai validato live)**: "Genera bozze AI" da CRM in
PROD falliva sul website (logo/card/flyer ok). Causa: Vercel Hobby limita
le richieste **sincrone** a 60s, quelle **streaming** a 300s. Gli step
CSS/JS/Verify/pagine usavano `provider.chat` (sincrono) → il CSS da
100-130s e il JS da ~90s venivano uccisi → step falliti. In locale nessun
limite → sembrava funzionare.

**Fix (tutti gli step website su SSE)**:
1. **`onStream` SEMPRE attivo nel websiteOrchestrator**: `handleStream`
   usa il path stream SOLO se `onStream` è passato. Ora `streamSink =
   options.onStream ?? (() => {})` passato a html/css/js/page/verify →
   in auto-build (dove `onStream` è undefined) gli step usano comunque
   SSE → limite 300s Hobby. Prima l'HTML cadeva su `chat` sincrono in
   auto-build (e CSS/JS/verify anche nell'editor!).
2. **`generateWebsiteDraft` salva `pagesHtml`** (mancava → pagine
   secondarie perse nell'auto-build) e costo da `result.aiCall?.costUsd`
   (non solo usage HTML).
3. **`streamSink` riusa il sink utente** se fornito (nessun doppio log).

**Test**: matrice 3 provider aggiornata — TUTTI gli step via SSE (i mock
servono SSE per ogni chiamata stream, non solo la prima). Gate: typecheck
+ 541 test verdi. Validazione live PROD ancora da fare (to-be-done #3:
riprovare "Genera bozze AI" con cliente reale).

**Test**: `siteAnalyser.test.ts` (12 — tag/parentesi/pseudo/alt/iframe/emoji/
stringhe JS), `seoMeta.test.ts` (9 — sanitize, ordine, coerenza og:desc),
`websiteOrchestrator.test.ts` (15 — tool precompilati, loop recheck
pulito/residuo, fixes, costo), `websiteSystem.test.ts` (12 — prompt verify
rules). Gate: typecheck + 524 test impattati verdi.

### 26.25 Langfuse — costi Gemini dev proxy + nomi trace + tipi multimodali (2026-08-12)

**Bug (to-be-done Langfuse follow-up, da CSV export)**: in locale Gemini
risultava gratis (`costDetails: {}`) e le trace immagini avevano nomi
vecchi (`generate-image-flash`) + `subfeature:chat` errato.

**Fix**:
1. **Costi Gemini nel dev proxy**: `vite.config.js` — `GEMINI_PER_IMAGE`
   (`gemini-3.1-flash-image` 0.04, `gemini-2.0-flash-preview-image-generation`
   0.02) + `geminiCost(model)` (round 6 decimali). I 5 endpoint Gemini
   (logo-background, card-cover, flyer-hero, card-photo, image-flash)
   passano `costUsd: geminiCost(...)` a `traceDev` — prima solo
   `body.costUsd` (mai inviato dal client → 0). Stessa tabella del server
   handler `ai.ts` (`computeCostUsd('gemini', model, undefined, 1)`).
2. **Nomi trace server allineati**: `src/server/ai.ts` — `flyer-hero`,
   `card-photo`, `image-flash` (era `generate-*`) + `subfeature` corretta
   (`hero`/`photo`/`icon|hero|flash` per kind) + `costUsd` Gemini. Ora
   server handler e dev proxy hanno nomi/subfeature/costi identici.
3. **Tipi multimodali**: `LangfuseMessage.content` = `string |
   LangfuseContentPart[]` (parti OpenAI-style `{type:'text'}` /
   `{type:'image_url', image_url:{url}}` — formato documentato Langfuse
   per generazioni text+image). `sanitizeInput` e `resolveMediaRefs`
   gestiscono le parti image_url: placeholder senza upload, token
   `@@@langfuseMedia@@@` con upload (mai base64 raw). **Attenzione**:
   `sanitizeInput` appende il placeholder `[immagine allegata]` SOLO ai
   messaggi con `images[]` non vuoto (prima lo appendeva anche ai
   messaggi senza → test PII rotti).

**Test**: +3 (dev proxy costUsd 0.04, parti image_url placeholder, parti
image_url → token media), fix 1 (sanitize PII). Gate: typecheck + 3011
test verdi.

### 26.26 Langfuse — media upload end-to-end + sessioni complete + latency reale (2026-08-12)

**Bug (to-be-done Langfuse follow-up, da CSV export)**: le trace immagini
mostravano ancora `[immagine allegata]` (placeholder), le sessioni
Langfuse restavano vuote anche per documenti con `sessionId=docId`, e tutte
le trace avevano `latencyMs=0`.

**Fix**:
1. **Media upload funzionante** (`src/server/langfuse.ts`):
   - `sha256Hash` = base64 del digest binario (44 char). Prima era hex
     (64 char) → 400 `invalid_format` dalla regex Langfuse.
   - PUT presigned con header `x-amz-checksum-sha256` (senza → 403 S3).
   - PATCH `/api/public/media/{mediaId}` con `{uploadedAt, uploadHttpStatus}`
     post-PUT (senza → GET 404 "Media upload failed" → placeholder).
   - `contentLength` = byte reali (`Buffer.from(b64,'base64').length`), non
     arrotondato.
   - `traceId` media = 32-hex W3C (formato atteso dalla UI), non base64
     OTLP.
2. **Sessioni complete**:
   - Server: `sessionId` aggiunto agli zod di `card-cover`, `card-photo`,
     `logo-background`, `flyer-hero`, `image-flash`, `design-review` e
     passato a `traceGeneration` (prima Zod lo strippava).
   - Client: `sessionId` aggiunto alle deps di `useCallback` in
     `useAICard`/`useAILogo`/`useAIFlyer`/`useAIWebsite` (closure stale su
     doc-switch); `useAISocial` ora passa `sessionId` all'orchestratore;
     `useAIIconHero` accetta `sessionId` e lo manda nel body (wiring
     `CardEditorShell` con `loadedIdRef.current`).
3. **Latency reale**: `buildLangfusePayload` usava `endTime ?? startTime`
   (i chiamanti passano solo `startTime` → 0ms). Ora default `endTime`
   = payload build time.
4. **Design-review allineato**: nome trace `design-review` (era
   `generate-design-review`) + subfeature `review` + sessionId.
5. **Dead code**: rimosso `buildTags` duplicato in `src/server/ai.ts`.

**Verifica end-to-end**: avviato `npm run dev`, chiamate reali a
`card-cover`/`image-flash`/`card-ai-chat` con `sessionId` — su Langfuse
cloud risultano raggruppate nella stessa sessione, output immagini con
token `@@@langfuseMedia@@@`, latenze 10,76s / 8,72s / 1,48s.

**Test**: aggiornati `langfuse.test.ts` (sha base64/PATCH/checksum/
contentLength/latency), `langfuseApi.test.ts` (sessionId card-cover),
`useAIIconHero.test.tsx` (sessionId body). Gate: typecheck + 3013 test
verdi.

### 26.27 Langfuse agenti — trace gerarchica agente→sub-agente + agente con harness (2026-08-12)

Effort wayfinder (mappa `docs/wayfinder/langfuse-agentic-map.md`, 10
ticket T1-T10, decisioni+risoluzioni nei singoli ticket).

**Decisioni research** (ticket T1/T2):
- **LangChain/LangGraph: DON'T ADOPT**. Nested span = solo
  `parentSpanId` OTLP (~5 LOC); il vero gap era il traceId (ogni chiamata
  un requestId → trace separate). LangGraph ~12MB / AI SDK ~7MB / OTel
  1-2MB contro §25; SDK v5 richiede `forceFlush()` pre-exit (peggio della
  fire-and-forget 2s). Provider layer custom → AI SDK = rewrite out of
  scope.
- **Next.js: DON'T MIGRATE** (~90-140h, SPA pura client-state, monolite
  §1 load-bearing, Langfuse non Next-gated).

**Trace gerarchica (T7)** — una trace per run, 3 livelli:
1. **Client** (`src/ai/runTrace.ts`): `newRunId()` (32-hex) +
   `newSpanId()` (16-hex). `useAutoBuildGenerate` genera runId/
   rootSpanId per run, stepSpanId per step, propaga via `RunTraceOptions`
   (in `types.ts`, esteso `ChatOptions`) → orchestratori (logo/card/
   flyer/website) → body `/api/ai/chat`.
2. **Server** (`ai.ts`): Zod `runId` (regex 32-hex), `runName`,
   `startRun` (boolean), `rootSpanId`/`stepSpanId` (regex 16-hex) su
   `/ai/chat` e `/ai/chat/stream`; destructure + passaggio ai 5
   `traceGeneration` chat; dev proxy `vite.config.js` propagato.
3. **Payload** (`langfuse.ts`): `parentSpanId` + campi run; traceId =
   runId (media upload inclusi, `ingestLangfuse` usa `input.runId ??
   toTraceHexId(requestId)`); emette root `agent:<runName>` (solo
   `startRun`) + step `agent:<runName>:<stepName>` + generation con
   parent link. **Backward-compat**: senza campi run = identico a prima.

**Website**: ogni chiamata interna (html/pages/css/js/verify) è un
sub-step con stepSpanId nuovo (`runTrace(step)` helper in
`websiteOrchestrator`, `startRun` solo sulla prima chiamata).

**Agente con harness (T9)** — `src/ai/agentOrchestrator.ts`:
- 4 tools `generate_logo/card/flyer/website` (filtro `include`),
  loop plan→act max 6 round su `BaseOrchestrator` (niente LangGraph);
  tool fail → `{ok:false, summary}` senza crash; `onToolResult` per
  salvataggio dal chiamante. **NON ancora collegato alla UI** (nessun
  componente lo usa) — wiring CRM = prossimo step.
- Trace: l'agente emette `stepName:'plan'` (root su round 0) + ogni
  tool usa `stepName = oggetto` + stepSpanId nuovo.

**⚠️ Bug PROD sbloccato — website mai generato con auto-generate**:
`websiteOrchestrator` manda `maxTokens: 16384` (7 call site) ma Zod
server aveva `max_tokens.max(8192)` → **400 validation su OGNI step
website in PROD** (il dev proxy Vite non valida il body → in locale
funzionava). Fix: max 16384 in entrambi gli schemi `/ai/chat` +
spec test. **Deployato con faacc42** — riprovare "Genera bozze AI"
in prod con cliente reale.

**⚠️ Trace finte su Langfuse da test unitari (T10)** — le trace con
`prompt:"p"` e `sizeKB: 0.0029` (3 byte, `image: PNG/JPEG`) erano
**trace dei test endpoint**: `resetApiTests` (helpers/apiTest.ts) non
azzerava `LANGFUSE_*`/`VITE_LANGFUSE_*` → `ingestLangfuse` fallback
VITE_* → env reali da .env locale → ogni test (flyerHero, imageFlash,
cardCover, ...) mandava OTLP reale con dati mock al cloud. Fix:
`resetApiTests` azzera le 6 env; regression test in `flyerHero.test.ts`
(nessuna chiamata `/otel/v1/traces` o `/media`). I test di ingest che
verificano OTLP impostano le proprie env DOPO resetApiTests (già così).

**Test**: +3 payload gerarchico (root+step+gen, no-root, backward-compat),
+4 Zod run fields, +4 Zod max_tokens 16384, +5 agente (tool exec,
runTrace propagation, tool fail, no-tool stop, include filter), +1
regression test no-cloud, +7 expected tags aggiornati con `status:ok`.
Gate: typecheck 0 + **3033 test verdi** + build zero-warning.


## 27. Design review tipografica card/logo/flyer (2026-08-06)

Criteri di riferimento raccolti in `docs/design-criteria.md` (fonti online:
min contatti card 7-9pt, safe area 4mm/5-10mm, gerarchia 3 livelli, body
flyer ≥10pt, headline ≥24pt, tagline ≥40% wordmark). Baseline screenshot:
`e2e/design-review.spec.ts` (env `DESIGN_REVIEW_OUT`, default
`e2e/__screenshots__/design-review/prima`).

### 27.1 Card — reference frame unificato 640×414

- Export era calibrato su frame 340px-alto (font ~22% più grandi della
  preview 640×414) e back su width-ref 512. Ora **una sola sorgente**:
  `CARD_REF = {w:640, h:414}` in `gridConstants.ts`; tutti i denominatori
  `/340` e `/512` derivano da lì. Mai reintrodurre costanti assolute.
- Contatti retro: val 12.8→19px logici, key 10.88→16 (minimo stampa ~7pt,
  criterio `design-criteria.md`). Floor shrink-to-fit ora **frazioni di
  CARD_REF.h** (era px assoluti → ~2pt a 300dpi).
- Front export: name/title/company con wrap (`wrapTextAtWhitespace`) +
  clip-path cella (prima overflow silenzioso su nomi lunghi). Gerarchia
  allargata 22/16/14. Preview grid-mode allineata in `cardBase.css`.
- `layoutAudit.ts` FONT_RATIO_KEY cap 0.045 (realign completo deferred).
- Residui noti: safe margin 16px<4mm, socials/services base sotto 7pt,
  fallback no-grid con sizing legacy, thumbnail Collection front-only.

### 27.2 Logo — tagline derivata dal wordmark fittato

- Tagline = `~0.42×` wordmark fittato + `fitText` proprio (era costante
  12/14 → ratio 37.5-38.9%, clipping tagline lunghe, inversione gerarchia
  con wordmark lungo al floor).
- `TEXT_AREA_EXTRA` era contato doppio (getViewBox + buildSvgForLayout) →
  tenuto solo in buildSvgForLayout; image area invariante su textPosition.
- Vertical/stacked: blocco icona+testo centrato (era ancorato top con
  ~100u di dead space; top margin ≥16).
- `buildTextBackdrop` sceglie il tono dalla **luminanza del colore testo
  risolto** (non dal mode) — fix dark-on-dark in `auto` senza bgImage.
- Export raster (PNG/JPG/ICO/favicon): `embedFontInSvg` (riusa
  `card/fontEmbed.ts`) — prima fallback sans-serif perché SVG in `<img>`
  non accede ai webfont. PDF via svg2pdf resta Helvetica (strutturale).
- Thumbnail Collection: `mergeLogoWithDefaults` prima di `builderToSvg`
  (doc parziali → SVG NaN → thumbnail vuota).

### 27.3 Flyer — floor tipografici stampa + export body

- `FONT_SIZE_BOUNDS` min alzati ai floor stampa TUTTI i formati
  (headline 24pt/sub 12/body 10/cta 10); A6 max alzati (28/14/11/11).
- `scaledFontBounds(size, fontScale)` in geometry.ts = unica sorgente:
  scala per fontScale e clampa ai floor (fontScale 0.7 non scende più a
  ~5pt). Usata da layoutEngine E budgets (budget coerente col layout).
- Export PDF/PNG: `buildFlyerSvg(flyer, {renderBodyAsText:true})` — il
  body in `foreignObject` spariva nel PDF (pdfmake non lo supporta) e in
  PNG su Safari.
- **Budget prompt vs hard limit**: `getFlyerCopyBudget` ora espone anche
  `bodyPromptMaxChars` (calcolato a `bounds.body.max` × 0.85, assorbe gap
  min/max + drift metrico Inter-vs-Arial). `flyerOrchestrator.generateCopy`
  passa QUELLO al prompt; `bodyMaxChars` resta l'hard limit UI. Prima il
  prompt diceva "max 1445" quando al font reale entravano ~1210 → body
  clippato a metà glifo senza ellipsis (clip CSS foreignObject, wrap CSS
  più largo delle metriche Arial stimate).

### 27.4 Auto-build AI — contrasto testo su immagini AI

- Logo: se `backgroundImage` AI presente e il concept non dichiara
  `textBackdrop`, il flow applica `textBackdrop:'pill'` di default
  (`useAutoBuildGenerate.generateLogoDraft`); backdrop esplicito del
  concept preservato. System prompt logo: `imagePrompt` deve prevedere
  una "text legibility zone" (centro più scuro/non affollato).
- Card: `cardSystem.ts` ha la sezione "GERARCHIA TIPOGRAFICA E
  LEGGIBILITÀ SU COVER" (nome>ruolo>azienda via placement.scale, testo su
  zone quiete, mai testo piccolo su zone busy). Single source = system
  prompt; il prompt hardcoded dell'auto-build non duplica regole.
- Driver validazione live: `scripts/design-review-ai-gen.mjs` (login
  admin → crea cliente → auto-build → Genera bozze AI → screenshot
  preview in `e2e/__screenshots__/design-review/ai/` + report.json con
  stato per-doc e classificazione immagini AI). Flag `--smoke` per login
  + seed senza chiamate AI.

### 27.5 Completamenti v2.19 (stessa sessione, sera)

- **Socials/services retro sotto floor**: base socials 12.16→16/414
  (preview CSS 0.62→1rem), services 13.6→16 (0.85→1rem), servicesLabel
  11.2→13.6 (0.7→0.85rem), services--long 0.7→0.85rem. layoutAudit cap
  FONT_RATIO_SOCIAL 0.04→0.045 (come KEY, realign completo pending).
- **Logo placeholder salvato come successo**: se il parse AI fallisce,
  `logoOrchestrator` ripiega su `fallbackConcept()` ("Brand") con
  `applied:true` e flag `logo:fallback_concepts` in `changes`. Il CRM
  salvava il placeholder come "done". Fix: `generateLogoDraft` lancia su
  quel flag → badge errore + retry. Regression test
  `useAutoBuildGenerate.test.ts` ("logo fallback placeholder → error").
