# Ticket: Refactor `useAICall` condiviso — elimina duplicazioni hook (t16)

Labels: `wayfinder:ticket`, `wayfinder:task`
Blocked by: —
Status: closed (2026-08-20, resolution below)

## Risoluzione

Creati due moduli utility **puri** (no React state → non servono hook):

- `src/utils/ai/tokenBudget.ts` — `ensureTokenBudget(userEmail)` (pure async).
- `src/utils/ai/imageCall.ts` — `postAiImage(endpoint, payload, opts)`:
  fetch unico + error map + costUsd + aiCall shape; ritorna
  `{ dataUrl, aiCall }`.

Migrati: useAICard (generateCover/generatePhoto), useAILogo (background),
useAIFlyer (hero), useAIIconHero. `setLastCostUsd` no-op rimosso (era
dead code: gestito da useAILogs). `ensureTokenBudget` duplicato in 3
hook → unico modulo. `trackImageTokens` → `postAiImage` fa il track
internamente. Test: `tokenBudget.test.ts` + `imageCall.test.ts`
(happy path + error fetch). Nessuna feature nuova — solo DRY.

## Question

L'analisi della sessione 2026-08-20 (grilling) conferma: i hook
`useAICard`, `useAILogo`, `useAIFlyer`, `useAISocial`, `useAIWebsite`
(+ `useAIIconHero`) condividono ~60% di codice identico:

- `ensureTokenBudget` — dataService.getUserProfile + tokenLimit check
- `trackImageTokens` — dataService.trackTokens con IMAGE_TOKEN_COST
- fetch POST a `/api/ai/*-image` — stesso shape (requestId, apiBase,
  JSON parse, `if !res.ok` throw, calculateCostUsd, saveGeneratedImage,
  `success(info)`/`error(mapAiError)`)
- shape `aiCall: { kind: AiCallKind, costUsd }`
- `setLastCostUsd` (no-op in AICard — gestito da useAILogs)
- stream lifecycle `startStream / appendStream / finalizeStream`

**Task (AFK)**: creare `src/hooks/useAiSharedCall.ts` (o
`src/hooks/useAiImageCall.ts`) con tutte queste utility e migrare i 5
hook. Nessun comportamento cambia — solo DRY. Registro: TB-026 aiStats,
TB-023 log, CON-MM-002 vision gating, CON-IS-001 icon policy.

Deliverable: `useAiSharedCall` migrazione + tests aggiornati, nessuna
feature nuova.
