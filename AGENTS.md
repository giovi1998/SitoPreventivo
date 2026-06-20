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

## Architecture

- **Frontend**: React 18 + Vite + React Router v6
- **Backend**: Single Vercel Serverless Function (`api/index.ts`) — monolithic, all routes in one file
- **Database**: Drizzle ORM → Neon Postgres
- **Storage split**: `localhost` = localStorage, production = API + Postgres. Detection is automatic via `IS_LOCAL` in `src/utils/dataService.js`

## Key Files

| File | Role |
|------|------|
| `App.tsx` (root, not src/) | Main app: AuthProvider, state, AI, PDF export |
| `api/index.ts` | Entire REST API (users, quotes, AI proxy, upload) |
| `db/schema.ts` | Drizzle schema (users, quotes, user_settings) |
| `src/utils/dataService.js` | Data layer — routes to API or localStorage |
| `src/utils/generatePDF.ts` | PDF generation with pdfmake |
| `vite.config.js` | Port 8000, SPA fallback for /app route |
| `vercel.json` | Build runs `db:migrate` before `build` |

## Environment Variables

`.env.example` has all vars. Required:

| Var | Where | Purpose |
|-----|-------|---------|
| `DATABASE_URL` | Vercel (Production+Preview) | Neon Postgres connection |
| `DEEPSEEK_API_KEY` | Vercel (Production+Preview) | AI chat (server-side only) |
| `ADMIN_PASSWORD` | Vercel (Production+Preview) | Admin login (admin@gmail.com) |
| `VITE_ADMIN_PASSWORD` | .env (local only) | Admin login in dev |

**Never expose `DEEPSEEK_API_KEY` to the browser.** The frontend calls the serverless function proxy, which holds the key server-side.

### PDF Generation — Client-Side Only

PDF generation happens entirely in the browser via `pdfmake` (in `src/utils/generatePDF.ts`). No server upload, no Vercel Blob, no `BLOB_READ_WRITE_TOKEN` needed. This keeps the app free-tier friendly.

- `App.tsx` `exportPDF()` → download locale

## API Schema Duplication

`api/index.ts` inlines the Drizzle schema for Vercel compatibility. If you modify `db/schema.ts`, you must also update the corresponding tables in `api/index.ts` (lines 9-52).

## Admin User

- Email: `admin@gmail.com`
- Never saved to database — password validated against `ADMIN_PASSWORD` env var
- Has unlimited tokens (`tokenLimit: 999999999`)

## Testing

- Framework: Vitest + React Testing Library + jsdom
- Run single test: `npx vitest run path/to/file.test.ts`
- No test database needed — local tests use localStorage path

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
2. **Do not change `vercel.json` rewrites** without explicitly testing `/api` routes (auth, register, upload-pdf, public quote) afterwards. The current rewrite is:
   ```json
   { "source": "/api/(.*)", "destination": "/api" }
   ```
   This routes every `/api/*` request to the single serverless function `api/index.ts`. Do **not** change it to `/api/$1` — it breaks the monolithic function.
3. **Before pushing features that require Vercel env vars** (DEEPSEEK_API_KEY, DATABASE_URL, ADMIN_PASSWORD), confirm the variables are set in the Vercel dashboard. Missing env vars cause 503/500 errors in production. `BLOB_READ_WRITE_TOKEN` is no longer used (PDF generation is fully client-side).

## Skills & Guardrails Location

| Path | Contents |
|------|----------|
| `.agents/skills/` | Installed agent skills (10 total) |
| `.agents/guardrails/` | Git safety rules and block scripts |
| `.agents/skills/git-guardrails-claude-code/` | Original skill reference |

### Installed Skills

- `deploy-to-vercel` — Deploy to Vercel
- `git-guardrails-claude-code` — Git safety hooks
- `vercel-cli-with-tokens` — Vercel CLI with tokens
- `vercel-composition-patterns` — Vercel composition patterns
- `vercel-optimize` — Vercel optimizations
- `vercel-react-best-practices` — React best practices for Vercel
- `vercel-react-native-skills` — React Native for Vercel
- `vercel-react-view-transitions` — React view transitions
- `web-design-guidelines` — Web design guidelines
- `writing-guidelines` — Writing guidelines
