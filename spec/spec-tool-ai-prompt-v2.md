---
title: AI System Prompt v2 — Miglioramento 3 prompt esistenti (quote, card, flyer)
version: 1.0
date_created: 2026-07-05
last_updated: 2026-07-05
owner: Giovanni Cidu
tags: [tool, ai, prompt-engineering, hallucination-prevention, quote, card, flyer]
---

# Introduction

I 3 system prompt esistenti (`src/ai/prompts/system.ts` per quote,
`cardSystem.ts` per card, `flyerSystem.ts` per flyer) funzionano ma hanno
gap: regole anti-hallucination troppo generiche, esempi negativi mancanti,
guida palette card incompleta, vincoli densità flyer non espliciti nel
system prompt (solo nel copy prompt). Questa spec li rafforza mantenendo
le signature esistenti (`buildSystemPrompt(compact)`, `buildCardSystemPrompt()`,
`buildFlyerSystemPrompt()`) per zero breaking change su chiamanti.

## 1. Purpose & Scope

**Purpose**: ridurre hallucination AI, migliorare qualità output, rendere
regole più stringenti e verificabili via test.

**Scope**: `src/ai/prompts/system.ts`, `src/ai/prompts/cardSystem.ts`,
`src/ai/prompts/flyerSystem.ts` + relativi test esistenti
(`__tests__/system.test.ts`, `cardSystem.test.ts`, `flyerSystem.test.ts`).

**Audience**: sviluppatore AI, agent che implementa.

**Assunzioni**:
- Le signature delle funzioni builder restano identiche (no breaking
  change su `useAI`/`useAICard`/`useAIFlyer`/`AIOrchestrator`/`CardAIOrchestrator`/`FlyerAIOrchestrator`).
- `buildSystemPrompt(compact=true)` resta default compact.
- I prompt sono stringhe interpolate; niente template engine.
- Lingua output: italiano (invariato).

## 2. Definitions

- **System prompt**: primo messaggio role=system nella chat, definisce
  comportamento AI. Builder function: `(args?) => string`.
- **Hallucination**: AI inventa campi fuori schema, cancella back fields,
  genera grid a (0,0,1,1), inventa prezzi/dati non nel brief.
- **Modalità ANALISI vs MODIFICA**: pattern esistente. ANALISI = testo
  libero, MODIFICA = JSON completo.
- **Multi-turn**: pattern esistente in `AIOrchestrator` (dopo tool, seconda
  chiamata per sintesi). Card/flyer non hanno tool quindi niente multi-turn.
- **Char budget**: limite caratteri per campo flyer, calcolato da
  `getFlyerCopyBudget` in `src/utils/flyer/budgets.ts`.
- **Density target**: `low` | `medium`, indica quanto testo per layout.
- **9-pos alignment**: `alignH × alignV` (3×3) per grid card.

## 3. Requirements, Constraints & Guidelines

### Prompt quote (`system.ts`)

- **REQ-Q01**: Aggiungere sezione "CAMPI NON MODIFICABILI" esplicita:
  `total.net`, `total.tax`, `total.gross`, `summary`, `globalTotals`
  sono calcolati dal sistema. AI non deve toccarli.
- **REQ-Q02**: Aggiungere 3 esempi negativi (cioè cosa NON fare):
  - "Non restituire JSON parziale con `...` per omissione"
  - "Non inventare campi come `discount`, `priority`, `tags` fuori schema"
  - "Non chiamare `validate_quote` come unica azione (non modifica nulla)"
- **REQ-Q03**: Raffinare regola `[WARNING]`/`[INFO]`: usare SOLO in
  descrizioni opzioni e clausole, MAI in title/note interne. Max 1
  callout per descrizione.
- **REQ-Q04**: Aggiungere regola "NUMERI": se l'utente chiede "prezzo
  mercato per sito WordPress", l'AI NON inventa cifra. Risponde in
  ANALISI con range ("€300-2000 secondo agency Cagliari") se ha
  contesto, altrimenti chiede chiarimento.
- **REQ-Q05**: Compact mode (default): mantenere ≤2000 caratteri.
  Full mode: espandere con lista completa campi (già esistente riga
  60-69).

### Prompt card (`cardSystem.ts`)

- **REQ-C01**: Aggiungere tabella "PALETTE PREDEFINITE" esplicita:
  - premium → navy `#1e3a5f` | bordeaux `#8b0000` | teal `#01696F`
  - minimal → `#333333` accent, `#ffffff` bg, `#1a1a1a` text
  - moderno → `#0F1117` bg, `#FF3B3B` accent (Quickbrand red)
  - classico → `#ffffff` bg, `#1A1A1A` text, `#E62020` accent (The Classic)
  Regola: non mescolare palette (es. navy accent + red bg = vietato).
- **REQ-C02**: Raffinare regola collision con esempio esplicito:
  "Mettere logo sopra nome: NON inviare solo `logo: {x:0,y:0,w:4,h:1}` se
  name è già a (0,0,4,1). Invia NUOVO LAYOUT con entrambi riposizionati:
  `logo: {x:0,y:0,w:4,h:1}` + `name: {x:0,y:1,w:4,h:1}` + altri omessi."
- **REQ-C03**: Aggiungere regola "QUANDO allargare cella vs fontScale":
  - "testo più grande" → `fontScale: 1.2` (mantiene layout)
  - "foto più grande" → aumenta `photo.w` (es. 2→3)
  - "QR più grande" in flexbox → `qrSize: 'large'`
  - "QR più grande" in grid → aumenta `qr.w`/`qr.h`
- **REQ-C04**: Aggiungere 2 esempi negativi:
  - "Non inviare `photoUrl` o `logoUrl` (base64 user, merge li ignora)"
  - "Non inviare `visible: false` per nascondere (campo non in schema,
    merge strippa via)"
- **REQ-C05**: Raffinare regola "NON cambiare layout se non richiesto":
  aggiungere "salvo ragione esplicita: 'rendi moderno' può giustificare
  split→photo-circle, ma 'rendi premium' NO, il layout è già scelto".
- **REQ-C06**: Aggiungere sezione "SOCIAL PLACEHOLDER": `url: "XXXXX"`
  è il marker per "da compilare". AI non inventa URL reali (es.
  `instagram.com/rossi`) se non presenti.

### Prompt flyer (`flyerSystem.ts`)

- **REQ-F01**: Aggiungere sezione "DENSITY TARGET" nel system prompt
  (non solo nel copy prompt):
  - `low` → headline + subheadline + CTA, body ≤200 char
  - `medium` → + body 200-800 char, 1-2 paragrafi
  Layout determina density: `centered` = low, `split` = low, `classic` =
  medium, `magazine` = medium.
- **REQ-F02**: Raffinare 4 azioni refine con esempi stringenti:
  - "Semplifica": body ridotto 50%, headline/subheadline invariati, CTA
    label più corto (≤20 char)
  - "Più formale": sostituire contrazioni ("ciao"→"salve", "vi aspettiamo"
    →"li attendiamo"), niente emoji
  - "Più giovanile": contrazioni ammesse, diretto ("ciao", "ti aspettiamo")
  - "Aggiungi urgenza": aggiungere "solo fino a [data dal brief]" o
    "ultimi posti", MAI inventare data se assente
- **REQ-F03**: Aggiungere regola "NON INVENTARE":
  - date, luoghi, prezzi, numeri telefono, nomi locali → solo se nel brief
  - Se brief è "volantino generico", generare placeholder neutri
    ("La tua attività", "Contattaci"), non dati specifici
- **REQ-F04**: Aggiungere regola "LUNGHEZZA RISPETTATA":
  - `headlineMaxChars` (default 60), `subheadlineMaxChars` (100),
    `ctaMax` (30) sono HARD LIMIT. Se superati, troncare.
  - `bodyCharBudget` è HARD LIMIT. Non "indicativo".
- **REQ-F05**: Aggiungere esempio negativo: "Non restituire `cta: {label,
  url}`. `url` è user-supplied, NON includerlo nel JSON."

### Trasversali

- **REQ-T01**: Mantenere tutte le signature esistenti identiche.
- **REQ-T02**: Lingua italiano (invariato).
- **REQ-T03**: Nessuna nuova dipendenza npm.
- **CON-001**: Zero breaking change su chiamanti. Test esistenti devono
  passare (possono esserci aggiustamenti minori se testo prompt cambia).
- **CON-002**: Lunghezza prompt compact ≤2500 char (era ~2000), full
  ≤3500 char. Evitare prompt troppo lunghi (costo token input).
- **GUD-001**: Usare formato `ESEMPI COMUNI MODIFICA` esistente (lista
  puntata) per coerenza visiva.
- **GUD-002**: Esempi negativi prefissati con "NON " in maiuscolo per
  rilevabilità.
- **PAT-001**: I prompt sono stringhe template literal. Niente
  concatenazione complessa, niente escape difficile.
- **PAT-002**: I test esistenti (`system.test.ts` etc.) verificano
  substring presence. Aggiornare per nuove regole (es. assert
  "CAMPI NON MODIFICABILI" presente).

## 4. Interfaces & Data Contracts

**Signature identiche** (no breaking):

```typescript
// system.ts
export function buildSystemPrompt(compact: boolean = true): string;

// cardSystem.ts
export function buildCardSystemPrompt(): string;

// flyerSystem.ts
export function buildFlyerSystemPrompt(): string;
export function buildFlyerCopyPrompt(
  brief: string,
  tone: FlyerTone,
  context: FlyerCopyContext
): string;
export function sanitizeFlyerBrief(brief: string): string;
```

**Contratto output** (invariato):
- Quote: JSON `PremiumQuote` o testo analysis
- Card: JSON `BusinessCard` (partial) o testo analysis
- Flyer: JSON `{ headline, subheadline, body, cta: { label } }`

**Nuovi elementi testuali** (substring che devono apparire):

| Prompt | Substring richiesta |
|--------|---------------------|
| system.ts | "CAMPI NON MODIFICABILI" |
| cardSystem.ts | "PALETTE PREDEFINITE", "QUANDO allargare cella vs fontScale" |
| flyerSystem.ts | "DENSITY TARGET", "NON INVENTARE" |

## 5. Acceptance Criteria

- **AC-Q01**: Given `buildSystemPrompt(true)`, When si estrae la stringa,
  Then contiene "CAMPI NON MODIFICABILI" e nomina `total.net`, `summary`,
  `globalTotals`.
- **AC-Q02**: Given `buildSystemPrompt(true)`, When si conta lunghezza,
  Then ≤2500 char.
- **AC-Q03**: Given `buildSystemPrompt(true)`, When si cerca "validate_quote
  come unica azione", Then appare regola negativa.
- **AC-C01**: Given `buildCardSystemPrompt()`, When si cerca "PALETTE
  PREDEFINITE", Then la sezione elenca ≥4 palette (premium, minimal,
  moderno, classico) con colori esatti.
- **AC-C02**: Given `buildCardSystemPrompt()`, When si cerca "logo sopra
  nome", Then appare esempio esplicito con entrambi riposizionati.
- **AC-C03**: Given `buildCardSystemPrompt()`, When si cerca "fontScale"
  e "photo.w", Then la regola "QUANDO allargare" distingue i casi.
- **AC-F01**: Given `buildFlyerSystemPrompt()`, When si cerca "DENSITY
  TARGET", Then la sezione mappa layout→density (centered/split=low,
  classic/magazine=medium).
- **AC-F02**: Given `buildFlyerSystemPrompt()`, When si cerca "NON
  INVENTARE", Then la regola copre date, luoghi, prezzi, telefono.
- **AC-F03**: Given `buildFlyerCopyPrompt("brief", "formale", ctx)`,
  When `ctx.bodyCharBudget=500`, Then la stringa contiene "max 500
  caratteri" (hard limit esplicito).
- **AC-T01**: Given tutti i test esistenti in `__tests__/system.test.ts`,
  `cardSystem.test.ts`, `flyerSystem.test.ts`, When si esegue `npm test`,
  Then passano (con aggiornamenti minori alle assertion).
- **AC-T02**: Given `npm run typecheck`, When eseguito, Then verde
  (nessun tipo nuovo, signature identiche).

## 6. Test Automation Strategy

- **Test Levels**: Unit (prompt builder functions, output string).
- **Frameworks**: Vitest esistente.
- **Test Data Management**: fixture inline (stringhe costanti).
- **CI/CD Integration**: `npm test` pre-push (AGENTS.md Pre-push Checklist).
- **Coverage Requirements**: ≥80% sui 3 file prompt (era ~60%).
- **Performance Testing**: N/A (funzioni pure, microsecondi).
- **Test nuovi**:
  - `system.test.ts`: +3 test (CAMPI NON MODIFICABILI, esempi negativi,
    lunghezza ≤2500)
  - `cardSystem.test.ts`: +4 test (PALETTE, collision example, allargare
    vs fontScale, social placeholder)
  - `flyerSystem.test.ts`: +3 test (DENSITY TARGET, NON INVENTARE,
    bodyCharBudget hard limit)

## 7. Rationale & Context

I prompt attuali producono occasionalmente: campi inventati (`visible`,
`opacity`), `photoUrl` inviato (inutile, merge lo ignora), grid a (0,0,1,1)
segnale di output casuato, body flyer oltre budget, palette incoerenti
(navy accent + red bg). Questi sono pattern hallucination noti. Le regole
esistenti li menzionano genericamente; questa spec le rende esplicite con
esempi negativi e tabelle, riducendo errori AI del ~30-50% (stima basata
su frequenza osservata nei log AI). Signature identiche = zero rischio
breaking change.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: DeepSeek V4 API — riceve i prompt via `provider.chat`/
  `stream`. Nessuna modifica al protocollo.

### Third-Party Services
- Nessuna nuova.

### Infrastructure Dependencies
- Nessuna.

### Data Dependencies
- **DAT-001**: `src/ai/prompts/system.ts`, `cardSystem.ts`, `flyerSystem.ts`
  (file da modificare).
- **DAT-002**: `src/utils/documentSchemas.ts` — riferimento per campi
  schema card/flyer (no modifica).

### Technology Platform Dependencies
- **PLT-001**: TypeScript, Vitest. Versioni invariati.

### Compliance Dependencies
- **COM-001**: Prompt in italiano, niente PII utente nel system prompt
  (solo user prompt contiene dati utente).

## 9. Examples & Edge Cases

**Esempio sezione "CAMPI NON MODIFICABILI" in system.ts**:

```
CAMPI NON MODIFICABILI (calcolati dal sistema, NON toccarli):
- options[].total.net, total.tax, total.gross
- summary.*
- globalTotals.*
Se li modifichi, il merge li sovrascrive con valori calcolati → il tuo
output viene scartato.
```

**Esempio tabella "PALETTE PREDEFINITE" in cardSystem.ts**:

```
PALETTE PREDEFINITE (usa questi set coerenti, NON mescolare):
| Stile | bgColor | textColor | accentColor |
|-------|---------|-----------|-------------|
| premium | #ffffff | #1a1a1a | #1e3a5f (navy) |
| premium | #ffffff | #1a1a1a | #8b0000 (bordeaux) |
| premium | #ffffff | #1a1a1a | #01696F (teal) |
| minimal | #ffffff | #1a1a1a | #333333 |
| moderno | #0F1117 | #ffffff | #FF3B3B |
| classico | #ffffff | #1A1A1A | #E62020 |
```

**Edge case — prompt troppo lungo**: se compact supera 2500 char, spostare
dettagli in full mode. Compact deve restare aggressivo per costi token.

**Edge case — esempio negativo non recepito**: se AI ancora inventa
`visible: false`, rafforzare nel system prompt "Zod strippa campi non in
schema, l'output è perso" (già presente ma può essere più esplicito).

## 10. Validation Criteria

- Tutti AC-Q01..Q03, AC-C01..C03, AC-F01..F03, AC-T01..T02 verdi.
- `npm test` verde (1662+ test esistenti + ~10 nuovi).
- `npm run typecheck` verde.
- Lunghezza prompt compact ≤2500 char (verificabile con
  `buildSystemPrompt(true).length`).

## 11. Related Specifications / Further Reading

- `spec/spec-tool-ai-prompt-new-modules.md` — 3 nuovi prompt (logo, social,
  onboarding).
- `spec/spec-architecture-ai-prompt-registry.md` — promptRegistry per
  centralizzare.
- `src/ai/prompts/__tests__/system.test.ts` — test da aggiornare.
- `src/ai/prompts/__tests__/cardSystem.test.ts` — test da aggiornare.
- `src/ai/prompts/__tests__/flyerSystem.test.ts` — test da aggiornare.
- DeepSeek JSON Output docs: `api-docs.deepseek.com/guides/json_mode`.