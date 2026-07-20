---
title: AI Harness Upgrade — Multi-Provider, Pattern Decorativi, RAG Clienti
version: 1.0
date_created: 2026-07-20
last_updated: 2026-07-20
owner: Quickbrand
tags: [design, ai, infrastructure, app]
---

# Introduction

Upgrade della harness AI di Quickbrand per ottenere design quality paragonabile
a biglietti da visita reali osservati sul mercato (wave organica blu/bianco,
icone stilizzate, layout editoriali, foto spostabili con drag). Lo scope
copre: multi-provider AI (Ollama Pro + MiniMax M3 multimodale + Gemini 2.0
Flash immagini), tracking costi reale, pattern decorativi riutilizzabili
(wave/blob/splash/full-overlay), drag mouse foto dentro riquadro card (solo
grid-mode), icone stilizzate AI per card+flyer, e RAG clienti (memoria
persistente dei clienti dell'utente per generare design coerenti col loro
brand storico).

## 1. Purpose & Scope

### 1.1 Purpose

Oggi Quickbrand usa DeepSeek + Gemini Nano Banana. L'AI produce JSON di
buona qualità ma il rendering è limitato ai layout fissi dell'app. Le 4
foto di biglietti reali mostrate dall'utente (Alice Cinofila con onda blu
e pecorella cartoon, Money360 con header editoriale, ASMS con sfondo full
blu e logo centrato) dimostrano che il mercato si aspetta pattern
decorativi organici che l'app oggi non sa generare né esporre.

### 1.2 Scope IN

- **Multi-provider AI**: DeepSeek V4 Pro (già), Ollama Pro cloud ($20/mo
  flat, 50x free usage), MiniMax M3 (multimodale nativo Text+Image,
  sostituto ufficiale di gemini-3-flash-preview su Ollama Cloud).
- **Pattern decorativi**: 5 pattern SVG selezionabili manualmente e via AI
  (wave-bottom, wave-split, blob-corner, splash-corners, full-overlay).
- **Drag mouse foto**: in card grid-mode, l'utente trascina la foto dentro
  la sua cella con coordinate `x/y/scale` normalizzate (-1..+1).
- **Icone stilizzate AI**: MiniMax M3 (multimodale) o Gemini 2.0 Flash
  immagini per generare icone flat 2-colori tipo frutta/oggetti/animali.
- **RAG clienti**: tabella Postgres `client_kb` per memorizzazione
  vectorizzata dei dati clienti dell'utente (nome, settore, palette
  storica, logo, card passate). L'AI consulta la KB prima di generare.
- **Tracking costi reale**: colonna `tokens_cost_usd` + pricing tabella
  hardcoded (Ollama Pro = $0/token perché flat $20/mo, DeepSeek pay-per-
  token, Gemini per-image).
- **A/B provider**: stesso prompt su 2 provider, confronto side-by-side.
- **Screenshot preview → AI**: MiniMax M3 legge screenshot della preview
  card/flyer (vision) oltre al JSON, per capire il rendering effettivo.

### 1.3 Scope OUT

- Self-hosted Ollama locale (usiamo solo Ollama Cloud API).
- Fine-tuning modelli (out of scope, costi proibitivi per fase bootstrap).
- RAG documentale interno (manuale, FAQ, ecc.) — solo RAG clienti.
- Generation AI per il logo (il logo builder SVG resta manuale + AI
  parametrica già esistente; background Gemini opzionale).
- Modifica dei layout flexbox card esistenti (drag solo in grid-mode).
- Multi-lingua UI (TB-015 è track separato).

### 1.4 Audience

Sviluppatori che estendono l'app; utente finale (free/pro) che usa card,
flyer e (in futuro) logo con più libertà creativa.

## 2. Definitions

| Termine | Definizione |
|---------|-------------|
| **AI Harness** | Insieme coordinato di provider AI, orchestratori, hook UI, tracking costi, logging. |
| **Ollama Pro** | Piano Ollama Cloud $20/mo, 50x free usage, 3 modelli concorrenti. Non per-token. |
| **MiniMax M3** | Modello cloud Ollama `minimax-m3:cloud`, multimodale nativo (Text+Image), 512K context, supporta tool calling, thinking, vision. Sostituto ufficiale di `gemini-3-flash-preview` (ritirato 15 luglio 2026). |
| **Gemini 2.0 Flash immagini** | `gemini-2.0-flash-preview-image-generation`, alternativa economica a Nano Banana 3.1 per icone/illustrazioni piccole. |
| **Pattern decorativo** | SVG generato programmaticamente (wave/blob/splash/full-overlay) renderizzato come layer sotto il contenuto di card/flyer. |
| **Drag foto** | Interazione pointer-driven in card grid-mode che sposta/scala la foto dentro la cella. Coordinate normalizzate -1..+1. |
| **RAG clienti** | Retrieval-Augmented Generation: prima di generare card/flyer, l'AI recupera dati storici del cliente (settore, palette, logo) da un vector store Postgres. |
| **Screenshot preview** | Render SVG/PNG della preview card/flyer inviato come immagine a MiniMax M3 oltre al JSON, per fare design feedback visivo. |
| **Provider Registry** | `src/ai/providers/registry.ts`, mappa `id → AIProvider`. Esteso con Ollama + MiniMax. |

## 3. Requirements, Constraints & Guidelines

### 3.1 Multi-Provider AI

- **REQ-MP-001**: Aggiungere `OllamaProProvider` (`src/ai/providers/ollamaPro.ts`)
  che estende `BaseAIProvider`. API URL `https://ollama.com/api/chat`, auth
  `Bearer $OLLAMA_API_KEY`. Body shape compatibile OpenAI/Ollama
  (`messages[]`, `model`, `stream`, `tools[]`, `format`).
- **REQ-MP-002**: Registrare 3 modelli Ollama nel `providerRegistry`:
  - `ollama-minimax-m3` (default per vision + copy lungo)
  - `ollama-deepseek-v4-pro` (fallback copy)
  - `ollama-qwen-3.5` (alternative economica per copy breve)
- **REQ-MP-003**: Aggiungere `GeminiFlashImageProvider`
  (`src/ai/providers/geminiFlashImage.ts`) per immagini economiche. Modello
  `gemini-2.0-flash-preview-image-generation`, `image_size: '512'`, aspect
  ratio configurabile. Endpoint `/api/ai/image-flash`.
- **REQ-MP-004**: Selector provider in `AIProviderBadge` — dropdown con
  lista provider disponibili, persistenza in `localStorage['pq_provider_default:v1']`.
- **REQ-MP-005**: Ogni orchestratore (card, flyer, logo, social, onboarding)
  legge il provider preferito e lo passa a `providerRegistry.getProvider(id)`.
  Fallback automatico al default se il provider preferito non è registrato.
- **REQ-MP-006**: Endpoint server-side `/api/ai/chat` esteso per instradare
  a Ollama Pro quando `body.provider === 'ollama'`. env var
  `OLLAMA_API_KEY` opzionale (se mancante, provider Ollama restituisce 503
  con messaggio chiaro "Configura OLLAMA_API_KEY").
- **CON-MP-001**: Nessuna chiave API mai nel bundle client. Tutte le
  chiamate Ollama passano per il proxy server-side come DeepSeek.
- **CON-MP-002**: Import statico di `ollama` (npm package) NON permesso
  in `api/index.ts` (stesso pattern di `@google/genai`: import dinamico
  dentro l'handler, vedi AGENTS.md gotcha #7).
- **GUD-MP-001**: Mappare `format: 'json'` di Ollama a `response_format:
  { type: 'json_object' }` di DeepSeek per parity nei prompt esistenti.

### 3.2 MiniMax M3 Multimodale (Vision + Screenshot)

- **REQ-MM-001**: Aggiungere metodo `chatWithImages(messages, images,
  options)` a `OllamaProProvider` che include array `images: [base64]` nei
  messaggi user (formato Ollama ChatMessage).
- **REQ-MM-002**: Aggiungere helper `buildCardScreenshot(card): Promise<{
  base64, mimeType }>` in `src/utils/card/screenshot.ts` che renderizza la
  card via `buildCardSvg` → canvas → PNG base64 (riesa pipeline esistente
  di `cardGenerator.ts`).
- **REQ-MM-003**: Idem `buildFlyerScreenshot(flyer)` in
  `src/utils/flyer/screenshot.ts`.
- **REQ-MM-004**: Nuovo hook `useAIDesignReview` che dato card/flyer:
  1. Genera screenshot
  2. Invia a MiniMax M3 con prompt "Analizza questo design. Suggerisci 3
     miglioramenti: palette, layout, decorazione, gerarchia visiva.
     Restituisci JSON con campi {suggestions: [{field, value, reason}]}"
  3. Mostra suggestions in `AIConsole` come quick-actions cliccabili
- **REQ-MM-005**: L'AI generativa (cardOrchestrator, flyerOrchestrator)
  può opzionalmente inviare screenshot + JSON a MiniMax M3 per "vision-
  grounded generation" (invece di solo-JSON). Toggle in UI "Vision AI".
- **CON-MM-001**: Screenshot > 500KB viene compresso a JPEG quality 0.7
  prima dell'invio (riusa `compressForAI` helper).
- **CON-MM-002**: Mai inviare screenshot a DeepSeek (non supporta vision).
  Routing automatico: se `vision=true`, usa MiniMax M3 o Gemini.

### 3.3 Tracking Costi Reale

- **REQ-TC-001**: Creare `src/ai/providerPricing.ts` con tabella costi:
  ```ts
  export const PRICING = {
    'deepseek-chat':       { input: 0.14,  output: 0.28,  unit: 'per_1m_tokens' },
    'deepseek-v4-pro':     { input: 0.55,  output: 2.19,  unit: 'per_1m_tokens' },
    'ollama-minimax-m3':   { input: 0,     output: 0,     unit: 'flat_20_month' },
    'ollama-deepseek-v4-pro': { input: 0,  output: 0,     unit: 'flat_20_month' },
    'ollama-qwen-3.5':     { input: 0,     output: 0,     unit: 'flat_20_month' },
    'gemini-nano-banana':  { input: 0,     output: 0,     unit: 'per_image', perImage: 0.04 },
    'gemini-flash-image':  { input: 0,     output: 0,     unit: 'per_image', perImage: 0.02 },
  } as const;
  ```
- **REQ-TC-002**: `BaseOrchestrator.trackUsage()` calcola `costUsd` da
  `PRICING[provider.model] * tokens / 1_000_000` e lo passa a
  `dataService.trackTokens(email, tokens, costUsd)`.
- **REQ-TC-003**: Migration `db/migrations/0027_token_cost.sql`:
  ```sql
  ALTER TABLE users ADD COLUMN IF NOT EXISTS tokens_cost_usd NUMERIC(10,6) DEFAULT 0;
  ```
- **REQ-TC-004**: `api/index.ts` endpoint `POST /users/tokens` esteso con
  campo opzionale `costUsd`. Backward compatibile (se assente, cost=0).
- **REQ-TC-005**: `AIProviderBadge` mostra costo ultima operazione
  (`$0.003`), hover → tooltip con breakdown 30gg per provider.
- **REQ-TC-006**: Nuovo endpoint admin `GET /users/cost-breakdown?
  adminEmail=admin@gmail.com&days=30` → ritorna array
  `[{email, provider, tokens, costUsd, date}]`.
- **CON-TC-001**: Ollama Pro è flat $20/mo. `costUsd` per chiamata Ollama
  è 0 nel tracking, ma l'admin vede il costo fisso mensile separatamente
  in dashboard (campo `ollama_pro_flat_monthly` in cost-breakdown).

### 3.4 Pattern Decorativi

- **REQ-PD-001**: Creare `src/utils/decorations/patterns.ts` con 5
  funzioni pure che ritornano `DecorationRender`:
  - `renderWaveBottom(w, h, color)` — onda organica full-width in basso
  - `renderWaveSplit(w, h, topColor, bottomColor)` — onda che divide card
    in 2 zone
  - `renderBlobCorner(w, h, color, corner)` — blob morbido in un angolo
  - `renderSplashCorners(w, h, color)` — linee/splash decorativi in
    angoli (stile Alice)
  - `renderFullOverlay(w, h, bgColor, opacity)` — sfondo pieno con overlay
    testo (stile Money360/ASMS)
- **REQ-PD-002**: Tipo `DecorationId = 'none' | 'wave-bottom' |
  'wave-split' | 'blob-corner' | 'splash-corners' | 'full-overlay'`.
- **REQ-PD-003**: Schema `card.style.decoration?` e `flyer.style.decoration?`:
  ```ts
  {
    id: DecorationId;
    color?: string;        // #RRGGBB
    secondaryColor?: string; // per wave-split
    opacity?: number;      // 0..1, default 1
    corner?: 'tl' | 'tr' | 'bl' | 'br'; // per blob-corner
  }
  ```
  Default `{ id: 'none' }`. Campi opzionali, no migration DB.
- **REQ-PD-004**: Componente `DecorationPicker.tsx` con 6 thumbnail SVG
  inline (80×50px) — click applica a `style.decoration`. Mostrato in
  `CardFormFields` (sezione "Decorazione") e `FlyerStyleFields`.
- **REQ-PD-005**: `CardPreview.tsx` render decoration come primo layer
  (z-index 0) prima del contenuto. `FlyerPreviewPanel` idem.
- **REQ-PD-006**: Export SVG/PNG/PDF card+flyer aggiornato per render
  decoration. `svgRenderer.ts` (card+flyer) inserisce decoration prima
  dei `<text>`/`<image>`.
- **REQ-PD-007**: AI impara a scegliere decoration. Estendere
  `cardAIOutputSchema` e `flyerAIOutputSchema` con campo `decoration`
  (stesso shape REQ-PD-003). Prompt v2 con esempi per settore:
  - food → wave-bottom + colori caldi
  - tech → blob-corner + blu/teal
  - education → splash-corners + tonalità soft
  - finance/legal → full-overlay + blu navy
  - wellness → wave-split + verde/bianco
- **REQ-PD-008**: Quick action chip in `AIConsole` per decoration:
  "Aggiungi onda", "Blob angolo", "Splash", "Full overlay", "Pulisci
  decorazione". Click invia prompt strutturato al provider.
- **CON-PD-001**: Pattern SVG non contengono testo, loghi, foto. Solo
  geometria pura (path, circle, rect, line).
- **CON-PD-002**: Pattern mai sovrascritti dal merge AI se l'utente li ha
  impostati manualmente (flag `decoration.userLocked: boolean`). L'AI
  può solo modificare se `userLocked === false`.

### 3.5 Drag Mouse Foto (Card Grid-Mode)

- **REQ-DF-001**: Schema `card.front.photoPlacement?`:
  ```ts
  {
    x: number;      // -1 = sinistra cella, 0 = centro, +1 = destra
    y: number;      // -1 = alto, 0 = centro, +1 = basso
    scale: number;  // 0.5 = mezza, 1 = 100%, 2 = 2x
  }
  ```
  Default `{x:0, y:0, scale:1}`.
- **REQ-DF-002**: Solo in grid-mode (`card.front.useGrid === true`). In
  flexbox-mode il placement è gestito dal layout (no drag).
- **REQ-DF-003**: `CardPreview.tsx` (sezione photo cell):
  - `onPointerDown` su `<img>` → avvia drag, salva start coords + start
    placement
  - `onPointerMove` (window listener) → calcola delta pixel, normalizza
    per dimensione cella → nuovo `{x, y}`
  - `onPointerUp` → rilascia, chiama `onPatch('front.photoPlacement', {x,y,scale})`
  - `wheel` su `<img>` → modifica `scale` (±0.1, range 0.5-2.0)
  - Touch: pointer events coprono già touch+mouse unificati
- **REQ-DF-004**: Container cella ha `overflow: hidden` per clippare la
  foto fuori dai bordi. La foto si muove in `transform: translate(x, y)
  scale(s)`.
- **REQ-DF-005**: `CardGridControls.tsx` (sezione photo selezionata):
  2 bottoni +/- per scale, display coordinate `{x, y, scale}`, bottone
  "Reset posizione".
- **REQ-DF-006**: Export SVG/PNG/PDF card applica `transform="translate
  (xPx, yPx) scale(s)"` all'elemento `<image>`.
- **CON-DF-001**: Drag non attivo quando `selectedGridElement !== 'photo'`.
- **CON-DF-002**: Drag disabilitato se `card.front.photoUrl` è vuoto.
- **GUD-DF-001**: Cursor `grab` su hover, `grabbing` durante drag.
- **GUD-DF-002**: Snap al centro (0,0) se delta < 0.05 (dead zone).

### 3.6 Icone Stilizzate AI

- **REQ-IS-001**: Creare `src/ai/iconOrchestrator.ts` con classe
  `IconAIOrchestrator extends BaseOrchestrator` e metodo
  `generateIcon(prompt, options: { primaryColor, secondaryColor, style }):
  Promise<{ base64, mimeType }>`.
- **REQ-IS-002**: Provider default `gemini-flash-image` (più economico
  per icone 256×256). Fallback `gemini-nano-banana` se flash non
  disponibile.
- **REQ-IS-003**: Prompt template:
  ```
  Stylized flat illustration of {subject}. Two colors only: {primaryColor}
  and {secondaryColor}. Transparent background. No text, no border, no
  gradients, no shadows. Simple geometric shapes. 256x256 px. Style:
  {style | 'minimalist'}.
  ```
- **REQ-IS-004**: UI "Genera icona AI" in `CardFormFields` sezione
  Media/Icona: bottone che apre modal con textarea prompt + selettore
  stile (minimalist, hand-drawn, geometric, pixel-art).
- **REQ-IS-005**: Schema `card.builder.iconUrl?` (base64) — alternativa
  a `iconGlyph` (lucide). Se `iconUrl` presente, viene renderizzato al
  posto dell'icona lucide.
- **REQ-IS-006**: UI "Illustrazione hero AI" in `FlyerAiPanel`: bottone
  che genera illustrazione flat 2-colori per l'hero del flyer (es.
  frutta stilizzata per food, persona per wellness, ecc.). Schema
  `flyer.style.heroIllustration?` (base64, alternativa a `heroImage`
  che è fotografico).
- **REQ-IS-007**: Preview prima di applicare. Click "Applica" copia
  base64 in campo schema.
- **CON-IS-001**: Icone AI mai sovrascrivono `photoUrl`/`logoUrl` (base64
  user-uploaded, vedi AGENTS.md cardMerge parity).
- **CON-IS-002**: Icone AI > 200KB vengono compresse a PNG 256×256.

### 3.7 RAG Clienti

- **REQ-RG-001**: Nuova tabella DB `client_kb` (migration
  `db/migrations/0028_client_kb.sql`):
  ```sql
  CREATE TABLE client_kb (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,         -- proprietario (utente Quickbrand)
    client_name TEXT NOT NULL,
    client_sector TEXT,
    client_palette JSONB,             -- {primary, secondary, accent}
    client_logo_url TEXT,             -- base64 logo
    client_brand_voice TEXT,          -- "formale", "giovane", "tecnico"
    client_notes TEXT,                -- note libere
    embedding VECTOR(768),            -- embedding di client_name+sector+notes
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX idx_client_kb_user ON client_kb(user_email);
  CREATE INDEX idx_client_kb_embedding ON client_kb USING ivfflat(embedding);
  ```
- **REQ-RG-002**: Endpoint `POST /api/clients` (auth required) per
  creare/aggiornare entry. Genera embedding via Ollama `nomic-embed-text`
  o fallback testo semplice se embeddings non disponibili.
- **REQ-RG-003**: Endpoint `GET /api/clients?q=...` ritorna top-5 clienti
  simili alla query (cosine similarity su embedding).
- **REQ-RG-004**: UI "I miei clienti" in Settings: lista clienti, form
  CRUD, "Importa da Google Form" (link a TB-019 intake pipeline).
- **REQ-RG-005**: Quando l'utente genera una card/flyer, l'orchestratore
  consulta RAG: dato il titolo del documento o un field "cliente",
  recupera top-3 clienti simili e include i loro dati nel system prompt
  ("Hai già lavorato con: {nome} ({settore}), palette storica: {colori},
  voice: {voice}. Mantieni coerenza col brand storico se pertinente").
- **REQ-RG-006**: Toggle UI "Usa RAG clienti" in AI Console. Default ON
  per utenti unlocked, OFF per free (costo embedding).
- **CON-RG-001**: Embeddings mai inviati a provider AI esterni. La
  similarity search avviene server-side in Postgres.
- **CON-RG-002**: Cliente può essere eliminato dall'utente (GDPR right to
  erasure). DELETE cascade anche su embedding.
- **CON-RG-003**: In locale (dev), RAG client usa localStorage con
  similarity search testo semplice (no embeddings). Stesso pattern di
  dataService `IS_LOCAL`.
- **GUD-RG-001**: Intake pipeline (TB-019) può scrivere direttamente in
  `client_kb` quando l'admin converte un intake in cliente. Spec TB-019
  resta separato, ma l'integrazione è documentata qui.

### 3.8 A/B Provider

- **REQ-AB-001**: AI Console: bottone "Confronta provider" (visibile se
  ≥2 provider registrati). Click → genera 2 risposte parallele con
  provider A e B, mostra side-by-side in modal.
- **REQ-AB-002**: Modal confronto: 2 colonne con preview JSON
  formattato + costo + latency. Click "Usa A" / "Usa B" per applicare.
- **REQ-AB-003**: Log entry `pq_ai_logs:v1` include `providerId` per
  tracciare quale provider ha prodotto quale risposta.

### 3.9 UI/UX (Design Taste)

- **REQ-UX-001**: `DecorationPicker` thumbnails: 6 card 80×50px con
  anteprima reale del pattern, non icone astratte. Hover → ingrandimento
  a 120×75. Palette neutra (zinc-100/zinc-900) per thumbnail, colori
  reali applicati solo su card.
- **REQ-UX-002**: `AIProviderBadge` dropdown: trigger è il badge
  esistente, click apre menu con lista provider + costo ultima chiamata
  + "Confronta provider". Chiusura click-outside + ESC.
- **REQ-UX-003**: Drag foto: cursor `grab`/`grabbing`. Durante drag,
  overlay coords in basso-destra cella (`x: 0.34, y: -0.12, s: 1.2`).
  Dead zone 0.05 per snap-centro.
- **REQ-UX-004**: Modal "Genera icona AI": layout 2-col (form sx, preview
  dx), preview 256×256 su sfondo checkerboard (trasparenza), 3 esempi
  generati in parallelo (come concept card logo), click per selezionare.
- **REQ-UX-005**: Sezione "I miei clienti" in Settings: lista card con
  nome + settore + palette swatch. Click → editor. Form CRUD con
  validazione Zod.
- **REQ-UX-006**: Costo tooltip `AIProviderBadge`: popover con breakdown
  30gg (bar chart mini per giorno, stacked per provider). Hover ≥300ms
  per attivare.
- **REQ-UX-007**: Toggle "Vision AI" in AI Console: switch con icona
  occhio, tooltip "Invia screenshot della preview all'AI per feedback
  visivo". Default OFF (costo extra).
- **REQ-UX-008**: Toggle "Usa RAG clienti" in AI Console: switch con
  icona database, tooltip "Consulta lo storico dei tuoi clienti per
  design coerente". Default ON per unlocked.
- **CON-UX-001**: Tutti i nuovi toggle usano `pq_ui:v1` per persistenza
  (`visionAi`, `ragClients`).
- **CON-UX-002**: Nessun emoji nei nuovi componenti. Icone Phosphor o
  Lucide (progetto già usa Lucide).

## 4. Interfaces & Data Contracts

### 4.1 OllamaProProvider

```ts
// src/ai/providers/ollamaPro.ts
export class OllamaProProvider extends BaseAIProvider {
  readonly name = 'Ollama';
  readonly model: string;
  readonly supportsStreaming = true;
  readonly supportsTools = true;
  readonly supportsVision: boolean; // true per minimax-m3

  constructor(model = 'minimax-m3:cloud');

  chat(messages, options?): Promise<AIResponse>;
  stream(messages, options?): AsyncGenerator<AIStreamChunk>;
  chatWithImages(messages, images: string[], options?): Promise<AIResponse>;
}
```

### 4.2 GeminiFlashImageProvider

```ts
// src/ai/providers/geminiFlashImage.ts
export class GeminiFlashImageProvider {
  async generateImage(prompt: string, options: {
    aspectRatio?: '1:1' | '3:1' | '16:9';
    size?: '512' | '1K';
  }): Promise<{ base64: string; mimeType: string }>;
}
```

### 4.3 Endpoint API nuovi

| Method | Path | Body | Auth | Descrizione |
|--------|------|------|------|-------------|
| POST | `/api/ai/chat` | `{provider, model, messages, tools, format, requestId}` | user | Esteso per instradare a Ollama |
| POST | `/api/ai/image-flash` | `{prompt, aspectRatio, size, requestId}` | user | Immagini Gemini Flash |
| POST | `/api/ai/design-review` | `{docType, docJson, screenshotBase64, requestId}` | user | Vision feedback MiniMax M3 |
| GET | `/api/clients?q=...` | — | user | RAG search clienti |
| POST | `/api/clients` | `{clientName, sector, palette, logoUrl, brandVoice, notes}` | user | Create/update cliente |
| DELETE | `/api/clients/:id` | — | user | Delete cliente |
| GET | `/users/cost-breakdown?days=30` | — | admin | Costi aggregati |

### 4.4 Schema estensioni

```ts
// card.style.decoration (opzionale)
decoration?: {
  id: 'none' | 'wave-bottom' | 'wave-split' | 'blob-corner' | 'splash-corners' | 'full-overlay';
  color?: string;
  secondaryColor?: string;
  opacity?: number;
  corner?: 'tl' | 'tr' | 'bl' | 'br';
  userLocked?: boolean;
};

// card.front.photoPlacement (opzionale, solo grid-mode)
photoPlacement?: { x: number; y: number; scale: number };

// card.builder.iconUrl (opzionale, base64)
iconUrl?: string;

// flyer.style.decoration (opzionale, stesso shape card)
// flyer.style.heroIllustration (opzionale, base64)
heroIllustration?: string;
```

## 5. Acceptance Criteria

- **AC-MP-001**: Given `OLLAMA_API_KEY` env var settata, When l'utente
  seleziona provider `ollama-minimax-m3` in AI Console, Then la chiamata
  passa per `/api/ai/chat` con `provider: 'ollama'` e ritorna risposta
  valida entro 30s.
- **AC-MP-002**: Given `OLLAMA_API_KEY` mancante, When l'utente seleziona
  provider Ollama, Then l'endpoint ritorna 503 con body
  `{"error":"Configura OLLAMA_API_KEY nelle variabili d'ambiente"}`.
- **AC-MM-001**: Given card con foto e testo, When l'utente attiva
  "Vision AI" e invia prompt "Migliora gerarchia visiva", Then
  MiniMax M3 riceve screenshot + JSON e ritorna 3 suggestions
  cliccabili.
- **AC-TC-001**: Given 1000 token DeepSeek-chat (600 input + 400 output),
  When trackUsage esegue, Then `tokens_cost_usd` incrementa di
  `(600*0.14 + 400*0.28) / 1_000_000 = 0.000196` USD.
- **AC-TC-002**: Given 1000 token Ollama Pro, When trackUsage esegue,
  Then `tokens_cost_usd` non cambia (flat $20/mo) ma
  `tokens_used` incrementa.
- **AC-PD-001**: Given card con `decoration = {id: 'wave-bottom', color:
  '#01696F'}`, When preview render o export SVG, Then l'SVG contiene un
  `<path>` wave in basso con fill `#01696F` dietro al contenuto.
- **AC-PD-002**: Given AI genera card per settore "food", Then
  `decoration.id` è `'wave-bottom'` con colori caldi (es. `#E62020`).
- **AC-DF-001**: Given card grid-mode con `photoUrl` impostato, When
  utente drag la foto di 50px a destra in cella 200px, Then
  `photoPlacement.x = 0.5` e l'export PNG mostra la foto spostata.
- **AC-DF-002**: Given `card.front.useGrid === false`, Then drag foto
  è disabilitato (cursor default, no pointer events).
- **AC-IS-001**: Given prompt "mela stilizzata" con colori `#E62020` +
  `#1A1A1A`, When `iconOrchestrator.generateIcon()` esegue, Then ritorna
  base64 PNG 256×256 con mela flat 2-colori.
- **AC-RG-001**: Given utente con 3 clienti in KB (2 ristoranti, 1 B&B),
  When genera card con titolo "Pizzeria da Luigi", Then il system prompt
  include "Hai già lavorato con: [Ristorante X], [Ristorante Y]" con
  palette storiche.
- **AC-RG-002**: Given utente elimina cliente "Mario Rossi", Then
  `DELETE /api/clients/:id` rimuove row + embedding (GDPR).
- **AC-AB-001**: Given 2 provider registrati, When utente click "Confronta
  provider", Then modal mostra 2 risposte side-by-side con costo+latency.

## 6. Test Automation Strategy

### 6.1 Unit Test

- `src/ai/providers/__tests__/ollamaPro.test.ts` — happy path, 401, 429,
  parse SSE, tool calls, vision (images nel body).
- `src/ai/providers/__tests__/geminiFlashImage.test.ts` — prompt + size
  + aspect ratio + 413 clamp.
- `src/ai/__tests__/providerPricing.test.ts` — formula cost DeepSeek,
  Ollama flat=0, Gemini per-image.
- `src/ai/__tests__/BaseOrchestrator.cost.test.ts` — trackUsage scrive
  cost corretto per ogni provider.
- `src/utils/decorations/__tests__/patterns.test.ts` — ogni funzione
  ritorna SVG valido (parse OK), bbox corretto, niente XSS.
- `src/utils/card/__tests__/screenshot.test.ts` — buildCardScreenshot
  ritorna base64 PNG.
- `src/utils/flyer/__tests__/screenshot.test.ts` — idem flyer.
- `src/ai/__tests__/iconOrchestrator.test.ts` — prompt + mock Gemini +
  parse base64.
- `src/ai/__tests__/cardOrchestrator.decoration.test.ts` — schema
  decoration valido/invalido.
- `src/ai/__tests__/flyerOrchestrator.decoration.test.ts` — idem.
- `src/components/__tests__/DecorationPicker.test.tsx` — 6 thumbnail,
  click applica.
- `src/components/__tests__/AIProviderBadge.dropdown.test.tsx` —
  dropdown apertura/chiusura, lista provider.
- `src/components/card/__tests__/CardPreview.photoDrag.test.tsx` —
  pointerdown/move/up simula drag, verifica onPatch.
- `src/components/__tests__/CardGridControls.photo.test.tsx` — bottoni
  +/- scale, reset posizione.
- `src/components/__tests__/ClientList.test.tsx` — lista, CRUD form.
- `src/hooks/__tests__/useAIDesignReview.test.ts` — screenshot + mock
  MiniMax + suggestions.
- `api/__tests__/ollamaChat.test.ts` — endpoint /api/ai/chat con
  provider=ollama, mock fetch Ollama.
- `api/__tests__/imageFlash.test.ts` — endpoint /api/ai/image-flash.
- `api/__tests__/designReview.test.ts` — endpoint /api/ai/design-review.
- `api/__tests__/clients.test.ts` — CRUD + RAG search.

### 6.2 Integration / E2E

- `e2e/card-decoration-wave.spec.ts` — applica onda, verifica export SVG
  contiene path wave.
- `e2e/card-photo-drag.spec.ts` — drag foto, salva, ricarica, verifica
  posizione persistita.
- `e2e/flyer-decoration-blob.spec.ts` — applica blob, export PDF.
- `e2e/logo-provider-switch.spec.ts` — switch provider da UI.
- `e2e/card-vision-review.spec.ts` — vision AI suggerisce 3 miglioramenti.
- `e2e/card-icon-ai.spec.ts` — genera icona AI, applica, export.
- `e2e/clients-crud.spec.ts` — crea cliente, genera card con RAG.

### 6.3 Coverage

Target 60% su nuovi file. Files sotto soglia motivati con commento.

## 7. Rationale & Context

### 7.1 Perché Ollama Pro invece di OpenAI/Anthropic

- **Costo**: $20/mo flat vs ~$0.15/1M token GPT-4o mini. A volume
  (100+ clienti/mese), Ollama Pro è 10x più economico.
- **Multi-modale nativo**: MiniMax M3 supporta Text+Image in un unico
  modello, niente switch provider per vision.
- **Privacy**: Ollama Cloud ha zero data retention policy
  (partnership NVIDIA Cloud Providers).
- **API compatibile**: Ollama API è simile a OpenAI, adapter semplice.

### 7.2 Perché MiniMax M3 come default Ollama

- Raccomandato ufficialmente da Ollama come sostituto di
  `gemini-3-flash-preview` (ritirato 15 luglio 2026).
- Multimodale nativo (Text+Image), 512K context, supporta tool calling.
- Benchmark coding/agentic top-tier (BrowesComp 83.5, supera Opus 4.7).
- US-based, zero data retention.

### 7.3 Perché RAG clienti

- L'utente genera multiple card/flyer per lo stesso cliente nel tempo.
  Senza RAG, ogni generazione parte da zero → incoerenza brand.
- RAG recupera palette/storico prima di generare → coerenza.
- Integrazione con TB-019 (intake Google Form): i brief diventano clienti
  automaticamente quando l'admin converte.
- Vector store in Postgres (pgvector) è gratis, niente servizio esterno.

### 7.4 Perché pattern decorativi come layer SVG

- Card/flyer usano già SVG per export. Aggiungere un layer decoration è
  un cambiamento minimo, non richiede refactor layout engine.
- Pattern programmatici (path Bézier) sono deterministici e leggeri
  (vs background AI che pesa 100-500KB base64).
- Logo resta separato: il logo builder ha già i suoi `decorativeElements`
  (underline/dotRing/topAccent) che sono più piccoli e specifici. I
  pattern decorativi di questa spec sono per card/flyer.

### 7.5 Perché drag foto solo in grid-mode

- Grid-mode ha già `selectedGridElement` + cella definita.
- Flexbox-mode non ha concetto di "cella foto", la foto è inline nel
  layout (es. `photo-circle`).
- Drag in flexbox richiederebbe redesign del layout flex → out of scope.

### 7.6 Perché screenshot preview → AI

- L'AI oggi vede solo JSON, non il rendering. Non sa se il testo overflow
  o se la palette è bilanciata.
- MiniMax M3 multimodale può analizzare il rendering effettivo e
  suggerire miglioramenti che il JSON-only non coglie.
- Costo extra (1 chiamata vision per review) ma opzionale (toggle).

## 8. Dependencies & External Integrations

### External Systems

- **EXT-001**: Ollama Cloud API (`https://ollama.com/api`) — chat +
  vision + embeddings. Richiede `OLLAMA_API_KEY` env var.
- **EXT-002**: Google Gemini API (`@google/genai`) — già integrata per
  Nano Banana, estesa per 2.0 Flash immagini.
- **EXT-003**: Neon Postgres con estensione `pgvector` — per RAG
  clienti. Verificare disponibilità su Neon free tier (sì, pgvector
  supportato).

### Third-Party Services

- **SVC-001**: Ollama Pro subscription ($20/mo) — flat, non per-token.
- **SVC-002**: DeepSeek API — pay-per-token, già integrato.

### Infrastructure Dependencies

- **INF-001**: Vercel Hobby plan — 1 funzione serverless monolite, env
  vars `OLLAMA_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`,
  `DATABASE_URL` (già presenti tranne `OLLAMA_API_KEY`).
- **INF-002**: Neon Postgres free tier + pgvector.

### Data Dependencies

- **DAT-001**: Tabella `client_kb` (nuova) + embeddings.
- **DAT-002**: Colonna `users.tokens_cost_usd` (nuova).

### Technology Platform Dependencies

- **PLT-001**: `ollama` npm package (opzionale, possiamo usare fetch
  diretta per parity con DeepSeek). Consigliato fetch diretta per
  evitare dipendenze ESM-only in `api/index.ts` (stesso pattern
  `@google/genai`).
- **PLT-002**: `@google/genai` già installato.

### Compliance Dependencies

- **COM-001**: GDPR right to erasure — `DELETE /api/clients/:id` deve
  rimuovere row + embedding. Testato in `clients.test.ts`.
- **COM-002**: Ollama Cloud zero data retention (partnership NVIDIA NCPs,
  no logging, no training) — documentato in Ollama privacy policy.

## 9. Examples & Edge Cases

### 9.1 Ollama chat call

```ts
// Proxy server-side in api/index.ts
const ollamaRes = await fetch('https://ollama.com/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OLLAMA_API_KEY}`,
  },
  body: JSON.stringify({
    model: 'minimax-m3:cloud',
    messages: [{ role: 'user', content: 'Ciao' }],
    stream: false,
    format: 'json',
  }),
});
const data = await ollamaRes.json();
// data.message.content, data.prompt_eval_count, data.eval_count
```

### 9.2 Vision call (MiniMax M3)

```ts
// Client-side via orchestrator
const screenshot = await buildCardScreenshot(card);
const response = await ollamaProvider.chatWithImages(
  [
    { role: 'system', content: 'Sei un graphic designer AI.' },
    { role: 'user', content: 'Analizza questo design e suggerisci 3 miglioramenti.' },
  ],
  [screenshot.base64],
  { format: 'json' }
);
```

### 9.3 Pattern wave-bottom SVG

```svg
<!-- renderWaveBottom(400, 240, '#01696F') -->
<path d="M 0 180 Q 100 140 200 180 T 400 180 L 400 240 L 0 240 Z"
      fill="#01696F" />
```

### 9.4 Photo placement transform

```svg
<!-- photoPlacement = {x: 0.5, y: -0.3, scale: 1.2} -->
<g transform="translate(50, -30) scale(1.2)">
  <image href="data:image/png;base64,..." x="0" y="0" width="200" height="200" />
</g>
```

### 9.5 Edge case: Ollama Pro quota superata

Ollama Pro ha limiti per sessione (5h) e settimanali (7d). Se superati,
l'API ritorna 429 con message "quota exceeded". Il provider deve:

1. Mappare 429 a error message user-friendly: "Quota Ollama Pro
   superato. Riprova tra X ore o passa a DeepSeek."
2. Suggerire fallback automatico a DeepSeek (toggle "Auto-fallback"
   in AI Console, default ON).

### 9.6 Edge case: RAG clienti vuoto

Se l'utente non ha clienti in KB, l'orchestratore salta la RAG phase e
usa il prompt base. Nessun errore, solo log info "RAG: no clients found,
proceeding without context".

### 9.7 Edge case: Screenshot > 500KB

`compressForAI` già esistente (card/flyer) comprime a JPEG q0.7. Se
ancora > 500KB, downscale a 800×600. Mai inviare screenshot > 1MB a
MiniMax M3 (context limit 512K token, ma costi GPU-time crescono).

## 10. Validation Criteria

- Tutti i REQ coperti da almeno 1 test.
- `npm run typecheck` verde.
- `npm run test` verde.
- Migration DB applicata senza errori su Neon.
- Manuale: generare card per 3 settori (food/tech/wellness), verificare
  che l'AI scelga decoration coerente col settore.
- Manuale: drag foto in grid-mode, salvare, ricaricare, verificare
  posizione persistita.
- Manuale: creare 3 clienti in "I miei clienti", generare card con
  RAG attivo, verificare coerenza palette.
- Manuale: confronto A/B DeepSeek vs MiniMax M3 su stesso prompt.
- Manuale: vision review card con foto, verificare 3 suggestions
  cliccabili.

## 11. Related Specifications / Further Reading

- `spec-design-flyer-refactor-preview-ai.md` — flyer engine esistente
- `spec-intake-pipeline.md` — TB-019 intake Google Form, integrazione
  RAG clienti (REQ-RG-001 + GUD-RG-001)
- `spec-api-saas-monetization.md` — Stripe, track futuro
- `doc/to-be-done.md` — TB-023 aggiornato con riferimento a questa spec
- `AGENTS.md` — gotcha `@google/genai` import dinamico (applicabile a
  `ollama` package se usato)
- Ollama Cloud docs: https://docs.ollama.com/cloud
- MiniMax M3: https://ollama.com/library/minimax-m3
- Ollama pricing: https://www.ollama.com/pricing
- Neon pgvector: https://neon.tech/docs/extensions/pgvector