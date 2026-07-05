---
title: AI Logo v2 — Orchestratore logo AI con Replicate guard
version: 1.0
date_created: 2026-07-05
last_updated: 2026-07-05
owner: Giovanni Cidu
tags: [design, ai, logo, v2, replicate, orchestrator, feature]
---

# Introduction

`LogoEditor.tsx` ha tab "AI Generation" disabilitato in v1 con messaggio.
Questa spec abilita AI logo v2 via `REPLICATE_API_TOKEN` env var, con
orchestratore dedicato (`LogoAIOrchestrator`), hook (`useAILogo`), guard
(se token assente, fallback a messaggio v1). Dipende da spec 3 (logo
prompt), spec 5 (BaseOrchestrator).

## 1. Purpose & Scope

**Purpose**: abilitare AI logo generation nell'app, con fallback graceful
se token non configurato.

**Scope**:
- Nuovo `src/ai/logoOrchestrator.ts`
- Nuovo `src/hooks/useAILogo.ts`
- Modifica `src/components/LogoEditor.tsx` (tab AI attivo se token presente)
- Nuovo `src/utils/aiLogoClient.ts` (chiamata Replicate client-side o via
  API proxy)
- Nuovo endpoint `POST /ai/logo-generate` in `api/index.ts` (proxy server-
  side, evita esporre token)
- Nuovi test: `logoOrchestrator.test.ts`, `useAILogo.test.ts`, `api/__tests__/aiLogo.test.ts`

**Audience**: sviluppatore AI, utente finale (feature).

**Assunzioni**:
- `REPLICATE_API_TOKEN` env var su Vercel (server-side only, come
  `DEEPSEEK_API_KEY`).
- Modello Replicate: Recraft-V3 (o alternativo, vedi TODO).
- Token NON esposto al client (proxy via API, come DeepSeek).
- Dipende da spec 3 (`logoSystem.ts` prompt) + spec 5 (BaseOrchestrator).
- `logoSchema` in `documentSchemas.ts` esiste (input/output shape).

## 2. Definitions

- **LogoAI v2**: generazione logo via AI (Replicate), sostituisce tab
  disabilitato v1.
- **Recraft-V3**: modello Replicate per image/SVG generation. Alternativa:
  DALL-E 3, Stable Diffusion (se Replicate non disponibile).
- **Token guard**: se `REPLICATE_API_TOKEN` assente, tab AI mostra
  messaggio "Configura token" (fallback v1).
- **Proxy server-side**: client chiama `/ai/logo-generate`, server chiama
  Replicate con token. Token mai esposto al browser.

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: Creare `src/ai/logoOrchestrator.ts` con
  `LogoAIOrchestrator extends BaseOrchestrator` (spec 5):
  - `generateLogo(logo: Logo, brief: string, options?: { modelId?; onStream?; userEmail? }): Promise<LogoProcessResult>`
  - `LogoProcessResult = { logo: Logo; response: string; sessionId: string; applied: boolean }`
  - Usa `promptRegistry.getPrompt('logo-system')` (spec 4) per system
    prompt
  - Usa `buildLogoGeneratePrompt(brief, sector)` per user prompt
  - `parseJsonResponse` con `logoAIOutputSchema` (Zod, valida output AI)
  - `mergeLogoAIResponse(logo, parsed)` applicazione al logo
  - `trackUsage` se non admin
- **REQ-002**: Creare `src/hooks/useAILogo.ts`:
  - `useAILogo(userEmail?: string): { generate, reset, logs, isProcessing, availableModels }`
  - `generate(logo, brief, options?): Promise<LogoProcessResult>`
  - Pattern identico a `useAICard`/`useAIFlyer` (StreamBuffer, log cap 40,
    token check)
- **REQ-003**: Creare `src/utils/aiLogoClient.ts`:
  - `generateLogoViaApi(brief: string, sector?: string, model?: string): Promise<{ logo: Partial<Logo>; raw: string }>`
  - Chiama `POST /ai/logo-generate` via `fetch`
  - Non esegue AI client-side (tutto server-side via proxy)
- **REQ-004**: Endpoint `POST /ai/logo-generate` in `api/index.ts`:
  - Zod schema: `{ brief: z.string().max(500), sector: z.string().optional(), model: z.string().optional(), userEmail: z.string().email().optional() }`
  - Rate-limit scope `aiLogo` 10/min/IP (come `flyerCopy`)
  - Se `REPLICATE_API_TOKEN` assente → 503 `{ error: 'Logo AI non configurato' }`
  - Chiama Replicate API con token, ritorna JSON
  - Timeout 60s (Replicate può essere lento)
- **REQ-005**: Modifica `LogoEditor.tsx`:
  - Tab "AI Generation" attivo se `canUseLogoAI()` ritorna true
  - `canUseLogoAI()`: chiama `GET /ai/logo-config` (nuovo endpoint) che
    ritorna `{ enabled: boolean }` (true se `REPLICATE_API_TOKEN` presente)
  - Se false, tab mostra messaggio v1 ("Configura REPLICATE_API_TOKEN su
    Vercel e upgrada a Pro")
  - Se true, tab ha form: brief input + sector select + bottone "Genera"
  - On genera: chiama `useAILogo.generate`, merge risultato in logo state
- **REQ-006**: Endpoint `GET /ai/logo-config` (no rate-limit, leggero):
  - Ritorna `{ enabled: boolean }` (true se `REPLICATE_API_TOKEN` env
    presente)
  - Non espone token, solo flag
- **REQ-007**: `logoAIOutputSchema` Zod in `logoOrchestrator.ts`:
  ```typescript
  const logoAIOutputSchema = z.object({
    primaryText: z.string().max(30),
    tagline: z.string().max(60),
    iconType: z.enum(['none', 'shape', 'monogram', 'lucide']),
    iconShape: z.enum(['circle', 'square', 'rounded', 'hex']).optional(),
    iconName: z.string().optional(), // validate against allowlist
    monogram: z.string().max(2).optional(),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    layout: z.enum(['horizontal', 'vertical', 'stacked'])
  });
  ```
- **REQ-008**: `mergeLogoAIResponse(logo, parsed)`:
  - Merge campi top-level (primaryText, tagline, etc.)
  - Preserve `logoUrl` (base64 user-uploaded, mai sovrascritto)
  - Clamp colori a `#RRGGBB`
- **CON-001**: Zero breaking change. Se token assente, v1 behavior
  preservato (tab disabilitato con messaggio).
- **CON-002**: Token mai nel bundle client (VITE_REPLICATE_API_TOKEN
  VIETATO, solo server-side `REPLICATE_API_TOKEN`).
- **CON-003**: Dipende da spec 3 (prompt), spec 5 (BaseOrchestrator),
  spec 4 (promptRegistry).
- **CON-004**: Vercel Hobby timeout 60s (Replicate può richiedere 30-45s).
  Se timeout frequente, valutare Vercel Pro.
- **GUD-001**: Pattern proxy identico a `/ai/chat` (DeepSeek) e
  `/ai/copy-flyer`.
- **PAT-001**: Guard pattern: feature flag via env var presence.
- **PAT-002**: Client-side check `GET /ai/logo-config` prima di mostrare
  tab (evita UX rotta se token assente).

## 4. Interfaces & Data Contracts

**LogoAIOrchestrator**:

```typescript
export class LogoAIOrchestrator extends BaseOrchestrator {
  generateLogo(logo: Logo, brief: string, options?: {
    modelId?: string;
    onStream?: (chunk: AIStreamChunk) => void;
    userEmail?: string;
  }): Promise<LogoProcessResult>;
}

export type LogoProcessResult = {
  logo: Logo;
  response: string;
  sessionId: string;
  applied: boolean;
};
```

**API endpoints**:

| Path | Method | Zod | Rate-limit | Timeout |
|------|--------|-----|------------|---------|
| `/ai/logo-generate` | POST | `aiLogoSchema` | `aiLogo` 10/min/IP | 60s |
| `/ai/logo-config` | GET | (nessuno) | (nessuno) | 1s |

**aiLogoSchema**:

```typescript
const aiLogoSchema = z.object({
  brief: z.string().max(500),
  sector: z.string().optional(),
  model: z.string().optional(),
  userEmail: z.string().email().optional()
});
```

**Response `/ai/logo-generate`** (200):

```json
{
  "data": {
    "primaryText": "...",
    "tagline": "...",
    "iconType": "lucide",
    "iconName": "Coffee",
    "primaryColor": "#E62020",
    "secondaryColor": "#1A1A1A",
    "layout": "horizontal"
  },
  "raw": "..."
}
```

**Response `/ai/logo-config`** (200):

```json
{ "enabled": true }
```

## 5. Acceptance Criteria

- **AC-001**: Given `REPLICATE_API_TOKEN` assente, When `GET /ai/logo-config`,
  Then ritorna `{ enabled: false }`.
- **AC-002**: Given `REPLICATE_API_TOKEN` presente, When `GET /ai/logo-config`,
  Then ritorna `{ enabled: true }`.
- **AC-003**: Given `REPLICATE_API_TOKEN` assente, When `POST /ai/logo-generate`,
  Then 503 `{ error: 'Logo AI non configurato' }`.
- **AC-004**: Given `REPLICATE_API_TOKEN` presente, When `POST /ai/logo-generate`
  con brief valido, Then 200 con JSON logo (mock Replicate in test).
- **AC-005**: Given 11a richiesta in 60s, When `POST /ai/logo-generate`,
  Then 429 + Retry-After.
- **AC-006**: Given `LogoEditor` con `enabled: false`, When render, Then
  tab AI mostra messaggio "Configura REPLICATE_API_TOKEN".
- **AC-007**: Given `LogoEditor` con `enabled: true`, When render, Then
  tab AI ha form (brief input, sector select, bottone Genera).
- **AC-008**: Given `useAILogo.generate(logo, "Logo per pizzeria")`, When
  eseguito, Then ritorna `LogoProcessResult` con `applied: true` e logo
  aggiornato.
- **AC-009**: Given `logoAIOutputSchema.safeParse` con `iconName: 'InvalidIcon'`,
  When eseguito, Then fail (se non in allowlist 48).
- **AC-010**: Given `npm test`, Then 1662+ verdi.
- **AC-011**: Given `npm run typecheck`, Then verde.
- **AC-012**: Given token assente, When v1 behavior (tab disabilitato),
  Then preservato (backward compat).

## 6. Test Automation Strategy

- **Test Levels**: Unit (orchestrator, hook), Integration (API endpoint
  con mock Replicate).
- **Frameworks**: Vitest, mock `fetch` per Replicate.
- **Test Data Management**: fixture `Logo` inline, mock response Replicate.
- **CI/CD Integration**: `npm test` pre-push.
- **Coverage Requirements**: ≥80% su nuovi file.
- **Test nuovi** (~12):
  - `logoOrchestrator.test.ts`: 4 test (generate, parse schema fail, merge
    preserve logoUrl, trackUsage admin skip)
  - `useAILogo.test.ts`: 3 test (generate success, error hint, token check)
  - `api/__tests__/aiLogo.test.ts`: 5 test (config true/false, generate
    200, generate 503 no token, rate-limit 429)

## 7. Rationale & Context

Tab AI disabilitato in v1 è placeholder. Utente vede potenzialità ma
non può usarla. v2 abilita con guard (no breaking se token assente).
Replicate scelto perché Recraft-V3 produce SVG pulito (modificabile in
Illustrator). Alternativa (DALL-E) produce raster, non coerente con v1
SVG builder. Proxy server-side = token sicuro. Rate-limit 10/min (logo
generation è heavy, meno richieste di copia flyer).

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: Replicate API — `REPLICATE_API_TOKEN`, modello Recraft-V3
  (o alternativo). Timeout 60s.

### Third-Party Services
- **SVC-001**: Replicate — capability: image/SVG generation, SLA: best-
  effort (non realtime).

### Infrastructure Dependencies
- **INF-001**: Vercel Serverless Function (`api/index.ts`).
- **INF-002**: `REPLICATE_API_TOKEN` env var (Vercel, scope Production+
  Preview).

### Data Dependencies
- **DAT-001**: spec 3 `logoSystem.ts` (prompt).
- **DAT-002**: spec 5 `BaseOrchestrator` (base class).
- **DAT-003**: `src/utils/documentSchemas.ts` `logoSchema` (Logo shape).
- **DAT-004**: `src/components/LogoEditor.tsx` (tab AI modify).

### Technology Platform Dependencies
- **PLT-001**: TypeScript, Vitest, zod.

### Compliance Dependencies
- **COM-001**: Token server-side only (mai nel bundle). Conforme AGENTS.md
  "Never expose DEEPSEEK_API_KEY".

## 9. Examples & Edge Cases

**Esempio `LogoEditor` tab AI** (estratto):

```typescript
function LogoAiTab({ logo, onChange }: Props) {
  const { enabled } = useLogoAiConfig(); // GET /ai/logo-config
  const { generate, isProcessing, logs } = useAILogo();

  if (!enabled) {
    return <div>AI generation non disponibile. Configura
      REPLICATE_API_TOKEN su Vercel e upgrada a Pro.</div>;
  }

  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      const result = await generate(logo, brief);
      if (result.applied) onChange(result.logo);
    }}>
      <textarea value={brief} onChange={...} placeholder="Logo per pizzeria moderna" />
      <select value={sector} onChange={...}>
        <option value="food">Food</option>
        <option value="tech">Tech</option>
        ...
      </select>
      <button disabled={isProcessing}>Genera</button>
    </form>
  );
}
```

**Edge case — Replicate timeout**: se 60s superati, 504 Gateway Timeout.
Client mostra "AI troppo lento, riprova". Mitigazione: Vercel Pro (60s+
timeout) se frequente.

**Edge case — token scaduto**: Replicate ritorna 401. Proxy mappa a 503
"Token non valido". Client mostra "Configura token".

**Edge case — output AI invalido**: `iconName: 'Foo'` non in allowlist.
`logoAIOutputSchema.safeParse` fail. `applied: false`, log error. AI può
ripescare (retry 1x come useAI).

## 10. Validation Criteria

- Tutti AC-001..012 verdi.
- `src/ai/logoOrchestrator.ts` esiste, `extends BaseOrchestrator`.
- `src/hooks/useAILogo.ts` esiste.
- 2 nuovi endpoint in `api/index.ts`.
- `src/components/LogoEditor.tsx` tab AI attivo condizionalmente.
- `npm test` verde (1662 + ~12 nuovi).
- `npm run typecheck` verde.

## 11. Related Specifications / Further Reading

- `spec/spec-tool-ai-prompt-new-modules.md` — logo prompt (spec 3).
- `spec/spec-architecture-ai-base-orchestrator.md` — BaseOrchestrator (spec 5).
- `spec/spec-architecture-ai-prompt-registry.md` — promptRegistry (spec 4).
- `src/components/LogoEditor.tsx` — file modify.
- `src/utils/documentSchemas.ts` — `logoSchema`, `createLogoTemplate`.