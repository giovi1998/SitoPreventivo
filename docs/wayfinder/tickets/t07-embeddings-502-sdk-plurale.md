# T7 — 502 /api/ai/embeddings: SDK ritorna `embeddings[]` plurale

Labels: wayfinder:ticket, task (AFK)
Blocked by:
Status: closed, assigned to opencode

## Question

Durante T2 (2026-08-13): ogni auto-build loggava 502 su
`/api/ai/embeddings` ("Embedding vuoto da Gemini"). La chiamata SDK non
falliva: il parsing leggeva `result.embedding.values` (singolare REST
v1beta) mentre `@google/genai` ritorna `result.embeddings[0].values`
(plurale) → sempre vuoto → 502. Stesso bug in 3 siti.

## Risoluzione

Fix shape parsing con fallback in tutti e 3 i siti (2026-08-13):

- `src/server/ai.ts` (endpoint PROD `/ai/embeddings`)
- `src/server/crm.ts` (`embedText`, RAG knowledge chunks)
- `vite.config.js` (dev proxy `/api/ai/embeddings`)

Mock dei test aggiornati alla shape plurale reale
(`embeddings: [{values}]`) in `embeddings.test.ts` e
`viteDevProxy.test.ts`. Verifica live: POST `/api/ai/embeddings` → 200
con vettore reale. 14/14 test verdi.
