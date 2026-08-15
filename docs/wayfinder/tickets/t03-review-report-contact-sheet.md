# T3 — Review report + contact sheet, decidere i fix

Labels: wayfinder:ticket, task (AFK)
Blocked by: t02-esegui-verifica-live-chiccheria
Status: closed, assigned to opencode

## Risoluzione

Review visiva degli artefatti (screenshot + export, 2026-08-13):

- **Card**: OK — foto AI nello slot sinistro, cover pattern, gerarchia
  22/16/14 rispettata, retro contatti leggibili + QR. Nessun fix.
- **Flyer**: OK — hero AI nitida, headline/sub/body/CTA completi,
  contatti nel body. Nessun fix.
- **Logo**: 1 problema confermato → fixato in sessione:
  **textBackdrop 'pill' disallineata** su layout horizontal +
  backgroundImage (anchor 'middle'): il box partiva dal CENTRO del
  testo → pill shiftata di metà testo, wordmark bianco scoperto sulla
  zona chiara dell'immagine AI. Fix in `svgBuilder.ts` (box.x =
  centro − metà larghezza) + regression test
  (`logoGenerator.v2-2.test.ts`). Il branch vertical/stacked era già
  corretto.
- Template righe verificate: tagline 0.42× ✓ (ratio 0.417 misurato),
  gerarchia card ✓, floor flyer ✓, hero/cover/photo ≥1000px ✓.

Nessun altro problema riproducibile: nessun nuovo ticket aperto.

## Question

Leggere i risultati di T2: `report.json` di entrambi gli script e i
contact sheet `e2e/__screenshots__/design-review/ai/compare/*.png`
(leggibili via Read tool, sono PNG). Verificare ogni riga del template
di review (leggibilità = check visivo):

- **Logo**: tagline leggibile (0.42× wordmark), contrasto su
  backgroundImage, bordo pulito a 1024px.
- **Card**: gerarchia 22/16/14, contatti retro leggibili, coerenza
  wrap/font preview ↔ export.
- **Flyer**: floor stampa (headline 24pt / body 10pt), sezioni spaziate,
  hero non sfocata.

Output: per ogni problema confermato, un ticket figlio nuovo
(create-then-wire) con root cause ipotizzata e file da toccare. Problemi
non riproducibili o già coperti → nota in Risoluzione, niente ticket.
