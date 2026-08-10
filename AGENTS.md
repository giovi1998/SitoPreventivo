# AGENTS.md – Quickbrand

Quickbrand (repo `sitopreventivo`): webapp React + Vercel serverless per
generare preventivi, QR code, business card, loghi, flyer, post social e
siti web — con assistenza AI (DeepSeek / Ollama Pro Cloud / Gemini) e CRM
admin. Frontend React 18 + Vite, backend monolitico `api/index.ts`,
database Neon Postgres via Drizzle ORM, export PDF/PNG/SVG tutto
client-side.

## Quick Commands

```bash
npm run dev          # Dev server: Vite (port 8000, proxy /api/ai/* incluso)
npm run build        # Production build → dist/
npm run test         # vitest run --coverage (identico a test:coverage)
npm run test:watch   # Watch mode
npm run test:e2e     # Playwright (33 spec)
npm run test:e2e:ci  # Playwright seriale (--workers=1)
npm run test:e2e:critical  # Gate E2E route critiche: node scripts/e2e-gate.mjs
npm run typecheck    # tsc --noEmit
npm run db:generate  # Generate Drizzle migration
npm run db:migrate   # Apply migrations to Neon
npm run check:api-imports   # Serverless import safety (gotcha §1)
npm run docs:sync-check     # Reminder docs non sincronizzati
```

## Output Style (adhd-caveman skill) — OBBLIGATORIO SEMPRE

**Regola hard**: ad ogni avvio sessione (anche dopo refresh), PRIMA di rispondere
a qualunque prompt utente, devi **invocare `skill("adhd-caveman")`** via tool.
Senza quella chiamata la skill non è attiva (opencode non auto-carica le skill
legate solo a descrizione). AGENTS.md elenca `adhd-caveman` in "Active Skills"
ma è informativo — l'azione obbligatoria è la `skill("adhd-caveman")`
all'inizio della sessione.

Compressione output + struttura ADHD via skill `adhd-caveman`
(`.agents/skills/adhd-caveman/SKILL.md`): fusione di caveman (stile terso,
~-65% token, livelli lite/full — **ultra rimosso**) e i-have-adhd (lead with
action, passi numerati, stato ripetuto, time estimates, cap liste a 5, wins
visibili). ADHD layer **sempre attivo** (non opt-in). La skill si **disattiva
automaticamente** (auto-clarity) su: warning sicurezza, conferme azioni
irreversibili, sequenze multi-step ambigue, richieste "explain", debug
spiral, utente che chiede chiarimento. Non forzare lo stile terso in quei
casi.

## Code Style (lean-code skill) — OBBLIGATORIO SEMPRE

**Regola hard**: PRIMA di scrivere o modificare codice in `src/`, `api/`,
`db/` (nuovo codice, refactor, bug fix, PR review, scelta dipendenze, test),
devi **invocare `skill("lean-code")`** via tool. Senza quella chiamata la
skill non è attiva (opencode non auto-carica le skill legate solo a
descrizione). AGENTS.md elenca `lean-code` in "Active Skills" ma è
informativo — l'azione obbligatoria è la `skill("lean-code")` PRIMA di
toccare codice.

Fusione lazy-YAGNI + Clean Code (`.agents/skills/lean-code/SKILL.md`): ladder
(esiste già? stdlib? nativo? deps installate? una riga? solo poi il minimo),
root-cause fix, no astrazioni non richieste, marker `lean-code:` per corner
cut con ceiling+upgrade path, naming intention-revealing, funzioni piccole
(<20 righe), no commenti inutili. Si **disattiva automaticamente** solo su:
warning sicurezza (validation/rate limit/auth = mai semplificare), conferme
azioni irreversibili. Non applicare stile lazy a codice non richiesto di
semplificare.

## Pre-push Checklist

Prima di consigliare un push, esegui e conferma tutto verde:

```bash
npm run typecheck
npm run test
```

Se uno dei due fallisce, **non** proporre il push. Risolvi prima.

## Architecture

- **Frontend**: React 18 + Vite + React Router v6
- **Backend**: single Vercel Serverless Function (`api/index.ts`), monolite
  intenzionale, tutte le route in un file (vedi "Vercel Routing" sotto)
- **Database**: Drizzle ORM → Neon Postgres (`db/schema.ts`, migrazioni in
  `drizzle/`)
- **Storage split**: `localhost` = localStorage, production = API + Postgres.
  Detection automatica via `IS_LOCAL` in `src/utils/dataService.js`
- **Auth**: bcrypt + localStorage (dev) / Drizzle + Neon (prod). Admin:
  `admin@gmail.com` validato contro `ADMIN_PASSWORD` env var, mai salvato a DB.
- **Observability**: server logs via `console.*` in `api/index.ts` (JSON in
  prod). Client logs via `src/utils/logger.ts` + `/api/logs` (Vercel logs).
  Zero servizi esterni.
- **AI**: default **MiniMax M3** (Ollama Pro Cloud, provider id
  `ollama-minimax-m3`, modello `minimax-m3:cloud`, multimodale/vision, flat
  rate) per tutti gli orchestratori via proxy `/api/ai/chat`; DeepSeek
  fallback/selezionabile; Gemini Nano Banana (immagini: logo background,
  card cover/photo/icon, flyer hero — default model `gemini-3.1-flash-image`
  in `src/ai/providers/gemini.ts`; `gemini-2.0-flash-preview-image-generation`
  per image-flash in `geminiFlashImage.ts`). Chiavi solo server-side.
  **Thinking mode sempre attivo** (`reasoning_effort`/`think` configurabile,
  default `'max'`, selettore Veloce/Profondo/Massimo nel badge provider,
  persistito in `pq_ui:v1` `aiReasoningEffort`), `temperature` rimosso
  ovunque. 7 provider registrati (3 DeepSeek pay-per-token,
  4 Ollama Pro flat $20/mo). Vedi `docs/agent-gotchas.md` §26.

## Key Files

| File | Role |
|------|------|
| `App.tsx` (root, non src/) | Thin re-export di `AppShell` + `AuthProvider`/`AuthContext` |
| `src/main.tsx` | React Router: `/login`, `/`, `/app/*`, `*` (404) |
| `src/components/AppShell.tsx` | Global state shell (quote, AI, toasts, exports, theme), `<Outlet/>` |
| `src/components/AdminRoute.tsx` | Guard `user.role === 'admin'` |
| `src/hooks/useRouteView.ts` | Bridge `pathname ↔ view`, prefix-match `:docId` |
| `src/hooks/useDocumentLoader.ts` | Hydration condivisa editor: `:docId` → fetch → context, redirect not-found |
| `api/index.ts` | Unica Vercel function, intera REST API (monolite intenzionale) |
| `src/utils/generatePDF.ts` | PDF preventivi (pdfmake, client-side) |
| `src/utils/cardGenerator.ts` | Card PDF/PNG/SVG + `buildCardSvg` |
| `src/utils/qrGenerator.ts` | QR SVG/PNG (`qrcode` lib) |
| `src/utils/logoGenerator.ts` | Facade → `logo/svgBuilder.ts` (SVG builder + sanitize, render `builder.backgroundImage`) + `logo/exporters.ts` (PNG/PDF/JPG/ICO/FaviconZIP) |
| `src/utils/card/svgRenderer.ts` | Facade → `card/frontSvg.ts` / `card/backSvg.ts` / `card/fontEmbed.ts` / `card/svgShared.ts` (`buildCardSvg` resta nella facade) |
| `src/utils/xml.ts` | `escapeXml` condiviso (input `unknown`, coerced) |
| `src/utils/flyer/` | Flyer engine: `layoutEngine`, `svgRenderer`, `textFit`, `geometry`, `budgets`, `templateCatalog/Factory`, `qrRenderer`, `pdf/pngExport` |
| `src/utils/website/` | Website builder utils: `imageInjection`, `imageNormalize`, `logoInjection`, `sanitizeGenerated`, `seoMeta`, `siteAnalyser` (+ `src/utils/websiteExport.ts` export ZIP condiviso editor+Collection) |
| `src/utils/ai/` | Helper AI condivisi: `captureElement`, `compressForAI`, `mapAiError`, `removeBackground`, `requestId` |
| `src/utils/quote/`, `src/utils/decorations/` | Preview immagine quote; pattern decorativi card |
| `src/utils/watermark.ts` | Tier-aware watermark (free vs unlocked) |
| `src/utils/aiStats.ts` | TB-026: per-document AI cost tracker (aiStats: totalCostUsd + calls breakdown) + `withAiCall`, `incrementAiStats`, `formatAiStatsCompact` |
| `src/components/DocumentAiStats.tsx` | TB-026: widget riusabile "🤖 3 icone · 2 elaborazioni · $0.08" per editor e Collection |
| `src/utils/documentSchemas.ts` | Facade sottile → `src/utils/schemas/` (split per tipo: `shared`, `qr`, `card` incl. cardGrid + grid preset, `logo`, `flyer`, `social`, `website`). Zod schemas + `createEmpty*` + `mergeWithDefaults` (+ opzionale `aiStats` per-document TB-026). API pubblica invariata |
| `src/utils/gridUtils.ts` | Grid collision helpers (BLOCK su sovrapposizione) |
| `db/schema.ts` | Drizzle schema (users, documents, user_settings, unlock_codes, **customers** TB-027, **intakes** TB-019) |
| `src/utils/dataService.js` | Facade → `dataService/` (core, auth, documents, settings, ai, crm, images — solo `.js`, vincolo CJS §23). Data layer: API o localStorage (+ customers/intakes/config TB-027/019) |
| `src/utils/intakeToDocument.ts` | TB-019: mapping brief intake → draft document data (logo/card/flyer/social), shape allineata a createEmpty*() |
| `src/components/crm/` | TB-027 CRM UI: `CustomerList`, `CustomerDetail`, `IntakeList` + sub-panel `CustomerAiLogPanel`/`CustomerResearchSection`/`CustomerWebDataPanel` + `crm.css` |
| `src/hooks/useCustomerLogger.ts` | Log AI CRM: stato + persistenza sessionStorage (estratto da CustomerDetail) |
| `src/ai/PaletteOrchestrator.ts` | TB-027 B5: 3 palette AI suggerite (DeepSeek JSON, paletteConceptsSchema) |
| `src/hooks/useAIPalette.ts` | TB-027 B5: hook palette generation |
| `src/utils/palettePreview.ts` | TB-027 B5: SVG swatch card preview palette (zero costo AI) |
| `src/hooks/useAutoBuildGenerate.ts` | TB-027c/g: sequenza "Genera bozze AI" logo→card→flyer (orchestratori + briefContext, providerId opzionale, cover/hero AI, compressione immagini pre-save, save per-doc, status per-doc) |
| `src/utils/docPreviewSvg.ts` | Preview SVG inline logo/card/flyer/quote (condiviso CollectionView + CustomerDetail) |
| `src/pages/app/CustomersPage.tsx` | TB-027 route `/app/customers` (admin guard) |
| `src/ai/BaseOrchestrator.ts` | Abstract condivisa (sanitize, parseJson, handleStream, trackUsage) |
| `src/ai/quoteOrchestrator.ts` | Orchestratore quote (ex `ai/index.ts`): `AIOrchestrator`, `needsTools`, tool registry quote |
| `src/ai/*Orchestrator.ts` | card / flyer / logo / social / onboarding / website |
| `src/ai/prompts/registry.ts` | promptRegistry: lookup centralizzato prompt di sistema (incl. website-system, palette) |
| `src/ai/providers/registry.ts` | Registry provider AI (default `ollama-minimax-m3`, fallback automatico) |
| `src/ai/providers/gemini.ts` | `GeminiImageProvider` (Nano Banana, SDK `@google/genai`) |
| `src/ai/cardMerge.ts` | Merge risposta AI → card (grid, style, photo-preserve) |
| `src/components/CardEditor.tsx` + `card/` | Editor card: shell, form/ (barrel), ai/ (rail), grid controls |
| `src/components/QREditor.tsx` | Generatore QR (7 tipi, stili, logo overlay) |
| `src/components/LogoEditor.tsx` + `LogoAiPanel.tsx` | Logo builder + AI namelix-like 3-step |
| `src/components/flyer/` | Flyer: `FlyerEditorShell` + pannelli AI/manuale/preview/export |
| `src/components/WebsiteEditor.tsx` + `WebsiteEditor.css` | Website Builder: brief form 14 campi, preview iframe con viewport toggle, code editor, upload logo, AIProviderBadge, export ZIP |
| `src/components/ai/AIConsole.tsx` | Rail AI unificata (collapse in `pq_ui:v1`, quickActions, `AILogPanel` + `AIProviderBadge`) |
| `src/components/ActionBar.tsx` | Cluster azioni Salva/Esporta/Nuovo (logo, QR) |
| `src/components/CollectionView.tsx` | Collection griglia documenti: tab, filtri, ricerca, preview SVG inline (logo/card/flyer/quote), export ZIP |
| `src/hooks/useAI*.ts` | Hook AI: useAI, useAICard, useAIFlyer, useAILogo, useAISocial, useAIOnboarding, useAIWebsite, useAIPalette, useAIDesignReview, useAIIconHero |
| `src/hooks/useCard{PromptLibrary,AiImages}.ts` | Hook estratti da CardEditorShell: prompt library (photo/icon/cover) e generazione immagini AI (cover/photo/icona, CON-IS-001) |
| `src/hooks/useCard{GridEditor,BackContent,AutoSave,Export}.ts` | Hook estratti da CardEditorShell: grid state+handlers, services/socials/decorations retro, save/auto-save 30s (+ `cardHasContent`, `defaultCardTitle`), export |
| `src/components/card/form/CardFormSections.tsx` | `formContent` estratto dalla shell: compone le sezioni `form/` via barrel |
| `src/components/logo/ConceptCard.tsx` | Card concept logo AI (preview+bg, badge "AI bg ✓", rigenera) estratta da LogoAiPanel |
| `src/utils/logo/logoAiPersistence.ts` | Persistenza chat logo AI: `storageKeyFor(docId)`, TTL 24h, quota fallback senza bgImages |
| `e2e/fixtures/` | Fixture e2e condivise: `testUser`/`adminUser`/`freeUser`/`unlockedUser`, `giovanniTemplate`, `sampleFlyer`, `sampleQuote` (usate da cardHarness + spec) |
| `api/__tests__/setup.ts` | `createMockDrizzleDb`: mock Drizzle standardizzato per test API |
| `src/test-setup.ts` | Setup vitest globale: cleanup RTL + reset localStorage/sessionStorage in `beforeEach` |
| `src/hooks/useMediaQuery.ts` | Breakpoint canonici `BP_SHELL=768`/`BP_WORKSPACE=1024` + hook mobile |
| `src/utils/uiPrefs.ts` | `pq_ui:v1` (sidebarCollapsed, aiConsoleExpanded per editor, `aiProviderDefault`, `aiVisionEnabled`, `aiAutoFallback`, `aiReasoningEffort`) |
| `vite.config.js` | Port 8000, SPA fallback, dev proxy `/api/ai/*` + `/api/logs`, `loadEnv()` esplicito, manualChunks vendor |
| `vercel.json` | Build: `db:migrate && build`; rewrites (ordine critico) |
| `docs/agent-gotchas.md` | **Dettaglio completo gotchas + roadmap fasi** (leggere prima di toccare i moduli) |

## App Routes

| Path | Component | Guard |
|------|-----------|-------|
| `/login` | `LoginPage` | — |
| `/` | `HomePage` | — |
| `/app` → `/app/editor` | `EditorPage` → `EditorView` | login |
| `/app/collection` | `CollectionPage` → `CollectionView` | login |
| `/app/customers`, `/app/customers/:customerId` | `CustomersPage` → `CustomerList`/`CustomerDetail` | `AdminRoute` |
| `/app/qr`, `/app/card`, `/app/logo`, `/app/flyer`, `/app/social` | Editor (lazy) | login |
| `/app/website`, `/app/website/:docId` | `WebsitePage` → `WebsiteEditor` | `AdminEditorRoute` |
| `.../:docId` | Stessi editor, caricano documento per ID | login |
| `/app/settings` | `SettingsRoute` → `SettingsPage` | login |
| `/app/admin` | `AdminPage` → `AdminDashboard` (lazy) | `AdminRoute` |
| `*` | `NotFoundPage` | — |

Tutte le `/app/*` sono servite dalla catch-all SPA in `vercel.json`.

## Business Card Module (regole chiave)

- AI = modulo dedicato (`cardOrchestrator`, no tools), stesso `/api/ai/chat`.
- **Master switch griglia**: `showGrid` è il controllo unico; `isGridMode =
  showGrid && hasGridElements(side)`. Attivare su lato senza grid lo
  inizializza dal layout (`deriveGridFromLayout`).
- Grid elements: `photo`, `name`, `title`, `company`, `logo`, `qr`,
  `contacts`, `socials` con `x,y,w,h` in `card.grid` / `card.backGrid`.
  Preset: `gridPresetLeft/Centered/Split/BackDefault` +
  `gridPresetRightBalanced/BackBalanced` (v2.16, layout `right-balanced`;
  template Giovanni derivato dai preset).
- `cardMerge.ts`: clamp collisioni graduali, NON sovrascrive
  `photoUrl`/`logoUrl` (base64 user-uploaded); su riposizionamento AI fa
  merge (non replace) e preserva `placement` esistente (CON-AI-001),
  accetta placement AI clampato ai limiti schema.
- **Icona AI slot policy (CON-IS-001)**: l'icona generata va sempre in
  `photoUrl` (sostituisce foto), `logoUrl` mai toccato.
- **Vision gating (CON-MM-002)**: screenshot preview solo se
  `getAiVisionEnabled() && providerSupportsVision(modelId)`; con provider
  text-only la cattura è saltata del tutto.
- **Placement universale (v2.16)**: nudge x/y + zoom `placement {x,y,scale}`
  per TUTTI gli elementi grid (era solo photo/qr). Slider
  `grid-placement-zoom`: label "Zoom" per photo/qr/logo, "Dimensione" per i
  testi (scale = fattore font-size locale). Export SVG applica placement
  anche ai testi fronte/retro; wrap testo export via
  `src/utils/card/textMeasure.ts` (canvas measureText, fallback 0.52).
- **Font scale globale LEGACY**: slider "Dimensione testo" rimosso da
  `CardStyleFields.tsx` (testid `card-font-scale` eliminato). `fontScale`
  resta nello schema (default 1, clamp 0.7–1.5) e in preview
  `--card-font-scale` / export `fs()` / AI merge per backward compat
  documenti esistenti. `SAFE_FONT_FAMILIES` per il selettore.
- **Reference frame unificato (v2.19, design review 2026-08-06)**: preview
  ed export condividono `CARD_REF 640×414` logici; gerarchia tipografica
  22/16/14, contatti retro ≥7pt stampa, floor shrink DPI-independent,
  front export con wrap+clip. Dettagli: `docs/agent-gotchas.md` §27.1 e
  `docs/design-criteria.md`.
- Export: PDF 10-up, PNG, SVG, JSON — tutto client-side (pdfmake + canvas).
- Preview/export non ancora perfettamente identici: mismatch residui
  (wrapping, font metrics) documentati in `docs/agent-gotchas.md` §6.
  **Fixato**: la preview mobile ora scala l'intera card mantenendo le
  proporzioni (auto-fit via ResizeObserver, 640px logici), non riduce più
  i font in modo diverso dal desktop. Fixare con un layout engine condiviso.

## QR Code Module

- 7 tipi (URL/text/email/phone/vCard/WiFi/SMS), stili square/rounded/dots,
  logo overlay ≤20% area. Export SVG/PNG. Auto-save come `qrCode`.
- Validazione: contrasto fg/bg, PII check (WiFi password mai loggata).

## Logo Builder Module

- Icone `lucide-react` allowlist 48 nomi, validazione lato generatore.
- 4 template settore × 3 layout; `getViewBox` dinamico + `fitText()`.
- AI v2.2: DeepSeek genera 3 concept in una chiamata (ognuno con
  `imagePrompt` Nano-Banana), 3 immagini Gemini in parallelo subito dopo
  (`Promise.allSettled`), badge "AI bg ✓" per concept.
- `textColorMode`, `textBackdrop`, `textOffsetX/Y`, `taglineOffsetX/Y`,
  `textScale` per leggibilità su foto AI. Con `backgroundImage` settato,
  icona e `decorativeElements` sono auto-soppressi (v2.3.1).
- **Tipografia (design review 2026-08-06, §27.2)**: tagline = 0.42× wordmark
  fittato; backdrop per luminanza testo; font embed in export raster.
- **Mai persistere immagini base64 solo in localStorage**: fonte primaria =
  stato sollevato al genitore (`aiStateRef` in `LogoEditor`), localStorage
  solo backup try/catch. Vedi `docs/agent-gotchas.md` §2.12.
- **Export multi-formato (TB-024, v2.5)**: 9 voci nel menu Esporta di
  `LogoEditor` ActionBar. `utils/logo/exporters.ts` esporta:
  `svgToPng` (512/1024/2048), `svgToPdf` (vettoriale via svg2pdf.js +
  jspdf, dimensioni pt = viewBox), `svgToJpg` (sfondo opaco, default
  bianco), `svgToIco` (PNG embedded 16/32/48, Vista+), `svgToFaviconZip`
  (PNG 16/32/64/180/512 + ICO + SVG + site.webmanifest + browserconfig),
  `optimizeSvg` (regex minimale, ~30-40% più piccolo, no SVGO runtime).
  PDF/JPG usano `applyWatermarkToCanvas` (tier-aware). ICO/Favicon
  richiamano `svgToPng` internamente. Test PDF skip in jsdom (getBBox
  mancante). Deps: `jspdf`, `svg2pdf.js` (import statico OK — bundled lato
  client, no Vercel boundary).

## Flyer Module

- Engine in `src/utils/flyer/`: layout deterministico (`layoutEngine` +
  `geometry` con metriche Arial calibrate), `textFit`, budget copy,
  template catalog/factory, render SVG + export PDF/PNG.
- Floor stampa tutti i formati (headline 24pt / body 10pt min), font-size
  unitless in SVG viewBox-mm (§7), `scaledFontBounds` (fontScale non aggira
  i minimi), body export via `renderBodyAsText` (design review 2026-08-06,
  §27.3).

## ⚠️ Gotchas critici (sintesi — dettaglio in `docs/agent-gotchas.md`)

Leggere la sezione pertinente di `docs/agent-gotchas.md` PRIMA di toccare
il modulo corrispondente. Sintesi delle regole che non si possono violare:

**Vercel monolith (§1)**: mai splittare `api/index.ts` (ogni `.ts` in `api/`
conta come funzione; `api/_lib/` è escluso dal bundle → `ERR_MODULE_NOT_FOUND`).
Mai rimuovere le rewrite `/api/(.*) → /api` prima della catch-all SPA
(senza → 405 su ogni POST `/api/*`). Mai importare da `../src/` in
`api/index.ts` (cross-boundary non risolto → `ERR_MODULE_NOT_FOUND` su
Vercel Lambda). OGNI chiamata DB deve avere `await` sulla catena query:
`await (await getDb()).select()...` (§1.2 — operator precedence).
Regression test: `src/__tests__/vercelConfig.test.ts`.

**Gemini/`@google/genai` (§2-3)**: mai import statico in `api/index.ts`
(ESM-only → `FUNCTION_INVOCATION_FAILED` su TUTTI gli endpoint); solo
`await import('@google/genai')` dentro l'handler. Mai `await import('../src/...')`
in prod Vercel (non risolto). `response_modalities` minuscolo. Risoluzione
per-endpoint: 1K card-cover/photo/image-flash (clamp 500KB), 2K
flyer-hero/logo-background (clamp 1.5MB, timeout 45s), JPEG q85 via
`image_output_options` snake_case + cast (non nel tipo SDK 2.10, §2.5).
Nano Banana 2 Lite solo 1K (`resolveGeminiImageSize`). Prompt neutri, no
metafore artistiche (filtro copyright/recitation). Path dev proxy = path
client char-per-char. `loadEnv()` esplicito in `vite.config.js`.

**localStorage + base64 (§2.12)**: nessun dato con immagini base64 deve
avere localStorage come unica persistenza → QuotaExceededError non gestito
= crash app. Stato sollevato al genitore + try/catch obbligatorio.

**Shape documenti locali (§23)**: in IS_LOCAL lo storage di
logo/card/flyer è **canonico FLAT** (dominio top level, mai chiave `data`).
`saveDocument` appiattisce envelope in ingresso e fa `delete toStore.data`;
`getCustomer` ritorna shim `{...d, data: d}` per il CRM (non romperlo);
`getDocuments` idrata come PROD. QR esclusi (usano `data` legittimamente).
Mai importare `src/utils/logger.ts` da `dataService.js` (test CJS
`require()` → risoluzione fallisce); log debug temporanei via `console.*`.

**Card export SVG (§4-6)**: contatti retro `dominant-baseline="alphabetic"`
(altri testi `text-before-edge`); `gridPlacement` swap assi per celle text
column; font-size rem-based (pxH proporzionali), grid padding/gap
allineati alla preview; `effectiveBackGridForRender` usato da preview ED
export.

**Flyer rendering (§7)**: `font-size` unitless (mm user unit) in SVG con
viewBox in mm — mai `pt`/`mm` (≈3.78× troppo grande); metriche Arial
calibrate in `geometry.ts`; `GLYPH_HEIGHT_FACTOR=1.15`;
`text-before-edge`; clip-path; budget copy al font minimo = hard limit.

**Dev proxy (§12)**: riavviare `npm run dev` dopo modifiche a
`vite.config.js`; cover "entrambi i lati" serializzata (mai parallela,
502); limiti `context` proxy = server (2000). Il proxy gestisce anche
`/api/logs` (mirror dev) e il fallback Ollama chat diretto (timeout 600s,
tools propagati — senza → 400 silenzioso e verify morto).

**Build zero-warning + npm 12 (§25)**: `npm run build` deve restare
pulito. Regole: moduli già statico-importati nel main → import statico,
MAI `await import()` inutile (registry/providerPricing/resolveProviderId/
captureElement); moduli grossi on-demand (pdfjs, tesseract) → tutto lazy
(`setupPdfWorker` è async, `pdfImporter` fa `await`). Eccezione
documentata: `crm.js` (§23 CJS) → 3 import dinamici silenziati via
`customLogger.warn` in `vite.config.js` (non toccare il filtro). Nuovi
vendor grossi → aggiungere a `manualChunks` (chunkSizeWarningLimit 2500).
npm 12 blocca install-scripts → `allowScripts` name-only in package.json
(mai pin `@versione`); nuove dipendenze con install-script → aggiungere e
committare. Mai cancellare `package-lock.json` (drizzle `^1.0.0-beta.22`
risolverebbe rc breaking).

## Phase Status (sintesi — tabella completa in `docs/agent-gotchas.md` §10)

Fasi 0-10 (Phase 7 polish done; Volantino/Phase 3 done), 12-15 completate.
Phase 11 (flyer refactor/Volantino) parziale: gap test matrix. TB-024 (logo
export multi-formato) ✅ 2026-07-27 (§14). TB-025 (Collection preview SVG
inline) ✅ 2026-07-27 (§15). TB-026 (cost tracker aiStats) ✅ 2026-07-27
(§16). TB-027 (CRM + auto-research + auto-build) + TB-019 (intake pipeline)
✅ 2026-07-28 (§17). TB-027c (briefContext wiring, "Genera bozze AI",
embedding) ✅ 2026-07-29 (§18). TB-027e (dev proxy Ollama M3, research,
flyer text-only, dataService SSR-safe) ✅ 2026-07-29 (§20). TB-027h
(storage locale FLAT logo/card/flyer) ✅ 2026-07-30 (§23). Website Builder
✅ 2026-08-05 (§26.12) + backlog (§26.13) + multi-pagina reale (§26.14) +
verify determinismo (§26.15) + fix-guard (§26.16) + tools/maxTokens
(§26.17). **Design review tipografica card/logo/flyer + qualità output AI**
✅ 2026-08-06 (§27, criteri in `docs/design-criteria.md`): reference frame
unificato `CARD_REF 640×414`, gerarchia 22/16/14, floor stampa flyer,
tagline logo 0.42× wordmark, textBackdrop 'pill' default su logo con
backgroundImage, logo placeholder mai salvato come successo. **AI image
quality** (risoluzione per-uso 1K/2K, JPEG q85, Nano Banana 2 Lite,
persistenza path-aware) ✅ 2026-08-06 — vedi §2.5.

Residui attivi: vedi kanban `docs/to-be-done.md` (immagini AI pixelate —
fix generazione+storage fatto, residua verifica Playwright; "Genera bozze
AI" in prod da validare live; follow-up qualità pagine secondarie website).

## TODO (prossimi task)

Kanban in due file: **[docs/to-be-done.md](docs/to-be-done.md)** (da fare,
backlog tecnico e business) e **[docs/done.md](docs/done.md)** (completati,
con date e riferimenti ai gotchas). Questo file resta focalizzato su
architettura e convenzioni.

**Regola kanban (OBBLIGATORIA)**: quando completi un task presente in
`docs/to-be-done.md`, rimuovilo da lì e aggiungilo a `docs/done.md` con
data di completamento (stessa sessione, stesso commit). Mai lasciare
task completati spuntati in to-be-done.

**Regola spec (OBBLIGATORIA)**: ogni spec in `docs/spec/` segue questo ciclo:
1. **Implementazione = UN unico commit dedicato** (niente altre feature/fix
   nello stesso commit; il messaggio cita la spec).
2. **Ultimo step = cancellare il file spec** da `docs/spec/` e aggiungere la
   nota di completamento in `docs/done.md` (stesso commit della cancellazione).
3. Mai lasciare spec "attive" a implementazione completata. Il pre-push
   (`scripts/spec-sync-check.mjs`, reminder non bloccante) segnala le spec
   ancora presenti in `docs/spec/` quando pushi codice.

Spec attive in `docs/spec/` (2026-08-06): `spec-api-saas-monetization.md`,
`spec-design-flyer-refactor-preview-ai.md` (flyer refactor TB-007).

**Struttura docs**: documenti in `docs/` (inclusi `AI_ARCHITECTURE.md`,
`to-be-done.md`, `done.md`, `design-criteria.md` — criteri tipografici
card/logo/flyer con fonti, riferimento design review §27 gotchas), spec
attivi in `docs/spec/`. Root solo: `AGENTS.md`, `README.md`, `DESIGN.md`,
`REQUIREMENTS.md`.

## Responsive Patterns

- Conditional render, NOT CSS hide (3-col desktop non nel DOM su mobile).
- `useMediaQuery` + `BP_SHELL`/`BP_WORKSPACE`: codice nuovo DEVE usarli.
- **Breakpoint canonici (migrazione completata 2026-07-31)**: solo
  `max-width:767px` / `max-width:1023px` nei CSS; eccezioni documentate
  `@1180` (topbar) e `@480` (small-phone). Mai reintrodurre 900/1100/1400
  ecc. Dettagli: `docs/agent-gotchas.md` §24.
- Shell switch a 1023: sidebar/topbar nascoste, mobile-topbar + drawer
  (`Layout.tsx` conditional render via `useIsMobileWorkspace()`).
- Card mobile: tab system (Anteprima/Modifica/AI), FAB AI, bottom sheet,
  `MobileGridEditor` (frecce, non drag-and-drop), zoom 50-150%.
- iOS auto-zoom prevention: `font-size: 16px` su input mobile.

## Environment Variables

`.env.example` ha tutte le var. Richieste:

| Var | Where | Purpose |
|-----|-------|--------|
| `DATABASE_URL` | Vercel | Neon Postgres |
| `DEEPSEEK_API_KEY` | Vercel + .env | AI chat (server-side only) |
| `GEMINI_API_KEY` | Vercel + .env | Image gen (logo bg, card cover/icon). In locale anche `VITE_GEMINI_API_KEY` |
| `ADMIN_PASSWORD` | Vercel | Admin login |
| `VITE_ADMIN_PASSWORD` | .env (local) | Admin login in dev |
| `ALLOWED_ORIGIN` | Vercel | CORS origin (default `*.vercel.app`) |
| `OLLAMA_API_KEY` | Vercel + .env | Ollama Pro Cloud (senza → 503 solo su quel provider) |
| `REPLICATE_API_TOKEN` | opzionale, deprecato | Fallback logo AI |
| `REGISTRATION_ENABLED` | Vercel | TB-027: flag signup. Default `false` (CRM admin-only). `true` riattiva whitelabel. In dev anche `VITE_REGISTRATION_ENABLED` |
| `FIRECRAWL_API_KEY` | opzionale | TB-027: scraping sito cliente per research + RAG. Senza key, status `web: no_key`. Endpoint v2. Formati: markdown, screenshot, branding, images, json (oggetto con schema), links. Timeout 120s. `webData` persiste markdownFull/screenshot/links/json/branding/images |

**Mai esporre `DEEPSEEK_API_KEY`/`GEMINI_API_KEY`/`OLLAMA_API_KEY`/
`FIRECRAWL_API_KEY` al browser.** Il frontend chiama solo il proxy serverless.

## PDF Generation, Client-Side Only

PDF/PNG generati interamente nel browser (pdfmake + jspdf/svg2pdf.js +
canvas). Nessun upload server. Free-tier friendly.

## API Schema Duplication

`api/index.ts` inlines lo schema Drizzle per compatibilità Vercel. Se
modifichi `db/schema.ts`, aggiorna anche le tabelle corrispondenti in
`api/index.ts` (linee 9-52).

## Vercel Routing, CRITICAL

`api/index.ts` è l'**unica** serverless function. Monolite intenzionale —
4 tentativi di split hanno rotto la produzione (cause in
`docs/agent-gotchas.md` §1). Non aggiungere `.ts` in `api/`, non usare
`api/_*`, non usare `includeFiles`, non aggiungere rewrite per-route.
Condividi codice via `src/` (bundled correttamente per import statici).
Rewrite in `vercel.json` (ordine critico): `/api/(.*) → /api` prima, poi
catch-all `/(.*) → /index.html`. Build command: `npm run db:migrate && npm
run build`.

## Streaming AI

- Streaming per tutte le risposte AI (testo + tool) via SSE
  (`/api/ai/chat/stream`). Dopo tool execution, seconda chiamata multi-turn
  per la sintesi finale; usage accumulato.
- Log "a blocchi": update entry stream ogni ≥80 caratteri (delta char,
  non temporale).

## Test, OBBLIGATORI

**Ogni modifica a `src/`, `api/`, `db/` DEVE avere test.**

1. Nuovo codice → nuovi test (happy path + 1 errore).
2. Codice modificato → test aggiornati. Nessun "test morto".
3. Bug fix → regression test che riproduce PRIMA del fix.
4. Refactor → test invariati ma verdi (se rompono, il refactor è sbagliato).
5. Coverage minima nuovi file: 60% (thresholds lines/functions in
   `vitest.config.ts`; sotto soglia va motivata con commento).
6. Mai `.skip`/`xit` per far passare CI. Se flaky, fixalo.
7. Prima di proporre push: `npm run typecheck && npm run test` verdi.

Posizione test: componenti → `src/components/__tests__/`, hook →
`src/hooks/__tests__/`, utils → `src/utils/__tests__/`, API →
`api/__tests__/` (mock DB). Framework: Vitest + RTL + jsdom (~169 file di
test). Test singolo: `npx vitest run path/to/file.test.ts`.
E2E: Playwright, 33 spec in `e2e/` (`npm run test:e2e`, `:ci` seriale).

**E2E AI logs (TB-023):** quando tocchi hook AI (`useAI*`) o `AILogPanel`,
mantieni `e2e/ai-log-preview.spec.ts` verde: verifica che le preview nei log
flyer/logo/quote non siano nere/CSS e che il brief testuale sia presente.

## Admin User

- Email: `admin@gmail.com`, mai in DB, password vs `ADMIN_PASSWORD`
  (constant-time compare). Token illimitati.
- Endpoint admin (`GET /users`, `GET /quotes/all`, `PATCH /users/limits`,
  `GET /users/cost-breakdown`, `GET/POST/PATCH /customers*`,
  `POST /customers/:id/research|ai-fill|auto-build`, `GET /intakes`,
  `PATCH /intakes/:id`) richiedono `adminEmail=admin@gmail.com`:
  **query string per GET, body per PATCH/POST** (non mischiare — regression
  test `api/__tests__/users.test.ts`).

## Auth & API Security

- Rate limiting in-memory (enforced via `consumeRateLimit`): login 5/15min,
  aichat 30/min, flyerCopy 10/min, onboarding 5/min, Gemini image 5-10/min.
- `bodyParser` limit 1MB. CORS prod: solo `ALLOWED_ORIGIN`/`*.vercel.app`.
- Zod su ogni body/query. Output JSON uniforme `{ data }` / `{ error }`.
- OWASP: dettaglio in `docs/agent-gotchas.md` §13 (A04/A06 🟡 TODO).

## localStorage Schema

Chiavi **versionate** `nome:vN`; cambio schema → `v(N+1)` + fallback lettura
`vN`. Chiavi attuali:

- `precisionQuote_documents:v1` — documenti unificati (preventivi, QR, card, logo). Logo/card/flyer: shape canonica FLAT in locale (dominio top level, no `data`; vedi gotcha §23)
- `precisionQuote_quotes` — legacy deprecata; `pq_migration_v1_done_<email>` flag
- `userSettings_<email>` — include `tier`, `documentCount`, `unlockCode`, `preferredDocumentType`
- `unlock_codes`, `registeredUsers`, `deepseekApiKey` — dev only
- `authToken`, `userEmail`, `username`, `userRole`, `dataRegistrazione` — sessione
- `pq_ai_logs:v1` — ring buffer AI log in **sessionStorage**, max 100, mai base64
- `pq_ui:v1` — preferenze UI (`uiPrefs.ts`: sidebarCollapsed, aiConsoleExpanded, aiProviderDefault, aiImageModelDefault, aiVisionEnabled, aiAutoFallback, **aiReasoningEffort**)
- `logoAiChat:v1` / `logoAiChat:v1:<docId>` — backup best-effort chat logo AI (TTL 24h, try/catch, senza bgImages se quota). Chiave per-documento; globale legacy solo fallback lettura
- `cardIconPromptLibrary:v1`, `logoPromptLibrary:v1` — librerie prompt
- `pq_customers:v1` — TB-027 CRM clienti (dev/local cache, PROD via API)
- `pq_intakes:v1` — TB-019 brief intake (dev/local cache, PROD via API)
- `pq_customer_knowledge:v1` — TB-027 research chunks dev cache (`{ [customerId]: [{chunk, source, createdAt}] }`, PROD via API)

## Git Guardrails

**MAI eseguire senza conferma esplicita dell'utente**: `git push` (tutte le
varianti), `push --force`, `reset --hard`, `clean -f/-fd`, `branch -D`,
`checkout .` / `restore .`, `stash drop`, `tag -d`. Sempre `git status`
prima di operazioni git. Dettagli: `.agents/guardrails/git-guardrails.md`.

Regole push/deploy:
1. Mai pushare senza richiesta esplicita ("analyze"/"fix" ≠ push).
2. Mai cambiare `vercel.json` rewrites senza testare `/api` routes dopo.
3. Prima di push di feature con env var Vercel, confermare che siano
   settate nella dashboard (mancanti → 503/500 in prod).

## Git Hooks (husky + lint-staged)

Hook installati via `husky` 9 (`.husky/`), attivi dopo `npm install`
(`prepare: husky`). Script di supporto in `scripts/`.

| Hook | Quando | Cosa fa | Durata |
|------|--------|---------|--------|
| `pre-commit` | `git commit` | `scripts/check-api-imports.mjs` (serverless import safety, gotcha §1) + `lint-staged` (vitest related su file staged + check api/ su `api/**/*.ts`) | <30s |
| `pre-push` | `git push` | `npm run typecheck` + `npm run test` + `npm run build` (full gate, intercetta ERR_MODULE_NOT_FOUND pre-Vercel) + `scripts/spec-sync-check.mjs` (reminder non bloccante: ultimo step spec = cancellarla + nota done.md) | ~1-3min |
| `post-commit` | dopo `git commit` | `scripts/docs-sync-check.mjs HEAD~1..HEAD` — reminder non bloccante se `src/`/`api/`/`db/` cambiati ma `docs/` (incl. `docs/spec/`)/`README.md`/`AGENTS.md` no | <1s |

E2E gate (manuale, non in pre-push perché lento ~5-10min):

```bash
npm run test:e2e:critical   # node scripts/e2e-gate.mjs
```

Gira Playwright sulle route critiche (routing, card export roundtrip,
flyer hero entrypoint, ai-log-preview). Usa prima di merge su `main`.

Comandi manuali:

```bash
npm run check:api-imports   # solo check import api/
npm run docs:sync-check     # solo reminder docs (HEAD~1..HEAD)
node scripts/docs-sync-check.mjs <range>   # range custom (es. main..HEAD)
node scripts/spec-sync-check.mjs <range>   # reminder spec (default @{u}..HEAD)
```

Bypass locale (emergenza, NON in CI): `git commit --no-verify` /
`git push --no-verify`. Mai usare per aggirare test rossi — fixa prima.

## Active Skills

Skill auto-caricate — quando tocchi il codice riferito, **leggi prima la
skill** (`.agents/skills/<name>/SKILL.md`):

- `vercel-react-best-practices` — performance React (sempre)
- `vercel-composition-patterns` — component design
- `web-design-guidelines` — review UI/accessibilità
- `writing-guidelines` — docs/prose style
- `adhd-caveman` — compressione output + struttura ADHD (sempre, vedi
  "Output Style" sopra per regola hard di invocazione
  `skill("adhd-caveman")` ad ogni sessione)
- `ai-prompt-engineering` — quando tocchi `src/ai/prompts/*` o `*Orchestrator.ts`
- `vercel-serverless-monolith` — quando tocchi `api/index.ts` o `api/`
- `pdf-client-side` — quando tocchi `*Generator.ts` o `watermark.ts`
- `web-security` — quando tocchi auth/rate-limit/CORS/Zod-validation in
  `api/index.ts` o `api/` (gotcha §13 OWASP A04/A06 🟡 TODO). Invoca
  `skill("web-security")` PRIMA di modificare `handleAuth`,
  `consumeRateLimit`, `bodyParser`, header CORS, o qualsiasi schema Zod
  su body/query dell'API.
- `test-driven-development` — quando crei nuovo file in `src/`/`api/`/`db/`
  o fixi un bug (vedi "Test, OBBLIGATORI" sopra: nuovo codice → nuovi test,
  bug fix → regression test). Invoca `skill("test-driven-development")`
  PRIMA di scrivere l'implementazione, non dopo.
- `lean-code` — quando scrivi/modifichi codice in `src/`/`api/`/`db/`
  (nuovo codice, refactor, PR review). Fusione lazy-YAGNI (ladder:
  esiste già? stdlib? nativo? deps già installate? una riga? solo poi il
  minimo) + Uncle Bob: naming intention-revealing, funzioni piccole (<20
  righe, una sola cosa), no commenti inutili (spiega in codice), law of
  Demeter, error handling via exceptions non return codes, F.I.R.S.T.
  test. Invoca `skill("lean-code")` PRIMA di scrivere codice nuovo o
  refactor (sempre, vedi "Code Style (lean-code skill)" sopra per
  regola hard di invocazione `skill("lean-code")` ad ogni sessione).

On-demand (solo se il task lo richiede): `deploy-to-vercel`,
`vercel-cli-with-tokens`, `vercel-optimize`, `gpt-taste` /
`design-taste-frontend` / `high-end-visual-design` (design UI premium),
`muapi-nano-banana` (prompt `imagePrompt` AI), `imagegen-frontend-*`,
`redesign-existing-projects`, `brandkit`, `image-to-code`,
`playwright-cli` (debug E2E), `full-output-enforcement` (output lungo),
`create-specification` (nuove spec in `docs/spec/`), `frontend-design`,
`minimalist-ui`, `industrial-brutalist-ui`, `stitch-design-taste`,
`firecrawl` (scraping research clienti), ecc.

Le skill sono **solo per l'agente di coding**, non per l'app: l'app usa
DeepSeek/Gemini/Ollama via proxy server-side.
