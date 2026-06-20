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
| `BLOB_READ_WRITE_TOKEN` | Vercel | PDF upload to Vercel Blob |

**Never expose `DEEPSEEK_API_KEY` to the browser.** The frontend calls the serverless function proxy, which holds the key server-side.

## API Schema Duplication

`api/index.ts` inlines the Drizzle schema for Vercel compatibility. **Any change to `db/schema.ts` must be mirrored** in the corresponding table definition + handler in `api/index.ts`.

### ⚠️ Schema Change Checklist

When adding/modifying a column in any table:

| Step | Local | Production |
|------|-------|------------|
| 1. Update `db/schema.ts` | ✅ Always | ✅ Same |
| 2. Update inlined schema + handler in `api/index.ts` | ✅ Always | ✅ Same |
| 3. Generate migration | `npm run db:generate` (needs DATABASE_URL in .env) | 🔄 Auto via build |
| 4. Apply migration | `npm run db:migrate` (needs DATABASE_URL in .env) | 🔄 `vercel.json` runs `db:migrate` on build |
| 5. Run typecheck + tests | `npm run typecheck && npm run test` | ❌ Not needed |
| 6. Add note to AGENTS.md about the change for future agents | ✅ Recommended | ✅ Recommended |

- **Local dev**: localStorage is used, so schema changes don't affect local data. But run `db:generate` + `db:migrate` before deploy to keep migrations in sync.
- **Production**: Vercel build runs `db:migrate` automatically. No data loss for existing rows — new columns use their `default()` value.
- **No `DATABASE_URL` locally?** You can still develop and commit — migrations will be generated on deploy. Just ensure the schema + API are consistent.

## Admin User

- Email: `admin@gmail.com`
- Never saved to database — password validated against `ADMIN_PASSWORD` env var
- Has unlimited tokens (`tokenLimit: 999999999`)

## Testing

- Framework: Vitest + React Testing Library + jsdom
- Run single test: `npx vitest run path/to/file.test.ts`
- No test database needed — local tests use localStorage path

**Required**: Always run `npm run test` (and `npm run typecheck`) after making changes. No code should be committed or deployed if any test fails. The UI onboarding check condition is:
```ts
if (settings.onboardingDone === true && isComplete) // skip onboarding
else // show onboarding
```
Both conditions (`onboardingDone` flag + all required fields present) must be true to skip onboarding.

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
