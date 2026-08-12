# Ticket: Tag/type/metadata canonici per ogni interazione AI

Labels: `wayfinder:ticket`, `wayfinder:grilling`
Blocked by: —
Status: closed (2026-08-12, resolution below)

## Risoluzione

**Audit 14 call site `traceGeneration` (src/server/ai.ts) + dev proxy
(vite.config.js, 5 endpoint Gemini + chat + design-review): tagging
coerente server↔proxy. Gap reali trovati:**

1. `generate-flyer-copy` (ai.ts:505) — **malformed**: `usage` mette tutto
   in completionTokens (`{0, total}`), `userEmail: undefined` esplicito
   (perde attribuzione), manca `sessionId`/`customerId`.
2. `promptName`/`promptVersion` **mai passati** da nessun call site
   (campo definito in langfuse.ts, zero wiring) → prompt non linkati al
   prompt management.
3. Niente `status:ok|error` nei tags → filtraggio errori senza aprire
   trace (oggi solo via `errorKind` metadata + level ERROR).
4. `environment` mai passato dai call site (default LF_ENV ok, ma dev vs
   prod non distinguibile se LF_ENV uguale).

**Gia corretto (commit precedenti, verificato)**: costUsd Gemini `(…,1)`
in tutti i 5 endpoint, `image-flash` rinomato + subfeature, sessionId da
body in tutti i call site, media upload, endTime default in payload.

**Schema canonico (da tenere stabile)**: attributi `langfuse.*` come in
`buildLangfusePayload` + tags `feature:/subfeature:/provider:/streaming:`.
Da aggiungere: tag `status:ok|error`, metadata `model`, wiring
`promptName` dal registry (opzionale, low prio).

**Enforcement**: test `src/server/__tests__/langfuse.test.ts` già copre
tags/usage/cost/media. Aggiungere regression test per usage flyer-copy e
per il tag status quando verranno implementati. Fix concreti → ticket
task separato.

## Question

Quali tag/type/metadata devono avere le trace Langfuse per **ogni**
interazione AI, e come garantirli (schema canonico + enforcement)?

Audit di partenza:

- 14 call site `traceGeneration` in `src/server/ai.ts` + dev proxy
  `vite.config.js` (5 endpoint Gemini) + tags attuali in
  `src/server/langfuse.ts` (`feature:` / `subfeature:` / `provider:` /
  `streaming:`).
- Gap noti: `error.kind` non sempre popolato, `promptVersion` opzionale,
  niente docType/template/phase/version app, `costDetails` DeepSeek-via-
  Ollama = 0 (task aperto in `docs/to-be-done.md`).

Output: lista gap per call site, schema attributi canonico (chiavi
stabili, coerenti con `docs/agent-gotchas.md` §26.25), regole di
enforcement (test + comportamento quando un campo manca — fallire
silenziosamente come oggi o default espliciti).
