# AGENTS.md – Quickbrand

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
| `src/hooks/useRouteView.ts` | Bridge hook: `pathname ↔ view` (editor\|collection\|qr\|card\|logo\|flyer\|social\|settings\|admin), `setView` calls `navigate()`. Also handles prefix-match for `:docId` routes. |
| `src/hooks/useDocumentLoader.ts` | Shared hydration hook for all editors: reads `:docId` param, fetches document, syncs context, handles not-found/invalid redirect, exposes `onReset`/`onSaved` for URL sync. |
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
| `src/components/SocialEditor.tsx` | **v2.2**: editor AI per generare 3 post social da card o flyer. **Phase 14**: rail `AIConsole` a destra, form config come children. |
| `src/components/BrandNameGenerator.tsx` | **v2.1**: generatore nome brand UX namelix-like (3-step chat: descrizione → mood → keyword → 5 nomi). **Phase 14**: visibile di default in onboarding. |
| `src/components/ai/AIConsole.tsx` | **Phase 14**: rail AI unificata (collapse in `pq_ui:v1`, `suggestedPrompt`+focus su doc vuoto, `hidePrompt`, quickActions, slot children, `AILogPanel` + `AIProviderBadge`). Bottom drawer su mobile (<768px). |
| `src/components/ai/AIProviderBadge.tsx` | **Phase 14** (REQ-AI-006): badge provider unico "DeepSeek · Gemini". |
| `src/components/ActionBar.tsx` | **Phase 13b** (REQ-UX-004/005): cluster azioni uniforme Salva/Esporta(menu)/Nuovo, fixed bottom-right desktop, sticky-bottom mobile. Usato da LogoEditor e QREditor. |
| `src/components/ai-ui/ai-ui.css` | **Phase 13b** (REQ-UX-003): stili kit ai-ui (solo `.ai-generate-btn` primary extrabold, chip/quick card ghost). Importato dal barrel `ai-ui/index.ts`. |
| `src/utils/uiPrefs.ts` | **Phase 13b/14**: `pq_ui:v1` (`sidebarCollapsed`, `aiConsoleExpanded` per editor). |
| `src/utils/fontLoader.ts` | **Phase 13b** (REQ-DS-005): lazy load famiglie font picker documento (iniettate al primo `AiFontPicker`). Inter/Outfit/JetBrains Mono statici in `index.html`. |
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
| `/app/editor/:docId` | `EditorPage` → `EditorView` (loads by ID) | login |
| `/app/collection` | `CollectionPage` → `CollectionView` | login |
| `/app/qr` | `QrPage` → `QREditor` (lazy) | login |
| `/app/qr/:docId` | `QrPage` → `QREditor` (loads by ID) | login |
| `/app/card` | `CardPage` → `CardEditor` (lazy) | login |
| `/app/card/:docId` | `CardPage` → `CardEditor` (loads by ID) | login |
| `/app/logo` | `LogoPage` → `LogoEditor` (lazy) | login (**Phase 4 + v2.1**) |
| `/app/logo/:docId` | `LogoPage` → `LogoEditor` (loads by ID) | login |
| `/app/flyer` | `FlyerPage` → `FlyerEditor` (lazy) | login |
| `/app/flyer/:docId` | `FlyerPage` → `FlyerEditor` (loads by ID) | login |
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
- **Componenti estratti** (REQ-B02): in `src/components/card/form/` (barrel `index.ts`): `CardFrontFields`, `CardMediaFields`, `CardBackFields`, `CardServicesFields`, `CardSocialsFields`, `CardQrAdvanced`, `CardStyleFields` (+ `CardGridControls.tsx` per lato/preset/frecce/resize). Condivisi desktop 3-col e tab mobile "Modifica" → zero duplicazione JSX. TB-023: `CardStyleFields` include anche la sezione **Decorazione** manuale (pattern + opacità, stessa `onPatchDecorations` della rail AI).
- **Rail AI card** (`src/components/card/ai/`, TB-023): sezioni in ordine `CardAIPhotoSection` (Foto AI) → `CardAIIconHeroSection` (Icona AI: modello immagine, sfondo bianco/colore card, prompt editor + libreria `cardIconPromptLibrary:v1`, auto-prompt dal ruolo) → `CardAICoverSection` (Sfondo AI, **collapsed di default**) → `CardAIQuickActions` → `CardAIPromptSection`. La sezione **Decorazione** è stata rimossa dalla rail AI e resta solo nel pannello manuale `CardStyleFields` (pattern + palette + opacità). Su mobile il bottom sheet mostra il badge provider (`AIProviderBadge`) in testa al pannello; su desktop il badge è nell'header `AIConsole`. Il menu provider si apre **verso il basso** (il pannello console ha `overflow-y:auto`: un menu verso l'alto viene clippato).
- **Toast feedback** (REQ-G01): mossa applicata → success. Blocco (collisione/bordo) → info. Cambio master switch → info. Errori AI → error.
- **Testo che va a capo** (REQ-F01): tutti i campi (nome, social, contatti, wordmark, handle-stamp) usano `overflow-wrap: break-word` invece di `ellipsis`.
- **`servicesLabel`** (REQ-F02): heading editabile sopra la lista servizi. `services: string[]` con auto-shrink classe per servizi ≥ 40 char (REQ-F03).
- **Export**: PDF 10-up (tipografia), PNG (raster), SVG (vettoriale), JSON (backup). All client-side via `pdfmake` + canvas pipeline.
- **`buildCardSvg`** è la pipeline: SVG → Image → canvas → PNG. `buildMinimalPng` fallback per jsdom.
- **v2.15 short-contacts collapse**: `effectiveBackGridForRender` in `src/utils/card/backLayout.ts` riduce la cella `contacts` da h:2 a h:1 e sposta `services`/`socials` su di una riga quando i contatti visibili sono ≤2 (phone, email, web senza QR, indirizzo, P.IVA). Evita il grande spazio vuoto sotto email/telefono che si vedeva in export. Se i contatti sono >2 la cella resta h:2 e i social rimangono al loro `y` persistito.
- **v2.15 QR label export parity**: la label sotto il QR in `svgRenderer.ts` usa `font-size = pxH * (9.6/340)` (stesso preview grid-mode 0.6rem). Prima era `min(qw,qh)*0.07` e usciva ~2× troppo grande. Lo spazio riservato sotto il QR è `pxH * (18/340)` (label + gap come preview).
- **v2.15 generic element placement**: `CardGridElement` ha un campo generico `placement: {x,y,scale}` (oltre al legacy `photoPlacement`). `CardGridControls` mostra frecce nudge + zoom per `photo` e `qr`. L'export applica lo stesso offset/scale a foto e QR (`svgRenderer.ts`), la preview via `gridPlacement()` + CSS `--card-photo-transform`.
- **⚠️ Preview/export mismatch noto (v2.15)**: la preview React e l'export SVG/PDF/PNG non sono ancora perfettamente identici. Differenze visibili:
  1. **Wrapping socials**: la preview usa CSS `overflow-wrap: break-word` e spezza i socials su più righe; l'export usa `wrapTextAtWhitespace` che, con separatori multipli tra piattaforme, può produrre una riga sola più larga.
  2. **Densità verticale**: il short-contacts collapse (h:2→h:1) funziona in export ma non sempre si riflette nella preview, lasciando più spazio vuoto sotto i contatti nella preview.
  3. **Font metrics**: i calcoli di baseline e line-height in export sono approssimati rispetto al browser, quindi allineamenti verticali sub-pixel possono differire.
  Questi mismatch vanno documentati qui finché non si risolvono con un unico layout engine condiviso preview/export.

## QR Code Module

- **7 tipi**: URL, text, email, phone, vCard, WiFi, SMS
- **Stili**: square, rounded, dots, via `qrcode` lib
- **Logo overlay**: base64 opzionale, max 20% area QR
- **Export**: SVG (vettoriale), PNG (raster)
- **Auto-save**: in collection come documento `qrCode`
- **Validazione**: contrasto fg/bg, PII check (WiFi password non loggata)

## Phase Status & Roadmap

Stato corrente delle fasi di sviluppo. Le spec implementate sono state
cancellate dopo verifica completa. Traccia storica in git history.

Spec attivi in `spec/`: `spec-design-flyer-refactor-preview-ai.md` (Phase 11,
solo gap test TB-007), `spec-api-saas-monetization.md` (NOT-STARTED,
track futuro), `spec-intake-pipeline.md` (TB-019, NOT-STARTED, intake
Google Form → Quickbrand, Architettura A ibrida). Gli spec implementati
sono stati cancellati dopo verifica (traccia in git history +
`doc/to-be-done.md`); anche `spec-design-ai-first-ux-redesign.md`
(Fasi 12-14) è stato cancellato il 2026-07-18 dopo completamento
(deviazioni documentate sotto, §13-14).

| Fase | Stato | Note |
|------|-------|------|
| 0, Auto-save fix | ✅ done | `processingRef`/`cooldownRef` in EditorView, toast merge. |
| 1, QR Code | ✅ done | 7 tipi, export SVG/PNG, migration DB `documents`. |
| 2, Business Card | ✅ done (2.2 refactor) | Master switch, init-from-layout, QR sizing, fontScale, servicesLabel, parity mobile, AI parity. |
| 3, Volantino | ✅ done | 4 layout (classic/centered/split/magazine) × 5 formati (A6/A5/A4/Letter/Square), bleed 3mm, AI copy via `POST /ai/copy-flyer` (10/min/IP). PDF+PNG export client-side. Tier watermark rispettato. |
| 4, Logo SVG Builder | ✅ done | v1 senza AI (Replicate deferred a v2/Pro). Tab "AI Generation" disabilitato con messaggio. |
| 5, Tier System | ✅ done | Watermark free, unlock code via admin, tier guard su save. |
| 6, Unified Collection | ✅ done | `documents` table rinominata, collection unificata. |
| 7, Polish | ✅ done | Onboarding step 5, HomePage "Perché noi", `preferredDocumentType` in DB. `LogoAiDocsPage` pubblica rimossa deliberatamente (docs ora private in `docs/logo-ai.md`). |
| 8, Quickbrand Rebrand | ✅ done | Rename + palette "The Classic" (Red & Ink), HomePage/LoginPage rebrand, test. |
| 9, Card Refactor Submodules | ✅ done | 11 utils + 9 components `src/utils/card/*` + `src/components/card/*`, barrel/shell pattern. |
| 10, Card Grid UX Alignment | ✅ done | alignH/alignV (9-pos), preset retro separato, e2e. |
| 11, Flyer Refactor Preview/AI | ⚠️ parziale | Architettura 12/12 utils + 11/11 components + 5/5 CSS. Gap: test matrix 4/10, `ai/flyer/budgets.ts` in `utils/flyer/budgets.ts` (deviazione equivalente). Spec mantenuta. |
| 12, AI Observability | ✅ done | `spec-design-ai-first-ux-redesign.md` §3.1: `useAILogs` condiviso, fix `trackUsage` (require→ESM), `IMAGE_TOKEN_COST`, `X-Request-Id` end-to-end (client→proxy→log server), log server JSON, rate limit ghost fix logs/tokens/aistream, persistenza `pq_ai_logs:v1`. Tutti i 6 hook AI migrati: `useAI`, `useAICard`, `useAIFlyer`, `useAILogo`, `useAISocial`, `useAIOnboarding`. |
| 13, Design System & UX | ✅ done | Token "The Classic" + ghost token definiti in `GlobalStyles` `:root` (light+dark), purge teal/blu chrome (test grep `designTokens.test.ts`), tipografia Outfit/Inter/JetBrains Mono, font picker lazy (`fontLoader.ts` + `AiFontPicker`), kit `ai-ui/ai-ui.css` (solo `.ai-generate-btn` primary), ToastProvider context, sidebar gruppi Crea/Archivio/Sistema + collapsed in `pq_ui:v1` (`uiPrefs.ts`), breakpoint canonici `BP_SHELL=768`/`BP_WORKSPACE=1024` in `useMediaQuery.ts`, `AILogPanel` prop `theme`, fix orfano QREditor.css, copy AI-first (Login/Onboarding/HomePage), unlock code `QB-` (PQ- legacy validi), HomePage AIDA + bento 6 strumenti + motion reveal, `ActionBar` (logo+QR). Deviazioni: valori token esistenti non rimappati (solo aggiunte/alias); breakpoint storici CSS migrati progressivamente (costanti per codice nuovo); card/flyer/quote mantengono i loro cluster azioni (ActionBar applicato a logo+QR). |
| 14, AI Console & AI-first | ✅ done | `AIConsole` rail (collapse persistito `pq_ui:v1` per `editorKind`, `suggestedPrompt`+focus su doc vuoto, `hidePrompt`, quickActions, `AIProviderBadge`). Migrati: social (rail + form children), flyer (col sx → rail dx, grid `"manual preview ai"`, `FlyerAiPanel bare`), card (col dx, `CardAIControls bare`, `showAi` rimosso), quote (ai-col dopo preview, sezioni condivise). Onboarding AI-first (BrandNameGenerator default, toggle "Preferisco scrivere io"). Deviazioni: **logo** mantiene tab Builder/AI top-level (chat 3-step + concept card non comprimibili in rail 320px) con tab default `ai` su logo vuoto; **QR** resta manuale (eccezione documentata); mobile card/flyer/quote mantengono bottom sheet/overlay esistenti. |
| 15, AI Harness Upgrade (TB-023) | ✅ done | Spec: `spec/spec-design-ai-harness-upgrade.md`. Completato: multi-provider (Ollama Pro + DeepSeek), badge provider con menu (apertura verso il basso, fix clipping), tracking costi (`totalCostUsd`/`lastCostUsd` in `useAILogs`, `AILogPanel`, `AIConsole`, `AIProviderBadge`, `CardAIControls`), 5 pattern decorativi SVG in preview+export, generic `placement {x,y,scale}` per qualsiasi elemento grid con controlli nudge+zoom per foto e QR, Icona AI card (modello+sfondo+prompt library), dev-proxy `/api/ai/chat(/stream)` + `/api/ai/image-flash`. v2.15: QR label export parity, short-contacts collapse. **Completati i 3 sotto-moduli rimasti**: (1) **A/B provider** via `resolveProviderId(modelId?, salt?)` con `aiABTestingEnabled` in `pq_ui:v1`; (2) **Vision feedback screenshot preview** con `useAIDesignReview` + `captureElementAsBase64` + endpoint `/api/ai/design-review` (MiniMax M3); (3) **RAG clienti** con tabella `client_kb` (pgvector `embedding VECTOR(768)`), migration `drizzle/20260721083508_chemical_solo`, endpoint REST `/api/clients` (GET/POST/PATCH/DELETE) con embedding via Ollama `nomic-embed-text` e fallback testo semplice. **Feedback post-TB-023 fixati**: costi visibili inline in `AILogPanel` (token/costo/immagine) e nei dettagli espansi (model/request), `lastCostUsd` reattivo via calcolo live sui log, flag `hasImage` e `modelId` per operazioni immagine, test `useAILogs`/`AILogPanel`, componente riutilizzabile `ClientRagPanel` in `src/components/rag/`, metodi `dataService.searchClients/createClient/updateClient/deleteClient`, rimossa occorrenza UTF8 problematica in `promptUtils.ts`. **v2.16 feedback**: screenshot preview allegato ai log e inviato al modello vision-enabled per card/quote/flyer/logo tramite `data-*-preview` + `captureElementAsBase64`; `useAILogs`/`AILogPanel` mostrano `imagePreviewBase64` nel dettaglio espanso; `useAI`/`useAICard`/`useAIFlyer`/`useAILogo` loggano `hasImage`/`imagePreviewBase64` e propagano `costUsd`/`modelId` nello stream finale; rimossa riga "Risposta AI ricevuta (vedi dettaglio sopra)" duplicata in modalità analisi. **Issue aperti**: vedi `docs/post-tb023-known-issues.md` (cover export, icona 512px, log preview). |

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
- **Icona/decorazioni auto-nascoste con background AI (v2.3.1)**:
  quando `builder.backgroundImage` è settato, `buildSvgForLayout`
  sopprime automaticamente il rendering di icona e
  `decorativeElements` (si sovrappongono male a una foto/illustrazione
  AI, es. icona lucide + dotRing sopra un'immagine con soggetti già
  disegnati). La matematica del layout (posizione iniziale del testo)
  resta invariata: lo spazio lasciato libero dall'icona va recuperato
  manualmente con `textOffsetX`.
- **Offset indipendente titolo/sottotitolo (v2.3.1)**: `taglineOffsetX`/
  `taglineOffsetY` (stesso range ±60 di `textOffsetX/Y`) muovono SOLO
  il sottotitolo; `textOffsetX/Y` muove SOLO il titolo (+ le
  decorazioni legate al titolo, es. underline). `BuilderPanel` mostra
  una seconda griglia di frecce "Posizione sottotitolo" (solo se
  `tagline` non è vuoto). Il backdrop leggibilità (`textBackdrop`) usa
  `unionTextBox()` per calcolare un riquadro che avvolge SEMPRE
  entrambi i blocchi, anche quando sono stati spostati in punti
  diversi del logo.
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
6. **`await import('../src/...')` non viene risolto in prod Vercel**.
   L'import dinamico di un modulo sotto `src/` da `api/index.ts`
   fallisce in produzione con `Cannot find module
   '/var/task/src/ai/providers/gemini'` (il bundler Vercel non include
   `src/` nei dynamic imports della funzione serverless, anche se
   AGENTS.md dice che `src/` è bundled correttamente per gli import
   **statici**). Sintomo: 404 `{"error":"Endpoint AI non trovato"}` o
   502 con quell'errore nel log. Fix: importare il pacchetto
   `@google/genai` **direttamente** in `api/index.ts` con
   `await import('@google/genai')` (node_modules è sempre bundled) e
   inlineare la logica del provider. Non usare `await import('../src/
   ...')` per moduli con dipendenze ESM-only in `api/index.ts`.
7. **Import statico di `@google/genai` crasha l'intera funzione**.
   `@google/genai` v2.10.0 è ESM-only (`"type": "module"` nel
   `package.json`). L'import **statico** in cima a `api/index.ts`
   (CJS/ESM interop) rompe il bundle Vercel: ogni endpoint sotto
   `/api/*` ritorna `FUNCTION_INVOCATION_FAILED` (anche `/api/ping`).
   Sintomo: 500 generico, nessun log utile. Fix: usare **solo** import
   dinamico `await import('@google/genai')` dentro l'handler della
   route specifica, mai import statico in cima al file.
8. **Prompt cover: metafore artistiche triggerano filtro copyright**.
   Gemini ha un filtro "copyright/recitation" che blocca la
   generazione con `400: Image generation blocked due to
   copyright/recitation`. Frasi come `"watercolor wash"`, `"drifts
   between"`, `"like diffuse ink on wet paper"` (presenti nel prompt
   v2.5.1/v2.7) lo triggerano. Fix: prompt **neutro e piano** (v2.8):
   `"Abstract gradient background using #fff as primary, #01696f as
   secondary... Smooth blending between the colors, soft and calm."`.
   Le proibizioni card-like (`no text, no QR, no logos, no faces, no
   people, no real objects`) sono OK; le metafore artistiche no.
   **v3.0**: prompt riscritto con la formula Nano-Banana (skill
   `muapi-nano-banana`): Subject + Action + Context + Composition +
   Lighting + Style, frasi complete, Negative Constraint Logic
   ("Ensure the background remains free of...") invece di liste "no X"
   che Gemini a volte interpretava come richiesta di disegnare X.
9. **Cache bundle JS browser dopo fix API**. Se un fix di `api/index.ts`
   cambia il path o il body di un endpoint, il vecchio bundle JS nel
   browser può ancora chiamare l'endpoint vecchio. `Ctrl+F5` non
   sempre basta: il Service Worker o la cache HTTP possono servire il
   vecchio `index-*.js`. Fix: DevTools → Application → Clear storage →
   Clear site data, oppure navigare in incognito per testare.
10. **`coverImageUrl` (base64 cover AI) non deve mai raggiungere
    DeepSeek**. Quando l'utente genera una cover AI (Gemini) e poi
    usa il testo AI (DeepSeek) per modificare la card, il base64 della
    cover (150KB+) era incluso nel contesto inviato a DeepSeek.
    DeepSeek lo riproduceva nella risposta JSON, rompendo la
    validazione Zod (`error:invalid_card`, "formato non valido"). Fix:
    `buildCardAIContext` (`src/ai/prompts/cardContext.ts`) strippa
    `coverImageUrl` dal payload insieme a `photoUrl` e `logoUrl`.
11. **Context limit disallineato validatore vs builder**. Il
    validatore Zod in `api/index.ts` (`context: z.string().max(N)`)
    e `MAX_CONTEXT_LEN` in `coverBrief.ts` devono essere uguali.
    Disallineamento (1000 vs 1200) causava `400 Invalid body` con
    card reali (grid + snapshot JSON superavano 1000). Fix: entrambi
    a 2000. Verificare SEMPRE che i due limiti coincidano dopo
    modifiche a `buildCoverContext`.
12. **`LogoAiPanel`: il background AI generato per i concept in preview
    si perdeva cambiando tab AI → Builder → AI (bug già presente in
    prod prima di essere scoperto/fixato, non una regressione di uno
    sviluppo recente)**. Costoso da riprodurre: ogni rigenerazione
    consuma una chiamata Gemini a pagamento. Tre cause distinte, tutte
    in `LogoAiPanel.tsx` (due delle quali sullo stesso effect di
    persistenza, scoperte in due passate successive):
    - **`bgImages` mancante dal dependency array dell'effect di
      persistenza** (`useEffect(..., [answers, step, concepts,
      selected])`). Il primo persist scatta quando `concepts` cambia
      (subito dopo la generazione DeepSeek), catturando
      `bgImages = [null, null, null]`. Gli aggiornamenti successivi di
      `bgImages` (quando arrivano le immagini Gemini, con
      `Promise.allSettled` su 3 chiamate parallele) **non ritriggerano
      il persist** perché `bgImages` non è nelle dipendenze. Al
      remount (cambio tab: `LogoEditor` smonta `LogoAiPanel` quando
      `tab !== 'ai'`), il componente ricarica lo snapshot vecchio senza
      immagini. Fix: aggiungere `bgImages` alle dipendenze.
    - **Race condition sul debounce di persistenza (500ms), causa
      residua dopo il fix precedente**. Anche con `bgImages` nelle
      dipendenze, la cleanup dell'effect faceva solo `clearTimeout`. Se
      l'utente cambiava tab ENTRO i 500ms dall'arrivo dell'immagine
      (scenario comune con test rapidi in locale, meno probabile in
      produzione dove la latenza naturale di rete/interazione supera
      spesso i 500ms — questo spiegava la percezione "in prod
      funziona, in locale no"), lo unmount cancellava il timer
      **prima** che scrivesse in localStorage, perdendo comunque
      l'immagine. Fix: `latestStateRef` (un `useRef`) tiene sempre
      l'ultimo stato via un effect senza dipendenze (rieseguito ad
      ogni render); un secondo effect con `useEffect(() => () => {...},
      [])` flusha `latestStateRef.current` in localStorage nella
      cleanup, che scatta SOLO alla vera unmount — garantendo lo
      salvataggio indipendentemente dal timer di debounce.
    - **Spinner condiviso su tutti i 3 concept durante rigenerazione
      singola**. `bgLoading` nella `ConceptCard` usava solo
      `isGeneratingBg` (bool unico dell'hook `useAILogo`, true per
      QUALSIASI chiamata `generateBackground` in corso, sia la
      generazione iniziale parallela sia la rigenerazione di un solo
      concept via "Prompt avanzato" → "Rigenera immagine"). Risultato:
      rigenerando il concept 1, anche i concept 2 e 3 (senza bg pronto)
      mostravano lo spinner. Fix: `bgLoading = regeneratingIdx === i ||
      (isGeneratingBg && regeneratingIdx === null && !bgImages[i] &&
      !bgErrors[i])` — lo spinner globale (generazione iniziale, tutti
      e 3 in parallelo) resta quando `regeneratingIdx` è `null`; la
      rigenerazione di un solo concept mostra lo spinner SOLO su quella
      card tramite `regeneratingIdx === i`.
    - **`SaveDialog` non si chiudeva dopo un salvataggio riuscito** in
      `LogoEditor.tsx`: `handleSave` faceva `addToast('success', ...)`
      ma non chiamava mai `setShowSaveDialog(false)`. Fix: chiudere il
      dialog subito dopo il toast di successo.
    - **Causa radice definitiva: `localStorage` non è il posto giusto
      per immagini base64, il fix "aggiungi `bgImages` alle
      dipendenze" sopra era solo un cerotto**. Con `bgImages` nelle
      dipendenze, OGNI generazione/rigenerazione scrive su
      `localStorage` un payload con fino a 3 immagini base64 (centinaia
      di KB l'una). `localStorage` ha una quota di 5-10MB/origin
      condivisa con `precisionQuote_documents:v1` (altri documenti
      salvati, anch'essi con immagini). Risultato reale osservato in
      produzione: `Failed to execute 'setItem' on 'Storage': Setting
      the value of 'logoAiChat:v1' exceeded the quota` **non
      catturato**, che crasha l'intera app (schermata "Qualcosa è
      andato storto"). La cleanup di `useEffect(() => () => {...},
      [])` (flush-on-unmount) gira SINCRONAMENTE dentro il commit React
      quando l'utente cambia tab: un errore lì propaga fino
      all'`ErrorBoundary` più vicino, mentre lo stesso errore dentro il
      `setTimeout` del debounce (asincrono, fuori dal ciclo di vita
      React) sarebbe finito solo in console senza crashare la UI — per
      questo il crash reale si manifestava proprio AL CAMBIO TAB, non
      durante l'attesa del debounce.
      **Fix definitivo (due parti)**:
      (a) **Stato sollevato al genitore**: `LogoAiPanel` accetta ora
      `initialState`/`onStateChange` (tipo esportato `LogoAiState`).
      `LogoEditor` tiene `aiStateRef = useRef<LogoAiState|undefined>()`
      e passa `initialState={aiStateRef.current}` +
      `onStateChange={(s) => { aiStateRef.current = s; }}`. Un
      `useRef` nel genitore (che NON si smonta mai cambiando tab, a
      differenza di `LogoAiPanel`) sopravvive al ciclo
      smontaggio/rimontaggio senza passare da `localStorage`: le
      immagini restano semplici riferimenti in memoria, nessun limite
      di quota, nessuna serializzazione. Questo è ora il meccanismo
      PRIMARIO anti-perdita-immagine al cambio tab.
      (b) **`localStorage` resta solo backup "best effort" per il
      refresh pagina (F5)**, ma va sempre protetto da try/catch:
      `safeLocalStorageSet()` non propaga mai un'eccezione; se il
      payload completo fallisce per quota, si ritenta SENZA `bgImages`
      (`payload.bgImages.map(() => null)`) così almeno testo/risposte/
      concept sopravvivono a un refresh — le immagini si perdono solo
      in quel caso limite (refresh completo, non cambio tab), mai per
      un errore non gestito.
      **Regola generale**: qualunque dato che può contenere immagini
      base64 (screenshot, background AI, cover, hero) non deve MAI
      essere l'unica fonte di persistenza in-sessione tramite
      `localStorage` — usare stato sollevato al componente genitore
      stabile (`useRef` o `useState` con lazy init) come fonte
      primaria, e trattare `localStorage` come cache opzionale sempre
      avvolta in try/catch.
    Regression test: `LogoAiPanel.test.tsx` → describe "persistenza
    bgImages su cambio tab" (simula unmount/remount e unmount immediato
    prima dei 500ms di debounce) e "spinner durante generazione
    background" → "shows spinner ONLY on the concept being
    regenerated". `LogoEditor.test.tsx` → "keeps a generated
    (not-yet-applied) concept preview background across AI -> Builder
    -> AI tab switches" (verifica lo stato sollevato via `aiStateRef`)
    e "does not throw when switching tabs while localStorage.setItem
    throws QuotaExceededError" (verifica che il cambio tab, che
    scatena la cleanup sincrona, non propaghi mai l'eccezione di
    quota). Tutti verificati manualmente disattivando i rispettivi fix:
    senza di essi i test falliscono (non falsi positivi).

### ⚠️ Cover AI Card gotchas (leggi prima di toccare `coverBrief.ts` o `/ai/card-cover`)

Il modulo cover AI (`POST /ai/card-cover` + `useAICard.generateCover` +
`buildCardCoverBrief`) ha 3 bug distinti che hanno bloccato la
generazione in produzione. Leggere prima di rimettere mano.

1. **Endpoint non trovato in prod (404 "Endpoint AI non trovato")**:
   causa = punto 6 sopra (import dinamico `../src/` non risolto).
   Sintomo: in locale funziona (proxy Vite usa `ssrLoadModule`), in
   prod 404. Fix: `await import('@google/genai')` inline in
   `api/index.ts`.
2. **FUNCTION_INVOCATION_FAILED su ogni endpoint `/api/*`**: causa =
   punto 7 sopra (import statico `@google/genai` in cima al file).
   Sintomo: anche `/api/ping` crasha. Fix: rimuovere l'import
   statico, usare solo import dinamico nell'handler.
3. **400 "Image generation blocked due to copyright/recitation"**:
   causa = punto 8 sopra (prompt con metafore artistiche). Fix:
   prompt neutro v2.8 (`coverBrief.ts`).

## Known Issues, Card Module (fase 2)

Tutti i bug bloccanti sono chiusi in fase 2.2. Restano aperti 3
item di scope minore:

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

### Card layout/event harness (new, 2026-07)

- **Harness unificato**: tutti gli e2e card usano `e2e/helpers/cardHarness.ts`
  per login, fill, grid, export, parse SVG (non duplicare più helper).
- **Event logging**: `src/utils/card/layoutEvents.ts` + shell wiring;
  in test mode / `localStorage['pq_card_layout_debug']='1'` è disponibile
  `window.__cardLayoutEvents`. Usato dai test e2e per verificare move ok,
  collision blocked, export start/success.
- **Layout audit**: `src/utils/card/layoutAudit.ts` controlla ratio font
  contatti/socials, overlap label/valore, posizione QR, logo troppo piccolo
  e testi mancanti. Usata in unit test e e2e.
- **WYSIWYG test command**: `npx playwright test e2e/card-export-inspection.spec.ts
  e2e/card-wysiwyg-visual.spec.ts e2e/card-grid-export-roundtrip.spec.ts
  e2e/card-grid-behavior.spec.ts e2e/card-layout-audit.spec.ts
  e2e/card-grid-behavior-audit.spec.ts`.

Card module: ~140+ test across `__tests__/` (grid collision, master
switch, fontScale, AI parity).

### ⚠️ Card export SVG gotchas (leggi prima di toccare `svgRenderer.ts` `buildBackSvg`)

Bug di rendering del retro card nell'export PDF/PNG/SVG vs preview
React. L'utente vedeva telefono/email "sminchiati" (label e valore non
allineati, testo galleggiante). Tre cause distinte:

1. **`dominant-baseline` per contatti deve essere `alphabetic`, non
   `text-before-edge`**. La preview React usa `.card-back-line {
   align-items: baseline }` (flexbox): label e valore di font-size
   diverso si allineano sulla stessa baseline alfabetica. Se l'SVG usa
   `text-before-edge` su entrambi, il valore più grande ha la baseline
   più bassa e i due testi si "sminchiano" verticalmente (label
   galleggiante sopra il valore). Fix: `dominant-baseline="alphabetic"`
   su label e valore, con `y` = baseline condivisa calcolata come
   `cy + valAscent + pad*0.25` (`valAscent ≈ valSize * 0.8`). Gli altri
   `<text>` del retro (header eyebrow, services, socials, QR label)
   restano `text-before-edge`: sono righe singole, non coppie
   label/valore, e il top-alignment va bene. **Non** cambiare tutto il
   file a `alphabetic`: romperesti services/socials.
2. **`wrapTextAtWhitespace` non spezza email/URL senza spazi**. La
   funzione splitta solo su whitespace/slash. Email come
   `webdevcaglian@gmail.com` e phone come `35180008042` sono token
   unici senza separatori: restano su una riga e, se più larghi di
   `valueMaxW`, escono dalla cella (clip visivo nel PNG/PDF). La
   preview React usa `overflow-wrap: break-word` e spezza anche dentro
   la parola. Mitigazione attuale: il calcolo `colLabelWFor` e lo
   shrink-to-fit del font riducono la probabilità di overflow nella
   maggior parte dei casi reali. Se servisse wrapping within-word,
   aggiungere una funzione `breakLongToken(text, maxW, fontSize)` che
   splitta per chunk di `Math.floor(maxW / (fontSize*0.52))` char.
3. **`colLabelWFor` può rubare spazio al valore**. La formula
   `Math.max(cw*0.22, ks*6, pad*1.5)` per la larghezza colonna-label:
   con `keySize` 40px, `ks*6 = 240px` (troppo largo su cella 512px).
   La preview CSS dà alla label `flex: 0 0 auto` (larghezza content,
   ~50px per "TELEFONO" a 9px). Se il valore risulta troppo stretto
   (es. email troncata), ridurre `ks*6` a `ks*4` o calcolare la
   larghezza reale del testo label con `key.length * keySize * 0.6`.

Regression test: `svgRenderer.test.ts` → "contact label and value
share the same baseline (alphabetic, v2.9 regression)" verifica che
label `TELEFONO` e valore `35180008042` abbiano lo stesso attributo `y`
(baseline condivisa). Verificato manualmente disattivando il fix: senza
`alphabetic` le `y` divergono e il test fallisce.

### ⚠️ Preview/export parity v2.14 (leggi prima di toccare `svgRenderer.ts` o `previewHelpers.ts`)

Quattro bug distinti fixati insieme per allineare preview React e
export SVG/PNG/PDF. Violare queste regole reintroduce mismatch
visivi tra editor e file esportato.

1. **`gridPlacement` axis swap per celle text (`flex-direction: column`)**.
   `gridPlacement()` mappa `alignH→justifyContent` e `alignV→alignItems`.
   Corretto per celle row (foto/QR/logo), ma **swappato** per celle text
   che usano `flex-direction: column` (CSS `.card-grid-cell--text`).
   In column mode il main axis flex è **verticale**: `justifyContent`
   controlla la posizione verticale, `alignItems` l'orizzontale.
   Risultato prima del fix: `alignV='top'` non aveva effetto visibile
   sulle celle testo (mappava su `alignItems` = asse orizzontale),
   quindi il titolo restava centrato invece di andare in alto.
   Fix: parametro `flexDirection` in `gridPlacement()`. Quando
   `'column'`, swap: `justifyContent=vMap[alignV]`,
   `alignItems=hMap[alignH]`. CardPreview passa `'column'` per tutte
   le celle text (name/title/company/contacts/services/socials).
   **Non** rimuovere il parametro o dimenticare `'column'` per nuove
   celle text: il 3×3 verticale smetterebbe di funzionare.
2. **Font-size fronte: rem-based (proporzionale a pxH), non
   cell-relative**. L'export usava `cellH * 0.28` per il nome (77px
   a 1100px), mentre la preview usa `1rem=16px` su riferimento 340px
   → proporzionale `16/340*1100 = 52px`. L'export era ~50% troppo
   grande. Fix: `sizePct` cambiato da cell-relative a card-relative:
   - name: `16/340` (era `0.28` di cellH)
   - title: `12.48/340` (era `0.21` di cellH)
   - company: `11.52/340` (era `0.18` di cellH)
   `fontSize = fs(pxH * cfg.sizePct, fontScale)` (era `fs(h * ...)`).
   **Non** tornare a cell-relative: romperebbe la proporzionalità
   quando la griglia cambia dimensioni.
3. **Front export grid padding + cell gap**. La preview ha
   `.card-preview-side.grid-mode { padding: 16px; gap: 4px }`.
   L'export iniziava le celle a (0,0) full-card → foto/testo shiftati
   rispetto alla preview. Fix: `frontGridPad = pxH*(16/340)`,
   `frontCellGap = pxH*(4/340)`, celle offset via `cellX()`/`cellY()`
   helper. I font-size usano `cellPadX`/`cellPadY` separati (10/340
   orizzontale, 6/340 verticale) per il padding interno delle celle
   text (match CSS `padding: 6px 10px`).
4. **Back export font-size allineate ai rem grid-mode**. I valori
   flexbox (9.3/12.5/13/10) erano leggermente diversi dai rem grid-mode
   (9.6/11.52/13.6/11.2/10.88). Fix: tutti i base size nel back export
   ora usano i valori grid-mode della preview:
   - contacts key: `9.6/340` (era 9.3)
   - contacts val: `11.52/340` (era 12.5)
   - services: `13.6/340` (era 13)
   - servicesLabel: `11.2/340` (era 10)
   - socials: `10.88/340` (era 10)

Regression test:
- `previewHelpers.test.ts` → "column direction swaps
  justifyContent/alignItems for text cells" verifica che
  `gridPlacement(el, 'column')` swappi correttamente gli assi.
- `svgRenderer.test.ts` → describe "v2.14 preview/export parity"
  con 3 test: font-size fronte rem-based, grid padding offset,
  font-size retro grid-mode.
- `layoutAudit.ts` LOGO_TOO_SMALL threshold abbassato da 0.35 a 0.30
  per compensare lo shrink delle celle causato da padding+gap.

### ⚠️ Post-TB-023 known issues (leggi prima di toccare cover/icon/log)

Issue aperti dopo il completamento di TB-023 (AI Harness Upgrade).
Dettagli completi in `docs/post-tb023-known-issues.md`.

1. **`coverImageUrl` non risolto in PNG export**. `pngExport.ts` risolve
   `photoUrl`/`logoUrl` in base64 via `resolveToBase64DataUrl()` ma NON
   `coverImageUrl`. Se la cover è un URL esterno/blob URL (non data:),
   il canvas non riesce a caricarla (CORS) → cover mancante nel PNG.
   Fix: aggiungere `resolveToBase64DataUrl` per `coverImageUrl` come
   già fatto per `photoUrl`/`logoUrl`.
2. **Back cover wash opacity mismatch**. Preview React: `opacity: 0.35`.
   SVG export: `opacity="0.6"`. Differenza visibile su card retro
   con cover. Fix: allineare `svgRenderer.ts` a `0.35`.
3. **Icona AI 512px pixelata in export HD**. Gemini Flash riceve
   `size: '512'` → 512×512px. In export a 1700×1100 (300 DPI), una
   cella foto 2×2 può essere ~700px → upscaling da 512px = pixelazione.
   Fix: aumentare a `size: '1K'` (attenzione al clamp 500KB server).
4. **Log image preview persa al refresh**. `stripPreview()` in
   `useAILogs.ts` rimuove `imagePreviewBase64` prima di sessionStorage.
   Flag `hasImage` persiste come badge 🖼️ ma l'immagine è visibile
   solo nella sessione corrente. By design per evitare
   `QuotaExceededError`. Miglioramento futuro: salvare ultime N
   immagini a risoluzione ridotta, oppure usare IndexedDB.

## Responsive Patterns

- **`useMediaQuery(query)`**: hook React, ritorna `boolean`, listener su `change` event, cleanup su unmount, fallback SSR. **Phase 13b**: breakpoint canonici esportati `BP_SHELL=768`/`BP_WORKSPACE=1024` + `MQ_SHELL`/`MQ_WORKSPACE` + `useIsMobileShell()`/`useIsMobileWorkspace()` — codice nuovo DEVE usare questi (breakpoint storici CSS migrati progressivamente)
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
| `OLLAMA_API_KEY` | Vercel (Production+Preview) + .env (locale) | **TB-023**: Ollama Pro Cloud API key per `minimax-m3:cloud` (multimodale Text+Image, sostituto `gemini-3-flash-preview` ritirato 15 luglio 2026), `deepseek-v4-pro:cloud`, `qwen-3.5`. Piano $20/mo flat, 50x free usage, 3 modelli concorrenti, zero data retention. API `https://ollama.com/api/chat` (proxy server-side `/api/ai/chat` con `provider: 'ollama'`, mai key nel bundle) e `https://ollama.com/api/embeddings` per RAG clienti (`nomic-embed-text`). Senza la key, provider Ollama restituisce 503 "Configura OLLAMA_API_KEY" ma gli altri provider funzionano. |

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
- Log "a blocchi": gli hook AI emettono un aggiornamento dell'entry di stream ogni **≥80 caratteri** ricevuti (soglia a delta caratteri, NON temporale). Fase 12 (spec ai-first-ux-redesign) unificherà questo plumbing in `useAILogs`.

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
- Rate limiting in-memory: 5 login attempts / 15min per IP. Enforced (via `consumeRateLimit`): aichat 30/min, flyerCopy 10/min, onboarding 5/min, Gemini image endpoints 5-10/min. **Ghost (dichiarati ma NON enforced, fix in Fase 12)**: `/api/logs` 200/min, `/users/tokens` 30/min, `/ai/chat/stream` 30/min — usano `checkRateLimit` read-only senza `recordRateAttempt`.
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
- `pq_ai_logs:v1`, **Phase 12**: ring buffer AI log in **sessionStorage** (non localStorage), max 100 entry, detail ≤2KB, mai immagini base64
- `pq_ui:v1`, **Phase 13b/14**: preferenze UI (`uiPrefs.ts`): `sidebarCollapsed`, `aiConsoleExpanded` per editor (card/flyer/logo/social/editor)

## Testing

- Framework: Vitest + React Testing Library + jsdom
- Run single test: `npx vitest run path/to/file.test.ts`
- No test database needed, local tests use localStorage path
- Coverage attuale: ~2177 test su 185 file. Target: 60%.

## Logging

- **Server** (inline in `api/index.ts`): JSON strutturato in production tramite `console.error/info/etc`. Sostituisce tutti i `console.error` esistenti.
- **Client** (`src/utils/logger.ts`): usa `sendBeacon` (no blocking) per inviare eventi a `/api/logs` → Vercel logs.
- I client log in production: `debug` è droppato client-side; `info`/`warn`/`error` arrivano TUTTI al server via beacon (solo `warn`/`error` vanno anche in console browser). Nessun retry/coda sul beacon.

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

### Gotchas Dev / Localhost per AI

1. **Flyer copy AI in localhost richiede `VITE_DEEPSEEK_API_KEY` in `.env` (o `deepseekApiKey` in localStorage).**
   `src/hooks/useAIFlyer.ts` esegue un token-check per gli utenti normali. In precedenza il check non escludeva `localhost`, quindi un utente non-admin in dev veniva bloccato da `dataService.getUserProfile` (utente non trovato in `registeredUsers`). Fix: aggiungere `!isLocalhost()` al token-check, come già fatto per `useAICard`.

2. **Generazione cover card "entrambi i lati" NON deve essere parallela.**
   `CardEditorShell.handleGenerateCover('both')` chiamava `Promise.all([generateCover('front'), generateCover('back')])`. Due chiamate simultanee a Gemini tramite il dev proxy possono sovraccaricare l'upstream o il proxy stesso e restituire `502 Bad Gateway`. Fix: serializzare fronte → retro.

3. **Background AI del logo non deve essere sovrascritto a null quando si applica un concept senza immagine pronta.**
   I concept generati da DeepSeek in `logoOrchestrator.ts` hanno `backgroundImage: null` di default. `LogoAiPanel.applyConcept` li spreadava direttamente, sovrascrivendo il background pagato (Gemini) già applicato. Fix: escludere `backgroundImage` dal patch di default, e impostarlo solo se `bgImages[idx]` è effettivamente disponibile.

4. **`vite.config.js` deve ricaricarsi dopo modifiche.**
   Se vedi `404` o `502` su `/api/ai/card-cover`, `/api/ai/flyer-hero`, ecc. dopo aver modificato il dev proxy, riavvia il dev server (`npm run dev`). Vite non ricarica i middleware custom su hot-reload.

5. **`/api/ai/card-cover` in dev: il proxy truncava il `context` a 1000 char mentre `coverBrief.ts` e il server accettano 2000.**
   Disallineamento che poteva troncare silenziosamente il contesto con card complesse. Mantenere il limite del dev proxy allineato a quello del server (2000).

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

