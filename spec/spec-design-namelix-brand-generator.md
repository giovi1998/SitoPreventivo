---
title: Namelix-like Brand Name Generator — Onboarding AI flow completo
version: 1.0
date_created: 2026-07-05
last_updated: 2026-07-05
owner: Giovanni Cidu
tags: [design, ai, onboarding, namelix, brand-name, spec]
---

# Introduction

Estensione di spec 13 (Onboarding AI assist). L'utente arriva in
onboarding e spesso non sa cosa scrivere come displayName/companyName/
profession. Namelix.com risolve questo con un generatore di nomi brand
che fa domande (descrizione attività, mood, parole chiave) e propone
nomi. Questa spec porta lo stesso flusso in OnboardingModal: un
generatore di nome brand AI che chiede descrizione + parole chiave +
mood e propone 5 nomi brand + 3 companySuggestions + 3 profession +
defaultColor. Implementa la UX "namelix-like" completa.

## 1. Purpose & Scope

**Purpose**: ridurre attrito onboarding con generazione AI contestualizzata
di nome brand + dati profilo, nello stile namelix.com.

**Scope**:
- Nuovo `src/components/BrandNameGenerator.tsx` (componente chat step)
- Modifica `src/components/OnboardingModal.tsx` (integra BrandNameGenerator
  come step opzionale prima di 'name')
- Estende `src/ai/onboardingOrchestrator.ts`: `suggestBrandName(input)`
  metodo, output esteso con `brandNameSuggestions: string[5]`
- Estende `onboardingSuggestSchema` con `brandNameSuggestions`
- Nuovi test

**Audience**: nuovo utente in onboarding, founder (riferimento UX).

**Assunzioni**:
- Dipende da spec 13 (orchestratore esistente).
- AI è opt-in (bottone "Genera nome brand", non automatica).
- Nomi brand generati sono suggerimenti: l'utente può sceglierne uno o
  scriverne uno suo.
- No validation domain availability (out of scope v1; namelix lo fa, noi
  no perché non vendiamo domini).
- DeepSeek è il provider (no Gemini text generation qui, solo DeepSeek).

## 2. Definitions

- **Brand name**: nome commerciale dell'attività (es. "Pizzeria Da Mario",
  "Acme Design", "TechFlow"). Distinto da displayName (nome persona) e
  companyName (ragione sociale formale).
- **Namelix-like UX**: chat step (descrizione → mood → keyword → genera)
  con feedback loading e scelta multipla.
- **BrandNameGenerator**: componente React che implementa la chat step.
- **Mood**: tono del brand (minimal, bold, playful, elegant, tech, luxury).

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: Creare `src/components/BrandNameGenerator.tsx` con 3 step
  chat:
  - Step 1: "Descrivi la tua attività in 1-2 frasi" (textarea, max 300 char)
  - Step 2: "Scegli il mood" (6 bottoni: minimal, bold, playful, elegant,
    tech, luxury)
  - Step 3: "Parole chiave (opzionale, max 5, separate da virgola)" (input)
  - Step 4: "Genera" bottone → chiama orchestratore → mostra 5 nomi
    brand + applica il primo a companySuggestions (l'utente può poi
    sceglierne uno in OnboardingModal step 'company')
- **REQ-002**: Output `suggestBrandName(input)` esteso:
  ```typescript
  {
    brandNameSuggestions: string[5],  // max 30 char ciascuno
    displayName: string,             // derivato dal primo brand name se vuoto
    companySuggestions: string[3],   // ragione sociale formale
    professionSuggestions: string[3],
    defaultColor: string
  }
  ```
- **REQ-003**: Estende `onboardingSuggestSchema` con
  `brandNameSuggestions: z.array(z.string().max(30)).length(5)`.
- **REQ-004**: `OnboardingModal` integrazione:
  - Prima dello step 'name' (o come step 0 opzionale), bottone "Genera
    nome brand con AI"
  - Se l'utente clicca, mostra BrandNameGenerator inline
  - Al completamento: popola displayName (se vuoto), companySuggestions,
    profession, defaultColor. L'utente può avanzare a 'name' e trovare
    i campi precompilati
- **REQ-005**: Nomi brand generati hanno regole:
  - Max 30 char
  - Italian-friendly (no parolacce, no marchi famosi: prompt esplicito)
  - Coerenti col mood (es. "bold" → nomi brevi con allitterazione)
  - Coerenti col settore (dedotto da descrizione)
- **REQ-006**: Feedback loading:
  - "Sto pensando a nomi…" durante AI call (~1-3s)
  - Toast: "5 nomi generati. Scegline uno."
- **REQ-007**: Reset: bottone "Rigenera" per ottenere 5 nomi nuovi (1
  rigenerazione per sessione, poi toast "Massimo 2 generazioni. Reset
  chat per riprovare.").
- **REQ-008**: Se AI fallisce (network, quota), toast error + fallback
  manuale (BrandNameGenerator scompare, utente compila a mano).
- **CON-001**: Zero breaking change. Se AI non usata, onboarding flusso
  v1 preservato.
- **CON-002**: Nomi brand non sono usati come displayName automaticamente
  (displayName = nome persona, non brand).
- **CON-003**: No domain availability check (out of scope).
- **GUD-001**: Mood coerenti con logo AI (spec v2.1): minimal, bold,
  playful, elegant, tech + luxury.
- **PAT-001**: Opt-in: AI non chiamata se l'utente non clicca.
- **PAT-002**: Suggerimenti non bloccanti: l'utente può ignorare e
  scrivere a mano.

## 4. Interfaces & Data Contracts

**BrandNameGenerator props**:

```typescript
interface BrandNameGeneratorProps {
  onApply: (result: BrandNameSuggestions) => void;
  userEmail?: string;
}

interface BrandNameSuggestions {
  brandNameSuggestions: string[]; // 5 nomi
  displayName: string;
  companySuggestions: string[];  // 3 ragioni sociali
  professionSuggestions: string[]; // 3 professioni
  defaultColor: string;
}
```

**suggestBrandName orchestrator**:

```typescript
async suggestBrandName(
  input: { description: string; mood: string; keywords: string[] },
  options?: { modelId?: string; userEmail?: string }
): Promise<OnboardingSuggestResult & { brandNameSuggestions: string[] }>;
```

**Estensione schema**:

```typescript
export const onboardingSuggestSchemaV2 = onboardingSuggestSchema.extend({
  brandNameSuggestions: z.array(z.string().max(30)).length(5),
});
```

## 5. Acceptance Criteria

- **AC-001**: Given BrandNameGenerator render, When l'utente compila 3
  step e clicca "Genera", Then mostra 5 nomi brand + toast success.
- **AC-002**: Given 5 nomi generati, When l'utente clicca su uno, Then
  `onApply` chiamato con quel nome in brandNameSuggestions[0] e gli
  altri 4 ancora presenti.
- **AC-003**: Given 2a generazione nella stessa sessione, When l'utente
  clicca "Rigenera", Then toast "Massimo 2 generazioni. Reset chat.".
- **AC-004**: Given AI fail, When l'utente clicca "Genera", Then toast
  error + BrandNameGenerator scompare (fallback manuale).
- **AC-005**: Given OnboardingModal con BrandNameGenerator applicato,
  When l'utente applica un nome, Then displayName/company/profession/
  color precompilati negli step successivi.
- **AC-006**: Given `npm test`, Then 1775+ verdi.
- **AC-007**: Given `npm run typecheck`, Then verde.

## 6. Test Automation Strategy

- **Test Levels**: Unit (schema), Component (BrandNameGenerator 3-step).
- **Frameworks**: Vitest, React Testing Library.
- **Coverage Requirements**: ≥80% BrandNameGenerator.
- **Test nuovi** (~6):
  - `BrandNameGenerator.test.tsx`: 4 test (3-step flow, genera, apply,
    rigenera limit)
  - `onboardingOrchestrator.test.ts`: +2 test (brandNameSuggestions
    length 5, displayName derivato)

## 7. Rationale & Context

Namelix dimostra che la generazione di nomi brand AI riduce attrito
onboarding significativamente. Il flusso "domande → genera → scegli" è
più naturale di "compila campi vuoti". Costo AI: ~€0.005/suggerimento
(1 chiamata DeepSeek, output piccolo). ROI: riduzione drop-off
onboarding del ~20-30% (stima conservativa basata su benchmark
namelix-like). Integrazione minimale: BrandNameGenerator è un
componente inline, non un step obbligatorio.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: DeepSeek V4 API (via proxy /ai/chat, esistente).

### Data Dependencies
- **DAT-001**: spec 13 `onboardingOrchestrator.ts` (estendere).
- **DAT-002**: `src/components/OnboardingModal.tsx` (integrazione).
- **DAT-003**: `src/ai/prompts/onboardingSystem.ts` (prompt esteso per
  brand name).

### Technology Platform Dependencies
- **PLT-001**: TypeScript, React, Vitest.

### Compliance Dependencies
- **COM-001**: No PII beyond description text (l'utente scrive cosa fa).
  GDPR-friendly.

## 9. Examples & Edge Cases

**Esempio flusso**:
1. Utente: "Pizzeria moderna a Cagliari, pizza napoletana"
2. Mood: "bold"
3. Keywords: "pizza, cagliari, giovane"
4. AI genera: ["PizzaBo", "CagliariPizza", "DaMario", "GustoNapo",
   "BoldSlice"]
5. Utente sceglie "PizzaBo"
6. OnboardingModal popola: displayName="PizzaBo" (o vuoto se preferisce
   nome persona), companySuggestions=["PizzaBo Srl", "PizzaBo di Mario",
   "PizzaBo Cagliari"], profession=["Pizzaiolo", "Ristoratore",
   "Chef"], defaultColor="#E62020"

**Edge case — descrizione vuota**: AI ritorna nomi generici
("Brand A", "Brand B"). L'utente probabilmente non clicca "Genera" con
descrizione vuota (bottone disabled).

**Edge case — AI ritorna nome offensivo**: Prompt esplicito "no
parolacce, no marchi famosi" previene. Se capita, l'utente può
rigenerare.

## 10. Validation Criteria

- Tutti AC-001..007 verdi.
- `BrandNameGenerator.tsx` esiste con 3-step chat.
- `onboardingOrchestrator.ts` esteso con `suggestBrandName`.
- `OnboardingModal.tsx` integra BrandNameGenerator (opt-in).
- `npm test` verde (1775 + ~6 nuovi).
- `npm run typecheck` verde.

## 11. Related Specifications / Further Reading

- `spec/spec-design-ai-onboarding-assist.md` — spec 13 (base).
- `spec/spec-design-ai-logo-v2-1-nano-banana.md` — spec v2.1 (logo AI
  con mood coerente).
- namelix.com — riferimento UX
- Looka naming guide — best practices brand naming