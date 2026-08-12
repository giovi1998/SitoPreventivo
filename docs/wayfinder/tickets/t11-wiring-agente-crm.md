# Ticket: Wiring agente nel flusso CRM "Genera bozze AI"

Labels: `wayfinder:ticket`, `wayfinder:task`
Blocked by: —
Status: closed (2026-08-12, resolution below)

## Question

Collegare l'`AgentOrchestrator` (T9) al flusso CRM: "Genera bozze AI" usa
l'agente con harness tools invece della sequenza fissa, con UI stato
per-step.

## Risoluzione

- `CustomerDetail.handleGenerateAll` → `generateAll(..., { agentMode: true })`.
- `useAutoBuildGenerate` (generateAll): ramo `agentMode` — genera
  runId/rootSpanId, chiama `AgentOrchestrator.run` con `include` = doc
  pending, `onToolResult` salva il data mappato sul doc (saveDraft) e
  aggiorna status/errors; fallimento agente → error su tutti i non-done.
- `src/ai/agentSave.ts`: helper puri — `buildAgentBrief(docs, customer)`
  (brief best-effort da briefContext + customer), `agentResultData(docType,
  result)` (tool result → data da salvare per logo/card/flyer/website),
  `docTypeOfTool`.
- UI stato: `currentStep` mostra `Agente: pianifico…` poi
  `Agente: ✓/✗ generate_<oggetto> (N tools)`; i badge per-doc restano
  invariati (done/error).
- `AgentOrchestrator.onToolResult` ora `void | Promise<void>` (awaitato:
  prima il save del chiamante era fire-and-forget).
- Test: +1 hook agentMode (delega + save tool result ok/error), expected
  options CustomerDetail aggiornato (agentMode: true). **3034 verdi**,
  typecheck 0, build zero-warning.
- **UI editor singoli: NESSUN agente** — logo/card/flyer hanno i loro
  tool registry dedicati (card_apply_palette, flyer_shorten_body...);
  l'agente ha senso solo nel flusso multi-oggetto CRM (YAGNI, decisione
  T11).
