# Ticket: Auto-revisione qualità estesa — verify card/flyer/logo (t18)

Labels: `wayfinder:ticket`, `wayfinder:grilling`
Blocked by: —
Status: closed, assigned to opencode

## Question

Il verify AI (genera → verifica → rigenera) oggi è solo per website.
La stessa funzione di controllo qualità dovrebbe estendersi a card/flyer/logo.

## Decisions

Deciso in sessione 2026-08-20:
- **Sì, tutti e 3** (card / flyer / logo).
- Solo `agentMode` CRM (costo contenuto, gating vision).
- Post-loop, **singola call** `verify` con i 3 preview insieme.
- Max 1 regeneration per oggetto.
- Vision self-review: screenshot preview → modello vision → verdetto pass/retry.

## Implementation

- `src/ai/verifyOrchestrator.ts` — nuovo orchestratore, 1 call AI con
  immagini dei draft. Output JSON `{logo,card,flyer}.verdict` e `reason`.
- `src/utils/verifyRender.ts` — rasterizza logo/card/flyer in PNG data URL
  via `builderToSvg`, `buildCardSvg`, `buildFlyerSvg`, `svgToPng`.
- `src/hooks/useAutoBuildGenerate.ts`:
  - `runVerifyAfterAgent()` chiamato post-loop in `agentMode` solo se
    vision enabled.
  - Per ogni `retry`, rigenera il singolo oggetto con `runDoc` e la
    motivazione come `userPrompt` focus.
  - `lastDataByTypeRef` tiene traccia dei draft finali per il render.
- `src/ai/__tests__/verifyOrchestrator.test.ts` — 5 tests.
- `src/utils/__tests__/runState.test.ts` condivide lo stesso pattern di
  persistenza per t17.

Closed 2026-08-20.
