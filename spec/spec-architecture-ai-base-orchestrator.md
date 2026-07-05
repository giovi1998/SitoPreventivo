---
title: AI Base Orchestrator — Estrazione classe base per eliminare duplicazione
version: 1.0
date_created: 2026-07-05
last_updated: 2026-07-05
owner: Giovanni Cidu
tags: [architecture, ai, refactor, base-class, dedup, orchestrator]
---

# Introduction

Tre orchestratori (`AIOrchestrator` in `src/ai/index.ts`,
`CardAIOrchestrator` in `cardOrchestrator.ts`, `FlyerAIOrchestrator` in
`flyerOrchestrator.ts`) condividono ~150 righe di boilerplate: funzione
`sanitizeAIResponse` (duplicata in 3 file), gestione session via
`chatStore`, stream handling, parse JSON, usage tracking. Questa spec
estrae una `BaseOrchestrator` abstract che elimina duplicazione mantenendo
API pubblica identica (zero breaking change).

## 1. Purpose & Scope

**Purpose**: ridurre duplicazione, centralizzare logica condivisa,
predisporre a nuovi orchestratori (logo v2, social, onboarding — spec
11-13) che estendono la base invece di copiare 150 righe.

**Scope**:
- Nuovo `src/ai/BaseOrchestrator.ts`
- Refactor `src/ai/index.ts` (`AIOrchestrator extends BaseOrchestrator`)
- Refactor `src/ai/cardOrchestrator.ts` (`CardAIOrchestrator extends BaseOrchestrator`)
- Refactor `src/ai/flyerOrchestrator.ts` (`FlyerAIOrchestrator extends BaseOrchestrator`)
- Rimozione `sanitizeAIResponse` duplicata (3 copie → 1 in base)
- Test `src/ai/__tests__/baseOrchestrator.test.ts`
- Aggiornamento test esistenti (se spy su `sanitizeAIResponse` modulo)

**Audience**: sviluppatore AI.

**Assunzioni**:
- API pubblica dei 3 orchestratori (`processPrompt`, `processCardPrompt`,
  `generateCopy`, `refineCopy`) resta identica.
- `ToolRegistry` resta solo in `AIOrchestrator` (quote); card/flyer non
  hanno tool. Base non gestisce tool.
- `chatStore` singleton resta invariato.
- `providerRegistry` singleton resta invariato.
- Multi-turn (solo quote) resta in `AIOrchestrator`, non in base.

## 2. Definitions

- **BaseOrchestrator**: classe abstract con metodi condivisi (sanitize,
  session, stream, parse, usage). Sottoclassi implementano
  `processPrompt`/`processCardPrompt`/`generateCopy` con logica specifica.
- **sanitizeAIResponse**: strip markdown fence + estrazione `{...}`.
  Attualmente duplicata in 3 file con identica implementazione.
- **Session management**: `activeSessionId` locale + `chatStore` per
  history. Comune a tutti e 3.
- **Stream handling**: accumulazione `content`, `toolCalls`, `usage` da
  chunk stream. Comune (con variazioni per tool, solo quote).
- **Usage tracking**: `AIResponse.usage` con `promptTokens`,
  `completionTokens`, `totalTokens`. Comune.
- **Multi-turn**: solo quote, dopo tool. Resta in `AIOrchestrator`.

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: Creare `src/ai/BaseOrchestrator.ts` con:
  - `export abstract class BaseOrchestrator`
  - Campo `protected activeSessionId: string | null = null`
  - Campo `protected chatStore = chatStore` (import singleton)
  - Metodi protected:
    - `sanitizeAIResponse(raw: string): string` (implementazione reale,
      unica copia)
    - `getCurrentSessionId(): string | null`
    - `resetSession(): void` (clear `activeSessionId` + `chatStore.clearSession`)
    - `ensureSession(): string` (create se null, set `activeSessionId`)
    - `buildMessages(systemPrompt: string, userPrompt: string): ChatMessage[]`
      (system + user, usa `chatStore.addMessage`)
    - `parseJsonResponse<T>(raw: string, schema?: ZodSchema<T>):
      { ok: true, data: T } | { ok: false, error: string }`
    - `handleStream(provider, messages, options, callbacks): Promise<AIResponse>`
      (accumula content/toolCalls/usage da chunk)
    - `trackUsage(usage: AIUsage, userEmail?: string): void` (dataService
      trackTokens se non admin)
    - `getProviderList()` (delegato a `providerRegistry.listProviders`)
  - Metodi abstract:
    - `processPrompt(...)` (signature varia per sottoclasse, base non
      impone)
  - Nessun metodo pubblico nuovo (tutti protected/abstract)
- **REQ-002**: `AIOrchestrator` (src/ai/index.ts) `extends BaseOrchestrator`:
  - Rimuovere `sanitizeAIResponse` locale (usa base)
  - Rimuovere `getCurrentSessionId`/`resetSession` locali (usa base)
  - Mantenere `registerTools` privato (quote-specific)
  - Mantenere `processPrompt` pubblico (signature identica)
  - Mantenere `getProviderList` pubblico (delega a base)
  - Mantenere `needsTools`/`validateToolArgs` modulo-privati (non in base)
  - Multi-turn resta in `processPrompt` (usa `handleStream`/`parseJsonResponse`
    della base)
- **REQ-003**: `CardAIOrchestrator` `extends BaseOrchestrator`:
  - Rimuovere `sanitizeAIResponse` locale
  - Rimuovere `getCurrentSessionId`/`resetSession` locali
  - Mantenere `processCardPrompt` pubblico (signature identica)
  - Usa `handleStream`/`parseJsonResponse` della base
- **REQ-004**: `FlyerAIOrchestrator` `extends BaseOrchestrator`:
  - Rimuovere `sanitizeAIResponse` locale
  - Rimuovere session methods locali
  - Mantenere `generateCopy`/`refineCopy`/`runPrompt` (signature identica)
  - Usa base per session/sanitize/parse
- **REQ-005**: `parseJsonResponse` supporta Zod schema opzionale. Se
  passato, `safeParse`; se fallisce, ritorna `{ok:false, error}`. Se non
  passato, solo `JSON.parse` + catch.
- **REQ-006**: `handleStream` ritorna `AIResponse` con `content`,
  `toolCalls`, `usage`. Gestisce chunk `content`/`tool_call`/`done`/`error`.
  Sottoclasse non duplica logica stream.
- **REQ-007**: `trackUsage` salta se `userEmail === 'admin@gmail.com'`
  (pattern esistente).
- **CON-001**: Zero breaking change. Signature pubbliche identiche. Test
  esistenti (1662+) verdi.
- **CON-002**: `BaseOrchestrator` è abstract (non istanziabile
  direttamente).
- **CON-003**: `ToolRegistry` non in base (quote-only). Se futuro card/
  flyer tool (spec 9), si valuterà extraction.
- **CON-004**: Niente nuovo file in `src/ai/chat/` (chatStore resta
  invariato).
- **GUD-001**: Metodi protected per sottoclassi, public solo per API
  pubblica.
- **GUD-002**: Niente override di `sanitizeAIResponse` nelle sottoclassi
  (implementazione unica, deterministica).
- **PAT-001**: `BaseOrchestrator` non gestisce prompt (delegato a
  sottoclasse o `promptRegistry`). Base = infrastruttura solo.
- **PAT-002**: Composizione > ereditarietà dove possibile: se un metodo
  non serve a tutte e 3, non metterlo in base.

## 4. Interfaces & Data Contracts

**BaseOrchestrator API** (abstract):

```typescript
export abstract class BaseOrchestrator {
  protected activeSessionId: string | null = null;
  protected chatStore: ChatStore;

  constructor() {
    this.chatStore = chatStore; // singleton
  }

  protected sanitizeAIResponse(raw: string): string;
  protected getCurrentSessionId(): string | null;
  protected resetSession(): void;
  protected ensureSession(): string;
  protected buildMessages(systemPrompt: string, userPrompt: string): ChatMessage[];
  protected parseJsonResponse<T>(raw: string, schema?: ZodSchema<T>):
    { ok: true; data: T } | { ok: false; error: string };
  protected handleStream(
    provider: AIProvider,
    messages: ChatMessage[],
    options: { tools?: ToolDefinition[]; temperature?: number; responseFormat?: 'json_object' },
    callbacks: { onStream?: (chunk: AIStreamChunk) => void; onToolStart?: ...; onToolComplete?: ... }
  ): Promise<AIResponse>;
  protected trackUsage(usage: AIUsage, userEmail?: string): void;
  public getProviderList(): { id: string; name: string; model: string; supportsStreaming: boolean; supportsTools: boolean }[];

  // Abstract: ogni sottoclasse implementa la propria
  abstract processPrompt(...args: unknown[]): Promise<unknown>;
}
```

**Sottoclassi** (signature pubbliche identiche):

```typescript
// AIOrchestrator (quote)
export class AIOrchestrator extends BaseOrchestrator {
  processPrompt(quote: PremiumQuote, userPrompt: string, options?: { modelId?; onStream?; onToolStart?; onToolComplete? }): Promise<ProcessResult>;
  get toolRegistry(): ToolRegistry;
  set toolRegistry(reg: ToolRegistry);
}

// CardAIOrchestrator
export class CardAIOrchestrator extends BaseOrchestrator {
  processCardPrompt(card: BusinessCard, userPrompt: string, options?: { modelId?; onStream? }): Promise<CardProcessResult>;
}

// FlyerAIOrchestrator
export class FlyerAIOrchestrator extends BaseOrchestrator {
  generateCopy(flyer: Flyer, brief: string, tone: FlyerTone, options?): Promise<FlyerProcessResult>;
  refineCopy(flyer: Flyer, action: FlyerRefineAction, options?): Promise<FlyerProcessResult>;
  protected runPrompt(flyer: Flyer, buildPrompt: () => string, options?, changeLabel?): Promise<FlyerProcessResult>;
}
```

**Tipi dipendenti** (da codice esistente):
- `AIResponse` (da `src/ai/providers/base.ts`): `{ content, toolCalls, usage }`
- `AIUsage`: `{ promptTokens, completionTokens, totalTokens }`
- `AIStreamChunk`: `{ type: 'content'|'tool_call'|'done'|'error', content?, toolCallId?, name?, args?, usage?, error? }`
- `ChatMessage`: `{ role: 'system'|'user'|'assistant'|'tool', content, tool_call_id?, name? }`
- `ZodSchema<T>`: da `zod`

## 5. Acceptance Criteria

- **AC-001**: Given `BaseOrchestrator`, When si tenta `new BaseOrchestrator()`,
  Then TypeScript error (abstract, non istanziabile).
- **AC-002**: Given `AIOrchestrator.processPrompt(quote, prompt)`, When
  eseguito con provider mock, Then ritorna `ProcessResult` identico a
  pre-refactor (stessa shape, stessi campi).
- **AC-003**: Given `CardAIOrchestrator.processCardPrompt(card, prompt)`,
  When eseguito, Then ritorna `CardProcessResult` identico a pre-refactor.
- **AC-004**: Given `FlyerAIOrchestrator.generateCopy(flyer, brief, tone)`,
  When eseguito, Then ritorna `FlyerProcessResult` identico a pre-refactor.
- **AC-005**: Given `sanitizeAIResponse('```json\n{"a":1}\n```')`, When
  chiamato via `AIOrchestrator` (ereditato), Then ritorna `'{"a":1}'`
  (identico a funzione modulo-privata originale).
- **AC-006**: Given 3 test suite esistenti (`orchestrator.test.ts`,
  `cardOrchestrator.test.ts`, `flyerOrchestrator.test.ts`), When si
  esegue `npm test`, Then passano senza modifiche (o con spy adjust
  minori).
- **AC-007**: Given grep `sanitizeAIResponse` in `src/ai/`, When eseguito,
  Then appare 1 sola implementazione (in `BaseOrchestrator.ts`), non 3.
- **AC-008**: Given `npm run typecheck`, When eseguito, Then verde.
- **AC-009**: Given `npm test`, When eseguito, Then 1662+ test verdi.
- **AC-010**: Given `handleStream` in `BaseOrchestrator`, When si
  simula stream con 3 chunk content + 1 done, Then accumula content +
  ritorna usage.

## 6. Test Automation Strategy

- **Test Levels**: Unit (BaseOrchestrator metodi, mock provider).
- **Frameworks**: Vitest, zod per schema test.
- **Test Data Management**: fixture inline, mock `AIProvider` esistente
  nei test orchestratori.
- **CI/CD Integration**: `npm test` pre-push.
- **Coverage Requirements**: ≥80% su `BaseOrchestrator.ts`.
- **Test nuovi** (~12):
  - `baseOrchestrator.test.ts`:
    - `sanitizeAIResponse`: 3 casi (markdown fence, raw JSON, testo con
      JSON embedded)
    - `ensureSession`: create se null, reuse se esiste
    - `resetSession`: clear activeSessionId + chatStore.clearSession spy
    - `buildMessages`: system + user corretti
    - `parseJsonResponse` senza schema: JSON valido, JSON invalid
    - `parseJsonResponse` con schema: safeParse ok, safeParse fail
    - `handleStream`: accumula content, toolCalls, usage
    - `handleStream`: gestisce chunk error
    - `trackUsage`: skip admin, chiama dataService per user
    - `getProviderList`: delega a providerRegistry
    - `processPrompt` abstract: sottoclasse concreta test implementa
    - backward compat: import `AIOrchestrator` da `src/ai/index.ts` resta
      identico

## 7. Rationale & Context

`sanitizeAIResponse` è identica in 3 file (verificato via grep). Session
management è identico. Stream handling è identico (con variazione tool
solo quote). Duplicare 150 righe × 3 = 450 righe che potrebbero divergere
in futuro (bug fix su una copia non propagate). Con base, nuovo
orchestratore (es. logo v2, spec 11) scrive solo `processPrompt` (20 righe)
invece di copiare 150. Rischio refactor: medio, mitigato da test
esistenti che garantiscono parity.

## 8. Dependencies & External Integrations

### External Systems
- Nessuno.

### Third-Party Services
- Nessuno.

### Infrastructure Dependencies
- Nessuna.

### Data Dependencies
- **DAT-001**: `src/ai/index.ts`, `cardOrchestrator.ts`, `flyerOrchestrator.ts`
  (file refactorare).
- **DAT-002**: `src/ai/chat/store.ts` (chatStore singleton, no modifica).
- **DAT-003**: `src/ai/providers/registry.ts` (providerRegistry, no
  modifica).
- **DAT-004**: `src/ai/providers/base.ts` (tipi `AIResponse`, `AIUsage`,
  `AIStreamChunk`).

### Technology Platform Dependencies
- **PLT-001**: TypeScript (abstract class, protected methods), Vitest,
  zod.

### Compliance Dependencies
- Nessuna.

## 9. Examples & Edge Cases

**Esempio `sanitizeAIResponse` in base** (unica implementazione):

```typescript
protected sanitizeAIResponse(raw: string): string {
  let s = raw.trim();
  // Strip ```json fences
  if (s.startsWith('```json')) s = s.slice(7);
  else if (s.startsWith('```')) s = s.slice(3);
  if (s.endsWith('```')) s = s.slice(0, -3);
  s = s.trim();
  // Extract first { to last }
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return s;
  return s.slice(start, end + 1);
}
```

**Esempio sottoclasse minimale** (logo v2 futuro):

```typescript
export class LogoAIOrchestrator extends BaseOrchestrator {
  async generateLogo(logo: Logo, brief: string, options?: { modelId?; onStream? }): Promise<LogoProcessResult> {
    const sessionId = this.ensureSession();
    const system = promptRegistry.getPrompt('logo-system');
    const user = buildLogoGeneratePrompt(brief, logo.sector);
    const messages = this.buildMessages(system, user);
    const provider = providerRegistry.getProvider(options?.modelId);
    const response = await this.handleStream(provider, messages, {
      temperature: 0.7,
      responseFormat: 'json_object'
    }, { onStream: options?.onStream });
    const parsed = this.parseJsonResponse(response.content, logoAIOutputSchema);
    if (!parsed.ok) return { logo, response: parsed.error, sessionId, applied: false };
    const merged = mergeLogoAIResponse(logo, parsed.data);
    this.trackUsage(response.usage, options?.userEmail);
    return { logo: merged, response: response.content, sessionId, applied: true };
  }
}
```

**Edge case — tool non in base**: `AIOrchestrator.registerTools` resta
privato in sottoclasse. Base non sa dei tool. Se futuro card/flyer tool
(spec 9), si valuterà estrarre `ToolAwareOrchestrator extends
BaseOrchestrator` come livello intermedio.

**Edge case — multi-turn**: `AIOrchestrator.processPrompt` chiama
`handleStream` poi `provider.chat` (seconda chiamata). Base non impone
single-turn. Sottoclasse può fare multi-turn liberamente.

**Edge case — test spy**: test esistenti possono spyare `sanitizeAIResponse`
come funzione modulo-privata. Dopo refactor, è metodo protected. Spy
deve puntare a `AIOrchestrator.prototype.sanitizeAIResponse`. Aggiornare
test se necessario.

## 10. Validation Criteria

- Tutti AC-001..010 verdi.
- `src/ai/BaseOrchestrator.ts` esiste, abstract, con metodi protected.
- 3 orchestratori `extends BaseOrchestrator`.
- 1 sola implementazione `sanitizeAIResponse` (grep verify).
- `src/ai/__tests__/baseOrchestrator.test.ts` con ≥12 test.
- `npm test` verde (1662 + ~12 nuovi).
- `npm run typecheck` verde.
- Line count ridotto in 3 file orchestratori (stima ~150 righe totali
  rimosse, offset da ~80 righe in BaseOrchestrator).

## 11. Related Specifications / Further Reading

- `spec/spec-data-ai-session-persistence.md` — persistenza chatStore (spec 6).
- `spec/spec-tool-ai-card-flyer-tools.md` — tool per card/flyer (spec 9).
- `spec/spec-design-ai-logo-v2.md` — nuovo orchestratore logo (spec 11).
- `src/ai/index.ts`, `cardOrchestrator.ts`, `flyerOrchestrator.ts` —
  file refactorare.
- `src/ai/providers/base.ts` — tipi `AIResponse`/`AIUsage`/`AIStreamChunk`.