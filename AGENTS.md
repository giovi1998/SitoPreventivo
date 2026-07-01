# AGENTS.md, PrecisionQuote

## Quick Commands

```bash
npm run dev          # Dev server: Vite + headroom proxy (best-effort) + caveman skill
npm run dev:app      # Solo Vite (senza headroom), fallback
npm run build        # Production build → dist/
npm run test         # Run tests (vitest)
npm run test:watch   # Watch mode
npm run typecheck    # tsc --noEmit
npm run db:generate  # Generate Drizzle migration
npm run db:migrate   # Apply migrations to Neon
npm run agent:setup  # Setup completo headroom: env + autostart + proxy + dashboard
```

## Token Optimization Stack

Ogni sessione opencode su questo progetto usa **due layer di compressione token** attivi di default. Non fanno parte dell'app: sono strumenti per lo sviluppatore che lavora con l'AI agent.

| Layer | Tool | Direzione | Modalità | Versione |
|-------|------|-----------|----------|----------|
| **Input** | [headroom](https://github.com/headroomlabs-ai/headroom) | prompt ↓ 60-95% | Proxy HTTP locale su `:8787` | v0.27.0 |
| **Output** | [caveman](https://github.com/juliusbrussee/caveman) | risposta ↓ ~65% | Skill in `.agents/skills/caveman/SKILL.md` (auto-load) | v1.9.0 |

### Setup (una tantum)

```bash
# Headroom (Python ≥ 3.10)
pip install "headroom-ai[all]"

# Caveman (Node ≥ 18)
npx skills add https://github.com/juliusbrussee/caveman --skill caveman
```

Dopo le installazioni una tantum, lo script `npm run agent` (vedi sotto) gestisce tutto: avvia il proxy se non è già attivo, lancia opencode con `OPENAI_BASE_URL` già puntato al proxy, lascia il proxy attivo tra le sessioni. Sorgente: `scripts/start-agent.mjs`.

### Uso quotidiano

```bash
# Un comando solo: avvia il proxy (se non attivo) + lancia opencode con OPENAI_BASE_URL già impostato
npm run agent

# Setup totale una tantum/riparazione: env Windows + autostart + restart proxy + dashboard
npm run agent:setup

# oppure, tenendo i due passi separati:
npm run agent:proxy    # avvia solo il proxy in background (persistente)
# ...poi lancia opencode a mano con OPENAI_BASE_URL=http://127.0.0.1:8787

npm run agent:status   # verifica stato del proxy + mostra URL dashboard
npm run agent:dashboard # apre la dashboard web (Tailwind/HTMX dark mode) nel browser
npm run agent:stop     # termina il proxy
```

### Autostart al logon Windows (headroom sempre attivo)

Il proxy, di default, persiste solo **tra sessioni opencode**. Per averlo
sempre attivo (anche dopo reboot, anche se non lanci opencode), installa
uno dei due:

```bash
npm run agent:autostart          # Task Scheduler (ONLOGON), richiede admin
npm run agent:autostart:startup  # script .bat in shell:startup, no admin, solo utente corrente
# Rimozione:
npm run agent:autostart:disable          # disinstalla task
npm run agent:autostart:startup:disable  # rimuove .bat
```

Log di avvio automatico: `~/.headroom-autostart.log`.

### Dashboard UI

La UI live è servita dal proxy stesso all'endpoint HTML
`http://127.0.0.1:8787/dashboard` (Tailwind + HTMX + Alpine.js, dark mode,
view Session/Historical, hero metrics: Proxy $ Saved / Token Savings % /
Output Reduction / Overhead, live feed, sparkline, theme toggle).
**Non** è un comando CLI (`headroom dashboard` non esiste in v0.27.0,
anche se il README lo menziona).

Il proxy è **persistente**: resta attivo anche dopo l'uscita di opencode, così sessions successive partono subito senza riavviarlo. Log del proxy in `.headroom.log` (gitignored).

Da quel momento headroom comprime ciò che tu **leggi** (tool output, file, log, RAG) prima che raggiunga l'LLM, e caveman comprime ciò che l'LLM **scrive** prima che torni a te.

> Il wrapper di opencode non è necessario: lo script `npm run agent` auto-rileva il binario `OpenCode.exe` dal path di installazione standard (`%LOCALAPPDATA%\Programs\@opencode-aidesktop\`). Override via `$env:OPENCODE_BIN = "C:\path\opencode.exe"`.

### Caveat opencode

`headroom wrap opencode` non esiste. I wrapper built-in di headroom sono: `claude`, `codex`, `copilot`, `aider`, `cursor`, `cline`, `continue`, `goose`, `openhands`, `openclaw`. Per opencode il workflow corretto è `headroom proxy` + env var `OPENAI_BASE_URL`.

### Caveman, regole di auto-clarity

La skill si **disattiva automaticamente** in questi casi (vedi `Auto-Clarity` in SKILL.md):
- warning di sicurezza
- conferme di azioni irreversibili
- sequenze multi-step dove l'ordine dei frammenti può generare ambiguità
- utente chiede chiarimento o ripete la domanda

Quindi: se una risposta è più verbosa del solito, è un caso coperto da auto-clarity. Non cercare di "forzare" lo stile terso in quei casi, la skill sa quando tacere.

### Metriche

```bash
headroom perf           # savings real-time del proxy (richiede proxy attivo)
# /caveman-stats         # lifetime token savings (se l'agent lo supporta)
```

### Riferimenti

- `headroom --help` / `headroom wrap --help`, wrapper elenco
- `.agents/skills/caveman/SKILL.md`, regole complete della skill caveman
- `skills-lock.json`, registro versionato delle skill installate (incluso `caveman`)
- `scripts/start-agent.mjs`, sorgente del wrapper `npm run agent*`

### Session Start Protocol (OBBLIGATORIO)

All'avvio di **ogni** session opencode su questo progetto, **prima** di accettare qualsiasi task (anche "fixa x" / "implmenta y"), esegui in ordine:

1. **Verifica lo stato del proxy**:
   ```bash
   node scripts/start-agent.mjs status
   ```
   - Exit 0 → proxy già attivo, salta al punto 3.
   - Exit 1 → proxy NON attivo, vai al punto 2.

2. **Avvia il proxy in background** (solo se il punto 1 ha dato exit 1):
   ```bash
   node scripts/start-agent.mjs proxy
   ```
   Il proxy è **persistente**, resta attivo anche dopo l'uscita di opencode, quindi questo step di solito è un no-op dalla seconda sessione in poi.

3. **Verifica che la sessione corrente sia instradata attraverso il proxy**:
   ```bash
   echo $env:OPENAI_BASE_URL   # PowerShell
   # echo $OPENAI_BASE_URL     # bash
   ```
   - Se ritorna `http://127.0.0.1:8787` → headroom attivo per questa sessione ✓. Procedi col task.
   - Se è vuoto o diverso → la sessione **NON** sta usando headroom. Avvisa subito l'utente con questo messaggio esatto (poi procedi comunque col task, non bloccare):
     > ⚠️ Sessione corrente non connessa a headroom (proxy attivo ma `OPENAI_BASE_URL` non settato al lancio). Per ridurre i token di input, la prossima volta lancia opencode con `npm run agent` invece di cliccare l'icona, avvia proxy + setta `OPENAI_BASE_URL` + lancia opencode in un solo comando. Il proxy è già attivo adesso, manca solo l'env var che va settata a processo avviato.

**Non skippare questo protocollo** neanche per task rapidi, è il modo per garantire che l'utente beneficia della compressione. Il check costa <1s. Il proxy è persistente quindi dopo il primo avvio è sempre ready.

**Perché non posso attivare headroom mid-session**: headroom è un proxy HTTP. opencode legge `OPENAI_BASE_URL` solo a processo avviato. Una sessione già in corso non può essere reindirizzata through il proxy, va rilanciata con l'env var corretta. Questo protocollo ensuring il proxy sia sempre up così la prossima sessione `npm run agent` parte subito.

## Token Optimization Stack

Ogni sessione opencode su questo progetto usa **due layer di compressione token** attivi di default. Non fanno parte dell'app: sono strumenti per lo sviluppatore che lavora con l'AI agent.

| Layer | Tool | Direzione | Modalità | Versione |
|-------|------|-----------|----------|----------|
| **Input** | [headroom](https://github.com/headroomlabs-ai/headroom) | prompt ↓ 60-95% | Proxy HTTP locale su `:8787` | v0.27.0 |
| **Output** | [caveman](https://github.com/juliusbrussee/caveman) | risposta ↓ ~65% | Skill in `.agents/skills/caveman/SKILL.md` (auto-load) | v1.9.0 |

### Setup (una tantum)

```bash
# Headroom (Python ≥ 3.10)
pip install "headroom-ai[all]"

# Caveman (Node ≥ 18)
npx skills add https://github.com/juliusbrussee/caveman --skill caveman
```

Dopo le installazioni una tantum, lo script `npm run agent` (vedi sotto) gestisce tutto: avvia il proxy se non è già attivo, lancia opencode con `OPENAI_BASE_URL` già puntato al proxy, lascia il proxy attivo tra le sessioni. Sorgente: `scripts/start-agent.mjs`.

### Profilo risparmio (agent-90)

Il proxy parte **sempre** con il profilo più aggressivo di headroom per ridurre al minimo il costo. Definito in `scripts/start-agent.mjs` `SAVINGS_PROFILE`:

- **`HEADROOM_MODE=token`** + **`HEADROOM_SAVINGS_PROFILE=agent-90`** → target 90% riduzione token in input
- **`HEADROOM_OUTPUT_SHAPER=1`** → taglia anche l'output del modello (5x più caro dell'input su Anthropic)
- **`HEADROOM_BUDGET=5.0`** + **`HEADROOM_BUDGET_PERIOD=daily`** → hard stop, niente più $120 in un giorno
- **`HEADROOM_FORCE_KOMPRESS=1`** + **`HEADROOM_ACCURACY_GUARD=strict`** → massima compressione, qualità protetta
- **`HEADROOM_COMPRESS_SYSTEM_MESSAGES=1`** + `USER=1` → comprime anche system prompt e messaggi utente
- **`HEADROOM_PROTECT_RECENT=2`** → protegge gli ultimi 2 turni dalla compressione (coerenza conversazione)

Override del budget: `HEADROOM_BUDGET_USD=10.0 npm run agent:proxy` (default 5.0).

### Caveman, regole di auto-clarity

La skill si **disattiva automaticamente** in questi casi (vedi `Auto-Clarity` in SKILL.md):
- warning di sicurezza
- conferme di azioni irreversibili
- sequenze multi-step dove l'ordine dei frammenti può generare ambiguità
- utente chiede chiarimento o ripete la domanda

Quindi: se una risposta è più verbosa del solito, è un caso coperto da auto-clarity. Non cercare di "forzare" lo stile terso in quei casi, la skill sa quando tacere.

### Metriche

```bash
headroom perf           # savings real-time del proxy (richiede proxy attivo)
# /caveman-stats         # lifetime token savings (se l'agent lo supporta)
```

### Riferimenti

- `headroom --help` / `headroom wrap --help`, wrapper elenco
- `.agents/skills/caveman/SKILL.md`, regole complete della skill caveman
- `skills-lock.json`, registro versionato delle skill installate (incluso `caveman`)
- `scripts/start-agent.mjs`, sorgente del wrapper `npm run agent*`

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
| `src/main.tsx` | React Router setup: `/login`, `/` (HomePage), `/app/*` (6 child routes), `*` (404) |
| `src/components/AppShell.tsx` | Global state shell (quote, AI, toasts, exports, theme), renders `<Outlet/>` |
| `src/components/AdminRoute.tsx` | Guard: `user.role === 'admin'` required, else `navigate('/app/editor')` |
| `src/hooks/useRouteView.ts` | Bridge hook: `pathname ↔ view` (editor\|collection\|qr\|card\|logo\|settings\|admin), `setView` calls `navigate()` |
| `src/pages/app/*` | Thin page wrappers (Editor/Collection/Qr/Card/Logo/Settings/Admin), read state from `AppContext` |
| `src/pages/LogoAiDocsPage.tsx` | **Phase 7**: public docs page explaining the disabled "AI Generation" tab. Lazy-loaded. |
| `api/index.ts` | Single Vercel serverless function, entire REST API (monolith, intentional) |
| `db/schema.ts` | Drizzle schema (users, documents, user_settings, unlock_codes) |
| `src/utils/dataService.js` | Data layer, routes to API or localStorage |
| `src/utils/logger.ts` | Client-side logger (sendBeacon → /api/logs) |
| `src/utils/generatePDF.ts` | PDF generation with pdfmake (preventivi) |
| `src/utils/cardGenerator.ts` | Card PDF/PNG/SVG export + `buildCardSvg` |
| `src/utils/qrGenerator.ts` | QR Code SVG/PNG generation (`qrcode` lib) |
| `src/utils/logoGenerator.ts` | **Phase 4**: SVG builder + sanitize + export PNG for logos |
| `src/utils/flyerGenerator.ts` | **Phase 3**: Flyer PDF/PNG export (4 layout × 5 formati, bleed 3mm, tier-aware watermark) |
| `src/utils/watermark.ts` | **Phase 5**: tier-aware watermark (free vs unlocked) for PDF/PNG/SVG export |
| `src/utils/documentSchemas.ts` | Zod schema: quote, QR, businessCard, cardGrid, logo, **flyer (Phase 3)**, presets |
| `src/utils/gridUtils.ts` | Grid collision helpers (BLOCK su sovrapposizione, edge bounds) |
| `src/components/CardEditor.tsx` | Editor bigliettini: 3-col desktop / tabs mobile, FAB AI, zoom |
| `src/components/CardPreview.tsx` | Anteprima card: flexbox + CSS Grid mode (grid-based rendering) |
| `src/components/QREditor.tsx` | Generatore QR Code (7 tipi, stili, logo overlay) |
| `src/components/LogoEditor.tsx` | **Phase 4**: Logo Builder (tabs Builder + AI, lucide picker, 3 export sizes) |
| `src/components/FlyerEditor.tsx` | **Phase 3**: Volantino editor (form, layout switcher, AI modal, 4 template settore, PDF+PNG export) |
| `src/hooks/useAICard.ts` | Hook AI card (streaming, token tracking, error recovery) |
| `src/hooks/useAIFlyer.ts` | **Phase 3**: Hook AI flyer (log, stream buffer, token tracking, generate + refine) |
| `src/hooks/useMediaQuery.ts` | Hook responsive (breakpoint detection via matchMedia) |
| `src/ai/cardOrchestrator.ts` | AI orchestrator card (no tools, JSON round-trip) |
| `src/ai/flyerOrchestrator.ts` | **Phase 3**: AI orchestrator volantino (no tools, JSON round-trip, session mgmt) |
| `src/ai/cardMerge.ts` | Merge risposta AI → card (grid, style, text, photo-preserv) |
| `vite.config.js` | Port 8000, SPA fallback for /app route |
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
| `/app/logo` | `LogoPage` → `LogoEditor` (lazy) | login (**Phase 4**) |
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

Stato corrente delle fasi di sviluppo (commit di riferimento: `126c9d1`).

| Fase | Stato | Spec | Note |
|------|-------|------|------|
| 0, Auto-save fix | ✅ done | `spec/spec-process-phase0-autosave-fix.md` |, |
| 1, QR Code | ✅ done | `spec/spec-tool-phase1-qr-code.md` |, |
| 2, Business Card | ✅ done (2.2 refactor) | `spec/spec-design-phase2-business-card.md`, `spec/spec-design-phase2-2-card-refactor.md` | Master switch, init-from-layout, QR sizing, fontScale, servicesLabel, parity mobile, AI parity. |
| 3, Volantino | ✅ done | `spec/spec-design-phase3-flyer.md` | 4 layout (classic/centered/split/magazine) × 5 formati (A6/A5/A4/Letter/Square), bleed 3mm, AI copy via `POST /ai/copy-flyer` (10/min/IP). PDF+PNG export client-side. Tier watermark rispettato. |
| 4, Logo SVG Builder | ✅ done | `spec/spec-tool-phase4-logo-builder.md` | v1 senza AI (Replicate deferred a v2/Pro). Tab "AI Generation" disabilitato con messaggio. |
| 5, Tier System | ✅ done | `spec/spec-data-phase5-tier-system.md` | Watermark free, unlock code via admin, tier guard su save. |
| 6, Unified Collection | ✅ done | `spec/spec-architecture-phase6-unified-collection.md` | `documents` table rinominata, collection unificata. |
| 7, Polish | ✅ done | `spec/spec-process-phase7-polish.md` | Onboarding step 5, HomePage "Perché noi", `LogoAiDocsPage` pubblica, `preferredDocumentType` in DB, docs aggiornate. |

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

## Logo Builder Module (fase 4, in progress)

- **SVG builder templated**, no AI nella v1. Tab "AI Generation"
  disabilitato con messaggio esplicito (placeholder per v2 con
  Replicate).
- **Icone**: libreria `lucide-react` ^0.395.0, allowlist 48 nomi
  pre-filtrati (food/tech/fashion/business). Validazione lato
  generatore (no injection).
- **4 template per settore**: tech, food, fashion, professionista.
- **3 layout**: horizontal, vertical, stacked.
- **Export**: SVG (Blob download), PNG 512/1024/2048 (canvas pipeline).
- **Sicurezza**: escape XML su `primaryText`/`tagline`, sanitize SVG
  via `DOMParser`+`XMLSerializer` prima di `dangerouslySetInnerHTML`,
  regex `#RRGGBB` per i colori.
- **Pattern riusati**: schema Zod in `documentSchemas.ts`, salvataggio
  via `dataService.saveDocument` con `documentType='logo'`, lazy-load
  componente in `App.tsx`.

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
| `DEEPSEEK_API_KEY` | Vercel (Production+Preview) | AI chat (server-side only) |
| `ADMIN_PASSWORD` | Vercel (Production+Preview) | Admin login (admin@gmail.com) |
| `VITE_ADMIN_PASSWORD` | .env (local only) | Admin login in dev |
| `ALLOWED_ORIGIN` | Vercel (Production+Preview) | CORS origin (es. `https://tuodominio.vercel.app`). Se vuoto accetta solo `*.vercel.app`. |
| `REPLICATE_API_TOKEN` | Vercel (opzionale, v2) | **Phase 4 / Phase 7**: token Replicate per generazione logo AI. **Non** letto nella v1 (tab "AI Generation" mostra messaggio e link a `/docs/logo-ai`). Da configurare in v2 con Vercel Pro per abilitare il flusso AI. |

**Never expose `DEEPSEEK_API_KEY` to the browser.** The frontend calls the serverless function proxy, which holds the key server-side.

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
- `web-security`, security review
- `writing-guidelines`, docs/prose style
- `test-driven-development` (obra/superpowers), disciplina TDD per Blocco 3+
- `frontend-design` (anthropics/skills), design opinionale per UI
- `caveman` ([juliusbrussee/caveman](https://github.com/juliusbrussee/caveman)), **compressione output** (stile terso, ~-65% token risposta). Sempre attiva, vedi sezione *Token Optimization Stack* sopra. Disattivazione solo con "normal mode" o in casi di auto-clarity.

**Skill on-demand** (caricare solo se il task lo richiede esplicitamente):
- `deploy-to-vercel`, solo quando l'utente chiede deploy
- `vercel-cli-with-tokens`, solo per setup CLI con token
- `vercel-optimize`, solo per audit costi/performance (richiede Vercel CLI autenticato)
- `git-guardrails-claude-code`, solo per setup hook

**Skill rimosse** (non usate da questo progetto):
- `vercel-react-native-skills`, non è un'app React Native
- `vercel-react-view-transitions`, non usiamo View Transitions API

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
| `.agents/skills/` | Installed agent skills (10 attive) |
| `.agents/guardrails/` | Git safety rules and block scripts |
| `api/index.ts` | Single Vercel serverless function, entire REST API (monolith) |
| `src/utils/` | Client-side utilities (logger, errors) |

