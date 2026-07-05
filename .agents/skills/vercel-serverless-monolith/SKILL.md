---
description: Use when modifying api/index.ts or touching any file in api/. Critical Vercel Hobby plan constraints: single monolith function.
---

# Skill: vercel-serverless-monolith

## Overview

`api/index.ts` è l'UNICA Vercel serverless function. Monolite intenzionale.
Il pattern "split in lib/routes" sembra promettente ma rompe production
in 4 modi diversi. Questa skill codifica le lezioni apprese.

## Regole

- `api/index.ts` è la sola serverless function. Tutto il routing è inline.
- NON splittare in `api/lib/`, `api/routes/`, `api/_lib/`, `api/_routes/`.
  Il prefisso `_` esclude i file da count AND bundle → `ERR_MODULE_NOT_FOUND`.
- NON usare `vercel.json` `functions.includeFiles` (copia ma non transpila).
- NON aggiungere rewrites per `/api/*` (rompe il monolite).
- Mantieni `vercel.json` rewrites ordine: `/api/(.*) -> /api` PRIMA di
  `/(.*) -> /index.html`. Vercel valuta top-to-bottom, primo match wins.
- 12-function limit Hobby plan. Ogni `.ts` in `api/` conta.

## vercel.json (canonical)

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

L'ordine è CRITICAL. Il rewrite `/api/(.*) -> /api` DEVE venire prima
dello SPA catch-all. C'è un regression test:
`src/__tests__/vercelConfig.test.ts`.

## Lezioni apprese (4 commit broke production)

1. `f004e5e` (split in `api/lib/` + `api/routes/`): exceeded 12-function limit.
2. `036ae25` (moved shared code to `api/_lib/` + `api/_routes/` with
   underscore prefix): underscore prefix esclude file da count E bundle
   → functions couldn't import shared code → `ERR_MODULE_NOT_FOUND`.
3. `5e2971f` (tried `vercel.json` `functions.includeFiles`): copy ma
   non transpila. Ancora `ERR_MODULE_NOT_FOUND`.
4. `05b17e6` (rollback to single monolith): rimosso il rewrite
   `{"source": "/api/(.*)", "destination": "/api"}`. Vercel è caduto
   sullo SPA catch-all `/(.*) -> /index.html` e restituito 405 Method
   Not Allowed per ogni POST a `/api/*` (perché `/index.html` è static
   e non accetta POST).

## Pattern corretti

- Tipi/funzioni pure condivisi con client: mettili in `src/`, NON in
  `api/_lib/`. `src/` è bundled correttamente.
- `api/index.ts` modular via helper interni (`handleAuth`, `handleAI`,
  `handleDocuments`, ecc.) e utility functions al top del file.
- Mock del DB per test: in `api/__tests__/*.test.ts`, mocka
  `drizzle-orm/neon-http` con `vi.mock(...)`.

## Quando aggiungere un endpoint

1. Aggiungi il case `if (path === '/xxx' && method === 'POST')` in
   `handleXxx` in `api/index.ts`.
2. Validazione Zod su body (`validate(z.object({...}), body)`).
3. Rate-limit scope dedicato se nuovo (`consumeRateLimit` / `checkRateLimit`).
4. Auth: verifica `userEmail` da body/query per endpoint che mutano
   stato (non solo trust client).
5. Test in `api/__tests__/xxx.test.ts` con mock fetch + Drizzle.

## Riferimenti

- `api/index.ts` (monolite)
- `vercel.json` (rewrites)
- `src/__tests__/vercelConfig.test.ts` (regression)
- AGENTS.md sezione "Vercel Routing CRITICAL", "Git Guardrails"
- Lezioni storiche: git log commit f004e5e, 036ae25, 5e2971f, 05b17e6
