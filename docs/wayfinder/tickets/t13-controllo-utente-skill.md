# Ticket: Controllo utente sulle skill iniettate negli editor

Labels: `wayfinder:ticket`, `wayfinder:prototype`
Blocked by: —
Status: closed (2026-08-20, resolution below)

## Risoluzione

Toggle implementato (prototipo minimo, 2026-08-20):

- `pq_ui:v1` nuova pref `aiSkillDisabledByKind` + `isAiSkillDisabled`/
  `setAiSkillDisabled` in `src/utils/uiPrefs.ts`.
- `AIConsole` auto-wired: per kind con skill curata (card/flyer/logo/
  social/website/palette, via `EDITOR_SKILL_KINDS`) mostra il toggle
  "Skill design" nella riga toggles, persistito, default on. Prop
  esterna `skillDisabled`/`onSkillToggle` per controllo da chiamante.
- `resolveSystemPrompt` (skillLibrary) salta l'injection se il kind è
  disattivato → prompt torna al base del registry (componibile con
  override Langfuse).
- Test: AIConsole (toggle visibile/persiste/nascosto su editor senza
  skill/controllo esterno) + skillLibrary (skill disattivata → prompt
  base). 26 verdi, typecheck pulito.

## Question

Oggi le skill di progetto sono always-on e invisibili: ogni call AI degli
editor le riceve in silenzio nel system prompt. L'utente deve poterle
vedere e scegliere (quick action nella AI Console: attiva/disattiva per
documento o per prossima call, cambio skill per kind)? **Verdetto utente
2026-08-20: sì, vogliamo la toggle per-documento/prossima call.** Resta
aperto il prototipo minimo (prototype, implementazione in ticket separato
t13b o in-session) da mostrare all'utente per go/no-go finale.

## Question

Oggi le skill di progetto sono always-on e invisibili: ogni call AI degli
editor le riceve in silenzio nel system prompt. L'utente deve poterle
vedere e scegliere (quick action nella AI Console: attiva/disattiva per
documento o per prossima call, cambio skill per kind)? Prototipo minimo
da valutare con l'utente: un'azione AI Console che mostri la skill attiva
del kind e permetta di escluderla. Il default resta on.
