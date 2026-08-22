# Ticket: Bug trace Langfuse — root duplicata + generazione orfana (t24)

Labels: `wayfinder:ticket`, `wayfinder:research`
Blocked by: —
Status: closed (2026-08-20, fix in feat/ai-skill-harness)

## Question

Misura t12 (Langfuse, 17-19/08) ha esposto 2 anomalie nella gerarchia
delle trace `agent:auto-build`:

1. **Root duplicata** (trace `g0qieJCR`, 17/08 13:25): due span
   `agent:auto-build` con stesso parent null nella stessa trace — il
   root viene emesso 2 volte (una per run? `startRun` true su più step?).
2. **Generazione orfana** (trace `A3EJgT+r`, 19/08 22:58): la GENERATION
   `logo-ai-chat` ha `parentObservationId: null` + `isRootObservation:
   true` pur essendoci lo span `agent:auto-build:logo` padre — la call
   tool è tracciata come trace separata, non come figlia.

Impatto: vista albero Langfuse rotta (costi/step non aggregati sotto il
run), session_id presente ma gerarchia assente. Rilevante per la vista
costi-per-cliente e per future misure (t18 verify, t21 coherence).

Da verificare (collegato a t07 threading runid):
- `startRun` logic in `AgentOrchestrator.run` (round 0) vs
  `runTrace('html')` in websiteOrchestrator (firstCall) — entrambi
  possono emettere root con runId uguale?
- La generation `logo-ai-chat` arriva con `startRun: false`? Il root span
  dell'agente è emesso su ogni round (`stepName: 'plan'`) e la generation
  del tool ha runId proprio?

Deliverable: fix threading (un solo root per runId, generation figlie con
parentObservationId corretto) + regression test payload OTLP.

## Fix (2026-08-20)
- `src/ai/agentOrchestrator.ts:210` — `executeTool` forza `startRun: false` (i tool sono figli del root agent, mai nuovo root). Prima `...ctx.runTrace` propagava `startRun:true` → 2 root con stesso runId (trace `g0qieJCR`).
- Verificato che `logo-ai-chat` ora ha `parentObservationId = stepSpanId` del tool, non `null`.
