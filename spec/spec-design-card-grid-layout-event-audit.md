---
title: Card Grid Layout Event Audit, Harness Hardening and WYSIWYG Layout Control
version: 1.0
date_created: 2026-07-14
last_updated: 2026-07-14
owner: Quickbrand
tags: [design, architecture, frontend, card, grid, e2e, playwright, logging, wysiwyg]
---

# Introduction

This specification defines how Quickbrand must **observe, log, and fully verify** business-card grid layout behavior across preview and export (SVG/PNG/PDF). It closes the gap that caused repeated preview≠export regressions: unit tests green, Playwright green, user-visible layout wrong.

The goal is a single, AI-ready contract for:

1. A solid **Playwright grid harness** (command the grid: move, resize, 3×3 align, side switch, presets).
2. A structured **event log** for every grid and export action (debug, QA, support).
3. A **layout audit** that compares preview geometry to export geometry with hard numeric ratios (not only “text present”).
4. Regression gates that **fail on visual layout drift**, not only on download success.

## 1. Purpose & Scope

### Purpose

- Make card grid + export **WYSIWYG-verifiable** under automation.
- Detect regressions (logo shrink, contact font explosion, label/value overlap, socials ghost gap) before merge.
- Provide a single harness API for e2e specs so tests do not re-implement login/fill/move/export ad hoc.

### Scope (in)

- `src/components/card/CardGridControls.tsx` and related shell hooks.
- `src/components/CardPreview.tsx` (front/back grid cells, debug overlay).
- `src/utils/card/svgRenderer.ts`, `backLayout.ts`, `previewHelpers.ts`.
- `src/hooks/useCardExport.ts` and export pipeline (SVG/PNG/PDF).
- Playwright suite under `e2e/card-*.spec.ts`.
- Optional client event bus / structured logs for grid + export (dev + test only by default).

### Scope (out)

- Flyer/logo modules (except shared patterns).
- AI cover/photo generation quality (only that export still includes cover when set).
- Production analytics SaaS; logging must use existing `logger` / `console` / toast patterns.

### Audience

- Coding agents implementing card layout fixes.
- Humans reviewing PR with Playwright screenshots.
- Future e2e authors.

### Assumptions

- Desktop Chromium Playwright is the primary e2e target.
- Export SVG is the source of truth for geometry ratios; PNG/PDF must match SVG content pipeline.
- Giovanni template (`createGiovanniCardTemplate`) is the golden fixture for visual parity.

## 2. Definitions

| Term | Definition |
|------|------------|
| **Grid element** | Named cell on front or back: `photo`, `logo`, `name`, `title`, `company`, `contacts`, `services`, `socials`, `qr`. |
| **Grid rect** | `{ x, y, w, h }` in grid units (integer cols/rows), plus optional `alignH`, `alignV`. |
| **Master switch** | UI toggle “Griglia ON/OFF” (`showGrid`); when ON, `useGrid` persists true and debug overlay is visible. |
| **3×3 position** | Nine-button matrix setting `alignH` ∈ left/center/right and `alignV` ∈ top/center/bottom on the selected element. |
| **Harness** | Shared Playwright helpers: login, fill, enable grid, select side/element, move, resize, align, export, parse SVG. |
| **Layout event** | Structured record emitted when the user (or test) changes grid state or export starts/ends. |
| **Layout audit** | Programmatic comparison of preview cell metrics vs export SVG metrics for the same card snapshot. |
| **WYSIWYG** | What You See Is What You Get: preview and export share geometry rules (via `backLayout` / same grid rects). |
| **Font ratio** | `fontSize / cardHeight` in user units; preferred over absolute px for resolution-independent asserts. |
| **Ghost gap** | Empty services row still occupying space when services content is empty, pushing socials down or leaving dead space. |
| **Golden fixture** | Giovanni template card used for visual screenshots and ratio baselines. |

## 3. Requirements, Constraints & Guidelines

### 3.1 Grid harness (Playwright)

- **REQ-HAR-001**: All card e2e specs that touch the grid MUST import helpers from a single module `e2e/helpers/cardHarness.ts` (create if missing). Duplicated `login` / `fillSampleData` / `moveElement` across files is forbidden after migration.
- **REQ-HAR-002**: Harness MUST expose at least:
  - `loginAsTestUser(page)`
  - `openCardEditor(page)`
  - `applyGiovanniTemplate(page)`
  - `fillSampleCard(page, overrides?)`
  - `setGridOn(page, on: boolean)`
  - `selectGridSide(page, 'front' | 'back')`
  - `selectGridElement(page, elementKey)`
  - `moveGrid(page, dir: 'left'|'right'|'up'|'down')`
  - `resizeGrid(page, axis: 'w+'|'w-'|'h+'|'h-')`
  - `alignGrid(page, h, v)`
  - `exportCard(page, action: 'svg-front'|'svg-back'|'png-front'|'png-back'|'pdf')` → `{ buffer, path }`
  - `parseCardSvg(svg: string)` → viewBox, texts[], images[], qrRects[], debug metadata if present
  - `resetScroll(page)` before measuring bounding boxes (known scroll-on-click artifact)
- **REQ-HAR-003**: Every harness action that clicks a control MUST wait for a stable selector (`data-testid` preferred) with timeout ≥ 5s and fail with the testid name in the error message.
- **REQ-HAR-004**: Harness MUST NOT use brittle CSS-only selectors for core grid commands when a `data-testid` exists.
- **REQ-HAR-005**: Element selector MUST support all keys: front `photo|logo|name|title|company`, back `contacts|services|socials|qr`.
- **REQ-HAR-006**: After `setGridOn(true)`, harness MUST assert `[data-testid="card-grid-debug"]` visible on the active preview side.

### 3.2 Stable test IDs (contract)

Existing IDs that MUST remain (do not rename without updating harness + tests):

| ID | Role |
|----|------|
| `card-grid-editor` | Grid control panel root |
| `grid-editor-side` | Front/back side select |
| `grid-editor-preset` | Preset select |
| `grid-align-matrix` | 3×3 matrix container |
| `grid-align-{h}-{v}` | One of 9 align buttons |
| `grid-move-left/up/down/right` | Move |
| `grid-resize-w-minus/plus`, `grid-resize-h-minus/plus` | Resize |
| `grid-el-{key}` | Preview cell for element key |
| `card-preview-front`, `card-preview-back` | Preview roots |
| `card-grid-debug` | Debug overlay when grid ON |
| `card-add-service`, `card-add-social` | Content injectors |
| `mobile-export-btn` / export menu items | Export |

- **REQ-TID-001**: Missing `data-testid` for a new grid control is a PR blocker.
- **REQ-TID-002**: Align buttons MUST stay `grid-align-{left|center|right}-{top|center|bottom}`.

### 3.3 Event logging (grid + export)

- **REQ-EVT-001**: Introduce a small pure module `src/utils/card/layoutEvents.ts` that defines event types and a ring buffer (max 100 events) for the current session.
- **REQ-EVT-002**: Event shape (JSON-serializable):

```ts
type CardLayoutEvent = {
  ts: string;           // ISO
  type:
    | 'grid.toggle'
    | 'grid.side'
    | 'grid.select'
    | 'grid.move'
    | 'grid.resize'
    | 'grid.align'
    | 'grid.preset'
    | 'export.start'
    | 'export.success'
    | 'export.error'
    | 'layout.audit';
  side?: 'front' | 'back';
  element?: string;
  payload?: Record<string, unknown>;
  result?: 'ok' | 'blocked' | 'error';
  reason?: string;      // e.g. collision, edge
};
```

- **REQ-EVT-003**: `CardEditorShell` MUST push events on: master switch, move (ok/blocked), resize (ok/blocked), align, side change, preset, export start/success/error. Toast messages already exist; events are structured complements, not replacements.
- **REQ-EVT-004**: In `import.meta.env.MODE === 'test'` or `localStorage['pq_card_layout_debug'] === '1'`, expose `window.__cardLayoutEvents` as a read-only array for Playwright (`page.evaluate(() => window.__cardLayoutEvents)`).
- **REQ-EVT-005**: Production builds MUST NOT send layout events to external services. Optional: mirror `export.*` errors through existing `logger.error`.
- **REQ-EVT-006**: Events MUST NOT include base64 images, photoUrl, logoUrl, or full SVG strings (PII / quota). Only dimensions, element keys, align values, and short error codes.

### 3.4 Layout audit (preview vs export)

- **REQ-AUD-001**: Pure function `auditCardLayout(card, side, { previewMetrics?, exportSvg })` in `src/utils/card/layoutAudit.ts`.
- **REQ-AUD-002**: For back side, audit MUST check:
  - Header present when contacts exist.
  - Contact key font ratio `fontSize/H ∈ [0.015, 0.04]`.
  - Contact value font ratio `∈ [0.015, 0.05]`.
  - No label/value horizontal overlap: `valueX >= labelX + labelW - ε` (ε ≤ 2 user units at 1100px height).
  - Socials text present when socials data non-empty.
  - QR rect in right half when default Giovanni grid (`x > W*0.4`).
  - Logo (front): largest non-photo image width/W ≥ 0.35 (blocks 60% shrink regression).
- **REQ-AUD-003**: Audit returns `{ ok: boolean, findings: Array<{ code, severity, message, metrics }> }`. Severity: `error` fails CI, `warn` is logged only.
- **REQ-AUD-004**: Shared geometry MUST come from `backLayout.ts` (or successor). Preview and SVG MUST NOT reintroduce independent padding/header formulas.
- **REQ-AUD-005**: When services content is empty, render path MUST collapse ghost services row consistently in preview and export (`effectiveBackGridForRender`).

### 3.5 Playwright coverage requirements

- **REQ-E2E-001**: Suite MUST include (names can map to existing files):
  1. Grid ON/OFF + Giovanni preview stable (screenshot).
  2. Move element → preview grid-row changes → SVG still contains content.
  3. 3×3 align name bottom-right → preview CSS align + SVG present.
  4. Back: contacts/services 3×3 → SVG contains content.
  5. Socials in export when added.
  6. Services in export when added.
  7. PNG front/back valid signature + non-trivial size.
  8. PDF valid `%PDF-`.
  9. **WYSIWYG visual**: preview screenshots + export PNG copies under `e2e/__screenshots__/wysiwyg-*`.
  10. **Font-ratio hard assert** on SVG back (TELEFONO).
  11. **Logo size hard assert** on SVG front.
- **REQ-E2E-002**: A test that only checks “download non-empty” is **insufficient** for layout-sensitive paths. Font-ratio or logo-width asserts are mandatory for front/back export tests.
- **REQ-E2E-003**: Before measuring bounding boxes after move/align clicks, tests MUST `window.scrollTo(0,0)` then `scrollIntoViewIfNeeded` on the cell (known harness gotcha).
- **REQ-E2E-004**: Screenshots written under `e2e/__screenshots__/` MUST be committed when intentional (visual baseline), or gitignored only if the project policy switches to CI artifacts only. Current project commits screenshots.
- **REQ-E2E-005**: Full card e2e command for PR gate:

```bash
npx playwright test e2e/card-export-inspection.spec.ts e2e/card-wysiwyg-visual.spec.ts e2e/card-grid-export-roundtrip.spec.ts e2e/card-grid-behavior.spec.ts e2e/card-visual.spec.ts
```

All must pass. Unit green alone is not enough for layout PRs.

### 3.6 Constraints

- **CON-001**: Client-side export only (no server PDF).
- **CON-002**: Do not split `api/index.ts` for this work.
- **CON-003**: Do not store base64 images in layout event buffer.
- **CON-004**: Do not rename public export menu labels without updating harness matchers.

### 3.7 Guidelines

- **GUD-001**: Prefer font **ratios** over absolute px in e2e.
- **GUD-002**: Prefer one harness module over copy-paste helpers.
- **GUD-003**: When fixing layout, add a regression test that fails without the fix (TDD).
- **GUD-004**: Read AGENTS.md “Card export SVG gotchas” before changing `svgRenderer.ts`.

### 3.8 Patterns

- **PAT-001**: Shared geometry module (`backLayout`) → both React preview and SVG.
- **PAT-002**: Event ring buffer + `window.__cardLayoutEvents` for test introspection.
- **PAT-003**: Export SVG parse → audit function → e2e assert on findings.

## 4. Interfaces & Data Contracts

### 4.1 Harness module (TypeScript surface)

```ts
// e2e/helpers/cardHarness.ts
export type GridElementKey =
  | 'photo' | 'logo' | 'name' | 'title' | 'company'
  | 'contacts' | 'services' | 'socials' | 'qr';

export type ExportAction =
  | 'svg-front' | 'svg-back'
  | 'png-front' | 'png-back'
  | 'pdf';

export interface ParsedCardSvg {
  width: number;
  height: number;
  texts: Array<{ x: number; y: number; fontSize: number; text: string; anchor?: string }>;
  images: Array<{ x: number; y: number; width: number; height: number; hrefPrefix: string }>;
  qrRects: Array<{ x: number; y: number; width: number; height: number }>;
}

export function loginAsTestUser(page: Page): Promise<void>;
export function openCardEditor(page: Page): Promise<void>;
export function applyGiovanniTemplate(page: Page): Promise<void>;
export function setGridOn(page: Page, on: boolean): Promise<void>;
export function selectGridSide(page: Page, side: 'front' | 'back'): Promise<void>;
export function selectGridElement(page: Page, key: GridElementKey): Promise<void>;
export function moveGrid(page: Page, dir: 'left'|'right'|'up'|'down'): Promise<void>;
export function resizeGrid(page: Page, axis: 'w+'|'w-'|'h+'|'h-'): Promise<void>;
export function alignGrid(page: Page, h: 'left'|'center'|'right', v: 'top'|'center'|'bottom'): Promise<void>;
export function exportCard(page: Page, action: ExportAction): Promise<{ buffer: Buffer; path: string }>;
export function parseCardSvg(svg: string): ParsedCardSvg;
export function resetScroll(page: Page): Promise<void>;
```

### 4.2 Layout event bus

```ts
// src/utils/card/layoutEvents.ts
export function pushLayoutEvent(e: Omit<CardLayoutEvent, 'ts'>): void;
export function getLayoutEvents(): readonly CardLayoutEvent[];
export function clearLayoutEvents(): void;
export function attachLayoutEventsToWindow(): void; // test/debug only
```

### 4.3 Layout audit

```ts
// src/utils/card/layoutAudit.ts
export type AuditFinding = {
  code:
    | 'FONT_RATIO_KEY'
    | 'FONT_RATIO_VALUE'
    | 'FONT_RATIO_SOCIAL'
    | 'LABEL_VALUE_OVERLAP'
    | 'LOGO_TOO_SMALL'
    | 'QR_POSITION'
    | 'MISSING_TEXT'
    | 'GHOST_GAP';
  severity: 'error' | 'warn';
  message: string;
  metrics?: Record<string, number>;
};

export function auditExportSvg(side: 'front'|'back', svg: string, card: BusinessCard): {
  ok: boolean;
  findings: AuditFinding[];
};
```

### 4.4 SVG export geometry rules (normative ratios)

At export resolution `H = viewBox height`:

| Element | Rule |
|---------|------|
| Contact key | `fontSize/H ∈ [0.015, 0.04]` |
| Contact value | `fontSize/H ∈ [0.015, 0.05]` |
| Socials | `fontSize/H ∈ [0.012, 0.04]` |
| Header eyebrow | `fontSize/H ∈ [0.02, 0.05]` |
| Front logo box | `width/W ≥ 0.35` (non-photo image) |
| QR default Giovanni | `x > W*0.4`, `width/H ∈ [0.15, 0.55]` |

These match CSS rem sizing on a ~340px preview scaled linearly with export height.

## 5. Acceptance Criteria

- **AC-001**: Given Giovanni template, When export SVG back, Then `auditExportSvg('back', svg, card).ok === true` and no `FONT_RATIO_*` or `LABEL_VALUE_OVERLAP` errors.
- **AC-002**: Given Giovanni template, When export SVG front, Then logo image width/W ≥ 0.35 and name/title present.
- **AC-003**: Given grid ON and element `company`, When move down, Then preview `grid-el-company` grid-row changes and SVG still contains company text.
- **AC-004**: Given element `name`, When align right-bottom, Then preview cell has `align-items` end and `justify-content` end (or flex-end).
- **AC-005**: Given element `logo`, When align left-top vs right-bottom, Then SVG `preserveAspectRatio` is `xMinYMin meet` vs `xMaxYMax meet` (box size unchanged).
- **AC-006**: Given services empty and socials filled, When render preview and export, Then both place socials under contacts without a full empty services row dead zone (same `effectiveBackGridForRender` output).
- **AC-007**: Given Playwright run of REQ-E2E-005 command, When complete, Then 0 failed tests and `e2e/__screenshots__/wysiwyg-export-*.png` exist after visual suite.
- **AC-008**: Given layout debug enabled, When user moves an element that collides, Then event `{ type:'grid.move', result:'blocked', reason:'collision' }` is in `window.__cardLayoutEvents`.
- **AC-009**: Given export SVG, When parse texts, Then TELEFONO and phone value do not share the same x and value is to the right of label column.
- **AC-010**: Unit tests for `layoutAudit` and `layoutEvents` achieve ≥ 60% coverage on those files.

## 6. Test Automation Strategy

### Test levels

| Level | What | Where |
|-------|------|--------|
| Unit | `backLayout`, `layoutAudit`, `layoutEvents`, `svgRenderer` logo/align/font ratios | `src/utils/card/__tests__/` |
| Component | CardPreview grid cells, CardGridControls align matrix | `src/components/__tests__/`, `src/components/card/__tests__/` |
| E2E | Harness-driven grid + export + screenshots | `e2e/card-*.spec.ts` |

### Frameworks

- Vitest + React Testing Library + jsdom (unit/component).
- Playwright Chromium (e2e).

### Test data

- Primary: `createGiovanniCardTemplate()`.
- Secondary: empty card + filled sample via harness.
- No real network; login via localStorage seed.

### CI / local gate (layout PRs)

```bash
npm run typecheck
npm run test -- --run
npx playwright test e2e/card-export-inspection.spec.ts e2e/card-wysiwyg-visual.spec.ts e2e/card-grid-export-roundtrip.spec.ts e2e/card-grid-behavior.spec.ts
```

All must pass before proposing push.

### Coverage

- New modules `layoutAudit.ts`, `layoutEvents.ts`, harness (if any pure parse helpers): ≥ 60%.
- Regression: every layout bug fix adds one unit or e2e test that fails without the fix.

### Performance

- Single e2e file timeout 30s per test; export downloads 20s.
- Avoid parallel export of same page instance.

### Visual review process

1. Run visual suite.
2. Open `e2e/__screenshots__/wysiwyg-preview-front.png` vs `wysiwyg-export-front.png`.
3. Open `wysiwyg-preview-back.png` vs `wysiwyg-export-back.png`.
4. Human or agent checks: logo size, contact density, QR position, socials placement.
5. Mark “passed” only if both automated ratios AND visual check OK.

## 7. Rationale & Context

Historical failures (2026-07 card work):

1. Unit tests passed while export used different font bases (`min(cell)` vs rem).
2. Logo 3×3 implemented by shrinking box to 60% → user-visible tiny logo.
3. Contact label column formula stole space or under-allocated → TELEFONO overlapped phone digits.
4. Empty services row left ghost gap or over-expanded socials.
5. Playwright tests asserted “download non-empty” without geometry ratios → false confidence.
6. Scroll-on-click moved preview out of viewport → flaky bounding box asserts.

This specification forces **shared geometry**, **event observability**, and **ratio-based e2e** so those classes of bugs fail CI.

## 8. Dependencies & External Integrations

### External systems

- None for layout audit (pure client).

### Third-party services

- None required. Optional Google Fonts embed already used by export (existing).

### Infrastructure

- **INF-001**: Local Vite dev server for Playwright baseURL.
- **INF-002**: Chromium via Playwright.

### Data

- **DAT-001**: localStorage keys for auth seed in e2e (existing pattern).

### Platform

- **PLT-001**: React 18 + Vite + React Router v6 (MemoryRouter tests use TestRouter future flags).

### Compliance

- **COM-001**: Do not log PII (emails in events as boolean “hasEmail” only, not full string, if event payload is expanded later).

## 9. Examples & Edge Cases

### 9.1 Harness usage

```ts
test('move company and audit back export', async ({ page }) => {
  await loginAsTestUser(page);
  await openCardEditor(page);
  await applyGiovanniTemplate(page);
  await setGridOn(page, true);
  await selectGridElement(page, 'company');
  await moveGrid(page, 'down');
  await resetScroll(page);
  const { buffer } = await exportCard(page, 'svg-back');
  const findings = auditExportSvg('back', buffer.toString('utf8'), /* card from page if needed */);
  expect(findings.ok).toBe(true);
});
```

### 9.2 Edge cases

| Case | Expected |
|------|----------|
| Services empty, socials filled | Collapse services; socials under contacts; fonts still rem-scale |
| Services filled | Keep services cell; socials at their y |
| Logo align center | `preserveAspectRatio="xMidYMid meet"`, full cell minus inset |
| Contact cell h=1 | Shrink-to-fit fonts, floor readable, no giant size |
| Email long without spaces | wrap/shrink; no overflow past cell clip |
| Grid OFF | Export still derives grid from layout (`deriveGridFromLayout`) |
| Collision on move | Toast + event `result:'blocked'`; rect unchanged |
| Export during font embed fail | Fallback system font; export still completes |

### 9.3 Known gotchas (must document in AGENTS.md when implemented)

1. **Scroll artifact**: click move buttons can scroll page → measure only after scroll reset.
2. **Font size units in SVG**: unitless user units; never `pt`/`px` strings.
3. **Logo 3×3**: use `preserveAspectRatio`, never shrink content box for alignment.
4. **Contact fonts**: size vs **card height**, not `min(cellW, cellH)`.
5. **Label column**: width from longest key glyphs + gap, not `ks*6` alone.
6. **Ghost services**: only render-time collapse; do not mutate persisted `backGrid` unless user edits.
7. **TestRouter**: unit tests with router must use `src/test/TestRouter.tsx` future flags.

## 10. Validation Criteria

A PR implementing this specification is complete only if:

1. [ ] `e2e/helpers/cardHarness.ts` exists and at least 2 e2e files import it (migration can be incremental but new tests must use it).
2. [ ] `layoutEvents.ts` + shell wiring + `window.__cardLayoutEvents` in test mode.
3. [ ] `layoutAudit.ts` + unit tests + used in at least one e2e.
4. [ ] Font-ratio and logo-width asserts green in Playwright.
5. [ ] WYSIWYG screenshots regenerated and reviewed (preview vs export).
6. [ ] `npm run typecheck` and unit suite green.
7. [ ] Full card Playwright command (REQ-E2E-005) green.
8. [ ] AGENTS.md updated with gotchas from §9.3 if not already present.
9. [ ] No base64 / full SVG in event payloads.

## 11. Related Specifications / Further Reading

- `AGENTS.md` — Card module, export SVG gotchas, grid master switch, test rules.
- `spec/spec-design-flyer-refactor-preview-ai.md` — analogous layout-engine / preview parity approach for flyers.
- Existing e2e: `e2e/card-export-inspection.spec.ts`, `e2e/card-wysiwyg-visual.spec.ts`, `e2e/card-grid-export-roundtrip.spec.ts`, `e2e/card-grid-behavior.spec.ts`.
- Code: `src/utils/card/backLayout.ts`, `src/utils/card/svgRenderer.ts`, `src/components/card/CardGridControls.tsx`, `src/components/CardPreview.tsx`.

---

## Appendix A — Current harness solidità (as of 2026-07-14)

| Area | Status | Gap |
|------|--------|-----|
| data-testid on move/resize/align | Solid | — |
| data-testid on preview cells | Solid | — |
| Shared harness module | **Weak** | Helpers duplicated across e2e files |
| Event log for grid/export | **Missing** | Only toasts + sparse console |
| Font-ratio e2e | Partial | Present in inspection + wysiwyg after v2.10.1 |
| Logo size e2e | Partial | Present in inspection |
| Label/value overlap e2e | **Missing** | Needs audit helper |
| window events for Playwright | **Missing** | — |
| Playwright full card suite | Green (15 tests in core files) | Must stay green + expand per this spec |

## Appendix B — Implementation order (recommended)

1. Extract `e2e/helpers/cardHarness.ts` and migrate one e2e file.
2. Add `layoutEvents.ts` + shell hooks + window attach in test mode.
3. Add `layoutAudit.ts` with unit tests; wire into e2e export tests.
4. Add overlap + ghost-gap e2e cases.
5. Update AGENTS.md gotchas.
6. Run full gate command; commit screenshots only after visual review.

## Appendix C — Playwright status note

As of the date of this spec, the following command completed with **15 passed** on Chromium:

```bash
npx playwright test e2e/card-export-inspection.spec.ts e2e/card-wysiwyg-visual.spec.ts e2e/card-grid-export-roundtrip.spec.ts
```

That proves current v2.10.1 fixes for logo/font/label are automated, but **does not** yet prove full event logging or shared harness (still required by this document).
