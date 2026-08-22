# Ticket: Resume run agente — stato minimo (t17)

Labels: `wayfinder:ticket`, `wayfinder:grilling`
Blocked by: —
Status: closed, assigned to opencode

## Question

Oggi "Genera bozze AI" (`useAutoBuildGenerate`) riparte sempre da zero:
ogni oggetto riparte da createEmpty, il run fallito non si riprende e gli
errori sono "tutto o niente". L'utente vuole poter dire "rifai solo il
logo" o riprendere dove si è fermato.

## Decisions

Deciso in sessione 2026-08-20:
- Luogo: `sessionStorage`, chiave `pq_autobuild_run:v1`.
- TTL: 30 min in-memory.
- Trigger: auto-resume al click "Genera bozze" — salta i done, riprova gli error.
- Stato minimo: `runId`, `customerId`, `startedAt`, `steps: {step, status}`.

## Implementation

- `src/utils/runState.ts` — save/load/clear sessionStorage.
- `src/hooks/useAutoBuildGenerate.ts`:
  - `generateAll` carica `loadRunState(customerId)` e filtra i target già done.
  - Riutilizza il `runId` precedente per la stessa trace Langfuse.
  - `persistRunState()` salva dopo ogni step.
  - Clear a run completata.
- `src/utils/__tests__/runState.test.ts` — 4 tests.

Closed 2026-08-20.
