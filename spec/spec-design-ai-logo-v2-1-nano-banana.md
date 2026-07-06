---
title: Logo AI v2.1 — Nano Banana Background + Namelix-like UX
version: 1.0
date_created: 2026-07-05
last_updated: 2026-07-05
owner: Giovanni Cidu
tags: [design, ai, logo, v2, gemini, nano-banana, background-only, namelix]
---

# Introduction

Estensione di spec 11 (Logo AI v2). Sostituisce il placeholder Replicate
con **Google Gemini Nano Banana 2 Lite** (`gemini-3.1-flash-lite-image`,
$0.034/1K immagini, latenza 4s, via Gemini API). L'intuizione chiave
(confermata dall'utente): **l'AI genera SOLO il background artistico**, il
testo (primaryText/tagline) resta vettoriale SVG editabile nel Builder.
Questo mantiene il controllo dell'utente sul testo (principio cardine
del progetto) e produce loghi con background artistico + testo SVG
nitido. Aggiunge anche un'UX "namelix-like": chat guidata che fa
domande (scopo, settore, mood, target) prima di generare.

## 1. Purpose & Scope

**Purpose**: abilitare generazione logo AI con background artistico via
Gemini, mantenendo testo vettoriale editabile.

**Scope**:
- Nuovo `src/ai/providers/gemini.ts` (provider Gemini image)
- Endpoint `POST /ai/logo-background` (proxy server-side, `GEMINI_API_KEY`)
- Endpoint `GET /ai/logo-config` esteso: ritorna `{ enabled, provider: 'gemini' }`
- Modifica `src/components/LogoAiPanel.tsx`: UX namelix-like (chat step)
- Modifica `src/ai/logoOrchestrator.ts`: `generateBackground()` metodo
- `logoSchema` esteso: `builder.backgroundImage` (base64 PNG)
- Modifica `src/utils/logoGenerator.ts`: render backgroundImage dietro testo SVG
- Nuovi test
- Dipende da spec 11 (orchestratore esistente), spec 3 (logoSystem prompt)

**Audience**: sviluppatore AI, utente finale.

**Assunzioni**:
- `GEMINI_API_KEY` env var su Vercel (server-side, come `DEEPSEEK_API_KEY`)
- Modello: `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite)
- API: `generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent`
- Output: base64 PNG (inline_data)
- Pricing: $0.034/1K image = ~€0.031/image (a luglio 2026)
- Rate-limit client-side: 1 background generation per sessione (costo)
- L'AI non tocca MAI il testo (primaryText/tagline/iconType). Genera solo
  il background come PNG trasparente o con colore di sfondo.

## 2. Definitions

- **Nano Banana 2 Lite**: modello Gemini image generation, fast + cheap.
- **Background-only**: AI genera PNG che fa da sfondo al logo. Il testo
  SVG resta sopra, composizione client-side nel renderer.
- **Namelix-like UX**: chat step (domanda → risposta → domanda) che
  raccoglie contesto prima di generare. Imita namelix.com (domain name
  generator che fa domande prima di proporre nomi).
- **backgroundImage**: nuovo campo `logo.builder.backgroundImage` (base64
  PNG string, nullable). Renderizzato dietro il testo SVG.

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: Creare `src/ai/providers/gemini.ts` con classe
  `GeminiImageProvider`:
  - `generateBackground(prompt: string): Promise<{ imageBase64: string; mimeType: string }>`
  - Chiama Gemini API con `responseModalities: ['IMAGE']`
  - Estrae `inlineData.data` (base64) dalla response
  - Timeout 30s
  - Errori mappati: 401 invalid key, 429 quota, 500 Gemini error
- **REQ-002**: Endpoint `POST /ai/logo-background` in `api/index.ts`:
  - Zod: `{ prompt: z.string().max(1000), userEmail: z.string().email().optional() }`
  - Rate-limit scope `aiLogoBg` 5/min/IP (meno di logo-generate, più caro)
  - Se `GEMINI_API_KEY` assente → 503
  - Chiama Gemini, ritorna `{ data: { imageBase64, mimeType } }`
  - Timeout 30s
- **REQ-003**: Endpoint `GET /ai/logo-config` esteso:
  - Ritorna `{ enabled: boolean, provider: 'gemini' | 'none' }`
  - `enabled = !!GEMINI_API_KEY`
  - `provider = GEMINI_API_KEY ? 'gemini' : 'none'`
- **REQ-004**: `logoSchema` esteso in `documentSchemas.ts`:
  ```typescript
  builder: logoBuilderSchema.extend({
    backgroundImage: z.string().nullable().default(null), // base64 PNG
  })
  ```
- **REQ-005**: `LogoAiPanel.tsx` UX namelix-like (4 step chat):
  - Step 1: "Cosa fa la tua attività?" (textarea)
  - Step 2: "Che mood vuoi?" (bottoni: minimal, bold, playful, elegant, tech)
  - Step 3: "Chi è il tuo target?" (input: es. "ristoratori giovani", "clienti corporate")
  - Step 4: Riepilogo + bottone "Genera logo" → chiama orchestratore per
    parametri + endpoint per background
- **REQ-006**: `logoOrchestrator.ts` nuovo metodo `generateBackground()`:
  - Usa prompt builder (descrizione attività + mood + target → prompt
    background artistico coerente)
  - Chiama `/ai/logo-background` via fetch
  - Merge `backgroundImage` in `logo.builder.backgroundImage`
- **REQ-007**: `logoGenerator.ts` modifica `builderToSvg`:
  - Se `logo.builder.backgroundImage` presente, renderizza `<image>` dietro
    al testo/icona (z-index inferiore)
  - PreserveAspectRatio: "xMidYMid slice" per coprire il viewBox
- **REQ-008**: Export PNG del logo include backgroundImage (composizione
  canvas: disegna background PNG → disegna testo SVG sopra).
- **REQ-009**: UX feedback durante generazione:
  - Loading state per parametri (DeepSeek, ~1-3s)
  - Loading state separato per background (Gemini, ~4-8s)
  - Toast: "Parametri generati" poi "Background generato"
- **REQ-010**: Anti-abuso: 1 background generation per sessione AI
  (resetSession resetta counter). Costo €0.031/image, 5/min/IP rate-limit.
- **CON-001**: Zero breaking change. Se `GEMINI_API_KEY` assente, v1
  behavior preservato (tab AI mostra form parametri, niente background).
- **CON-002**: `backgroundImage` è opzionale. Logo senza background =
  SVG trasparente come v1.
- **CON-003**: `backgroundImage` max 500KB base64 (clamp lato server).
- **CON-004**: Background PNG è raster (non vettoriale). Export SVG non
  include background (solo PNG/SVG testo). Documentarlo in UI.
- **GUD-001**: Prompt background include "no text, no letters, no words"
  per evitare che Gemini generi testo (che sarebbe illeggibile e
  sovrascriverebbe il nostro SVG).
- **PAT-001**: Provider pattern: `GeminiImageProvider` separato da
  `DeepSeekProvider` (diverso API shape).
- **PAT-002**: Composizione client-side: background PNG + testo SVG =
  logo completo. L'AI non compone, l'app compone.

## 4. Interfaces & Data Contracts

**GeminiImageProvider**:

```typescript
export class GeminiImageProvider {
  constructor(private apiKey: string, private model: string = 'gemini-3.1-flash-lite-image') {}
  async generateBackground(prompt: string): Promise<{ imageBase64: string; mimeType: string }>;
}
```

**Endpoint**:

| Path | Method | Zod | Rate-limit | Timeout |
|------|--------|-----|------------|---------|
| `/ai/logo-background` | POST | `aiLogoBgSchema` | `aiLogoBg` 5/min/IP | 30s |
| `/ai/logo-config` | GET | (nessuno) | (nessuno) | 1s |

**aiLogoBgSchema**:

```typescript
const aiLogoBgSchema = z.object({
  prompt: z.string().max(1000),
  userEmail: z.string().email().optional(),
});
```

**Response `/ai/logo-background`** (200):

```json
{
  "data": { "imageBase64": "iVBOR...", "mimeType": "image/png" }
}
```

**Response `/ai/logo-config`** (200 v2):

```json
{ "enabled": true, "provider": "gemini" }
```

**logoSchema esteso**:

```typescript
builder: logoBuilderSchema.extend({
  backgroundImage: z.string().nullable().default(null),
})
```

**Prompt background** (costruito client-side in `logoOrchestrator.ts`):

```
Artistic background for a logo. NO text, NO letters, NO words.
Activity: {attivita}
Mood: {mood}
Target audience: {target}
Colors: {primaryColor}, {secondaryColor}
Style: abstract, geometric, minimal. High contrast. PNG with transparent
or solid background.
```

## 5. Acceptance Criteria

- **AC-001**: Given `GEMINI_API_KEY` assente, When `GET /ai/logo-config`,
  Then ritorna `{ enabled: false, provider: 'none' }`.
- **AC-002**: Given `GEMINI_API_KEY` presente, When `GET /ai/logo-config`,
  Then ritorna `{ enabled: true, provider: 'gemini' }`.
- **AC-003**: Given `GEMINI_API_KEY` assente, When `POST /ai/logo-background`,
  Then 503.
- **AC-004**: Given `POST /ai/logo-background` con prompt valido, When
  6a richiesta in 60s, Then 429.
- **AC-005**: Given `LogoAiPanel` render con `provider: 'gemini'`, When
  l'utente completa 4 step, Then bottone "Genera logo" attivo.
- **AC-006**: Given click "Genera logo", When AI completa, Then
  `logo.builder.backgroundImage` popolato + parametri builder applicati.
- **AC-007**: Given `logo.builder.backgroundImage` presente, When
  `builderToSvg` eseguito, Then SVG contiene `<image>` dietro al testo.
- **AC-008**: Given export PNG, When `backgroundImage` presente, Then
  PNG include background + testo composito.
- **AC-009**: Given export SVG, When `backgroundImage` presente, Then
  SVG include solo testo (background raster non vettoriale, documentato).
- **AC-010**: Given 2a generazione background nella stessa sessione,
  When l'utente clicca "Genera" di nuovo, Then toast "Una generazione
  per sessione. Reset per generare nuovamente.".
- **AC-011**: Given `npm test`, Then 1768+ verdi.
- **AC-012**: Given `npm run typecheck`, Then verde.

## 6. Test Automation Strategy

- **Test Levels**: Unit (provider, endpoint Zod), Component (LogoAiPanel
  4-step), Integration (logoGenerator composizione).
- **Frameworks**: Vitest, React Testing Library, mock fetch Gemini.
- **Coverage Requirements**: ≥80% nuovi file.
- **Test nuovi** (~10):
  - `gemini.test.ts`: 3 test (generateBackground success, 401, 429)
  - `api/__tests__/aiLogoBg.test.ts`: 4 test (200, 503, 429, Zod 400)
  - `LogoAiPanel.namelix.test.tsx`: 3 test (4-step flow, generate,
    backgroundApplied)

## 7. Rationale & Context

L'approccio background-only risolve il dilemma "AI logo vs controllo
testo". Looka/namelix generano logo completo (testo + icona) come raster,
l'utente perde editabilità. Il nostro approccio: AI genera background
artistico (competenza di Gemini image), l'app compone testo SVG sopra
(competenza del Builder). Risultato: logo artistico + testo nitido +
editabile. Costo €0.031/image sostenibile (5/min/IP rate-limit previene
abuso). UX namelix-like riduce attrito: l'utente non deve scrivere un
prompt tecnico, risponde a 3 domande semplici.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: Google Gemini API (`generativelanguage.googleapis.com`),
  modello `gemini-3.1-flash-lite-image`. Richiede `GEMINI_API_KEY`.

### Third-Party Services
- **SVC-001**: Google AI — image generation, SLA best-effort, latenza
  ~4s, pricing $0.034/1K image.

### Infrastructure Dependencies
- **INF-001**: Vercel Serverless Function.
- **INF-002**: `GEMINI_API_KEY` env var (Vercel, scope Production+Preview).

### Data Dependencies
- **DAT-001**: spec 11 `logoOrchestrator.ts` (esiste, estendere).
- **DAT-002**: spec 3 `logoSystem.ts` (prompt parametri, esiste).
- **DAT-003**: `src/utils/documentSchemas.ts` `logoSchema` (estendere).
- **DAT-004**: `src/utils/logoGenerator.ts` `builderToSvg` (modificare).

### Technology Platform Dependencies
- **PLT-001**: TypeScript, React, Vitest, fetch API.

### Compliance Dependencies
- **COM-001**: `GEMINI_API_KEY` server-side only (mai nel bundle).
- **COM-002**: SynthID watermarking automatico su immagini Gemini
  (conforme policy Google).

## 9. Examples & Edge Cases

**Esempio prompt background**:

```
Artistic background for a logo. NO text, NO letters, NO words.
Activity: Pizzeria moderna a Cagliari
Mood: bold
Target audience: giovani 25-35
Colors: #E62020, #1A1A1A
Style: abstract, geometric, minimal. High contrast. PNG.
```

**Esempio composizione SVG** (post-generazione):

```svg
<svg viewBox="0 0 400 160">
  <image href="data:image/png;base64,{backgroundImage}" x="0" y="0"
    width="400" height="160" preserveAspectRatio="xMidYMid slice"/>
  <!-- testo SVG sopra (z-index naturale) -->
  <rect x="14" y="38" width="84" height="84" rx="14" fill="#01696F"/>
  <text x="110" y="78" font-family="Inter" font-size="30" font-weight="700"
    fill="#ffffff">Pizzeria</text>
</svg>
```

**Edge case — Gemini ritorna testo nell'immagine**: il prompt dice "NO
text". Se Gemini lo ignora, il testo AI è illeggibile (pixelato). L'utente
può rigenerare o usare logo senza background (toggle nel Builder).

**Edge case — backgroundImage troppo grande**: server clamp 500KB. Se
Gemini ritorna >500KB, server tronca o error "Image troppo grande".

**Edge case — export SVG senza background**: SVG è vettoriale, non
include background raster. L'utente che esporta SVG sa che il background
è solo nell'export PNG (documentato in UI con tooltip).

## 10. Validation Criteria

- Tutti AC-001..012 verdi.
- `src/ai/providers/gemini.ts` esiste con `GeminiImageProvider`.
- Endpoint `POST /ai/logo-background` in `api/index.ts`.
- `GET /ai/logo-config` ritorna `provider` field.
- `logoSchema` esteso con `builder.backgroundImage`.
- `LogoAiPanel.tsx` 4-step UX namelix-like.
- `logoGenerator.ts` render backgroundImage.
- `npm test` verde (1768 + ~10 nuovi).
- `npm run typecheck` verde.

## 11. Related Specifications / Further Reading

- `spec/spec-design-ai-logo-v2.md` — spec 11 (orchestratore base).
- `spec/spec-tool-ai-prompt-new-modules.md` — spec 3 (logoSystem prompt).
- Google Gemini API docs: `ai.google.dev/gemini-api/docs/image-generation`
- Nano Banana 2 Lite: `blog.google/.../gemini-omni-flash-nano-banana-2-lite/`
- namelix.com — riferimento UX