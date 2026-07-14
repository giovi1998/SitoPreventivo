---
id: spec-design-ai-logo-vision-grounded-background
title: AI Logo — Vision-Grounded Background Generation
status: draft
created: 2026-07-07
updated: 2026-07-07
tags: [ai, logo, gemini, nano-banana, cover, vision, sector, spec]
supersedes: none
skill: muapi-nano-banana
---

# AI Logo — Vision-Grounded Background Generation

## Introduction

The Logo Builder's AI tab generates a decorative background image via
Gemini (Nano Banana 2, `gemini-3.1-flash-image`) on the endpoint
`POST /api/ai/logo-background`. The current implementation sends only
a **text prompt** built by `buildBackgroundPrompt` in
`logoOrchestrator.ts`, which infers a sector from the activity string
via a regex keyword map (`inferSectorFromActivity`) and concatenates a
sector-hint phrase. Gemini never sees the actual logo layout, so the
background can clash with the title/tagline position, the chosen
icon, or the brand colours.

This spec replaces the text-only approach with a **vision-grounded**
request: the client renders the current logo builder (without the
background) to a PNG screenshot and, when regenerating, also sends the
previous background image as a reference "previous iteration to
improve upon". Gemini can now see the real title, tagline, icon, and
layout and produce a background that wraps around the text instead of
competing with it.

## 1. Purpose & Scope

### Purpose
Generate a coherent decorative background for a logo by showing Gemini
the logo as it currently looks, so the background avoids the text
area, harmonises with the icon/colours, and improves on any previous
background the user is regenerating from.

### Scope
- In scope: extend `POST /ai/logo-background` to accept up to two
  inline reference images (logo screenshot, previous background) in
  addition to the existing text prompt; render the logo screenshot
  client-side using the existing `builderToSvg` + `svgToPng` pipeline;
  ship the request as a multimodal `ai.interactions.create` call.
- Out of scope: AI concept generation (still DeepSeek via
  `/api/ai/chat`, unchanged); logo SVG text editing (manual builder
  controls); a separate vision-based contrast analysis model.

### Audience
- Implementing agent (opencode).
- Reviewers of the API contract change.

### Assumptions
- `gemini-3.1-flash-image` accepts image inputs in the same
  `interactions.create` call used for image output (multimodal). Same
  assumption as the card spec — **verify the exact `input` shape in
  dev** (array of parts vs `contents`).
- The 500KB base64 clamp on the response is unchanged. Input images
  count as request body size (Vercel 1MB limit, already enforced).
- The dev proxy in `vite.config.js` for `/api/ai/logo-background`
  already forwards correctly. No proxy change needed.
- The existing `inferSectorFromActivity` keyword map is **dropped**
  from the prompt path when vision input is available. Gemini sees the
  sector from the screenshot + activity text. The keyword map stays as
  a fallback for the text-only path (when screenshot render fails).

## 2. Definitions

- **Nano Banana 2**: `gemini-3.1-flash-image`, multimodal
  image-generation model.
- **Logo screenshot**: a PNG render of the current `logo.builder`
  (title + tagline + icon + decorations) **without** the background
  image, produced via `builderToSvg` → `svgToPng`.
- **Previous background**: the current `logo.builder.backgroundImage`
  data URL, sent only when regenerating (it is already set).
- **Background image (output)**: the image Gemini generates and
  returns, which becomes the new `logo.builder.backgroundImage`.

## 3. Requirements, Constraints & Guidelines

### REQ-001: Multimodal request body

The client sends `POST /api/ai/logo-background` with:

```json
{
  "prompt": "<Nano-Banana text prompt, sector-hint preserved as text>",
  "logoImage": "<base64 data URL of the logo screenshot, optional>",
  "previousBackground": "<base64 data URL of the previous background, optional>",
  "userEmail": "<optional>"
}
```

- `logoImage` is **always sent when available**. It may be omitted
  only when the SVG→PNG render fails (fallback to text-only, current
  behaviour).
- `previousBackground` is sent only when
  `logo.builder.backgroundImage` is already set (regeneration flow).
  First-time generation omits it.
- Both images are JPEG-quality-compressed client-side to keep the
  request body under ~600KB total (see REQ-004).

### REQ-002: Logo screenshot render

The client renders the current builder to a PNG data URL:

- Source: `builderToSvg(logo.builder)` (existing, line 464 of
  `logoGenerator.ts`). This produces the SVG **without** the
  `backgroundImage` (the builder SVG is the text+icon layer only —
  `buildSvgForLayout` does not paint `backgroundImage`, the preview
  composites it separately as an `<image>` behind the SVG).
- Raster: `svgToPng(svg, 512, { tier: 'unlocked' })` (existing, line
  617). The watermark is **not** applied — pass `tier: 'unlocked'`
  explicitly to skip the free-tier watermark on the reference image.
  We do not want Gemini to copy the watermark into the new background.
- Dimensions: 512px on the long side, aspect preserved (already
  handled by `svgToPng` via viewBox parsing). The output is a
  `Uint8Array` PNG; convert to a base64 data URL.
- If the render throws (jsdom, canvas unavailable, image load
  timeout), the client logs a warning and sends the request text-only.
  No hard failure.

### REQ-003: Previous background extraction

- Source: `logo.builder.backgroundImage` (already a base64 data URL
  of the previous Gemini output, format `data:image/png;base64,...`).
- Re-encode to JPEG 0.8 at 512px on the long side via canvas resize to
  keep it ≤ 200KB. The previous background is reference-only; JPEG
  artefacts are acceptable.
- Skip if `backgroundImage` is `null` or empty (first-time
  generation).

### REQ-004: Body size budget

- `prompt`: max 1000 chars (unchanged).
- `logoImage`: target ≤ 400KB base64. 512px PNG is typically
  100-300KB. If it exceeds 400KB, re-encode to JPEG 0.8.
- `previousBackground`: target ≤ 200KB base64. 512px JPEG 0.8 is
  well under this.
- Total request body ≤ 1MB (Vercel `bodyParser` limit). The client
  MUST measure the JSON string length before fetch and drop
  `previousBackground` first, then `logoImage`, if the body would
  exceed 900KB. Text-only fallback if both must be dropped.

### REQ-005: Server-side multimodal call

`api/index.ts` `/ai/logo-background` handler is extended:

1. Zod schema adds `logoImage: z.string().max(600_000).optional()`,
   `previousBackground: z.string().max(300_000).optional()`.
2. Build the `input` for `ai.interactions.create`:
   - If neither image is present: `input: v.data.prompt` (string,
     current behaviour, zero regression).
   - If one or both images are present: `input` becomes an array of
     parts:
     ```ts
     input: [
       { text: finalPrompt },
       ...(logoImage ? [{ inlineData: { data: stripDataUrlPrefix(logoImage), mimeType: 'image/png' } }] : []),
       ...(previousBackground ? [{ inlineData: { data: stripDataUrlPrefix(previousBackground), mimeType: 'image/jpeg' } }] : []),
     ]
     ```
     Exact part shape (`inlineData` vs `image`) MUST be confirmed
     against the installed `@google/genai` version in dev. See §9.
3. The text prompt is **prepended** with a grounding instruction when
   images are present:
   > "The first attached image shows the logo layout I am designing
   > a background for (title, tagline, icon). Use it as reference for
   > text placement and colour harmony. Do NOT reproduce any text,
   > icon, or shape visible in the reference — generate only the
   > abstract decorative background that sits behind it. The second
   > attached image (if present) is the previous background iteration
   > to improve upon, not a constraint to copy."
4. `generation_config.image_config` stays
   `{ image_size: '512', aspect_ratio: '16:9' }` (unchanged — logo
   background is panoramic).
5. `response_modalities: ['text', 'image']` (unchanged, lowercase).
6. Response handling, 500KB output clamp, error mapping (401/429/504)
   — all unchanged.

### REQ-006: Prompt preserved (with sector hint)

The Nano-Banana text prompt in `logoOrchestrator.buildBackgroundPrompt`
is **not modified** by this spec. It already includes the
`inferSectorFromActivity` sector hint and the activity/mood/target
context. The grounding instruction in REQ-005 is server-side and
prepended only when images are present; it does not touch the
client-built `prompt` string. This keeps existing
`logoOrchestrator.test.ts` tests green without modification.

### REQ-007: Rate limit unchanged

`aiLogoBg` rate limit stays 5 req/min/IP. Vision grounding does not
change request frequency.

### REQ-008: No PII in reference images

The logo screenshot contains the brand name (`primaryText`) and
tagline. This is business text, not personal contact data (no phone,
no email, no address — unlike the card). Risk is lower than the card
spec. Mitigations:

- The screenshot is the logo text only; no user photo, no contact
  details.
- The server logs only `[ai_logo_background] user` with email +
  timestamp (unchanged). Image bytes never logged.
- Google Gemini API terms: no training on API data.
- The grounding instruction (REQ-005) explicitly forbids reproducing
  the visible text, reducing leakage into the output.

### REQ-009: Tier guard unchanged

`useAILogo.generateBackground` already checks the tier (the AI tab is
gated to `unlocked` users per the Logo Builder module docs). Vision
grounding does not change the tier gate. No tier change.

### REQ-010: Auto-hide icon/decorations preserved

Per the v2.3.1 gotcha in AGENTS.md, `buildSvgForLayout` already
suppresses the icon and `decorativeElements` when
`builder.backgroundImage` is set. This means the **logo screenshot**
sent to Gemini (rendered via `builderToSvg`, which calls
`buildSvgForLayout`) will **not** show the icon if a background is
already set. This is desirable: when regenerating, Gemini sees only
the text, and the icon is re-added on top of the new background
client-side. No change to `buildSvgForLayout`.

### GUD-001: Reuse existing render path

Do not write a new "screenshot for AI" function. Reuse
`builderToSvg` + `svgToPng` from `logoGenerator.ts`. The only new
client utility is a small `compressForAI(dataUrl, maxBytes)` helper
(shared with the card spec, lives in `src/utils/ai/compressForAI.ts`)
that re-encodes via canvas to JPEG 0.8 if the PNG exceeds the budget.

### GUD-002: Compose screenshot without background for first generation

For first-time generation (`backgroundImage` is null), the screenshot
shows title + tagline + icon + decorations (the full builder SVG).
For regeneration (`backgroundImage` is set), the screenshot shows
only title + tagline (icon/decorations auto-hidden per REQ-010). Both
flows use the same `builderToSvg` call — no branching needed.

## 4. Interfaces & Data Contracts

### Client → Server

`POST /api/ai/logo-background`

| Field | Type | Required | Notes |
|---|---|---|---|
| `prompt` | string ≤ 1000 | yes | Nano-Banana text prompt (sector hint preserved) |
| `logoImage` | data URL ≤ 600_000 chars | no | `data:image/png;base64,...` (or jpeg) |
| `previousBackground` | data URL ≤ 300_000 chars | no | `data:image/jpeg;base64,...` |
| `userEmail` | email | no | For logging/tier check |

### Server → Gemini

```
ai.interactions.create({
  model: 'gemini-3.1-flash-image',
  input: <string | array of parts>,
  generation_config: { image_config: { image_size: '512', aspect_ratio: '16:9' } },
  response_modalities: ['text', 'image'],
})
```

### Server → Client (unchanged)

`200 { data: { imageBase64, mimeType } }` | `413` | `429` | `502` | `504`

## 5. Acceptance Criteria

- **AC-001**: Given a logo with `builder.primaryText = "Acme"` and no
  `backgroundImage`, when the user clicks "Genera background", then
  the request body includes `logoImage` as a PNG data URL ≤ 400KB
  showing the title + icon, and `previousBackground` is absent.
- **AC-002**: Given a logo with `builder.backgroundImage` already set,
  when the user regenerates, then the request body includes both
  `logoImage` (text only, icon auto-hidden) and `previousBackground`
  as a JPEG data URL ≤ 200KB.
- **AC-003**: Given `builderToSvg` or `svgToPng` throws, then the
  request is sent text-only (no `logoImage`, no `previousBackground`)
  and the response is still a valid background (zero regression).
- **AC-004**: Given the total JSON body would exceed 900KB, then the
  client drops `previousBackground` first; if still > 900KB, drops
  `logoImage`; if still > 900KB, sends text-only.
- **AC-005**: Given the server receives `logoImage` and
  `previousBackground`, then `ai.interactions.create` is called with
  `input` as an array of 3 parts (text + 2 images), and the grounding
  instruction is prepended to the text part.
- **AC-006**: Given the server receives `logoImage` only, then
  `input` is an array of 2 parts (text + image).
- **AC-007**: Given the server receives no images, then `input` is a
  string (current behaviour, zero regression).
- **AC-008**: Given Gemini returns an image > 500KB, then the server
  responds `413` (unchanged).
- **AC-009**: Given the user is on a free tier, then
  `useAILogo.generateBackground` is not callable (AI tab hidden /
  disabled, unchanged tier gate).
- **AC-010**: The watermark is NOT visible in the `logoImage`
  reference (verified by inspecting the screenshot pixels or by
  confirming `svgToPng` was called with `tier: 'unlocked'`).

## 6. Test Automation Strategy

- **Unit** (`src/ai/__tests__/logoOrchestrator.test.ts`):
  unchanged. The text prompt is not modified; existing tests stay
  green.
- **Unit** (`src/utils/ai/__tests__/compressForAI.test.ts`, shared
  with card spec): `compressForAI` re-encodes a 1MB PNG to a JPEG
  < 400KB.
- **Unit** (`src/hooks/__tests__/useAILogo.test.ts`, extended):
  - `generateBackground` builds a request with `logoImage` present
    when `builderToSvg` succeeds.
  - `generateBackground` omits `previousBackground` on first
    generation, includes it on regeneration.
  - Body-size fallback logic (AC-004): mock a 1.2MB body, assert
    `previousBackground` dropped, then `logoImage` dropped.
  - Text-only fallback (AC-003): mock `svgToPng` to throw, assert
    request sent without images.
- **Unit** (`api/__tests__/logoBackground.test.ts`, new or extended):
  - Text-only request → `input` is a string.
  - Request with `logoImage` only → `input` is an array with 2 parts.
  - Request with both images → `input` is an array with 3 parts.
  - Grounding instruction prepended only when images present.
  - 500KB output clamp, 429, 504 error paths unchanged.
- **Integration** (dev manual): run `npm run dev`, open logo editor,
  generate a background for a tech-sector logo, confirm Gemini returns
  a background that visually avoids the title text. Repeat
  regeneration (previous background sent).
- **Coverage target**: 60% for new files.

## 7. Rationale & Context

### Why vision grounding instead of sector keyword map

The current `inferSectorFromActivity` regex map has the same
weaknesses as the card spec's sector inference: brittle keyword
collisions, no real layout awareness, maintenance burden. Vision
grounding lets Gemini see the actual logo and produce a background
that wraps around the real text box.

### Why send the previous background on regeneration

Without the previous background, regenerating produces a completely
different background, losing any good parts of the previous iteration.
Sending it as "previous iteration to improve upon" lets Gemini iterate
visually (e.g. "keep the colour palette, soften the texture behind the
title"). This mirrors the card spec's REQ-002 / GUD-002 pattern.

### Why 16:9 aspect ratio (unchanged)

The logo background is panoramic (`image_size: '512', aspect_ratio:
'16:9'` in the current handler). The logo viewBox is typically wider
than tall (horizontal layout) or tall (vertical/stacked). The 16:9
background is composited behind the SVG with `preserveAspectRatio`,
which crops appropriately. No change to the aspect ratio.

### Why drop the icon from the screenshot on regeneration

Per the v2.3.1 gotcha, the icon auto-hides when a background is set
because icons overlap badly with AI photos/illustrations. When
regenerating, the screenshot therefore shows only text. This is
correct: Gemini should ground on the text placement, and the icon is
re-added by the client on top of the new background. No spec change
needed — the existing `buildSvgForLayout` behaviour is already right.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: Google Gemini API (`gemini-3.1-flash-image`) —
  multimodal image generation. Already integrated via
  `/ai/logo-background`. This spec extends the request shape, not the
  integration.

### Third-Party Services
- **SVC-001**: `@google/genai` SDK — must support array-of-parts
  `input` for image-output requests. **Verify in dev** before merge.
  Fallback: `contents: [{ role, parts }]` shape (same as card spec).

### Infrastructure Dependencies
- **INF-001**: Vercel serverless function body limit (1MB) — already
  enforced. REQ-004 keeps the body under 900KB.
- **INF-002**: Client canvas (`document.createElement('canvas')`) —
  available in all target browsers and jsdom (with canvas polyfill).

### Data Dependencies
- **DAT-001**: `logo.builder` — the source for `builderToSvg`. All
  fields are user-editable text/colours, no external fetches.
- **DAT-002**: `logo.builder.backgroundImage` — already a base64 data
  URL when set (from a previous Gemini output). No normalisation
  needed.

### Compliance Dependencies
- **COM-001**: Google Gemini API data processing terms — no training
  on API data. The logo screenshot contains business text (brand
  name), not personal contact data. Lower risk than the card spec.
  Document in README privacy section as follow-up.

## 9. Examples & Edge Cases

### Multimodal `input` shape — two candidates

Same as the card spec. Try Shape A first; if it throws, fall back to
Shape B. Cache the working shape in a module-level variable.

**Shape A (preferred, `interactions.create` with parts array):**
```ts
const interaction = await ai.interactions.create({
  model: 'gemini-3.1-flash-image',
  input: [
    { text: finalPrompt },
    { inlineData: { data: logoImageB64, mimeType: 'image/png' } },
    { inlineData: { data: previousBgB64, mimeType: 'image/jpeg' } },
  ],
  generation_config: { image_config: { image_size: '512', aspect_ratio: '16:9' } },
  response_modalities: ['text', 'image'],
}, { timeout: 30_000 });
```

**Shape B (fallback, `models.generateContent` with `contents`):**
```ts
const response = await ai.models.generateContent({
  model: 'gemini-3.1-flash-image',
  contents: [{
    role: 'user',
    parts: [
      { text: finalPrompt },
      { inlineData: { data: logoImageB64, mimeType: 'image/png' } },
      { inlineData: { data: previousBgB64, mimeType: 'image/jpeg' } },
    ],
  }],
  config: {
    responseModalities: ['text', 'image'],
    imageConfig: { imageSize: '512', aspectRatio: '16:9' },
  },
});
```

### Edge case: empty logo

`createEmptyLogo()` has `primaryText = ""`, `tagline = ""`,
`iconType = 'none'`. `builderToSvg` produces a blank SVG. The
screenshot is a transparent/blank rectangle. Gemini receives it + the
text prompt. The background will be generic. No crash.

### Edge case: vertical/stacked layout

The logo viewBox is taller than wide. `svgToPng` with `size: 512`
produces a 512-tall PNG (e.g. 300×512). Gemini receives a portrait
reference. The output is still 16:9 (panoramic background); the
client composites it behind the portrait SVG. No issue.

### Edge case: very large previous background

A previous Gemini output at 512px is ~200-400KB PNG. The JPEG
re-encode in REQ-003 shrinks it to ~50-100KB. If re-encode fails,
`previousBackground` is dropped (AC-004 body-size fallback).

## 10. Validation Criteria

- All acceptance criteria AC-001..010 pass.
- `npm run typecheck` green.
- `npm run test` green (existing `logoOrchestrator.test.ts`
  unchanged, `useAILogo.test.ts` extended, `logoBackground.test.ts`
  added).
- Manual dev test: first-time generation + regeneration produce
  visually coherent backgrounds with no baked-in text/icon.
- No regression: text-only path (no images) returns identical results
  to the current implementation.

## 11. Cost Estimate (caveat: not verified today)

> **WARNING**: `ai.google.dev/pricing` was unreachable at spec time.
> Numbers are from prior knowledge and **must be confirmed in the
> dashboard before budgeting.**

| Item | Estimate | Notes |
|---|---|---|
| Image generation (output) `gemini-3.1-flash-image` @ 512px 16:9 | ~$0.039 / image | **Verify.** |
| Input image tokens (logo screenshot ~512px) | ~258-384 tokens | Billed at text-token rate. **Verify.** |
| Input image tokens (previous background ~512px) | ~258-384 tokens | Same. |
| Total per background call (1 output + 1-2 inputs) | ~$0.04-0.06 / call | Dominated by the output image. |
| Free tier (AI Studio) | Likely included | Production uses paid key. **Verify.** |

**Cost impact vs current**: current text-only call ~$0.039. This spec
adds ~$0.01-0.02 per call for input image tokens. **+25-50% per
call**. The AI tab is already tier-gated to `unlocked` (Pro) users,
so the volume is lower than the card cover (which is available to all
users). Worst-case spend is bounded by the 5/min/IP rate limit.

**Action item before merge**: check the actual numbers and update
this table.

## 12. Related Specifications / Further Reading

- `spec-design-ai-card-context-aware-cover.md` — sibling spec for the
  card cover. Shares the `compressForAI` helper, the multimodal
  `input` shape probe, and the body-size fallback pattern.
- AGENTS.md § "Logo AI, Gemini background gotchas" — the production
  bugs that blocked logo background generation. This spec does **not**
  touch the prompt (gotcha #8, copyright filter) or the import
  strategy (gotchas #1, #2, #6, #7), so those remain valid.
- `src/ai/logoOrchestrator.ts` — `generateBackground`, extended per
  REQ-001 (client side).
- `src/ai/providers/gemini.ts` — existing provider, reused unchanged.
- `src/utils/logoGenerator.ts` — `builderToSvg` (line 464),
  `svgToPng` (line 617), reused.
- `api/index.ts` `/ai/logo-background` handler (lines ~1380-1440) —
  extended per REQ-005.

## Follow-up (out of scope)

- **User-editable sector override**: let the user type a free-form
  sector hint in the AI panel, prepended to the prompt. The
  screenshot already shows the sector, but an explicit hint could
  help for ambiguous cases.
- **Background variant generation**: generate 2-3 background variants
  in one call (parallel `Promise.allSettled`) and let the user pick.
  Currently one call = one background.
- **Privacy doc update**: add a README section disclosing that logo
  screenshots (containing brand text) are sent to Google Gemini for
  background generation.