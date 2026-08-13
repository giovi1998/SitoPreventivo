# Ticket: Fix trace flyer-copy + tag status

Labels: `wayfinder:ticket`, `wayfinder:task`
Blocked by: —
Status: open, unassigned

## Question

Fix del gap emerso dall'audit T3 (tag/type/metadata canonici):

1. `generate-flyer-copy` (src/server/ai.ts:505): usage attuale
   `{ promptTokens: 0, completionTokens: total }` → spaccare
   prompt/completion reali dal raw Ollama; rimuovere `userEmail:
   undefined` (ripristinare attribuzione); aggiungere `sessionId` e
   `customerId` se disponibili nel body.
2. Tag `status:ok|error` nel payload Langfuse (`buildLangfusePayload` in
   src/server/langfuse.ts) — derivato da `input.error` presente/assente.
3. Regression test in `src/server/__tests__/langfuse.test.ts`: usage
   flyer-copy coerente + tag status su ok e su errore.

Output: commit dedicato, test verdi (`npm run typecheck && npm run test`
prima di proporre push).
