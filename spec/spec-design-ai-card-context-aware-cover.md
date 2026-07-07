---
id: spec-design-ai-card-context-aware-cover
title: AI Card — Vision-Grounded Cover Generation
status: draft
created: 2026-07-07
updated: 2026-07-07
tags: [ai, card, gemini, nano-banana, cover, vision, sector, logo, spec]
supersedes: spec-design-ai-card-text-vision-split
skill: muapi-nano-banana
---

# AI Card — Vision-Grounded Cover Generation

## Introduction

The card editor's "Sfondo AI" feature generates an abstract
background image via Gemini (Nano Banana 2, `gemini-3.1-flash-image`)
on the endpoint `POST /api/ai/card-cover`. The current implementation
sends only a **text prompt** describing the card (palette, grid
positions, overlay hints, a compact JSON snapshot). Gemini therefore
reasons about an abstract "card" it has never seen.

This spec replaces the text-only approach with a **vision-grounded**
request: the client renders the actual card side to a PNG screenshot
and, when present, the user's logo PNG, and sends both as inline
images to the same `gemini-3.1-flash-image` model. Gemini can now see
the real layout, the real text placement, the real logo, and produce a
background that is genuinely coherent with what the user is designing
— without the model re-drawing the text, QR, logo, faces, or other
card chrome (the prompt still forbids those, and the overlaid
screenshot is sent only as **reference**, never as the output).

## 1. Purpose & Scope

### Purpose
Generate a context-aware, print-ready background for a business card
by showing Gemini the card as it currently looks, so the background is
coherent with the real layout, profession, and brand identity, instead
of relying on a keyword-inferred "sector" guess.

### Scope
- In scope: extend `POST /ai/card-cover` to accept up to two inline
  reference images (card screenshot, user logo) in addition to the
  existing text prompt; render the card screenshot client-side using
  the existing `renderCardSideDataUrl`; ship the request as a
  multimodal `ai.interactions.create` call.
- Out of scope: AI text modifications (still DeepSeek via
  `/api/ai/chat`); logo recreation (Logo Builder module); a separate
  vision-based print-contrast analysis model (follow-up spec).

### Audience
- Implementing agent (opencode).
- Reviewers of the API contract change.

### Assumptions
- `gemini-3.1-flash-image` (Nano Banana 2) accepts image inputs in the
  same `interactions.create` call used for image output. This is the
  documented multimodal behaviour of the model family (DeepMind model
  card: "Input: Text, Image, Video, Audio, PDF; Output: Text, Image,
  Video, Audio, PDF"). **ASSUMPTION TO VERIFY in dev before merge**:
  the `@google/genai` SDK accepts `input` as an array of parts
  `[{ text }, { image: { data, mimeType } }, ...]` for image-output
  requests. If the SDK only accepts a string `input` for image output,
  fall back to `contents: [{ role: 'user', parts: [...] }]` (the older
  `generateContent` shape). See §9 Examples.
- The 500KB base64 clamp on the response is unchanged. The input
  images do **not** count toward the 500KB output clamp; they count as
  request body size, governed by the Vercel function body limit (1MB,
  already enforced by `bodyParser`).
- The dev proxy in `vite.config.js` for `/api/ai/card-cover` already
  forwards correctly (path matches client/prod exactly). No proxy
  change needed.

## 2. Definitions

- **Nano Banana 2**: code name for `gemini-3.1-flash-image`, Google's
  image-generation multimodal model.
- **Reference image**: an image sent in the request **input** that
  Gemini looks at to ground its generation. It is **not** the output.
- **Cover image**: the image Gemini **generates and returns** in the
  response (`interaction.output_image`). Becomes `coverImageUrl` on
  the card.
- **Card screenshot**: a PNG render of the current card side (front or
  back) produced client-side via `renderCardSideDataUrl`.
- **Inline image**: base64 data URL sent inside the JSON request body,
  not an uploaded file or URL Gemini must fetch.

## 3. Requirements, Constraints & Guidelines

### REQ-001: Multimodal request body

The client sends `POST /api/ai/card-cover` with:

```json
{
  "prompt": "<Nano-Banana text prompt, unchanged v3.0>",
  "context": "<compact card context, unchanged>",
  "cardImage": "<base64 data URL of the card screenshot, optional>",
  "logoImage": "<base64 data URL of the user logo, optional>",
  "side": "front | back",
  "userEmail": "<optional>"
}
```

- `cardImage` is **always sent when available** (the screenshot is the
  primary grounding signal). It may be omitted only when the render
  fails (fallback to text-only, current behaviour).
- `logoImage` is sent only when `card.front.logoUrl` is set AND
  `side === 'front'`. Back-side covers do not benefit from the logo
  (the logo lives on the front).
- Both images are JPEG-quality-compressed client-side to keep the
  request body under ~600KB total (see REQ-004).

### REQ-002: Card screenshot render

The client renders the requested side to a PNG data URL using the
existing `renderCardSideDataUrl(card, side, pxW, pxH)` utility:

- Dimensions: **512×332 px** (landscape card, ~3:2 aspect, matches the
  `1:1` output crop region's horizontal slice). Rationale: Gemini
  `image_size: '512'` output is 512×512; a 512-wide reference matches
  the output's horizontal resolution so Gemini can align background
  features to the real text columns.
- The screenshot is the card **as the user sees it now**, including
  the current `coverImageUrl` if one is already set. This lets the
  user regenerate a cover that better fits the current layout by
  showing Gemini the previous cover + layout together.
- The watermark is **not** applied to the reference screenshot (we
  don't want Gemini to copy the watermark into the new background).
  Use `renderCardSideDataUrl` directly, not `generateCardPng` (which
  applies the tier watermark).
- If the render throws (jsdom, canvas unavailable, image load
  timeout), the client logs a warning and sends the request text-only.
  No hard failure.

### REQ-003: Logo extraction

- Source: `card.front.logoUrl` (already a base64 data URL or a remote
  URL resolved to base64 by `resolveToBase64DataUrl`).
- Re-encode to PNG 256×256 (square, matches logo aspect regardless of
  original format) via canvas resize. This keeps the logo small
  (~50-150KB) and standardised.
- Skip if `logoUrl` is empty, `null`, or `'undefined'` (legacy cards).
- Skip if `side === 'back'` (logo is front-only context).

### REQ-004: Body size budget

- `prompt`: max 1000 chars (unchanged).
- `context`: max 2000 chars (unchanged).
- `cardImage`: target ≤ 400KB base64 (~300KB binary). Achieved by
  rendering at 512×332 and JPEG-encoding at quality 0.8 in a canvas
  re-export step. PNG is acceptable if the canvas toDataURL('image/jpeg',0.8) is unavailable.
- `logoImage`: target ≤ 100KB base64. 256×256 PNG is well under this.
- Total request body ≤ 1MB (the Vercel `bodyParser` limit). The
  client MUST measure the JSON string length before fetch and drop
  `logoImage` first, then `cardImage`, if the body would exceed 900KB
  (safety margin). Text-only fallback if both must be dropped.

### REQ-005: Server-side multimodal call

`api/index.ts` `/ai/card-cover` handler is extended:

1. Zod schema adds `cardImage: z.string().max(600_000).optional()`,
   `logoImage: z.string().max(150_000).optional()`,
   `side: z.enum(['front','back']).optional()`.
2. Build the `input` for `ai.interactions.create`:
   - If neither image is present: `input: finalPrompt` (string, current
     behaviour, zero regression).
   - If one or both images are present: `input` becomes an array of
     parts:
     ```ts
     input: [
       { text: finalPrompt },
       ...(cardImage ? [{ inlineData: { data: stripDataUrlPrefix(cardImage), mimeType: 'image/jpeg' } }] : []),
       ...(logoImage ? [{ inlineData: { data: stripDataUrlPrefix(logoImage), mimeType: 'image/png' } }] : []),
     ]
     ```
     The exact part shape (`inlineData` vs `image: { data, mimeType }`)
     MUST be confirmed against the installed `@google/genai` version in
     dev. See §9 Examples for both candidate shapes.
3. The text prompt is **prepended** with a grounding instruction when
   images are present:
   > "The attached image(s) show the business card layout I am
   > designing a background for. Use them as reference for text
   > placement, colour harmony, and profession. Do NOT reproduce any
   > text, QR code, logo, face, or UI element visible in the
   > reference — generate only the abstract background."
4. `generation_config.image_config` stays
   `{ image_size: '512', aspect_ratio: '1:1' }` (unchanged).
5. `response_modalities: ['text', 'image']` (unchanged, lowercase).
6. Response handling, 500KB output clamp, error mapping (401/429/504)
   — all unchanged.

### REQ-006: Prompt unchanged (v3.0)

The Nano-Banana text prompt in `coverBrief.ts` is **not modified** by
this spec. The v3.0 prompt already forbids text/logos/faces/QR via
Negative Constraint Logic. The grounding instruction in REQ-005 is
server-side and prepended only when images are present; it does not
touch the client-built `prompt` string. This keeps `coverBrief.test.ts`
green without modification.

### REQ-007: Rate limit unchanged

`aiCardCover` rate limit stays 5 req/min/IP. Vision-grounded requests
are not more expensive in call count than text-only; the cost
difference is in body size, not request frequency. No rate-limit
change.

### REQ-008: No PII in reference images

The card screenshot contains the user's name, title, company, phone,
email (on the back). This is PII sent to Google as image input. Mitigations:

- The screenshot is sent **only** for the side being generated
  (`side` field). Generating a front cover sends only the front
  screenshot (name/title/company/photo/logo — no phone/email). The
  back screenshot (phone/email/QR) is sent only when generating a
  back cover.
- The server logs only `[ai_card_cover] user` with email + timestamp
  (unchanged). The image bytes are never logged.
- The request is covered by Google's Gemini API data processing terms
  (no training on API data, as per Google's standard AI Studio / API
  terms). Document this in the README privacy section as a follow-up.
- The grounding instruction (REQ-005) explicitly tells Gemini not to
  reproduce the visible text, reducing leakage risk into the output
  image.

### REQ-009: Tier guard unchanged

`useAICard.generateCover` already checks `profile.tokensUsed >=
profile.tokenLimit` for non-admin, non-localhost users before
calling. Vision grounding does not change token accounting (cover
generation is not currently counted as tokens — it's a flat-rate AI
call, rate-limited per IP). No tier change.

### REQ-010: Mobile fallback

`renderCardSideDataUrl` uses `document.createElement('canvas')` and
`Image`. On mobile browsers this is reliable. The 3-second SVG load
timeout in `loadSvgImage` is unchanged. If the screenshot times out,
text-only fallback (REQ-002). No new mobile-specific code.

### GUD-001: Reuse existing render path

Do not write a new "screenshot for AI" function. Reuse
`renderCardSideDataUrl` from `src/utils/card/pngExport.ts`. The only
new client utility is a small `compressForAI(dataUrl, maxBytes)`
helper that re-encodes via canvas to JPEG 0.8 if the PNG exceeds the
budget.

### GUD-002: Strip the cover image from the screenshot

When regenerating a cover, the current card already has a
`coverImageUrl`. The screenshot will include it. This is **desirable**
(REQ-002) but the grounding instruction must tell Gemini "the
background visible in the reference is the *previous* background;
generate a *new* one that fits the same text layout better". Add to
the server-side grounding instruction:

> "If a background is already visible in the reference image, treat
> it as the previous iteration to improve upon, not as a constraint to
> copy."

## 4. Interfaces & Data Contracts

### Client → Server

`POST /api/ai/card-cover`

| Field | Type | Required | Notes |
|---|---|---|---|
| `prompt` | string ≤ 1000 | yes | Nano-Banana text prompt (v3.0, unchanged) |
| `context` | string ≤ 2000 | no | Compact card context (unchanged) |
| `cardImage` | data URL ≤ 600_000 chars | no | `data:image/jpeg;base64,...` |
| `logoImage` | data URL ≤ 150_000 chars | no | `data:image/png;base64,...` |
| `side` | `'front' \| 'back'` | no | Defaults to `'front'` |
| `userEmail` | email | no | For logging/tier check |

### Server → Gemini

```
ai.interactions.create({
  model: 'gemini-3.1-flash-image',
  input: <string | array of parts>,
  generation_config: { image_config: { image_size: '512', aspect_ratio: '1:1' } },
  response_modalities: ['text', 'image'],
})
```

### Server → Client (unchanged)

`200 { data: { imageBase64, mimeType } }` | `413` | `429` | `502` | `504`

## 5. Acceptance Criteria

- **AC-001**: Given a card with `front.title = "Web Developer"` and a
  rendered front screenshot, when the user clicks "Sfondo AI" on the
  front, then the request body includes `cardImage` as a JPEG data URL
  ≤ 400KB and `side: "front"`, and Gemini returns a background with
  no legible text/QR/logo baked in.
- **AC-002**: Given a card with `front.logoUrl` set, when generating a
  front cover, then `logoImage` is included as a 256×256 PNG data URL.
- **AC-003**: Given a card with no `logoUrl`, when generating a front
  cover, then `logoImage` is omitted and `cardImage` is still sent.
- **AC-004**: Given a back-side cover request, then `logoImage` is
  omitted (logo is front-only) and `cardImage` is the back screenshot.
- **AC-005**: Given `renderCardSideDataUrl` throws, then the request
  is sent text-only (no `cardImage`, no `logoImage`) and the response
  is still a valid cover (zero regression vs current behaviour).
- **AC-006**: Given the total JSON body would exceed 900KB, then the
  client drops `logoImage` first; if still > 900KB, drops `cardImage`;
  if still > 900KB, sends text-only.
- **AC-007**: Given the server receives `cardImage` and `logoImage`,
  then `ai.interactions.create` is called with `input` as an array of
  parts (text + inlineData image(s)), and the grounding instruction is
  prepended to the text part.
- **AC-008**: Given the server receives no images, then
  `ai.interactions.create` is called with `input` as a string (current
  behaviour, zero regression).
- **AC-009**: Given Gemini returns an image > 500KB, then the server
  responds `413` (unchanged).
- **AC-010**: Given the user is on a free tier and has hit the token
  limit, then `useAICard.generateCover` throws before the fetch
  (unchanged tier guard).

## 6. Test Automation Strategy

- **Unit** (`src/utils/card/__tests__/coverBrief.test.ts`): unchanged.
  The text prompt is not modified by this spec; existing tests stay
  green.
- **Unit** (`src/utils/card/__tests__/aiCoverImage.test.ts`, new):
  - `compressForAI` re-encodes a 1MB PNG to a JPEG < 400KB.
  - `buildCoverRequest` (new helper in `useAICard`) returns
    `{ prompt, context, cardImage, logoImage, side }` with the correct
    fields present/absent per AC-002..004.
  - Body-size fallback logic (AC-006): mock a 1.2MB body, assert
    `logoImage` dropped, then `cardImage` dropped.
- **Unit** (`api/__tests__/cardCover.test.ts`, new or extended):
  - Text-only request → `input` is a string.
  - Request with `cardImage` only → `input` is an array with 2 parts
    (text + image).
  - Request with both images → `input` is an array with 3 parts.
  - Grounding instruction prepended only when images present.
  - 500KB output clamp, 429, 504 error paths unchanged.
- **Integration** (dev manual): run `npm run dev`, open card editor,
  generate a front cover with a real logo, confirm Gemini returns a
  background that visually aligns with the card layout. Repeat with
  back side, repeat with empty card (text-only fallback).
- **Coverage target**: 60% for new files (`aiCoverImage.ts`,
  `cardCover.test.ts`).

## 7. Rationale & Context

### Why vision grounding instead of sector inference

The previous draft (`spec-design-ai-card-context-aware-cover.md`,
text-only) proposed a keyword-based sector inference (`tech`, `food`,
`legal`, ...) mapping to abstract motif lists. This has three
weaknesses:

1. **Brittle keyword matching**: "Studio Legge Rossi" matches `legal`
   via "studio", but "Studio Fotografico" also matches `legal` via
   "studio" — wrong. Italian/English keyword collisions are endless.
2. **No real layout awareness**: the model still doesn't know where
   the text actually sits, so it can't avoid putting a busy motif
   behind the name.
3. **Maintenance burden**: 7 sectors × 5 motifs = 35 strings to keep
   coherent with brand voice, plus the keyword map.

Vision grounding eliminates all three: Gemini **sees** the profession
from the title text, sees the logo, sees the layout, and produces a
coherent background in one call. No keyword map, no sector table, no
motif strings.

### Why the same model (`gemini-3.1-flash-image`)

Nano Banana 2 is natively multimodal (Input: text, image, video,
audio, PDF; Output: text, image, video, audio, PDF per DeepMind model
card). Using a single model for both reference understanding and
image generation avoids a two-call pipeline (e.g. `gemini-2.5-flash`
vision + `gemini-3.1-flash-image` generation), which would double the
cost and latency. One call, one billable image.

### Why not send `photoUrl` (the user's face)

Faces are high-risk PII and Gemini's safety filters sometimes refuse
requests containing faces. The screenshot already shows the photo
placement, which is enough for layout grounding. Sending the raw
face photo adds risk without benefit. (User answered: only card
screenshot + logo.)

### Why JPEG for the screenshot and PNG for the logo

- Screenshot: photographic-ish content (gradients, text, photo) → JPEG
  0.8 is ~5× smaller than PNG at acceptable quality.
- Logo: flat vector content with hard edges → PNG is sharper and
  smaller than JPEG for graphics with few colours.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: Google Gemini API (`gemini-3.1-flash-image`,
  Nano Banana 2) — multimodal image generation. Already integrated via
  `/ai/card-cover` and `@google/genai` SDK. This spec extends the
  request shape, not the integration.

### Third-Party Services
- **SVC-001**: `@google/genai` SDK — must support array-of-parts
  `input` for image-output requests. **Verify in dev** before merge.
  Fallback: `contents: [{ role, parts }]` shape.

### Infrastructure Dependencies
- **INF-001**: Vercel serverless function body limit (1MB) — already
  enforced. REQ-004 keeps the body under 900KB with safety margin.
- **INF-002**: Client canvas (`document.createElement('canvas')`) —
  available in all target browsers and jsdom (with canvas polyfill,
  already used by `pngExport.ts` tests).

### Data Dependencies
- **DAT-001**: `card.front.logoUrl` — may be a data URL, blob URL, or
  remote URL. `resolveToBase64DataUrl` already normalises all three to
  a base64 data URL.
- **DAT-002**: `card.front.photoUrl` — **not sent** to Gemini (REQ:
  faces are not transmitted). Only the screenshot, which contains the
  photo rendered, is sent (the photo is part of the card the user is
  designing and showing to Gemini for layout grounding).

### Compliance Dependencies
- **COM-001**: Google Gemini API data processing terms — API requests
  are not used for model training (per Google's standard API terms).
  The card screenshot contains PII (name, company, on the back also
  phone/email). Mitigations in REQ-008. Document in README privacy
  section as follow-up.

## 9. Examples & Edge Cases

### Multimodal `input` shape — two candidates

The installed `@google/genai` version's exact `input` shape for
image-output multimodal requests must be confirmed in dev. Try shape
A first; if it throws, fall back to shape B.

**Shape A (preferred, `interactions.create` with parts array):**
```ts
const interaction = await ai.interactions.create({
  model: 'gemini-3.1-flash-image',
  input: [
    { text: finalPrompt },
    { inlineData: { data: cardImageB64, mimeType: 'image/jpeg' } },
    { inlineData: { data: logoImageB64, mimeType: 'image/png' } },
  ],
  generation_config: { image_config: { image_size: '512', aspect_ratio: '1:1' } },
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
      { inlineData: { data: cardImageB64, mimeType: 'image/jpeg' } },
      { inlineData: { data: logoImageB64, mimeType: 'image/png' } },
    ],
  }],
  config: {
    responseModalities: ['text', 'image'],
    imageConfig: { imageSize: '512', aspectRatio: '1:1' },
  },
});
const image = response.output_image; // or response.candidates[0].content.parts.find(p => p.inlineData)
```

The implementation MUST try A, catch the error, log the message, and
if the error indicates the input shape is invalid, retry with B. Cache
the working shape in a module-level variable so subsequent calls skip
the probe.

### Edge case: empty card

`createEmptyCard()` has no `logoUrl`, no `photoUrl`, no text. The
screenshot is a blank coloured rectangle. Gemini receives it + the
text prompt. The background will be a generic abstract gradient
(current behaviour preserved). No crash, no empty sector.

### Edge case: very large logo

A user uploads a 2MB PNG logo. The 256×256 re-encode in REQ-003
shrinks it to ~50KB. If the re-encode fails (rare), `logoImage` is
dropped (AC-006 body-size fallback).

### Edge case: back side with QR

Back-side screenshot includes the QR code. The grounding instruction
tells Gemini not to reproduce it. The QR in the reference is for
layout grounding (where the QR sits, how big it is), not for
generation.

## 10. Validation Criteria

- All acceptance criteria AC-001..010 pass.
- `npm run typecheck` green.
- `npm run test` green (existing `coverBrief.test.ts` unchanged, new
  `aiCoverImage.test.ts` and `cardCover.test.ts` added).
- Manual dev test: front cover with logo + back cover with QR produce
  visually coherent backgrounds with no baked-in text/QR/logo.
- No regression: text-only path (no images) returns identical results
  to the current implementation (verified by running the existing
  `useAICard.test.ts` suite unchanged).

## 11. Cost Estimate (caveat: not verified today)

> **WARNING**: `ai.google.dev/pricing` was unreachable from the
> agent's environment at spec time (2026-07-07). The numbers below are
> from prior knowledge of Gemini API pricing and **must be confirmed
> in the Vercel/AI Studio dashboard before relying on them for
> budgeting.** Treat them as order-of-magnitude estimates.

| Item | Estimate | Notes |
|---|---|---|
| Image generation (output) `gemini-3.1-flash-image` @ 512px | ~$0.039 / image | Nano Banana 2 pay-as-you-go. **Verify.** |
| Input image tokens (reference screenshot ~512×332) | ~258-384 tokens | Typically billed at text-token rate for the same model. **Verify.** |
| Input image tokens (logo 256×256) | ~150-200 tokens | Same as above. |
| Total per cover call (1 output + 2 inputs) | ~$0.04-0.05 / call | Dominated by the output image cost. |
| Free tier (AI Studio, personal use) | Likely included | Production Vercel deploys use the paid key. **Verify free-tier RPM/RPD.** |

**Cost impact of this spec vs current**: the current text-only call
costs ~$0.039 (output image only). This spec adds ~$0.01-0.02 per call
for the input image tokens (two small images). Roughly **+30-50% per
call**, but the per-call cost is so low that even 1000 covers/month
would be ~$50-60/month total — well within the project's free-tier
budget unless usage spikes. The rate limit (5/min/IP) caps the
worst-case spend per user.

**Action item before merge**: check the actual numbers in your
dashboard and update this table. If the real cost is > 2× the
estimate, revisit the rate limit or the image-size choice.

## 12. Related Specifications / Further Reading

- `spec-design-ai-card-text-vision-split.md` (superseded by this spec)
- `spec-design-ai-card-vision-input.md` (future: separate
  print-contrast analysis via `gemini-2.5-flash` vision, two-call
  pipeline)
- AGENTS.md § "Cover AI Card gotchas" — the 3 production bugs that
  blocked cover generation. This spec does **not** touch the prompt
  (gotcha #3, copyright filter) or the import strategy (gotchas #1,
  #2), so those remain valid.
- `src/ai/providers/gemini.ts` — existing provider, reused unchanged.
- `src/utils/card/pngExport.ts` — `renderCardSideDataUrl`, reused.
- `src/utils/card/coverBrief.ts` — `buildCardCoverBrief`, reused
  unchanged (REQ-006).
- `api/index.ts` `/ai/card-cover` handler (lines ~1317-1378) —
  extended per REQ-005.

## Follow-up (out of scope)

- **Print-contrast analysis**: a second Gemini call (`gemini-2.5-flash`
  vision) analyses the generated cover + card screenshot for WCAG
  contrast and print readiness. Separate spec.
- **Logo colour extraction**: extract dominant colours from `logoUrl`
  via canvas sampling and inject them into the prompt palette.
  Currently the palette comes from `card.style` only.
- **User-editable profession override**: let the user type a free-form
  profession hint in the AI panel, prepended to the prompt. The
  screenshot already shows the profession, but an explicit hint could
  help for ambiguous cases.
- **Privacy doc update**: add a README section disclosing that card
  screenshots (containing PII) are sent to Google Gemini for
  background generation, per REQ-008.