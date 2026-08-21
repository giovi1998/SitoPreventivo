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
- [Resume run agente — stato minimo](../wayfinder/tickets/t17-resume-run-minimo.md, 2026-08-20) — closed: sessionStorage `pq_autobuild_run:v1`, resume filtra done, clear a fine.
- [Auto-revisione verify estesa a card/flyer/logo](../wayfinder/tickets/t18-verify-esteso-card-flyer-logo.md, 2026-08-20) — closed: verifyOrchestrator con 1 call vision sui 3 preview, max 1 retry in agentMode.
- [Refactor useAICall shared hook](../wayfinder/tickets/t16-refactor-useAICall-hook.md, 2026-08-20) — task AFK: elimina duplicazioni useAI*.ts, zero feature nuove.
- [Best-of-N interno per copy](../wayfinder/tickets/t19-best-of-n-interno.md, 2026-08-20) — task: 3 varianti in 1 call flyer+card+logo, fallback first variant.
- [Few-shot golden per editor](../wayfinder/tickets/t20-few-shot-golden-per-editor.md, 2026-08-20) — task HITL: inserimento inline esempi buoni nei system prompt.
- [Coherence pass post-run](../wayfinder/tickets/t21-coherence-pass-post-run.md, 2026-08-20) — task: palette/font unificati cross-object CRM, JSON patch merge.
- [Post-check deterministico flyer+logo](../wayfinder/tickets/t22-post-check-deterministico-flyer-logo.md, 2026-08-20) — task: clamp font/color/collisioni, zero costo AI.
- [Loop hardening — early-stop](../wayfinder/tickets/t12-loop-hardening.md, 2026-08-20) — chiuso: misura Langfuse (9/30 run bloccati su verify:fix) → 2 fallimenti consecutivi = round di sintesi + stop. Dedup args non giustificato dai dati. Commit 45502e3.
- [Toggle skill per-documento](../wayfinder/tickets/t13-controllo-utente-skill.md, 2026-08-20) — chiuso: toggle "Skill design" in AIConsole (auto-wired per kind con skill), pref `aiSkillDisabledByKind` in pq_ui:v1, skip injection. Commit 304dca8.
- [Skill condizionali per stile website](../wayfinder/tickets/t14-skill-condizionali-stile-website.md, 2026-08-20) — chiuso: STYLE_SKILL_MAP (brutalist→industrial-brutalist-ui, minimal→minimalist-ui, editorial→gpt-taste), sostituzione costo zero, ctx style in tutte le call website. Commit 1e14fc0.
- [Budget costi per documento — warning visibile](../wayfinder/tickets/t15-budget-costi-skill.md, 2026-08-20) — chiuso: badge arancione oltre soglia $X in DocumentAiStats, nessun blocco. Soglia da definire al widget.

## Not yet specified

- kimi-k3:cloud flat dal 2026-08-20 (fix 7a8db6a): tutto Ollama è
  flat $20/mo; tabella pay-per-token vuota nei 3 livelli.

## Ticket aperti (harness)

- [Widget soglia budget in DocumentAiStats](../wayfinder/tickets/t23-widget-soglia-budget.md) — task: badge arancione oltre soglia $X, no blocco.
- [Bug trace Langfuse — root duplicata + generazione orfana](../wayfinder/tickets/t24-trace-root-duplicata-generazione-orfana.md) — research: gerarchia trace agent rotta (collegato t07).

## Out of scope

- Migrazione skill → Langfuse Prompt Management: i system prompt sono già
  gestiti lì (TB-029 fase 2); le skill sono risorse repo del progetto.
- Nuove skill di design nel repo: è contenuto, non harness.
