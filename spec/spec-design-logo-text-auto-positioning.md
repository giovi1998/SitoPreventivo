---
title: Logo Text Auto-Positioning and Readability Over AI Backgrounds
version: 1.0
date_created: 2026-07-06
tags: [logo, rendering, ai, design, bugfix]
---

# Introduction

Quando un logo ha un background AI (immagine generata da Gemini), il
testo SVG sovrapposto può essere illeggibile, mal posizionato, o
sovrapposto all'icona soppressa. Questo spec formalizza il comportamento
auto-adattivo del rendering quando `backgroundImage` è presente.

## 1. Purpose & Scope

Definire il comportamento deterministico di `buildSvgForLayout` quando
`builder.backgroundImage` è settato: centratura automatica del testo,
auto-leggibilità (colore + backdrop), soppressione icona/decorazioni,
e recovery manuale via offset.

## 2. Definitions

- **hasBgImage**: `!!builder.backgroundImage`
- **Auto-leggibilità**: quando l'utente non ha impostato manualmente `textColorMode` (resta 'auto') e `textBackdrop` (resta 'none'), il rendering applica default sensati

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: Quando `hasBgImage`, icona e `decorativeElements` sono soppressi (non renderizzati nell'SVG)
- **REQ-002**: Quando `hasBgImage` e layout=horizontal, il testo è centrato orizzontalmente (`text-anchor=middle`, `baseTextX=W/2`) invece di offset per icona
- **REQ-003**: Quando `hasBgImage` e layout=vertical/stacked, `baseY=H/2` (centrato verticalmente) invece di `iconCenter.y + iconSize/2 + 30`
- **REQ-004**: Quando `hasBgImage` e `textColorMode='auto'`, il colore testo default è bianco (`#FFFFFF`) invece di `secondaryColor`
- **REQ-005**: Quando `hasBgImage` e `textBackdrop='none'`, un pill backdrop scuro semi-trasparente è auto-abilitato
- **REQ-006**: L'utente può override manuali: `textColorMode='dark'` forza testo scuro, `textBackdrop='none'` disabilita backdrop
- **REQ-007**: `BuilderPanel.tsx` non renderizza il badge `builder-preview-icon-meta` quando `hasBgImage` (coerenza con soppressione SVG)
- **CON-001**: `gradientFill` (v2.2) ha priorità su `textColorMode` anche con `hasBgImage`
- **CON-002**: `textOffsetX/Y` e `taglineOffsetX/Y` sono ancora rispettati (nudge manuale sopra l'auto-centratura)
- **GUD-001**: Il backdrop auto-usa `unionTextBox()` per avvolgere SEMPRE titolo + sottotitolo, anche se spostati indipendentemente

## 4. Interfaces & Data Contracts

```typescript
// buildSvgForLayout(builder: LogoBuilder): string
// Nessun cambio nello schema. Il comportamento è deterministico
// basato su builder.backgroundImage truthiness + textColorMode/textBackdrop
// being at their schema defaults ('auto'/'none').
```

## 5. Acceptance Criteria

- **AC-001**: Given builder con backgroundImage + textColorMode='auto' + textBackdrop='none', When SVG render, Then testo fill='#FFFFFF'
- **AC-002**: Given builder con backgroundImage + textColorMode='auto' + textBackdrop='none', When SVG render, Then pill backdrop scuro presente
- **AC-003**: Given builder con backgroundImage + textColorMode='dark', When SVG render, Then testo fill='#0F172A' (override manuale rispettato)
- **AC-004**: Given builder con backgroundImage + textBackdrop='none', When SVG render, Then backdrop auto-pill attivo
- **AC-005**: Given builder con backgroundImage + textBackdrop='band', When SVG render, Then band (non pill) usato (override manuale)
- **AC-006**: Given builder con backgroundImage + layout=horizontal, When SVG render, Then text-anchor='middle' e x≈W/2
- **AC-007**: Given builder con backgroundImage + layout=vertical, When SVG render, Then primaryY≈H/2
- **AC-008**: Given builder con backgroundImage + iconType='lucide', When SVG render, Then nessun <g> o <path> lucide nell'SVG
- **AC-009**: Given builder con backgroundImage + decorativeElements=['underline'], When SVG render, Then nessun <line> underline
- **AC-010**: Given builder con backgroundImage + iconType='lucide', When BuilderPanel render, Then nessun `builder-preview-icon-meta` badge

## 6. Test Automation Strategy

- Unit: `logoGenerator.v2-2.test.ts` (auto-position, auto-leggibilità, soppressione, override)
- Component: `BuilderPanel.test.tsx` (badge suppression)
- Coverage target: 60%

## 7. Rationale & Context

Il bug: testo illeggibile sul background AI perché (1) posizione testo
era calcolata per l'icona che non c'è più, (2) colore default scuro su
foto scura, (3) nessun backdrop di default. Fix: auto-centratura +
auto-leggibilità con override manuale possibile.

## 8. Dependencies

- **INF-001**: `logoGenerator.ts` (exists)
- **INF-002**: `BuilderPanel.tsx` (exists)

## 9. Examples & Edge Cases

```
// Default (backgroundImage + auto + none)
→ testo bianco, pill scuro, centrato

// Override (backgroundImage + dark + band)
→ testo scuro, band chiara, centrato

// Override (backgroundImage + auto + none, ma gradientFill=true)
→ gradient fill (priorità su textColorMode)
```

Edge case: backgroundImage + no tagline → backdrop avvolge solo titolo.

## 10. Validation Criteria

- Tutti gli AC verificati da test
- Override manuali rispettati
- Nessun regression in test esistenti

## 11. Related Specifications

- `src/utils/logoGenerator.ts` (implementazione)
- v2.3 text controls spec (textColorMode, textBackdrop, textOffset)