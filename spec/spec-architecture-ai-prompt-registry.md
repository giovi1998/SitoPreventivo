---
title: AI Prompt Registry — Centralizzazione prompt builder
version: 1.0
date_created: 2026-07-05
last_updated: 2026-07-05
owner: Giovanni Cidu
tags: [architecture, ai, prompt-engineering, registry-pattern, refactor]
---

# Introduction

I 6 prompt builder (3 esistenti in `src/ai/prompts/` + 3 nuovi da spec 3)
sono importati direttamente dai rispettivi orchestratori. Non c'è un
registry centralizzato come per i provider (`providerRegistry`). Questa
spec introduce `promptRegistry` con stesso pattern: `register(id, builderFn)`,
`getPrompt(id, ctx?)`, `listPrompts()`. Migrazione dei 6 prompt esistenti
con deprecation delle import dirette (backward compat per 1 release).

## 1. Purpose & Scope

**Purpose**: centralizzare gestione prompt, abilitare lookup dinamico,
preparare a future feature (es. A/B testing prompt, override via env,
prompt versioning).

**Scope**:
- Nuovo `src/ai/prompts/registry.ts`
- Nuovo `src/ai/prompts/__tests__/promptRegistry.test.ts`
- Refactor import in `src/ai/index.ts`, `cardOrchestrator.ts`,
  `flyerOrchestrator.ts` (uso registry invece di import diretto)
- Deprecation comment sui 3 file prompt esistenti (non cancellazione)

**Audience**: sviluppatore AI.

**Assunzioni**:
- I 6 builder esistenti mantengono signature identiche.
- `promptRegistry` è singleton (come `providerRegistry`).
- Backward compat: `getPrompt(id)` fallback se niente context.
- I 3 nuovi prompt (spec 3) sono registrati in questa spec.

## 2. Definitions

- **Prompt builder**: funzione `(ctx?: PromptContext) => string` che
  ritorna il system prompt o user prompt.
- **PromptRegistry**: singleton `AIPromptRegistry`, pattern uguale a
  `AIProviderRegistry`.
- **PromptContext**: oggetto opzionale passato al builder per prompt
  parametrici (es. `compact` per quote, `tone`/`context` per flyer copy).
- **Prompt ID**: stringa identificativa (es. `'quote-system'`,
  `'card-system'`, `'flyer-system'`, `'flyer-copy'`, `'logo-system'`,
  `'social-system'`, `'onboarding-system'`).

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: Creare `src/ai/prompts/registry.ts` con:
  - `export class AIPromptRegistry`
  - `export const promptRegistry = new AIPromptRegistry()` (singleton)
  - API:
    - `register(id: string, builder: PromptBuilder): void`
    - `getPrompt(id: string, ctx?: PromptContext): string` (throw se id
      mancante, ctx passato al builder)
    - `hasPrompt(id: string): boolean`
    - `listPrompts(): { id, description }[]`
    - `setDefaultId(id: string): void`
    - `getDefaultId(): string`
- **REQ-002**: Definire tipi:
  ```typescript
  export type PromptContext = Record<string, unknown>;
  export type PromptBuilder = (ctx?: PromptContext) => string;
  ```
- **REQ-003**: Registrare 7 prompt nel costruttore del registry (o in
  modulo init):
  - `'quote-system'` → `buildSystemPrompt` (compact default, `ctx.compact`
    override)
  - `'card-system'` → `buildCardSystemPrompt`
  - `'flyer-system'` → `buildFlyerSystemPrompt`
  - `'flyer-copy'` → `(ctx) => buildFlyerCopyPrompt(ctx.brief, ctx.tone, ctx.context)`
  - `'logo-system'` → `buildLogoSystemPrompt` (spec 3)
  - `'social-system'` → `buildSocialSystemPrompt` (spec 3)
  - `'onboarding-system'` → `buildOnboardingSystemPrompt` (spec 3)
- **REQ-004**: Refactor `AIOrchestrator` (src/ai/index.ts): sostituire
  `import { buildSystemPrompt }` con `promptRegistry.getPrompt('quote-system', {compact: true})`. Mantenere backward compat: se builder throw,
  fallback a import diretto (deprecation).
- **REQ-005**: Refactor `CardAIOrchestrator`: `promptRegistry.getPrompt('card-system')`.
- **REQ-006**: Refactor `FlyerAIOrchestrator`: `promptRegistry.getPrompt('flyer-system')` per system, `promptRegistry.getPrompt('flyer-copy', {brief, tone, context})` per user prompt.
- **REQ-007**: Deprecation comment (JSDoc `@deprecated`) sui 3 file
  prompt esistenti: "Usare `promptRegistry.getPrompt('xxx-system')`.
  Import diretto deprecato, sarà rimosso v3."
- **REQ-008**: Nuovi prompt (logo/social/onboarding da spec 3) registrati
  direttamente, niente import diretto da orchestratori futuri.
- **CON-001**: Zero breaking change. Tutti i test esistenti (1662+)
  devono passare.
- **CON-002**: `promptRegistry` è singleton, istanziato a modulo load
  (come `providerRegistry`).
- **CON-003**: `getPrompt` lancia `Error` se id non registrato (fail
  fast, come `providerRegistry.getProvider`).
- **GUD-001**: Pattern identico a `providerRegistry` (metodi, nomi,
  shape).
- **GUD-002**: Registry non persiste prompt a DB/localStorage. In-memory
  solo (come providerRegistry).
- **PAT-001**: Builder function registrate sono pure (no side effect).
- **PAT-002**: `PromptContext` è `Record<string, unknown>` per
  flessibilità. Builder fa cast interno ai tipi attesi.

## 4. Interfaces & Data Contracts

**API registry**:

```typescript
export type PromptContext = Record<string, unknown>;
export type PromptBuilder = (ctx?: PromptContext) => string;

export class AIPromptRegistry {
  register(id: string, builder: PromptBuilder): void;
  getPrompt(id: string, ctx?: PromptContext): string;
  hasPrompt(id: string): boolean;
  listPrompts(): { id: string; description: string }[];
  setDefaultId(id: string): void;
  getDefaultId(): string;
}

export const promptRegistry = new AIPromptRegistry();
```

**Uso negli orchestratori** (esempio card):

```typescript
// PRIMA
import { buildCardSystemPrompt } from './prompts/cardSystem';
const system = buildCardSystemPrompt();

// DOPO
import { promptRegistry } from './prompts/registry';
const system = promptRegistry.getPrompt('card-system');
```

**Uso con context** (flyer copy):

```typescript
// PRIMA
import { buildFlyerCopyPrompt } from './prompts/flyerSystem';
const userPrompt = buildFlyerCopyPrompt(brief, tone, context);

// DOPO
const userPrompt = promptRegistry.getPrompt('flyer-copy', { brief, tone, context });
```

**Prompt registrati** (7):

| ID | Builder | Context attesi |
|----|---------|----------------|
| `quote-system` | `buildSystemPrompt` | `{ compact?: boolean }` |
| `card-system` | `buildCardSystemPrompt` | (nessuno) |
| `flyer-system` | `buildFlyerSystemPrompt` | (nessuno) |
| `flyer-copy` | `buildFlyerCopyPrompt` | `{ brief, tone, context }` |
| `logo-system` | `buildLogoSystemPrompt` | (nessuno) |
| `social-system` | `buildSocialSystemPrompt` | (nessuno) |
| `onboarding-system` | `buildOnboardingSystemPrompt` | (nessuno) |

## 5. Acceptance Criteria

- **AC-001**: Given `promptRegistry`, When si chiama
  `getPrompt('card-system')`, Then ritorna stringa identica a
  `buildCardSystemPrompt()`.
- **AC-002**: Given `promptRegistry`, When si chiama
  `getPrompt('quote-system', {compact:false})`, Then ritorna stringa
  identica a `buildSystemPrompt(false)`.
- **AC-003**: Given `promptRegistry`, When si chiama
  `getPrompt('flyer-copy', {brief:'x', tone:'formale', context:{...}})`,
  Then ritorna stringa identica a
  `buildFlyerCopyPrompt('x','formale',{...})`.
- **AC-004**: Given `promptRegistry`, When si chiama
  `getPrompt('nonexistent')`, Then lancia `Error`.
- **AC-005**: Given `promptRegistry.hasPrompt('quote-system')`, When
  eseguito, Then ritorna `true`.
- **AC-006**: Given `promptRegistry.listPrompts()`, When eseguito, Then
  ritorna array con ≥7 entry.
- **AC-007**: Given `AIOrchestrator.processPrompt`, When eseguito, Then
  usa `promptRegistry.getPrompt('quote-system')` (verificabile via spy
  in test).
- **AC-008**: Given `npm test`, When eseguito, Then 1662+ test esistenti
  verdi (no regression).
- **AC-009**: Given `npm run typecheck`, When eseguito, Then verde.

## 6. Test Automation Strategy

- **Test Levels**: Unit (registry API, builder wiring).
- **Frameworks**: Vitest.
- **Test Data Management**: fixture inline.
- **CI/CD Integration**: `npm test` pre-push.
- **Coverage Requirements**: ≥90% su `registry.ts` (file nuovo, target
  alto).
- **Test nuovi** (~8):
  - `promptRegistry.test.ts`:
    - register + getPrompt round-trip
    - getPrompt con context
    - getPrompt id inesistente throw
    - hasPrompt true/false
    - listPrompts ≥7
    - setDefaultId/getDefaultId
    - spy su orchestratori (verify uso registry)
    - backward compat (import diretto ancora funziona)

## 7. Rationale & Context

`providerRegistry` dimostra che il pattern registry funziona bene per
estensibilità. I prompt sono sparsi in 3+3 file senza centralizzazione:
per aggiungere un prompt nuovo serve toccare ogni orchestratore. Con
`promptRegistry`, un nuovo orchestratore chiama `getPrompt(id)` senza
sapere dove il builder è definito. Future feature: A/B testing (due
builder per stesso id, random choice), override via env
(`PROMPT_OVERRIDE_QUOTE=path` carica file esterno), versioning (id
`quote-system-v2`). Backward compat garantisce zero rischio iniziale.

## 8. Dependencies & External Integrations

### External Systems
- Nessuno.

### Third-Party Services
- Nessuno.

### Infrastructure Dependencies
- Nessuna.

### Data Dependencies
- **DAT-001**: `src/ai/prompts/system.ts`, `cardSystem.ts`, `flyerSystem.ts`
  (builder esistenti, mantengono signature).
- **DAT-002**: `src/ai/prompts/logoSystem.ts`, `socialSystem.ts`,
  `onboardingSystem.ts` (nuovi da spec 3).
- **DAT-003**: `src/ai/providers/registry.ts` — pattern riferimento.

### Technology Platform Dependencies
- **PLT-001**: TypeScript, Vitest.

### Compliance Dependencies
- Nessuna.

## 9. Examples & Edge Cases

**Esempio registro init** (in `registry.ts`):

```typescript
import { buildSystemPrompt } from './system';
import { buildCardSystemPrompt } from './cardSystem';
import { buildFlyerSystemPrompt, buildFlyerCopyPrompt } from './flyerSystem';
// Nuovi da spec 3:
import { buildLogoSystemPrompt } from './logoSystem';
import { buildSocialSystemPrompt } from './socialSystem';
import { buildOnboardingSystemPrompt } from './onboardingSystem';

class AIPromptRegistry {
  private builders = new Map<string, PromptBuilder>();
  private descriptions = new Map<string, string>();
  private defaultId: string | null = null;

  register(id: string, builder: PromptBuilder, description?: string): void {
    this.builders.set(id, builder);
    if (description) this.descriptions.set(id, description);
  }
  getPrompt(id: string, ctx?: PromptContext): string {
    const b = this.builders.get(id);
    if (!b) throw new Error(`Prompt non registrato: ${id}`);
    return b(ctx);
  }
  hasPrompt(id: string): boolean { return this.builders.has(id); }
  listPrompts() {
    return [...this.builders.keys()].map(id => ({
      id,
      description: this.descriptions.get(id) ?? ''
    }));
  }
  setDefaultId(id: string): void {
    if (!this.builders.has(id)) throw new Error(`Prompt non registrato: ${id}`);
    this.defaultId = id;
  }
  getDefaultId(): string { return this.defaultId ?? ''; }
}

export const promptRegistry = new AIPromptRegistry();

// Registrazione default
promptRegistry.register('quote-system', (ctx) => buildSystemPrompt(ctx?.compact ?? true), 'Quote system prompt (compact default)');
promptRegistry.register('card-system', () => buildCardSystemPrompt(), 'Card system prompt');
promptRegistry.register('flyer-system', () => buildFlyerSystemPrompt(), 'Flyer system prompt');
promptRegistry.register('flyer-copy', (ctx) => buildFlyerCopyPrompt(ctx.brief, ctx.tone, ctx.context), 'Flyer copy user prompt');
promptRegistry.register('logo-system', () => buildLogoSystemPrompt(), 'Logo system prompt (v2)');
promptRegistry.register('social-system', () => buildSocialSystemPrompt(), 'Social system prompt');
promptRegistry.register('onboarding-system', () => buildOnboardingSystemPrompt(), 'Onboarding system prompt');
promptRegistry.setDefaultId('quote-system');
```

**Edge case — builder throw**: se `buildFlyerCopyPrompt` throw per context
mancante, `getPrompt` propaga l'errore. L'orchestratore deve catch e
restituire error user-friendly (pattern esistente).

**Edge case — id duplicato**: `register('quote-system', newBuilder)`
sovrascrive silenziosamente. Aggiungere warning log in `register` se
id già presente (best practice, non hard requirement).

## 10. Validation Criteria

- Tutti AC-001..009 verdi.
- `src/ai/prompts/registry.ts` esiste con API completa.
- `src/ai/prompts/__tests__/promptRegistry.test.ts` con ≥8 test.
- 3 orchestratori refactorati (verificabile via grep: `promptRegistry.getPrompt`
  appare in `index.ts`, `cardOrchestrator.ts`, `flyerOrchestrator.ts`).
- `npm test` verde (1662 + ~8 nuovi).
- `npm run typecheck` verde.

## 11. Related Specifications / Further Reading

- `spec/spec-tool-ai-prompt-v2.md` — migliora 3 prompt esistenti.
- `spec/spec-tool-ai-prompt-new-modules.md` — 3 nuovi prompt.
- `src/ai/providers/registry.ts` — pattern riferimento.
- `src/ai/prompts/system.ts`, `cardSystem.ts`, `flyerSystem.ts` — file
  da mantenere + deprecate.