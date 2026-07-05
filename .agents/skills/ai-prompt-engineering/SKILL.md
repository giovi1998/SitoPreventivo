---
description: Use when writing or modifying system prompts in src/ai/prompts/*.ts or orchestrators in src/ai/*Orchestrator.ts. Critical rules for AI prompt engineering in this project.
---

# Skill: ai-prompt-engineering

## Overview

System prompt = stringa template literal, lingua italiano. Ogni builder
deve essere una funzione pura `(args?) => string`, no I/O, no side effect.
Output: SOLO JSON valido in modalità MODIFICA, testo libero in ANALISI.

## Modalità

- **ANALISI**: prompt chiede suggerimenti, opinioni, "cosa miglioreresti",
  "analizza", "spiega", "come posso" → TESTO LIBERO in italiano,
  lista numerata di suggerimenti concreti e azionabili. NO JSON, NO tool.
- **MODIFICA**: prompt chiede azione (applica, cambia, rinomina, semplifica,
  elimina, aggiungi) → JSON completo del preventivo / card / flyer.
- **NUMERICA** (solo quote): prompt chiede sconti, margini, arrotondamenti
  → usa i tool (`apply_discount`, `adjust_margin`, ecc.).

## JSON contract

Ogni modulo (card, flyer) DEVE documentare esplicitamente nel prompt
lo schema JSON atteso, con esempi e limiti char. L'AI vede lo schema
e lo rispetta; il merge lato client valida via Zod.

## Anti-hallucination (regole stringenti)

- Niente campi fuori schema (Zod strippa via safeParse, output perso).
- Niente `photoUrl` / `logoUrl` inviati (sono base64 user-uploaded;
  il merge li ignora completamente, inviare un valore è inutile).
- Niente grid a `(0,0,1,1)` per tutti gli elementi (segnale classico
  di output casuale). Se non sai dove mettere un elemento, OMETTILO.
- Niente `visible: false` / `enabled: false` / `opacity` / `rotation` /
  `zIndex` (campi non in schema).
- Niente URL inventati per social (usa "XXXXX" come marker se vuoto).
- Niente prezzi inventati se l'utente non li chiede esplicitamente.

## Esempi negativi

Prefissa sempre "NON " in maiuscolo per rilevabilità:
- "NON restituire JSON parziale con `...` per omissione"
- "NON inventare campi fuori schema"
- "NON inviare photoUrl o logoUrl"

## Palette predefinite (card)

| Stile | bgColor | textColor | accentColor |
|-------|---------|-----------|-------------|
| premium | #ffffff | #1a1a1a | #1e3a5f / #8b0000 / #01696F |
| minimal | #ffffff | #1a1a1a | #333333 |
| moderno | #0F1117 | #ffffff | #FF3B3B |
| classico | #ffffff | #1A1A1A | #E62020 |

NON mescolare palette. NON lasciare l'AI scegliere colori a caso.

## Quando allargare cella vs fontScale (card)

- "testo più grande" → `style.fontScale = 1.2` (mantiene layout)
- "foto più grande" → aumenta `grid.elements.photo.w`
- "QR più grande" in flexbox → `back.qrSize: 'large'`
- "QR più grande" in grid → aumenta `grid.elements.qr.w/h`

## Density target (flyer)

- `low` → headline + subheadline + CTA, body ≤200 char (layout centered/split)
- `medium` → + body 200-800 char (layout classic/magazine)

NON superare i limiti del density target.

## Vincoli di lunghezza

- Compact prompt (default): ≤2500 char (per ridurre costi token input).
- Full prompt: ≤3500 char.
- system prompt: ≤2000 char.
- user prompt: ≤1500 char (compreso brief).

## Signature dei builder

Tutti i builder devono avere signature esportata e tipata:

```typescript
export function buildXxxSystemPrompt(): string;
export function buildXxxUserPrompt(args): string; // no I/O
export function sanitizeXxxBrief(input: string): string; // pure
```

## Registry centralizzato

Tutti i prompt vanno registrati in `src/ai/prompts/registry.ts`
(`promptRegistry`) con id + description. Non importare direttamente
`buildXxx` dagli orchestratori: usare `promptRegistry.getPrompt(id, ctx)`.

## Riferimenti

- `src/ai/prompts/system.ts` (quote)
- `src/ai/prompts/cardSystem.ts` (card)
- `src/ai/prompts/flyerSystem.ts` (flyer)
- `src/ai/prompts/logoSystem.ts` (logo v2 ready)
- `src/ai/prompts/socialSystem.ts` (cross-module)
- `src/ai/prompts/onboardingSystem.ts` (onboarding AI)
- `src/ai/prompts/registry.ts` (promptRegistry)
- `src/utils/documentSchemas.ts` (Logo, Card, Flyer schema)
- `src/ai/aiCardInputSchema.ts` (Zod card)
- AGENTS.md sezione "Active Skills"
