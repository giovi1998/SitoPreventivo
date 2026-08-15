# T8 — Card non centrata in agent mode + website editor mobile rotto

## Problema

Due bug visivi emersi dopo la verifica live 2026-08-13 (ALL CHECKS PASS
sugli script, ma rendering reale in app diverso):

1. **Card generata dall'agente non centrata**: il tool `generate_card`
   dell'agente usava un prompt generico → l'AI ometteva layout/grid →
   preview in fallback legacy non centrata mentre l'export derivava la
   grid → preview ≠ export. Stesso problema per l'auto-build non-agente
   quando l'AI salvava `grid: {}` (oggetto vuoto, NON nullish).
2. **Website editor mobile rotto**: `.website-content` restava
   `1fr 320px` anche su mobile → colonna main ~54px → iframe preview
   largo 38px (invisibile). Inoltre il default viewport era desktop
   `100%` schiacciato e il tab partiva su `brief` anche per doc con
   contenuto.

## Fix

- `buildCardDraftPrompt` in `cardOrchestrator.ts`: prompt strutturale
  condiviso (STRUTTURA grid + TESTI + STILE) usato da auto-build
  non-agente E tool `generate_card` dell'agente.
- `ensureCardGrid` in `schemas/card.ts`: garantisce grid mode su card
  generata (deriva grid dal layout, setta `useGrid` su entrambi i lati);
  card già in grid restano invariate. Applicata in `agentSave.ts` e
  `useAutoBuildGenerate.ts`.
- `gridElements.ts`: null-safety su `front`/`back`/`grid.elements`
  (l'AI può salvare `grid: {}`).
- `useDocumentLoader.ts` + `WebsitePage.tsx`: `initialDoc` null (non
  undefined) durante il fetch di un doc mancante → fallback "Sito non
  trovato" invece di crash su `.html`.
- `WebsiteEditor.tsx` + `.css`: viewport default mobile 375px su
  workspace mobile, tab default `preview` se il doc ha contenuto, grid
  stack su `@media 1023px` (breakpoint canonico).

## Test

- `gridElements.test.ts`: `ensureCardGrid` (layout senza grid → derivata;
  già in grid → invariata).
- `cardOrchestrator.test.ts`: `buildCardDraftPrompt` chiede struttura.
- `useDocumentLoader.test.tsx`: `initialDoc` null durante fetch doc
  mancante.
- `e2e/breakpoints.spec.ts` AC-007: a 390px l'iframe preview website è
  full-width (>300px), non 38px.

## Stato

Chiuso 2026-08-14. Guardia anti-regressione permanente (item "Not yet
specified" della mappa) coperta da AC-007.
