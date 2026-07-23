---
title: Business Card — Universal Nudge + Zoom, Text Scale per Element, AI Placement, Photo Quality, Text Fidelity
version: 2.0
date_created: 2026-07-23
last_updated: 2026-07-23
owner: Quickbrand
tags: [design, card, grid, nudge, zoom, template, export, ai, image-quality, text]
status: v2.0 — core implemented in working tree (2026-07-23, uncommitted); REQ-IMG-* deferred, mobile nudge e open questions aperti
---

# Introduction

This specification defines the required changes to the Quickbrand business card
module, derived from an audit of card `card_1784802983118_70ojhd`.

**v2.0 revision.** v1.0 assumed nudge existed only for `photo`/`qr`. A working-tree
implementation (uncommitted, "v2.16") has since landed part of v1. This revision
records the verified current state, the remaining gaps, and three new product
decisions:

1. **Zoom (placement.scale) for text elements too** — per-element scale acts as a
   local font-size factor for text.
2. **Remove the global "Dimensione testo" slider** from the Stile fieldset —
   per-element scale replaces it as the sizing control. `fontScale` stays in the
   schema as a legacy field (default 1) for backward compatibility of existing
   documents; no data migration.
3. **The AI must support every new control** — per-element `placement {x,y,scale}`
   and the `right-balanced` layout in both the Zod contract and the system prompt.

## 1. Verified current state (working tree, uncommitted)

Already implemented (do not redo):

- Universal nudge x/y: `supportsPlacement = !!selectedEl`
  (`src/components/card/CardGridControls.tsx:176`); arrows at `:468-512`
  (`data-testid="grid-placement-controls"`). Preview drag on every element
  (`src/components/CardPreview.tsx:326-354` front, `:601-622` back), dead-zone 0.05.
- Export nudge: photo (`src/utils/card/svgRenderer.ts:296-304`), logo (`:342-361`),
  front texts name/title/company x/y only (`:398-406`), QR (`:843-856`).
- Zoom slider gated to `photo|qr|logo` (`CardGridControls.tsx:177,513-527`,
  testid `grid-placement-zoom`).
- Preview placement via CSS var `--card-photo-transform`
  (`src/utils/card/previewHelpers.ts:47-48`; consumed in
  `cardPreviewSide.css:87,684,690-695` including `--text`/`--logo` cells).
- `right-balanced` preset registered in all four UI locations
  (`src/utils/documentSchemas.ts:162,354-366,458-469,483`;
  `src/components/card/labels.ts:14`; `CardGridControls.tsx:274`);
  `createGiovanniCardTemplate` uses it (`documentSchemas.ts:707`).
- Shared grid constants `src/utils/card/gridConstants.ts` (pad 16 / gap 4 / ref
  height 340) consumed by export and preview CSS vars.
- `src/utils/card/textMeasure.ts` exists (canvas `measureText` + 0.52 fallback)
  but is **imported and never used** (`svgRenderer.ts:11` — dead import).
- Empty back cells handled: empty `socials` renders no box (preview
  `CardPreview.tsx:828`, export `svgRenderer.ts:775`); services collapse in
  `src/utils/card/backLayout.ts:183-275`.
- Disabled-state UX: element selector marks "(senza contenuto)"
  (`CardGridControls.tsx:307`); grid-off hint + "Attiva griglia" action
  (`:200-211`).

Confirmed gaps (this spec's work):

1. Export ignores `placement.scale` for front texts and ignores scale AND nudge
   for back texts (contacts/services/socials) — `svgRenderer.ts:398-406`
   ("scale is ignored for text"), `:653-794`.
2. AI merge **drops `placement`** when the AI repositions an element
   (`src/ai/cardMerge.ts:273,314` — element replaced, not merged with current).
3. AI contract has no `placement` and no `right-balanced`
   (`src/ai/aiCardInputSchema.ts:5-12,36`; prompt `src/ai/prompts/cardSystem.ts:46,95`).
4. Export text wrap still uses the fixed `avgCharW = fontSize * 0.52` estimate
   (`svgRenderer.ts:974`).
5. Global "Dimensione testo" slider still present
   (`src/components/card/form/CardStyleFields.tsx:183-213`, testid
   `card-font-scale`).

## 2. Definitions

- **Grid element**: one of `photo, name, title, company, logo, qr, contacts,
  socials, services`, placed as `{x,y,w,h}` in `card.grid` / `card.backGrid`.
  Schema: `cardGridElementSchema`, `documentSchemas.ts:241-254` — includes
  generic `placement {x,y∈[-1,1], scale∈[0.5,2]}` and legacy alias
  `photoPlacement` (TB-023).
- **Nudge**: `placement.x/y` — fine offset within the cell's free space.
- **Zoom / scale**: `placement.scale` — for `photo/qr/logo` an image zoom; for
  text elements a **local font-size factor**.
- **fontScale (legacy)**: global `card.style.fontScale` (0.7–1.5), CSS var
  `--card-font-scale`, export helper `fs()`. UI control removed by this spec;
  field kept for backward compatibility.
- **Preview/export parity**: preview 640px logical
  (`CARD_PREVIEW_REF_WIDTH`), export SVG `mm×20`, PNG 300/150dpi. Placement
  semantics must match across all three.

## 3. Requirements

### 3.1 Text zoom (REQ-ZOOM-*)

- **REQ-ZOOM-001**: `supportsPlacementScale` in `CardGridControls.tsx:177` must
  become true for every selected element with content (texts included). Range
  stays 0.5–2 (schema bound, no schema change).
- **REQ-ZOOM-002**: For text elements, `placement.scale` is a local font-size
  factor. Preview already scales text cells via CSS transform — verify parity,
  no preview change expected.
- **REQ-ZOOM-003**: Export must multiply the per-element font size by
  `placement.scale` for name/title/company (front) and
  contacts/services/socials (back), and must apply nudge x/y to back text
  blocks with the same ±half-free-space semantics as the front
  (`svgRenderer.ts:398-406` front; `:653-794` back).
- **REQ-ZOOM-004**: Default `scale: 1` must produce byte-identical output to
  today (no visual regression for un-nudged documents).

### 3.2 Remove global font-size slider (REQ-CTRL-*)

- **REQ-CTRL-001**: Remove the "Dimensione testo" block (slider, −/+, Reset,
  testid `card-font-scale`) from `CardStyleFields.tsx:183-213`.
- **REQ-CTRL-002**: Keep `fontScale` in `documentSchemas.ts`, in
  `--card-font-scale` rendering, in export `fs()`, and in the AI merge
  (`cardMerge.ts:230-236`, clamped 0.7–1.5) as a legacy field. Existing
  documents with `fontScale ≠ 1` must render unchanged. No data migration.
- **REQ-CTRL-003**: `createGiovanniCardTemplate` must set `fontScale: 1`
  (currently 1.05) — new cards start neutral; sizing intent moves to
  per-element scale.
- **REQ-CTRL-004**: Update tests referencing `card-font-scale`; none may be
  deleted without replacement coverage of REQ-ZOOM/REQ-CTRL behavior.

### 3.3 AI support (REQ-AI-*)

- **REQ-AI-001**: `aiCardInputSchema.ts` — add optional
  `placement {x∈[-1,1], y∈[-1,1], scale∈[0.5,2]}` to `gridElementShape`
  (`:5-12`); add `'right-balanced'` to the layout enum (`:36`).
- **REQ-AI-002**: `cardMerge.ts` — when the AI provides a grid element, merge it
  with the current element instead of replacing it (`:273,314`), so an existing
  `placement`/`photoPlacement` survives an AI move (v1 REQ-NUDGE-008).
- **REQ-AI-003**: `cardMerge.ts` — accept AI-provided `placement`, clamped to
  schema bounds; invalid values fall back to current placement, never to a
  crash or a stripped field.
- **REQ-AI-004**: `cardSystem.ts` prompt — document `placement` per element
  (x/y nudge ±1; scale 0.5–2: zoom for photo/qr/logo, font-size factor for
  texts), the `right-balanced` layout, and update the fontScale guidance to
  prefer per-element `placement.scale` for "testo più grande" requests.
  Follow `.agents/skills/ai-prompt-engineering` rules (JSON contract, "NON "
  negative examples, length limits).
- **REQ-AI-005**: Anti-hallucination — prompt must say to omit `placement`
  rather than guess it; the merge must treat omitted placement as "keep
  current".

### 3.4 Text measurement (REQ-TXT-*)

- **REQ-TXT-001**: Wire `estimateCharsForWidth` / `measureTextWidth`
  (`src/utils/card/textMeasure.ts`) into `wrapTextAtWhitespace`
  (`svgRenderer.ts:972-1013`) for name/title/contacts, using the selected font
  family; the 0.52 factor remains only as the no-canvas fallback. Remove the
  dead import if superseded.
- **REQ-TXT-002**: Measurement must not change output for the fallback path
  (jsdom tests stay deterministic); browser export gets real metrics.
- **REQ-TXT-003**: Residual preview/export mismatches that require a full
  shared layout engine stay documented in `docs/post-tb023-known-issues.md` —
  out of scope here.

### 3.5 Photo quality (REQ-IMG-*) — unchanged from v1, deferred

- Dev/prod card-photo aspect divergence (`vite.config.js:289-295` 1:1 vs
  `api/index.ts:2094` 3:4), 512px clamp, and the 1.25× upscale warning remain
  valid v1 requirements but are **deferred** — not part of this implementation
  round. Tracked in `docs/post-tb023-known-issues.md`.

### 3.6 Tests (REQ-TEST-*) — unit + e2e + screenshot verification (critical)

Per AGENTS.md every change in `src/` needs tests; this module is flagged
critical, so Playwright coverage with screenshot verification is mandatory.

Unit (Vitest):

- **REQ-TEST-001**: `cardMerge` — placement preserved on AI move (regression
  for gap 2); AI placement accepted and clamped; `right-balanced` accepted.
- **REQ-TEST-002**: `aiCardInputSchema` — placement validated/rejected out of
  range; layout enum includes `right-balanced`.
- **REQ-TEST-003**: export — text scale reflected in SVG font sizes; back-text
  nudge reflected in SVG x/y; `wrapTextAtWhitespace` with mocked canvas beats
  the 0.52 estimate on known strings and falls back cleanly.
- **REQ-TEST-004**: preset registration invariant — every
  `businessCardLayoutSchema` value has factory + label + selector option;
  `right-balanced` cell map has no collisions.
- **REQ-TEST-005**: `CardGridControls` — zoom slider visible for
  name/title/contacts; `CardStyleFields` — "Dimensione testo" slider absent.
- **REQ-TEST-006**: No `.skip`/`xit`; new files ≥60% coverage.

E2E + screenshot (Playwright, reuse `e2e/helpers/cardHarness.ts`):

- **REQ-TEST-007**: New `e2e/card-nudge-zoom.spec.ts`:
  (a) nudge a text element → CSS transform on `grid-el-name` → export
  `svg-front` → offset present in SVG;
  (b) zoom slider on a text element → computed font-size changes → export SVG
  font-size scaled;
  (c) back contacts nudge → `svg-back` export contains the offset
  (regression for gap 1);
  (d) UI contract — "Dimensione testo" slider absent, zoom visible for text;
  (e) AI path with mocked `/api/ai/chat` — response with placement +
  `right-balanced` merges into preview and placement survives a second merge.
- **REQ-TEST-008**: Screenshot verification in the new spec — save front/back
  screenshots to `e2e/__screenshots__/` and assert they are not
  mostly-black/blank using the established pixel-sampling pattern
  (`e2e/ai-log-preview.spec.ts:161-197`). Structural assertions
  (`parseCardSvg` + `assertInside`) on every export. No pixel-diff snapshot
  infrastructure is introduced (repo convention).
- **REQ-TEST-009**: Keep green: `card-grid-behavior`,
  `card-preview-export-parity`, `card-export-inspection`, `card-ai-rail`,
  `ai-log-preview` (TB-023).
- **REQ-TEST-010**: Before any push proposal: `npm run typecheck && npm run
  test` green, plus the touched e2e specs.

## 4. Out of Scope

- Full shared layout engine for the card (`docs/agent-gotchas.md` §6 long-term).
- REQ-IMG-* photo-quality round (deferred, §3.5).
- Any admin/role permission system in the card editor (none exists; none added).
- Structural changes to `api/index.ts` or `vercel.json`.
- Data migration removing `fontScale` from stored documents.

## 5. Open Questions

1. 1K AI images + server re-compression (v1 REQ-IMG-002): cost/latency
   acceptable? Deferred with the REQ-IMG round.
2. `gridPresetMinimal`: keep or remove — needs usage data.
3. Mobile fine-nudge: v1 keeps nudge desktop-only (mobile has whole-cell popup);
   revisit if user feedback asks for it.

## 6. Implementation status (2026-07-23, working tree uncommitted)

Implementato:

- **§3.1 REQ-ZOOM-***: zoom slider `grid-placement-zoom` per tutti gli
  elementi grid (label "Zoom" per photo/qr/logo, "Dimensione" per i testi);
  `placement.scale` = fattore font-size locale per i testi. Export SVG
  applica nudge+scale anche ai testi fronte e retro.
- **§3.2 REQ-CTRL-***: slider globale "Dimensione testo" rimosso da
  `CardStyleFields.tsx` (testid `card-font-scale` eliminato); `fontScale`
  resta campo legacy nello schema (default 1, clamp 0.7–1.5), ancora usato
  da preview `--card-font-scale`, export `fs()`, AI merge;
  `createGiovanniCardTemplate` → `fontScale: 1`.
- **Preset**: `right-balanced` + `gridPresetBackBalanced` registrati
  (v2.16); template Giovanni derivato dai preset.
- **§3.3 REQ-AI-***: `aiCardInputSchema` accetta `placement` per-elemento e
  layout `right-balanced`; `cardMerge` fa merge (non replace) → preserva
  `placement` esistente su riposizionamento AI e accetta placement AI
  clampato; prompt `cardSystem.ts` documenta placement + right-balanced,
  fontScale marcato legacy.
- **§3.4 REQ-TXT-001/002**: wrap export via `src/utils/card/textMeasure.ts`
  (canvas `measureText`; fallback 0.52 in jsdom, test deterministici).
  REQ-TXT-003 resta documentato in `docs/post-tb023-known-issues.md`.
- **Fix salvataggio card**: toast errore su auto-save fallito, `isSaved`
  wired a `CardSaveAction`, `cardHasContent` allargato
  (address/vatNumber/services/socials/qrPayload/coverImageUrl), flush save
  su unmount.

Da fare / deferred:

- **§3.5 REQ-IMG-***: photo quality round — deferred, tracked in
  `docs/post-tb023-known-issues.md`.
- **Mobile fine-nudge**: nudge resta desktop-only (Open Question 3, §5).
- **Open Questions (§5)**: tutte aperte, incluse 1K AI images +
  re-compressione server e `gridPresetMinimal` keep/remove.
- **§3.6 REQ-TEST-007/010**: verifica e2e/screenshot e gate
  `npm run typecheck && npm run test` da rieseguire sul working tree prima
  di proporre il push.
