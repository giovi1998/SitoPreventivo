---
title: Langfuse Observability — Tracing, Costi per Cliente, Prompt Management
version: 1.0
date_created: 2026-08-10
last_updated: 2026-08-10
owner: Quickbrand
tags: [ai, observability, langfuse, tracing, cost, prompts, otlp]
---

# Spec — Langfuse Observability

## 1. Obiettivo

Integrare Langfuse per:

1. **Tracing completo** di ogni chiamata AI (chat non-stream, stream SSE, 5
   endpoint Gemini, copy-flyer, design-review): prompt, output, tokens,
   costi, latenza, errori.
2. **Vista costi per cliente**: `sessionId = customerId` + metadata
   `customerId`/`businessName` → Sessions view raggruppata per cliente.
3. **Prompt Management** (fase 2, dopo tracing): migrazione progressiva dei
   prompt hardcoded verso Langfuse (versioni + label, A/B testing).
4. **A/B testing online per-cliente** (fase 3): label `production` vs
   `experiment` assegnabili per cliente.

## 2. Architettura

- **Cloud Langfuse** (EU, `https://cloud.langfuse.com`), chiavi solo
  server-side: `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`,
  `LANGFUSE_BASE_URL`.
- **Zero dipendenze**: ingest via OTLP/HTTP JSON (`POST
  /api/public/otel/v1/traces`) costruito a mano in
  `src/server/langfuse.ts`. Motivazione: monolite Vercel (gotcha §1) —
  l'SDK OTEL richiederebbe init/module augmentation a rischio bundle; il
  payload OTLP per generazioni LLM è ~60 righe. Nessuna latenza aggiunta:
  fetch fire-and-forget con timeout 2s, catch silenzioso (Langfuse down =
  app invariata).
- Header `x-langfuse-ingestion-version: 4` → dati in tempo reale su v4.
- Auth: Basic Auth `publicKey:secretKey`.

## 3. Data model (best practices Langfuse)

| Attributo | Valore |
|---|---|
| Nome trace | verb-first, stabile, low-cardinality: `generate-response`, `generate-stream`, `generate-card-cover`, `generate-card-photo`, `generate-flyer-hero`, `generate-flyer-copy`, `generate-logo-background`, `generate-image-flash`, `generate-design-review` |
| `user_id` | `userEmail` (dal body, se presente) |
| `session_id` | `customerId` (vista per cliente) o `sessionId` chat |
| Tag | `feature` (quote/card/flyer/logo/social/onboarding/website/image/chat/design-review) |
| Metadata (filtrabili) | `requestId`, `provider`, `customerId`, `errorKind` (su errori) |
| `environment` | `production`/`development` da `VERCEL_ENV` |
| Input generazione | messaggi role-labeled (OpenAI format); **immagini base64 strippate** (PII) |
| Usage | `langfuse.observation.usage_details` `{input, output, total}` (bucket mutualmente esclusivi) |
| Cost | `langfuse.observation.cost_details` `{total}` SOLO se `costUsd > 0` (Ollama flat $20/mo = pricing custom; DeepSeek/Gemini = inferenza da model definition) |
| Errori | `status.code=2` + `langfuse.observation.level=ERROR` + metadata `errorKind` |
| Prompt link (fase 2) | `langfuse.observation.prompt.name/version` |

Trace ID: deterministico dal `requestId` (uuid → hex 32 → base64 W3C).
Observation ID: random 8 byte base64.

## 4. Punti di aggancio (`src/server/ai.ts`)

Helper `traceGeneration(input)` (best-effort, mai throw, env auto).

| Endpoint | Momento trace |
|---|---|
| `POST /ai/chat` Ollama | dopo fetch, usage normalizzato (`prompt_eval_count`/`eval_count`) |
| `POST /ai/chat` DeepSeek | dopo fetch, `usage` upstream |
| `POST /ai/chat` errori (`!apiRes.ok`) | trace ERROR con `errorKind` (quota/auth/rate_limit/upstream) |
| `POST /ai/chat/stream` Ollama | in `finally` del loop NDJSON, `streamContent` + `finalUsage` |
| `POST /ai/chat/stream` DeepSeek | in `finally` del loop SSE, `streamContent` + usage finale parsato |
| `POST /ai/copy-flyer` | output JSON parsato + usage |
| `POST /ai/design-review` | content + usage Ollama |
| `POST /ai/card-cover`, `/ai/logo-background`, `/ai/flyer-hero`, `/ai/card-photo`, `/ai/image-flash` | prompt, modello, sizeKB (mai base64) |

Zod `customerId`, `sessionId`, `kind` (feature override) opzionali su
`/ai/chat` e `/ai/chat/stream`.

## 5. Identity client

- `userEmail`: auto-iniettata nei body dei provider
  (`dataService/ai.js` `chatWithAI`, `deepseek.ts`, `ollamaPro.ts`) via
  `currentUserEmail()` (`dataService/core.js`, chiave localStorage
  `userEmail`).
- `customerId`: propagata via `ChatOptions` → `buildRequestBody` /
  `buildOllamaBody`; auto-build CRM passa `customerId` del cliente
  (CustomerDetail → useAutoBuildGenerate → orchestratori).
- `kind`: default `aiKind` per orchestratore (quote/card/flyer/logo/
  social/onboarding/website), override via `ChatOptions.kind`.

## 6. Env vars

| Var | Dove | Note |
|---|---|---|
| `LANGFUSE_PUBLIC_KEY` | Vercel + .env | Basic auth username |
| `LANGFUSE_SECRET_KEY` | Vercel + .env | Basic auth password, mai nel browser |
| `LANGFUSE_BASE_URL` | Vercel + .env | es. `https://cloud.langfuse.com` |

Senza chiavi → `ingestLangfuse` è no-op (nessun fetch).

## 7. Test

- `src/server/__tests__/langfuse.test.ts` (13): payload OTLP (attributi,
  trace id deterministico, usage/cost, ERROR, PII strip, prompt link),
  ingest (auth header, no-op senza chiavi, no-throw).
- `src/server/__tests__/langfuseApi.test.ts` (3): integrazione via
  `callApiHandler` su `/ai/chat` (trace reale con sessionId=customerId,
  no-op senza env, ERROR su upstream fail).
- `src/ai/providers/__tests__/ollamaPro.test.ts` (2 nuovi): body con
  customerId/kind/userEmail, omissis quando assenti.
- `src/ai/__tests__/BaseOrchestrator.reasoning.test.ts` (2 nuovi):
  `kind` default `chat` + override, propagazione `customerId`.

## 8. Fase 2 — Prompt Management (implementata 2026-08-10, migrazione completa 2026-08-11)

- **8 prompt migrati** (`chat`, label `production` in prod / `staging` in
  locale): `card-system`, `quote-system` ({{compact}}), `flyer-system`,
  `logo-system`, `social-system`, `onboarding-system`, `website-system`,
  `palette-system`. Upload via `scripts/sync-prompts.ts`
  (`npm run prompts:sync[:staging|:prod]`).
- **ESCLUSI deliberatamente (5 user-prompt website)**: `website-html`,
  `website-css`, `website-js`, `website-page`, `website-verify` incorporano
  HTML/CSS/JS dinamico (5-50KB per chiamata) nel prompt utente → come
  template Langfuse sarebbero variabili giganti ineditabili con cache
  inutile. Restano hardcoded; `website-system` (il loro riferimento) è
  migrato.
- **Label per ambiente**: `production` su Vercel, `staging` in locale →
  template diversi per ambiente (il client sceglie in base all'hostname).
- **`GET /api/ai/prompt?name=X&label=Y`** (`src/server/ai.ts` + dev proxy
  `vite.config.js`): fetch Public API `api/public/v2/prompts/{name}?label=`,
  cache in-memory 60s, **fallback automatico ai builder locali** (Langfuse
  down/404/niente chiavi = template dal codice).
- **Client** (`src/utils/ai/remotePrompt.ts`): `prefetchRemotePrompts()`
  chiamato in AppShell → registra override nel `promptRegistry` (getPrompt
  resta sincrono). `compileClientPrompt` sostituisce `{{var}}` (chiave
  assente → placeholder letterale; presente ma null → vuoto). Fallback
  silenzioso se Langfuse non raggiungibile.
- Link prompt↔traces: `promptName`/`promptVersion` nel payload OTLP
  (pronto; attivato quando un prompt remoto è in uso).

## 9. Fase 3 — A/B testing online per-cliente (implementata 2026-08-10)

- Colonna `customers.promptLabels` jsonb (`{promptName: label}`) + PATCH
  `/customers/:id` (Zod `promptLabels`).
- `GET /api/ai/prompt?name=X&label=Y&customerId=Z`: se il cliente ha una
  `promptLabels` per quel prompt, fa override della label (es.
  `experiment`). DB non raggiungibile → label richiesta (best-effort).
- UI CRM (`CustomerDetail`): sezione "A/B testing prompt" con select
  (default/production/experiment) per i 3 prompt pilota → salva
  `promptLabels` + ri-prefetch prompt con customerId.
- Confronto: filtra trace Langfuse per `customerId` + prompt version.

## 10. Admin prompt CRUD (implementata 2026-08-10)

- `POST /api/ai/prompts` (admin): carica una nuova versione su Langfuse
  (`type: chat`, label opzionale).
- `GET /api/ai/prompts?adminEmail=` (admin): lista prompt caricati
  (normalizzata da paginazione Langfuse).
- `DELETE /api/ai/prompts/:name` (admin): cancella tutte le versioni.
- Guardie: `requireAdmin` (adminEmail body/query), 503 se Langfuse non
  configurato.

## 11. Media multi-modale (implementata 2026-08-10)

- Immagini base64 nei messaggi → upload su Langfuse media
  (`POST /api/public/media` + PUT presigned, dedup per contenuto) e
  sostituzione con token `@@@langfuseMedia:...@@@` (rendering inline UI).
- Upload fallito → placeholder `[immagine allegata (mime)]` nel content.
- Mai raw base64 nei payload: PII + dimensione.

## 12. Fuori scope

- Self-host Langfuse (no: serverless Vercel, zero long-running).
- Esperimenti offline su dataset (fase 4, dopo fasi 2-3).
- Sostituzione di `aiStats` per-documento / `users.tokensUsed`: restano
  (affiancati, dashboard UI interna).
