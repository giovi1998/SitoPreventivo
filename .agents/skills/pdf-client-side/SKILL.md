---
description: Use when modifying src/utils/*Generator.ts (generatePDF, cardGenerator, flyerGenerator, logoGenerator, qrGenerator) or src/utils/watermark.ts. Client-side PDF/PNG generation patterns.
---

# Skill: pdf-client-side

## Overview

Generazione PDF/PNG/SVG avviene INTERAMENTE lato client. Niente server
upload, niente Vercel Blob, niente SSR PDF. Pattern: pdfmake per PDF,
canvas pipeline per PNG, SVG per vettoriale.

## Stack

- **PDF**: `pdfmake` (`src/utils/generatePDF.ts`). Browser-only.
- **PNG**: canvas pipeline (SVG → Image → canvas → toBlob → download).
- **SVG**: `buildCardSvg` / `buildFrontSvg` (inline nel client).
- **Watermark**: `src/utils/watermark.ts` (tier-aware).

## Tier-aware watermark

| Tier | Watermark | DPI (PDF) | DPI (PNG) | Lato PNG max |
|------|-----------|-----------|-----------|--------------|
| free | "QUICKBRAND · FREE" diagonale | 150 | 72 | 1200px |
| unlocked | no-op | 300 | 4096 | 4096px |

Helper:
- `applyWatermarkToPdf(doc, tier)` (pdfmake background function)
- `applyWatermarkToCanvas(ctx, tier)` (post-drawImage)
- `getDpiForTier(tier): number`

Anti-bypass: watermark applicato in 3 punti:
1. Export PDF (pdfmake background + footer)
2. Export PNG (Canvas 2D post-drawImage)
3. Preview live (overlay SVG `pointer-events: none`)

## jsdom limit (test)

`HTMLCanvasElement.getContext` non è implementato in jsdom → mock
in test o usa `buildMinimalPng` fallback. Non testare in jsdom
il rendering PNG completo, solo la logica builder.

## Pattern PDF multipagina

- `pdfmake` con `pageBreakBefore` esplicito per ogni opzione.
- Header/footer automatici via `header`/`footer` callback.
- pdfmake `table` per tabelle opzioni.

## Pattern card PDF 10-up

- A4 (210x297mm) con 5×2 bigliettini.
- Ogni cella con `absolutePosition` per coordinate precise.
- Spacing 0 (no gap), printer li separa.

## Pattern flyer bleed 3mm

- Page size + 6mm larghezza/altezza (3mm per lato).
- Crop marks a 3mm dal bordo (linee guida).
- pdfmake `background` con clip-path per sicurezza.
- Unit conversion: mm → pt (1mm = 2.83465 pt).

## Pattern logo export PNG (multi-size)

- `logoGenerator.ts` espone `exportLogoPng(logo, size)` con size ∈ {512, 1024, 2048}.
- Pipeline: SVG → blob URL → Image → canvas → toBlob('image/png') → download.

## Riferimenti

- `src/utils/generatePDF.ts` (preventivi)
- `src/utils/cardGenerator.ts` (bigliettini)
- `src/utils/flyerGenerator.ts` (volantini, v1 monolite)
- `src/utils/flyer/` (refactor: layoutEngine, svgRenderer, pdfExport, pngExport)
- `src/utils/logoGenerator.ts` (logo)
- `src/utils/qrGenerator.ts` (QR code)
- `src/utils/watermark.ts` (tier-aware)
- AGENTS.md sezione "PDF Generation, Client-Side Only"
