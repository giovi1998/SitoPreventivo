---
title: Coding Skills — 3 nuove skill progetto-specifiche
version: 1.0
date_created: 2026-07-05
last_updated: 2026-07-05
owner: Giovanni Cidu
tags: [process, skills, coding-agent, ai-prompt-engineering, vercel, pdf]
---

# Introduction

Le skill in `.agents/skills/` aiutano l'agent di coding (opencode) a
lavorare meglio. Mancano 3 skill progetto-specifiche: `ai-prompt-engineering`
(per scrivere/mantenere system prompt), `vercel-serverless-monolith`
(pattern monolite Vercel, lezioni apprese), `pdf-client-side` (pattern
pdfmake + canvas). Questa spec le definisce + aggiorna AGENTS.md Active
Skills.

## 1. Purpose & Scope

**Purpose**: skill caricabili automaticamente quando si toccano file
specifici, per guidare l'agent con regole progetto-specifiche.

**Scope**:
- Nuovo `.agents/skills/ai-prompt-engineering/SKILL.md`
- Nuovo `.agents/skills/vercel-serverless-monolith/SKILL.md`
- Nuovo `.agents/skills/pdf-client-side/SKILL.md`
- Aggiornamento AGENTS.md sezione "Active Skills" (aggiungere le 3)

**Audience**: agent di coding (opencode), sviluppatore che maintiene skill.

**Assunzioni**:
- Formato SKILL.md: come skill esistenti (es. `caveman/SKILL.md`).
- Auto-load: le skill si caricano quando task matcha descrizione.
- Niente script ausiliari (skill puramente documentali, no `.mjs`).
- AGENTS.md "Active Skills" enumera le skill sempre attive.

## 2. Definitions

- **Skill**: cartella `.agents/skills/<name>/SKILL.md` con regole
  auto-caricate dall'agent.
- **Auto-load**: agent rileva skill da caricare basato su descrizione +
  task corrente.
- **Active skill**: skill sempre attive (listate in AGENTS.md "Active
  Skills").
- **On-demand skill**: skill caricate solo se task lo richiede esplicito.

## 3. Requirements, Constraints & Guidelines

### Skill `ai-prompt-engineering`

- **REQ-A01**: Creare `.agents/skills/ai-prompt-engineering/SKILL.md`.
- **REQ-A02**: Descrizione skill: "Use when writing or modifying system
  prompts in `src/ai/prompts/*.ts` or orchestrators in `src/ai/*.ts`."
- **REQ-A03**: Contenuto regole:
  - System prompt = stringa template literal, lingua italiano
  - Modalità ANALISI (testo) vs MODIFICA (JSON) — pattern progetto
  - JSON contract documentato nel prompt (esempio schema)
  - Anti-hallucination: niente campi fuori schema, niente `photoUrl`/
    `logoUrl` inviati, niente grid a (0,0,1,1)
  - Signature builder: `(args?) => string`, pure function
  - Esempi negativi prefisso "NON "
  - Lunghezza compact ≤2500 char, full ≤3500
  - Test: ogni prompt builder ha test in `__tests__/` con substring
    assertion
  - promptRegistry (spec 4): usare `getPrompt(id)` invece di import
    diretto
  - Riferimento: `src/ai/prompts/system.ts`, `cardSystem.ts`,
    `flyerSystem.ts` come esempi

### Skill `vercel-serverless-monolith`

- **REQ-V01**: Creare `.agents/skills/vercel-serverless-monolith/SKILL.md`.
- **REQ-V02**: Descrizione: "Use when modifying `api/index.ts` or
  touching any file in `api/`. Critical: Vercel Hobby plan constraints."
- **REQ-V03**: Contenuto regole (da AGENTS.md "Vercel Routing CRITICAL"):
  - `api/index.ts` è l'UNICA serverless function. Monolite intenzionale.
  - NON split in `api/lib/`, `api/routes/`, `api/_lib/`, `api/_routes/`
    (prefisso `_` escluso da count AND bundle → ERR_MODULE_NOT_FOUND)
  - Niente `vercel.json` `functions.includeFiles` (non transpila)
  - Niente rewrites `/api/*` per-route (rompe monolite)
  - `vercel.json` rewrites ordine critico: `/api/(.*) -> /api` PRIMA di
    `/(.*) -> /index.html`
  - Regression test: `src/__tests__/vercelConfig.test.ts`
  - Lezioni: commit `f004e5e`, `036ae25`, `5e2971f`, `05b17e6` (tutti
    broke production)
  - Condividi tipi/funzioni pure con client via `src/` (NON `api/_lib/`)
  - 12-function limit Hobby plan

### Skill `pdf-client-side`

- **REQ-P01**: Creare `.agents/skills/pdf-client-side/SKILL.md`.
- **REQ-P02**: Descrizione: "Use when modifying `src/utils/*Generator.ts`
  (generatePDF, cardGenerator, flyerGenerator, logoGenerator, qrGenerator)
  or `src/utils/watermark.ts`."
- **REQ-P03**: Contenuto regole:
  - PDF generation = client-side solo, via `pdfmake` (no server upload)
  - Canvas pipeline per PNG: SVG → Image → canvas → PNG
  - Tier-aware watermark: free → "QUICKBRAND · FREE" diagonale, unlocked
    → no-op
  - DPI gate: free 150 (PDF) / 72 (PNG), unlocked 300 / 4096
  - `applyWatermarkToPdf`/`applyWatermarkToCanvas` in `watermark.ts`
  - `getDpiForTier(tier)` helper
  - jsdom limit: `HTMLCanvasElement.getContext` not implemented, mock
    nei test (`buildMinimalPng` fallback)
  - Export PDF 10-up per card (A4, 5×2 bigliettini)
  - Bleed 3mm per flyer (pdfmake + crop marks)
  - Pattern riferimento: `src/utils/generatePDF.ts`, `cardGenerator.ts`,
    `flyerGenerator.ts`

### AGENTS.md update

- **REQ-U01**: Aggiungere le 3 skill in "Active Skills":
  ```
  - `ai-prompt-engineering`, quando si toccano file `src/ai/prompts/*`
    o `src/ai/*Orchestrator.ts`
  - `vercel-serverless-monolith`, quando si tocca `api/index.ts` o
    `api/`
  - `pdf-client-side`, quando si tocca `src/utils/*Generator.ts` o
    `watermark.ts`
  ```
- **REQ-U02**: Verifica `web-security` skill elencata in AGENTS.md ma
  mancante su disco (gap rilevato). O rimuovere da AGENTS.md, o nota
  "mancante, da reinstallare".

### Trasversali

- **REQ-T01**: Niente script `.mjs` o risorse addizionali (skill pure
  documentali).
- **CON-001**: Skill in inglese (descrizione) + italiano (regole, per
  coerenza con AGENTS.md).
- **CON-002**: Ogni SKILL.md ≤200 righe.
- **GUD-001**: Formato SKILL.md come `caveman/SKILL.md` (front matter
  description + sezioni regole).
- **PAT-001**: Skill = regole + esempi + riferimenti file. Niente code
  eseguibile.

## 4. Interfaces & Data Contracts

**Struttura SKILL.md** (per ognuna delle 3):

```markdown
---
description: [Use when ...]
---

# Skill: [Name]

## Regole

[Lista puntata regole]

## Esempi

[Blocchi codice]

## Riferimenti

[File progetto]
```

**AGENTS.md sezione "Active Skills"** (post-update):

```markdown
## Active Skills

Queste skill vengono caricate automaticamente. ...

- `vercel-react-best-practices`, performance React
- `vercel-composition-patterns`, component design
- `web-design-guidelines`, review UI/accessibilità
- `writing-guidelines`, docs/prose style
- `test-driven-development`, disciplina TDD
- `frontend-design`, design opinionato
- `caveman`, compressione output
- `ai-prompt-engineering`, system prompt AI (quando si tocca `src/ai/prompts/*`)
- `vercel-serverless-monolith`, monolite Vercel (quando si tocca `api/`)
- `pdf-client-side`, PDF/PNG export (quando si tocca `*Generator.ts`)
```

## 5. Acceptance Criteria

- **AC-A01**: Given `.agents/skills/ai-prompt-engineering/SKILL.md`, When
  eseguito `Test-Path`, Then True.
- **AC-A02**: Given SKILL.md ai-prompt-engineering, When si legge
  descrizione, Then menziona `src/ai/prompts/` e "system prompt".
- **AC-A03**: Given SKILL.md ai-prompt-engineering, When si cerca
  "ANALISI" e "MODIFICA", Then entrambi presenti (pattern progetto).
- **AC-V01**: Given `.agents/skills/vercel-serverless-monolith/SKILL.md`,
  When `Test-Path`, Then True.
- **AC-V02**: Given SKILL.md vercel-serverless-monolith, When si cerca
  "ERR_MODULE_NOT_FOUND" e "monolite", Then presenti.
- **AC-V03**: Given SKILL.md vercel-serverless-monolith, When si cerca
  "vercelConfig.test.ts", Then presente (riferimento regression test).
- **AC-P01**: Given `.agents/skills/pdf-client-side/SKILL.md`, When
  `Test-Path`, Then True.
- **AC-P02**: Given SKILL.md pdf-client-side, When si cerca "pdfmake" e
  "watermark" e "tier", Then presenti.
- **AC-U01**: Given AGENTS.md, When si cerca "ai-prompt-engineering" in
  Active Skills, Then presente.
- **AC-U02**: Given AGENTS.md, When si cerca "vercel-serverless-monolith"
  e "pdf-client-side" in Active Skills, Then entrambi presenti.
- **AC-T01**: Given `npm test`, Then 1662+ verdi (nessun test rotto, le
  skill non sono testate via Vitest).
- **AC-T02**: 3 SKILL.md ≤200 righe ciascuno.

## 6. Test Automation Strategy

- **Test Levels**: nessun test codice. Validazione manuale (Test-Path,
  grep).
- **Frameworks**: N/A.
- **Test Data Management**: N/A.
- **CI/CD Integration**: nessuna. Skill non testate in CI.
- **Coverage Requirements**: N/A.
- **Verification**:
  - `Test-Path .agents/skills/ai-prompt-engineering/SKILL.md` → True
  - `Test-Path .agents/skills/vercel-serverless-monolith/SKILL.md` → True
  - `Test-Path .agents/skills/pdf-client-side/SKILL.md` → True
  - `Select-String -Path AGENTS.md -Pattern "ai-prompt-engineering|vercel-serverless-monolith|pdf-client-side"` → 3 match

## 7. Rationale & Context

L'agent di coding prende decisioni sbagliate se non conosce le regole
progetto-specifiche: splitta `api/index.ts` (broke production 4 volte
storicamente), usa `Set-Content` invece di tool dedicati, inventa campi
prompt non in schema. Le skill caricano contesto automaticamente. 3
skill coprono 3 aree ad alto rischio: AI prompt, Vercel monolite, PDF
export. Pattern già dimostrato da `caveman`, `vercel-react-best-practices`.

## 8. Dependencies & External Integrations

### External Systems
- Nessuno.

### Third-Party Services
- Nessuno.

### Infrastructure Dependencies
- **INF-001**: `.agents/skills/` directory (esistente, gestita da opencode).

### Data Dependencies
- **DAT-001**: AGENTS.md "Active Skills" sezione (righe 569-587 circa).
- **DAT-002**: AGENTS.md "Vercel Routing CRITICAL" sezione (sorgente
  per skill vercel-serverless-monolith).
- **DAT-003**: `src/ai/prompts/*` (riferimento skill ai-prompt-engineering).
- **DAT-004**: `src/utils/*Generator.ts`, `watermark.ts` (riferimento
  skill pdf-client-side).

### Technology Platform Dependencies
- **PLT-001**: Markdown (SKILL.md formato).

### Compliance Dependencies
- Nessuna.

## 9. Examples & Edge Cases

**Estratto SKILL.md vercel-serverless-monolith**:

```markdown
---
description: Use when modifying api/index.ts or touching any file in api/. Critical: Vercel Hobby plan constraints.
---

# Skill: vercel-serverless-monolith

## Regole

- `api/index.ts` è l'UNICA serverless function. Monolite intenzionale.
- NON split in `api/lib/`, `api/routes/`, `api/_lib/`, `api/_routes/`
  (prefisso `_` escluso da count AND bundle → ERR_MODULE_NOT_FOUND)
- Niente `vercel.json` `functions.includeFiles` (non transpila)
- `vercel.json` rewrites ordine critico: `/api/(.*) -> /api` PRIMA di
  `/(.*) -> /index.html`
- Regression test: `src/__tests__/vercelConfig.test.ts`
- Lezioni: commit f004e5e, 036ae25, 5e2971f, 05b17e6 (tutti broke
  production)

## Riferimenti

- `api/index.ts` (monolite)
- `vercel.json` (rewrites)
- `src/__tests__/vercelConfig.test.ts` (regression)
- AGENTS.md "Vercel Routing CRITICAL"
```

**Edge case — skill non caricata**: se agent non rileva la skill, regole
non applicate. Mitigazione: AGENTS.md le elenca in Active Skills (sempre
caricate se task matcha).

**Edge case — `web-security` mancante**: AGENTS.md elenca `web-security`
ma non esiste su disco. Questa spec nota il gap; decisione separata:
rimuovere da AGENTS.md o reinstallare.

## 10. Validation Criteria

- Tutti AC-A01..A03, AC-V01..V03, AC-P01..P02, AC-U01..U02, AC-T01..T02
  verdi.
- 3 nuovi SKILL.md in `.agents/skills/`.
- AGENTS.md aggiornato con 3 nuove Active Skills.
- `npm test` verde (nessun regression).

## 11. Related Specifications / Further Reading

- AGENTS.md sezione "Active Skills", "Vercel Routing CRITICAL".
- `.agents/skills/caveman/SKILL.md` — pattern riferimento.
- `src/ai/prompts/` — file riferimento skill ai-prompt-engineering.
- `api/index.ts` — file riferimento skill vercel-serverless-monolith.
- `src/utils/generatePDF.ts`, `cardGenerator.ts`, `flyerGenerator.ts`,
  `watermark.ts` — file riferimento skill pdf-client-side.