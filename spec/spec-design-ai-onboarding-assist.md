---
title: AI Onboarding Assist — Suggerimenti displayName/company/profession da nome
version: 1.0
date_created: 2026-07-05
last_updated: 2026-07-05
owner: Giovanni Cidu
tags: [design, ai, onboarding, feature, suggest, ux]
---

# Introduction

`OnboardingModal.tsx` step 0 chiede displayName, step 1 company, step 2
profession. L'utente compila a mano. Questa spec aggiunge bottone
"Suggerisci da nome" che usa AI per generare 3 opzioni di
company/profession + defaultColor basati su nome+settore. Riduce
attrito onboarding. Dipende da spec 3 (onboarding prompt), spec 5
(BaseOrchestrator), spec 4 (promptRegistry).

## 1. Purpose & Scope

**Purpose**: AI assist in onboarding per ridurre compilazione manuale.

**Scope**:
- Nuovo `src/ai/onboardingOrchestrator.ts`
- Nuovo `src/hooks/useAIOnboarding.ts`
- Modifica `src/components/OnboardingModal.tsx` (bottone "Suggerisci"
  step 0)
- Nuovo endpoint `POST /ai/onboarding-suggest` in `api/index.ts`
- Nuovi test

**Audience**: nuovo utente in onboarding.

**Assunzioni**:
- Dipende da spec 3 (onboardingSystem prompt), spec 5 (BaseOrchestrator),
  spec 4 (promptRegistry).
- AI chiamata solo se utente clicca bottone (non automatica, niente
  AI senza consenso).
- `onboardingSuggestSchema` Zod valida output AI.
- Nome utente già disponibile da step 0 input (o da auth user.email).
- Settore opzionale (step 2 input profession può influenzare).

## 2. Definitions

- **Onboarding AI assist**: AI suggerisce company/profession/color basati
  su nome+settore.
- **Suggest trigger**: bottone "Suggerisci da nome" in OnboardingModal
  step 0.
- **Opt-in**: AI non chiamata automaticamente, solo su click.

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: Creare `src/ai/onboardingOrchestrator.ts` con
  `OnboardingAIOrchestrator extends BaseOrchestrator`:
  - `suggest(name: string, sector?: string, options?: { modelId?; userEmail? }): Promise<OnboardingSuggestResult>`
  - Usa `promptRegistry.getPrompt('onboarding-system')` per system
  - Usa `buildOnboardingSuggestPrompt(name, sector)` per user
  - `onboardingSuggestSchema` Zod valida
    `{ displayName, companySuggestions[3], professionSuggestions[3], defaultColor }`
  - `trackUsage` se non admin
- **REQ-002**: `OnboardingSuggestResult = { suggestions: OnboardingSuggestions; response: string; sessionId: string; applied: boolean }`.
- **REQ-003**: `onboardingSuggestSchema`:
  ```typescript
  const onboardingSuggestSchema = z.object({
    displayName: z.string().max(40),
    companySuggestions: z.array(z.string().max(60)).length(3),
    professionSuggestions: z.array(z.string().max(50)).length(3),
    defaultColor: z.string().regex(/^#[0-9a-fA-F]{6}$/)
  });
  ```
- **REQ-004**: Creare `src/hooks/useAIOnboarding.ts`:
  - `useAIOnboarding(userEmail?): { suggest, isProcessing, logs, reset }`
  - `suggest(name, sector?, options?): Promise<OnboardingSuggestResult>`
  - Pattern useAIFlyer (log cap 40, token check)
- **REQ-005**: Endpoint `POST /ai/onboarding-suggest`:
  - Zod: `{ name: z.string().max(50), sector: z.string().optional(), model?: string, userEmail?: string.email() }`
  - Rate-limit scope `aiOnboarding` 5/min/IP (meno frequente, onboarding
    è una tantum)
  - Timeout 25s
  - Proxy DeepSeek
- **REQ-006**: Modifica `OnboardingModal.tsx` step 0:
  - Aggiungere bottone "Suggerisci da nome" (sotto input displayName)
  - Su click: chiama `useAIOnboarding.suggest(name, sector)`, se
    `applied: true`:
    - Popola displayName con suggestions.displayName
    - Salva companySuggestions/professionSuggestions per step 1/2
    (dropdown suggerimenti)
    - Popola defaultColor step 3
  - Loading state durante AI call
  - Error state se AI fallisce (fallback a compilazione manuale)
- **REQ-007**: Step 1 (company): se suggestions disponibili, mostra
  dropdown con 3 opzioni + input libero. Utente sceglie o scrive.
- **REQ-008**: Step 2 (profession): stesso pattern, 3 opzioni +
  input libero.
- **REQ-009**: Step 3 (color): se suggestions.defaultColor presente,
  preseleziona quello.
- **REQ-010**: AI è OPT-IN: bottone non auto-click. Se utente non
  clicca, onboarding procede manuale (come v1).
- **CON-001**: Zero breaking change. Onboarding manuale preservato se
  bottone non cliccato.
- **CON-002**: Dipende da spec 3, 4, 5.
- **CON-003**: `name` sanitize via `sanitizeOnboardingName` (spec 3).
- **CON-004**: Rate-limit 5/min (onboarding è evento raro, niente abuse
  rischio).
- **GUD-001**: Suggerimenti sono OPZIONALI. Utente può ignorarli e
  scrivere a mano.
- **PAT-001**: AI assist non blocca onboarding. Se AI fail, fallback
  manuale silenzioso.

## 4. Interfaces & Data Contracts

**OnboardingAIOrchestrator**:

```typescript
export class OnboardingAIOrchestrator extends BaseOrchestrator {
  suggest(name: string, sector: string | undefined, options?: {
    modelId?: string;
    userEmail?: string;
  }): Promise<OnboardingSuggestResult>;
}

export type OnboardingSuggestions = {
  displayName: string;
  companySuggestions: string[];
  professionSuggestions: string[];
  defaultColor: string;
};

export type OnboardingSuggestResult = {
  suggestions: OnboardingSuggestions;
  response: string;
  sessionId: string;
  applied: boolean;
};
```

**API endpoint**:

| Path | Method | Zod | Rate-limit | Timeout |
|------|--------|-----|------------|---------|
| `/ai/onboarding-suggest` | POST | `aiOnboardingSchema` | `aiOnboarding` 5/min/IP | 25s |

**aiOnboardingSchema**:

```typescript
const aiOnboardingSchema = z.object({
  name: z.string().max(50),
  sector: z.string().optional(),
  model: z.string().optional(),
  userEmail: z.string().email().optional()
});
```

**Response** (200):

```json
{
  "data": {
    "displayName": "Giovanni",
    "companySuggestions": ["Giovanni Studio", "Giovanni Consulting", "Giovanni Web"],
    "professionSuggestions": ["Sviluppatore", "Consulente", "Designer"],
    "defaultColor": "#1A1A1A"
  }
}
```

## 5. Acceptance Criteria

- **AC-001**: Given `OnboardingAIOrchestrator.suggest("Giovanni", "tech")`,
  When eseguito, Then ritorna `OnboardingSuggestResult` con 3 company e
  3 profession.
- **AC-002**: Given `onboardingSuggestSchema.safeParse` con 2 company
  (length 3 required), When eseguito, Then fail.
- **AC-003**: Given `onboardingSuggestSchema.safeParse` con
  `defaultColor: 'red'`, When eseguito, Then fail (regex `#RRGGBB`).
- **AC-004**: Given POST `/ai/onboarding-suggest` con name valido, When
  6a richiesta in 60s, Then 429.
- **AC-005**: Given `OnboardingModal` step 0, When render, Then bottone
  "Suggerisci da nome" presente.
- **AC-006**: Given click bottone "Suggerisci", When AI ritorna
  suggestions, Then displayName popolato + companySuggestions salvati
  per step 1.
- **AC-007**: Given step 1 con suggestions, When render, Then dropdown
  mostra 3 opzioni + input libero.
- **AC-008**: Given AI fail (network error), When bottone cliccato,
  Then error toast + fallback manuale (onboarding procede).
- **AC-009**: Given bottone NON cliccato, When onboarding procede, Then
  manuale (come v1, niente AI).
- **AC-010**: Given `npm test`, Then 1662+ verdi.
- **AC-011**: Given `npm run typecheck`, Then verde.

## 6. Test Automation Strategy

- **Test Levels**: Unit (orchestrator, schema), Component (OnboardingModal
  con AI button), Integration (API endpoint).
- **Frameworks**: Vitest, React Testing Library.
- **Test Data Management**: fixture name/sector.
- **Coverage Requirements**: ≥80% nuovi file.
- **Test nuovi** (~12):
  - `onboardingOrchestrator.test.ts`: 4 test (suggest, schema fail
    length, schema fail color, admin skip)
  - `useAIOnboarding.test.ts`: 3 test (suggest success, error fallback,
    token check)
  - `OnboardingModal.aiSuggest.test.tsx`: 3 test (bottone presente,
    click popola, error fallback)
  - `api/__tests__/aiOnboarding.test.ts`: 2 test (200, 429)

## 7. Rationale & Context

Onboarding è momento critico (prima esperienza). Compilazione manuale =
attrito. AI suggerisce, utente sceglie (3 opzioni, non 1), riduce tempo
onboarding da ~90s a ~30s. Opt-in perché AI su dati personali (nome) può
essere privacy-sensitive (anche se niente PII beyond name). Costo AI:
~€0.005/suggest (1 chiamata, output piccolo). ROI: riduzione drop-off
onboarding.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: DeepSeek V4 API (via proxy).

### Third-Party Services
- Nessuna.

### Infrastructure Dependencies
- **INF-001**: Vercel Serverless Function.

### Data Dependencies
- **DAT-001**: spec 3 `onboardingSystem.ts` (prompt).
- **DAT-002**: spec 5 `BaseOrchestrator`.
- **DAT-003**: spec 4 `promptRegistry`.
- **DAT-004**: `src/components/OnboardingModal.tsx` (file modify).

### Technology Platform Dependencies
- **PLT-001**: TypeScript, React, Vitest.

### Compliance Dependencies
- **COM-001**: AI elabora solo `name` + `sector` (no email, no telefono).
  GDPR-friendly. Niente PII beyond nome utente (già fornito a login).

## 9. Examples & Edge Cases

**Esempio OnboardingModal step 0 con AI**:

```typescript
function OnboardingStep0({ value, onChange, suggestions, onSuggest }) {
  return (
    <div>
      <label>Nome visualizzato</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
      <button onClick={onSuggest} disabled={isProcessing}>
        {isProcessing ? 'Suggerendo...' : 'Suggerisci da nome'}
      </button>
      {suggestions && (
        <div>
          <p>Suggeriti: {suggestions.displayName}</p>
        </div>
      )}
    </div>
  );
}
```

**Edge case — nome vuoto**: `suggest("", "tech")` → AI riceve "Logo per
attività tech" generico. Suggerimenti neutri.

**Edge case — settore sconosciuto**: `suggest("Mario", "astronautica")` →
AI usa generici ("Mario Studio", "Mario Consulting"). defaultColor neutro
`#1A1A1A`.

**Edge case — AI ritorna 2 company (length fail)**: `applied: false`,
retry 1x, se ancora fail fallback manuale (bottone nascosto o error
toast).

**Edge case — utente non vuole AI**: bottone NON cliccato, onboarding
procede manuale. AI mai chiamata. Niente tracking.

## 10. Validation Criteria

- Tutti AC-001..011 verdi.
- `src/ai/onboardingOrchestrator.ts` esiste.
- `src/hooks/useAIOnboarding.ts` esiste.
- `OnboardingModal.tsx` ha bottone "Suggerisci da nome".
- Endpoint `POST /ai/onboarding-suggest` in `api/index.ts`.
- `npm test` verde (1662 + ~12 nuovi).
- `npm run typecheck` verde.

## 11. Related Specifications / Further Reading

- `spec/spec-tool-ai-prompt-new-modules.md` — onboarding prompt (spec 3).
- `spec/spec-architecture-ai-base-orchestrator.md` — BaseOrchestrator (spec 5).
- `spec/spec-architecture-ai-prompt-registry.md` — promptRegistry (spec 4).
- `src/components/OnboardingModal.tsx` — file modify.
- `src/utils/onboarding.ts` — helpers esistenti (shouldShowOnboarding).