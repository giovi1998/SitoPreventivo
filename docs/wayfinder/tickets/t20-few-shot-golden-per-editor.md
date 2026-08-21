# Ticket: Few-shot golden per editor — inject esempio ideale (t20)

Labels: `wayfinder:ticket`, `wayfinder:task`
Blocked by: —
Status: closed (2026-08-20, implementation in feat/ai-skill-harness)

## Question

Il prompt system di ogni editor genera da zero. Aggiungiamo **1 esempio
perfetto inline** (few-shot) per editor — il modello impara il target di
qualità. Più efficace di un prompt più lungo. Gratis (token fissi).

Scope (deciso in sessione 2026-08-20, utente cura gli esempi — HITL):

- **Card** (`card-system`): output card ideale (grid, palette, style).
  Esempio: card Giovanni 2026-08-12 (output buono recente).
- **Flyer** (`flyer-system`): output flyer ideale (copy, budget).
- **Logo** (`logo-system`): output 3-concepts ideale (imagePrompt incluso).
- **Social** (`social-system`): output caption+imagePrompt ideale.
- **Website** (`website-system`): output sito multi-pagina ideale.

Esempio scelto → lo inseriamo direttamente nel builder prompt
(`promptRegistry.getPrompt`) dopo il CRAFT FLOOR. Marker per distinguere
(«## Esempio ideale»). Injection statica (no costo dinamico).

Da NON fare (candidates rimossi): pool di esempi (token explosion),
esempi dinamici da customer (overkill, rischio cross-contenuto).

**HITL**: l'utente deve fornire gli esempi (output recenti buoni).

## Implementation (2026-08-20)
- `src/ai/prompts/goldenExamples.ts` — 5 esempi ideali (card Giovanni, flyer Sagra, logo pasticceria, social 3 post, website Osteria Thai).
- Injection dopo CRAFT FLOOR in `cardSystem.ts`, `flyerSystem.ts`, `logoSystem.ts`, `socialSystem.ts`, `websiteSystem.ts` via `GOLDEN_*_EXAMPLE`.
- L'utente valida/migliora gli esempi in follow-up (commit dedicato).