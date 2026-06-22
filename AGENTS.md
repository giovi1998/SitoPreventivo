# AGENTS.md — PrecisionQuote

## Quick Commands

```bash
npm run dev          # Dev server on localhost:8000
npm run build        # Production build → dist/
npm run test         # Run tests (vitest)
npm run test:watch   # Watch mode
npm run typecheck    # tsc --noEmit
npm run db:generate  # Generate Drizzle migration
npm run db:migrate   # Apply migrations to Neon
```

## Pre-push Checklist

Prima di consigliare un push, esegui e conferma tutto verde:

```bash
npm run typecheck
npm run test
```

Se uno dei due fallisce, **non** proporre il push. Risolvi prima.

## Architecture

- **Frontend**: React 18 + Vite + React Router v6
- **Backend**: Single Vercel Serverless Function (`api/index.ts`) — monolithic, all routes in one file (intentional pattern, see Vercel routing below)
- **Database**: Drizzle ORM → Neon Postgres
- **Storage split**: `localhost` = localStorage, production = API + Postgres. Detection is automatic via `IS_LOCAL` in `src/utils/dataService.js`
- **Auth**: bcrypt + localStorage (dev) / Drizzle + Neon (prod). Admin: `admin@gmail.com` validated against `ADMIN_PASSWORD` env var, never saved to DB.
- **Observability**: Server logs via `console.*` in `api/index.ts` (JSON in prod tramite wrapper). Client logs via `src/utils/logger.ts` + `/api/logs` endpoint (Vercel logs). Zero external services.

## Key Files

| File | Role |
|------|------|
| `App.tsx` (root, not src/) | Thin re-export of `AppShell` (default) + `AuthProvider`/`AuthContext` (named) |
| `src/main.tsx` | React Router setup: `/login`, `/` (HomePage), `/app/*` (6 child routes), `*` (404) |
| `src/components/AppShell.tsx` | Global state shell (quote, AI, toasts, exports, theme) — renders `<Outlet/>` |
| `src/components/AdminRoute.tsx` | Guard: `user.role === 'admin'` required, else `navigate('/app/editor')` |
| `src/hooks/useRouteView.ts` | Bridge hook: `pathname ↔ view` (editor\|collection\|qr\|card\|settings\|admin), `setView` calls `navigate()` |
| `src/pages/app/*` | Thin page wrappers (Editor/Collection/Qr/Card/Settings/Admin) — read state from `AppContext` |
| `api/index.ts` | Single Vercel serverless function — entire REST API (monolith, intentional) |
| `db/schema.ts` | Drizzle schema (users, quotes, user_settings) |
| `src/utils/dataService.js` | Data layer — routes to API or localStorage |
| `src/utils/logger.ts` | Client-side logger (sendBeacon → /api/logs) |
| `src/utils/generatePDF.ts` | PDF generation with pdfmake (preventivi) |
| `src/utils/cardGenerator.ts` | Card PDF/PNG/SVG export + `buildCardSvg` |
| `src/utils/qrGenerator.ts` | QR Code SVG/PNG generation (`qrcode` lib) |
| `src/utils/documentSchemas.ts` | Zod schema: quote, QR, businessCard, cardGrid + presets |
| `src/components/CardEditor.tsx` | Editor bigliettini: 3-col desktop / tabs mobile, FAB AI, zoom |
| `src/components/CardPreview.tsx` | Anteprima card: flexbox + CSS Grid mode (grid-based rendering) |
| `src/components/QREditor.tsx` | Generatore QR Code (7 tipi, stili, logo overlay) |
| `src/hooks/useAICard.ts` | Hook AI card (streaming, token tracking, error recovery) |
| `src/hooks/useMediaQuery.ts` | Hook responsive (breakpoint detection via matchMedia) |
| `src/ai/cardOrchestrator.ts` | AI orchestrator card (no tools, JSON round-trip) |
| `src/ai/cardMerge.ts` | Merge risposta AI → card (grid, style, text, photo-preserv) |
| `vite.config.js` | Port 8000, SPA fallback for /app route |
| `vercel.json` | Build runs `db:migrate` before `build` |

## App Routes

Real URL-based multipage (no more `useState('view')`). State lives in `AppShell`; child pages read from `AppContext`.

| Path | Component | Guard |
|------|-----------|-------|
| `/login` | `LoginPage` | — |
| `/` | `HomePage` | — |
| `/app` → `/app/editor` (redirect) | `EditorPage` → `EditorView` | login |
| `/app/collection` | `CollectionPage` → `CollectionView` | login |
| `/app/qr` | `QrPage` → `QREditor` (lazy) | login |
| `/app/card` | `CardPage` → `CardEditor` (lazy) | login |
| `/app/settings` | `SettingsRoute` → `SettingsPage` | login |
| `/app/admin` | `AdminPage` → `AdminDashboard` (lazy) | `user.role==='admin'` (via `AdminRoute`) |
| `*` | `NotFoundPage` | — |

- `Layout`/`Topbar` still receive `view: string` (back-compat with existing tests).
- `CollectionView.openQuote()` calls `setView('editor')` from `AppContext` → `navigate('/app/editor')`.
- All `/app/*` child routes are served by the SPA catch-all in `vercel.json`; no extra rewrites needed.

## Business Card Module

- **AI = Option B (dedicated module)**, not generic refactor — zero risk to quote AI
- **No new API endpoints** — reuses `providerRegistry` DeepSeek, same `/api/ai/chat`
- **Card AI has NO tools** (no prices/discounts) — simpler than quote AI
- **Grid-based rendering**: `CardPreview` renders via CSS Grid when `card.grid` is set. Each element (photo, name, title, company, qr, contacts, socials) gets `gridColumn`/`gridRow` based on `grid.elements[key]`. Moving an element in the grid **visually moves it** in the preview.
- **`cardMerge.ts`** handles grid merging: never overwrites `photoUrl`/`logoUrl` (base64 user-uploaded)
- **Grid presets**: `gridPresetLeft()`, `gridPresetCentered()`, `gridPresetSplit()` in `documentSchemas.ts`
- **Export**: PDF 10-up (tipografia), PNG (raster), SVG (vettoriale), JSON (backup). All client-side via `pdfmake` + canvas pipeline.
- **`buildCardSvg`** is the rendering pipeline: SVG → Image → canvas → PNG. `buildMinimalPng` fallback for jsdom.

## QR Code Module

- **7 tipi**: URL, text, email, phone, vCard, WiFi, SMS
- **Stili**: square, rounded, dots — via `qrcode` lib
- **Logo overlay**: base64 opzionale, max 20% area QR
- **Export**: SVG (vettoriale), PNG (raster)
- **Auto-save**: in collection come documento `qrCode`
- **Validazione**: contrasto fg/bg, PII check (WiFi password non loggata)

## Responsive Patterns

- **`useMediaQuery(query)`**: hook React, ritorna `boolean`, listener su `change` event, cleanup su unmount, fallback SSR
- **Conditional render, NOT CSS hide**: il 3-col desktop NON è nel DOM quando mobile (evita duplicati)
- **Tab system** (`CardEditorTabs`): 3 tab (Anteprima, Modifica, AI) su mobile (<900px)
- **FAB AI** (`CardAIFab`): bottone floating 56px, sempre visibile in mobile, badge con log count
- **Bottom sheet** (`CardAIBottomSheet`): drawer dal basso 85vh, ESC + backdrop chiudono, `role=dialog`
- **`useCardAIFloating`**: Context provider con stato `isOpen`/`hasUnread`, azioni `open`/`close`/`toggle`/`pushLog`
- **Zoom preview** (`useCardPreviewZoom`): range 50-150%, step 10%, default 70% mobile / 100% desktop
- **Mobile grid editor** (`MobileGridEditor`): select elemento + popup frecce 3×3 (non drag-and-drop, più accessibile)
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

**Never expose `DEEPSEEK_API_KEY` to the browser.** The frontend calls the serverless function proxy, which holds the key server-side.

### PDF Generation — Client-Side Only

PDF generation happens entirely in the browser via `pdfmake` (in `src/utils/generatePDF.ts`). No server upload, no Vercel Blob, no `BLOB_READ_WRITE_TOKEN` needed. This keeps the app free-tier friendly.

- `App.tsx` `exportPDF()` → download locale

## API Schema Duplication

`api/index.ts` inlines the Drizzle schema for Vercel compatibility. If you modify `db/schema.ts`, you must also update the corresponding tables in `api/index.ts` (lines 9-52).

## Vercel Routing — CRITICAL

`api/index.ts` is the **only** Vercel serverless function. It handles every `/api/*` request via internal routing. This is a deliberate monolith (see "Lessons learned" below).

**DO NOT**:
- Split `api/index.ts` into multiple files. Vercel's `_` prefix (`api/_lib/`, `api/_routes/`) is **NOT** the shared-code trick it appears to be — files starting with `_` are excluded from **both** the serverless-function count AND the function bundle, so any function in `api/` that imports from `api/_*/...` crashes at runtime with `ERR_MODULE_NOT_FOUND` ("Cannot find module '/var/task/api/_lib/handler'"). This was the bug from commit `036ae25` that broke production for hours.
- Add other `.ts` files directly in `api/`. Each one counts toward the Hobby plan's 12-function limit.
- Use `vercel.json` `functions.includeFiles` to copy `*.ts` from outside `api/`. Vercel copies the files as static assets but does not transpile them, so Node ESM still can't resolve them.
- Use `vercel.json` rewrites to split the API into multiple functions. With the monolith, no `/api/*` rewrites are needed — the single `api/index.ts` handles everything.

**DO**:
- Keep all server-side logic inline in `api/index.ts`. The file is intentionally large (~750 lines). Modularity is achieved through internal `handleXxx` functions and helper utilities defined at the top of the file.
- If you need to share types or pure functions with the client, put them in `src/` and have `api/index.ts` import from there. The `src/` directory is bundled correctly.

## Lessons learned — Vercel function bundling (read before splitting)

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

The order is **critical**: `/api/(.*) -> /api` MUST come **before** the SPA catch-all. Vercel evaluates rewrites top-to-bottom and uses the first match. There is a regression test in `src/__tests__/vercelConfig.test.ts` that asserts both the presence and the order of these rewrites. Future investigation of `drizzle-orm/neon-serverless` (WebSocket driver) is still pending — see "Backend" section above.

## Streaming AI

- Lo streaming funziona per **tutte** le risposte AI (testo + tool), non solo per i tool.
- Dopo l'esecuzione di tool, viene fatta una **seconda chiamata** (multi-turn) per generare la sintesi finale (qualità migliore).
- Token usage viene accumulato tra le due chiamate e mostrato in `result.response.usage`.
- Log "a blocchi": `useAI.ts` emette un'entry di log ogni 400ms con preview del contenuto ricevuto.

## Test — OBBLIGATORI

**Ogni modifica al codice di produzione (`src/`, `api/`, `db/`) DEVE essere accompagnata da test.**

Regole:

1. **Nuovo codice → nuovi test.** Funzioni/componenti/endpoint nuovi nascono con almeno un test che ne copre il caso felice + 1 caso di errore.
2. **Codice modificato → test aggiornati.** Se modifichi un branch, una condizione, una prop, un parametro: aggiorna o aggiungi il test corrispondente. Nessun "test morto" lasciato passare.
3. **Bug fix → regression test.** Quando risolvi un bug, scrivi un test che lo riproduce PRIMA del fix, poi verifica che passi dopo.
4. **Refactor → test invariati ma verdi.** Se il refactor rompe test esistenti, il refactor è sbagliato (o i test erano incompleti).
5. **Coverage minima per nuovi file: 60%** (target progetto). File sotto soglia vanno motivati con commento.
6. **Mai** skippare un test con `.skip` o `xit` per far passare la CI. Se è flaky, fixalo.
7. **Prima di proporre un push** (vedi sezione *Pre-push Checklist* in cima): `npm run typecheck && npm run test` devono essere verdi. Se falliscono, risolvi prima — non proporre il push.

Posizione test:
- Componenti React → `src/components/__tests__/` o `src/pages/__tests__/`
- Hook → `src/hooks/__tests__/`
- Utility pure → `src/utils/__tests__/`
- API endpoints → `api/__tests__/` (mockando il DB)

## Admin User

- Email: `admin@gmail.com`
- Never saved to database — password validated against `ADMIN_PASSWORD` env var
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

Chiavi attuali (senza prefisso, da versionare in prossima migrazione):
- `precisionQuote_quotes` — array preventivi legacy
- `precisionQuote_documents` — documenti unificati (preventivi, QR, card, flyer, logo)
- `registeredUsers` — array utenti
- `userSettings_<email>` — impostazioni utente
- `deepseekApiKey` — chiave DeepSeek (solo dev)
- `authToken`, `userEmail`, `username`, `userRole`, `dataRegistrazione` — sessione

## Testing

- Framework: Vitest + React Testing Library + jsdom
- Run single test: `npx vitest run path/to/file.test.ts`
- No test database needed — local tests use localStorage path
- Coverage attuale: ~8% (4 file). Target: 60%. Attualmente 671 test su 67 file.

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
    The `/api/*` path is served directly by the single `api/index.ts` function. Do **not** add per-route `/api/*` rewrites — they break the monolithic function and cause `ERR_MODULE_NOT_FOUND` on shared imports.
3. **Before pushing features that require Vercel env vars** (DEEPSEEK_API_KEY, DATABASE_URL, ADMIN_PASSWORD, ALLOWED_ORIGIN), confirm the variables are set in the Vercel dashboard. Missing env vars cause 503/500 errors in production. `BLOB_READ_WRITE_TOKEN` is no longer used (PDF generation is fully client-side).

## Active Skills

Queste skill vengono caricate automaticamente. Quando modifichi il codice riferito a esse, **leggi la skill prima** (`.agents/skills/<name>/SKILL.md`).

- `vercel-react-best-practices` — performance React (sempre attiva)
- `vercel-composition-patterns` — component design
- `web-design-guidelines` — review UI/accessibilità
- `web-security` — security review
- `writing-guidelines` — docs/prose style
- `test-driven-development` (obra/superpowers) — disciplina TDD per Blocco 3+
- `frontend-design` (anthropics/skills) — design opinionale per UI

**Skill on-demand** (caricare solo se il task lo richiede esplicitamente):
- `deploy-to-vercel` — solo quando l'utente chiede deploy
- `vercel-cli-with-tokens` — solo per setup CLI con token
- `vercel-optimize` — solo per audit costi/performance (richiede Vercel CLI autenticato)
- `git-guardrails-claude-code` — solo per setup hook

**Skill rimosse** (non usate da questo progetto):
- `vercel-react-native-skills` — non è un'app React Native
- `vercel-react-view-transitions` — non usiamo View Transitions API

## API Design Principles (REST)

- **Status code**: 200 OK / 201 Created / 204 No Content / 400 Bad Request / 401 Unauthorized / 403 Forbidden / 404 Not Found / 409 Conflict / 429 Too Many Requests / 500 Server Error / 503 Unavailable
- **Input**: Zod validation su ogni body/query
- **Output**: JSON uniforme `{ data }` o `{ error }`
- **Auth**: verificata in ogni handler, non solo middleware
- **Rate-limit**: scope dedicato per categoria (`login`, `ai`, `tokens`, `logs`)
- **Admin endpoints**: `adminEmail=admin@gmail.com` sempre richiesto
- **`adminEmail` transport**: **query string** per GET (`?adminEmail=...`), **body** per PATCH/POST. Non mischiare — vedi `api/__tests__/users.test.ts` (regression per bug 51d84a5: `GET /users` leggeva da body mentre il client mandava query string, risultato tabella admin vuota in prod).
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
| `api/index.ts` | Single Vercel serverless function — entire REST API (monolith) |
| `src/utils/` | Client-side utilities (logger, errors) |

