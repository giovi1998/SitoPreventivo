# AGENTS.md – Quickbrand

## Quick Commands

```bash
npm run dev          # Dev server: Vite (port 8000)
npm run build        # Production build → dist/
npm run test         # Run tests (vitest)
npm run test:watch   # Watch mode
npm run test:e2e     # Playwright
npm run typecheck    # tsc --noEmit
npm run db:generate  # Generate Drizzle migration
npm run db:migrate   # Apply migrations to Neon
```

## Output Style (caveman skill)

Compressione output attiva via skill `caveman` (`.agents/skills/caveman/SKILL.md`,
auto-load). Stile terso, ~-65% token. La skill si **disattiva automaticamente**
(auto-clarity) su: warning sicurezza, conferme azioni irreversibili, sequenze
multi-step ambigue, utente che chiede chiarimento. Non forzare lo stile terso
in quei casi.

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
- **Database**: Drizzle ORM → Neon Postgres
- **Storage split**: `localhost` = localStorage, production = API + Postgres.
  Detection automatica via `IS_LOCAL` in `src/utils/dataService.js`
- **Auth**: bcrypt + localStorage (dev) / Drizzle + Neon (prod). Admin:
  `admin@gmail.com` validato contro `ADMIN_PASSWORD` env var, mai salvato a DB.
- **Observability**: server logs via `console.*` in `api/index.ts` (JSON in
  prod). Client logs via `src/utils/logger.ts` + `/api/logs` (Vercel logs).
  Zero servizi esterni.
- **AI**: DeepSeek (testo, tutti gli orchestratori via proxy `/api/ai/chat`),
  Gemini Nano Banana (immagini: logo background, card cover/icon), Ollama Pro
  Cloud (`/api/ai/chat` con `provider: 'ollama'`). Chiavi solo server-side.

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
| `db/schema.ts` | Drizzle schema (users, documents, user_settings, unlock_codes) |
| `src/utils/dataService.js` | Data layer: API o localStorage |
| `src/utils/generatePDF.ts` | PDF preventivi (pdfmake, client-side) |
| `src/utils/cardGenerator.ts` | Card PDF/PNG/SVG + `buildCardSvg` |
| `src/utils/qrGenerator.ts` | QR SVG/PNG (`qrcode` lib) |
| `src/utils/logoGenerator.ts` | Logo SVG builder + sanitize + PNG, render `builder.backgroundImage` |
| `src/utils/flyer/` | Flyer engine: `layoutEngine`, `svgRenderer`, `textFit`, `geometry`, `budgets`, `templateCatalog/Factory`, `qrRenderer`, `pdf/pngExport` |
| `src/utils/watermark.ts` | Tier-aware watermark (free vs unlocked) |
| `src/utils/documentSchemas.ts` | Zod schemas: quote, QR, businessCard, cardGrid, logo, flyer, presets |
| `src/utils/gridUtils.ts` | Grid collision helpers (BLOCK su sovrapposizione) |
| `src/ai/BaseOrchestrator.ts` | Abstract condivisa (sanitize, parseJson, handleStream, trackUsage) |
| `src/ai/*Orchestrator.ts` | card / flyer / logo / social / onboarding |
| `src/ai/prompts/registry.ts` | promptRegistry: lookup centralizzato 7 prompt |
| `src/ai/providers/gemini.ts` | `GeminiImageProvider` (Nano Banana, SDK `@google/genai`) |
| `src/ai/cardMerge.ts` | Merge risposta AI → card (grid, style, photo-preserve) |
| `src/components/CardEditor.tsx` + `card/` | Editor card: shell, form/ (barrel), ai/ (rail), grid controls |
| `src/components/QREditor.tsx` | Generatore QR (7 tipi, stili, logo overlay) |
| `src/components/LogoEditor.tsx` + `LogoAiPanel.tsx` | Logo builder + AI namelix-like 3-step |
| `src/components/flyer/` | Flyer: `FlyerEditorShell` + pannelli AI/manuale/preview/export |
| `src/components/ai/AIConsole.tsx` | Rail AI unificata (collapse in `pq_ui:v1`, quickActions, `AILogPanel` + `AIProviderBadge`) |
| `src/components/ActionBar.tsx` | Cluster azioni Salva/Esporta/Nuovo (logo, QR) |
| `src/hooks/useAI*.ts` | Hook AI: useAI, useAICard, useAIFlyer, useAILogo, useAISocial, useAIOnboarding |
| `src/hooks/useMediaQuery.ts` | Breakpoint canonici `BP_SHELL=768`/`BP_WORKSPACE=1024` + hook mobile |
| `src/utils/uiPrefs.ts` | `pq_ui:v1` (sidebarCollapsed, aiConsoleExpanded per editor) |
| `vite.config.js` | Port 8000, SPA fallback, dev proxy `/api/ai/*`, `loadEnv()` esplicito |
| `vercel.json` | Build: `db:migrate && build`; rewrites (ordine critico) |
| `docs/agent-gotchas.md` | **Dettaglio completo gotchas + roadmap fasi** (leggere prima di toccare i moduli) |

## App Routes

| Path | Component | Guard |
|------|-----------|-------|
| `/login` | `LoginPage` | — |
| `/` | `HomePage` | — |
| `/app` → `/app/editor` | `EditorPage` → `EditorView` | login |
| `/app/collection` | `CollectionPage` → `CollectionView` | login |
| `/app/qr`, `/app/card`, `/app/logo`, `/app/flyer`, `/app/social` | Editor (lazy) | login |
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
  Preset: `gridPresetLeft/Centered/Split/BackDefault`.
- `cardMerge.ts`: clamp collisioni graduali, NON sovrascrive
  `photoUrl`/`logoUrl` (base64 user-uploaded).
- **Icona AI slot policy (CON-IS-001)**: l'icona generata va sempre in
  `photoUrl` (sostituisce foto), `logoUrl` mai toccato.
- **Vision gating (CON-MM-002)**: screenshot preview solo se
  `getAiVisionEnabled() && providerSupportsVision(modelId)`; con provider
  text-only la cattura è saltata del tutto.
- **Font scale** (0.7–1.5) via CSS var `--card-font-scale`, replicata in
  export via helper `fs()`. `SAFE_FONT_FAMILIES` per il selettore.
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
- **Mai persistere immagini base64 solo in localStorage**: fonte primaria =
  stato sollevato al genitore (`aiStateRef` in `LogoEditor`), localStorage
  solo backup try/catch. Vedi `docs/agent-gotchas.md` §2.12.

## ⚠️ Gotchas critici (sintesi — dettaglio in `docs/agent-gotchas.md`)

Leggere la sezione pertinente di `docs/agent-gotchas.md` PRIMA di toccare
il modulo corrispondente. Sintesi delle regole che non si possono violare:

**Vercel monolith (§1)**: mai splittare `api/index.ts` (ogni `.ts` in `api/`
conta come funzione; `api/_lib/` è escluso dal bundle → `ERR_MODULE_NOT_FOUND`).
Mai rimuovere le rewrite `/api/(.*) → /api` prima della catch-all SPA
(senza → 405 su ogni POST `/api/*`). Regression test:
`src/__tests__/vercelConfig.test.ts`.

**Gemini/`@google/genai` (§2-3)**: mai import statico in `api/index.ts`
(ESM-only → `FUNCTION_INVOCATION_FAILED` su TUTTI gli endpoint); solo
`await import('@google/genai')` dentro l'handler. Mai `await import('../src/...')`
in prod Vercel (non risolto). `response_modalities` minuscolo. Chiedere
`image_size: '512'` in richiesta (clamp server 500KB). Prompt neutri, no
metafore artistiche (filtro copyright/recitation). Path dev proxy = path
client char-per-char. `loadEnv()` esplicito in `vite.config.js`.

**localStorage + base64 (§2.12)**: nessun dato con immagini base64 deve
avere localStorage come unica persistenza → QuotaExceededError non gestito
= crash app. Stato sollevato al genitore + try/catch obbligatorio.

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
502); limiti `context` proxy = server (2000).

## Phase Status (sintesi — tabella completa in `docs/agent-gotchas.md` §10)

Fasi 0-10 (Phase 7 polish done; Volantino/Phase 3 done), 12-15 completate.
Phase 11 (flyer refactor/Volantino) parziale: gap test matrix. Spec attivi in
`spec/`: flyer refactor (TB-007),
`spec-api-saas-monetization.md`, `spec-intake-pipeline.md` (TB-019).
Issue aperti: `docs/post-tb023-known-issues.md`. Verifica TB-023:
`docs/tb023-verification.md`.

## Responsive Patterns

- Conditional render, NOT CSS hide (3-col desktop non nel DOM su mobile).
- `useMediaQuery` + `BP_SHELL`/`BP_WORKSPACE`: codice nuovo DEVE usarli.
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

**Mai esporre `DEEPSEEK_API_KEY`/`GEMINI_API_KEY`/`OLLAMA_API_KEY` al
browser.** Il frontend chiama solo il proxy serverless.

## PDF Generation, Client-Side Only

PDF/PNG generati interamente nel browser (pdfmake + canvas). Nessun upload
server. Free-tier friendly.

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

## Streaming AI

- Streaming per tutte le risposte AI (testo + tool). Dopo tool execution,
  seconda chiamata multi-turn per la sintesi finale; usage accumulato.
- Log "a blocchi": update entry stream ogni ≥80 caratteri (delta char,
  non temporale).

## Test, OBBLIGATORI

**Ogni modifica a `src/`, `api/`, `db/` DEVE avere test.**

1. Nuovo codice → nuovi test (happy path + 1 errore).
2. Codice modificato → test aggiornati. Nessun "test morto".
3. Bug fix → regression test che riproduce PRIMA del fix.
4. Refactor → test invariati ma verdi (se rompono, il refactor è sbagliato).
5. Coverage minima nuovi file: 60% (sotto soglia va motivata con commento).
6. Mai `.skip`/`xit` per far passare CI. Se flaky, fixalo.
7. Prima di proporre push: `npm run typecheck && npm run test` verdi.

Posizione test: componenti → `src/components/__tests__/`, hook →
`src/hooks/__tests__/`, utils → `src/utils/__tests__/`, API →
`api/__tests__/` (mock DB). Framework: Vitest + RTL + jsdom. Test singolo:
`npx vitest run path/to/file.test.ts`. ~200+ file di test.

**E2E AI logs (TB-023):** quando tocchi hook AI (`useAI*`) o `AILogPanel`,
mantieni `e2e/ai-log-preview.spec.ts` verde: verifica che le preview nei log
flyer/logo/quote non siano nere/CSS e che il brief testuale sia presente.
Per debug usa `e2e/debug-ai.spec.ts` (temporaneo, da rimuovere prima del push).

## Admin User

- Email: `admin@gmail.com`, mai in DB, password vs `ADMIN_PASSWORD`
  (constant-time compare). Token illimitati.
- Endpoint admin (`GET /users`, `GET /quotes/all`, `PATCH /users/limits`,
  `GET /users/cost-breakdown`) richiedono `adminEmail=admin@gmail.com`:
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

- `precisionQuote_documents:v1` — documenti unificati (preventivi, QR, card, logo)
- `precisionQuote_quotes` — legacy deprecata; `pq_migration_v1_done_<email>` flag
- `userSettings_<email>` — include `tier`, `documentCount`, `unlockCode`, `preferredDocumentType`
- `unlock_codes`, `registeredUsers`, `deepseekApiKey` — dev only
- `authToken`, `userEmail`, `username`, `userRole`, `dataRegistrazione` — sessione
- `pq_ai_logs:v1` — ring buffer AI log in **sessionStorage**, max 100, mai base64
- `pq_ui:v1` — preferenze UI (`uiPrefs.ts`)
- `logoAiChat:v1` — backup best-effort chat logo AI (TTL 24h, try/catch, senza bgImages se quota)
- `cardIconPromptLibrary:v1`, `logoPromptLibrary:v1` — librerie prompt

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

## Active Skills

Skill auto-caricate — quando tocchi il codice riferito, **leggi prima la
skill** (`.agents/skills/<name>/SKILL.md`):

- `vercel-react-best-practices` — performance React (sempre)
- `vercel-composition-patterns` — component design
- `web-design-guidelines` — review UI/accessibilità
- `writing-guidelines` — docs/prose style
- `caveman` — compressione output (sempre)
- `ai-prompt-engineering` — quando tocchi `src/ai/prompts/*` o `*Orchestrator.ts`
- `vercel-serverless-monolith` — quando tocchi `api/index.ts` o `api/`
- `pdf-client-side` — quando tocchi `*Generator.ts` o `watermark.ts`

On-demand (solo se il task lo richiede): `deploy-to-vercel`,
`vercel-cli-with-tokens`, `vercel-optimize`, `gpt-taste` /
`design-taste-frontend` / `high-end-visual-design` (design UI premium),
`muapi-nano-banana` (prompt `imagePrompt` AI), `imagegen-frontend-*`,
`redesign-existing-projects`, `brandkit`, `image-to-code`, ecc.

Le skill sono **solo per l'agente di coding**, non per l'app: l'app usa
DeepSeek/Gemini/Ollama via proxy server-side.
