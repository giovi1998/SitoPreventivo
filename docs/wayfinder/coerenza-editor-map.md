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

- [T1 - Audit card editor](tickets/c01-audit-card-editor.md) — verde: azioni+layout coerenti, rail destra, FAB sheet, nessun P0-P1.
- [T2 - Audit flyer editor](tickets/c02-audit-flyer-editor.md) — verde: template/AI copy/hero/export, rail destra 420px coerente, save-guard.
- [T3 - Audit logo editor](tickets/c03-audit-logo-editor.md) — verde: save-guard, export 9 formati, placeholder mai successo, chat TTL 24h.
- [T4 - Audit website editor](tickets/c04-audit-website-editor.md) — verde: brief/genera/verify/fix/picker/refine/ZIP, rail 320px, picker mobile fix.
- [T5 - Audit editor minori + azioni globali](tickets/c05-audit-minori-globali.md) — verde: preventivo/QR/social/Collection/ActionBar/Settings ok; empty states per-tab, toast ovunque.
- [C6 - Design tokens editor (advisory detector)](tickets/c06-design-tokens-editor.md) — ticket derivato: ~100 advisory token hardcoded (pre-token legacy, non drift), azione quando esiste DESIGN.md tokens.

## Frontier (ticket aperti)

- [C6 - Design tokens editor](tickets/c06-design-tokens-editor.md) — differito (attende DESIGN.md).

## Not yet specified

- **Design tokens cross-editor**: spacing/radius/shadow variano tra editor
  (es. SocialEditor usa var(--radius-lg), card usa px)? Mappatura emersa
  dal ticket C6: hardcoded pre-token, attende DESIGN.md.
- **Stati vuoti**: ogni editor ha empty state coerente (social ce l'ha,
  altri?)? — Verificato in T5: save-guard con toast "Compila almeno…"
  in QR/logo/flyer + EmptyState Collection per-tab. Rimane: card non ha
  empty state dedicato oltre al template banner (non bloccante, mock-up
  già presenti).

## Out of scope

- Qualità output AI (prompt/costo/trace): mappa `langfuse-agentic-map.md`.
- Qualità visiva degli OGGETTI generati (card/flyer/logo render):
  mappa `qualita-oggetti-map.md` (chiusa, guardia in CI T9).
- Nuove feature: qui si audita l'esistente, non si aggiunge scope.
