---
title: AI Cover Image Generation for Business Card Module
version: 1.0
date_created: 2026-07-06
tags: [ai, card, gemini, image-generation, design]
---

# Introduction

Il modulo Business Card ha AI per il testo/layout/grid ma non per le
immagini (photo + logo sono upload manuali). Questo spec definisce
l'integrazione di `GeminiImageProvider` per generare una cover photo
AI coerente col settore professionale.

## 1. Purpose & Scope

Aggiungere generazione AI per la foto profilo/cover della card, usando
Gemini Nano Banana. L'AI genera uno sfondo/illustrazione professionale
coerente col settore (es. illustrazione food per ristoratore, pattern
tech per sviluppatore). Il testo della card resta editabile (come ora).

## 2. Definitions

- **Cover photo**: immagine di sfondo del fronte card (sostituisce o integra l'upload manuale `photoUrl`)
- **Cover prompt**: prompt Nano-Banana generato da DeepSeek insieme a colori/layout

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: `CardAIOrchestrator` esteso: DeepSeek ritorna anche `coverPrompt` (Nano-Banana formula)
- **REQ-002**: Nuovo endpoint `POST /ai/card-cover` in `api/index.ts` (rate-limit `aiCardCover` 5/min/IP, riusa `GeminiImageProvider`)
- **REQ-003**: `useAICard` hook esteso con `generateCover(card, coverPrompt)` → chiama `/ai/card-cover`
- **REQ-004**: `CardEditor.tsx`: bottone "Genera cover AI" nel pannello AI, preview inline
- **REQ-005**: `card.frontPhotoUrl` (string nullable, base64) → persistito, sostituisce `photoUrl` quando AI-generated
- **REQ-006**: `cardGenerator.ts` renderizza `frontPhotoUrl` come `<image>` nel fronte (come già fa con `photoUrl`)
- **CON-001**: Image size `512` + `aspect_ratio` `1:1` (copre il fronte card)
- **CON-002**: Clamp 500KB base64
- **CON-003**: Tier guard: solo `unlocked`
- **CON-004**: Non sovrascrive `photoUrl` utente (upload manuale ha priorità se presente)

## 4. Interfaces & Data Contracts

```typescript
// aiCardOutputSchema (extended)
{
  // ... campi esistenti ...
  coverPrompt: string,  // NEW
}

// POST /ai/card-cover
{ prompt: string, userEmail?: string }
// Response
{ data: { imageBase64: string, mimeType: string } }
```

## 5. Acceptance Criteria

- **AC-001**: Given card settore "food", When AI genera, Then coverPrompt descrive food/restaurant imagery
- **AC-002**: Given coverPrompt, When `/ai/card-cover` called, Then immagine <500KB
- **AC-003**: Given frontPhotoUrl AI-generated, When PDF export, Then fronte card contiene l'immagine
- **AC-004**: Given photoUrl utente già caricato, When AI cover generata, Then photoUrl utente preservato (frontPhotoUrl separato)
- **AC-005**: Given tier=free, When "Genera cover" clicked, Then bloccato

## 6. Test Automation Strategy

- Unit: `cardOrchestrator.test.ts` (coverPrompt field), `cardMerge.test.ts` (frontPhotoUrl merge)
- Coverage target: 60%

## 7. Rationale & Context

Card ha AI per testo/layout ma le immagini sono manuali. Gemini esiste
già per logo, basta wireare un terzo endpoint. La cover AI è
complementare (non sostituisce l'upload manuale della foto profilo reale).

## 8. Dependencies

- **INF-001**: `GeminiImageProvider` (exists)
- **INF-002**: `CardAIOrchestrator` (exists)
- **SVC-001**: Gemini API (exists)

## 9. Examples & Edge Cases

```json
// coverPrompt per tech
"Abstract geometric circuit board pattern in deep blue and cyan, minimalist tech aesthetic, soft glow, clean lines, professional business card background, no text."
```

Edge case: utente ha già foto → AI cover va in `frontPhotoUrl` separato,
non sovrascrive `photoUrl`.

## 10. Validation Criteria

- coverPrompt in AI output
- Immagine <500KB
- Tier guard
- Export PDF/PNG coerenti

## 11. Related Specifications

- `src/ai/providers/gemini.ts` (provider)
- `src/ai/cardOrchestrator.ts` (orchestratore esistente)