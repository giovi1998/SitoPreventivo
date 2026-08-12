# Ticket: Implementare threading runId → trace gerarchica agent

Labels: `wayfinder:ticket`, `wayfinder:task`
Blocked by: —
Status: closed (2026-08-12, resolution below)

## Risoluzione

Implementato end-to-end (client → body → server → payload OTLP):

- **Client**: `src/ai/runTrace.ts` (`newRunId`/`newSpanId` hex);
  `useAutoBuildGenerate` genera runId/rootSpanId per run, stepSpanId per
  step, propaga `{runId, runName:'auto-build', startRun, rootSpanId,
  stepName, stepSpanId}` via `RunTraceOptions` (types.ts) → orchestratori
  (logo/card/flyer/website) → `ChatOptions` → body `/api/ai/chat`.
  Website: `runTrace(step)` helper — ogni chiamata interna (html/pages/
  css/js/verify) è un sub-step con stepSpanId nuovo, startRun solo su html.
- **Server**: Zod 6 campi opzionali (regex runId 32-hex, spanId 16-hex)
  su `/ai/chat` e `/ai/chat/stream`; destructure + passaggio ai 5
  traceGeneration chat; dev proxy `vite.config.js` propagato.
- **Payload** (`langfuse.ts`): `parentSpanId` + campi run; traceId =
  runId (media upload inclusi); emette root `agent:<runName>` (startRun)
  + step `agent:<runName>:<stepName>` + generation con parent link.
  Backward-compat: senza campi run = identico a prima.
- **Test**: 3 payload gerarchico (root+step+gen, parent link, no-root,
  backward-compat) + 4 Zod run fields + 7 expected tags aggiornati con
  `status:ok` (T6). 3026 verdi, typecheck 0, build zero-warning.

## Question

Implementare il contract T4 (schema trace gerarchica) + decisione T5
(orchestrazione client, tracing server):

1. **Client** (`src/hooks/useAutoBuildGenerate.ts`): a inizio run
   generare `runId` (32-hex) + `rootSpanId` (16-hex); per ogni step
   `stepName` + `stepSpanId` nuovo per chiamata; propagare
   `{runId, runName:'auto-build', startRun, rootSpanId, stepName,
   stepSpanId}` in `ChatOptions` → body `/api/ai/chat` (stesso percorso
   di customerId/sessionId). `startRun: true` solo sulla prima chiamata.
   Chat singola (non auto-build): niente campi run → invariato.
2. **Server** (`src/server/ai.ts`): Zod — 6 campi opzionali nel body
   `/api/ai/chat`; in `traceGeneration` passare i campi run.
3. **Payload** (`src/server/langfuse.ts`): nuovo campo
   `parentSpanId?` + `extraSpans?` in `LangfuseGenerationInput`;
   `buildLangfusePayload` emette:
   - root span `agent:<runName>` se `startRun`
   - span step `agent:<runName>:<stepName>` (parent=rootSpanId)
   - generation con `parentSpanId=stepSpanId`
   spanId hex 16 → base64 OTLP (come `toSpanId`); traceId=runId hex
   (`toTraceHexId` lo accetta). Nomi span dedup: step con più chiamate
   → stesso `agent:<runName>:<stepName>` (spanId diversi, ok).
   Tags: root/step con `feature:autobuild`, session.id=customerId,
   user.id=userEmail. Flush: spans multipli in una fetch OTLP.
4. **Test**: `src/server/__tests__/langfuse.test.ts` — payload con
   parentSpanId + extraSpans (root+step+generation, traceId unico,
   parent link corretti, backward-compat senza campi run);
   `src/server/__tests__/ai.test.ts` — schema Zod accetta/rifiuta i
   campi run; `src/hooks/__tests__/` se presente — hook genera runId/
   spanId stabili per run e stepSpanId nuovi per chiamata.

Output: commit dedicato, `npm run typecheck && npm run test` verdi,
nota in `docs/done.md` (wayfinder Langfuse agenti), aggiornare mappa
Decisions so far con questo ticket chiuso.
