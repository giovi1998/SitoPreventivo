---
title: AI Image Generation Quality — risoluzione per-uso, JPEG output, Nano Banana 2 Lite
version: 1.0
date_created: 2026-08-06
owner: quickbrand
tags: design, ai, gemini, images
---

# Introduction

Le immagini generate da AI (logo background, card cover/photo, flyer hero,
icone) risultano pixelate perché l'intera pipeline è bloccata a 512px:
generazione `image_size: '512'` (clamp server 500KB), persistenza client che
ricomprime a 512px/300KB, aree di render che richiedono 1000-3600px @300dpi
(card 1004×650, flyer A4 hero 2362×1358, logo export 2048). Questa spec
definisce il fix: risoluzione per-uso (1K/2K), output JPEG con compressione
controllata, persistenza path-aware, e registrazione del modello Nano Banana
2 Lite (`gemini-3.1-flash-lite-image`).

## 1. Purpose & Scope

Scopo: eliminare il pixelate nelle immagini AI generato e renderizzate
dall'app, e rendere selezionabile il modello economico Nano Banana 2 Lite.

In scope:
- Risoluzione di generazione per-endpoint (card/photo 1K, flyer-hero e
  logo-background 2K, icone 1K).
- Output JPEG con `imageOutputOptions` (`mimeType`, `compressionQuality`).
- Clamp server per-endpoint (500KB per 1K, 1.5MB per 2K) + timeout adeguato.
- Persistenza client path-aware (1536px per background/hero, 1024px per le
  altre immagini, PNG che preserva alpha).
- Registrazione Nano Banana 2 Lite in `AI_IMAGE_MODELS`, pricing, zod enum,
  mapping costi hook.
- Fix bug latenti: retry auto-build `size:'256'` (non validato da zod →
  400 silenzioso), aspect ratio `'3:1'` (non supportato da Gemini).

Fuori scope (residuo `docs/to-be-done.md` task #2):
- Verifica Playwright densità px in preview/export (screenshot + pixel
  density), rimandata a task separato.
- Generazione 4K e storage dedicato per esso (supera clamp body/storage).

Pubblico: implementatore (agente di coding), reviewer. Assunzioni: chiave
`GEMINI_API_KEY` attiva, SDK `@google/genai` ≥ 2.10 (supporta
`image_config.image_size` con valori `512`/`1K`/`2K`/`4K` e
`imageOutputOptions`).

## 2. Definitions

- **Nano Banana 2** (`gemini-3.1-flash-image`): modello immagine Gemini
  generale, 512/1K/2K/4K, fino a 14 reference image.
- **Nano Banana 2 Lite** (`gemini-3.1-flash-lite-image`): modello più veloce
  ed economico. Supporta SOLO risoluzione `1K`. Non ottimizzato per più
  input di riferimento o modifica sequenziale multi-turno.
- **Clamp server**: guardia post-generazione che rifiuta con 413 le
  immagini oltre una soglia di byte (calcolata `base64.length * 0.75`).
- **`imageOutputOptions`**: campo `image_config` (SDK `@google/genai`,
  camelCase; REST `image_output_options`) per formato/qualità output.

## 3. Requirements, Constraints & Guidelines

### Generazione (per-endpoint)

| REQ | Endpoint | `image_size` | Clamp server | Timeout SDK |
|-----|----------|--------------|--------------|-------------|
| REQ-GEN-001 | `/api/ai/card-cover` | `1K` | 500KB (invariato) | 30s (invariato) |
| REQ-GEN-002 | `/api/ai/card-photo` | `1K` | 500KB (invariato) | 30s (invariato) |
| REQ-GEN-003 | `/api/ai/flyer-hero` | `2K` | **1.5MB** | **45s** |
| REQ-GEN-004 | `/api/ai/logo-background` | `2K` | **1.5MB** | **45s** |
| REQ-GEN-005 | `/api/ai/image-flash` | `1K` (default) | 500KB (invariato) | 30s (invariato) |

- **REQ-GEN-006**: ogni chiamata `interactions.create` per generazione
  immagine imposta `image_config.imageOutputOptions = { mimeType:
  'image/jpeg', compressionQuality: 85 }` (SDK) — equivalente
  `image_output_options` nel payload REST.
- **REQ-GEN-007**: `gemini-3.1-flash-lite-image` è sempre forzato a
  `image_size: '1K'` (unica risoluzione supportata), in qualunque endpoint.
- **REQ-GEN-008**: Lite non è utilizzabile come modello per card-cover,
  logo-background o flyer-hero quando la richiesta include immagini di
  riferimento (reference input): il modello non è ottimizzato per più
  reference. Il client non deve proporre Lite per quei flussi se l'endpoint
  riceve immagini; il server accetta comunque la richiesta (1K).
- **REQ-GEN-009**: il dev proxy `vite.config.js` replica esattamente i
  config per-endpoint della produzione (dev == prod, gotcha §2-3).
- **REQ-GEN-010**: `src/ai/providers/gemini.ts` espone helper
  `resolveImageSize(model, requestedSize)` che forza `1K` per Lite e delega
  `requestedSize` altrimenti. `geminiFlashImage.ts` (provider) passa `1K`.

### Validazione API (`api/index.ts`)

- **REQ-VAL-001**: zod `size` in `/api/ai/image-flash` → enum `['512',
  '1K']`, default `'1K'`. Valori fuori enum → 400 (oggi `'256'` passa e
  fallisce silenziosamente).
- **REQ-VAL-002**: zod `aspectRatio` in `/api/ai/image-flash` → enum
  `['1:1','3:2','2:3','3:4','4:3','4:5','5:4','9:16','16:9','21:9']`
  (rimuove `'3:1'`, non supportato da Gemini 3.1).
- **REQ-VAL-003**: zod `imageModel` enum dei 4 endpoint immagine
  (`card-cover`, `flyer-hero`, `card-photo`, `image-flash`) → aggiungere
  `gemini-3.1-flash-lite-image`.
- **REQ-VAL-004**: `normalizeGeminiImageModel` riconosce Lite come valido
  (oggi solo `gemini-3.1-flash-image` è "corrente"; Lite non deve essere
  normalizzato verso altro modello).

### Modello Lite (client)

- **REQ-LITE-001**: `AI_IMAGE_MODELS` in `src/utils/uiPrefs.ts` aggiunge
  `{ id: 'gemini-3.1-flash-lite-image', name: 'Gemini Nano Banana 2 Lite',
  description: 'Veloce ed economico, risoluzione 1K' }`. Il default resta
  Nano Banana 2 (`AI_IMAGE_MODELS[0]`).
- **REQ-LITE-002**: `PRICING` in `src/ai/providerPricing.ts` aggiunge
  `'gemini-nano-banana-lite': { input: 0, output: 0, unit: 'per_image',
  perImage: 0.02 }` (stima upper-bound, metà del $0.04 di Nano Banana 2).
- **REQ-LITE-003**: mappatura modello→pricingId centralizzata: i ternari
  duplicati in `useAILogo.ts:164`, `useAIFlyer.ts:204`,
  `useAutoBuildGenerate.ts:244` diventano switch a 3 vie:
  `gemini-3.1-flash-lite-image` → `gemini-nano-banana-lite`;
  `gemini-2.0-flash-preview-image-generation` (legacy) →
  `gemini-flash-image`; altrimenti → `gemini-nano-banana`.
- **REQ-LITE-004**: `useAIIconHero.ts:84` sostituisce il costo hardcoded
  `0.02` con `calculateCostUsd(pricingId, undefined, 1)` usando il modello
  richiesto (default `getAiImageModelDefault()`).

### Persistenza client (path-aware)

- **REQ-PERS-001**: `compressDataUrl` default `maxDim` 512→**1024**,
  `maxBytes` 300_000→**400_000** (`src/utils/card/imageCompress.ts:100`).
- **REQ-PERS-002**: branch PNG di `compressDataUrl` non degrada più a JPEG
  q0.75 quando l'output PNG supera `maxBytes`: downscale iterativo (÷2 o
  ×0.85) con minDim ~200 fino a rientrare (pattern già in `compressImage`
  righe 58-76), così l'alpha delle icone trasparenti è preservato. Se anche
  al minDim supera `maxBytes`, ritorna il PNG al minDim (mai fallback JPEG
  per PNG).
- **REQ-PERS-003**: `compressPayloadImages` (`src/utils/dataService/images.js`)
  usa parametri per-path:

  | Path | maxDim | maxBytes |
  |------|--------|----------|
  | `builder.backgroundImage` | 1536 | 400_000 |
  | `content.heroImage` | 1536 | 400_000 |
  | `front.photoUrl`, `front.logoUrl`, `front.coverImageUrl`, `back.coverImageUrl` | 1024 | 400_000 |
  | website `html` / `pagesHtml` / `logoUrl` / `images[]` | 1024 | 300_000 (invariato) |

  La soglia di intervento `B64_COMPRESS_MIN_CHARS` resta 300_000 char.
- **REQ-PERS-004**: `saveGeneratedImage.ts:41` → `compressDataUrl(dataUrl,
  1024, 400_000)`.
- **REQ-PERS-005**: `saveCompression.ts` (`compressCardImages`) →
  1024/400_000.
- **REQ-PERS-006**: `useAutoBuildGenerate.ts`: retry loop `['512','256']` →
  `['1K','512']` (fix 400 silenzioso); background (riga 290) →
  `compressDataUrl(..., 1536, 400_000)`; retry quota (riga 136) →
  `compressDraftImages(..., 1024, 200_000)`.
- **REQ-PERS-007**: caller che usano i default di `compressDataUrl`
  (`LogoEditor.tsx:108,278`, `FlyerEditorShell.tsx:174,408`) non cambiano
  codice — ereditano 1024/400K.

### Constraints

- **CON-001**: nessun nuovo file in `api/` (monolite `api/index.ts`, gotcha
  §1). Nessuna dipendenza nuova.
- **CON-002**: bodyParser resta `4mb` (già sufficiente). Il collo di
  bottiglia è il clamp, non il body.
- **CON-003**: il clamp 1.5MB vale SOLO per flyer-hero e logo-background.
  card-cover/card-photo/icon restano 500KB.
- **CON-004**: la risoluzione generata non deve mai superare la persistenza
  in modo da perdere il gain: 2K generato → 1536 salvato (compromesso quota
  localStorage ~5MB), 1K generato → 1024 salvato.

### Guidelines

- **GUD-001**: nessun upscale lato client: `compressDataUrl` mantiene
  `Math.min(1, ...)` (solo downscale).
- **GUD-002**: aggiornare `docs/agent-gotchas.md` §2-3 (tabella
  per-endpoint, Lite solo 1K, nota `'256'`/`'3:1'` invalidi, PNG alpha
  preservato) e `docs/to-be-done.md` task #2 (fix generazione+storage fatto,
  residuo verifica Playwright) — stesso commit dell'implementazione.

## 4. Interfaces & Data Contracts

### Payload `image_config` (SDK `@google/genai`, client e server)

```ts
generation_config: {
  image_config: {
    image_size: '1K' | '2K',           // per-endpoint; Lite sempre '1K'
    aspect_ratio: '16:9' | '1:1' | '3:2' | ...,   // per-endpoint
    imageOutputOptions: {               // SDK; REST: image_output_options
      mimeType: 'image/jpeg',
      compressionQuality: 85,
    },
  },
},
response_modalities: ['text', 'image'],
```

### Mapping endpoint → config

| Endpoint | aspect_ratio | image_size | notes |
|----------|-------------|------------|-------|
| `/api/ai/card-cover` | `1:1` | `1K` | reference: cardImage/logoImage |
| `/api/ai/card-photo` | `3:4` | `1K` | nessuna reference |
| `/api/ai/flyer-hero` | `3:2` (default, da body) | `2K` | reference: flyerImage |
| `/api/ai/logo-background` | `16:9` | `2K` | reference: logoImage/previousBackground |
| `/api/ai/image-flash` | `1:1`/`16:9` (da body) | `1K` (default, `512`/`1K` da body) | nessuna reference |

### Zod enum modello immagini (4 endpoint)

```ts
z.enum(['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image', 'gemini-2.0-flash-preview-image-generation']).optional()
```

### Modello Lite — pricingId

```ts
// REQ-LITE-003, unica mappatura:
// 'gemini-3.1-flash-lite-image' → 'gemini-nano-banana-lite'  ($0.02)
// 'gemini-2.0-flash-preview-image-generation' → 'gemini-flash-image'  ($0.02)
// altro → 'gemini-nano-banana'  ($0.04)
```

## 5. Acceptance Criteria

- **AC-001**: Given richiesta a `/api/ai/card-cover` (o card-photo),
  When generata, Then `image_config.image_size === '1K'` e
  `imageOutputOptions = { mimeType: 'image/jpeg', compressionQuality: 85 }`.
- **AC-002**: Given richiesta a `/api/ai/flyer-hero` (o logo-background),
  When generata, Then `image_config.image_size === '2K'`, clamp 1.5MB e
  timeout SDK 45s; immagine 1.2MB passa, >1.5MB → 413.
- **AC-003**: Given `imageModel: 'gemini-3.1-flash-lite-image'`, When
  qualunque endpoint genera, Then `image_config.image_size` è forzato a
  `'1K'` (anche flyer-hero/logo-background) e il modelId passa invariato
  (non normalizzato).
- **AC-004**: Given `size: '256'` o `aspectRatio: '3:1'` a
  `/api/ai/image-flash`, When validato, Then 400 con error di zod.
- **AC-005**: Given `imageModel: 'gemini-3.1-flash-lite-image'`, When
  selezione in UI (FlyerAiPanel, CardAICoverSection, CardAIIconHeroSection,
  LogoAiPanel, CustomerDetail), Then il modello compare in `AI_IMAGE_MODELS`
  con label e hint; il default resta `gemini-3.1-flash-image`.
- **AC-006**: Given generazione con modello Lite, When logging costi
  (useAILogo/useAIFlyer/useAutoBuildGenerate/useAIIconHero), Then
  `costUsd === 0.02` (via `calculateCostUsd` con pricingId
  `gemini-nano-banana-lite`).
- **AC-007**: Given un PNG con alpha > maxBytes passato a
  `compressDataUrl`, When compresso, Then l'output è PNG (alpha preservato),
  mai JPEG; dimensioni ≤ default 1024.
- **AC-008**: Given documento logo/flyer con `backgroundImage`/`heroImage`
  di 2000px, When salvato in locale, Then l'immagine persiste a ≤1536px
  (path-aware), le altre immagini card a ≤1024px.
- **AC-009**: Given auto-build con immagine >500KB, When retry
  `['1K','512']`, Then nessun 400 (size valida) e il primo tentativo 1K
  vince se passa il clamp.
- **AC-010**: Given dev proxy (`npm run dev`), When chiamato
  `/api/ai/flyer-hero`, Then il payload a Gemini usa `2K` + JPEG q85 (dev ==
  prod).

## 6. Test Automation Strategy

- **Framework**: Vitest + RTL + jsdom (repo standard). Mock di
  `interactions.create` via helper `api/__tests__/helpers/apiTest.ts`.
  Mai chiavi reali in CI.
- **Test Levels**: unit (provider, compress, pricing, hook), integration
  (endpoint API con mock SDK).
- **Aggiornamenti obbligatori** (test che rompono se il fix non c'è):

  | File | Cambio |
  |------|--------|
  | `src/ai/providers/__tests__/gemini.test.ts` | expect `image_size` 1K/2K per-uso + `imageOutputOptions`; nuovo: Lite → forzato 1K anche su background |
  | `src/ai/providers/__tests__/geminiFlashImage.test.ts` | 512 → 1K |
  | `api/__tests__/logoBackground.test.ts` | 2K + clamp 1.5MB (nuovo: 1.2MB passa, >1.5MB 413) |
  | `api/__tests__/flyerHero.test.ts` | 2K + clamp 1.5MB |
  | `api/__tests__/cardPhoto.test.ts` | 1K |
  | `api/__tests__/imageFlash.test.ts` | default 1K; nuovi: `size:'256'` → 400, `aspectRatio:'3:1'` → 400, Lite pass-through non normalizzato |
  | `src/utils/card/__tests__/imageCompress.test.ts` | default 1024/400K; nuovo: PNG grande → downscale preserva alpha (mai JPEG) |
  | `src/utils/card/__tests__/saveCompression.test.ts` | 1024/400K |
  | `src/utils/__tests__/dataService.documents.test.ts` | mock params |
  | `src/hooks/__tests__/useAIIconHero.test.tsx` | `size: '1K'` in payload; costUsd per-modello |
  | `src/hooks/__tests__/useAutoBuildGenerate.test.ts` | retry `['1K','512']`; params 1536/400K |
  | `src/ai/__tests__/providerPricing.test.ts` | Lite `$0.02` |

- **Nuovi test richiesti**: Lite forced-1K (provider), normalize Lite (api),
  zod reject 256/3:1 (api), clamp 1.5MB (api).
- **Coverage**: 60% minimo nuovi file; nessun `.skip`/`xit`.
- **Gate pre-push**: `npm run typecheck && npm run test` verdi (checklist
  pre-push AGENTS.md). Verifica live qualità (chiave Gemini reale) manuale,
  fuori CI.

## 7. Rationale & Context

- **Perché per-endpoint e non 2K ovunque**: card-cover/photo sono croppate
  su 1004×650 @300dpi (1K basta, +25% margine); flyer hero A4 richiede
  2362×1358 (2K ~46% del necessario, accettato per hero fotografico);
  logo-background esportato fino a 2048 (2K = 100%). 4K ovunque supererebbe
  clamp e storage senza beneficio visivo proporzionale.
- **Perché JPEG q85**: PNG 2K = 2-4MB (supera clamp 1.5MB); JPEG 2K q85 ≈
  400-900KB. Perdita visiva trascurabile su asset fotografici/decorativi.
  Le icone con alpha restano PNG via `removeWhiteBackground`/upload utente.
- **Perché 1536 e non 2048 per background/hero in persistenza**: quota
  localStorage ~5MB; 1536 conserva ~75% del 2K generato. Export PNG flyer
  da 1536 ≈ 1.66× upscale (accettato), logo 2048 ≈ 1.33×.
- **Perché Lite forzato a 1K**: docs Google — Lite supporta solo 1K; chiedere
  2K a Lite fallirebbe o verrebbe ignorato.
- **Perché `'3:1'`/`'256'` fuori zod**: `'3:1'` non è tra gli aspect ratio
  supportati (docs Gemini 3.1); `'256'` non è un `image_size` valido
  (`512`/`1K`/`2K`/`4K`). `useAutoBuildGenerate.ts:219` invia `'256'`,
  zod `z.enum(['512','1K'])` lo rifiuta → 400 nel retry loop → retry sempre
  fallito. Root cause: il retry usa un size non validato; fix = retry con
  size validi (`['1K','512']`).
- **Riferimento docs Google**: https://ai.google.dev/gemini-api/docs/image-generation
  (risoluzioni `512`/`1K`/`2K`/`4K` per gemini-3.1-flash-image; Lite solo
  `1K`; aspect ratio 1:1, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9;
  `image_output_options` per formato/qualità; thinking abilitato di default
  e fatturato).

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: Gemini API (Google) — generazione immagini via
  `interactions.create`, modello `gemini-3.1-flash-image` e
  `gemini-3.1-flash-lite-image`. Richiede `image_size` con `K` maiuscola
  (es. `1K`); `image_size` minuscolo (`1k`) rifiutato.

### Third-Party Services
- **SVC-001**: Gemini Image API — SLA: latenza 2K ~20-45s (timeout SDK 45s
  sugli endpoint 2K); quota gestita da rate limit esistenti (5/min per IP
  su card/hero/bg, 10/min su image-flash).

### Infrastructure Dependencies
- **INF-001**: Vercel Serverless Function (`api/index.ts`) — bodyParser
  `4mb` (invariato). Nessun nuovo file in `api/` (gotcha §1).

### Data Dependencies
- **DAT-001**: `documents.data` jsonb (Drizzle) — nessuna migrazione;
  immagini persistite come data URL base64 nei campi esistenti
  (`coverImageUrl`, `backgroundImage`, `heroImage`, ecc.).

### Technology Platform Dependencies
- **PLT-001**: `@google/genai` ≥ 2.10 (installed: 2.10.0) — supporta
  `image_config.image_size` `512`/`1K`/`2K`/`4K` e `imageOutputOptions`.
  Nessuna nuova dipendenza.

### Compliance Dependencies
- **COM-001**: nessuna. Le immagini generate includono filigrana SynthID
  lato Google (invariato).

## 9. Examples & Edge Cases

```ts
// Edge case: Lite forzato a 1K anche dove il default sarebbe 2K
// api/index.ts, endpoint /ai/flyer-hero:
const imageSize = normalizeGeminiImageModel(v.data.imageModel) === 'gemini-3.1-flash-lite-image'
  ? '1K'
  : '2K';
const interaction = await ai.interactions.create({
  model: normalizeGeminiImageModel(v.data.imageModel),
  input,
  generation_config: {
    image_config: {
      image_size: imageSize,
      aspect_ratio: v.data.aspectRatio ?? '3:2',
      image_output_options: { mime_type: 'image/jpeg', compression_quality: 85 },
    },
  },
  response_modalities: ['text', 'image'],
}, { timeout: 45_000 });
```

```ts
// Edge case: PNG alpha preservato (REQ-PERS-002) — mai fallback JPEG
// src/utils/card/imageCompress.ts, branch isPng di compressDataUrl:
let canvas = downscale(canvas, img, 0.85);          // loop iterativo
let out = canvas.toDataURL('image/png');
while (out.length > maxChars && Math.min(canvas.width, canvas.height) > 200) {
  canvas = downscale(canvas, img, 0.85);
  out = canvas.toDataURL('image/png');
}
return out;   // PNG, alpha intatto; nessun canvas.toDataURL('image/jpeg')
```

```ts
// Edge case: retry auto-build (REQ-PERS-006) — '256' rimosso
const sizes = ['1K', '512'] as const;   // prima: ['512', '256'] → 400 silenzioso
```

Note: nel payload REST (`/v1beta/interactions`), i campi sono snake_case
(`image_output_options: { mime_type, compression_quality }`); nell'SDK
TypeScript `@google/genai` sono camelCase (`imageOutputOptions:
{ mimeType, compressionQuality }`). L'implementazione deve usare la forma
accettata dall'SDK (`interactions.create`), mai il payload REST diretto.

## 10. Validation Criteria

1. `npm run typecheck && npm run test` verdi (tutti i test aggiornati +
   nuovi, §6).
2. Verifica manuale live (chiave Gemini reale):
   - card cover e photo a 1K: nessun pixel visibile su preview desktop e
     export PDF 300dpi.
   - flyer A4 hero e logo background a 2K: nitidezza accettabile su export
     PNG 300dpi (upscale ≤1.66×).
   - selezione Nano Banana 2 Lite in un editor: generazione 1K ok, costo
     loggato $0.02.
3. Icona con `background: 'transparent'`: output PNG con alpha intatto
   dopo save (nessun riquadro bianco).
4. Auto-build: retry immagine grande non produce 400.
5. `docs/agent-gotchas.md` §2-3 e `docs/to-be-done.md` task #2 aggiornati
   nello stesso commit.

## 11. Related Specifications / Further Reading

- Docs Google Gemini — image generation:
  https://ai.google.dev/gemini-api/docs/image-generation
- `docs/agent-gotchas.md` §2-3 (Gemini/`@google/genai`), §23 (storage locale
  FLAT), §25 (build zero-warning)
- `docs/to-be-done.md` task #2 (residuo: verifica Playwright densità px)
- `docs/spec/spec-api-saas-monetization.md` (tier watermark, DPI export)
