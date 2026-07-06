---
title: QR Code AI Generation Module
version: 1.0
date_created: 2026-07-06
tags: [ai, qr, design, app]
---

# Introduction

QR Code è l'unico documento senza AI generation. Questo spec definisce
un modulo AI per QR che suggerisce contenuto (payload da descrizione
business), ottimizza stile/contrast/colori, e genera credenziali WiFi
e payload vCard da testo in linguaggio naturale.

## 1. Purpose & Scope

Portare QR Code alla parità AI con gli altri moduli (card, flyer, logo).
L'AI per QR è **content suggestion + style optimization**, non full
document synthesis (il payload QR è dato strutturato dell'utente).

## 2. Definitions

- **QrAIOrchestrator**: orchestratore no-tools (come Card/Flyer), JSON round-trip via DeepSeek
- **Content suggestion**: l'AI genera il payload (URL, vCard, WiFi) da una descrizione in linguaggio naturale
- **Style optimization**: l'AI suggerisce dotStyle, colori, errorCorrection in base al settore/uso

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: `src/ai/qrOrchestrator.ts` extends `BaseOrchestrator`, no tools, JSON round-trip
- **REQ-002**: `src/ai/prompts/qrSystem.ts` + register `qr-system` in `promptRegistry`
- **REQ-003**: `src/hooks/useAIQr.ts` con stream buffer + token tracking + logs (mirror `useAICard`)
- **REQ-004**: AI panel in `QREditor.tsx` (model selector + prompt textarea + quick actions, reuse `AILogPanel`)
- **REQ-005**: `aiQrInputSchema` (Zod) per validare output AI: type, payload, fgColor, bgColor, dotStyle, errorCorrection, margin
- **REQ-006**: `qrMerge.ts` sanifica output AI: clamp colori via `isHexColor`, validate `type` enum, preserve user-uploaded `logoOverlay` base64
- **REQ-007**: Endpoint `POST /ai/qr-generate` in `api/index.ts` (rate-limit `aiQr` 10/min/IP, Zod validation,DeepSeek proxy come `/ai/chat`)
- **CON-001**: L'AI NON genera l'immagine QR (quella è client-side via `qrcode` lib). L'AI genera solo i parametri
- **CON-002**: Payload WiFi non viene loggato (PII: password). Il system prompt evita di echo-are il payload
- **GUD-001**: Pattern riusato: schema Zod in `documentSchemas.ts`, lazy-load componente in `App.tsx`

## 4. Interfaces & Data Contracts

```typescript
// aiQrOutputSchema
{
  type: 'url' | 'text' | 'email' | 'phone' | 'vcard' | 'wifi' | 'sms',
  payload: string,          // il contenuto codificato
  fgColor: '#RRGGBB',
  bgColor: '#RRGGBB',
  dotStyle: 'square' | 'rounded' | 'dots',
  errorCorrection: 'L' | 'M' | 'Q' | 'H',
  margin: number (0-16),
}
```

## 5. Acceptance Criteria

- **AC-001**: Given utente descrive "Pizzeria Da Mario, telefono 070123456", When AI genera, Then QR type=phone, payload="070123456"
- **AC-002**: Given utente descrive "WiFi ospiti, rete Guest, password Welcome2024", When AI genera, Then QR type=wifi, payload includes SSID+password
- **AC-003**: Given utente descrive "La mia vCard: Mario Rossi, mario@example.com, +390701234", When AI genera, Then QR type=vcard con payload strutturato
- **AC-004**: Given AI ritorna fgColor non-hex, When merge, Then fgColor clamped a `#000000`
- **AC-005**: Given utente ha logo overlay caricato, When AI merge, Then logoOverlay preservato

## 6. Test Automation Strategy

- Unit: `qrOrchestrator.test.ts` (schema validation, merge clamp), `qrSystem.test.ts` (prompt registration)
- Component: `QREditor.test.tsx` (AI panel rendering, quick actions)
- Coverage target: 60%

## 7. Rationale & Context

QR è l'unico modulo senza AI. L'AI qui non è full synthesis (il payload
è dato utente), ma **content suggestion** (genera payload da descrizione)
+ **style optimization** (sceglie colori/contrast in base al settore).

## 8. Dependencies

- **INF-001**: `BaseOrchestrator` (exists)
- **INF-002**: `promptRegistry` (exists)
- **INF-003**: `AILogPanel` component (exists, reuse)
- **SVC-001**: DeepSeek API via `/api/ai/chat` (exists)

## 9. Examples & Edge Cases

```json
// AI output per "Pizzeria Da Mario"
{
  "type": "url",
  "payload": "https://www.pizzeriadamar.it",
  "fgColor": "#E62020",
  "bgColor": "#FFFFFF",
  "dotStyle": "rounded",
  "errorCorrection": "M",
  "margin": 2
}
```

Edge case: payload vuoto → AI ritorna type=text con payload placeholder.

## 10. Validation Criteria

- Schema validation passa per tutti i 7 tipi QR
- Merge preserva logoOverlay utente
- Rate-limit 10/min/IP funziona
- No PII in logs (WiFi password)

## 11. Related Specifications

- `spec-design-ai-logo-v2.md` (pattern: orchestrator + hook + prompt + UI)
- `src/ai/cardOrchestrator.ts` (reference implementation no-tools)