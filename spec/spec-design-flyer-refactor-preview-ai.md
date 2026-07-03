---
title: Flyer Refactor, Layout Engine, Preview, Templates and AI
version: 1.0
date_created: 2026-07-03
last_updated: 2026-07-03
owner: Quickbrand
tags: [design, architecture, frontend, flyer, ai, preview, print]
---

# Introduction

This specification defines the required refactor and redesign of the Quickbrand flyer module. The goal is to make flyer generation maintainable, visually reliable across every format and layout, and usable as a professional print-oriented workspace with AI, manual controls, and preview having clear responsibilities.

The current implementation has visible layout failures: oversized headline text, CTA and QR overlap, body text disappearing, Square/A6/A4/Letter proportions not adapting correctly, and layout behavior that changes unpredictably across `classic`, `centered`, `split`, and `magazine`. The root causes are a monolithic renderer, no geometry/text-fitting engine, CSS split across unrelated/shared files, templates tied to schema data, and AI prompts that do not know the real space budgets of the selected format/layout.

## 1. Purpose & Scope

This specification covers:

- Refactor of `src/utils/flyerGenerator.ts` into focused submodules.
- Refactor of `src/components/FlyerEditor.tsx` into AI, manual, and preview components.
- Split of flyer CSS into submodules for AI, manual, preview, and shell layout.
- A deterministic flyer layout engine that prevents overlap and overflow.
- A preview that faithfully represents export output while remaining usable on desktop and mobile.
- A template system that is maintainable and testable for all sectors, layouts, formats, and orientations.
- AI copy generation that respects exact layout budgets and can recommend layout adjustments.

This specification does not require changes to `api/index.ts` unless future AI endpoints are added. The current endpoint pattern should remain unchanged.

## 2. Definitions

- **Flyer**: A single-page marketing document with size, orientation, content, style, and optional QR code.
- **Trim Box**: The final physical document size after print cutting, e.g. A5 148x210mm.
- **Bleed**: Extra area outside the trim box, currently 3mm on all sides.
- **Safe Area**: Inner content area that must not contain essential text too close to trim edges.
- **Layout Engine**: Pure utility that computes exact rectangles for hero image, headline, subheadline, body, CTA, QR, and labels.
- **Layout Plan**: Immutable result of layout computation. It includes rectangles, fitted font sizes, visibility flags, warnings, and overflow policy decisions.
- **Density**: How full the flyer is with content. Values: `low`, `medium`, `high`, `overflow`.
- **Renderer**: Code that converts a layout plan into SVG markup.
- **Preview**: Browser view of the flyer that must match export layout, not necessarily export resolution.
- **Template Sector**: One of `ristorante`, `evento`, `salone`, `negozio`.
- **Layout Variant**: One of `classic`, `centered`, `split`, `magazine`.

## 3. Requirements, Constraints & Guidelines

### 3.1 Architecture Requirements

- **REQ-ARCH-001**: `src/utils/flyerGenerator.ts` must no longer contain geometry, text fitting, SVG rendering, PDF export, PNG export, QR placement, and template logic in one file.
- **REQ-ARCH-002**: The public imports `buildFlyerSvg`, `generateFlyerPdf`, and `generateFlyerPng` must continue to work from `src/utils/flyerGenerator.ts` during the refactor by re-exporting from new modules.
- **REQ-ARCH-003**: `FlyerEditor.tsx` must be reduced to a shell/orchestrator component. AI, manual, and preview panels must live in separate components.
- **REQ-ARCH-004**: CSS must be split by responsibility: shell, AI, manual, preview. Shared styles may exist only for shared flyer primitives.
- **REQ-ARCH-005**: Template data must be separated from schema definitions. `documentSchemas.ts` may re-export `createFlyerTemplate` for compatibility, but the catalog itself must live in a flyer-specific module.
- **REQ-ARCH-006**: Layout computation must be pure and deterministic. It must not access DOM, canvas, network, or browser APIs.
- **REQ-ARCH-007**: Renderer modules must accept a `FlyerLayoutPlan`, not re-compute placement independently.

### 3.2 Proposed File Structure

Required target structure:

```text
src/components/flyer/
  FlyerEditorShell.tsx
  FlyerAiPanel.tsx
  FlyerManualPanel.tsx
  FlyerPreviewPanel.tsx
  FlyerPreview.tsx
  FlyerTemplatePicker.tsx
  FlyerFormatControls.tsx
  FlyerLayoutControls.tsx
  FlyerContentFields.tsx
  FlyerStyleFields.tsx
  FlyerExportActions.tsx
  styles/
    shell.css
    ai.css
    manual.css
    preview.css
    primitives.css

src/utils/flyer/
  index.ts
  geometry.ts
  layoutEngine.ts
  textFit.ts
  svgRenderer.ts
  qrRenderer.ts
  pdfExport.ts
  pngExport.ts
  templateCatalog.ts
  templateFactory.ts
  validation.ts

src/ai/flyer/
  budgets.ts
  prompts.ts
  outputSchema.ts
```

Compatibility modules:

```text
src/utils/flyerGenerator.ts        // re-export only
src/components/FlyerEditor.tsx     // thin default export wrapper during migration
```

### 3.3 Layout Engine Requirements

- **REQ-LAY-001**: The layout engine must compute all flyer geometry in millimetres.
- **REQ-LAY-002**: The layout engine must compute these boxes: `page`, `bleed`, `trim`, `safe`, `hero`, `headline`, `subheadline`, `accent`, `body`, `cta`, `qr`, `qrLabel`.
- **REQ-LAY-003**: No visible box may overlap another visible box unless explicitly allowed by a layout definition. The only allowed overlap is a deliberate text overlay on hero image, and this feature is out of scope for v1 unless implemented with contrast rules.
- **REQ-LAY-004**: All essential text boxes must remain inside the safe area.
- **REQ-LAY-005**: QR must remain scannable. Minimum QR size: 16mm for A6/Square and 18mm for A5/A4/Letter. QR may not be clipped.
- **REQ-LAY-006**: QR label is optional and must hide before QR shrinks below minimum.
- **REQ-LAY-007**: CTA label must fit inside its button. If it cannot fit at minimum font size, truncate with ellipsis and emit a warning.
- **REQ-LAY-008**: Layout engine must return `warnings: LayoutWarning[]` for any hidden, truncated, or resized content.
- **REQ-LAY-009**: Layout engine must classify density as `low`, `medium`, `high`, or `overflow`.
- **REQ-LAY-010**: Export must use the same layout plan as preview.

### 3.4 Text Fitting Requirements

- **REQ-TXT-001**: All text must be fitted by a deterministic text fitting utility before rendering.
- **REQ-TXT-002**: Headline must wrap before overflowing. Single very long words must break with `overflow-wrap:anywhere` or SVG equivalent.
- **REQ-TXT-003**: Headline font size must be selected from a min/max range per size/layout, not only from page width.
- **REQ-TXT-004**: Body must never overlap CTA or QR. If body cannot fit, reduce font size down to minimum, then truncate at sentence boundary, then word boundary, then character boundary.
- **REQ-TXT-005**: Body truncation must append `...` and emit warning code `body_truncated`.
- **REQ-TXT-006**: Fitted font sizes must be part of the layout plan and visible in tests.
- **REQ-TXT-007**: The renderer may use native SVG `<text>` or `<foreignObject>`, but the selected strategy must pass all geometry tests. If `<foreignObject>` is kept, preview sizing must pin root SVG to pixel dimensions to avoid 96dpi natural-size clipping.

Required min/max font sizes:

| Size | Headline min/max | Subheadline min/max | Body min/max | CTA min/max |
|------|------------------|---------------------|--------------|-------------|
| A6 | 10pt / 22pt | 7pt / 12pt | 6pt / 9pt | 6pt / 9pt |
| A5 | 12pt / 30pt | 8pt / 15pt | 7pt / 11pt | 7pt / 11pt |
| A4 | 16pt / 44pt | 10pt / 22pt | 8pt / 13pt | 8pt / 13pt |
| Letter | 16pt / 42pt | 10pt / 21pt | 8pt / 13pt | 8pt / 13pt |
| Square | 14pt / 34pt | 9pt / 17pt | 7pt / 11pt | 7pt / 11pt |

### 3.5 Layout Variant Requirements

#### Classic

- **REQ-CLS-001**: Classic must place hero at the top when hero exists.
- **REQ-CLS-002**: Classic must reserve bottom row for CTA and QR before body layout is computed.
- **REQ-CLS-003**: Classic must adapt hero height by size: A6 <= 30%, A5 <= 36%, A4/Letter <= 40%, Square <= 28%.
- **REQ-CLS-004**: Classic must not render headline larger than the remaining text area supports.

#### Centered

- **REQ-CEN-001**: Centered must be primarily typographic. Hero, if present, must be small and decorative.
- **REQ-CEN-002**: Centered must center headline, subheadline, accent, body, and CTA as a vertical composition.
- **REQ-CEN-003**: Centered must place QR in bottom-right only if it does not collide with centered CTA/body. Otherwise QR moves below CTA or QR label hides.

#### Split

- **REQ-SPL-001**: Split landscape must place hero on the left and text on the right by default.
- **REQ-SPL-002**: Split portrait must place hero on top and text below by default.
- **REQ-SPL-003**: Split Square must use 46% hero width and 54% text width if landscape-style split is selected; it must not create a text column too narrow for the headline.
- **REQ-SPL-004**: Split must cap headline font size based on text column width, not page width.

#### Magazine

- **REQ-MAG-001**: Magazine must not use a three-column body on A6.
- **REQ-MAG-002**: Magazine columns by size: A6 = 1 column, A5/Square = 2 columns, A4/Letter = 3 columns.
- **REQ-MAG-003**: Magazine hero height must be smaller than classic and must not push headline/body into footer.
- **REQ-MAG-004**: Magazine body column count must be computed in layout plan and tested.
- **REQ-MAG-005**: Magazine must reserve a clear footer area for CTA/QR before body columns are measured.

### 3.6 Preview Requirements

- **REQ-PRV-001**: Preview must show the complete flyer page without clipping.
- **REQ-PRV-002**: Preview must include optional overlays: trim box, safe area, bleed area, and element boxes. Default overlay state: off.
- **REQ-PRV-003**: Preview toolbar must include fit-to-page, zoom in/out, and overlay toggle controls.
- **REQ-PRV-004**: Preview must display layout warnings below or above the flyer, not silently hide them.
- **REQ-PRV-005**: Preview must support desktop and mobile. On mobile, preview is a primary tab with AI and manual panels accessible through tabs/sheets.
- **REQ-PRV-006**: Preview must scale SVG root to the preview pixel box while preserving `viewBox`.
- **REQ-PRV-007**: Preview and export must share a layout plan hash or snapshot in tests to verify they use the same geometry.

### 3.7 Manual Panel Requirements

- **REQ-MAN-001**: Manual controls must be split into focused subcomponents.
- **REQ-MAN-002**: Format controls must not be two cramped columns in narrow panels.
- **REQ-MAN-003**: Template picker must not hide the close action among template buttons.
- **REQ-MAN-004**: Layout controls must explain what each layout does in 1 short phrase or tooltip.
- **REQ-MAN-005**: Content fields must show live budget feedback from layout engine, not only schema max characters.
- **REQ-MAN-006**: When current copy exceeds layout capacity, fields must show a warning like `Troppo testo per A6 Classic: riduci corpo o scegli A5`.

### 3.8 AI Panel Requirements

- **REQ-AI-001**: AI prompt must receive exact copy budgets from layout engine: headline max chars, subheadline max chars, body max chars, recommended paragraphs, CTA max chars.
- **REQ-AI-002**: AI must receive current size, orientation, layout, sector if known, and density target.
- **REQ-AI-003**: AI output schema must include content plus optional layout advice, but automatic layout changes must require explicit user action.
- **REQ-AI-004**: AI quick actions must preserve layout-safe budgets.
- **REQ-AI-005**: AI generation must never return text longer than the layout budget for the current format/layout.
- **REQ-AI-006**: If user brief is too dense for the selected format, AI should produce shorter copy and optionally recommend a larger format or different layout.

Recommended AI output schema v2:

```ts
type FlyerAIOutputV2 = {
  headline: string;
  subheadline: string;
  body: string;
  cta: { label: string };
  layoutAdvice?: {
    recommendedLayout?: 'classic' | 'centered' | 'split' | 'magazine';
    recommendedSize?: 'A6' | 'A5' | 'A4' | 'Letter' | 'Square';
    reason?: string;
  };
  density?: 'low' | 'medium' | 'high';
};
```

### 3.9 Template Requirements

- **REQ-TPL-001**: Template catalog must be a data module separate from schemas.
- **REQ-TPL-002**: Every sector/layout template must be validated by geometry tests across all supported sizes and orientations.
- **REQ-TPL-003**: Template text must be short enough to pass layout engine without truncation in its default size/layout.
- **REQ-TPL-004**: Templates may include CTA URLs for QR demo, but user-entered documents may leave URL empty.
- **REQ-TPL-005**: Picsum images are acceptable only for temporary demo templates. Long-term implementation should use local curated assets or a stable tagged image source.
- **REQ-TPL-006**: Sector identity should affect visual style: restaurant warm/editorial, event energetic/high-contrast, salon soft/premium, shop catalog/retail.

### 3.10 Frontend Design Guidelines

- **GUD-UI-001**: Treat the flyer page as a print studio, not a generic form. The preview is the proof, AI is the copy assistant, manual panel is production controls.
- **GUD-UI-002**: Use a print-proof signature element: optional trim/safe/bleed overlays with fine print-shop lines. This is the distinctive design risk and it is functional.
- **GUD-UI-003**: Preserve Quickbrand visual language: dark navy sidebar, red accent for primary actions, soft cards, rounded controls.
- **GUD-UI-004**: Do not overuse red. Red is for active primary action and selected layout, not every badge.
- **GUD-UI-005**: Use clear density indicators: `Spazio ok`, `Quasi pieno`, `Troppo testo`.

## 4. Interfaces & Data Contracts

### 4.1 Layout Engine Interface

```ts
export type FlyerElementId =
  | 'hero'
  | 'headline'
  | 'subheadline'
  | 'accent'
  | 'body'
  | 'cta'
  | 'qr'
  | 'qrLabel';

export interface MmRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FittedTextBlock {
  text: string;
  fontSizePt: number;
  lineHeight: number;
  lines: string[];
  truncated: boolean;
  hidden: boolean;
}

export interface FlyerLayoutWarning {
  code:
    | 'headline_truncated'
    | 'subheadline_truncated'
    | 'body_truncated'
    | 'cta_truncated'
    | 'qr_label_hidden'
    | 'qr_hidden'
    | 'layout_overflow';
  severity: 'info' | 'warning' | 'error';
  message: string;
  element?: FlyerElementId;
}

export interface FlyerLayoutPlan {
  page: { total: MmRect; trim: MmRect; safe: MmRect; bleedMm: number };
  layout: FlyerLayout;
  size: FlyerSize;
  orientation: FlyerOrientation;
  density: 'low' | 'medium' | 'high' | 'overflow';
  boxes: Partial<Record<FlyerElementId, MmRect>>;
  text: {
    headline: FittedTextBlock;
    subheadline: FittedTextBlock;
    body: FittedTextBlock;
    cta: FittedTextBlock;
    qrLabel?: FittedTextBlock;
  };
  visibility: Record<FlyerElementId, boolean>;
  warnings: FlyerLayoutWarning[];
}

export function computeFlyerLayout(flyer: Flyer): FlyerLayoutPlan;
```

### 4.2 Renderer Interface

```ts
export interface SvgRenderOptions {
  includeDebugBoxes?: boolean;
  includeBleedBackground?: boolean;
}

export function renderFlyerSvg(plan: FlyerLayoutPlan, flyer: Flyer, options?: SvgRenderOptions): string;
export function buildFlyerSvg(flyer: Flyer, options?: SvgRenderOptions): string;
```

### 4.3 AI Budget Interface

```ts
export interface FlyerCopyBudget {
  headlineMaxChars: number;
  subheadlineMaxChars: number;
  bodyMaxChars: number;
  bodyRecommendedParagraphs: 1 | 2 | 3;
  ctaMaxChars: number;
  densityTarget: 'low' | 'medium';
  warning?: string;
}

export function getFlyerCopyBudget(flyer: Flyer): FlyerCopyBudget;
```

## 5. Acceptance Criteria

- **AC-001**: Given any flyer size/layout/template combination, When `computeFlyerLayout` runs, Then no visible boxes overlap.
- **AC-002**: Given A6 Classic with restaurant copy, When preview renders, Then headline, CTA, QR, and QR label do not overlap.
- **AC-003**: Given Square Split with a long headline, When preview renders, Then headline is fitted to the text column and does not enter the hero image or footer.
- **AC-004**: Given A4 Classic with long body, When preview renders, Then body does not overlap CTA/QR; if too long it is truncated and a warning is shown.
- **AC-005**: Given Magazine A6, When preview renders, Then body uses 1 column.
- **AC-006**: Given Magazine A4, When preview renders, Then body uses 3 columns only if enough vertical space remains after hero/header/footer.
- **AC-007**: Given QR URL exists, When layout computes, Then QR remains >= minimum size and scannable.
- **AC-008**: Given QR label cannot fit, When layout computes, Then QR label hides before QR shrinks below minimum.
- **AC-009**: Given preview and PDF export for the same flyer, When geometry snapshots are compared, Then all element rectangles match.
- **AC-010**: Given user opens the flyer page on desktop width >= 1280px, Then AI, manual, and preview panels are all visible without horizontal page overflow.
- **AC-011**: Given user opens the flyer page on mobile width < 900px, Then preview is usable as its own tab/sheet and AI/manual remain accessible.
- **AC-012**: Given AI generates copy for A6, Then the output respects A6 copy budget and does not require truncation in the default layout.
- **AC-013**: Given AI generates copy for A4, Then body may be longer than A6 but must still fit the selected layout budget.
- **AC-014**: Given layout engine emits warnings, Then preview panel displays them near the preview.
- **AC-015**: Given user toggles safe-area overlay, Then trim, bleed, and safe zones are displayed without affecting export output.

## 6. Test Automation Strategy

### Test Levels

- Unit tests for geometry, text fit, template factory, AI budgets, SVG renderer.
- Component tests for AI panel, manual panel, preview panel, template picker, format controls.
- Integration tests for preview/export geometry parity.
- Optional Playwright visual tests for representative combinations.

### Required Unit Test Matrix

All combinations must be tested for geometry validity:

```text
4 sectors x 4 layouts x 9 format/orientation variants = 144 cases

format/orientation variants:
- A6 portrait
- A6 landscape
- A5 portrait
- A5 landscape
- A4 portrait
- A4 landscape
- Letter portrait
- Letter landscape
- Square
```

Each case must assert:

- No overlap among visible boxes.
- All visible boxes inside safe/trim rules.
- QR min size respected when visible.
- Warnings are present when truncation/hiding occurs.
- Density is not `overflow` for default templates.

### Required Test Files

```text
src/utils/flyer/__tests__/geometry.test.ts
src/utils/flyer/__tests__/layoutEngine.test.ts
src/utils/flyer/__tests__/textFit.test.ts
src/utils/flyer/__tests__/svgRenderer.test.ts
src/utils/flyer/__tests__/templateCatalog.test.ts
src/ai/flyer/__tests__/budgets.test.ts
src/ai/flyer/__tests__/prompts.test.ts
src/components/flyer/__tests__/FlyerAiPanel.test.tsx
src/components/flyer/__tests__/FlyerManualPanel.test.tsx
src/components/flyer/__tests__/FlyerPreviewPanel.test.tsx
```

### Existing Commands

- `npm run typecheck`
- `npm run test`
- Targeted tests with `npx vitest run <path>`

## 7. Rationale & Context

The current renderer directly builds SVG strings from flyer data. It estimates placement with simple width-based font clamps and reserves footer space globally. This fails because actual available text area depends on size, orientation, layout, hero presence, CTA, QR, and body length. Current examples show the failure: headline consumes most of the page, CTA overlaps with headline/footer, QR label collides, and body disappears.

The solution must separate calculation from drawing. The layout engine is the source of truth for geometry. The renderer must only draw the plan. AI must generate content to the plan budget, not to broad schema limits. The editor must surface layout warnings so the user understands when the selected size/layout is too dense.

The frontend design direction is a print studio: AI writes, manual controls tune, preview proofs. The distinctive element is the optional print-proof overlay, which is both visually professional and functionally useful.

## 8. Dependencies & External Integrations

### External Systems

- **EXT-001**: DeepSeek-compatible AI provider via existing `/api/ai/chat` route. Required for flyer AI copy generation.
- **EXT-002**: Picsum image service for temporary demo template hero images. Long-term replacement should be local curated assets.

### Third-Party Services

- **SVC-001**: QR generation via existing `qrcode` utility integration.
- **SVC-002**: pdfmake for PDF export.

### Technology Platform Dependencies

- **PLT-001**: React + Vite frontend.
- **PLT-002**: Vitest + Testing Library for tests.
- **PLT-003**: Browser SVG support including `foreignObject` if retained.

## 9. Examples & Edge Cases

### 9.1 Bad Current Case

Input:

```json
{
  "size": "Square",
  "orientation": "portrait",
  "layout": "classic",
  "headline": "Cena di Degustazione",
  "subheadline": "Venerdi 15 agosto - ore 20:30",
  "body": "Menu di 5 portate dello chef Marco Bianchi...",
  "cta": { "label": "Prenota un Tavolo", "url": "https://example.com" }
}
```

Required behavior:

- Hero <= 28% of safe area height.
- Headline wraps and fits above accent/sub/body.
- CTA and QR stay in reserved footer.
- Body is shown if space allows, otherwise truncated with warning.
- No overlap among headline, CTA, QR, QR label.

### 9.2 A6 Constraint Case

Input: A6 portrait + long body + QR.

Required behavior:

- Body budget is small.
- AI should generate short body.
- Manual overlong body is truncated in export/preview with warning.
- QR remains visible and scannable.

### 9.3 Magazine A6

Required behavior:

- Magazine uses 1 body column, not 3.
- If template requests 3 paragraphs, body is rendered as stacked paragraphs.

### 9.4 Split Square

Required behavior:

- Text column must be wide enough for headline.
- If headline cannot fit, split should reduce headline font size and may move body below headline before truncating.

## 10. Validation Criteria

- `npm run test` passes.
- `npm run typecheck` passes after pre-existing unrelated type errors are resolved or excluded from this work.
- Geometry matrix test passes for all 144 cases.
- Default 16 templates produce no `overflow` density.
- At least 8 stress fixtures produce warnings instead of overlaps.
- Manual visual check confirms A6, A5, A4, Letter, Square across all layouts do not overlap text/CTA/QR.
- AI generated content for A6, A5, A4, Square fits without immediate truncation for normal briefs.
- Preview pixel scaling test verifies root SVG is pinned to preview dimensions.
- PDF/PNG export smoke tests pass after refactor.

## 11. Related Specifications / Further Reading

- `spec/spec-design-phase3-flyer.md`
- `src/components/FlyerEditor.tsx`
- `src/utils/flyerGenerator.ts`
- `src/utils/documentSchemas.ts`
- `src/ai/flyerOrchestrator.ts`
- `src/ai/prompts/flyerSystem.ts`
