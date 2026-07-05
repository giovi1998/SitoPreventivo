---
title: AI Cleanup Duplicates — Rimozione file orfani e unificazione sanitizeAIResponse
version: 1.0
date_created: 2026-07-05
last_updated: 2026-07-05
owner: Giovanni Cidu
tags: [tool, ai, cleanup, dead-code, dedup, refactor]
---

# Introduction

`src/ai/flyer/prompts.ts` duplica `src/ai/prompts/flyerSystem.ts` (0
import nel codebase). `src/ai/flyer/outputSchema.ts` definisce
`flyerAIOutputSchema` v2 con campi `layoutAdvice`/`density` non consumati
dall'orchestratore (0 import). `sanitizeAIResponse` è duplicata in 3 file
orchestratore. Questa spec rimuove dead code e unifica sanitize (la parte
unificazione è coperta da spec 5 BaseOrchestrator; qui si focalizza su
file orfani).

## 1. Purpose & Scope

**Purpose**: rimuovere dead code, ridurre confusione maintenance, eliminare
2 file orfani confermati.

**Scope**:
- Cancellare `src/ai/flyer/prompts.ts`
- Cancellare `src/ai/flyer/outputSchema.ts`
- Verifica post-cancellazione: nessun import rotto
- `sanitizeAIResponse` unificazione: RIFERITA a spec 5 (BaseOrchestrator),
  non duplicata qui

**Audience**: sviluppatore AI.

**Assunzioni**:
- Grep conferma 0 import di `flyer/prompts` e `flyer/outputSchema` in
  `src/` (verificato in analisi pre-spec).
- `flyerOrchestrator.ts` usa `prompts/flyerSystem.ts` (import diretto) e
  `flyerAIOutputSchema` definita INLINE nel orchestratore (riga 20).
- `src/ai/flyer/budgets.ts` esiste ma è diverso da
  `src/utils/flyer/budgets.ts` (quest'ultimo usato, il primo è il gap
  notato in AGENTS.md — NON cancellare in questa spec, va chiarito a
  parte).

## 2. Definitions

- **Dead code**: file non importati da nessuna parte, mai eseguiti.
- **Orfano**: file presente ma non referenziato.
- **Duplicazione**: stesso codice in 2 file. `flyer/prompts.ts` duplica
  `prompts/flyerSystem.ts`.

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: Cancellare `src/ai/flyer/prompts.ts` (102 righe, duplica
  `prompts/flyerSystem.ts`).
- **REQ-002**: Cancellare `src/ai/flyer/outputSchema.ts` (19 righe,
  `flyerAIOutputSchema` v2 con `layoutAdvice`/`density` non usati).
- **REQ-003**: Pre-cancellazione, grep verify 0 import:
  - `grep -r "flyer/prompts" src/ api/` → 0 match
  - `grep -r "flyer/outputSchema" src/ api/` → 0 match
  - `grep -r "from.*ai/flyer/prompts" src/` → 0 match
  - `grep -r "from.*ai/flyer/outputSchema" src/` → 0 match
- **REQ-004**: Post-cancellazione, `npm run typecheck` verde (se un
  import nascosto esiste, typecheck fallisce e blocca).
- **REQ-005**: Post-cancellazione, `npm test` verde (1662+ test).
- **REQ-006**: `sanitizeAIResponse` unificazione gestita in spec 5
  (BaseOrchestrator). Questa spec NON tocca orchestratori. Riferimento
  incrociato.
- **CON-001**: Niente cancellazione di `src/ai/flyer/budgets.ts` (gap
  AGENTS.md, deviazione equivalente con `utils/flyer/budgets.ts`, da
  chiarire separatamente).
- **CON-002**: Niente cancellazione di `src/ai/flyer/` directory intera
  (può contenere altri file validi; verificare prima).
- **GUD-001**: Grep verify pre e post cancellazione per safety.
- **PAT-001**: Cancellazione via `git rm` (traceable).

## 4. Interfaces & Data Contracts

Nessuna nuova interfaccia. Cancellazione di 2 file.

**File rimossi**:

| File | Righe | Motivo |
|------|-------|--------|
| `src/ai/flyer/prompts.ts` | 102 | Duplica `prompts/flyerSystem.ts`, 0 import |
| `src/ai/flyer/outputSchema.ts` | 19 | `flyerAIOutputSchema` v2 non usata, 0 import |

**File preservati** (verifica):

| File | Azione | Note |
|------|--------|------|
| `src/ai/flyer/__tests__/` | Preservato | Se esiste, verify se testano i file cancellati |
| `src/ai/flyer/budgets.ts` | Preservato | Gap AGENTS.md, non in scope |
| `src/ai/prompts/flyerSystem.ts` | Preservato | Sorgente valida, usata da orchestratore |

## 5. Acceptance Criteria

- **AC-001**: Given grep `flyer/prompts` in `src/` e `api/`, When eseguito
  pre-cancellazione, Then 0 match (confirm dead code).
- **AC-002**: Given grep `flyer/outputSchema` in `src/` e `api/`, When
  eseguito pre-cancellazione, Then 0 match.
- **AC-003**: Given `src/ai/flyer/prompts.ts` cancellato, When
  `npm run typecheck`, Then verde (no import rotto).
- **AC-004**: Given `src/ai/flyer/outputSchema.ts` cancellato, When
  `npm run typecheck`, Then verde.
- **AC-005**: Given `npm test`, When eseguito post-cancellazione, Then
  1662+ test verdi.
- **AC-006**: Given `src/ai/flyer/` directory, When `Get-ChildItem`, Then
  non vuota (altri file preservati, es. `budgets.ts` se esiste).
- **AC-007**: Given git status post-operazione, When `git status`, Then
  mostra 2 file deleted.

## 6. Test Automation Strategy

- **Test Levels**: nessun test nuovo. Validazione via grep + typecheck +
  test esistenti.
- **Frameworks**: Vitest (test esistenti devono passare).
- **Test Data Management**: N/A.
- **CI/CD Integration**: `npm test` pre-push.
- **Coverage Requirements**: N/A (cancellazione, no new code).
- **Verification step**:
  - Pre: `grep -r "flyer/prompts\|flyer/outputSchema" src/ api/` → 0
  - Post: `npm run typecheck` verde + `npm test` verde

## 7. Rationale & Context

Dead code confonde: sviluppatore futuro pensa che `flyer/prompts.ts`
sia la fonte, la modifica, ma l'orchestratore usa `prompts/flyerSystem.ts`.
Bug subdoli. 2 file orfani = 121 righe di confusione. Cancellazione
sicura (grep verify 0 import). `sanitizeAIResponse` unificazione è
bonus coperto da spec 5, non duplicata qui per evitare conflitto.

## 8. Dependencies & External Integrations

### External Systems
- Nessuno.

### Third-Party Services
- Nessuno.

### Infrastructure Dependencies
- Nessuna.

### Data Dependencies
- **DAT-001**: `src/ai/flyer/prompts.ts` (cancellare).
- **DAT-002**: `src/ai/flyer/outputSchema.ts` (cancellare).
- **DAT-003**: `src/ai/prompts/flyerSystem.ts` (preservare, sorgente
  valida).
- **DAT-004**: `src/ai/flyerOrchestrator.ts` riga 20 (`flyerAIOutputSchema`
  inline, non import da `outputSchema.ts`).

### Technology Platform Dependencies
- **PLT-001**: TypeScript (typecheck verify no import rotto).

### Compliance Dependencies
- Nessuna.

## 9. Examples & Edge Cases

**Verifica pre-cancellazione** (comandi):

```powershell
# PowerShell
Select-String -Path "src\**\*.ts","api\**\*.ts" -Pattern "flyer/prompts|flyer/outputSchema" -SimpleMatch
# Output atteso: 0 match
```

**Edge case — import dinamico nascosto**: grep potrebbe mancare
`import('flyer/prompts')` dinamico. Verifica anche:

```powershell
Select-String -Path "src\**\*.ts","api\**\*.ts" -Pattern "import\(.*flyer"
```

Se 0 match, sicuri. Se match, NON cancellare e indagare.

**Edge case — test in `src/ai/flyer/__tests__/`**: se esiste
`prompts.test.ts` che importa `flyer/prompts`, cancellare il test
insieme (dead code test di dead code).

**Edge case — `budgets.ts`**: AGENTS.md nota `ai/flyer/budgets.ts` vs
`utils/flyer/budgets.ts`. NON in scope qui. Se si vuole chiarire, spec
separata.

## 10. Validation Criteria

- Tutti AC-001..007 verdi.
- 2 file cancellati via `git rm`.
- `npm run typecheck` verde.
- `npm test` verde (1662+).
- Grep post-cancellazione: 0 riferimenti ai file cancellati.

## 11. Related Specifications / Further Reading

- `spec/spec-architecture-ai-base-orchestrator.md` — unifica
  `sanitizeAIResponse` (spec 5).
- `src/ai/flyerOrchestrator.ts` riga 20 — `flyerAIOutputSchema` inline
  (conferma `outputSchema.ts` orfano).
- `src/ai/prompts/flyerSystem.ts` — sorgente valida preservata.
- AGENTS.md sezione "Phase Status" fase 11 — nota gap
  `ai/flyer/budgets.ts`.