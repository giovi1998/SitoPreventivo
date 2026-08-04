# Agent Gotchas (dettaglio completo)

Dettaglio completo delle regole/gotchas riassunte in `AGENTS.md`.
Contenuto spostato qui per mantenere AGENTS.md sotto i 32 KB.
Leggere la sezione pertinente prima di toccare il modulo corrispondente.

---

## 1. Vercel function bundling — lessons learned

Quattro commit tentarono di refactorare la struttura API; tutti e quattro
ruppero la produzione, ognuno per una causa diversa.

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

**Conclusione**: su piano Hobby, un singolo monolite è l'unica opzione
sicura. Tenere SEMPRE in `vercel.json`, in quest'ordine (prima matcha
prima):

```json
{ "rewrites": [
  { "source": "/api/(.*)", "destination": "/api" },
  { "source": "/(.*)", "destination": "/index.html" }
] }
```

Regression test: `src/__tests__/vercelConfig.test.ts` (presenza + ordine).

### 1.1 Import cross-boundary `api/` → `src/`

Import statici da `api/index.ts` verso `../src/...` non risolvono su
Vercel Lambda: il bundler traccia `api/` come entry point separato e
`src/` resta fuori dal bundle. Sintomo: `ERR_MODULE_NOT_FOUND: Cannot
find module '/var/task/src/ai/...'`. Fix: inlinare le costanti/funzioni
necessarie direttamente in `api/index.ts` (es. `OLLAMA_PRO_FLAT_MONTHLY`).
Non importare MAI da `../src/` in `api/index.ts` in produzione.

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

**Regola**: OGNI chiamata DB in `api/index.ts` deve avere `await` prima
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
   (`LogoAiPanel.tsx`) e `api/index.ts` usano `/api/ai/logo-config` +
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
5. **Dimensione immagine non enforced di default**: senza
   `generation_config.image_config.image_size`, Gemini produce a `1K`
   (~400KB-2MB) e il clamp server (500KB, `api/index.ts`
   `/ai/logo-background`) scarta ~2/3 delle immagini con 413. Fix: chiedere
   `image_size: '512'` (+ `aspect_ratio: '16:9'`) in richiesta. Valori:
   `'512' | '1K' | '2K' | '4K'`.
6. **`await import('../src/...')` non risolto in prod Vercel**. L'import
   dinamico di un modulo sotto `src/` da `api/index.ts` fallisce in
   produzione (`Cannot find module '/var/task/src/...'`) anche se gli
   import **statici** da `src/` funzionano. Sintomo: 404
   `{"error":"Endpoint AI non trovato"}` o 502. Fix:
   `await import('@google/genai')` diretto (node_modules sempre bundled) e
   logica provider inlinata.
7. **Import statico di `@google/genai` crasha l'intera funzione**. Il
   pacchetto v2.10.0 è ESM-only; l'import statico in cima a `api/index.ts`
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
    `context: z.string().max(N)` in `api/index.ts` e `MAX_CONTEXT_LEN` in
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
   retrocompatibile). Mirror in `api/index.ts` (`customersTable`,
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
  6. **Auto-research best-effort**: Ponytail — Firecrawl fallisce → status
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
   `api/index.ts` (`intakesTable`).
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
  non `z.record(z.unknown())` (TS error in api/index.ts mirror).
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
  api/index.ts — boundary Vercel, annotato). Chunks →
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
- **API (`api/index.ts`)**: `fetchFirecrawlPage` ritorna `FirecrawlResult`
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
  viene ignorato dall'API. Implementato via `ChatMessage.reasoningContent`
- **Streaming**: chunk include `delta.reasoning_content` → propagato come
  `AIStreamChunk.reasoningContent`

### Ollama (API `ollama.com/api/chat`)

- Body include: `think: 'max'` (sostituisce `options.temperature`)
- `think` accetta booleano o stringa (`low`/`medium`/`high`/`max`).
  `max` = massimo sforzo di ragionamento
- `message.thinking` nel response: contiene la traccia di ragionamento
- **Streaming**: chunk include `message.thinking` → propagato come
  `AIStreamChunk.reasoningContent`
- **Structured outputs**: `format` field funziona con thinking abilitato
- **Tool calling**: thinking + tools funzionano insieme; `reasoningContent`
  va ripassato come `thinking` nel messaggio assistant

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
   Default `'max'` in `BaseAIProvider.buildRequestBody`.
3. **`reasoningContent`** in `ChatMessage` va popolato quando si ripassano
   messaggi assistant con tool calls (DeepSeek richiede `reasoning_content`
   nel messaggio). Per Ollama, il field si chiama `thinking` nel body API
   ma è mappato a `reasoningContent` internamente.
4. **Streaming**: entrambi i provider emettono `reasoningContent` nei chunk.
   Il consumer può ignorarlo (non serve per il rendering finale) ma deve
   accumularlo se deve ripassare il messaggio in multi-turn con tool calls.
5. **`ollama-deepseek-v4-flash`** è un Ollama Pro provider che usa il model
   `deepseek-v4-flash:cloud` (DeepSeek V4 Flash via Ollama Cloud, flat rate).
   Non va confuso con `deepseek-v4-flash` (DeepSeekProvider, pay-per-token).
6. **`ollama-deepseek-v4-flash-0731`** usa il tag mensile Ollama Pro Cloud
   `deepseek-v4-flash:0731-cloud` (snapshot build del mese). Stesso flat rate.
   Tag nuovi vanno registrati in `registry.ts` + `providerPricing.ts` +
   `providerModelShort` (UI label).
