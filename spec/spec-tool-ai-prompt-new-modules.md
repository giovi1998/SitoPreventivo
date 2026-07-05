---
title: AI Prompt New Modules — Logo AI v2, Social AI, Onboarding AI Assist
version: 1.0
date_created: 2026-07-05
last_updated: 2026-07-05
owner: Giovanni Cidu
tags: [tool, ai, prompt-engineering, logo, social, onboarding, v2]
---

# Introduction

L'app ha AI in 3 moduli (preventivo, card, flyer) ma mancano 3 prompt
per moduli futuri: Logo AI (tab attualmente disabilitato in v1), Social AI
(post coordinati col bigliettino/volantino), Onboarding AI (suggerimenti
displayName/company/profession da nome). Questa spec definisce i 3 nuovi
file prompt + i loro contratti JSON di output. Gli orchestratori/hooks
sono oggetto di spec separate (11, 12, 13); qui si definisce SOLO il layer
prompt, pronto per essere consumato da orchestratori futuri.

## 1. Purpose & Scope

**Purpose**: creare 3 nuovi file prompt builder in `src/ai/prompts/` con
contratti JSON espliciti, anti-hallucination, pronti per essere consumati
da orchestratori (spec 11-13).

**Scope**:
- Nuovo `src/ai/prompts/logoSystem.ts`
- Nuovo `src/ai/prompts/socialSystem.ts`
- Nuovo `src/ai/prompts/onboardingSystem.ts`
- Nuovi test: `__tests__/logoSystem.test.ts`, `socialSystem.test.ts`,
  `onboardingSystem.test.ts`

**Audience**: sviluppatore AI, agent che implementa orchestratori futuri.

**Assunzioni**:
- I 3 prompt restano stringhe template (stesso pattern di
  `system.ts`/`cardSystem.ts`/`flyerSystem.ts`).
- Output JSON contract enforced lato orchestratore via Zod (oggetto di
  spec 11-13, non qui).
- Logo AI v2 richiede `REPLICATE_API_TOKEN` env var (oggetto spec 11).
- Social AI genera post testuali (no immagini), coordinate col documento
  corrente (card o flyer).
- Onboarding AI lavora solo da nome+settore (no altri dati utente).

## 2. Definitions

- **Logo AI v2**: generazione logo via AI (Replicate Recraft-V3 o
  provider alternativo). V1 era SVG builder manuale, no AI.
- **Social AI**: genera 3 social post (caption + hashtags + tone)
  coordinati col documento corrente (card o flyer). Output: array di post.
- **Onboarding AI assist**: suggerisce displayName/company/profession
  plausibili basati su nome+settore inserito allo step 0 dell'onboarding.
- **JSON contract**: schema output atteso dall'AI, enforced via Zod
  lato orchestratore.
- **Cross-module AI**: AI che usa contesto di un modulo (es. card) per
  generare output per un altro (social post).

## 3. Requirements, Constraints & Guidelines

### Logo AI prompt (`logoSystem.ts`)

- **REQ-L01**: Creare `buildLogoSystemPrompt(): string` (no args). Ritorna
  system prompt per generazione logo.
- **REQ-L02**: Creare `buildLogoGeneratePrompt(brief: string, sector?:
  string): string` per il user prompt. `brief` è testo libero (max 500
  char, sanitize via `sanitizeLogoBrief`).
- **REQ-L03**: Creare `sanitizeLogoBrief(brief: string): string` (strip
  HTML, control chars, collapse whitespace, trim, slice 500). Stesso
  pattern di `sanitizeFlyerBrief`.
- **REQ-L04**: Output JSON contract documentato nel prompt:
  ```json
  {
    "primaryText": "string, max 30 char, nome brand",
    "tagline": "string, max 60 char, slogan",
    "iconType": "none" | "shape" | "monogram" | "lucide",
    "iconShape": "circle" | "square" | "rounded" | "hex",
    "iconName": "string, solo se iconType=lucide, allowlist 48 nomi",
    "monogram": "string, 1-2 lettere, solo se iconType=monogram",
    "primaryColor": "#RRGGBB",
    "secondaryColor": "#RRGGBB",
    "layout": "horizontal" | "vertical" | "stacked"
  }
  ```
- **REQ-L05**: Regole anti-hallucination:
  - `iconName` se `iconType=lucide` DEVE essere nella allowlist 48 nomi
    (lista nel prompt)
  - `iconShape`/`monogram` solo se `iconType` lo richiede
  - Colori `#RRGGBB` formato 6 cifre
  - Non inventare `url`, `font`, `size`, campi fuori contract
- **REQ-L06**: Settori predefiniti documentati nel prompt: tech, food,
  fashion, professionista. Per ognuno, default colors + iconType +
  iconShape consigliati (riferimento a `createLogoTemplate` in
  `documentSchemas.ts`).
- **REQ-L07**: Regola "non inventare dati": se brief non specifica
  settore, generare logo neutro (iconType=shape, colori grigio/blu).
  Non inventare "Ristorante Da Mario" se brief è "logo per azienda".

### Social AI prompt (`socialSystem.ts`)

- **REQ-S01**: Creare `buildSocialSystemPrompt(): string` (no args).
- **REQ-S02**: Creare `buildSocialGeneratePrompt(document: SocialSource,
  tone: SocialTone, platform: SocialPlatform): string` dove:
  - `SocialSource = { type: 'card' | 'flyer', data: CardSnapshot | FlyerSnapshot }`
  - `SocialTone = 'professional' | 'casual' | 'promotional'`
  - `SocialPlatform = 'instagram' | 'facebook' | 'linkedin'`
- **REQ-S03**: Output JSON contract:
  ```json
  {
    "posts": [
      {
        "platform": "instagram" | "facebook" | "linkedin",
        "caption": "string, max 500 char (instagram), 1000 (facebook), 1500 (linkedin)",
        "hashtags": ["string, max 10, formato #word"],
        "tone": "professional" | "casual" | "promotional"
      }
    ]
  }
  ```
- **REQ-S04**: Regole:
  - 3 post, uno per piattaforma
  - Caption coerente col documento (es. card → "Ecco il mio nuovo
    bigliettino!"; flyer → "Non perdere l'evento [headline]")
  - Hashtag max 10 per post, formato `#word` (no spazi, no punteggiatura)
  - Tone rispetta `SocialTone` richiesto
  - Non inventare prezzi, date, luoghi non nel documento
- **REQ-S05**: `CardSnapshot` shape (estrazione minimale da
  `BusinessCard`):
  ```typescript
  type CardSnapshot = {
    name: string;
    title: string;
    company: string;
    accentColor: string;
    services?: string[];
  };
  ```
- **REQ-S06**: `FlyerSnapshot` shape (estrazione minimale da `Flyer`):
  ```typescript
  type FlyerSnapshot = {
    headline: string;
    subheadline: string;
    body: string;
    ctaLabel: string;
    sector?: string;
  };
  ```

### Onboarding AI prompt (`onboardingSystem.ts`)

- **REQ-O01**: Creare `buildOnboardingSystemPrompt(): string` (no args).
- **REQ-O02**: Creare `buildOnboardingSuggestPrompt(name: string,
  sector?: string): string`. `name` è il nome utente (max 50 char,
  sanitize). `sector` è opzionale (es. "ristorante", "tech", "fashion").
- **REQ-O03**: Output JSON contract:
  ```json
  {
    "displayName": "string, max 40 char, nome visualizzato",
    "companySuggestions": ["string, max 60 char, 3 opzioni"],
    "professionSuggestions": ["string, max 50 char, 3 opzioni"],
    "defaultColor": "#RRGGBB, colore brand suggerito"
  }
  ```
- **REQ-O04**: Regole:
  - `displayName` = nome proprio (es. "Giovanni" → "Giovanni", non
    "Giovanni Cidu" se non fornito cognome)
  - `companySuggestions` = 3 nomi azienda plausibili per settore (es.
    "Ristorante Da Giovanni", "Giovanni Kitchen", "Giovanni Bistro" per
    ristorante). Se settore assente, neutri ("Giovanni Studio",
    "Giovanni Consulting").
  - `professionSuggestions` = 3 professioni plausibili (es. "Chef",
    "Ristoratore", "Cucina" per ristorante). Generiche ("Professionista",
    "Imprenditore", "Consulente") se settore assente.
  - `defaultColor` = colore coerente col settore (ristorante → rosso,
    tech → blu, fashion → nero/oro). Neutro `#1A1A1A` se settore assente.
- **REQ-O05**: Regola "non inventare dati personali": non inventare
  email, telefono, indirizzo, codice fiscale. Solo i 4 campi del contract.
- **REQ-O06**: `sanitizeOnboardingName(name: string): string` (strip
  HTML, control chars, collapse whitespace, trim, slice 50).

### Trasversali

- **REQ-T01**: Lingua output italiano.
- **REQ-T02**: Nessuna nuova dipendenza npm.
- **CON-001**: I 3 file prompt sono PURE functions (no I/O, no side
  effect). Facilmente testabili.
- **CON-002**: Lunghezza system prompt ≤2000 char per modulo.
- **CON-003**: Lunghezza user prompt ≤1500 char (compreso brief).
- **GUD-001**: Seguire struttura dei prompt esistenti (sezioni REGOLE,
  ESEMPI, CAMPI DISPONIBILI).
- **GUD-002**: Tipi TypeScript esportati (`SocialSource`, `SocialTone`,
  `SocialPlatform`, `CardSnapshot`, `FlyerSnapshot`).
- **PAT-001**: `sanitizeXxxBrief`/`sanitizeXxxName` come funzioni
  esportate, stesso pattern di `sanitizeFlyerBrief`.
- **PAT-002**: Output contract documentato nel prompt come commento JSON
  (l'AI lo vede e lo rispetta).

## 4. Interfaces & Data Contracts

**Nuovi file exports**:

```typescript
// logoSystem.ts
export function buildLogoSystemPrompt(): string;
export function buildLogoGeneratePrompt(brief: string, sector?: string): string;
export function sanitizeLogoBrief(brief: string): string;

// socialSystem.ts
export type SocialTone = 'professional' | 'casual' | 'promotional';
export type SocialPlatform = 'instagram' | 'facebook' | 'linkedin';
export type SocialSource =
  | { type: 'card'; data: CardSnapshot }
  | { type: 'flyer'; data: FlyerSnapshot };
export type CardSnapshot = { name: string; title: string; company: string; accentColor: string; services?: string[] };
export type FlyerSnapshot = { headline: string; subheadline: string; body: string; ctaLabel: string; sector?: string };
export function buildSocialSystemPrompt(): string;
export function buildSocialGeneratePrompt(document: SocialSource, tone: SocialTone, platform: SocialPlatform): string;

// onboardingSystem.ts
export function buildOnboardingSystemPrompt(): string;
export function buildOnboardingSuggestPrompt(name: string, sector?: string): string;
export function sanitizeOnboardingName(name: string): string;
```

**Output JSON contracts** (documentati nel prompt, enforced lato
orchestratore in spec 11-13):

| Modulo | Schema output |
|--------|--------------|
| Logo | `{ primaryText, tagline, iconType, iconShape, iconName?, monogram?, primaryColor, secondaryColor, layout }` |
| Social | `{ posts: [{ platform, caption, hashtags[], tone }] }` |
| Onboarding | `{ displayName, companySuggestions[3], professionSuggestions[3], defaultColor }` |

## 5. Acceptance Criteria

- **AC-L01**: Given `buildLogoSystemPrompt()`, When estratta stringa,
  Then contiene JSON contract con `primaryText`, `iconType`, `layout`
  e allowlist 48 nomi lucide.
- **AC-L02**: Given `buildLogoGeneratePrompt("Logo per pizzeria", "food")`,
  When estratta, Then contiene brief sanitizzato e settore "food".
- **AC-L03**: Given `sanitizeLogoBrief("<script>x</script>  brief  ")`,
  When eseguita, Then ritorna "brief" (strip HTML, collapse, trim).
- **AC-S01**: Given `buildSocialSystemPrompt()`, When estratta, Then
  contiene "posts" array con 3 piattaforme e limiti caption per piattaforma.
- **AC-S02**: Given `buildSocialGeneratePrompt({type:'card', data:{name:'Giovanni', title:'Sviluppatore', company:'HPE', accentColor:'#01696F', services:['Web','API']}}, 'professional', 'linkedin')`, When estratta, Then contiene
  "Giovanni", "HPE", "linkedin", tono "professional".
- **AC-O01**: Given `buildOnboardingSystemPrompt()`, When estratta,
  Then contiene 4 campi contract (`displayName`, `companySuggestions`,
  `professionSuggestions`, `defaultColor`).
- **AC-O02**: Given `buildOnboardingSuggestPrompt("Giovanni", "ristorante")`,
  When estratta, Then contiene "Giovanni" e "ristorante".
- **AC-O03**: Given `sanitizeOnboardingName("  <b>Giovanni</b>  ")`,
  When eseguita, Then ritorna "Giovanni".
- **AC-T01**: Given `npm run typecheck`, When eseguito, Then verde (tipi
  esportati coerenti).
- **AC-T02**: Given `npm test`, When eseguito, Then tutti i test
  esistenti (1662+) + ~12 nuovi verdi.

## 6. Test Automation Strategy

- **Test Levels**: Unit (funzioni pure).
- **Frameworks**: Vitest.
- **Test Data Management**: fixture inline.
- **CI/CD Integration**: `npm test` pre-push.
- **Coverage Requirements**: ≥80% sui 3 nuovi file.
- **Test nuovi** (12 totali):
  - `logoSystem.test.ts`: 4 test (system prompt, generate prompt, sanitize,
    allowlist lucide menzionata)
  - `socialSystem.test.ts`: 4 test (system prompt, generate card, generate
    flyer, tone/platform nella stringa)
  - `onboardingSystem.test.ts`: 4 test (system prompt, suggest, sanitize,
    settore influisce colori)

## 7. Rationale & Context

I 3 nuovi prompt sbloccano 3 moduli prodotto (spec 11-13). Definire prima
il layer prompt (questa spec) permette agli orchestratori di consumarli
senza riscrivere logica prompt. Pattern identico a flyer: system prompt
+ user prompt builder + sanitize + contract JSON documentato. Anti-
hallucination stringenti (es. logo AI non inventa `iconName` fuori
allowlist) perché i merge lato orchestratore sono strict (Zod).

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: DeepSeek V4 API (per social/onboarding). Replicate (per
  logo v2) — orchestratore gestisce la chiamata, non il prompt.

### Third-Party Services
- **SVC-001**: Replicate Recraft-V3 (futuro, spec 11). Qui solo contract.

### Infrastructure Dependencies
- Nessuna.

### Data Dependencies
- **DAT-001**: `src/utils/documentSchemas.ts` — `createLogoTemplate`,
  settori predefiniti, `lucideIconPaths.ts` allowlist 48 nomi.
- **DAT-002**: `src/utils/flyer/layoutEngine.ts` — riferimento per
  density target (no modifica).

### Technology Platform Dependencies
- **PLT-001**: TypeScript, Vitest.

### Compliance Dependencies
- **COM-001**: Onboarding AI non elabora dati sensibili (no email, no
  telefono, solo nome+settore). GDPR-friendly.

## 9. Examples & Edge Cases

**Esempio `buildLogoSystemPrompt`** (estratto):

```
Sei l'assistente AI per la generazione di loghi Quickbrand.
Output: SOLO JSON valido con questo contract:
{ primaryText, tagline, iconType, iconShape, iconName?, monogram?,
  primaryColor, secondaryColor, layout }

iconType ENUM: none | shape | monogram | lucide
iconShape ENUM: circle | square | rounded | hex
layout ENUM: horizontal | vertical | stacked

ALLOWLIST LUCIDE (48 nomi): [food: Coffee, Utensils, Pizza...; tech:
Cloud, Code...; fashion: Shirt...; business: Briefcase...]

NON inventare campi fuori contract. NON inventare iconName fuori
allowlist. Colori #RRGGBB 6 cifre.
```

**Edge case — brief vuoto**: `buildLogoGeneratePrompt("", "food")` →
"Logo per attività food" generico. AI produce neutro con iconType=shape.

**Edge case — settore sconosciuto**: `buildOnboardingSuggestPrompt("Mario",
"astronautica")` → settore non predefinito. AI usa neutri
("Mario Studio", professioni generiche, colore `#1A1A1A`).

**Edge case — nome con HTML**: `sanitizeOnboardingName("<script>x</script>Giovanni")` → "Giovanni" (strip + collapse + trim).

## 10. Validation Criteria

- Tutti AC-L01..L03, AC-S01..S02, AC-O01..O03, AC-T01..T02 verdi.
- 3 nuovi file in `src/ai/prompts/` con signature identiche a spec.
- 3 nuovi file test in `src/ai/prompts/__tests__/`.
- `npm test` verde (1662 + ~12 nuovi).
- `npm run typecheck` verde.

## 11. Related Specifications / Further Reading

- `spec/spec-tool-ai-prompt-v2.md` — migliora 3 prompt esistenti.
- `spec/spec-architecture-ai-prompt-registry.md` — promptRegistry.
- `spec/spec-design-ai-logo-v2.md` — orchestratore logo (spec 11).
- `spec/spec-design-ai-social-module.md` — orchestratore social (spec 12).
- `spec/spec-design-ai-onboarding-assist.md` — orchestratore onboarding (spec 13).
- `src/ai/prompts/flyerSystem.ts` — pattern riferimento (system + copy
  prompt + sanitize).