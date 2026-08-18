# wayfinder:map - Coerenza azioni + layout tutti gli editor

## Destination

Ogni editor (preventivo, QR, card, logo, flyer, social, website) e le
azioni globali (Collection, ActionBar, export, save) verificati su due
assi: **funzionale** (ogni azione fa ciò che promette: stati
loading/error/empty, toast, niente dead button) e **layout** (gerarchia,
spacing, responsive 767/1023, coerenza visiva tra editor — skill
`impeccable`, modo Operate). Output per ticket: lista problemi trovati
con fix applicato o ticket derivato. Richiesta utente 2026-08-18:
"tutti gli oggetti/tutte le azioni funzionano coerentemente e sono
belle a livello di layout?"

## Notes

- Dominio: editor in `src/components/` + `src/pages/app/`, azioni
  globali (Collection export ZIP, ActionBar save/export, toast).
- Skill: `impeccable` (critique/audit playbook, modo Operate: scanabilità
  e consistenza > espressione), `web-design-guidelines` (a11y),
  `lean-code` per ogni fix.
- Verifica: Playwright live per flussi, vitest per regressioni; breakpoint
  canonici 767/1023 (gotcha §24).
- Fix piccoli si applicano nel ticket stesso; fix strutturali diventano
  ticket derivati.

## Decisions so far

<!-- una riga per ticket chiuso: titolo link + gist -->

## Frontier (ticket aperti)

- [T1 - Audit card editor](tickets/c01-audit-card-editor.md)
- [T2 - Audit flyer editor](tickets/c02-audit-flyer-editor.md)
- [T3 - Audit logo editor](tickets/c03-audit-logo-editor.md)
- [T4 - Audit website editor](tickets/c04-audit-website-editor.md)
- [T5 - Audit editor minori + azioni globali](tickets/c05-audit-minori-globali.md)

## Not yet specified

- **Design tokens cross-editor**: spacing/radius/shadow variano tra editor
  (es. SocialEditor usa var(--radius-lg), card usa px)? Mappatura completa
  emerge dal primo ticket.
- **Stati vuoti**: ogni editor ha empty state coerente (social ce l'ha,
  altri?)?

## Out of scope

- Qualità output AI (prompt/costo/trace): mappa `langfuse-agentic-map.md`.
- Qualità visiva degli OGGETTI generati (card/flyer/logo render):
  mappa `qualita-oggetti-map.md` (chiusa, guardia in CI T9).
- Nuove feature: qui si audita l'esistente, non si aggiunge scope.
