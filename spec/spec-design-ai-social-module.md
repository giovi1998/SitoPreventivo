---
title: AI Social Module — Generatore social post coordinati
version: 1.0
date_created: 2026-07-05
last_updated: 2026-07-05
owner: Giovanni Cidu
tags: [design, ai, social, cross-module, feature, new-route]
---

# Introduction

Modulo prodotto nuovo: AI genera 3 social post (Instagram, Facebook,
LinkedIn) coordinati col documento corrente (card o flyer). Salva in
collection come `documentType: 'socialPack'`. Nuova route `/app/social`.
Dipende da spec 3 (social prompt), spec 5 (BaseOrchestrator), spec 4
(promptRegistry).

## 1. Purpose & Scope

**Purpose**: nuovo modulo prodotto che sfrutta AI cross-module (usa dati
card/flyer per generare social post coerenti col brand).

**Scope**:
- Nuovo `src/ai/socialOrchestrator.ts`
- Nuovo `src/hooks/useAISocial.ts`
- Nuovo `src/components/SocialEditor.tsx`
- Nuovo `src/pages/app/SocialPage.tsx` + route `/app/social`
- Nuovo `documentType: 'socialPack'` in `documentSchemas.ts`
- Nuovo endpoint `POST /ai/social-generate` in `api/index.ts`
- Nuovi test

**Audience**: sviluppatore AI, utente finale.

**Assunzioni**:
- Dipende da spec 3 (socialSystem prompt), spec 5 (BaseOrchestrator),
  spec 4 (promptRegistry).
- `documentType: 'socialPack'` aggiunto a schema DB (migration).
- Collection esistente gestisce nuovi documentType automaticamente
  (tab + filtri).
- AI usa DeepSeek (stesso provider, niente nuovo servizio).

## 2. Definitions

- **SocialPack**: documento con 3 social post (uno per piattaforma).
- **Cross-module AI**: AI che legge dati di un modulo (card/flyer) per
  output di un altro (social).
- **CardSnapshot/FlyerSnapshot**: estrazione minimale dati per prompt
  (definiti in spec 3).

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: Aggiungere `socialPackSchema` in `documentSchemas.ts`:
  ```typescript
  const socialPackSchema = z.object({
    posts: z.array(z.object({
      platform: z.enum(['instagram', 'facebook', 'linkedin']),
      caption: z.string().max(1500),
      hashtags: z.array(z.string()).max(10),
      tone: z.enum(['professional', 'casual', 'promotional'])
    })).length(3),
    sourceDocumentId: z.string().optional(), // card/flyer di origine
    sourceDocumentType: z.enum(['card', 'flyer']).optional()
  });
  ```
- **REQ-002**: Creare `src/ai/socialOrchestrator.ts` con
  `SocialAIOrchestrator extends BaseOrchestrator`:
  - `generatePosts(source: SocialSource, tone: SocialTone, options?): Promise<SocialProcessResult>`
  - `SocialSource = { type: 'card'|'flyer', data: CardSnapshot|FlyerSnapshot, sourceId: string }`
  - Usa `promptRegistry.getPrompt('social-system')` per system
  - Usa `buildSocialGeneratePrompt(document, tone, platform)` per user
    (loop 3 piattaforme o singola chiamata multi-post)
  - `socialAIOutputSchema` Zod valida `{ posts: [{ platform, caption, hashtags, tone }] }`
  - `trackUsage` se non admin
- **REQ-003**: `SocialProcessResult = { socialPack: SocialPack; response: string; sessionId: string; applied: boolean }`.
- **REQ-004**: Creare `src/hooks/useAISocial.ts`:
  - `useAISocial(userEmail?): { generate, reset, logs, isProcessing, availableModels }`
  - `generate(source, tone, options?): Promise<SocialProcessResult>`
  - Pattern identico a `useAIFlyer`
- **REQ-005**: Endpoint `POST /ai/social-generate`:
  - Zod: `{ source: SocialSource, tone: SocialTone, model?: string, userEmail?: string }`
  - Rate-limit scope `aiSocial` 10/min/IP
  - Timeout 25s
  - Proxy a DeepSeek (come `/ai/chat`)
- **REQ-006**: `src/components/SocialEditor.tsx`:
  - Form: source selector (card o flyer dalla collection), tone select,
    bottone "Genera 3 post"
  - Preview 3 post (card per piattaforma, mostra caption + hashtags)
  - Export: copia singolo post, download JSON, salva in collection
  - Responsive (tab mobile come CardEditor)
- **REQ-007**: `src/pages/app/SocialPage.tsx` + route in `main.tsx`:
  - Path `/app/social`
  - Login guard (come altri `/app/*`)
  - Lazy-load (come `LogoEditor`)
- **REQ-008**: Layout sidebar (`Layout.tsx`) aggiunge voce "Social AI"
  dopo "Logo".
- **REQ-009**: DB migration: `document_type` accetta `'socialPack'`.
  Collection esistente filter aggiunge tab "Social".
- **REQ-010**: `saveSocialPack` in `dataService.js` (saveDocument con
  `documentType: 'socialPack'`).
- **CON-001**: Zero breaking change. Modulo nuovo, niente regression.
- **CON-002**: Dipende da spec 3, 4, 5 (prompt, registry, base).
- **CON-003**: `socialPackSchema` cap 3 post (uno per piattaforma).
- **GUD-001**: Pattern identico a FlyerEditor (form + preview + AI modal
  + export).
- **PAT-001**: Cross-module: source document letto da collection, AI non
  tocca il documento originale.

## 4. Interfaces & Data Contracts

**SocialAIOrchestrator**:

```typescript
export class SocialAIOrchestrator extends BaseOrchestrator {
  generatePosts(source: SocialSource, tone: SocialTone, options?: {
    modelId?: string;
    onStream?: (chunk: AIStreamChunk) => void;
    userEmail?: string;
  }): Promise<SocialProcessResult>;
}

export type SocialProcessResult = {
  socialPack: SocialPack;
  response: string;
  sessionId: string;
  applied: boolean;
};
```

**API endpoint**:

| Path | Method | Zod | Rate-limit | Timeout |
|------|--------|-----|------------|---------|
| `/ai/social-generate` | POST | `aiSocialSchema` | `aiSocial` 10/min/IP | 25s |

**aiSocialSchema**:

```typescript
const aiSocialSchema = z.object({
  source: z.object({
    type: z.enum(['card', 'flyer']),
    data: z.record(z.unknown()), // CardSnapshot o FlyerSnapshot
    sourceId: z.string()
  }),
  tone: z.enum(['professional', 'casual', 'promotional']),
  model: z.string().optional(),
  userEmail: z.string().email().optional()
});
```

**SocialPack shape** (documentType `'socialPack'`):

```typescript
{
  posts: [
    { platform: 'instagram', caption: '...', hashtags: ['#...'], tone: 'casual' },
    { platform: 'facebook', caption: '...', hashtags: ['#...'], tone: 'promotional' },
    { platform: 'linkedin', caption: '...', hashtags: ['#...'], tone: 'professional' }
  ],
  sourceDocumentId: 'CARD-...',
  sourceDocumentType: 'card'
}
```

## 5. Acceptance Criteria

- **AC-001**: Given `SocialAIOrchestrator.generatePosts` con source card,
  When eseguito, Then ritorna 3 post (uno per piattaforma).
- **AC-002**: Given `socialPackSchema.safeParse` con 2 post, When eseguito,
  Then fail (length 3 required).
- **AC-003**: Given POST `/ai/social-generate` con body valido, When 11a
  richiesta in 60s, Then 429.
- **AC-004**: Given route `/app/social`, When utente non loggato, Then
  redirect `/login`.
- **AC-005**: Given `SocialEditor` render, When source selezionato dalla
  collection, Then dropdown mostra card+flyer salvati.
- **AC-006**: Given genera post, When AI ritorna 3 post validi, Then
  preview mostra 3 card con caption + hashtags.
- **AC-007**: Given salva socialPack, When eseguito, Then collection
  mostra documento con `documentType: 'socialPack'`.
- **AC-008**: Given collection tab "Social", When cliccato, Then filtra
  solo socialPack.
- **AC-009**: Given `npm test`, Then 1662+ verdi.
- **AC-010**: Given `npm run typecheck`, Then verde.

## 6. Test Automation Strategy

- **Test Levels**: Unit (orchestrator, schema), Component (SocialEditor),
  Integration (API endpoint).
- **Frameworks**: Vitest, React Testing Library.
- **Test Data Management**: fixture card/flyer snapshot.
- **Coverage Requirements**: ≥80% nuovi file.
- **Test nuovi** (~15):
  - `socialOrchestrator.test.ts`: 4 test (generate card source, flyer
    source, schema fail, admin skip)
  - `useAISocial.test.ts`: 3 test (generate, error, token check)
  - `SocialEditor.test.tsx`: 5 test (render, source select, generate,
    preview 3 post, save)
  - `SocialPage.test.tsx`: 1 test (route guard)
  - `api/__tests__/aiSocial.test.ts`: 2 test (200, 429)

## 7. Rationale & Context

Modulo cross-module è differenziatore competitivo (Canva non lo fa: non
ha contesto card/flyer). AI legge dati bigliettino (nome, azienda, servizi)
e genera post coerenti. Utente non duplica lavoro. SocialPack salvabile
in collection (come card/flyer). Costo AI: ~€0.01-0.03/prompt (3 post in
una chiamata). ROI: nuovo pacchetto commerciale "Social AI Pack" possibile
(futuro).

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: DeepSeek V4 API (via proxy, come `/ai/chat`).

### Third-Party Services
- Nessuna nuova.

### Infrastructure Dependencies
- **INF-001**: Vercel Serverless Function.
- **INF-002**: DB migration per `documentType: 'socialPack'`.

### Data Dependencies
- **DAT-001**: spec 3 `socialSystem.ts` (prompt).
- **DAT-002**: spec 5 `BaseOrchestrator`.
- **DAT-003**: `src/utils/documentSchemas.ts` (aggiungere `socialPackSchema`).
- **DAT-004**: `src/components/CollectionView.tsx` (aggiungere tab
  Social + filter).
- **DAT-005**: `src/components/Layout.tsx` (sidebar voce Social AI).

### Technology Platform Dependencies
- **PLT-001**: TypeScript, React, Vitest.

### Compliance Dependencies
- **COM-001**: Post generati NON pubblicano automaticamente (utente
  copia/incolla manualmente). Nessuna integrazione Instagram/Facebook
  API (out of scope v1).

## 9. Examples & Edge Cases

**Esempio flusso utente**:
1. Utente crea bigliettino (card) per "Ristorante Da Mario"
2. Va su `/app/social`
3. Seleziona source = card "Ristorante Da Mario"
4. Sceglie tone = "promotional"
5. Click "Genera 3 post"
6. AI ritorna: Instagram "🍕 Nuovo bigliettino da visita! #foodie
   #cagliari", Facebook "Siamo aperti! Venite a trovarci...", LinkedIn
   "Il nostro nuovo branding professionale..."
7. Salva socialPack in collection

**Edge case — source non trovato**: se sourceId non in collection, error
"Documento non trovato".

**Edge case — AI ritorna 2 post**: `socialPackSchema.safeParse` fail
(length 3). `applied: false`, retry.

**Edge case — hashtags invalidi**: AI ritorna `hashtags: ['foodie']`
senza `#`. Schema richiede `#word`. Sanitize lato merge: aggiungi `#`
se mancante, o reject.

## 10. Validation Criteria

- Tutti AC-001..010 verdi.
- `socialOrchestrator.ts`, `useAISocial.ts`, `SocialEditor.tsx`,
  `SocialPage.tsx` esistono.
- Route `/app/social` in `main.tsx`.
- `socialPackSchema` in `documentSchemas.ts`.
- Endpoint `POST /ai/social-generate` in `api/index.ts`.
- DB migration applicata.
- `npm test` verde (1662 + ~15 nuovi).
- `npm run typecheck` verde.

## 11. Related Specifications / Further Reading

- `spec/spec-tool-ai-prompt-new-modules.md` — social prompt (spec 3).
- `spec/spec-architecture-ai-base-orchestrator.md` — BaseOrchestrator (spec 5).
- `spec/spec-architecture-ai-prompt-registry.md` — promptRegistry (spec 4).
- `src/components/FlyerEditor.tsx` — pattern riferimento (form +
  preview + AI modal).
- `src/components/CollectionView.tsx` — aggiungere tab Social.