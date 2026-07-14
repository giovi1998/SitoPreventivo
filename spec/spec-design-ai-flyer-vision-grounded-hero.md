---
id: spec-design-ai-flyer-vision-grounded-hero
title: AI Flyer — Vision-Grounded Hero Generation (Pro feature)
status: draft
created: 2026-07-07
updated: 2026-07-07
tags: [ai, flyer, gemini, nano-banana, hero, vision, sector, tier, spec]
supersedes: none
skill: muapi-nano-banana
---

# AI Flyer — Vision-Grounded Hero Generation (Pro feature)

## Introduction

The Flyer Editor currently uses a **static hero image** from
`picsum.photos/seed/<seed>/<w>/<h>` for every template that has a
hero box (`classic`, `split`, `magazine`; `centered` is text-only).
The image is deterministic per template seed but semantically random
— a ristorante flyer may get a landscape photo of a mountain. The
AI copy flow (`flyerOrchestrator.generateCopy` via DeepSeek) writes
the headline/subheadline/body/cta but does not touch the hero image.

This spec adds an **optional, Pro-tier** "Genera hero AI" button in
the Flyer Editor. When clicked, the client renders the current flyer
to a PNG screenshot (layout + copy + hero box position) and sends it
to a new `POST /api/ai/flyer-hero` endpoint along with the sector +
tone as a text hint. Gemini (Nano Banana 2) generates a hero image
coherent with the real flyer layout, the copy, and the sector. The
static `picsum.photos` URL remains the default for free-tier users
and for any flyer where the AI button was not clicked.

## 1. Purpose & Scope

### Purpose
Let Pro users replace the generic `picsum.photos` hero with an
AI-generated image that matches their flyer's sector, tone, and
layout, by showing Gemini the actual flyer so the hero fits the real
hero box and complements the existing copy.

### Scope
- In scope: new endpoint `POST /api/ai/flyer-hero`; client render of
  the flyer to a PNG screenshot via the existing `buildFlyerSvg`;
  tier gate (`unlocked` only); the hero image is stored as
  `flyer.content.heroImage` (data URL) replacing the picsum URL.
- Out of scope: AI copy generation (still DeepSeek via
  `/api/ai/copy-flyer`, unchanged); automatic hero generation on
  template creation (free tier keeps picsum); batch hero generation
  for multiple flyers; video hero.

### Audience
- Implementing agent (opencode).
- Reviewers of the new API endpoint.

### Assumptions
- `gemini-3.1-flash-image` accepts image inputs in the same
  `interactions.create` call used for image output (multimodal). Same
  assumption as the card/logo specs — **verify the exact `input`
  shape in dev**.
- The 500KB base64 clamp on the response is unchanged. The hero image
  data URL is stored in `flyer.content.heroImage` and persisted via
  `dataService.saveDocument`. The 500KB clamp is compatible with the
  existing `FLYER_HERO_MAX_AFTER_COMPRESS = 500_000` constant in
  `documentSchemas.ts` (line 945).
- The dev proxy in `vite.config.js` does NOT currently forward
  `/api/ai/flyer-hero` (it is a new endpoint). The monolith
  `api/index.ts` handles all `/api/*` in production; in dev, Vite's
  proxy config must be updated to forward the new path (or rely on
  the catch-all `/api/*` proxy if one exists — verify).
- The existing `picsum.photos` hero is a remote URL, not a data URL.
  The AI hero is a data URL. `buildFlyerSvg` / `svgRenderer.ts` line
  100 already accepts both (`<image href="...">`). No renderer change.

## 2. Definitions

- **Hero image**: the image rendered in the hero box of a flyer
  layout (`classic`, `split`, `magazine`). Stored as
  `flyer.content.heroImage`. Currently a `picsum.photos` URL; after
  this spec, optionally a base64 data URL from Gemini.
- **Hero box**: the rectangular area (in mm) computed by
  `heroBoxMmForLayout` in `templateCatalog.ts` where the hero image
  is rendered.
- **Flyer screenshot**: a PNG render of the current flyer (layout +
  copy + current hero) produced client-side via `buildFlyerSvg` →
  canvas.
- **Sector**: one of `ristorante`, `evento`, `salone`, `negozio`
  (`FLYER_SECTORS` in `documentSchemas.ts` line 1020). Sent as a text
  hint.
- **Tone**: one of `formale`, `giovanile`, `tecnico` (`FLYER_TONES`
  line 888). Sent as a text hint.

## 3. Requirements, Constraints & Guidelines

### REQ-001: New endpoint `POST /api/ai/flyer-hero`

New handler in `api/index.ts` (monolith, no new file):

```json
// Request
{
  "prompt": "<Nano-Banana text prompt>",
  "context": "<sector + tone + hero box aspect hint>",
  "flyerImage": "<base64 data URL of the flyer screenshot, optional>",
  "aspectRatio": "<'16:9' | '1:1' | '3:2' | '2:3' | '3:4'>",
  "userEmail": "<optional>"
}

// Response (unchanged shape vs /ai/logo-background)
{ "data": { "imageBase64": "...", "mimeType": "image/png" } }
```

- Rate limit: `aiFlyerHero`, 5 req/min/IP (same as `aiLogoBg` and
  `aiCardCover`).
- Auth: `GEMINI_API_KEY` required, 503 if missing (same as
  `/ai/logo-background`).
- Output clamp: 500KB base64 (same as all image endpoints).
- Error mapping: 401/429/504/502 (same as existing handlers).

### REQ-002: Aspect ratio from hero box

The hero image aspect ratio MUST match the hero box for the flyer's
layout, so `preserveAspectRatio="xMidYMid slice"` does not crop
important content. The client computes the aspect ratio from
`heroBoxMmForLayout(flyer.style.layout, getFlyerDimensions(flyer))`
and maps it to the closest Gemini-supported ratio:

| Hero box aspect (w:h) | Gemini `aspect_ratio` |
|---|---|
| ≥ 1.6 | `16:9` |
| 1.1 – 1.59 | `3:2` |
| 0.9 – 1.1 | `1:1` |
| 0.6 – 0.89 | `2:3` |
| < 0.6 | `3:4` |

`image_size: '512'` is always used (to stay under the 500KB clamp).
The client sends the computed `aspectRatio` in the request body; the
server passes it to `image_config.aspect_ratio`.

### REQ-003: Flyer screenshot render

The client renders the current flyer to a PNG data URL:

- Source: `buildFlyerSvg(flyer)` from `src/utils/flyer/svgRenderer.ts`
  (line 202). This produces the full flyer SVG (layout + copy + hero +
  QR if present).
- Raster: load the SVG into an `Image`, draw to canvas, export as
  JPEG 0.8 at 512px on the long side. Reuse the `compressForAI`
  helper shared with the card/logo specs.
- The watermark is **not** applied (we don't want Gemini to copy it).
  `buildFlyerSvg` does not apply the watermark (watermark is applied
  at PDF/PNG export time, not at SVG render time), so no change
  needed.
- If the render throws, the client logs a warning and sends the
  request text-only (no `flyerImage`). No hard failure.

### REQ-004: Body size budget

- `prompt`: max 1000 chars.
- `context`: max 1500 chars (sector + tone + hero box hint + copy
  summary).
- `flyerImage`: target ≤ 400KB base64 (JPEG 0.8 at 512px).
- Total request body ≤ 1MB. The client drops `flyerImage` if the
  body would exceed 900KB. Text-only fallback if needed.

### REQ-005: Server-side multimodal call

`api/index.ts` new `/ai/flyer-hero` handler:

1. Zod schema:
   ```ts
   z.object({
     prompt: z.string().max(1000),
     context: z.string().max(1500).optional(),
     flyerImage: z.string().max(600_000).optional(),
     aspectRatio: z.enum(['16:9', '1:1', '3:2', '2:3', '3:4']).optional(),
     userEmail: z.string().email().optional(),
   })
   ```
2. Build `input`:
   - Text-only: `input: finalPrompt` (string).
   - With image: `input` is an array of parts
     `[{ text: finalPrompt }, { inlineData: { data, mimeType: 'image/jpeg' } }]`.
     Exact shape per the card/logo spec probe (§9).
3. Grounding instruction prepended when `flyerImage` is present:
   > "The attached image shows the flyer layout I am designing a hero
   > image for. Use it as reference for the hero box position, the
   > copy placement, and the overall visual style. Generate only the
   > hero image that fits the hero box area; do NOT reproduce any
   > text, QR code, logo, or UI element visible in the reference."
4. `generation_config.image_config`:
   `{ image_size: '512', aspect_ratio: v.data.aspectRatio ?? '3:2' }`.
5. `response_modalities: ['text', 'image']` (lowercase).
6. Response handling, 500KB clamp, error mapping — same as existing
   handlers.

### REQ-006: Prompt construction (client)

The client builds the text prompt with the Nano-Banana formula
(Subject + Action + Context + Composition + Lighting + Style),
grounded in the sector and tone:

```
Subject: a hero image for a {sector} flyer, {tone} tone.
  The image depicts {sector_motifs_for_sector} in an abstract or
  photographic style, with no text, no people faces, no logos.
Action: the scene conveys {tone_action_for_tone}, suitable as the
  visual focal point of a promotional flyer.
Context: the brand palette is {accentColor}, {bgColor},
  {textColor}. The flyer is for a {sector} business.
Composition: {aspectRatio} aspect ratio, full-bleed, no border,
  no margin.
Lighting: {tone_lighting_for_tone}.
Style: {sector_style_for_sector}, print-ready, high quality.
Ensure the image remains completely free of any text, words,
  letters, numbers, QR codes, barcodes, logos, symbols, faces,
  people, silhouettes, UI elements, or recognizable brand icons.
```

Sector motifs and tone mappings live in a new
`src/utils/flyer/heroPrompt.ts` (pure functions, unit-tested). They
replace the `inferSectorFromActivity` map from the logo orchestrator
(different sectors: ristorante/evento/salone/negozio vs
tech/food/wellness/...).

### REQ-007: Tier gate — Pro only

- The "Genera hero AI" button is shown **only** when
  `userSettings.tier === 'unlocked'`.
- `useAIFlyer.generateHero` checks the tier client-side before
  fetching. Free-tier users see a disabled button with a tooltip
  "Disponibile nella versione Pro".
- The server endpoint does **not** enforce the tier (it enforces
  rate-limit + auth only). The tier gate is client-side, consistent
  with the existing tier pattern (the card cover and logo background
  are also gated client-side via the AI tab visibility).
- Admin (`admin@gmail.com`) always has access.

### REQ-008: Hero image persistence

- The generated hero data URL is stored in
  `flyer.content.heroImage`, replacing the picsum URL.
- The flyer is auto-saved via the existing `dataService.saveDocument`
  flow (the Flyer Editor already auto-saves on content change).
- The `FLYER_HERO_MAX_AFTER_COMPRESS = 500_000` constant (line 945)
  already validates the hero data URL size. The 500KB Gemini output
  clamp guarantees this passes.
- Reverting to picsum: a "Ripristina immagine default" button next to
  "Genera hero AI" restores the original picsum URL from the template
  seed. The template seed is preserved in `flyer.templateSeed` (if
  present) or rebuilt from `flyer.sector` + `flyer.style.layout`.

### REQ-009: No PII in reference images

The flyer screenshot contains the business name (in the headline),
possibly a phone/website (in the CTA or footer). Mitigations:

- The screenshot is the flyer as the user is designing it; the
  headline is business text (not personal contact data). The phone/
  website, if present, is small text in the footer.
- The server logs only `[ai_flyer_hero] user` with email + timestamp.
  Image bytes never logged.
- Google Gemini API terms: no training on API data.
- The grounding instruction (REQ-005) forbids reproducing visible
  text.

### REQ-010: Copy is NOT sent as text (only screenshot)

Per the user's answer, the copy is **not** sent as a separate text
field. Gemini reads the copy from the screenshot. The `context`
field carries only sector + tone + hero box aspect hint. This keeps
the request body small and avoids duplicating the copy (which is
already visible in the screenshot).

### GUD-001: Reuse existing render path

Do not write a new "flyer screenshot for AI" function. Reuse
`buildFlyerSvg` from `src/utils/flyer/svgRenderer.ts`. The only new
client utility is `compressForAI` (shared with card/logo specs) and
`renderFlyerScreenshot(flyer)` (a thin wrapper around `buildFlyerSvg`
+ canvas, ~20 lines).

### GUD-002: Reuse existing hero box computation

Do not recompute the hero box aspect. Reuse
`heroBoxMmForLayout(flyer.style.layout, getFlyerDimensions(flyer))`
from `templateCatalog.ts`. The aspect ratio mapping (REQ-002) is a
pure function in `heroPrompt.ts`.

## 4. Interfaces & Data Contracts

### Client → Server

`POST /api/ai/flyer-hero`

| Field | Type | Required | Notes |
|---|---|---|---|
| `prompt` | string ≤ 1000 | yes | Nano-Banana text prompt (sector + tone grounded) |
| `context` | string ≤ 1500 | no | Sector + tone + hero box aspect hint |
| `flyerImage` | data URL ≤ 600_000 chars | no | `data:image/jpeg;base64,...` |
| `aspectRatio` | enum | no | Defaults to `'3:2'` |
| `userEmail` | email | no | For logging/tier check |

### Server → Gemini

```
ai.interactions.create({
  model: 'gemini-3.1-flash-image',
  input: <string | array of parts>,
  generation_config: { image_config: { image_size: '512', aspect_ratio: <ratio> } },
  response_modalities: ['text', 'image'],
})
```

### Server → Client (unchanged shape)

`200 { data: { imageBase64, mimeType } }` | `413` | `429` | `502` | `504`

## 5. Acceptance Criteria

- **AC-001**: Given a Pro user with a `ristorante` classic flyer, when
  the user clicks "Genera hero AI", then the request body includes
  `flyerImage` (JPEG ≤ 400KB), `aspectRatio` matching the hero box
  (e.g. `3:2` for classic portrait), and `prompt` with the
  ristorante sector motifs.
- **AC-002**: Given a free-tier user, then the "Genera hero AI"
  button is disabled with a "Disponibile nella versione Pro" tooltip,
  and no request is sent.
- **AC-003**: Given `buildFlyerSvg` throws, then the request is sent
  text-only (no `flyerImage`) and the response is still a valid hero
  image (zero regression — text-only path always works).
- **AC-004**: Given the total JSON body would exceed 900KB, then the
  client drops `flyerImage` and sends text-only.
- **AC-005**: Given the server receives `flyerImage`, then
  `ai.interactions.create` is called with `input` as an array of 2
  parts (text + image) and the grounding instruction prepended.
- **AC-006**: Given the server receives no `flyerImage`, then `input`
  is a string.
- **AC-007**: Given Gemini returns an image > 500KB, then the server
  responds `413`.
- **AC-008**: Given the hero is generated, then `flyer.content.heroImage`
  is updated to the new data URL, the flyer is auto-saved, and the
  preview re-renders with the new hero.
- **AC-009**: Given the user clicks "Ripristina immagine default",
  then `flyer.content.heroImage` is restored to the original picsum
  URL from the template seed.
- **AC-010**: Given the flyer layout is `centered` (no hero box), then
  the "Genera hero AI" button is hidden (centered is text-only, no
  hero box to fill).

## 6. Test Automation Strategy

- **Unit** (`src/utils/flyer/__tests__/heroPrompt.test.ts`, new):
  - `buildHeroPrompt` returns a string containing the sector motifs,
    tone, palette, and aspect ratio.
  - `aspectRatioForHeroBox` maps mm dimensions to the correct Gemini
    ratio per REQ-002 table.
  - Sector motifs for `ristorante`, `evento`, `salone`, `negozio`.
  - Tone mappings for `formale`, `giovanile`, `tecnico`.
- **Unit** (`src/utils/ai/__tests__/compressForAI.test.ts`, shared
  with card/logo specs): compression + body-size fallback.
- **Unit** (`src/hooks/__tests__/useAIFlyer.test.ts`, extended):
  - `generateHero` builds a request with `flyerImage` when
    `buildFlyerSvg` succeeds.
  - Tier gate: free-tier user → button disabled, no fetch.
  - Text-only fallback when render throws.
  - `centered` layout → button hidden.
- **Unit** (`api/__tests__/flyerHero.test.ts`, new):
  - Text-only request → `input` is a string.
  - Request with `flyerImage` → `input` is an array with 2 parts.
  - Grounding instruction prepended only when image present.
  - `aspectRatio` passed to `image_config`.
  - 500KB output clamp, 429, 504 error paths.
- **Integration** (dev manual): run `npm run dev`, open a
  ristorante classic flyer as a Pro user, click "Genera hero AI",
  confirm the hero is a food-themed image fitting the hero box.
  Repeat with `centered` layout (button hidden), repeat as free-tier
  user (button disabled).
- **Coverage target**: 60% for new files.

## 7. Rationale & Context

### Why optional, not default replacement

Replacing picsum with AI for every flyer would multiply Gemini calls
by the number of flyers created (high volume, high cost). Making it
opt-in (Pro only) keeps the cost bounded: only users who actively
want a custom hero trigger the call. Free-tier users keep the static
picsum hero, which is deterministic and free.

### Why screenshot + sector/tone text (not copy text)

The user explicitly chose screenshot + sector/tone, NOT copy as text.
Rationale:
- The copy is already visible in the screenshot; sending it again as
  text is redundant and bloats the body.
- The sector and tone are **not** visible in the screenshot as
  discrete labels (the sector is implied by the copy content, the
  tone is implied by the wording but not explicit). Sending them as
  text hints helps Gemini pick the right visual style.
- The hero box position is visible in the screenshot; Gemini can
  align the hero content to the box.

### Why a new endpoint instead of reusing `/ai/logo-background`

- Different aspect ratio logic (logo is always 16:9; flyer hero
  varies per layout).
- Different rate-limit scope (`aiFlyerHero` vs `aiLogoBg`).
- Different grounding instruction (flyer hero box vs logo
  background).
- Different prompt construction (sector/tone motifs vs
  activity/mood/target).
- Keeping them separate avoids branching logic in a single handler
  and keeps the monolith readable.

### Why `gemini-3.1-flash-image` (same model)

Same rationale as the card/logo specs: one multimodal model handles
both reference understanding and image generation in one call. No
two-call pipeline.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: Google Gemini API (`gemini-3.1-flash-image`) —
  multimodal image generation. Already integrated via
  `/ai/logo-background` and `/ai/card-cover`. This spec adds a third
  endpoint using the same SDK and model.

### Third-Party Services
- **SVC-001**: `@google/genai` SDK — must support array-of-parts
  `input` for image-output requests. **Verify in dev** before merge.
  Fallback: `contents: [{ role, parts }]` shape (same as card/logo
  specs).

### Infrastructure Dependencies
- **INF-001**: Vercel serverless function body limit (1MB) — already
  enforced. REQ-004 keeps the body under 900KB.
- **INF-002**: Vercel Hobby 12-function limit — **NOT impacted**. The
  new endpoint is a new `if` branch in the existing `api/index.ts`
  monolith, NOT a new file. Per AGENTS.md "Vercel Routing, CRITICAL":
  do not add new `.ts` files in `api/`.
- **INF-003**: Client canvas — available in all target browsers.
- **INF-004**: Dev proxy in `vite.config.js` — must forward
  `/api/ai/flyer-hero`. Verify the catch-all `/api/*` proxy covers
  it, or add an explicit middleware entry matching the client/prod
  path exactly (per the logo gotcha #1: path mismatch causes silent
  fetch failure).

### Data Dependencies
- **DAT-001**: `flyer.content` — the source for `buildFlyerSvg`. All
  fields are user-editable text/colours.
- **DAT-002**: `flyer.style.layout` + `flyer.size` + `flyer.orientation`
  — the source for `heroBoxMmForLayout` and `getFlyerDimensions`.
- **DAT-003**: `flyer.templateSeed` (or `flyer.sector`) — the source
  for restoring the picsum URL (REQ-008, AC-009).

### Compliance Dependencies
- **COM-001**: Google Gemini API data processing terms — no training
  on API data. The flyer screenshot contains business text
  (headline) and possibly contact info (phone/website in footer).
  Mitigations in REQ-009. Document in README privacy section.

## 9. Examples & Edge Cases

### Multimodal `input` shape — two candidates

Same as the card/logo specs. Try Shape A first; fall back to Shape B.
Cache the working shape in a module-level variable shared across all
three endpoints (card-cover, logo-background, flyer-hero).

**Shape A (preferred, `interactions.create` with parts array):**
```ts
const interaction = await ai.interactions.create({
  model: 'gemini-3.1-flash-image',
  input: [
    { text: finalPrompt },
    { inlineData: { data: flyerImageB64, mimeType: 'image/jpeg' } },
  ],
  generation_config: { image_config: { image_size: '512', aspect_ratio: ratio } },
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
      { inlineData: { data: flyerImageB64, mimeType: 'image/jpeg' } },
    ],
  }],
  config: {
    responseModalities: ['text', 'image'],
    imageConfig: { imageSize: '512', aspectRatio: ratio },
  },
});
```

### Edge case: centered layout (no hero box)

`centered` layout has no hero box (`heroBoxMmForLayout` returns a
zero-area rect or undefined). The "Genera hero AI" button is hidden
(AC-010). No request is sent. The `heroImage` field stays `null`.

### Edge case: very wide split layout (landscape A4)

Split landscape: hero box is the left half (e.g. 100×50mm → 2:1
aspect). `aspectRatioForHeroBox` maps 2:1 to `16:9` (closest
Gemini-supported). The generated hero is 16:9, composited into the
2:1 box with `preserveAspectRatio="xMidYMid slice"` (crops the top/
bottom). Acceptable.

### Edge case: regeneration

The flyer already has an AI hero (`heroImage` is a data URL). The
user clicks "Genera hero AI" again. The screenshot includes the
previous AI hero. The grounding instruction does NOT mention
"previous iteration to improve upon" (unlike the card/logo specs)
because the hero is the primary subject, not a background — the
user wants a new hero, not an iteration. The screenshot grounds the
layout/copy; the prompt grounds the sector/tone.

### Edge case: empty flyer

`createEmptyFlyer()` has empty copy, no sector, default layout
(classic). The screenshot is a blank layout with placeholder text.
The prompt uses `sector = 'negozio'` (default) and
`tone = 'formale'` (default). Gemini generates a generic retail
hero. No crash.

## 10. Validation Criteria

- All acceptance criteria AC-001..010 pass.
- `npm run typecheck` green.
- `npm run test` green (new `heroPrompt.test.ts`, `flyerHero.test.ts`,
  extended `useAIFlyer.test.ts`).
- Manual dev test: ristorante classic flyer → food hero; evento
  split → event hero; centered → button hidden; free-tier → button
  disabled.
- No regression: existing flyer copy AI (`/ai/copy-flyer`) unchanged.
- No regression: existing picsum hero still works for free-tier and
  for flyers where the AI button was not clicked.
- Vercel function count unchanged (no new file in `api/`).

## 11. Cost Estimate (caveat: not verified today)

> **WARNING**: `ai.google.dev/pricing` was unreachable at spec time.
> Numbers are from prior knowledge and **must be confirmed in the
> dashboard before budgeting.**

| Item | Estimate | Notes |
|---|---|---|
| Image generation (output) `gemini-3.1-flash-image` @ 512px | ~$0.039 / image | **Verify.** |
| Input image tokens (flyer screenshot ~512px) | ~258-384 tokens | Billed at text-token rate. **Verify.** |
| Total per hero call (1 output + 1 input) | ~$0.04-0.05 / call | Dominated by the output image. |
| Free tier (AI Studio) | Likely included | Production uses paid key. **Verify.** |

**Cost impact**: this is a **new** endpoint (no current cost for AI
hero). The Pro-tier gate bounds the volume: only unlocked users
trigger it, and only when they actively click the button. The
5/min/IP rate limit caps worst-case spend per user. At ~$0.05/call
and assuming 100 Pro users generating 5 heroes/month each, that's
$25/month — well within budget.

**Action item before merge**: check the actual numbers and update
this table. If the real cost is > 2× the estimate, reconsider the
tier gate or the rate limit.

## 12. Related Specifications / Further Reading

- `spec-design-ai-card-context-aware-cover.md` — sibling spec for the
  card cover. Shares `compressForAI`, the multimodal `input` shape
  probe, and the body-size fallback pattern.
- `spec-design-ai-logo-vision-grounded-background.md` — sibling spec
  for the logo background. Same shared utilities.
- AGENTS.md § "Vercel Routing, CRITICAL" — why the new endpoint MUST
  be a new `if` branch in the monolith, NOT a new file.
- AGENTS.md § "Logo AI, Gemini background gotchas" — the production
  bugs. The flyer-hero endpoint is subject to the same gotchas
  (path mismatch, `process.env` not populated, import strategy,
  `response_modalities` lowercase, `image_size` enforcement,
  copyright filter). Reuse the existing inline-`@google/genai`
  pattern from `/ai/logo-background` to avoid re-introducing them.
- `src/utils/flyer/svgRenderer.ts` — `buildFlyerSvg` (line 202),
  reused.
- `src/utils/flyer/templateCatalog.ts` — `heroBoxMmForLayout`
  (line 213), reused.
- `src/utils/documentSchemas.ts` — `FLYER_HERO_MAX_AFTER_COMPRESS`
  (line 945), already 500KB, compatible with the Gemini output clamp.
- `api/index.ts` `/ai/logo-background` handler (lines ~1380-1440) —
  template for the new `/ai/flyer-hero` handler.

## Follow-up (out of scope)

- **Batch hero generation**: generate 2-3 hero variants in one call
  and let the user pick. Currently one call = one hero.
- **Automatic hero on template creation**: for Pro users, auto-
  generate the hero when a template is created (instead of picsum).
  Currently the user must click the button.
- **Hero from user photo**: let the user upload a photo and have
  Gemini stylise it as the hero (image-to-image, not text-to-image).
  Requires a different Gemini call shape.
- **Privacy doc update**: add a README section disclosing that flyer
  screenshots (containing business text) are sent to Google Gemini
  for hero generation.
- **User-editable sector override**: let the user type a free-form
  sector hint in the AI panel, prepended to the prompt.