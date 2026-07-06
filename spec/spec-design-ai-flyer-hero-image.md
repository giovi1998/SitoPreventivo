---
title: AI Hero Image Generation for Flyer Module
version: 1.0
date_created: 2026-07-06
tags: [ai, flyer, gemini, image-generation, design]
---

# Introduction

Il modulo Volantino usa hero image statiche da `picsum.photos`. Questo
spec definisce l'integrazione di `GeminiImageProvider` (già usato da
Logo AI) per generare hero image AI coerenti col contenuto del volantino.

## 1. Purpose & Scope

Sostituire le hero image placeholder (`picsum.photos`) con immagini AI
generate da Gemini Nano Banana, coerenti col settore e contenuto del
volantino. Il testo del volantino resta SVG/PDF editabile (come ora),
solo l'hero image diventa AI.

## 2. Definitions

- **Hero image**: immagine di sfondo nella zona hero del volantino (layout-dependent, vedi `heroBoxMmForLayout`)
- **GeminiImageProvider**: provider esistente in `src/ai/providers/gemini.ts`, già wireato a `/ai/logo-background`
- **Hero prompt**: prompt reasoning-driven (Nano-Banana formula) generato da DeepSeek insieme al copy

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: `FlyerAIOrchestrator.generateCopy()` esteso: DeepSeek ritorna anche `heroPrompt` (string, max 500 char, formula Nano-Banana)
- **REQ-002**: Nuovo endpoint `POST /ai/flyer-hero` in `api/index.ts` (rate-limit `aiFlyerHero` 5/min/IP, riuse `GeminiImageProvider` via dynamic import)
- **REQ-003**: `useAIFlyer` hook esteso con `generateHero(flyer, heroPrompt)` → chiama `/ai/flyer-hero`
- **REQ-004**: `FlyerEditor.tsx`: bottone "Genera hero AI" dopo che il copy è stato generato, mostra preview
- **REQ-005**: `flyerSchema.heroImage` (string nullable, base64 PNG/JPEG) → persistito nel documento
- **REQ-006**: `svgRenderer.ts` + `pdfExport.ts` + `pngExport.ts` renderizzano `heroImage` come `<image>` nella hero box (se presente, sostituisce picsum URL)
- **CON-001**: Image size `512` + `aspect_ratio` coerente col layout hero box (es. `16:9` per classic, `1:1` per centered)
- **CON-002**: Clamp 500KB base64 (come logo background)
- **CON-003**: Tier guard: solo `unlocked` può generare hero AI (come logo AI)
- **GUD-001**: Riusa `GeminiImageProvider` via `ssrLoadModule` in dev proxy (come `/ai/logo-background`)

## 4. Interfaces & Data Contracts

```typescript
// flyerAIOutputSchema (extended)
{
  title: string,
  subtitle: string,
  body: string,
  cta: string,
  heroPrompt: string,  // NEW: Nano-Banana prompt per Gemini
}

// POST /ai/flyer-hero request
{ prompt: string, userEmail?: string }
// POST /ai/flyer-hero response
{ data: { imageBase64: string, mimeType: string } }
```

## 5. Acceptance Criteria

- **AC-001**: Given flyer con settore "ristorante", When AI genera copy, Then `heroPrompt` descrive cibo/ambiente coerente
- **AC-002**: Given heroPrompt, When `/ai/flyer-hero` called, Then Gemini ritorna immagine <500KB
- **AC-003**: Given heroImage settata, When SVG render, Then `<image>` appare nella hero box invece di picsum
- **AC-004**: Given tier=free, When "Genera hero AI" clicked, Then mostra messaggio bloccato
- **AC-005**: Given PDF export con heroImage, Then PDF contiene l'immagine AI nella hero box

## 6. Test Automation Strategy

- Unit: `flyerOrchestrator.test.ts` (heroPrompt field), `svgRenderer.test.ts` (heroImage rendering)
- Integration: `/ai/flyer-hero` endpoint test (mock Gemini)
- Coverage target: 60%

## 7. Rationale & Context

Il flyer è "completo" per il testo ma non per l'immagine. L'infrastruttura
Gemini esiste già (logo), basta wireare un secondo endpoint + estendere
l'orchestratore.

## 8. Dependencies

- **INF-001**: `GeminiImageProvider` (exists, `src/ai/providers/gemini.ts`)
- **INF-002**: `FlyerAIOrchestrator` (exists)
- **INF-003**: Vite dev proxy `/ai/flyer-hero` (new, mirror `/ai/logo-background`)
- **SVC-001**: Gemini API via `@google/genai` SDK (exists)

## 9. Examples & Edge Cases

```json
// heroPrompt per settore ristorante
"Neapolitan pizza fresh from a wood-fired oven, golden crust with melted mozzarella, steam rising, warm ambient lighting, rustic wooden table, shot from 30 degrees, appetizing food photography style."
```

Edge case: Gemini fallisce → fallback a picsum URL (comportamento attuale).

## 10. Validation Criteria

- heroPrompt presente in AI output (non vuoto)
- Immagine <500KB, mime JPEG/PNG
- Tier guard funziona
- PDF/SVG/PNG export coerenti

## 11. Related Specifications

- `spec-design-flyer-refactor-preview-ai.md` (flyer refactor base)
- `src/ai/providers/gemini.ts` (provider esistente)