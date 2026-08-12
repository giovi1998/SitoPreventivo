# Ticket: Next.js per questo codebase

Labels: `wayfinder:ticket`, `wayfinder:research`
Blocked by: —
Status: closed (2026-08-12, resolution below)

## Risoluzione

**DON'T MIGRATE** — costo ~90-140h, zero beneficio per lo stack attuale.

- SPA client-state pura (AppShell context, localStorage split IS_LOCAL,
  TestRouter) → RSC/SSR/server actions inutili; "use client" ovunque.
- §1 load-bearing: 4 split storici ruppero produzione; framework=node
  stabilizzato (2026-08-10). Next riapre la stessa classe di rischio.
- Streaming SSE hand-rolled già validato (e2e ai-log-preview verde).
- Langfuse NON è Next-gated: `@langfuse/otel` gira in qualunque runtime
  Node — e il manual OTLP attuale copre già trace/usage/cost/prompt/PII.
- §23 (dataService CJS + import dinamici crm.js) e §25 (zero-warning,
  manualChunks, npm 12) rischiano con bundler Next su 263 test.
- 7 provider custom non mappano 1:1 su `@ai-sdk/*` — provider porting =
  migrazione separata.
- Trigger migrazione futura: SOLO feature AI-only-in-Next (AI Gateway
  nativo / AI SDK v7 in @vercel/backends). Oggi nessuna identificata.

## Question

Next.js darebbe un vantaggio reale per questo codebase (Vite SPA +
`server.ts` monolite, gotcha §1) per l'obiettivo agente + Langfuse, o è
solo costo?

Confronto:

1. **Cosa sbloccherebbe**: API routes/server actions per l'orchestratore
   agente, edge, streaming SSR, SDK langfuse nativo?
2. **Cosa costerebbe**: riscrittura completa routing (`src/main.tsx`,
   `server.ts`, monolite `handler.ts`), `vercel.json` framework node,
   tutti i test server (mock DB `src/server/__tests__/setup.ts`),
   pipeline build.
3. **Alternativa**: tenere Vite + estendere `server.ts` (già streaming
   SSE, una funzione, `/api/*` gestiti dal server entrypoint).

Output: raccomandazione con effort stimato e rischi, citando gotcha
§1/§23/§25. Nessuna migrazione in questo effort — solo la decisione.
