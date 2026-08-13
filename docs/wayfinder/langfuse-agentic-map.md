# Mappa wayfinder: Langfuse esperienza agenti (label `wayfinder:map`)

## Destination

Un "agente" orchestratore visibile in Langfuse: ogni task multi-step
(es. "Genera bozze AI" logo→card→flyer→website) tracciato come **trace
gerarchica** agente → sub-agente → generazione, con tag/type/metadata
**canonici per ogni interazione AI** (chat, cover, photo, flash, palette,
website steps, CRM auto-build). Decisioni prese e documentate su
LangChain/LangGraph e Next.js (migrare o no, con dati).

## Notes

- Domain: app AI multi-orchestratore — 8 orchestratori in `src/ai/`,
  server Langfuse **zero-dep** (payload OTLP manuale,
  `src/server/langfuse.ts`), monolite Vercel `server.ts` (gotcha §1),
  auto-build oggi **client-side** (`useAutoBuildGenerate`).
- Skills: `langfuse` (instrumentation/OTLP, spans, prompt migration),
  `lean-code` (zero-dep vs LangChain), `adhd-caveman` (output),
  `wayfinder` (questo).
- Convenzioni repo: gotcha §1 (monolite server), §25 (build zero-warning,
  manualChunks, npm 12), §26.26 (media upload end-to-end, funzionante),
  kanban `docs/to-be-done.md` / `docs/done.md` (aggiornarli quando si
  risolvono i task lì elencati).
- Tracker: **locale markdown** in `docs/wayfinder/` (gh non autenticato;
  kanban repo = docs/). Claim = riga Status nel ticket con assignee prima
  di lavorarci.

## Decisions so far

<!-- una riga per ticket chiuso: nome + gist, link al ticket -->

- [T1 LangChain/LangGraph per orchestrazione agenti](tickets/t01-langchain-langgraph-research.md) — **DON'T ADOPT**: manual `parentSpanId` + runId condiviso (traceId) via body = stessa resa, ~15-25 LOC. LangGraph/SDK = YAGNI + bundle 1-12MB contro §25.
- [T2 Next.js per questo codebase](tickets/t02-nextjs-research.md) — **DON'T MIGRATE**: 90-140h, SPA pura, §1 load-bearing, Langfuse non Next-gated. Trigger futuro: solo feature AI-only-in-Next.
- [T3 Tag/type/metadata canonici per ogni interazione AI](tickets/t03-tag-type-metadata-canonici.md) — audit 14 call site ok nel tagging; gap: flyer-copy malformed (usage/userEmail), `promptName` mai wired, niente tag `status:`. Schema canonico documentato.
- [T4 Schema trace gerarchica agente → sub-agente](tickets/t04-trace-gerarchica-agente-subagente.md) — una trace per run: trace `agent:<runName>` → span step → generation, via campi run nel body `/api/ai/chat` (runId/rootSpanId/stepSpanId), tracing server passivo.
- [T5 Dove vive l'orchestratore agente (server vs client)](tickets/t05-orchestratore-agente-server-vs-client.md) — **CLIENT**: orchestrazione resta in `useAutoBuildGenerate`, server solo tracing passivo. Endpoint agente = timeout Vercel 60/300s + duplicazione sequenza.
- [T6 Fix trace flyer-copy + tag status](tickets/t06-fix-flyer-copy-trace.md) — usage flyer-copy spaccato reale, identità (userEmail/customerId/sessionId) nel body, tag `status:ok|error` nel payload. 62 test verdi.
- [T7 Implementare threading runId → trace gerarchica agent](tickets/t07-threading-runid-trace-agente.md) — implementato: runId/rootSpanId/stepSpanId da `useAutoBuildGenerate` → body `/api/ai/chat` → payload OTLP con root `agent:auto-build` + step + generation parent-linked. 3026 test verdi, build zero-warning.
- [T9 Sub-agente con harness + tool per ogni oggetto](tickets/t09-agente-harness-tool-per-oggetto.md) — `agentOrchestrator.ts`: tools generate_logo/card/flyer/website, loop plan→act 6 round, trace plan+tool span. **Bonus: fix prod website** — Zod max_tokens 8192→16384 (era il 400 su ogni step website in PROD).
- [T11 Wiring agente nel flusso CRM "Genera bozze AI"](tickets/t11-wiring-agente-crm.md) — `agentMode: true` in CustomerDetail; `agentSave.ts` helper (brief + tool result → data); UI stato `Agente: ✓/✗ generate_<oggetto>`. Editor singoli senza agente (YAGNI).

## Ticket aperti

- [T10 Trace Langfuse nei test endpoint non devono uscire al cloud](tickets/t10-trace-test-endpoint-no-cloud.md) — task: fix già applicato (resetApiTests azzera env Langfuse + regression test), commit dedicato + verifica.

## Not yet specified

- **Prompt/strumenti dei sub-agenti**: riusare orchestratori esistenti
  (cardOrchestrator, flyerOrchestrator...) come sub-agenti vs prompt
  agente dedicati (plan/act/review tipo verify fix-guard §26.16) —
  dipende da "Dove vive l'orchestratore agente".
- **Feedback/score utente sulle trace** (thumbs/scores) — non richiesto
  oggi; riaprire quando serve misurare qualità output.
- **UI client per stato agente** (badge/console fasi) — dipende dalla
  trace gerarchica e da server-vs-client.
- **Costi per sub-agente**: agente multipla le chiamate — DeepSeek
  pay-per-token vs Ollama flat; costDetails DeepSeek-via-Ollama = 0
  (task aperto in to-be-done) impatta l'attribuzione.

## Out of scope

- **Migrazione effettiva a Next.js**: i ticket di ricerca decidono se vale;
  l'eventuale migrazione sarebbe un effort separato.
- **Migrazione effettiva a LangChain/LangGraph**: idem (effort separato se
  il research dice sì).
- **Riscrittura provider layer** (`src/ai/providers/*`).
- **Feature AI nuove**: nessun nuovo tool/funzione, solo orchestrazione
  e tracciamento.
