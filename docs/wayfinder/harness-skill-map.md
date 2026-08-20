# Mappa: Harness AI + skill di progetto — wayfinder:map

## Destination

L'harness AI di Quickbrand (orchestratori editor + agente CRM) sfrutta
appieno le risorse già presenti nel progetto: skill di design richiamabili
dall'AI, loop agente robusto, costi sotto controllo. Il filone skills
(injection per kind + tool `load_skill`) è implementato in-map il
2026-08-20 (branch `feat/ai-skill-harness`); questa mappa tiene le
decisioni residue per completare il percorso.

## Notes

- Execution in-map per il filone skills, approvata dall'utente in sessione.
- Skill da consultare ogni sessione: `lean-code`, `test-driven-development`,
  `ai-prompt-engineering` (prompt/registry). A fine task AI: verifica trace
  su Langfuse (regola AGENTS.md).
- Precedenti correlati (closed): [t09-agente-harness-tool-per-oggetto],
  [t11-wiring-agente-crm] (l'agente è in UI CRM dal 2026-08-12 via
  `agentMode` — AGENTS.md aggiornato il 2026-08-20, era stale).

## Decisions so far

- [Skill library — filone implementato](../done.md, 2026-08-20) — catalogo
  curato kind→skill, contenuto `?raw` lazy, injection DOPO
  `promptRegistry.getPrompt` (componibile con override Langfuse), tool
  `load_skill` nell'agente non filtrato da `include`.

## Not yet specified

- Skill selettive per i sub-prompt website (html/css/js/page per fase,
  es. css→high-end-visual-design): prima serve il verdetto del ticket sul
  controllo utente, è lo stesso meccanismo di selezione.
- Esecuzione tool agent in parallelo (`Promise.allSettled` su toolCalls
  indipendenti): dipende da quanto pesa la serializzazione misurata in
  [t12-loop-hardening].
- Distillazione selettiva per skill grandi (imagegen-* 37-42K) se il
  catalogo dovrà ampliare oltre il cap 20K.
- Sync descrizioni catalogo da frontmetadata vs hardcoded (oggi italiane,
  curate).

## Out of scope

- Migrazione skill → Langfuse Prompt Management: i system prompt sono già
  gestiti lì (TB-029 fase 2); le skill sono risorse repo del progetto.
- Nuove skill di design nel repo: è contenuto, non harness.
