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
- [Budget costi per documento — warning visibile](../wayfinder/tickets/t15-budget-costi-skill.md, 2026-08-20) — oltre soglia $X badge arancione in DocumentAiStats, nessun blocco hard. Soglia da definire al widget.
- [Toggle skill per-documento — utente vuole il controllo](../wayfinder/tickets/t13-controllo-utente-skill.md, 2026-08-20) — verdetto sull'UI da valutare col prototipo; ticket ancora open per la demo.
- [Resume run agente — stato minimo](../wayfinder/tickets/t17-resume-run-minimo.md, 2026-08-20) — runId + steps + resumeKey, niente resume cross-session.
- [Auto-revisione verify estesa a card/flyer/logo](../wayfinder/tickets/t18-verify-esteso-card-flyer-logo.md, 2026-08-20) — sì, tutti e 3: verdetto pass/regenera.
- [Refactor useAICall shared hook](../wayfinder/tickets/t16-refactor-useAICall-hook.md, 2026-08-20) — task AFK: elimina duplicazioni useAI*.ts, zero feature nuove.
- [Best-of-N interno per copy](../wayfinder/tickets/t19-best-of-n-interno.md, 2026-08-20) — task: 3 varianti in 1 call flyer+card+logo, fallback first variant.
- [Few-shot golden per editor](../wayfinder/tickets/t20-few-shot-golden-per-editor.md, 2026-08-20) — task HITL: inserimento inline esempi buoni nei system prompt.
- [Coherence pass post-run](../wayfinder/tickets/t21-coherence-pass-post-run.md, 2026-08-20) — task: palette/font unificati cross-object CRM, JSON patch merge.
- [Post-check deterministico flyer+logo](../wayfinder/tickets/t22-post-check-deterministico-flyer-logo.md, 2026-08-20) — task: clamp font/color/collisioni, zero costo AI.

## Not yet specified

- Skill condizionali per stile del sito web (t14) — attesa misura qualità
  per stile vs skill fissa, ticket di implementazione da creare quando
  misurato.

## Out of scope

- Migrazione skill → Langfuse Prompt Management: i system prompt sono già
  gestiti lì (TB-029 fase 2); le skill sono risorse repo del progetto.
- Nuove skill di design nel repo: è contenuto, non harness.
