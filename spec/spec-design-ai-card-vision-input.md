---
title: AI Card Vision Input - Front/Back/Grid Context to Gemini for Cover Generation
version: 1.0
date_created: 2026-07-06
last_updated: 2026-07-06
tags: [ai, card, gemini, image-generation, design, context, vision]
---

# Introduction

Il modulo Business Card ha due flussi AI separati:

1. **Layout AI** (DeepSeek via `CardAIOrchestrator`): modifica testo, colori,
   font, grid e layout del bigliettino. Riceve in input `front`, `back`,
   `style`, `grid`, `backGrid` (senza `photoUrl`/`logoUrl`/`coverImageUrl`
   perché base64 troppo grandi).
2. **Cover AI** (Gemini via `GeminiImageProvider.generateCardCover`): genera
   un'immagine di sfondo per il fronte. Attualmente riceve SOLO un prompt
   testuale costruito da `buildCardCoverPrompt(card)` in `useAICard.ts` e
   NON riceve in input la struttura front/back/grid del bigliettino.

L'utente segnala che la cover generata "non cambia nella card" e che il
risultato non è coerente con layout/grid/palette. Il gap è che Gemini non
"vede" la card: non sa dove sono foto, nome, logo, QR, né le proporzioni
della grid. Lo spec definisce come estendere il flusso Cover AI per
passare a Gemini il contesto strutturale front/back/grid insieme al
prompt visivo, in modo che l'immagine generata rispetti il layout reale
del bigliettino (spazi liberi, area foto, area testo, palette).

## 1. Purpose & Scope

Estendere il flusso Cover AI (`POST /ai/card-cover` + `useAICard.generateCover`
+ `GeminiImageProvider.generateCardCover`) per includere il contesto
strutturale del bigliettino (front, back, grid, backGrid, style) nella
chiamata a Gemini, in modo che l'immagine di sfondo sia coerente con:

- posizioni reali di foto/nome/titolo/azienda/logo sul fronte (grid)
- palette effettiva (`style.accentColor`, `bgColor`, `textColor`)
- proporzioni della grid (`cols × rows`) e area occupata dalla foto
- settore professionale dedotto da `front.title` / `front.company`
- presenza di QR/contatti sul retro (per eventuale coerenza visiva)

**Out of scope**:
- Generazione di foto profilo ritrattistica (resta upload manuale).
- Modifica del layout AI DeepSeek (già riceve front/back/grid).
- Vision input binario (screenshot): Gemini Nano Banana 2 accetta solo
  testo + prompt; non inviamo bitmap della card, inviamo una descrizione
  strutturata derivata dalla grid.

## 2. Definitions

- **Cover photo**: immagine di sfondo del fronte card, renderizzata come
  `<image>` full-bleed sopra il `<rect>` di base in `svgRenderer.ts`.
- **Cover context**: snapshot testuale della card (front/back/grid/style)
  inviato a Gemini insieme al prompt visivo.
- **Nano-Banana formula**: `Subject + Action + Context + Composition +
  Lighting + Style` (vedi skill `muapi-nano-banana`).
- **Grid area map**: descrizione testuale delle celle occupate sul fronte
  (`photo: cols 0-2 rows 0-4`, `name: cols 2-4 row 0`, ...).
- **Palette directive**: istruzione esplicita nel prompt con i 3 colori
  della card (`accent`, `bg`, `text`).

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: `useAICard.generateCover` costruisce un `coverContext`
  testuale a partire da `card.front`, `card.back`, `card.style`,
  `card.grid`, `card.backGrid` e lo invia al backend insieme al
  `coverPrompt`.
- **REQ-002**: `buildCardCoverPrompt` viene esteso (o sostituito da
  `buildCardCoverBrief`) per integrare la formula Nano-Banana e la
  palette directive, usando i colori reali della card.
- **REQ-003**: Il backend `POST /ai/card-cover` accetta un body esteso:
  `{ prompt: string, context?: string, userEmail?: string }`. Il
  `context` viene concatenato al `prompt` prima di chiamare
  `GeminiImageProvider.generateCardCover`.
- **REQ-004**: `GeminiImageProvider.generateCardCover` resta invariato
  nella signature (riceve solo il prompt testuale finale). La composizione
  prompt+context avviene nel backend, non nel provider, per mantenere il
  provider riutilizzabile.
- **REQ-005**: Il `coverContext` include una "grid area map" testuale
  che descrive dove si trovano foto/nome/titolo/azienda/logo sul fronte,
  in modo che Gemini generi uno sfondo con "spazi liberi" coerenti.
- **REQ-006**: Il prompt finale passa esplicitamente la palette
  (`accent`, `bg`, `text`) e istruisce Gemini a non generare testo,
  loghi, facce, oggetti realistici.
- **CON-001**: Image size `512`, `aspect_ratio: '1:1'` (invariato).
- **CON-002**: Clamp 500KB base64 (invariato).
- **CON-003**: Tier guard `unlocked` (invariato).
- **CON-004**: `photoUrl`/`logoUrl`/`coverImageUrl` base64 NON inviati a
  Gemini (troppo grandi, non supportati da Nano Banana 2 come input
  binario). Solo descrizione testuale delle loro posizioni.
- **CON-005**: Lunghezza massima prompt finale (prompt + context) ≤ 2000
  caratteri. Il backend tronca il `context` se eccede.
- **GUD-001**: Il `coverContext` va in linguaggio naturale inglese
  (Gemini è addestrato principalmente su inglese per image generation).
- **GUD-002**: Evitare "keyword soup" (no "8k, masterpiece, ultra
  detailed"). Usare frasi complete descrittive (skill Nano-Banana).
- **GUD-003**: Il prompt deve esplicitare "no text, no letters, no
  logos, no faces, no photography, no realistic objects".
- **GUD-004**: Il prompt deve indicare "square 1:1 composition, full
  -bleed background, areas where text will overlap must remain calm /
  low-contrast".

## 4. Interfaces & Data Contracts

### 4.1 `buildCardCoverBrief(card: BusinessCard): { prompt: string; context: string }`

Sostituisce `buildCardCoverPrompt`. Ritorna due stringhe separate che il
backend concatena: `${prompt}\n\nCARD CONTEXT:\n${context}`.

```typescript
interface CardCoverBrief {
  prompt: string;   // Nano-Banana formula (Subject+Action+Context+Composition+Lighting+Style)
  context: string;  // grid area map + palette + settore
}
```

### 4.2 `POST /ai/card-cover` (extended body)

```typescript
// Request
{
  prompt: string,          // ≤ 1000 char
  context?: string,        // ≤ 1000 char (grid area map + palette)
  userEmail?: string
}

// Response (invariata)
{ data: { imageBase64: string, mimeType: string } }
```

Il backend compone il prompt finale:
```typescript
const finalPrompt = body.context
  ? `${body.prompt}\n\nCARD CONTEXT:\n${body.context.slice(0, 1000)}`
  : body.prompt;
const result = await provider.generateCardCover(finalPrompt, 30_000);
```

### 4.3 `useAICard.generateCover` (extended call)

```typescript
const { prompt, context } = buildCardCoverBrief(card);
const res = await fetch(`${apiBase}/api/ai/card-cover`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt, context, userEmail }),
});
```

### 4.4 Grid area map format (esempio)

```
Front grid 4x4:
- photo occupies cols 0-2, rows 0-4 (left half, full height)
- name at cols 2-4, row 0 (top right)
- title at cols 2-4, row 1
- company at cols 2-4, row 2
- logo at cols 2-4, row 3 (bottom right)
Free space for background art: top-right corner above name is empty,
bottom-right below logo is empty. The right column area behind
name/title/company text must stay calm (low contrast) for readability.
```

## 5. Acceptance Criteria

- **AC-001**: Given card con `grid.elements.photo` a sinistra 2×4, When
  `generateCover` chiamato, Then il `context` inviato a Gemini descrive
  "photo occupies left half" e il prompt chiede "keep right side calm
  for text".
- **AC-002**: Given card con `style.accentColor=#01696F`, When cover
  generata, Then il prompt finale contiene "dominant accent color
  #01696F" e l'immagine generata usa tonalità teal coerenti.
- **AC-003**: Given `context` lungo 1500 char, When backend riceve la
  richiesta, Then il `context` viene troncato a 1000 char prima di
  comporre il prompt finale.
- **AC-004**: Given cover generata con context, When renderizzata in
  `svgRenderer.ts`, Then l'immagine appare sopra il `<rect>` di base e
  le aree testo restano leggibili (background calmo dove previsto).
- **AC-005**: Given `buildCardCoverBrief` su card vuota (no grid), Then
  ritorna un prompt valido senza grid area map (fallback generico).
- **AC-006**: Given `POST /ai/card-cover` senza `context`, Then il
  backend usa solo il `prompt` (back-compat con client vecchi).

## 6. Test Automation Strategy

- **Unit**:
  - `useAICard.test.ts`: verificare che `generateCover` invii `context`
    nel body quando la card ha una grid.
  - nuovo `cardCoverBrief.test.ts`: verificare `buildCardCoverBrief`
    ritorni prompt + context con palette e grid area map corrette.
  - `api/__tests__/cardCover.test.ts` (se esiste): verificare
    concatenazione prompt+context e troncamento.
- **Integration**: chiamata reale a `/ai/card-cover` in dev con
  `GEMINI_API_KEY` configurata, verificare immagine <500KB.
- **Coverage target**: 60% sul nuovo codice.
- **Framework**: Vitest + React Testing Library (esistente).

## 7. Rationale & Context

L'utente osserva che la cover generata "non cambia nella card" perché
Gemini non riceve informazioni sulla struttura del bigliettino. Il
prompt attuale (`buildCardCoverPrompt`) include solo palette e
settore, non la grid. Estendendo il prompt con una descrizione testuale
delle posizioni degli elementi, Gemini può generare sfondi che:

- lasciano area testo "calma" (low contrast) dove nome/titolo/azienda
  saranno renderizzati
- mettono elementi visivi (gradienti, forme) negli spazi liberi della
  grid
- rispettano la palette reale invece di generarne una generica

Questa soluzione è preferita a vision input binario perché:
- Nano Banana 2 non accetta bitmap della card come input
- il contesto testuale è più deterministico e leggero
- mantiene il provider `GeminiImageProvider` invariato nella signature

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: Google Gemini API (Nano Banana 2, modello
  `gemini-3.1-flash-image`) - generazione immagine da prompt testuale.

### Third-Party Services
- **SVC-001**: `@google/genai` SDK - `interactions.create()` con
  `response_modalities: ['text', 'image']` minuscolo e
  `image_config.image_size: '512'`.

### Infrastructure Dependencies
- **INF-001**: Vercel serverless function `api/index.ts` - endpoint
  `/ai/card-cover` (rate-limit `aiCardCover` 5/min/IP).
- **INF-002**: Vite dev proxy in `vite.config.js` - proxy
  `/api/ai/card-cover` (aggiunto nello step precedente del task).

### Data Dependencies
- **DAT-001**: `BusinessCard` type da `documentSchemas.ts` - fonte di
  front/back/style/grid/backGrid.
- **DAT-002**: `aiCardInputSchema` - non coinvolto (cover flow è
  separato dal layout AI flow).

### Technology Platform Dependencies
- **PLT-001**: Node 18+ ESM - backend Vercel function.

### Compliance Dependencies
- **COM-001**: `GEMINI_API_KEY` server-side only, mai esposta al bundle
  client (invariato).

## 9. Examples & Edge Cases

### Esempio 1: Card Giovanni (split, foto a sinistra)

```typescript
const card = createGiovanniCardTemplate();
// grid: photo 0,0 2x4 | name 2,0 2x1 | title 2,1 2x1 | company 2,2 2x1 | logo 2,3 2x1
// style: bgColor #FFFFFF, textColor #1a1a2e, accentColor #01696F

const { prompt, context } = buildCardCoverBrief(card);
// prompt:
//   "A refined, abstract business card cover illustration. Theme: personal
//    brand of a Web Developer. Visual style: soft layered gradients, subtle
//    geometric shapes, delicate light beams, elegant negative space, modern
//    editorial feel. Color direction: dominant accent color #01696F,
//    background #FFFFFF, text/contrast #1a1a2e. The design should feel
//    premium, clean and unique. No text, no letters, no logos, no faces,
//    no photography, no realistic objects. Square 1:1 composition,
//    full-bleed background."
// context:
//   "Front grid 4x4. photo occupies cols 0-2, rows 0-4 (left half, full
//    height). name at cols 2-4 row 0. title at cols 2-4 row 1. logo at
//    cols 2-4 row 2-3. Keep the right column area behind name/title text
//    calm and low-contrast for readability. Free decorative space: top-right
//    corner above name, bottom-right below logo. Palette: accent #01696F,
//    bg #FFFFFF, text #1a1a2e."
```

### Esempio 2: Card vuota (no grid)

```typescript
const card = createEmptyCard();
// grid assente o cols=0

const { prompt, context } = buildCardCoverBrief(card);
// prompt: fallback generico senza grid area map
// context: "No grid defined. Generic full-bleed background. Palette:
//           accent #01696F, bg #FFFFFF, text #1a1a2e."
```

### Edge case: context > 1000 char

```typescript
// backend tronca
const finalContext = body.context ? body.context.slice(0, 1000) : '';
const finalPrompt = body.context
  ? `${body.prompt}\n\nCARD CONTEXT:\n${finalContext}`
  : body.prompt;
```

### Edge case: card con logo al centro (photo-circle layout)

```typescript
// grid: photo al centro, name sopra, title sotto
// context deve dire "photo occupies center, keep center area calm,
//   decorative space in corners"
```

## 10. Validation Criteria

- `buildCardCoverBrief` ritorna sempre un `prompt` non vuoto.
- `context` è sempre una stringa (può essere breve per card vuote).
- Il prompt finale composto dal backend è ≤ 2000 char.
- L'immagine generata è < 500KB.
- Tier guard `unlocked` rispettato.
- `GEMINI_API_KEY` mai loggata né inviata al client.
- Back-compat: client vecchi senza `context` continuano a funzionare.

## 11. Related Specifications / Further Reading

- `spec/spec-design-ai-card-cover-image.md` (spec originale cover AI,
  REQ-001..006 base - questo spec estende REQ-003 e REQ-005)
- `src/ai/providers/gemini.ts` (provider, invariato)
- `src/hooks/useAICard.ts` (hook da estendere)
- `src/ai/prompts/cardContext.ts` (fonte per logica relevant fields,
  riusabile per grid area map)
- Skill `muapi-nano-banana` (formula prompt Subject+Action+Context+
  Composition+Lighting+Style)
- Skill `create-specification` (template di questo spec)
- `AGENTS.md` sezione "Logo AI, Gemini background gotchas" (regole
  `response_modalities` minuscolo, `image_size: '512'`)