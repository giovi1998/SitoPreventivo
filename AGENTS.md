# AGENTS.md, PrecisionQuote

## Quick Commands

```bash
npm run dev          # Dev server: Vite
npm run build        # Production build → dist/
npm run test         # Run tests (vitest)
npm run test:watch   # Watch mode
npm run typecheck    # tsc --noEmit
npm run db:generate  # Generate Drizzle migration
npm run db:migrate   # Apply migrations to Neon
```

## Output Style (caveman skill)

Compressione output attiva via skill `caveman` in `.agents/skills/caveman/SKILL.md`
(auto-load). Stile terso, ~-65% token risposta. Setup una tantum:

```bash
npx skills add https://github.com/juliusbrussee/caveman --skill caveman
```

### Auto-Clarity

La skill si **disattiva automaticamente** in questi casi (vedi `Auto-Clarity` in SKILL.md):
- warning di sicurezza
- conferme di azioni irreversibili
- sequenze multi-step dove l'ordine dei frammenti può generare ambiguità
- utente chiede chiarimento o ripete la domanda

Quindi: se una risposta è più verbosa del solito, è un caso coperto da auto-clarity. Non cercare di "forzare" lo stile terso in quei casi, la skill sa quando tacere.

### Pre-push Checklist

Prima di consigliare un push, esegui e conferma tutto verde:

```bash
npm run typecheck
npm run test
```

Se uno dei due fallisce, **non** proporre il push. Risolvi prima.

## Architecture

- **Frontend**: React 18 + Vite + React Router v6
- **Backend**: Single Vercel Serverless Function (`api/index.ts`), monolithic, all routes in one file (intentional pattern, see Vercel routing below)
- **Database**: Drizzle ORM → Neon Postgres
- **Storage split**: `localhost` = localStorage, production = API + Postgres. Detection is automatic via `IS_LOCAL` in `src/utils/dataService.js`
- **Auth**: bcrypt + localStorage (dev) / Drizzle + Neon (prod). Admin: `admin@gmail.com` validated against `ADMIN_PASSWORD` env var, never saved to DB.
- **Observability**: Server logs via `console.*` in `api/index.ts` (JSON in prod tramite wrapper). Client logs via `src/utils/logger.ts` + `/api/logs` endpoint (Vercel logs). Zero external services.

## Key Files

| File | Role |
|------|------|
| `App.tsx` (root, not src/) | Thin re-export of `AppShell` (default) + `AuthProvider`/`AuthContext` (named) |
| `src/main.tsx` | React Router setup: `/login`, `/` (HomePage), `/app/*` (8 child routes), `*` (404) |
| `src/components/AppShell.tsx` | Global state shell (quote, AI, toasts, exports, theme), renders `<Outlet/>` |
| `src/components/AdminRoute.tsx` | Guard: `user.role === 'admin'` required, else `navigate('/app/editor')` |
| `src/hooks/useRouteView.ts` | Bridge hook: `pathname ↔ view` (editor\|collection\|qr\|card\|logo\|flyer\|social\|settings\|admin), `setView` calls `navigate()` |
| `src/pages/app/*` | Thin page wrappers (Editor/Collection/Qr/Card/Logo/Settings/Admin), read state from `AppContext` |
| `docs/logo-ai.md` | **Phase 7**: private docs explaining the disabled "AI Generation" tab (la versione pubblica `LogoAiDocsPage.tsx` + route `/docs/logo-ai` sono state rimosse deliberatamente). |
| `api/index.ts` | Single Vercel serverless function, entire REST API (monolith, intentional) |
| `db/schema.ts` | Drizzle schema (users, documents, user_settings, unlock_codes) |
| `src/utils/dataService.js` | Data layer, routes to API or localStorage |
| `src/utils/logger.ts` | Client-side logger (sendBeacon → /api/logs) |
| `src/utils/generatePDF.ts` | PDF generation with pdfmake (preventivi) |
| `src/utils/cardGenerator.ts` | Card PDF/PNG/SVG export + `buildCardSvg` |
| `src/utils/qrGenerator.ts` | QR Code SVG/PNG generation (`qrcode` lib) |
| `src/utils/logoGenerator.ts` | **Phase 4 / v2.1**: SVG builder + sanitize + export PNG + render `builder.backgroundImage` (Nano Banana) come `<image>` dietro al testo |
| `src/components/LogoAiPanel.tsx` | **Phase v2.1**: UX namelix-like per Logo AI (3-step chat: attività → mood → target → genera). Parametri via DeepSeek + background via Gemini Nano Banana. |
| `src/utils/flyerGenerator.ts` | **Phase 3**: Flyer PDF/PNG export (4 layout × 5 formati, bleed 3mm, tier-aware watermark) |
| `src/utils/watermark.ts` | **Phase 5**: tier-aware watermark (free vs unlocked) for PDF/PNG/SVG export |
| `src/utils/documentSchemas.ts` | Zod schema: quote, QR, businessCard, cardGrid, logo, **flyer (Phase 3)**, presets |
| `src/utils/gridUtils.ts` | Grid collision helpers (BLOCK su sovrapposizione, edge bounds) |
| `src/components/CardEditor.tsx` | Editor bigliettini: 3-col desktop / tabs mobile, FAB AI, zoom |
| `src/components/CardPreview.tsx` | Anteprima card: flexbox + CSS Grid mode (grid-based rendering) |
| `src/components/QREditor.tsx` | Generatore QR Code (7 tipi, stili, logo overlay) |
| `src/components/LogoEditor.tsx` | **Phase 4 / v2.1**: Logo Builder (tabs Builder + AI con namelix-like UX, lucide picker, 3 export sizes) |
| `src/components/FlyerEditor.tsx` | **Phase 3**: Volantino editor (form, layout switcher, AI modal, 4 template settore, PDF+PNG export) |
| `src/components/flyer/FlyerEditorShell.tsx` | **Flyer refactor**: logica editor completa (pannelli AI/manuale/preview, export, auto-save, mobile bottom bar) |
| `src/components/flyer/FlyerPreviewPanel.tsx` | **Flyer refactor**: pannello preview con badge densità e toggle debug |
| `src/components/flyer/FlyerManualPanel.tsx` | **Flyer refactor**: form manuale con limiti copy bloccanti da `copyBudget` |
| `src/components/flyer/FlyerAiPanel.tsx` | **Flyer refactor**: pannello AI (brief, suggerimenti, azioni rapide) |
| `src/components/flyer/FlyerFormatControls.tsx` | **Flyer refactor**: controlli formato/orientamento/dimensione |
| `src/components/flyer/FlyerLayoutControls.tsx` | **Flyer refactor**: switcher layout (classico/centrato/diviso/magazine) |
| `src/components/flyer/FlyerStyleFields.tsx` | **Flyer refactor**: colori/font/layout nel form |
| `src/components/flyer/FlyerTemplatePicker.tsx` | **Flyer refactor**: selettore template per settore |
| `src/components/flyer/FlyerExportActions.tsx` | **Flyer refactor**: bottoni export PDF/PNG |
| `src/utils/flyer/layoutEngine.ts` | **Flyer refactor**: layout engine puro, deterministico, in millimetri |
| `src/utils/flyer/svgRenderer.ts` | **Flyer refactor**: SVG builder con clip-path e `dominant-baseline="text-before-edge"` |
| `src/utils/flyer/textFit.ts` | **Flyer refactor**: fitting testo con shrink progressivo e verifica larghezza righe |
| `src/utils/flyer/geometry.ts` | **Flyer refactor**: rect, metriche font, FONT_METRICS, BOX_SAFETY_MM, GLYPH_HEIGHT_FACTOR |
| `src/utils/flyer/budgets.ts` | **Flyer refactor**: budget copy per blocco (calcolato a font minimo = hard limit) |
| `src/utils/flyer/templateCatalog.ts` | **Flyer refactor**: 4 settori × 4 layout = 16 template |
| `src/utils/flyer/templateFactory.ts` | **Flyer refactor**: factory `createFlyerTemplate(sector, layout)` |
| `src/utils/flyer/qrRenderer.ts` | **Flyer refactor**: QR inline SVG |
| `src/utils/flyer/pdfExport.ts` | **Flyer refactor**: PDF via pdfmake con SVG inline |
| `src/utils/flyer/pngExport.ts` | **Flyer refactor**: PNG via canvas pipeline |
| `src/utils/flyer/index.ts` | **Flyer refactor**: barrel re-export |
| `src/utils/flyer/__tests__/*` | **Flyer refactor**: unit test layout, budget, stress, template |
| `src/hooks/useAICard.ts` | Hook AI card (streaming, token tracking, error recovery) |
| `src/hooks/useAIFlyer.ts` | **Phase 3**: Hook AI flyer (log, stream buffer, token tracking, generate + refine) |
| `src/hooks/useMediaQuery.ts` | Hook responsive (breakpoint detection via matchMedia) |
| `src/ai/cardOrchestrator.ts` | AI orchestrator card (no tools, JSON round-trip) |
| `src/ai/flyerOrchestrator.ts` | **Phase 3**: AI orchestrator volantino (no tools, JSON round-trip, session mgmt) |
| `src/ai/BaseOrchestrator.ts` | **Phase v2.1/v2.2**: classe abstract condivisa (sanitizeAIResponse, parseJsonResponse, handleStream, trackUsage). v2.2: `sanitizeAIResponse` estrae anche array JSON bilanciati. 3 orchestratori estendono. |
| `src/ai/prompts/registry.ts` | **Phase v2.1**: promptRegistry, lookup centralizzato per 7 prompt (quote/card/flyer-system + flyer-copy + logo/social/onboarding-system). |
| `src/ai/providers/gemini.ts` | **Phase v2.1/v2.2**: `GeminiImageProvider` per generazione background (Nano Banana 2, `gemini-3.1-flash-image`). SDK `@google/genai` (`ai.interactions.create()`), non REST diretto. Richiede `response_modalities: ['text','image']` **minuscolo** e `generation_config.image_config.image_size: '512'` per restare sotto il clamp 500KB (v. `api/index.ts` `/ai/logo-background`). |
| `src/ai/logoOrchestrator.ts` | **Phase v2.2**: LogoAIOrchestrator con `generateLogo()` 3 concept DeepSeek + `generateBackground()` Gemini, merge nuovi campi decorativi. |
| `src/ai/socialOrchestrator.ts` | **Phase v2.1**: SocialAIOrchestrator cross-module (legge card/flyer, genera 3 post Instagram/Facebook/LinkedIn). |
| `src/ai/onboardingOrchestrator.ts` | **Phase v2.1**: OnboardingAIOrchestrator per suggerimenti displayName/company/profession/color. |
| `src/hooks/useAILogo.ts` | Hook client-side per `useAILogo` (generate 3 concept + generateBackground + isProcessing + isGeneratingBg). |
| `src/hooks/useAISocial.ts` | Hook per `useAISocial` (generate posts, posts state, logs). |
| `src/hooks/useAIOnboarding.ts` | Hook per `useAIOnboarding` (suggest, isProcessing, suggestions). |
| `src/components/SocialEditor.tsx` | **v2.2**: editor AI per generare 3 post social da card o flyer, usa `AILogPanel` per i log. |
| `src/components/BrandNameGenerator.tsx` | **v2.1**: generatore nome brand UX namelix-like (3-step chat: descrizione → mood → keyword → 5 nomi). |
| `src/ai/cardMerge.ts` | Merge risposta AI → card (grid, style, text, photo-preserv) |
| `vite.config.js` | Port 8000, SPA fallback for /app route. Dev proxy per `/api/ai/logo-config` + `/api/ai/logo-background` (STESSI path del client/prod, vedi gotcha sotto), `loadEnv()` esplicito per popolare `process.env` (Vite non lo fa di default fuori da `import.meta.env`). |
| `vercel.json` | Build runs `db:migrate` before `build` |

## App Routes

Real URL-based multipage (no more `useState('view')`). State lives in `AppShell`; child pages read from `AppContext`.

| Path | Component | Guard |
|------|-----------|-------|
| `/login` | `LoginPage` |, |
| `/` | `HomePage` |, |
| `/app` → `/app/editor` (redirect) | `EditorPage` → `EditorView` | login |
| `/app/collection` | `CollectionPage` → `CollectionView` | login |
| `/app/qr` | `QrPage` → `QREditor` (lazy) | login |
| `/app/card` | `CardPage` → `CardEditor` (lazy) | login |
| `/app/logo` | `LogoPage` → `LogoEditor` (lazy) | login (**Phase 4 + v2.1**) |
| `/app/flyer` | `FlyerPage` → `FlyerEditor` (lazy) | login |
| `/app/social` | `SocialPage` → `SocialEditor` (lazy) | login (**v2.1**: AI genera 3 post Instagram/Facebook/LinkedIn da card/flyer) |
| `/app/settings` | `SettingsRoute` → `SettingsPage` | login |
| `/app/admin` | `AdminPage` → `AdminDashboard` (lazy) | `user.role==='admin'` (via `AdminRoute`) |
| `*` | `NotFoundPage` |, |

- `Layout`/`Topbar` still receive `view: string` (back-compat with existing tests).
- `CollectionView.openQuote()` calls `setView('editor')` from `AppContext` → `navigate('/app/editor')`.
- All `/app/*` child routes are served by the SPA catch-all in `vercel.json`; no extra rewrites needed.

## Business Card Module

- **AI = Option B (dedicated module)**, not generic refactor, zero risk to quote AI
- **No new API endpoints**, reuses `providerRegistry` DeepSeek, same `/api/ai/chat`
- **Card AI has NO tools** (no prices/discounts), simpler than quote AI
- **Phase 2.2 master switch griglia (REQ-E01)**: il toggle "Griglia ON/OFF" (`showGrid`) è il **controllo unico** del grid-mode. `isGridMode = showGrid && hasGridElements(side)`. `useGrid` resta persistito per reload/export.
- **Init-from-layout (REQ-E03)**: attivare il master switch su un lato senza grid lo inizializza dal layout corrente (`deriveGridFromLayout`), niente "salto" dell'intera card.
- **QR sizing (REQ-E02)**: in flexbox-mode `back.qrSize` (`small` 84px / `medium` 120px / `large` 160px). In grid-mode la dimensione deriva dalla cella.
- **Grid elements**: `photo`, `name`, `title`, `company`, `logo`, `qr`, `contacts`, `socials`. Ognuno ha `x,y,w,h` in `card.grid` (fronte) o `card.backGrid` (retro).
- **`cardMerge.ts`** instrada elementi per lato (front→`grid`, back→`backGrid`), clampa collisioni con `stepMove`/`stepResize` graduali (REQ-A06), non sovrascrive `photoUrl`/`logoUrl` (base64 user-uploaded). Parity AI: supporta `services`, `servicesLabel`, `qrSize`, `fontScale` (clamp 0.7–1.5), `grid.elements.logo`.
- **Grid presets**: `gridPresetLeft()`, `gridPresetCentered()`, `gridPresetSplit()`, `gridPresetBackDefault()` in `documentSchemas.ts`
- **Font scale (REQ-D04)**: `style.fontScale` (0.7–1.5, default 1) applicato come CSS variable `--card-font-scale` su tutta la card. Replicato nell'export SVG/PDF via helper `fs()`.
- **Safe font families (REQ-D01)**: `SAFE_FONT_FAMILIES` export, set sicuro mostrato nel selettore. Card importate con font fuori set mostrano "Personalizzato" senza sovrascriverlo.
- **Componenti estratti** (REQ-B02): in `src/components/card/`. `CardFormFields.tsx` (Fronte, Media, Retro, Servizi, Social, QR avanzato, Stile) + `CardGridControls.tsx` (lato, preset, selettore, frecce, ridimensiona, cols/rows). Condivisi desktop 3-col e tab mobile "Modifica" → zero duplicazione JSX.
- **Toast feedback** (REQ-G01): mossa applicata → success. Blocco (collisione/bordo) → info. Cambio master switch → info. Errori AI → error.
- **Testo che va a capo** (REQ-F01): tutti i campi (nome, social, contatti, wordmark, handle-stamp) usano `overflow-wrap: break-word` invece di `ellipsis`.
- **`servicesLabel`** (REQ-F02): heading editabile sopra la lista servizi. `services: string[]` con auto-shrink classe per servizi ≥ 40 char (REQ-F03).
- **Export**: PDF 10-up (tipografia), PNG (raster), SVG (vettoriale), JSON (backup). All client-side via `pdfmake` + canvas pipeline.
- **`buildCardSvg`** è la pipeline: SVG → Image → canvas → PNG. `buildMinimalPng` fallback per jsdom.

## QR Code Module

- **7 tipi**: URL, text, email, phone, vCard, WiFi, SMS
- **Stili**: square, rounded, dots, via `qrcode` lib
- **Logo overlay**: base64 opzionale, max 20% area QR
- **Export**: SVG (vettoriale), PNG (raster)
- **Auto-save**: in collection come documento `qrCode`
- **Validazione**: contrasto fg/bg, PII check (WiFi password non loggata)

## Phase Status & Roadmap

Stato corrente delle fasi di sviluppo. Le spec delle fasi 0-6 + 10 (rebrand,
card-refactor, card-grid-ux) sono state cancellate dopo verifica
implementazione completa (commit `497100f`). Traccia storica in git history.

Le spec superstiti (`phase7-polish`, `flyer-refactor-preview-ai`) sono
mantenute per gap residui da chiarare.

| Fase | Stato | Note |
|------|-------|------|
| 0, Auto-save fix | ✅ done | `processingRef`/`cooldownRef` in EditorView, toast merge. |
| 1, QR Code | ✅ done | 7 tipi, export SVG/PNG, migration DB `documents`. |
| 2, Business Card | ✅ done (2.2 refactor) | Master switch, init-from-layout, QR sizing, fontScale, servicesLabel, parity mobile, AI parity. |
| 3, Volantino | ✅ done | 4 layout (classic/centered/split/magazine) × 5 formati (A6/A5/A4/Letter/Square), bleed 3mm, AI copy via `POST /ai/copy-flyer` (10/min/IP). PDF+PNG export client-side. Tier watermark rispettato. |
| 4, Logo SVG Builder | ✅ done | v1 senza AI (Replicate deferred a v2/Pro). Tab "AI Generation" disabilitato con messaggio. |
| 5, Tier System | ✅ done | Watermark free, unlock code via admin, tier guard su save. |
| 6, Unified Collection | ✅ done | `documents` table rinominata, collection unificata. |
| 7, Polish | ✅ done (parziale) | Onboarding step 5, HomePage "Perché noi", `preferredDocumentType` in DB, docs aggiornate. ⚠️ `LogoAiDocsPage` pubblica rimossa deliberatamente (docs ora private in `docs/logo-ai.md`); spec mantenuta per chiarimento. |
| 8, Quickbrand Rebrand | ✅ done | Rename + palette "The Classic" (Red & Ink), HomePage/LoginPage rebrand, test. |
| 9, Card Refactor Submodules | ✅ done | 11 utils + 9 components `src/utils/card/*` + `src/components/card/*`, barrel/shell pattern. |
| 10, Card Grid UX Alignment | ✅ done | alignH/alignV (9-pos), preset retro separato, e2e. |
| 11, Flyer Refactor Preview/AI | ⚠️ parziale | Architettura 12/12 utils + 11/11 components + 5/5 CSS. Gap: test matrix 4/10, `ai/flyer/budgets.ts` in `utils/flyer/budgets.ts` (deviazione equivalente). Spec mantenuta. |

### ✅ Fase 3 (Volantino) - implementata

**Stato**: Done. Schema `flyerSchema` + helper `createEmptyFlyer`,
`createFlyerTemplate`, `mergeFlyerWithDefaults`; generatore PDF/PNG
(`src/utils/flyerGenerator.ts`) con 4 layout × 5 formati + bleed 3mm +
crop marks via pdfmake; editor (`FlyerEditor.tsx`) con form, layout
switcher, AI modal, 4 azioni rapide (Semplifica/Più formale/Più
giovanile/Aggiungi urgenza), 4 template per settore (ristorante,
evento, salone, negozio); hook AI (`useAIFlyer`); endpoint API
`POST /ai/copy-flyer` con rate limit 10/min per IP + header
`Retry-After`; route `/app/flyer` + voce sidebar "Volantini" +
`flyerDocument` in `AppContext`.

**File rilevanti**:
- `src/utils/documentSchemas.ts` → sezione `FLYER (Phase 3)`.
- `src/utils/flyerGenerator.ts` → PDF/PNG con tier-aware watermark.
- `src/ai/prompts/flyerSystem.ts` → system + brief prompt + sanitizer.
- `src/ai/flyerOrchestrator.ts` → orchestratore no-tools, JSON
  round-trip, session management (stesso pattern di `cardOrchestrator`).
- `src/hooks/useAIFlyer.ts` → hook con stream buffer, logs, token
  tracking.
- `src/components/FlyerEditor.tsx` → editor con preview live.
- `src/pages/app/FlyerPage.tsx` + `src/main.tsx` → route.
- `src/components/Layout.tsx` → sidebar.
- `src/components/AppShell.tsx` + `src/contexts/index.ts` →
  `flyerDocument` state + `openDocument` case `'flyer'`.
- `api/index.ts` → `POST /ai/copy-flyer` + rimosso rejection su
  `documentType === 'flyer'` in `POST /documents`.
- `spec/spec-design-phase3-flyer.md` → spec originaria, da
  rivedere se si vuole (la spec rimane valida; l'implementazione
  la rispetta salvo l'AI copy endpoint che è in `api/index.ts` invece
  che in `src/ai/index.ts` come da pattern `useAI` esistente).

### ⚠️ Volantino rendering gotchas (leggi prima di toccare il rendering)

Bug e decisioni di design del modulo flyer emersi durante il refactor
preview/AI (`src/utils/flyer/`). Violare queste regole reintroduce
l'overflow del testo fuori dai box.

1. **Unità di `font-size` in SVG con `viewBox` in mm**: in SVG, se la
   `viewBox` è in millimetri e si scrive `font-size="8.5pt"` o
   `font-size="3mm"`, il browser converte in **px a 96dpi** e poi
   interpreta quei px come **user unit (= mm)**. Risultato: il font è
   ~3.78× più grande del previsto (8.5pt atteso = 3mm, renderizzato =
   11.33mm). **Fix**: usare **unitless**, ovvero
   `font-size="${fontSizePt * MM_PER_PT}"` (il valore numerico è mm
   user unit). Stessa regola per il `foreignObject` body CSS:
   `font-size: ${...}px` (px in foreignObject = user unit).
2. **Metriche font reali per Arial** (calibrate su `font-size` in mm
   unitless, fonte: `scripts/flyer-calibrate-real.mjs`):
   - `boldUpper: 0.69` (uppercase bold single word, ~0.66× reale)
   - `boldUpperCta: 0.67` (uppercase bold phrase con spazi, ~0.64×)
   - `regularBody: 0.46` (body mixed-case, ~0.43× reale)
   - `regularMixed: 0.50`
   `charWidthMm(fontSizePt, kind) = factor * fontSizePt * MM_PER_PT`.
3. **Altezza glyph reale**: ~1.15× font-size (ascender+descender). Usare
   `GLYPH_HEIGHT_FACTOR = 1.15` quando si calcola l'altezza verticale
   del box: `(lines-1) * fontSize * lineHeight + fontSize *
   GLYPH_HEIGHT_FACTOR`, **non** `lines * fontSize * lineHeight`
   (l'ultima riga ha glyph height, non line height).
4. **`dominant-baseline="text-before-edge"`** su tutti i `<text>` nativi:
   allinea il top del bbox alla y. Senza, il bbox parte ~0.7em sopra
   la baseline e il testo "sale" sopra il box.
5. **`clip-path`** con `clipPath` rect in mm: garantisce clipping visivo
   anche se il bbox del primo glifo ha left side-bearing negativo
   (overflow orizzontale di ~0.3mm tollerabile e già tagliato).
6. **Budget copy al font minimo è un hard limit, non un soft hint**.
   `getFlyerCopyBudget` in `src/utils/flyer/budgets.ts` calcola i char
   residui usando `bounds.X.min` (font minimo). Al **font reale** (più
   grande, scelto da `fitText`), ne entrano molti meno — il campo body
   mostra "1758 CAR. RESIDUI" ma al font 13pt ne entrano ~500. Questo
   spiega "non riesco a inserire tutto il testo". Possibili mitigazioni:
   (a) mostrare il budget al font reale corrente, non al minimo;
   (b) troncare con warning; (c) ridurre il copy nell'AI copy generator.
7. **Subheadline** è mixed-case, non uppercase: usare `kind: 'regular'`
   in `fitText`, non `'boldUpper'`. Mixing kinds causa wrap errato e
   font-size troppo conservativo.
8. **CTA fitting**: usare `fitCtaText` (shrink + ellipsis centrale)
   per garantire che il bottone non ecceda mai la larghezza.
9. **Verifier Playwright**: per controllo overflow end-to-end, usare
   `getBBox()` (user unit) vs `clipPath` rect; tolleranza orizzontale
   0.3mm, verticale 0.6mm (side-bearings e ascender).

## Logo Builder Module (fase 4 + v2.2)

- **SVG builder templated** con tab "AI Generation" attivo (v2.1/v2.2,
  richiede tier unlocked). Icone: libreria `lucide-react` ^0.395.0,
  allowlist 48 nomi pre-filtrati (food/tech/fashion/business).
  Validazione lato generatore (no injection).
- **4 template per settore**: tech, food, fashion, professionista.
- **3 layout**: horizontal, vertical, stacked.
- **Auto-fit v2.2**: `getViewBox(layout, primaryText, tagline)` dinamico
  + `fitText()` per non troncare testi lunghi. ViewBox clamp `[400, 800]`
  per horizontal.
- **Decorazioni v2.2**: `backgroundColor` (solid), `gradientFill`
  (primary→secondary sul testo), `decorativeElements`
  (`underline`/`dotRing`/`topAccent`). Controlli sia AI che manuali.
- **AI v2.2**: DeepSeek genera 3 concept distinti (array JSON) in una
  sola chiamata, ognuno con un `imagePrompt` dedicato (formula
  Nano-Banana: Subject+Action+Context+Composition+Lighting+Style). Le
  **3 immagini Gemini partono in parallelo subito dopo** (non dopo la
  selezione): `Promise.allSettled` su 3 `generateBackground()`, badge
  "AI bg ✓" per concept su ogni card. L'utente sceglie un concept →
  `onPatch(builder)` applica testo/colori/icona/background scelti.
- **Export**: SVG (Blob download), PNG 512/1024/2048 (canvas pipeline).
- **Sicurezza**: escape XML su `primaryText`/`tagline`, sanitize SVG
  via `DOMParser`+`XMLSerializer` prima di `dangerouslySetInnerHTML`,
  regex `#RRGGBB` per i colori.
- **Pattern riusati**: schema Zod in `documentSchemas.ts`, salvataggio
  via `dataService.saveDocument` con `documentType='logo'`, lazy-load
  componente in `App.tsx`.
- **Persistenza chat v2.2**: `LogoAiPanel` salva `answers`, `step`,
  `concepts`, `selected`, `bgImages` in `localStorage['logoAiChat:v1']`
  con TTL 24h.
- **Bottone "Nuovo" (v2.3)**: header `LogoEditor` ha un bottone "Nuovo"
  che azzera `logo` a `createEmptyLogo()`, pulisce
  `localStorage['logoAiChat:v1']` e forza il remount di `LogoAiPanel`
  (via `key`). Chiede conferma (`window.confirm`) solo se il logo
  corrente ha contenuto (`logoHasContent`).
- **Leggibilità e posizione testo (v2.3)**: `logoBuilderSchema` ha
  `textColorMode` (`auto`/`light`/`dark`, forza bianco/nero-quasi per
  contrasto contro foto AI), `textBackdrop` (`none`/`pill`/`band`, una
  pillola o banda semi-trasparente dietro al testo, tono invertito
  rispetto a `textColorMode`), `textOffsetX`/`textOffsetY` (nudge ±60,
  frecce nel BuilderPanel, stesso pattern del Card grid — non
  drag-and-drop), `textScale` (0.7–1.5, slider). Tutti applicati in
  `logoGenerator.ts buildSvgForLayout` senza toccare la posizione
  dell'icona. `gradientFill` (v2.2) ha priorità su `textColorMode`
  quando entrambi attivi.
- **Prompt template (v2.3, Piano B)**: `LogoAiPanel` ha (1)
  `SECTOR_PRESET_BRIEFS` — un bottone "Usa esempio {settore}" che
  pre-compila activity/mood/target con un brief di esempio per il
  settore selezionato; (2) libreria "I miei prompt" —
  `localStorage['logoPromptLibrary:v1']`, salva/applica/elimina brief
  completi (non il singolo `imagePrompt` Gemini, che è troppo legato al
  concept specifico per essere riusabile come preset); (3) sezione
  "Prompt avanzato" per concept (`<details>`) con textarea editabile
  sull'`imagePrompt` generato da DeepSeek + bottone "Rigenera immagine"
  che richiama `generateBackground` solo per quel concept con il testo
  modificato (non rigenera gli altri 2). `ConceptCard` non è più un
  singolo `<button>` (nested-button non valido con la textarea): la
  select-area è un `<button className="logo-ai-concept-select">`
  dentro un `<div className="logo-ai-concept">` wrapper.

### ⚠️ Logo AI, Gemini background gotchas (leggi prima di toccare `gemini.ts` o `vite.config.js`)

Due bug distinti hanno bloccato la generazione background per un
intero ciclo di sviluppo; nessuno dei due era nel provider Gemini in
sé. Leggere prima di rimettere mano a questa parte.

1. **Path del proxy dev deve combaciare col client/prod esattamente**.
   Il client (`LogoAiPanel.tsx`) e `api/index.ts` usano
   `/api/ai/logo-config` + `/api/ai/logo-background` (con `/ai/`). Il
   middleware dev in `vite.config.js` un tempo intercettava
   `/api/logo-config` (senza `/ai/`): la fetch falliva silenziosamente,
   `config.provider` restava `'none'` e l'intero ramo di generazione
   background veniva **skippato lato client senza nessun log** — sembrava
   che Gemini non venisse mai chiamato. Se si aggiunge un nuovo endpoint
   AI, verificare SEMPRE che il path nel dev middleware sia identico
   (char per char) a quello del client.
2. **`process.env` non è popolato di default nel dev server**. Vite
   espone `.env` solo via `import.meta.env` (bundle client); il codice
   server-side in `vite.config.js` (incluso il middleware sopra) vede
   `process.env` vuoto per le chiavi senza logica esplicita. Fix:
   `loadEnv(mode, process.cwd(), '')` in testa a `vite.config.js`,
   merge manuale in `process.env`.
3. **Non duplicare la logica del provider nel middleware dev**. In
   passato il middleware aveva una sua chiamata REST inline a Gemini
   (modello e API diversi da `gemini.ts`), quindi dev e prod si
   comportavano diversamente. Ora il middleware fa
   `server.ssrLoadModule('/src/ai/providers/gemini.ts')` e riusa la
   stessa classe `GeminiImageProvider` di produzione.
4. **`interactions.create()` vuole `response_modalities` minuscolo**
   (`['text', 'image']`), non `['TEXT', 'IMAGE']` (quella è la
   convenzione della vecchia REST `generateContent`). Con i valori
   maiuscolo l'SDK risponde `400: value 'TEXT' is not supported`.
5. **Dimensione immagine non enforced di default**: senza
   `generation_config.image_config.image_size`, Gemini produce a
   risoluzione `1K` (~400KB-2MB variabile), e il clamp lato server
   (500KB, vedi `api/index.ts` `/ai/logo-background`) scarta dopo il
   fatto ~2/3 delle immagini con 413. Fix: chiedere esplicitamente
   `image_size: '512'` (+ `aspect_ratio: '16:9'`) in fase di richiesta,
   non dopo. Valori supportati: `'512' | '1K' | '2K' | '4K'`.

## Known Issues, Card Module (fase 2)

**Stato (post fase 2.2)**: tutti i bug bloccanti sono chiusi e le
funzionalità nuove (master switch, init-from-layout, QR sizing,
fontScale, servicesLabel, parità mobile, AI parity) sono implementate
e coperte da test. Restano aperte due questioni di scope minore
(UX mobile + persistenza selezione grid).

### ✅ Risolto in fase 2.1: collision detection BLOCK

Helper `src/utils/gridUtils.ts` con `collides/wouldCollideOnMove/
wouldCollideOnResize/canMove/canResize/clampMove/clampResize`. Usato da:

- `CardEditor.tsx` (desktop), `moveSelectedElement` e `resizeSelectedElement`
  clampano alla posizione valida più vicina; bottoni frecce
  disabilitati in entrambi i casi (edge + collisione).
- `MobileGridEditor.tsx` (mobile), `move()` delega a `clampMove`;
  frecce popup con `title="Limite (collisione)"` se il blocco è per
  sovrapposizione, altrimenti "Limite raggiunto".
- `cardMerge.ts` (AI), `clampMove`/`clampResize` sanificano la mossa
  richiesta dall'AI prima di applicarla, così l'AI non può generare
  grid con elementi sovrapposti. Il system prompt
  (`src/ai/prompts/cardSystem.ts`) è stato esteso con regole
  esplicite anti-collisione e la lista elementi aggiornata con `logo`.

25 unit test in `gridUtils.test.ts` + 4 nuovi test in `cardMerge.test.ts`
(logo merge, AI move→clamp, AI resize→clamp).

### ✅ Risolto in fase 2.1: logo in grid mode

`cardGridSchema.elements` ora include `logo` (opzionale). I tre preset
hanno una posizione di default sensata:

- `gridPresetLeft`: company ridotto a 2-col, logo a `(3, 2, 1, 2)`.
- `gridPresetCentered`: company ridotto a 3-col, logo a `(3, 3, 1, 1)`.
- `gridPresetSplit`: contacts ridotto a 2-col, qr a `(2, 2, 1, 2)`,
  logo a `(3, 2, 1, 2)`.

`MobileGridEditor.ELEMENT_OPTIONS` ora include `Logo`. `CardEditor`
dropdown ha `logo` tra le opzioni selezionabili.

### ✅ Risolto in fase 2.1: logo ~30% della card

- CSS (preview/React): `card-logo` 60→100px, `.centered` 76→125px,
  `.split` 64→110px.
- Export SVG (`cardGenerator.ts buildFrontSvg`): left
  `photoSize * 0.32` → `0.48`; split `pxH * 0.12` → `0.20`; centered
  aggiunto (sotto al company, `pxH * 0.20`).
- Export PDF (`cardGenerator.ts buildFrontCell`): `Math.min(14, ...)`
  → `Math.min(25, dims.w * 0.30)`. Logo in mm: ~25mm su 85mm = ~29%.
- Aggiunto logo al `buildFrontSvg` per layout `centered` (prima
  mancante anche lì).

### ✅ Risolto in fase 2.1: QR preview/export coerenti

`generateQrSvg` è ora **sincrono** (era `Promise<string>`). La
`useEffect` async in `CardPreview` rimossa: QR renderizzato
immediatamente al primo render. Anche il placeholder "QR" è
migliorato e mostra il QR reale appena la promise risolve (subito,
in pratica).

### ✅ Risolto in fase 2.1: buildFrontSvg split senza logo

Prima della fase 2.1 il logo **non veniva renderizzato** in split
layout. Aggiunto `<image>` per il logo a `(textX, logoY)` con size
proporzionale. Vedi `cardGenerator.ts:761-765` (pxH*0.20).

### ✅ Risolto in fase 2.1: hostname ridondante rimosso dal front

In `buildFrontSvg` (left/centered) e `buildFrontCell` (PDF) il
`hostname` non viene più mostrato sotto la foto quando è già
presente il QR code nel retro. Vedi `CardPreview.tsx` WEB row
condition `card.back.website && !qrPayload`.

### ✅ Risolto in fase 2.1: template Giovanni completo

`createGiovanniCardTemplate()` ora ha:

- `layout: 'split'` (foto a sinistra full-height)
- `photoUrl: '/giovanni-photo.jpg'` (foto utente in `public/`)
- `logoUrl: giovanniLogoDataUri()` (SVG trasparente "WebdevCA")
- `qrPayload: GIOVANNI_PERSONAL_URL` (QR punta al sito)
- `company: 'HPE CDS'`
- `grid` preconfigurato con photo a sx full-height e text/logo a dx

### ⏳ Aperto (scope minore, non bloccante)

- **Mobile grid editor, drag-and-drop**: `MobileGridEditor` usa
  frecce ←↑→↓ + +/−. Su schermi piccoli le 4 direzioni × 2 resize × N
  elementi diventano molti tap. Valutare drag-and-drop diretto.
- **Selezione elemento persistente**: `selectedGridElement` è
  `useState` locale in CardEditor. Cambiare tab (es. AI) e tornare
  deseleziona. Fix: persistere in `card.selectedGridElement` o alzare
  a `useState` in AppShell.
- **CardPreview test su QR jsdom**: `generateQrSvg` non gira in jsdom.
  I test sul QR verificano solo che il placeholder appaia quando
  `qrPayload` è vuoto. Fix: mock `qrcode` o `qrGenerator.generateQrSvg`
  per test deterministici.

### Test coverage del modulo Card

- 4 file di test (`CardEditor`, `CardPreview`, `CardEditorTabs`,
  `CardAIFab`, `CardAIBottomSheet`, `MobileGridEditor`,
  `CardPreviewZoomControls`) + 1 nuovo `gridUtils.test.ts` + nuovi
  test collision in `CardEditor.test.tsx` e `MobileGridEditor.test.tsx`.
- **Phase 2.2**: test aggiunti per master switch, init-from-layout,
  fontScale CSS var, servicesLabel rendering, qrSize, auto-shrink
  classe. Test AI parity (fontScale clamp, services array clamp, qrSize
  enum, servicesLabel, logo nel grid) in `cardMerge.test.ts` e
  `aiCardInputSchema.test.ts`.
- Totale: ~140+ test sul modulo card.

## Responsive Patterns

- **`useMediaQuery(query)`**: hook React, ritorna `boolean`, listener su `change` event, cleanup su unmount, fallback SSR
- **Conditional render, NOT CSS hide**: il 3-col desktop NON è nel DOM quando mobile (evita duplicati)
- **Tab system** (`CardEditorTabs`): 3 tab (Anteprima, Modifica, AI) su mobile (<900px)
- **FAB AI** (`CardAIFab`): bottone floating 56px, sempre visibile in mobile, badge con log count
- **Bottom sheet** (`CardAIBottomSheet`): drawer dal basso 85vh, ESC + backdrop chiudono, `role=dialog`
- **`useCardAIFloating`**: Context provider con stato `isOpen`/`hasUnread`, azioni `open`/`close`/`toggle`/`pushLog`
- **Zoom preview** (`useCardPreviewZoom`): range 50-150%, step 10%, default 70% mobile / 100% desktop. Phase 2.2 REQ-C01: scaling con width riservato (no overflow) + REQ-C02: reattività al breakpoint mobile/desktop.
- **Mobile grid editor** (`MobileGridEditor`): select elemento + popup frecce 3×3 (non drag-and-drop, più accessibile). Phase 2.2: riusa `CardGridControls` con `mode='mobile'` (logica condivisa con desktop).
- **iOS auto-zoom prevention**: `font-size: 16px` su tutti gli input in mobile

## Environment Variables

`.env.example` has all vars. Required:

| Var | Where | Purpose |
|-----|-------|--------|
| `DATABASE_URL` | Vercel (Production+Preview) | Neon Postgres connection |
| `DEEPSEEK_API_KEY` | Vercel (Production+Preview) + .env (locale) | AI chat (server-side only). Usato da tutti gli orchestratori (preventivo, card, flyer, social, onboarding) via proxy `/api/ai/chat`. |
| `GEMINI_API_KEY` | Vercel (Production+Preview) + .env (locale) | **Phase v2.1/v2.2**: Google AI image generation per background logo AI (Nano Banana 2, modello `gemini-3.1-flash-image`, via SDK `@google/genai`). Proxy server-side `/api/ai/logo-background` (prod) e dev middleware in `vite.config.js` (riusa lo stesso provider via `ssrLoadModule`). Senza la key, il tab AI del LogoEditor funziona ma genera solo parametri (no background). In locale può anche chiamarsi `VITE_GEMINI_API_KEY` in `.env` (letto server-side, mai esposto al bundle). |
| `ADMIN_PASSWORD` | Vercel (Production+Preview) | Admin login (admin@gmail.com) |
| `VITE_ADMIN_PASSWORD` | .env (local only) | Admin login in dev |
| `ALLOWED_ORIGIN` | Vercel (Production+Preview) | CORS origin (es. `https://tuodominio.vercel.app`). Se vuoto accetta solo `*.vercel.app`. |
| `REPLICATE_API_TOKEN` | Vercel (opzionale, deprecato) | Fallback per Logo AI background. Se `GEMINI_API_KEY` è presente, ha priorità. Mantenuto per retrocompatibilità. |

**Setup locale**:
1. Copia `.env.example` in `.env` (server) o in `.env.local` (Vite).
2. Inserisci le chiavi: `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `VITE_ADMIN_PASSWORD`.
3. Le chiavi senza prefisso `VITE_` sono lette solo lato server (`api/index.ts`).
4. Vite proxy in dev: `npm run dev` espone `/api/*` direttamente tramite il dev server Vite.

**Never expose `DEEPSEEK_API_KEY` or `GEMINI_API_KEY` to the browser.** The frontend calls the serverless function proxy, which holds the keys server-side.

### PDF Generation, Client-Side Only

PDF generation happens entirely in the browser via `pdfmake` (in `src/utils/generatePDF.ts`). No server upload, no Vercel Blob needed. This keeps the app free-tier friendly.

- `App.tsx` `exportPDF()` → download locale

## API Schema Duplication

`api/index.ts` inlines the Drizzle schema for Vercel compatibility. If you modify `db/schema.ts`, you must also update the corresponding tables in `api/index.ts` (lines 9-52).

## Vercel Routing, CRITICAL

`api/index.ts` is the **only** Vercel serverless function. It handles every `/api/*` request via internal routing. This is a deliberate monolith (see "Lessons learned" below).

**DO NOT**:
- Split `api/index.ts` into multiple files. Vercel's `_` prefix (`api/_lib/`, `api/_routes/`) is **NOT** the shared-code trick it appears to be, files starting with `_` are excluded from **both** the serverless-function count AND the function bundle, so any function in `api/` that imports from `api/_*/...` crashes at runtime with `ERR_MODULE_NOT_FOUND` ("Cannot find module '/var/task/api/_lib/handler'"). This was the bug from commit `036ae25` that broke production for hours.
- Add other `.ts` files directly in `api/`. Each one counts toward the Hobby plan's 12-function limit.
- Use `vercel.json` `functions.includeFiles` to copy `*.ts` from outside `api/`. Vercel copies the files as static assets but does not transpile them, so Node ESM still can't resolve them.
- Use `vercel.json` rewrites to split the API into multiple functions. With the monolith, no `/api/*` rewrites are needed, the single `api/index.ts` handles everything.

**DO**:
- Keep all server-side logic inline in `api/index.ts`. The file is intentionally large (~750 lines). Modularity is achieved through internal `handleXxx` functions and helper utilities defined at the top of the file.
- If you need to share types or pure functions with the client, put them in `src/` and have `api/index.ts` import from there. The `src/` directory is bundled correctly.

## Lessons learned, Vercel function bundling (read before splitting)

Four commits attempted to refactor the API structure; all four broke production. The root causes were different each time. Read all four before touching `api/`.

1. `f004e5e` (split into `api/lib/` + `api/routes/`): exceeded 12-function limit. Vercel counted every `.ts` in `api/` as a function.
2. `036ae25` (moved shared code to `api/_lib/` + `api/_routes/` with underscore prefix): underscore prefix excludes files from BOTH the count and the bundle. The functions couldn't import the shared code → `ERR_MODULE_NOT_FOUND` at runtime.
3. `5e2971f` (tried `vercel.json` `functions.includeFiles`): copies the files but doesn't transpile them. Still `ERR_MODULE_NOT_FOUND`.
4. `05b17e6` (rollback to single monolith): removed the `{"source": "/api/(.*)", "destination": "/api"}` rewrite from `vercel.json` along with the multi-function split. Without it, Vercel fell through to the SPA catch-all `/(.*) -> /index.html` and returned **405 Method Not Allowed** for every POST to `/api/*` (because `/index.html` is a static asset that doesn't accept POST). The monolith function was unreachable.

**Conclusion**: on the Vercel Hobby plan, a single monolith function is the only safe option for a Node API of this size. **Always keep** the following in `vercel.json`:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

The order is **critical**: `/api/(.*) -> /api` MUST come **before** the SPA catch-all. Vercel evaluates rewrites top-to-bottom and uses the first match. There is a regression test in `src/__tests__/vercelConfig.test.ts` that asserts both the presence and the order of these rewrites. Future investigation of `drizzle-orm/neon-serverless` (WebSocket driver) is still pending, see "Backend" section above.

## Streaming AI

- Lo streaming funziona per **tutte** le risposte AI (testo + tool), non solo per i tool.
- Dopo l'esecuzione di tool, viene fatta una **seconda chiamata** (multi-turn) per generare la sintesi finale (qualità migliore).
- Token usage viene accumulato tra le due chiamate e mostrato in `result.response.usage`.
- Log "a blocchi": `useAI.ts` emette un'entry di log ogni 400ms con preview del contenuto ricevuto.

## Test, OBBLIGATORI

**Ogni modifica al codice di produzione (`src/`, `api/`, `db/`) DEVE essere accompagnata da test.**

Regole:

1. **Nuovo codice → nuovi test.** Funzioni/componenti/endpoint nuovi nascono con almeno un test che ne copre il caso felice + 1 caso di errore.
2. **Codice modificato → test aggiornati.** Se modifichi un branch, una condizione, una prop, un parametro: aggiorna o aggiungi il test corrispondente. Nessun "test morto" lasciato passare.
3. **Bug fix → regression test.** Quando risolvi un bug, scrivi un test che lo riproduce PRIMA del fix, poi verifica che passi dopo.
4. **Refactor → test invariati ma verdi.** Se il refactor rompe test esistenti, il refactor è sbagliato (o i test erano incompleti).
5. **Coverage minima per nuovi file: 60%** (target progetto). File sotto soglia vanno motivati con commento.
6. **Mai** skippare un test con `.skip` o `xit` per far passare la CI. Se è flaky, fixalo.
7. **Prima di proporre un push** (vedi sezione *Pre-push Checklist* in cima): `npm run typecheck && npm run test` devono essere verdi. Se falliscono, risolvi prima, non proporre il push.

Posizione test:
- Componenti React → `src/components/__tests__/` o `src/pages/__tests__/`
- Hook → `src/hooks/__tests__/`
- Utility pure → `src/utils/__tests__/`
- API endpoints → `api/__tests__/` (mockando il DB)

## Admin User

- Email: `admin@gmail.com`
- Never saved to database, password validated against `ADMIN_PASSWORD` env var
- Has unlimited tokens (`tokenLimit: 999999999`)
- Endpoint admin (`GET /users`, `GET /quotes/all`, `PATCH /users/limits`) richiedono `adminEmail=admin@gmail.com` come query param o body field. Se assente → 403.

## Auth Security

- `ADMIN_PASSWORD` validated with **constant-time compare** (`crypto.timingSafeEqual`).
- Rate limiting in-memory: 5 login attempts / 15min per IP, 30 AI stream calls / min per IP, 200 logs / min per IP.
- `bodyParser` size limit: 1 MB.
- CORS in production: solo `ALLOWED_ORIGIN` o `*.vercel.app`. In dev: `*`.

## localStorage Schema

Tutte le chiavi localStorage devono essere **versionate**: `nome:vN` (es. `users:v1`).
Quando cambi schema, aggiungi `v(N+1)` e lascia un fallback di lettura per la `vN` precedente.
Vedi `.agents/skills/vercel-react-best-practices/rules/client-localstorage-schema.md`.

Chiavi attuali:
- `precisionQuote_quotes`, array preventivi legacy (pre-fase 6, deprecata)
- `precisionQuote_documents:v1`, **Phase 6**: documenti unificati (preventivi, QR, card, logo)
- `pq_migration_v1_done_<email>`, **Phase 6**: flag migrazione da legacy `quotes` → `documents:v1`
- `userSettings_<email>`, impostazioni utente (include `tier`, `documentCount`, `unlockCode` da fase 5 e `preferredDocumentType` da fase 7)
- `unlock_codes`, codici sblocco tier (solo dev, popolato dall'admin)
- `registeredUsers`, array utenti (dev only fallback)
- `deepseekApiKey`, chiave DeepSeek (solo dev)
- `authToken`, `userEmail`, `username`, `userRole`, `dataRegistrazione`, sessione

## Testing

- Framework: Vitest + React Testing Library + jsdom
- Run single test: `npx vitest run path/to/file.test.ts`
- No test database needed, local tests use localStorage path
- Coverage attuale: ~10% (4 file). Target: 60%. Attualmente 844 test su 76 file.

## Logging

- **Server** (inline in `api/index.ts`): JSON strutturato in production tramite `console.error/info/etc`. Sostituisce tutti i `console.error` esistenti.
- **Client** (`src/utils/logger.ts`): usa `sendBeacon` (no blocking) per inviare eventi a `/api/logs` → Vercel logs.
- I client log in production sono filtrati: solo `warn`/`error` arrivano al server.

## Git Guardrails

**DO NOT** execute these commands without explicit user confirmation:

| Blocked | Risk |
|---------|------|
| `git push` (all variants) | Must be done manually by user |
| `git push --force` / `git push -f` | Rewrites remote history |
| `git reset --hard` | Discards all local changes |
| `git clean -f` / `git clean -fd` | Deletes untracked files permanently |
| `git branch -D` | Force-deletes branch |
| `git checkout .` / `git restore .` | Discards all working tree changes |
| `git stash drop` | Loses stashed changes |
| `git tag -d` | Deletes local tags |

Always run `git status` before any git operation. See `.agents/guardrails/git-guardrails.md` for full details.

### Additional Push / Deploy Rules

1. **Explicit confirmation required**: never run `git push` unless the user has clearly said to push/deploy. "Analyze" or "fix" does **not** imply push.
2. **Do not change `vercel.json` rewrites** without explicitly testing `/api` routes (auth, register, upload-pdf, public quote) afterwards. The current rewrite is the SPA fallback only:
   ```json
   { "source": "/(.*)", "destination": "/index.html" }
   ```
    The `/api/*` path is served directly by the single `api/index.ts` function. Do **not** add per-route `/api/*` rewrites, they break the monolithic function and cause `ERR_MODULE_NOT_FOUND` on shared imports.
3. **Before pushing features that require Vercel env vars** (DEEPSEEK_API_KEY, DATABASE_URL, ADMIN_PASSWORD, ALLOWED_ORIGIN), confirm the variables are set in the Vercel dashboard. Missing env vars cause 503/500 errors in production. `REPLICATE_API_TOKEN` is **optional** in v1 (logo AI tab mostra docs page).

## Active Skills

Queste skill vengono caricate automaticamente. Quando modifichi il codice riferito a esse, **leggi la skill prima** (`.agents/skills/<name>/SKILL.md`).

- `vercel-react-best-practices`, performance React (sempre attiva)
- `vercel-composition-patterns`, component design
- `web-design-guidelines`, review UI/accessibilità
- `writing-guidelines`, docs/prose style
- `test-driven-development` (obra/superpowers), disciplina TDD per Blocco 3+
- `frontend-design` (anthropics/skills), design opinionale per UI
- `caveman` ([juliusbrussee/caveman](https://github.com/juliusbrussee/caveman)), **compressione output** (stile terso, ~-65% token risposta). Sempre attiva, vedi sezione *Output Style* sopra. Disattivazione solo con "normal mode" o in casi di auto-clarity.
- `ai-prompt-engineering`, system prompt AI (quando si tocca `src/ai/prompts/*` o `src/ai/*Orchestrator.ts`)
- `vercel-serverless-monolith`, monolite Vercel (quando si tocca `api/index.ts` o `api/`)
- `pdf-client-side`, PDF/PNG export (quando si tocca `*Generator.ts` o `watermark.ts`)

**Skill on-demand** (caricare solo se il task lo richiede esplicitamente):
- `deploy-to-vercel`, solo quando l'utente chiede deploy
- `vercel-cli-with-tokens`, solo per setup CLI con token
- `vercel-optimize`, solo per audit costi/performance (richiede Vercel CLI autenticato)
- `git-guardrails-claude-code`, solo per setup hook
- `gpt-taste` (leonxlnx/taste-skill), design taste elite per UI/UX di alta qualità (AIDA, GSAP, bento). Attiva quando si ridisegna HomePage/Editor/Preview.
- `design-taste-frontend` (leonxlnx/taste-skill), variant frontend del taste skill, per review design UI.
- `high-end-visual-design`, design visivo premium per feature nuove.
- `imagegen-frontend-web`, generazione mockup/preview web via AI.
- `industrial-brutalist-ui`, estetica brutalist come alternativa di design.
- `minimalist-ui`, estetica minimalista.
- `redesign-existing-projects`, quando si ridisegna un componente esistente.
- `stitch-design-taste`, pattern design system Stitch-style.
- `brandkit`, brand identity kit per coerenza visiva Quickbrand.
- `full-output-enforcement`, enforcement output formato.
- `image-to-code`, conversione mockup → codice.
- `imagegen-frontend-mobile`, mockup mobile via AI.
- `social-media`, draft post social (NON su disco, riferimento futuro).
- `muapi-nano-banana`, prompting formula Nano-Banana (Subject+Action+
  Context+Composition+Lighting+Style) per `imagePrompt` AI logo/immagini.

**Skill rimosse** (non usate da questo progetto):
- `vercel-react-native-skills`, non è un'app React Native
- `vercel-react-view-transitions`, non usiamo View Transitions API
- ~~`web-security`~~, **mancante su disco** (riferimento storico, rimosso da Active Skills). Reinstallare con `npx skills add ...` se serve.

## API Design Principles (REST)

- **Status code**: 200 OK / 201 Created / 204 No Content / 400 Bad Request / 401 Unauthorized / 403 Forbidden / 404 Not Found / 409 Conflict / 429 Too Many Requests / 500 Server Error / 503 Unavailable
- **Input**: Zod validation su ogni body/query
- **Output**: JSON uniforme `{ data }` o `{ error }`
- **Auth**: verificata in ogni handler, non solo middleware
- **Rate-limit**: scope dedicato per categoria (`login`, `ai`, `tokens`, `logs`)
- **Admin endpoints**: `adminEmail=admin@gmail.com` sempre richiesto
- **`adminEmail` transport**: **query string** per GET (`?adminEmail=...`), **body** per PATCH/POST. Non mischiare, vedi `api/__tests__/users.test.ts` (regression per bug 51d84a5: `GET /users` leggeva da body mentre il client mandava query string, risultato tabella admin vuota in prod).
- **Idempotenza**: GET, PUT, DELETE idempotenti; POST no

## OWASP Top 10 (stato corrente)

- A01 Broken Access Control: ✅ /users, /quotes/all, /users/limits, /users/tokens con check admin
- A02 Cryptographic Failures: ✅ bcrypt 12, constant-time compare admin
- A03 Injection: ✅ Zod su tutti gli input
- A04 Insecure Design: 🟡 threat modeling mancante (TODO post-refactor)
- A05 Security Misconfiguration: ✅ CORS ristretto, body 1MB, no stack trace
- A06 Vulnerable Components: 🟡 audit dipendenze non fatto (TODO)
- A07 Auth Failures: ✅ rate-limit login + tokens + aistream
- A08 Data Integrity: ✅ env server-side only, no secrets in bundle
- A09 Logging Failures: ✅ logger strutturato, /api/logs client→server
- A10 SSRF: ✅ solo outbound hardcoded (DeepSeek)

## Skills & Guardrails Location

| Path | Contents |
|------|----------|
| `.agents/skills/` | Installed agent skills (29 totali, 10 attive + 19 on-demand). Le skill sono **solo per l'agente di coding** (opencode), NON per l'app. L'app usa DeepSeek e (per logo background) Gemini via proxy server-side. |
| `.agents/guardrails/` | Git safety rules and block scripts |
| `api/index.ts` | Single Vercel serverless function, entire REST API (monolith) |
| `src/utils/` | Client-side utilities (logger, errors) |

### Note: UX namelix-like è per tutti i prodotti?

No. Attualmente l'UX namelix-like (chat step che fa domande prima di generare) è implementata **solo in onboarding** (`BrandNameGenerator.tsx`). Per ogni prodotto specifico (logo, card, flyer, social) il flusso AI è diretto: parametri → genera → applica. La UX namelix-like per logo AI v2.1 è una variante semplificata (3 domande nel tab AI), non un generatore di nomi brand. Estendere a tutti i prodotti è fattibile ma fuori scope.

### Note: Skill taste-skill (leonxlnx/taste-skill) è per l'app o per l'agente?

**Solo per l'agente di coding (opencode).** Le skill in `.agents/skills/` sono regole che l'agente di coding carica per scrivere meglio il codice (AIDA, GSAP, bento grid, ecc.). L'app Quickbrand NON usa queste skill: l'app usa DeepSeek (testo AI) e Gemini Nano Banana (immagini AI) via proxy server-side. Le skill taste sono utili quando si ridisegna HomePage/Editor/Preview perché guidano l'agente verso design premium. Non hanno impatto runtime sull'app.

### Note: Gemini Nano Banana è usato per altri prodotti (flyer, card)?

**No, attualmente solo per logo background.** Il provider `GeminiImageProvider` (`src/ai/providers/gemini.ts`) è wireato solo all'endpoint `/ai/logo-background` e all'orchestratore `LogoAIOrchestrator.generateBackground()`. Flyer usa hero image statiche (picsum.photos URL), card non ha AI image generation. Estendere Gemini a flyer (hero AI) e card (cover AI) è fattibile ma out of scope v2.1.

