# Ticket: Schema trace gerarchica agente → sub-agente

Labels: `wayfinder:ticket`, `wayfinder:grilling`
Blocked by: LangChain/LangGraph per orchestrazione agenti
Status: closed (2026-08-12, resolution below)

## Risoluzione

**Una trace per run** (traceId = runId condiviso) con 3 livelli:
trace → span step (sub-agente) → generation (chiamata LLM).

Modello: **tracing server-side passivo, orchestrazione client-side**.
Niente endpoint agente dedicato: i campi run viaggiano nel body di
`/api/ai/chat` (come già `customerId`/`sessionId`) e il server emette
gli span. Il client non cambia logica — aggiunge campi di osservabilità.

Contract body `/api/ai/chat` (tutti opzionali, backward-compatible):

- `runId: string` — 32-hex traceId condiviso per tutto il run (generato
  dal client a inizio run, es. `useAutoBuildGenerate`)
- `runName: string` — nome stabile del task (es. `auto-build`); la trace
  si chiama `agent:<runName>` (es. `agent:auto-build`)
- `startRun?: boolean` — true solo sulla prima chiamata del run; fa
  emettere al server lo span root (`agent:<runName>`)
- `rootSpanId: string` — 16-hex stabile per tutto il run (parent di ogni
  step span)
- `stepName: string` — sub-agente (es. `logo`|`card`|`flyer`|`website`)
- `stepSpanId: string` — 16-hex, NUOVO per ogni chiamata (un step =
  più chiamate → più span step con nomi dedup, es. `agent:auto-build:card`)

Span emessi dal server per chiamata:

1. se `startRun` → root span `agent:<runName>` (observation.type=span,
   tags feature:autobuild, session.id=customerId, user.id=userEmail)
2. span step `agent:<runName>:<stepName>` (parentSpanId=rootSpanId)
3. generation esistente con `parentSpanId=stepSpanId`

Tutti gli span: traceId=runId (hex già — `toTraceHexId` lo accetta),
flush possibile in UNA fetch OTLP (multi-span per request).

Errori: span step ed errori della chiamata portano `status:error` +
tag `status:error` (T6) — niente span di run extra in caso di errore
(fire-and-forget, il root span resta).

Media upload: invariato (per generation, traceId=runId hex).

Esempio payload OTLP multi-span registrato nel research T1 (trace
auto-build → sub-agent-card → card-ai-chat).

## Question

Come rappresentare in Langfuse un task agente multi-sub (es. auto-build
logo→card→flyer→website): **una trace per task** con span per sub-agente
e generation per chiamata? O una trace per sub-agente? Quale modello con
OTLP manuale (`parentSpanId`) e quale con SDK langfuse se il ticket
LangChain lo consiglia?

Vincoli da rispettare:

- `session_id = customerId` per vista costi per cliente (già attivo).
- Media upload per sub (funzionante, gotcha §26.26) — ogni generation
  mantiene i suoi media.
- Streaming invariato; fire-and-forget 2s (mai latenza aggiuntiva).
- Usage/costi admin (`trackUsage`) invariato.

Output: schema trace gerarchico approvato — nomi span verb-first
(stabili, coerenza §26.25), attributi per livello (trace vs span vs
generation), esempi payload OTLP.
