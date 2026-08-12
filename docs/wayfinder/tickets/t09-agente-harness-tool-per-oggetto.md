# Ticket: Sub-agente con harness + tool per ogni oggetto

Labels: `wayfinder:ticket`, `wayfinder:task`
Blocked by: —
Status: closed (2026-08-12, resolution below)

## Risoluzione

`src/ai/agentOrchestrator.ts` — agente orchestratore con harness tools:

- 4 tools (`generate_logo/card/flyer/website`) dichiarati solo se in
  `include`; loop plan→act max 6 round su `BaseOrchestrator` (niente
  LangGraph, T1); fallback tool → `{ok:false, summary}` senza crash;
  `onToolResult` per salvataggio da parte del chiamante.
- Trace T7: l'agente emette `stepName: 'plan'` (root su round 0) e ogni
  tool usa `stepName = oggetto` + stepSpanId nuovo → span
  `agent:auto-build:plan` e `agent:auto-build:card` in Langfuse.
- Bug prod trovato nel mentre: **Zod server `max_tokens` max 8192 vs
  16384 mandati dal websiteOrchestrator → 400 validation su OGNI step
  website in prod** (dev proxy locale non valida → solo prod si rompeva;
  root cause "Genera bozze AI → website fallisce in PROD"). Fix:
  max 16384 in entrambi gli schemi `/ai/chat` + test (accetta 16384,
  rifiuta 20000). Aggiornato anche lo schema spec in ai.test.ts.
- Test: 5 nuovi (tool exec, runTrace propagation, tool fail, no-tool
  stop, include filter). **3033 verdi**, typecheck 0, build zero-warning.
- Wiring CRM (useAutoBuildGenerate → agente con flag) = step successivo
  (ticket separato quando serve).

## Question

Agente orchestratore con harness (tools) per ogni oggetto: logo, card,
flyer, website. L'AI pianifica, decide cosa generare, delega ai
sub-orchestratori esistenti (`src/ai/*Orchestrator.ts`), ogni chiamata
resta tracciata come span figlio (T7 già pronto).

Cosa include:

1. **Tools harness** (in `src/ai/tools/` o `src/ai/agentTools/`):
   `generate_logo(brief)` / `generate_card(brief)` /
   `generate_flyer(brief)` / `generate_website(brief)` — ogni tool
   esegue l'orchestratore esistente con briefContext, providerId,
   customerId, sessionId e propagazione runTrace (T7).
2. **Agente orchestratore** (`src/ai/agentOrchestrator.ts`): unico
   system prompt (planning) + tool registry; loop plan→act con max
   iterazioni (es. 8); fallback provider; output aggregato per
   oggetto. **NON** un nuovo framework — estende `ToolAwareOrchestrator`
   esistente (YAGNI: niente LangGraph, decisione T1).
3. **Wiring CRM**: "Genera bozze AI" (`useAutoBuildGenerate`) →
   agente opzionale (flag) vs sequenza fissa attuale.
4. **Trace gerarchica**: ogni tool call = span `agent:<runName>:<tool>`
   → generation figlia; l'agente è il root `agent:auto-build-agent`.
5. **Test**: registry tools (mock orchestratori), agente loop (max
   iter, tool fail, fallback), payload OTLP con tool span.

Output: commit dedicato, `npm run typecheck && npm run test` verdi,
nota done.md, mappa aggiornata.
