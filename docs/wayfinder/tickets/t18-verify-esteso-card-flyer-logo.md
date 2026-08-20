# Ticket: Auto-revisione qualità estesa — verify card/flyer/logo (t18)

Labels: `wayfinder:ticket`, `wayfinder:grilling`
Blocked by: —
Status: open, unassigned

## Question

Il verify AI (genera → verifica → rigenera) oggi è solo per website
(`website-system` user-prompt). La stessa funzione di controllo qualità
dovrebbe estendersi a card/flyer/logo.

Deciso in sessione 2026-08-20: **sì, tutti e 3.**

Scope (da definire nel ticket di implementazione):
- Card: layout, contrasto, no overlap, font-size, wrap → verdetto
  pass/regenera
- Flyer: floor stampa minimo, headline, budget copy → pass/regenera
- Logo: concetti validi (no fallback "Brand"), background AI
  applicato, tagline leggibile → pass/regenera

Soglia: verdetto `pass`/`retry` con motivazione dal modello (non solo
applicato/ok: il concept "Brand" fallback è un esempio di falso
positivo).
Costo: ~1 call AI aggiuntiva per oggetto — valutare se solo in
`agentMode` (CRM) o sempre.

Domande aperte:
1. Dove chiama verify: solo `agentMode` CRM o anche editor singoli? —
   consiglio: solo CRM (costo) + editor con toggle.
2. Come integrare: loop verify→regenerate nel `executeTool` agente o
   nuovo step post-generazione? — consiglio: post-loop, singola call
   `verify_docs` con tutti i 3 oggetti insieme (1 call vs 3).
3. Fallback: max 1 regeneration per oggetto (bounded), poi warning.
4. Budget: aggiungere soglia verify a t15 (warning visibile).

## Aggiornamento 2026-08-20 (seconda grilling)

Aggiunto **vision self-review**: dopo la generazione, si renderizza la
preview (canvas/SVG) → screenshot → modello vision giudica layout/contrasto
→ fix/rigenera. Integrato nel verify esteso (t18), non ticket separato.
Costo: +1 call vision per oggetto — già gating visionEnabled (CON-MM-002).
Anche qui: solo CRM + toggle editor, bounded 1 retry, soglia budget t15.