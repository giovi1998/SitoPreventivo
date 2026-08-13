# Ticket: LangChain/LangGraph per orchestrazione agenti

Labels: `wayfinder:ticket`, `wayfinder:research`
Blocked by: —
Status: closed (2026-08-12, resolution below)

## Risoluzione

**DON'T ADOPT** — né LangGraph, né SDK langfuse, né Vercel AI SDK.

- Nested span OTLP = solo `parentSpanId` (~5 LOC nel payload esistente;
  già supportato da Langfuse v4). Il vero gap è il **traceId**: l'auto-build
  fa 4+ chiamate con requestId diversi → 4 trace separate. Fix: client
  genera runId (traceId) + spanId, li passa nel body `/api/ai/chat`
  (come `customerId`/`sessionId`), server li threada. ~15-25 LOC totali.
- LangGraph: grafi/checkpoint/tool-loop = YAGNI (sequenza fissa = for-loop
  in `useAutoBuildGenerate`; niente resume, niente HITL).
- SDK v5 (`@langfuse/tracing` + OTel): richiede `NodeSDK.start()` module
  scope + `forceFlush()` pre-exit → peggio della fire-and-forget 2s attuale.
- Costi/prompt management/media upload già costruiti manualmente.
- Bundle: LangGraph ~12MB, AI SDK ~7MB, OTel ~1-2MB — viola §25 per zero
  gain funzionale. Provider layer custom → AI SDK richiederebbe rewrite
  (out of scope).
- Esempio payload nested trace (trace auto-build → span sub-agent-card →
  generation) registrato in sessione; flush possibile in UNA fetch (multi
  span per request OTLP).

## Question

LangChain/LangGraph + SDK Langfuse danno qualcosa che lo stack attuale
zero-dep non può ottenere, per l'obiettivo "agente con sub-agenti
tracciato in Langfuse"?

Stack attuale: payload OTLP manuale in `src/server/langfuse.ts` (una
generation = un span), orchestrazione sequenziale client-side
(`useAutoBuildGenerate`: logo→card→flyer), 8 orchestratori in `src/ai/`.

Confronto concreto:

1. **LangGraph**: grafi, checkpointing, sub-graph, loop con tool — quali
   servono davvero al nostro caso (sequenza fissa con fallback provider,
   niente cicli liberi)?
2. **SDK langfuse / vercel-ai-sdk**: spans padre-figlio automatici, cost
   tracking, prompt management — vs `buildLangfusePayload` manuale
   (`parentSpanId` è già supportato in OTLP, ~10-20 righe).
3. **Costi su Vercel serverless**: bundle size, cold start, compatibilità
   monolite `handler.ts` (gotcha §1: niente import statici ESM-only),
   vincolo CJS `dataService.js` (§23), build zero-warning (§25
   manualChunks, npm 12).
4. **Alternativa lean**: nessuna libreria; `parentSpanId` manuale per la
   stessa resa visiva in Langfuse.

Output: raccomandazione (adottare / non adottare / solo SDK langfuse) +
dati a supporto (versioni esatte, bundle, esempi payload span nidificato).
