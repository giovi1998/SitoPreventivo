---
title: Business Card Refactor, Submodules, Layout Grid, Preview, Export and AI
version: 1.0
date_created: 2026-07-03
last_updated: 2026-07-03
owner: Quickbrand
tags: [design, architecture, frontend, card, grid, preview, print, ai, refactor]
---

# Introduction

This specification defines the required refactor of the Quickbrand business
card module into focused submodules, mirroring the structure already adopted
for the flyer module (`src/utils/flyer/`, `src/components/flyer/`). The goal is
to make the card module maintainable, visually reliable across every layout
and grid combination, and usable as a professional print-oriented workspace
where AI, manual controls, grid editor, preview and export have clear,
separated responsibilities.

The current implementation is functionally complete (Phase 2.2 shipped the
master switch, init-from-layout, QR sizing, fontScale, servicesLabel, AI
parity and shared form/grid components). However the codebase still
concentrates ~1406 lines in a single `src/utils/cardGenerator.ts` (SVG
renderer + PDF export + PNG pipeline + image compression + QR payload + PDF
page layout + text derivation) and ~865 lines in `src/components/CardEditor.tsx`
(state, form wiring, AI wiring, grid wiring, export menu, save, mobile tabs,
zoom). The CSS was already split in Phase 2.2 into `src/components/card/*.css`
(7 files); the same discipline must now be applied to TypeScript/TSX.

This spec also consolidates the rendering gotchas discovered during Phase 2
and 2.2 (font-size units in SVG with mm viewBox, QR sync rendering, logo
proportions, grid collision, hostname redundancy) and the open UX issues
(mobile grid drag-and-drop, persistent grid selection, jsdom QR tests) into
explicit requirements, so the refactor closes them instead of carrying them
forward.

## 1. Purpose & Scope

This specification covers:

- Refactor of `src/utils/cardGenerator.ts` into focused submodules under
  `src/utils/card/`, with a compatibility barrel `cardGenerator.ts` that
  re-exports the public API (no breaking imports).
- Refactor of `src/components/CardEditor.tsx` into a shell/orchestrator that
  composes subcomponents, reusing the already extracted `src/components/card/`
  set and adding the missing pieces (export menu, save action, mobile tabs).
- Refactor of `src/components/CardPreview.tsx` into a thin surface that reads
  a shared `card/previewHelpers.ts` and renders via `card/PreviewSurface.tsx`.
- A single source of truth for grid element knowledge, eliminating the 8
  duplicated definitions of "which elements exist on front/back" and "does
  this element have content".
- A grid layout contract (REQ-GRID) that formalizes collision detection,
  init-from-layout, QR sizing, master switch, persistent selection and the
  mobile grid editor behavior.
- Consolidation of the rendering gotchas into regression-testable requirements.
- A test matrix that locks the refactor (all existing tests stay green) and
  adds coverage for the open UX issues.

This specification does **not** require changes to `api/index.ts` (the AI
endpoint pattern is unchanged) nor to the `documents` table schema. It does
not change the public exports consumed by `AppShell`, `CardPage`,
`useCardExport`, `useAICard`, `cardOrchestrator`, `cardMerge`, tests.

## 2. Definitions

- **Business Card**: A print document with two sides (front, back), a size
  preset (EU 85x55, US 89x51, Square 65x65), a layout (`left`, `centered`,
  `split`), an optional QR code, optional photo/logo, contacts, services,
  socials.
- **Trim Box**: The final physical card size after cut, e.g. 85x55mm.
- **Bleed**: Extra area outside the trim box, currently 3mm on all sides
  (`BLEED_MM`).
- **Layout (flexbox)**: The default visual arrangement of front elements when
  the grid master switch is off. One of `left`, `centered`, `split`.
- **Grid Mode**: When the master switch `showGrid` is on and at least one
  element with content is placed on the grid, the front/back render via
  CSS Grid with explicit `x,y,w,h` coordinates per element.
- **Grid Element**: One of `photo`, `name`, `title`, `company`, `logo`, `qr`,
  `contacts`, `socials`. Front elements: `photo, name, title, company, logo`.
  Back elements: `contacts, qr, socials`.
- **Grid Cell**: Integer coordinate in a 0-indexed grid. `x` = column, `y` =
  row, `w` = column span, `h` = row span.
- **Master Switch (per side)**: `card.front.useGrid` and `card.back.useGrid`
  are the master switches that toggle grid mode for each side independently.
  `isGridModeFor(side, card) = card[side].useGrid && hasGridElements(side, card)`.
  The UI "Griglia ON" toggle in the editor shell turns both sides on/off
  together, setting `useGrid=true` on both sides when activated and
  `useGrid=false` on both sides when deactivated.
- **Init-from-layout**: When the master switch is turned on for a side that
  has no grid yet, the grid is derived from the current flexbox layout via
  `deriveGridFromLayout`, so the card does not "jump".
- **QR Payload**: The resolved string encoded by the QR. May come from
  `card.back.qrPayload` (explicit) or be derived from the back website/email
  (`getEffectiveQrPayload`).
- **Font Scale**: `card.style.fontScale` (0.7–1.5, default 1) applied as CSS
  variable `--card-font-scale` on the whole card and replicated in export via
  helper `fs()`.
- **Safe Font Family**: A font family in `SAFE_FONT_FAMILIES`, shown in the
  selector. Imported cards with an out-of-set font show "Personalizzato"
  without overwriting the stored value.
- **Tier**: Free vs unlocked. Free tier exports carry a watermark
  (`watermark.ts`). Unlocked tier (admin or via unlock code) exports clean.

## 3. Requirements, Constraints & Guidelines

### 3.1 Architecture Requirements

- **REQ-ARCH-001**: `src/utils/cardGenerator.ts` must no longer contain SVG
  rendering, PDF export, PNG pipeline, image compression, QR payload
  derivation, PDF page layout, text derivation and SVG/PNG bridge in one file.
- **REQ-ARCH-002**: The public imports `buildCardSvg`, `generateCardPdf`,
  `generateCardPng`, `compressImage`, `resolveCardQrPayload`,
  `getEffectiveQrPayload`, `computePageCardEntries`, `PageLayout`,
  `PageCardEntry`, `CompressImageOptions`, and the re-exported size constants
  (`SIZE_PRESETS_MM`, `BLEED_MM`, `CARD_A4_*`) must continue to work from
  `src/utils/cardGenerator.ts` during and after the refactor by re-exporting
  from new modules. No external consumer changes its import path.
- **REQ-ARCH-003**: `CardEditor.tsx` must be reduced to a shell/orchestrator
  component. Form, grid, AI, preview, export, save, tabs must live in
  dedicated components (some already do in `src/components/card/`; the missing
  ones are export menu, save action, mobile tabs, preview surface).
- **REQ-ARCH-004**: `CardPreview.tsx` must be reduced to a thin surface. All
  helper logic (`SIZE_CLASS`, `clampFontScale`, `isGridModeFor`,
  `gridPlacement`, monogram/handle/hostname derivation) must move to
  `src/utils/card/previewHelpers.ts` and be imported by both preview and
  export to guarantee parity.
- **REQ-ARCH-005**: CSS must stay split by responsibility (already done in
  Phase 2.2). No CSS may be re-merged into a single file.
- **REQ-ARCH-006**: Grid element knowledge must be defined in exactly one
  module (`src/utils/card/gridElements.ts`) and consumed by
  `documentSchemas`, `CardGridControls`, `CardEditor`, `cardMerge`,
  `aiCardInputSchema`. The duplicated `hasElementContent` /
  `getAvailableGridElements` / `availableGridElements` useMemo must collapse
  to a single function.
- **REQ-ARCH-007**: Text derivation (monogram, handle, hostname) must live in
  exactly one module (`src/utils/card/textDerivation.ts`) and be imported by
  both `CardPreview` and `cardGenerator` (export), eliminating the current
  duplication (`computeMonogramLocal` vs `deriveHandleLocal` vs
  `deriveHostnameLocal` in cardGenerator, mirrored in CardPreview).
- **REQ-ARCH-008**: The refactor must not change any public type
  (`BusinessCard`, `CardGrid`, `GridElement`, `BusinessCardLayout`,
  `BusinessCardSizePreset`, `BusinessCardQrSize`, `BusinessCardBorderStyle`)
  nor any Zod schema shape. Internal helper signatures may change.
- **REQ-ARCH-009**: No new dependencies may be added. The refactor reuses
  `pdfmake`, `qrcode`, existing `watermark.ts`, existing `qrGenerator.ts`.
- **REQ-ARCH-010**: The `_internalForTests()` export of `cardGenerator.ts`
  (exposing internals for tests) must be replaced by direct imports from the
  new submodules in tests; the barrel must drop it.

### 3.2 Proposed File Structure

Required target structure under `src/utils/card/` (new) and
`src/components/card/` (existing, extended):

```text
src/utils/card/
  index.ts                     // barrel: re-export public card utils
  gridElements.ts              // single source: element keys, side mapping, hasContent
  textDerivation.ts            // monogram, handle, hostname (shared preview/export)
  qrPayload.ts                 // resolveCardQrPayload, getEffectiveQrPayload
  pdfLayout.ts                 // PageLayout, PageCardEntry, computePageCardEntries
  svgRenderer.ts               // buildFrontSvg, buildBackSvg, extractQrInner, fs(), escapeXml
  pdfExport.ts                 // generateCardPDF + build*Cell + cardRect + cropMarks + mm2pt
  pngExport.ts                 // renderCardSideDataUrl, buildMinimalPng, PNG encoder helpers
  imageCompress.ts             // compressImage, loadImage
  units.ts                     // MM_TO_PT, mm2pt, constants (shared if extracted)
  __tests__/
    gridElements.test.ts
    textDerivation.test.ts
    qrPayload.test.ts
    pdfLayout.test.ts
    svgRenderer.test.ts
    pdfExport.test.ts
    pngExport.test.ts
    imageCompress.test.ts

src/utils/cardGenerator.ts     // COMPATIBILITY BARREL: re-export only

src/components/card/
  CardFormFields.tsx           // existing (Phase 2.2)
  CardGridControls.tsx         // existing (Phase 2.2) - thin consumer of gridElements
  CardAIControls.tsx           // existing (Phase 2.2)
  PreviewSurface.tsx           // existing (Phase 2.2)
  CardExportMenu.tsx            // NEW: unified export menu (desktop + mobile variants)
  CardSaveAction.tsx            // NEW: save button (desktop + mobile variants)
  CardEditorTabs.tsx            // NEW: mobile tab switcher (Anteprima/Modifica/AI)
  labels.ts                    // NEW: LAYOUT_LABELS, SIZE_PRESET_LABELS, BORDER_LABELS,
                               //      QR_SIZE_LABELS, SOCIAL_PLATFORMS (from CardFormFields)

src/components/CardEditor.tsx   // thin orchestrator (shell) + compat default export
src/components/CardPreview.tsx   // thin surface (uses utils/card/previewHelpers + PreviewSurface)
src/components/MobileGridEditor.tsx // thin wrapper around CardGridControls mode="mobile"

src/utils/card/previewHelpers.ts // SIZE_CLASS, clampFontScale, isGridModeFor, gridPlacement
                                  // (consumed by CardPreview; NOT by export, export uses svgRenderer)
```

AI submodules (already mostly separated; only quick-action prompts move):

```text
src/ai/
  cardOrchestrator.ts          // existing
  cardMerge.ts                 // existing - imports from utils/card/gridElements
  aiCardInputSchema.ts          // existing
  hooks/useAICard.ts            // existing
  prompts/
    cardSystem.ts               // existing
    cardContext.ts              // existing
    cardQuickActions.ts         // NEW: { mode, label, title?, prompt }[] unified
```

Compatibility modules (must stay during and after migration):

```text
src/utils/cardGenerator.ts     // re-export only (barrel)
src/components/CardEditor.tsx  // thin default export wrapper of CardEditorShell
```

### 3.3 Grid Requirements (REQ-GRID)

This section formalizes the grid behavior shipped in Phase 2.2 as an explicit
contract so the refactor preserves it and tests can lock it.

- **REQ-GRID-001 (Master switch per side)**: `card.front.useGrid` and
  `card.back.useGrid` are the master switches that control grid mode for
  each side independently. `isGridModeFor(side, card)` returns
  `card[side].useGrid && hasGridElements(side, card)`. The UI "Griglia ON"
  toggle in the editor shell synchronises both sides: when activated it sets
  `useGrid=true` on both sides (initialising missing grids via
  `deriveGridFromLayout`); when deactivated it sets `useGrid=false` on both
  sides.
- **REQ-GRID-002 (Init-from-layout)**: When the master switch is turned on for
  a side that has no grid elements placed yet, the grid must be initialized
  from the current flexbox layout via `deriveGridFromLayout(side, card)`. The
  card must not jump visually: every element that is visible in flexbox must
  appear in a sensible grid cell.
- **REQ-GRID-003 (Element set, per side)**:
  - Front: `photo`, `name`, `title`, `company`, `logo`.
  - Back: `contacts`, `qr`, `socials`.
  This set is defined once in `utils/card/gridElements.ts` and consumed by
  `documentSchemas` (Zod), `CardGridControls`, `CardEditor`, `cardMerge`,
  `aiCardInputSchema`.
- **REQ-GRID-004 (Collision detection = BLOCK)**: Moving or resizing an
  element must be blocked if it would collide with another placed element or
  exceed the grid edge. The block must happen before the state update. The
  helper is `gridUtils.clampMove` / `clampResize` (gradual step toward the
  nearest valid position). AI-generated grids must be sanitized through the
  same clamps in `cardMerge.ts`.
- **REQ-GRID-005 (QR sizing in flexbox mode)**: In flexbox mode (master switch
  off), `card.back.qrSize` controls the QR pixel size:
  `small` = 84px, `medium` = 120px, `large` = 160px (`QR_SIZE_PX`). In grid
  mode the QR size derives from the cell.
- **REQ-GRID-006 (Font scale)**: `card.style.fontScale` (0.7–1.5, default 1)
  is applied as CSS variable `--card-font-scale` on the card root in preview
  and as a multiplier via `fs()` in SVG/PDF export. AI-returned `fontScale`
  must be clamped to `[0.7, 1.5]` in `cardMerge.ts`.
- **REQ-GRID-007 (Persistent selection)**: The selected grid element must
  survive tab switches (Anteprima → Modifica → AI → Anteprima). Today
  `selectedGridElement` is local `useState` in `CardEditor` and resets on tab
  change. The refactor must lift it to `card.selectedGridElement` (persisted)
  or to a `useState` in the shell that is not reset by tab unmount.
- **REQ-GRID-008 (Mobile grid editor)**: On screens < 900px the grid editor
  uses `MobileGridEditor` which renders `CardGridControls mode="mobile"` plus
  a 3×3 arrow popup (no drag-and-drop). The popup must show
  `title="Limite (collisione)"` when the block is due to collision and
  `title="Limite raggiunto"` when due to edge. The refactor must not regress
  this; drag-and-drop is a future enhancement (REQ-UX-002).
- **REQ-GRID-009 (Grid presets)**: `gridPresetLeft`, `gridPresetCentered`,
  `gridPresetSplit`, `gridPresetBackDefault` must remain available from
  `documentSchemas` (re-exported) and must include `logo` with the positions
  documented in AGENTS.md (left: `(3,2,1,2)`, centered: `(3,3,1,1)`, split:
  `(3,2,1,2)` with contacts shrunk to 2-col and qr at `(2,2,1,2)`).
- **REQ-GRID-010 (Anti-hallucination in AI merge)**: `cardMerge.ts` must route
  front AI keys to `grid` and back AI keys to `backGrid`, must not overwrite
  `photoUrl`/`logoUrl` (base64 user uploads), and must clamp any AI move/resize
  through `gridUtils.clampMove`/`clampResize`. The system prompt
  (`prompts/cardSystem.ts`) must keep the explicit anti-collision rules and
  the element list including `logo`.

### 3.4 Rendering Requirements (REQ-REN)

These consolidate the Phase 2/2.2 rendering gotchas into testable requirements.

- **REQ-REN-001 (SVG font-size unitless in mm viewBox)**: When the SVG
  `viewBox` is in millimetres, all `font-size` attributes and `foreignObject`
  body CSS `font-size` must be **unitless numeric values in mm user units**.
  Writing `font-size="8.5pt"` or `font-size="3mm"` causes the browser to convert
  to px at 96dpi and then interpret those px as mm user units, producing a
  font ~3.78× too large. The renderer must use
  `font-size="${fontSizePt * MM_PER_PT}"` (numeric = mm). Tests must assert
  no `pt`/`mm`/`px` unit suffix on `font-size` attributes inside an mm
  `viewBox`.
- **REQ-REN-002 (QR rendering is synchronous)**: `generateQrSvg` must be
  synchronous (returns `string`, not `Promise<string>`). Preview must render
  the QR on first paint, not after an async effect. Export must call the sync
  function directly.
- **REQ-REN-003 (Logo proportions ~30% of card)**: In preview (CSS),
  `card-logo` 60→100px, `.centered` 76→125px, `.split` 64→110px. In SVG export
  (`buildFrontSvg`): left `photoSize * 0.48`, split `pxH * 0.20`, centered
  `pxH * 0.20`. In PDF export (`buildFrontCell`):
  `Math.min(25, dims.w * 0.30)` mm. Logo must render in `centered` layout (it
  was missing before Phase 2.1).
- **REQ-REN-004 (Hostname redundancy)**: When the back has a QR code, the
  front must not also show the `hostname` under the photo (left/centered) or
  in the SVG/PDF front. Condition: `card.back.website && !qrPayload`.
- **REQ-REN-005 (Text wrap, no ellipsis)**: All editable text fields (name,
  social, contacts, wordmark, handle-stamp) must use
  `overflow-wrap: break-word`, not `text-overflow: ellipsis`. Long content wraps
  instead of being truncated.
- **REQ-REN-006 (servicesLabel editable)**: The heading above the services
  list (`servicesLabel`) must be editable. Services list (`services: string[]`)
  must auto-shrink font for items ≥ 40 char.
- **REQ-REN-007 (Safe font families)**: The font selector must show only
  `SAFE_FONT_FAMILIES`. Cards imported with an out-of-set font must display
  "Personalizzato" without overwriting the stored `fontFamily`.
- **REQ-REN-008 (Tier-aware watermark)**: Free tier exports (PDF/PNG/SVG) must
  carry the watermark via `watermark.applyWatermarkToPdf/Canvas`. Unlocked
  tier (admin or unlock code) exports clean. The tier guard on save remains
  in `dataService` / API.
- **REQ-REN-009 (Preview/export geometry parity)**: Preview (flexbox + grid
  mode) and SVG/PDF export must produce visually equivalent layout for the
  same `BusinessCard`. The refactor must not introduce a separate geometry
  path: both consume `utils/card/textDerivation.ts` and the same grid element
  knowledge. A parity test must compare the rendered SVG string from export
  against the preview DOM structure for a set of fixtures.
- **REQ-REN-010 (buildMinimalPng fallback)**: `buildMinimalPng` must remain
  available as a fallback for jsdom environments where the canvas pipeline is
  unavailable. It must produce a valid 1x1 or minimal PNG.

### 3.5 Export Requirements (REQ-EXP)

- **REQ-EXP-001 (PDF 10-up)**: PDF export lays out 10 cards per A4 page
  (`CARD_A4_COLS=2`, `CARD_A4_ROWS=5`, `CARD_A4_GAP_MM`, `CARD_A4_MARGIN_MM`)
  via `computePageCardEntries`. Crop marks must be drawn.
- **REQ-EXP-002 (PNG raster)**: PNG export renders each side via the canvas
  pipeline (`renderCardSideDataUrl` → Image → canvas → PNG bytes). The
  `buildMinimalPng` fallback must be used when canvas is unavailable.
- **REQ-EXP-003 (SVG vector)**: SVG export uses `buildCardSvg` which calls
  `buildFrontSvg` + `buildBackSvg`. SVG must be self-contained (fonts embedded
  as base64 or web-safe, images inline base64).
- **REQ-EXP-004 (JSON backup)**: JSON export serializes the full `BusinessCard`
  (including grid, style, images base64). Not affected by this refactor.
- **REQ-EXP-005 (All client-side)**: All export happens in the browser via
  `pdfmake` + canvas. No server upload. Must stay free-tier friendly.
- **REQ-EXP-006 (Unified export menu)**: The desktop inline export `<ul>` and
  the mobile export `<ul>` must collapse into a single `<CardExportMenu
  variant="desktop|mobile" />` with the same 6 actions (PDF, PNG front, PNG
  back, SVG, JSON, copy).

### 3.6 Preview Requirements (REQ-PRV)

- **REQ-PRV-001 (Zoom)**: Zoom range 50–150%, step 10%, default 70% on mobile /
  100% on desktop. Scaling must reserve width (no page overflow). The zoom
  hook must react to the mobile/desktop breakpoint.
- **REQ-PRV-002 (Grid mode rendering)**: When `isGridModeFor(side, card)` is
  true, the side renders via CSS Grid with `gridPlacement(element, grid)`
  producing `gridColumn`/`gridRow` values. When false, flexbox layout
  (`left`/`centered`/`split`) is used.
- **REQ-PRV-003 (Side switch)**: Preview shows front and back; user can flip.
  Both sides must honor grid mode independently.
- **REQ-PRV-004 (QR placeholder)**: When `qrPayload` is empty, a placeholder
  "QR" is shown. The placeholder must be improved (not a bare string) and
  replaced by the real QR as soon as the sync `generateQrSvg` returns.
- **REQ-PRV-005 (jsdom testability)**: `generateQrSvg` does not run in jsdom.
  Tests on QR must mock `qrcode` or `qrGenerator.generateQrSvg` for
  determinism. The refactor must not add new untested QR paths.

### 3.7 AI Requirements (REQ-AI)

- **REQ-AI-001 (No tools)**: The card AI orchestrator does not use tools
  (no prices/discounts). It is a JSON round-trip. Must remain simpler than
  quote AI.
- **REQ-AI-002 (Dedicated module, no generic refactor)**: Card AI is Option B
  (dedicated module), not a generic refactor of quote AI. Zero risk to quote
  AI. Reuses `providerRegistry` DeepSeek via the same `/api/ai/chat` route.
- **REQ-AI-003 (Merge parity)**: `cardMerge.ts` must support `services`,
  `servicesLabel`, `qrSize` (enum), `fontScale` (clamped 0.7–1.5), and
  `grid.elements.logo`. AI must not overwrite `photoUrl`/`logoUrl`.
- **REQ-AI-004 (Grid routing)**: Front AI keys route to `card.grid`, back AI
  keys route to `card.backGrid`. AI moves/resizes are clamped via
  `gridUtils.clampMove`/`clampResize`.
- **REQ-AI-005 (Quick actions unified)**: Quick action definitions (label,
  mode, optional title, prompt text) must live in
  `src/ai/prompts/cardQuickActions.ts` as a single array. `CardAIControls`
  consumes the labels; `CardEditor`/the orchestrator consumes the prompts. No
  duplication, no drift between labels and prompts.
- **REQ-AI-006 (Streaming)**: Streaming works for all AI responses (text +
  tool, though card has no tools). Token usage is accumulated and shown in
  `result.response.usage`. Logs emit a block every 400ms with a preview.

### 3.8 Manual Panel Requirements (REQ-MAN)

- **REQ-MAN-001 (Shared form)**: Form fields (Fronte, Media, Retro, Servizi,
  Social, QR avanzato, Stile) must be defined once in `CardFormFields.tsx` and
  consumed by both the desktop 3-column layout and the mobile "Modifica" tab.
  No duplication (already true post Phase 2.2; the refactor must preserve it).
- **REQ-MAN-002 (Grid controls shared)**: `CardGridControls` must support
  `mode="inline"` (desktop) and `mode="mobile"` (mobile popup). The logic
  (`canUp/canDown/...`, clamp) must be computed once, not duplicated.
- **REQ-MAN-003 (Toast feedback)**: A successful move must emit a success
  toast. A blocked move (collision or edge) must emit an info toast with the
  reason. A master switch change must emit an info toast. An AI error must
  emit an error toast.
- **REQ-MAN-004 (iOS auto-zoom prevention)**: All inputs in mobile must have
  `font-size: 16px` to prevent iOS Safari auto-zoom on focus.

### 3.9 Open UX Issues (REQ-UX)

These are the scope-minor issues left open after Phase 2.2. The refactor must
address them.

- **REQ-UX-001 (Persistent grid selection)**: Lifting `selectedGridElement`
  to the shell (or to `card.selectedGridElement`) so it survives tab switches.
  See REQ-GRID-007.
- **REQ-UX-002 (Mobile grid drag-and-drop)**: Optional, not blocking. Today
  `MobileGridEditor` uses arrows + 3×3 popup. On small screens the 4
  directions × 2 resize × N elements become many taps. The refactor must
  keep the arrow approach but structure `MobileGridEditor` so a future
  drag-and-drop implementation can replace the popup without touching
  `CardGridControls`.
- **REQ-UX-003 (QR jsdom tests)**: `CardPreview` tests must mock
  `generateQrSvg` so QR rendering is deterministic and not skipped. The
  refactor must add this mock to the existing `CardPreview.test.tsx`.

### 3.10 Frontend Design Guidelines

- **GUD-UI-001**: Treat the card page as a print studio, not a generic form.
  Preview is the proof, AI is the copy/layout assistant, manual panel is
  production controls, grid is the layout override.
- **GUD-UI-002**: Preserve Quickbrand visual language: dark navy sidebar, red
  accent for primary actions, soft cards, rounded controls. Do not overuse
  red: it is for the active primary action and the selected layout, not every
  badge.
- **GUD-UI-003**: Mobile uses a tab system (Anteprima / Modifica / AI), a FAB
  for AI (56px, always visible), and a bottom sheet (85vh, ESC + backdrop
  close, `role=dialog`). The refactor must not regress this.
- **GUD-UI-004**: Desktop uses a 3-column layout: form | preview+grid | AI.
  All three must be visible without horizontal overflow at >= 1280px.

## 4. Interfaces & Data Contracts

### 4.1 Grid element knowledge (single source)

```ts
// src/utils/card/gridElements.ts

export type GridElementKey =
  | 'photo'
  | 'name'
  | 'title'
  | 'company'
  | 'logo'
  | 'qr'
  | 'contacts'
  | 'socials';

export type GridSide = 'front' | 'back';

export interface GridElementOption {
  value: GridElementKey;
  label: string;
}

export const FRONT_ELEMENT_KEYS: readonly GridElementKey[];
export const BACK_ELEMENT_KEYS: readonly GridElementKey[];

export function elementKeysForSide(side: GridSide): readonly GridElementKey[];

export function hasElementContent(
  key: GridElementKey,
  card: BusinessCard,
  side: GridSide,
): boolean;

export function getAvailableGridElements(
  side: GridSide,
  card: BusinessCard,
): GridElementOption[];
```

`documentSchemas.ts` `cardGridSchema`, `CardGridControls` `FRONT_KEYS`/
`BACK_KEYS`, `CardEditor` `availableGridElements` useMemo, `cardMerge`
`FRONT_GRID_KEYS`/`BACK_GRID_KEYS`, `aiCardInputSchema` must all import from
this module. `hasGridElements` and `deriveGridFromLayout` in
`documentSchemas.ts` must delegate to `hasElementContent` from this module.

### 4.2 Text derivation (single source)

```ts
// src/utils/card/textDerivation.ts

export function computeMonogram(card: BusinessCard): string;
export function deriveHandle(card: BusinessCard): string;
export function deriveHostname(card: BusinessCard): string;
```

`CardPreview` and `cardGenerator` (export) must both import these. The local
`computeMonogramLocal` / `deriveHandleLocal` / `deriveHostnameLocal` copies
must be deleted.

### 4.3 QR payload

```ts
// src/utils/card/qrPayload.ts

export function resolveCardQrPayload(card: BusinessCard): string;
export function getEffectiveQrPayload(card: BusinessCard): string;
```

Re-exported from `cardGenerator.ts` for compatibility.

### 4.4 SVG renderer

```ts
// src/utils/card/svgRenderer.ts

export function buildFrontSvg(card: BusinessCard, opts?: {
  withBleed?: boolean;
  tier?: Tier;
}): string;

export function buildBackSvg(card: BusinessCard, opts?: {
  withBleed?: boolean;
  tier?: Tier;
}): string;

export function buildCardSvg(card: BusinessCard, opts?: {
  withBleed?: boolean;
  tier?: Tier;
}): string;

// internal helpers, now importable by tests
export function fs(fontScale: number): (pt: number) => string; // returns mm unitless string
export function escapeXml(s: string): string;
export function extractQrInner(qrSvg: string): string;
```

### 4.5 PDF export

```ts
// src/utils/card/pdfExport.ts

export interface PageCardEntry { /* same shape as today */ }
export interface PageLayout { /* same shape as today */ }

export function computePageCardEntries(cardW: number, cardH: number): PageLayout;

export async function generateCardPDF(card: BusinessCard, opts?: {
  tier?: Tier;
}): Promise<void>;
```

### 4.6 PNG export

```ts
// src/utils/card/pngExport.ts

export async function generateCardPng(card: BusinessCard, opts?: {
  tier?: Tier;
  side?: 'front' | 'back' | 'both';
}): Promise<void>;

export function buildMinimalPng(...): Uint8Array;
```

### 4.7 Image compression

```ts
// src/utils/card/imageCompress.ts

export interface CompressImageOptions { /* same shape */ }
export async function compressImage(file: File | Blob, opts?: CompressImageOptions): Promise<string>;
export function loadImage(src: string): Promise<HTMLImageElement>;
```

### 4.8 Preview helpers

```ts
// src/utils/card/previewHelpers.ts

export const SIZE_CLASS: Record<BusinessCardSizePreset, string>;
export function clampFontScale(v: number): number;
export function isGridModeFor(side: GridSide, card: BusinessCard): boolean;
export function gridPlacement(
  element: GridElementKey,
  grid: CardGrid,
): { gridColumn: string; gridRow: string } | null;
```

### 4.9 Card quick actions (AI)

```ts
// src/ai/prompts/cardQuickActions.ts

export interface CardQuickAction {
  mode: string;
  label: string;
  title?: string;
  prompt: string;
}

export const CARD_QUICK_ACTIONS: CardQuickAction[];
```

### 4.10 Compatibility barrel

```ts
// src/utils/cardGenerator.ts  (barrel, re-export only)

export {
  buildCardSvg,
  buildFrontSvg,
  buildBackSvg,
} from './card/svgRenderer';
export { generateCardPDF } from './card/pdfExport';
export { generateCardPng } from './card/pngExport';
export { compressImage, type CompressImageOptions } from './card/imageCompress';
export {
  resolveCardQrPayload,
  getEffectiveQrPayload,
} from './card/qrPayload';
export {
  computePageCardEntries,
  type PageLayout,
  type PageCardEntry,
} from './card/pdfLayout';
export {
  SIZE_PRESETS_MM,
  BLEED_MM,
  CARD_A4_COLS,
  CARD_A4_ROWS,
  CARD_A4_GAP_MM,
  CARD_A4_MARGIN_MM,
} from './documentSchemas';
```

`_internalForTests()` is removed; tests import submodules directly.

## 5. Acceptance Criteria

- **AC-001**: Given any card size/layout/template combination, when the card
  is previewed and exported, then the front and back render without text
  overflow, without CTA/QR overlap, and without missing logo in `centered`.
- **AC-002**: Given a card with `card.front.useGrid=true` and at least one
  front element placed, when preview renders, then the front uses CSS Grid
  with the placed elements and no flexbox fallback bleeds through.
- **AC-003**: Given a card with `card.front.useGrid=false`, when preview
  renders, then the front uses the flexbox layout (`left`/`centered`/`split`)
  and the grid is not applied.
- **AC-004**: Given a card with `useGrid` turned on for a side with no grid,
  when the toggle fires, then `deriveGridFromLayout` initializes the grid and
  no element disappears.
- **AC-005**: Given two grid elements that would overlap after a move, when
  the move is attempted, then `clampMove` blocks it, the state is not updated,
  and an info toast "Limite (collisione)" is shown on mobile.
- **AC-006**: Given an AI response with a grid move that would collide, when
  `cardMerge` applies it, then `clampMove`/`clampResize` sanitize it and the
  merged card has no overlapping elements.
- **AC-007**: Given a card with `back.qrSize='medium'` and `useGrid=false`,
  when preview renders, then the QR is 120px. Given the same card with grid
  mode on (`useGrid=true` and grid elements placed), when preview renders,
  then the QR size derives from the cell.
- **AC-008**: Given a card with `style.fontScale=1.2`, when preview and
  export render, then both apply the 1.2 multiplier (CSS var in preview, `fs()`
  in SVG/PDF).
- **AC-009**: Given the user switches tab Anteprima → Modifica → AI →
  Anteprima, when returning to Anteprima, then the previously selected grid
  element is still selected.
- **AC-010**: Given preview and SVG export for the same card, when the
  rendered front SVG string is compared to the preview DOM structure (via a
  parity fixture), then the element positions and text content match.
- **AC-011**: Given the card page on desktop >= 1280px, then form, preview+grid
  and AI panels are all visible without horizontal overflow.
- **AC-012**: Given the card page on mobile < 900px, then the tab system
  (Anteprima/Modifica/AI), the FAB and the bottom sheet are usable.
- **AC-013**: Given a free-tier user, when exporting PDF/PNG/SVG, then the
  watermark is applied. Given an unlocked/admin user, then no watermark.
- **AC-014**: Given `generateQrSvg` is mocked in `CardPreview.test.tsx`, when
  the test runs in jsdom, then the QR is rendered deterministically.
- **AC-015**: Given the refactor is complete, when `npm run typecheck` and
  `npm run test` run, then all existing card tests pass without modification
  (except import paths where tests now import submodules directly).
- **AC-016**: Given `cardGenerator.ts` is now a barrel, when an external
  consumer imports `buildCardSvg` from `cardGenerator`, then it resolves and
  behaves identically.
- **AC-017**: Given a card with a long name/social/contact, when rendered in
  preview and export, then the text wraps with `overflow-wrap: break-word`
  and is not truncated with ellipsis.
- **AC-018**: Given a card with `back.website` set and a QR on the back, when
  the front renders, then the hostname is not duplicated under the photo.
- **AC-019**: Given a card with an out-of-set `fontFamily`, when the font
  selector renders, then it shows "Personalizzato" and does not overwrite the
  stored value.
- **AC-020**: Given the card AI quick actions, when `CardAIControls` renders
  and `CardEditor` runs an action, then the labels and prompts come from the
  same `CARD_QUICK_ACTIONS` array (no drift).

## 6. Test Automation Strategy

### Test Levels

- Unit tests for `gridElements`, `textDerivation`, `qrPayload`, `pdfLayout`,
  `svgRenderer`, `pdfExport`, `pngExport`, `imageCompress`, `previewHelpers`.
- Component tests for `CardExportMenu`, `CardSaveAction`, `CardEditorTabs`,
  `CardPreview` (with mocked QR), `CardEditor` (shell composition).
- Integration tests for preview/export parity (fixtures: left/centered/split
  × eu/us/square × grid on/off × with/without QR × with/without photo+logo).
- Regression tests for REQ-REN gotchas (font-size unitless, QR sync, logo
  proportion, hostname redundancy, text wrap).

### Existing tests that must stay green

All 18 existing card test files listed in the analysis must pass. Where they
imported from `cardGenerator` internals via `_internalForTests()`, they must
be updated to import from the new submodules directly. Where they imported
public symbols from `cardGenerator`, the import path may stay (barrel) or be
updated to `utils/card/...`; both must work.

### New test files

```text
src/utils/card/__tests__/gridElements.test.ts
src/utils/card/__tests__/textDerivation.test.ts
src/utils/card/__tests__/qrPayload.test.ts
src/utils/card/__tests__/pdfLayout.test.ts
src/utils/card/__tests__/svgRenderer.test.ts
src/utils/card/__tests__/pdfExport.test.ts
src/utils/card/__tests__/pngExport.test.ts
src/utils/card/__tests__/imageCompress.test.ts
src/utils/card/__tests__/previewHelpers.test.ts
src/components/card/__tests__/CardExportMenu.test.tsx
src/components/card/__tests__/CardSaveAction.test.tsx
src/components/card/__tests__/CardEditorTabs.test.tsx
src/ai/prompts/__tests__/cardQuickActions.test.ts
```

### Required regression test matrix (REQ-REN)

For each size preset × layout × grid on/off, assert:

- No `pt`/`mm`/`px` unit suffix on `font-size` attributes inside an mm
  `viewBox` in `buildFrontSvg`/`buildBackSvg`.
- `generateQrSvg` is called synchronously (no `await` in the render path).
- Logo renders in `centered` layout (SVG has an `<image>` for logo).
- Hostname not present under photo when `back.website && qrPayload`.
- Text fields use `overflow-wrap: break-word` in preview CSS (assert via
  computed style or class presence).

Matrix: 3 sizes × 3 layouts × 2 grid modes = 18 cases.

### Required grid test matrix (REQ-GRID)

For each side × preset × collision scenario, assert:

- `hasGridElements` matches `hasElementContent` aggregation.
- `deriveGridFromLayout` places every visible element.
- `clampMove` blocks collisions and returns the nearest valid position.
- `clampResize` blocks collisions and edge overflow.
- AI merge clamps moves (fixture: AI returns overlapping grid).
- Persistent selection survives tab switch (component test).

### Commands

- `npm run typecheck`
- `npm run test`
- `npx vitest run <path>`

## 7. Rationale & Context

The card module is functionally complete but structurally monolithic. Two
files concentrate ~2270 lines (`cardGenerator.ts` 1406 + `CardEditor.tsx`
865). The flyer module was refactored into 13 utils submodules + 12 component
submodules with average file size 100–300 lines. The card module should follow
the same discipline.

The CSS was already split in Phase 2.2 (`src/components/card/*.css`, 7 files,
1597 lines total). The TypeScript/TSX must now follow. The refactor is
mechanical: move code into focused modules, add a compatibility barrel,
collapse the 8 duplicated definitions of grid element knowledge into one,
deduplicate text derivation between preview and export, unify the export
menu and the quick action prompts.

The rendering gotchas (font-size units, QR sync, logo proportions, hostname
redundancy, text wrap) were discovered and fixed during Phase 2/2.2 but were
not locked by explicit requirements. This spec promotes them to REQ-REN so
the refactor cannot regress them.

The open UX issues (persistent grid selection, mobile drag-and-drop, QR jsdom
tests) are addressed: persistent selection becomes a REQ-GRID-007/REQ-UX-001
hard requirement, drag-and-drop is scoped as a future enhancement with the
structure prepared, and QR jsdom tests become a REQ-UX-003 requirement.

The frontend design direction is the same as the flyer: a print studio. The
distinctive element for the card is the grid editor (front/back), which is
the card's equivalent of the flyer's print-proof overlay.

## 8. Dependencies & External Integrations

### External Systems

- **EXT-001**: DeepSeek-compatible AI provider via existing `/api/ai/chat`
  route. Required for card AI (layout + copy suggestions).
- **EXT-002**: None other. Card export is fully client-side.

### Third-Party Services

- **SVC-001**: QR generation via existing `qrcode` utility (`qrGenerator.ts`).
- **SVC-002**: `pdfmake` for PDF export.
- **SVC-003**: Browser canvas for PNG export.

### Technology Platform Dependencies

- **PLT-001**: React + Vite frontend.
- **PLT-002**: Vitest + Testing Library + jsdom for tests.
- **PLT-003**: Browser SVG support (used by preview + SVG export).
- **PLT-004**: Browser canvas support (used by PNG export; `buildMinimalPng`
  fallback for jsdom).

### Shared utilities (no change)

- `src/utils/qrGenerator.ts` — shared with flyer.
- `src/utils/watermark.ts` — shared with flyer.
- `src/utils/documentSchemas.ts` — shared Zod schemas; card section re-exports
  `gridElements` helpers, flyer section stays as-is.

### Not shared with flyer (different domain)

- `gridUtils.ts` (integer grid 0–8) vs `flyer/geometry.ts` (mm real). Keep
  separate.
- Card has no text fitting (uses fixed `fontScale`) vs `flyer/textFit.ts`.
- Card has no copy budgets vs `flyer/budgets.ts`.

### Optional cross-module deduplication (minor, not required by this spec)

- `utils/xmlEscape.ts` could unify `cardGenerator.escapeXml` and
  `flyer/qrRenderer.escapeXmlAttr`. Different variants (text vs attr). Low
  benefit, deferred.
- `utils/units.ts` could unify `mm2pt`/`MM_TO_PT`. Low benefit, deferred.

## 9. Examples & Edge Cases

### 9.1 Font-size unit regression

Bad (pre-fix): `font-size="8.5pt"` inside `<svg viewBox="0 0 85 55">` renders
~11.33mm tall instead of 3mm.

Required: `font-size="${8.5 * MM_PER_PT}"` (≈ 2.99, unitless = mm user unit).

Test: assert no `font-size="...pt"` or `font-size="...mm"` exists in the SVG
output of `buildFrontSvg`/`buildBackSvg` for any fixture.

### 9.2 Grid collision block

Input: grid has `name` at `(0,0,2,1)` and `title` is moved to `(1,0,2,1)`.

Required: `clampMove` detects the overlap with `name`, blocks the move or
clamps to the nearest valid position, returns the original/nearest valid
grid. The state is not updated to an overlapping state.

### 9.3 Init-from-layout jump

Input: `showGrid=false`, front is `split` layout with photo left. User turns
on `showGrid`.

Required: `deriveGridFromLayout('front', card)` places photo full-height left
and text/logo right, matching the visible flexbox layout. No element
disappears, no jump.

### 9.4 AI grid hallucination

Input: AI returns `grid` with `name` at `(0,0,3,3)` and `title` at
`(1,1,2,2)` (overlapping).

Required: `cardMerge` clamps `title` via `clampResize`/`clampMove` to a
non-overlapping position, preserving `photoUrl`/`logoUrl`.

### 9.5 QR sizing flexbox vs grid

Input: `back.qrSize='large'`, `showGrid=false` → QR is 160px in preview.
Input: `back.qrSize='large'`, `showGrid=true`, `qr` cell is `(2,2,1,1)` → QR
fills the cell (size derives from cell, `qrSize` ignored in grid mode).

### 9.6 Persistent selection

Input: user selects `name` in the grid editor, switches to AI tab, switches
back to Anteprima.

Required: `name` is still selected in the grid editor.

### 9.7 Logo in centered export

Input: `layout='centered'`, `logoUrl` set, `showGrid=false`.

Required: `buildFrontSvg` includes an `<image>` for the logo at `pxH * 0.20`.
`buildFrontCell` (PDF) includes the logo at `Math.min(25, dims.w * 0.30)` mm.

### 9.8 Hostname redundancy

Input: `back.website='https://example.com'`, `back.qrPayload` resolves to a
non-empty string.

Required: `buildFrontSvg` (left/centered) does not emit the hostname text
under the photo. `CardPreview` front WEB row hides the hostname when
`qrPayload` is truthy.

## 10. Validation Criteria

- `npm run test` passes (all existing card tests + new submodule tests).
- `npm run typecheck` passes.
- Grid regression matrix (18 cases) passes.
- Rendering regression matrix (18 cases) passes.
- Preview/export parity fixtures pass.
- `cardGenerator.ts` is a barrel (re-export only, no logic).
- `CardEditor.tsx` is a shell (no form/AI/grid/export JSX inline; composes
  subcomponents).
- `CardPreview.tsx` is a thin surface (no monogram/handle/hostname/clamp
  logic inline; imports from `utils/card/previewHelpers`).
- Grid element knowledge is defined in exactly one module
  (`utils/card/gridElements.ts`).
- Text derivation is defined in exactly one module
  (`utils/card/textDerivation.ts`), consumed by both preview and export.
- Quick action prompts are defined in exactly one module
  (`ai/prompts/cardQuickActions.ts`).
- Export menu is a single component (`CardExportMenu`) with
  `variant="desktop"|"mobile"`.
- Persistent grid selection survives tab switches (AC-009).
- No new dependencies added.
- Manual visual check: left/centered/split × eu/us/square × grid on/off do
  not overlap text/QR/logo in preview and export.

## 11. Related Specifications / Further Reading

- `spec/spec-design-flyer-refactor-preview-ai.md` (mirror spec for the flyer
  refactor; this card spec follows the same structure and discipline).
- `spec/spec-design-phase2-business-card.md` (original Phase 2 spec).
- `spec/spec-design-phase2-2-card-refactor.md` (Phase 2.2 refactor spec).
- `src/components/CardEditor.tsx`
- `src/components/CardPreview.tsx`
- `src/utils/cardGenerator.ts`
- `src/utils/gridUtils.ts`
- `src/utils/documentSchemas.ts`
- `src/ai/cardOrchestrator.ts`
- `src/ai/cardMerge.ts`
- `src/ai/prompts/cardSystem.ts`
- `src/ai/prompts/cardContext.ts`
- `src/hooks/useAICard.ts`
- `src/hooks/useCardExport.ts`
- `src/hooks/useCardPreviewZoom.ts`
- `src/hooks/useCardAIFloating.tsx`
- AGENTS.md, sections "Business Card Module", "Known Issues, Card Module",
  "Responsive Patterns", "Volantino rendering gotchas" (the flyer gotchas
  inspired REQ-REN here).