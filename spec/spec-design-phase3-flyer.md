---
title: Phase 3 — Volantino con 4 layout e AI copy
version: 1.1
date_created: 2026-06-21
date_implemented: 2026-07-01
owner: Giovanni Cidu
tags: [design, flyer, pdf, print, ai-copy, deepseek, layout-presets, watermark, implemented]
status: done
---

# Status: implemented (v1.1)

La fase 3 è stata implementata in commit dedicato (vedi AGENTS.md
"Phase 3 (Volantino) - implementata" per il changelog completo).
La spec originale resta valida come riferimento di intenti e
acceptance criteria. Modifiche di rilievo rispetto alla spec
originaria:

- **AI endpoint**: la spec suggeriva `src/ai/index.ts` come pattern
  di esposizione (vedi `useAI`). L'implementazione reale mette
  l'endpoint `POST /ai/copy-flyer` direttamente in `api/index.ts` per
  uniformarsi a `/ai/chat` (già server-side) e ridurre il bundle
  client. Il client usa `providerRegistry` come per la card.
- **Orchestrator dedicato**: la spec nota finale suggerisce
  `FlyerAIOrchestrator` con `useAIFlyer` (no tools, JSON round-trip).
  Implementato esattamente così.
- **Watermark**: la fase 5 (tier system) è già rilasciata, quindi la
  spec REQ-009/010 "tier-aware watermark" è coperta da
  `applyWatermarkToPdf` / `applyWatermarkToCanvas` (vedi
  `src/utils/watermark.ts`).

Tutti i 13 acceptance criteria (AC-001 → AC-013) sono coperti dai
test in `src/utils/__tests__/documentSchemas.test.ts`,
`src/utils/__tests__/flyerGenerator.test.ts`,
`src/ai/prompts/__tests__/flyerSystem.test.ts`,
`src/ai/__tests__/flyerOrchestrator.test.ts`,
`src/components/__tests__/FlyerEditor.test.tsx`,
`src/pages/__tests__/FlyerPage.test.tsx`,
`api/__tests__/copyFlyer.test.ts` e dal update
`api/__tests__/documents.test.ts` ("POST /documents with flyer
returns 201 (phase 3)").

# Introduction

La fase 3 introduce il volantino (flyer), il primo documento che usa AI
per generare testo. L'utente scrive un brief ("Sagra del paese, 15
agosto, cibo tipico, ingresso gratis") e l'AI DeepSeek produce
`{headline, subheadline, body, cta}` che l'utente può riffinare
manualmente. 4 layout predefiniti (classic, centered, split, magazine)
su 5 formati (A6, A5, A4, Letter, Square) danno flessibilità senza
richiedere drag-and-drop.

L'AI copy è un nuovo endpoint interno `/ai/copy-flyer` che riusa
DeepSeek già configurato. Nessun costo AI nuovo (DeepSeek €0.14/M token,
un volantino = ~2000 token = €0.0003). Per utenti free il bottone AI
è disabilitato (vedi fase 5), in questa fase è sempre attivo.

## 1. Purpose & Scope

**Purpose**: permettere all'utente di comporre un volantino
professionale con AI copy generation, 4 layout predefiniti, export PDF
stampa-ready con bleed 3mm.

**Scope**:
- Estensione `src/utils/documentSchemas.ts` con `flyerSchema` + helper
  `createEmptyFlyer()`, `createFlyerTemplate(settore)`
- Nuovo file `src/utils/flyerGenerator.ts` con `generateFlyerPDF(flyer,
  { tier })`, `generateFlyerPng(flyer, { tier })`
- Nuovo file `src/ai/prompts/flyerCopy.ts` con `buildFlyerCopyPrompt(brief,
  tone)` (puro, testabile)
- Estensione `src/ai/index.ts` con nuovo metodo `generateFlyerCopy(brief,
  tone)` che chiama DeepSeek con `response_format: json_object`
- Nuovo endpoint `POST /ai/copy-flyer` in `api/index.ts` (inline, ~30
  righe)
- Nuovo componente `src/components/FlyerEditor.tsx` con layout
  switcher + form + AI copy button + preview
- Estensione `src/components/Layout.tsx`: nuova voce sidebar "Volantini"
- Estensione `App.tsx`: view state `'flyer'`

**Out of scope**:
- AI image generation per hero image — l'utente carica una foto, non la
  genera. Out of scope v2 con Replicate.
- Editor drag-and-drop — solo 4 preset fissi.
- Stampa diretta (Stampaprint API) — out of scope v2.
- Tier system e watermark — fase 5.
- Modifica del `CollectionView` — fase 6.

**Intended audience**: sviluppatore che implementa il volantino + AI
copy; reviewer che verifica i test e il PDF.

**Assumptions**:
- `DEEPSEEK_API_KEY` è configurata su Vercel (già necessaria per i
  preventivi).
- `qrGenerator.ts` è disponibile per il QR opzionale nel volantino.
- Upload hero image riusa `compressImage` della fase 2.

## 2. Definitions

- **Flyer**: documento `documentType='flyer'` con `size`, `orientation`,
  `content`, `style`.
- **Layout preset**: 4 layout fissi:
  - `classic`: hero image 60% in alto, headline sotto, body, CTA
  - `centered`: tipografico, tutto centrato, hero opzionale piccolo in cima
  - `split`: 50/50 immagine vs testo (orizzontale o verticale)
  - `magazine`: griglia 3-colonne, multi-block body
- **Size preset**: 5 formati: `A6` (105×148mm), `A5` (148×210mm),
  `A4` (210×297mm), `Letter` (216×279mm), `Square` (210×210mm).
- **AI copy**: generazione di `{headline, subheadline, body, cta}`
  da un brief utente tramite DeepSeek.
- **Brief**: 2-3 frasi dell'utente che descrivono l'evento/promozione.
- **Tone**: `formale` | `giovanile` | `tecnico` — influisce sul prompt AI.
- **CTA**: call-to-action con `label` + `url` (es. "Prenota ora" →
  `https://example.com/prenota`).

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: L'utente può creare un volantino da vuoto o da un
  template per settore (`ristorante`, `evento`, `salone`, `negozio`).
- **REQ-002**: Form con 7 campi: `headline`, `subheadline`, `body`
  (textarea max 1000 char), `cta.label`, `cta.url`, `heroImage`
  (upload opzionale), `qrPayload` + `qrLabel` (opzionali).
- **REQ-003**: Layout switcher in alto con 4 bottoni (classic, centered,
  split, magazine). Click → anteprima si riaggiorna (debounce 300ms).
- **REQ-004**: Size selector con 5 formati + orientation toggle
  (portrait/landscape, solo per A6/A5/A4/Letter; Square sempre
  quadrato).
- **REQ-005**: AI copy button "Genera copy". Click → modale con:
  - Textarea brief (max 500 char)
  - Select tone (`formale` | `giovanile` | `tecnico`)
  - Bottone "Genera" → loading state 5-15s → risultati popolano i
    campi `headline`, `subheadline`, `body`, `cta.label`.
- **REQ-006**: AI copy NON sovrascrive campi già popolati senza
  conferma. Se `headline` ha già del testo, appare confirm dialog
  "Sovrascrivi il copy esistente?".
- **REQ-007**: Azioni rapide AI: "Semplifica", "Più formale", "Più
  giovanile", "Aggiungi urgenza". Ogni bottone chiama l'endpoint AI
  con un prompt specifico e modifica solo i campi testuali.
- **REQ-008**: Stile configurabile: `bgColor`, `textColor`,
  `accentColor`, `fontFamily`.
- **REQ-009**: Export PDF alta risoluzione con bleed 3mm e crop marks.
  Singola pagina (non multi-up come bigliettino).
- **REQ-010**: Export PNG alla risoluzione scelta (150 DPI free, 300
  DPI unlocked — vedi fase 5).
- **REQ-011**: Salvataggio in collection tramite `dataService.saveDocument`
  con `documentType='flyer'`.
- **SEC-001**: Validazione `cta.url` con `new URL()` + protocollo
  `http:` o `https:`.
- **SEC-002**: Upload hero image: MIME allowlist + size max 5MB +
  dimensioni max 4000×4000px (riusa `compressImage` fase 2).
- **SEC-003**: AI copy endpoint richiede autenticazione (stesso
  middleware auth di `/ai/chat`).
- **SEC-004**: Rate limit `/ai/copy-flyer`: 10 chiamate/minuto per IP
  (nuovo scope `flyerCopy` nel rate limiter esistente in
  `api/index.ts`).
- **SEC-005**: Brief sanitizzato: strip HTML tags prima di inviare a
  DeepSeek. Nessun PII collection.
- **CON-001**: Vercel Hobby: timeout 10s. DeepSeek per copy generation
  risponde in 3-8s (sotto il limite).
- **CON-002**: PDF generato con `pdfmake` (già nel progetto).
- **CON-003**: Costo AI per volantino: ~2000 token × €0.14/M =
  €0.0003. Trascurabile.
- **CON-004**: Base64 hero image inline, max 500KB dopo compressione.
- **GUD-001**: Seguire `AGENTS.md` "Test — OBBLIGATORI": coverage
  ≥60% per i nuovi file.
- **GUD-002**: Seguire `AGENTS.md` "Streaming AI": l'AI copy NON è
  in streaming (risposta JSON singola). Documentare questa eccezione
  nel codice.
- **GUD-003**: Seguire `AGENTS.md` "API Design Principles": status
  codes 200/400/401/429/500, Zod validation, JSON uniforme
  `{ data }` o `{ error }`.
- **GUD-004**: Seguire skill `vercel-react-best-practices`: lazy-load
  `FlyerEditor`, memo preview.
- **GUD-005**: Seguire skill `web-design-guidelines`: contrasto 4.5:1,
  font size min 11pt per body, 24pt+ per headline.
- **GUD-006**: Seguire skill `frontend-design` per i 4 layout —
  ognuno deve avere una sua "personalità" visiva, non essere una
  variante minore degli altri.
- **GUD-007**: Seguire skill `web-security` per validazione brief e
  URL.
- **PAT-001**: Pattern prompt JSON mode:
  ```ts
  const prompt = buildFlyerCopyPrompt(brief, tone);
  const response = await provider.chat([{
    role: 'user', content: prompt
  }], { responseFormat: { type: 'json_object' }, temperature: 0.7 });
  // response.content è una stringa JSON
  const copy = JSON.parse(response.content);
  // copy: { headline, subheadline, body, cta: { label } }
  ```
- **PAT-002**: Pattern rate limit scope (estensione `api/index.ts`):
  ```ts
  const rateLimiter = {
    // ... scope esistenti: login, ai, tokens, logs
    flyerCopy: new Map<string, { count: number; resetAt: number }>(),
  };
  function checkFlyerCopyRateLimit(ip: string): boolean {
    // 10 chiamate/minuto
  }
  ```
- **PAT-003**: Pattern conferma sovrascrittura:
  ```tsx
  if (hasExistingCopy && !confirm('Sovrascrivi il copy esistente?')) return;
  applyCopy(copy);
  ```

## 4. Interfaces & Data Contracts

### Schema `src/utils/documentSchemas.ts` (estensione)

```ts
export const flyerSchema = z.object({
  documentType: z.literal('flyer'),
  id: z.string(),
  title: z.string().default(''),
  size: z.enum(['A6', 'A5', 'A4', 'Letter', 'Square']).default('A5'),
  orientation: z.enum(['portrait', 'landscape']).default('portrait'),
  content: z.object({
    headline: z.string().max(200).default(''),
    subheadline: z.string().max(300).default(''),
    body: z.string().max(2000).default(''),
    cta: z.object({
      label: z.string().max(50).default(''),
      url: z.string().default(''),
    }),
    heroImage: z.string().nullable().default(null),
    qrPayload: z.string().default(''),
    qrLabel: z.string().default(''),
  }),
  style: z.object({
    bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#FFFFFF'),
    textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1a1a2e'),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#01696F'),
    layout: z.enum(['classic', 'centered', 'split', 'magazine']).default('classic'),
    fontFamily: z.string().default('Inter'),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Flyer = z.infer<typeof flyerSchema>;

export function createEmptyFlyer(): Flyer { /* defaults */ }

export function createFlyerTemplate(settore: 'ristorante' | 'evento' | 'salone' | 'negozio'): Flyer {
  // 4 template pre-popolati per settore (placeholder copy, non AI-generated)
}
```

### AI prompt `src/ai/prompts/flyerCopy.ts`

```ts
export function buildFlyerCopyPrompt(brief: string, tone: 'formale' | 'giovanile' | 'tecnico'): string {
  const toneMap = {
    formale: 'tono formale e professionale, rivolto a un pubblico adulto',
    giovanile: 'tono fresco e giovanile, rivolto a under-35, usa contrazioni',
    tecnico: 'tono tecnico e preciso, includi numeri e specifiche',
  };
  return `Sei un copywriter esperto in volantini pubblicitari italiani.
Genera il copy per un volantino da questo brief:

Brief: "${brief}"
Tono: ${toneMap[tone]}

Restituisci SOLO un JSON valido con questa struttura:
{
  "headline": "titolo principale max 60 char, accattivante",
  "subheadline": "sottotitolo max 100 char, complementare",
  "body": "corpo del testo max 500 char, può includere \n per paragrafi",
  "cta": { "label": "call to action max 30 char" }
}

Non includere il campo url nel cta (viene aggiunto manualmente).
Non includere testo вне dal JSON.`;
}
```

### AI orchestrator `src/ai/index.ts` (estensione)

```ts
export class AIOrchestrator {
  // ... metodi esistenti

  async generateFlyerCopy(
    brief: string,
    tone: 'formale' | 'giovanile' | 'tecnico',
    options?: { modelId?: string }
  ): Promise<{ headline: string; subheadline: string; body: string; cta: { label: string } }> {
    const provider = this.getProvider(options?.modelId || 'deepseek-chat');
    const prompt = buildFlyerCopyPrompt(brief, tone);
    const response = await provider.chat(
      [{ role: 'user', content: prompt }],
      { responseFormat: { type: 'json_object' }, temperature: 0.7 }
    );
    return JSON.parse(response.content);
  }
}
```

### Endpoint API `api/index.ts` (estensione)

```ts
// POST /ai/copy-flyer
// Body: { brief: string, tone: 'formale'|'giovanile'|'tecnico', modelId?: string }
// Response: { data: { headline, subheadline, body, cta: { label } } }
// Auth: stessa di /ai/chat
// Rate limit: scope 'flyerCopy', 10/minuto per IP
// Timeout: 25s (AbortController, come /ai/chat)
```

### Componente `src/components/FlyerEditor.tsx`

```tsx
interface FlyerEditorProps {
  flyer: Flyer;
  onPatch: (path: string, value: any) => void;
  onUploadHero: (file: File) => Promise<void>;
  onGenerateCopy: (brief: string, tone: string) => Promise<CopyResult>;
  onRefineCopy: (action: 'simplify' | 'formal' | 'young' | 'urgent') => Promise<CopyResult>;
  onExportPDF: () => void;
  onExportPng: () => void;
  documentTheme: DocumentTemplateId;
  tier: 'free' | 'unlocked';
  isProcessingCopy: boolean;
}
```

### Sidebar `Layout.tsx` (estensione)

Nuova voce "Volantini" con icona SVG volantino, chiama `setView('flyer')`.

### `App.tsx` — view state (estensione)

```ts
const [view, setView] = useState<'editor' | 'qr' | 'card' | 'flyer' | 'collection' | 'settings' | 'admin'>('editor');
```

## 5. Acceptance Criteria

- **AC-001**: Given utente loggato, When click "Volantini" sidebar,
  Then `FlyerEditor` renderizzato con volantino vuoto
  (`createEmptyFlyer`).
- **AC-002**: Given prima apertura, When utente vede banner "Template
  per settore", Then 4 bottoni (Ristorante, Evento, Salone, Negozio)
  caricano i rispettivi template.
- **AC-003**: Given utente compila brief "Sagra della birra, 15
  agosto, ingresso gratis" e seleziona tone `giovanile`, When click
  "Genera", Then loading state 3-8s e i campi `headline`,
  `subheadline`, `body`, `cta.label` vengono popolati.
- **AC-004**: Given `headline` già popolato con "Sagra della birra",
  When utente click "Genera" di nuovo, Then confirm dialog
  "Sovrascrivi il copy esistente?" appare.
- **AC-005**: Given copy generato, When utente click "Semplifica",
  Then AI refine call modifica solo `body` (riducendolo) mantenendo
  `headline` invariata.
- **AC-006**: Given layout `classic`, When utente cambia in `split`,
  Then anteprima si riaggiorna con layout 50/50 (immagine vs testo).
- **AC-007**: Given size `A5` portrait, When utente cambia in `Square`,
  Then `orientation` viene ignorata (Square sempre 210×210) e anteprima
  si ridimensiona.
- **AC-008**: Given volantino con hero image caricata, When export
  PDF, Then il PDF include l'immagine alla risoluzione corretta con
  bleed 3mm.
- **AC-009**: Given utente non loggato, When tenta `POST /ai/copy-flyer`,
  Then 401 Unauthorized.
- **AC-010**: Given IP ha fatto 11 chiamate `/ai/copy-flyer` nell'ultimo
  minuto, When 12a chiamata, Then 429 Too Many Requests con header
  `Retry-After`.
- **AC-011**: Given `cta.url='javascript:alert(1)'`, When validazione,
  Then errore "URL non valido. Usa http:// o https://".
- **AC-012**: Given `npm run typecheck`, Then code 0.
- **AC-013**: Given `npm run test`, Then code 0 e tutti i nuovi test
  passano.

## 6. Test Automation Strategy

- **Test Levels**: Unit (schema, prompt builder, generator),
  Integration (componente con AI mock), Contract (endpoint).
- **Frameworks**: Vitest 4, React Testing Library 16, jsdom 29.
- **Test Data Management**: mock `AIOrchestrator.generateFlyerCopy`
  con risposte JSON predefinite. Mock `fetch` per i test endpoint.
- **Coverage Requirements**: ≥60% per i nuovi file.

### File di test da creare

| File | Cosa copre |
|------|-----------|
| `src/utils/__tests__/documentSchemas.test.ts` (estensione) | parse OK per `flyerSchema`, default values, helper `createEmptyFlyer`, 4 template per settore |
| `src/utils/__tests__/flyerGenerator.test.ts` | `generateFlyerPDF` ritorna buffer non vuoto per ogni layout × size (20 combinazioni); `generateFlyerPng` per ogni layout; bleed 3mm presente; crop marks presenti |
| `src/ai/prompts/__tests__/flyerCopy.test.ts` | `buildFlyerCopyPrompt` per 3 tone; output contiene "JSON"; brief è incluso; HTML tags stripped |
| `src/ai/__tests__/generateFlyerCopy.test.ts` (estensione) | `generateFlyerCopy` chiama provider con `responseFormat: json_object`; parse JSON; error handling su JSON malformato |
| `src/components/__tests__/FlyerEditor.test.tsx` | render iniziale, click template, AI copy button (mock orchestrator), confirm sovrascrittura, azioni rapide, cambio layout, upload hero, export PDF/PNG |
| `api/__tests__/copyFlyer.test.ts` (estensione) | endpoint `POST /ai/copy-flyer` con auth mock, rate limit, Zod validation, response shape |

### Test matrice

| AC | Test file |
|----|-----------|
| AC-001 | FlyerEditor.test.tsx |
| AC-002 | FlyerEditor.test.tsx |
| AC-003 | FlyerEditor.test.tsx + generateFlyerCopy.test.ts |
| AC-004 | FlyerEditor.test.tsx |
| AC-005 | FlyerEditor.test.tsx + generateFlyerCopy.test.ts |
| AC-006 | FlyerEditor.test.tsx |
| AC-007 | documentSchemas.test.ts (Square ignore orientation) |
| AC-008 | flyerGenerator.test.ts |
| AC-009 | copyFlyer.test.ts |
| AC-010 | copyFlyer.test.ts |
| AC-011 | FlyerEditor.test.tsx |
| AC-012 | typecheck |
| AC-013 | test run |

## 7. Rationale & Context

**Perché 4 layout fissi e non editor drag-and-drop**:

Stessa logica del bigliettino (fase 2): per il modello "72h consegna",
l'utente non ha tempo di impazzire con il drag. 4 layout coprono:
eventi/promozioni (classic), annunci/comunicati (centered), prodotto
hero (split), listini/menù (magazine).

**Perché AI copy e non AI image**:

AI image generation per volantini richiederebbe:
- Replicate/Stable Diffusion (~€0.05-0.20 per immagine)
- Vercel Pro per timeout 60s (Hobby 10s non basta)
- Controllo qualità (AI immagina cose strambe)

AI copy invece:
- DeepSeek già configurato (€0.0003 per volantino)
- Timeout 3-8s (sotto il limite Hobby 10s)
- Output testuale controllabile (JSON mode)
- L'utente ha già foto del locale/evento da caricare

Per il modello di business, l'AI copy è il 90% del valore con 1% del
costo. AI image è out of scope v2.

**Perché tone select e non prompt libero**:

Prompt libero rende l'output imprevedibile. 3 tone predefiniti danno
output controllato e testabile. L'utente che vuole prompt libero può
usare l'editor preventivi (che ha prompt libero).

**Perché azioni rapide oltre al "Genera"**:

L'utente medio genera copy, poi vuole riffinare ("troppo lungo", "troppo
formale"). Le 4 azioni rapide (`Semplifica`, `Più formale`, `Più
giovanile`, `Aggiungi urgenza`) coprono i 4 riffini più comuni senza
richiedere all'utente di scrivere un prompt. Ognuna ha un prompt
specifico hardcoded in `flyerCopy.ts`.

**Perché rate limit 10/minuto**:

Un utente normale genera 1-3 volantini per sessione. 10/minuto
previene abuso senza bloccare uso legittimo. Allineato al rate limit
login (5/15min) e ai (30/min).

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: DeepSeek API (già integrata per i preventivi) — riusata
  per `generateFlyerCopy`.

### Third-Party Services
- **SVC-001**: DeepSeek Chat completions API — scope `flyerCopy`, 10
  chiamate/minuto per IP. SLA: risposta 3-8s.

### Infrastructure Dependencies
- **INF-001**: Vercel Hobby — timeout 10s. DeepSeek per copy risponde
  in 3-8s, sotto il limite. Timeout AbortController a 25s come
  fallback.
- **INF-002**: Neon Postgres — nessun impatto (niente AI log su DB).

### Data Dependencies
- **DAT-001**: localStorage `precisionQuote_documents:v1` (riuso).
- **DAT-002**: Tabella DB `documents` con `document_type='flyer'`.

### Technology Platform Dependencies
- **PLT-001**: `pdfmake` 0.3.11 (già nel progetto).
- **PLT-002**: Canvas API per compressione hero image.
- **PLT-003**: DeepSeek SDK via `fetch` diretto (no SDK aggiuntivo).

### Compliance Dependencies
- **COM-001**: WCAG AA contrast 4.5:1.
- **COM-002**: GDPR — brief utente non contiene PII per natura del
  caso d'uso (descrive un evento, non una persona). Nessun log del
  brief.

## 9. Examples & Edge Cases

### Edge case 1: Brief vuoto

```ts
// brief = ""
// buildFlyerCopyPrompt produce prompt con brief vuoto
// DeepSeek risponde con JSON ma campi vuoti o generici ("Il tuo evento")
// → l'utente vede copy generico, può riffinare o editare manualmente
```

### Edge case 2: Brief con HTML injection

```ts
// brief = "<script>alert(1)</script>Sagra della birra"
// stripHtml(brief) → "Sagra della birra"
// DeepSeek riceve brief pulito
```

### Edge case 3: DeepSeek risponde JSON malformato

```ts
// response.content = "{headline: 'Sagra', ...}" (single quotes, invalid JSON)
// JSON.parse throw → catch → ritorna errore "AI non ha restituito JSON
// valido. Riprova."
// → utente vede toast errore, può riprovare
```

### Edge case 4: AI genera copy con CTA ma l'utente non ha URL

```ts
// copy.cta.label = "Prenota ora"
// cta.url = "" (l'utente non l'ha ancora compilato)
// Anteprima mostra "Prenota ora" senza link (non cliccabile)
// PDF mostra "Prenota ora" come testo, non come link
```

### Edge case 5: Layout `magazine` con body corto

```ts
// body = "Solo cibo tipico."
// Layout magazine aspetta 3 paragrafi per la griglia 3-colonne
// → anteprima mostra 1 colonna popolata + 2 vuote
// → non crasha, ma layout asimmetrico
// → l'utente vede e decide se aggiungere testo
```

### Edge case 6: Cambio size dopo AI copy

```ts
// size = A5, copy generato per A5 (body 500 char)
// utente cambia in A6 (più piccolo)
// body ora troppo lungo per A6 → overflow visivo
// → anteprima mostra overflow, l'utente deve editare o usare "Semplifica"
```

### Edge case 7: Hero image troppo alta per layout `split`

```ts
// hero image 800×1200px (verticale)
// layout split orizzontale: immagine a sinistra 50% width
// → immagine viene croppata verticalmente per stare nel riquadro
// → o sclata per fit, mantenendo aspect ratio con whitespace
// → scelta: sclata con whitespace (no crop), più sicuro per output
//    stampa
```

## 10. Validation Criteria

Prima di considerare la fase 3 completata, verificare:

1. `npm run typecheck` code 0.
2. `npm run test` code 0, tutti i nuovi test passano.
3. `git diff src/utils/documentSchemas.ts` mostra `flyerSchema` +
   helper.
4. `git status` mostra i nuovi file:
   - `src/utils/flyerGenerator.ts`
   - `src/ai/prompts/flyerCopy.ts`
   - `src/components/FlyerEditor.tsx`
   - `src/utils/__tests__/flyerGenerator.test.ts`
   - `src/ai/prompts/__tests__/flyerCopy.test.ts`
   - `src/components/__tests__/FlyerEditor.test.tsx`
   - `api/__tests__/copyFlyer.test.ts`
5. `git diff src/ai/index.ts` mostra nuovo metodo
   `generateFlyerCopy`.
6. `git diff api/index.ts` mostra nuovo endpoint `POST /ai/copy-flyer`
   + rate limit scope `flyerCopy`.
7. `git diff src/components/Layout.tsx` mostra nuova voce "Volantini".
8. `git diff App.tsx` mostra view state `'flyer'` + lazy-load
   `FlyerEditor`.
9. Manuale: `npm run dev`, loggare, click "Volantini", generare copy
   con brief "Test evento", verificare popolamento campi, export PDF.
10. Manuale: verificare rate limit — 11 chiamate rapide dovrebbero
    triggerare 429 sulla 11a (aspettare 1 minuto tra test).
11. Manuale: verificare 4 layout × 2 size = 8 anteprime visive
    distintas.

## 11. Related Specifications / Further Reading

- `spec/spec-process-phase0-autosave-fix.md` — auto-save
- `spec/spec-tool-phase1-qr-code.md` — QR riusato (opzionale nel
  volantino)
- `spec/spec-design-phase2-business-card.md` — pattern compressione
  immagini riusato per hero
- `spec/spec-tool-phase4-logo-builder.md` — logo caricabile nel
  volantino (futuro)
- `spec/spec-data-phase5-tier-system.md` — watermark PDF, AI gate per
  free, risoluzione gate
- `spec/spec-architecture-phase6-unified-collection.md` — visualizzazione
  volantini in CollectionView
- `AGENTS.md` — sezioni "Streaming AI" (eccezione documentata),
  "API Design Principles", "Auth Security" (rate limit), "Test —
  OBBLIGATORI"
- `AI_ARCHITECTURE.md` — pattern provider, estensione orchestrator
- Skill `vercel-react-best-practices` — lazy-load, memo
- Skill `frontend-design` — design dei 4 layout
- Skill `web-design-guidelines` — accessibilità, contrasto
- Skill `web-security` — validazione URL, strip HTML

### Prossima fase

Dopo il completamento della fase 3, procedere con
`spec/spec-tool-phase4-logo-builder.md` (Logo SVG builder, no AI nella
v1).

## Note: AI per flyer

L''AI per il flyer puo riusare lo stesso pattern di cardOrchestrator (modulo dedicato, no tools, JSON round-trip). File suggeriti:
- src/ai/prompts/flyerSystem.ts
- src/ai/flyerOrchestrator.ts
- src/hooks/useAIFlyer.ts

Riusa: providerRegistry, chatStore, sanitizeAIResponse, 
eedsAnalysis, StreamBuffer, dataService.trackTokens.
