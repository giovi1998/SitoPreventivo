# Ticket: Dove vive l'orchestratore agente (server vs client)

Labels: `wayfinder:ticket`, `wayfinder:grilling`
Blocked by: LangChain/LangGraph per orchestrazione agenti, Schema trace
gerarchica agente → sub-agente
Status: closed (2026-08-12, resolution below)

## Risoluzione

**CLIENT** — orchestrazione resta client-side (`useAutoBuildGenerate`),
il server fa solo tracing passivo.

Motivi:

- Timeout Vercel: 60s sync / 300s streaming per richiesta; un endpoint
  agente che serializza logo→card→flyer→website può durare 10-30+ min
  → SSE su una sola richiesta è fragile (rate limit 30/min condiviso,
  disconnessioni). Le chiamate singole attuali già funzionano (streaming
  per endpoint).
- Fallback provider e riuso orchestratori: già gestiti client-side;
  un server orchestrator dovrebbe re-implementare la sequenza (duplica
  `useAutoBuildGenerate`) o esporre un protocollo di tasking complesso.
- SSE per stato fasi: già disponibile per-chiamata; il client mostra le
  fasi dal proprio stato (nessun guadagno server).
- Trace gerarchica NON richiede il server orchestratore: il contract
  T4 (runId/stepName/rootSpanId nel body) dà la trace agente→sub→gen
  con orchestrazione client.

Limite noto (accettato): la sequenza auto-build resta non-resumable e
sensibile a disconnessioni tra step (già oggi). Un eventuale worker
server (step 2) richiederebbe Vercel Background Functions / cron —
fuori scope.

Design chiamate: `useAutoBuildGenerate` genera runId/rootSpanId a inizio
run, stepSpanId per chiamata, popola i campi in `ChatOptions` → body
`/api/ai/chat` (come customerId/sessionId). Server: Zod + emissione
span (T4). UI fasi: invariata (già per-step status).

## Question

Dove esegue l'orchestratore agente?

- **Server**: nuovo endpoint `/api/ai/agent` con SSE (riusa provider
  registry + `traceGeneration`), oppure
- **Client**: estendere `useAutoBuildGenerate` con fasi esplicite.

Vincoli:

- Timeout Vercel: 60s sync / 300s streaming (gotcha §26.13-§26.17).
- Rate limit `aichat` 30/min.
- Fallback provider (`executeWithFallback`), costi per-cliente.
- Riuso orchestratori esistenti come sub-agenti (logo/card/flyer/website).
- La sequenza "Genera bozze AI" oggi è client-side e va validata in PROD
  (task aperto `docs/to-be-done.md` #3).

Output: decisione + design chiamate (shape SSE, cosa espone il server,
come il client mostra le fasi).
