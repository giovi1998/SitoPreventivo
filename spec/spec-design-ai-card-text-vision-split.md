---
id: spec-design-ai-card-text-vision-split
title: AI Card — Text/Vision Split Architecture
status: draft
created: 2026-07-07
tags: [ai, card, deepseek, gemini, vision, architecture]
---

# AI Card — Text/Vision Split Architecture

## Context

The card editor has two AI flows that currently interfere with each
other:

1. **Text AI (DeepSeek)** — modifies the card JSON (layout, palette,
   grid positions, services, etc.). Triggered by the "Stile veloce"
   chips and the "Prompt libero" textarea.
2. **Cover AI (Gemini Nano Banana)** — generates an abstract
   background image. Triggered by the "Sfondo AI" buttons.

These two flows must remain **fully independent**: DeepSeek never
receives images, Gemini never receives the card JSON. The current
architecture already enforces this separation at the context level
(`buildCardAIContext` strips `photoUrl`, `logoUrl`, `coverImageUrl`
before sending to DeepSeek), but the UX does not make the split
explicit and there is no vision path.

## Problem

1. **User confusion**: a single prompt ("ottimizza per la stampa")
   goes to DeepSeek (text), but the user may expect it to also
   affect the cover image (Gemini). The two models serve different
   purposes and cannot be mixed.
2. **Vision not supported by DeepSeek**: if an image accidentally
   leaks into the DeepSeek payload, the API returns `ERROR: Cannot
   read "image.png" (this model does not support image input)`.
3. **No vision path for Gemini text model**: Gemini `gemini-3.1-flash-image`
   is an image-generation model. A future vision-capable Gemini text
   model (e.g. `gemini-2.5-flash`) could receive the card preview
   screenshot as vision input for "analyze contrast for print" style
   requests, but this is out of scope for now.

## Requirements

### REQ-001: Strict payload isolation

- DeepSeek (`/api/ai/chat/stream`) receives ONLY text: the system
  prompt, the card JSON (without base64 images), and the user prompt.
  `buildCardAIContext` (`src/ai/prompts/cardContext.ts`) MUST strip
  `photoUrl`, `logoUrl`, `coverImageUrl` from `card.front` before
  building the payload. No `image/png`, `image/jpeg`, `image/svg+xml`
  data URLs may reach DeepSeek.
- Gemini (`/api/ai/card-cover`, `/api/ai/logo-background`) receives
  ONLY the text prompt (Nano-Banana formula) and the card context
  string. No card JSON, no base64 images.

### REQ-002: UX makes the split explicit

The AI panel (`CardAIControls.tsx`) has three sections that already
reflect the split:

| Section | Model | Purpose |
|---------|-------|---------|
| Sfondo AI | Gemini | Background image generation |
| Stile veloce | DeepSeek | Quick card JSON modifications |
| Prompt libero | DeepSeek | Free-form card JSON modifications |

The microcopy must clarify that:
- "Sfondo AI" generates a **new background image** (Gemini).
- "Stile veloce" and "Prompt libero" modify **card fields** (text,
  colors, layout, grid) via DeepSeek and do NOT touch the cover image.

### REQ-003: Prompt libero never reaches Gemini

The free-form prompt textarea ("Prompt libero") is wired to
`runCardAI('custom')` which calls DeepSeek. It must NEVER call
Gemini. If the user types "genera uno sfondo blu", the AI should
interpret it as a card style change (`style.bgColor`) via DeepSeek,
not as a cover generation request.

### REQ-004: Cover prompt is not user-editable

The cover prompt is built by `buildCardCoverBrief` (Nano-Banana
formula v3.0) and sent to Gemini. The user does not see or edit the
raw prompt. The user only clicks "Genera fronte / retro / entrambi".

### REQ-005: No image input to any model (vision out of scope)

Neither DeepSeek nor Gemini receive user-uploaded images as vision
input in this iteration. A future spec (`spec-design-ai-card-vision-input`)
may introduce vision for print-contrast analysis, but it requires a
vision-capable model (Gemini `gemini-2.5-flash`, not DeepSeek).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CardAIControls (UI)                      │
├──────────────┬──────────────────────┬────────────────────────┤
│  Sfondo AI   │   Stile veloce       │   Prompt libero         │
│  (Gemini)    │   (DeepSeek)         │   (DeepSeek)            │
│              │                      │                        │
│  Genera →    │  Chips →             │  Textarea →             │
│  handleGen-  │  runCardAI(mode)     │  runCardAI('custom')    │
│  erateCover  │                      │                        │
└──────┬───────┴──────────┬───────────┴────────────────────────┘
       │                  │
       ▼                  ▼
┌──────────────┐   ┌──────────────────────────────────────────┐
│  Gemini      │   │  DeepSeek                                │
│  /ai/card-   │   │  /api/ai/chat/stream                      │
│  cover       │   │                                          │
│              │   │  buildCardAIContext(card, prompt)        │
│  prompt:     │   │    strips photoUrl, logoUrl,             │
│  Nano-Banana │   │    coverImageUrl from card.front          │
│  formula     │   │                                          │
│  (v3.0)      │   │  payload = { front, back, style, grid }   │
│              │   │  (NO base64 images)                       │
│  context:    │   │                                          │
│  card layout │   │  system: buildCardSystemPrompt()          │
│  (no base64) │   │  user: "Bigliettino: {payload} Richiesta" │
└──────────────┘   └──────────────────────────────────────────┘
```

## Guardrails (already enforced)

1. `buildCardAIContext` strips `photoUrl`, `logoUrl`, `coverImageUrl`
   from `card.front` → DeepSeek never sees base64.
2. `buildCardCoverBrief` builds the Gemini prompt from card palette
   + grid layout, no base64 → Gemini never sees card content.
3. `api/index.ts` validatore `/ai/card-cover`: `context.max(2000)`,
   allineato con `MAX_CONTEXT_LEN` in `coverBrief.ts`.
4. Prompt cover v3.0: formula Nano-Banana, Negative Constraint Logic,
   proibizioni hard su text/QR/logos/faces/people/real objects.

## Out of scope

- Vision input (screenshot card → model for contrast analysis):
  futuro spec `spec-design-ai-card-vision-input`.
- Gemini text model for card JSON modifications: DeepSeek remains
  the only text AI for cards.
- User-editable cover prompt: the Nano-Banana prompt is built
  programmatically, not exposed to the user.

## Test plan

- `cardContext.test.ts`: `coverImageUrl` non presente nel payload
  DeepSeek (già esistente).
- `coverBrief.test.ts`: prompt v3.0 ha formula Nano-Banana, Negative
  Constraint Logic (già esistente).
- `useAICard.test.ts`: `processCardPrompt` non manda immagini a
  DeepSeek, `generateCover` non manda JSON card a Gemini.
- E2E: "Genera entrambi i lati" produce immagine, "Premium" modifica
  JSON senza rompere la cover esistente.