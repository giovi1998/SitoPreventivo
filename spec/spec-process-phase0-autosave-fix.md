---
title: Phase 0 — Fix auto-save race con AI merge
version: 1.0
date_created: 2026-06-21
owner: Giovanni Cidu
tags: [process, bugfix, autosave, ai-merge, react, regression]
---

# Introduction

La fase 0 risolve una race condition tra l'auto-save silenzioso (ogni 30s)
e il merge asincrono dell'AI. Quando l'AI impiega più di 30 secondi per
processare un prompt, l'auto-save può persistere lo stato pre-merge con
il suffisso ` (auto)` già appiccicato al titolo, lasciando l'utente in
uno stato inconsistente. La fix introduce un gate esplicito su
`isProcessing`, un cooldown di 5 secondi dopo il merge e un flag
`silent` per distinguere i salvataggi automatici da quelli manuali con
dialog.

Questa è la prima fase dell'espansione multi-documento di PrecisionQuote
e va completata prima di ogni altra fase perché tocca i file che tutte
le altre fasi modificheranno.

## 1. Purpose & Scope

**Purpose**: eliminare la race condition auto-save vs AI merge senza
introdurre regressioni sul flusso di salvataggio manuale.

**Scope**:
- Modificare `src/components/EditorView.tsx` (auto-save timer)
- Modificare `App.tsx` (`saveCurrentQuote` signature)
- Aggiungere test di regressione in `src/components/__tests__/EditorView.autosave.test.tsx`

**Out of scope**:
- Refactor del sistema di salvataggio in una state machine esplicita
  (`'idle' | 'dirty' | 'saving' | 'aiMerging'`) — rimandato a v2
- Modifica al comportamento del dialog `SaveDialog`
- Modifica al flow del `PdfImportModal`

**Intended audience**: sviluppatore che implementa la fix; reviewer che
verifica i test di regressione.

**Assumptions**:
- L'AI processing è tracciato dallo stato `isProcessing` di `useAI`,
  già cablato come prop in `EditorView` (linea 107 di `EditorView.tsx`).
- L'auto-save attuale è l'unico consumer silenzioso di `saveCurrentQuote`.

## 2. Definitions

- **Auto-save silenzioso**: chiamata a `saveCurrentQuote()` senza dialog,
  originata dal `setInterval(30000)` in `EditorView.tsx:124`.
- **Save manuale**: click sul bottone "Salva" nella Topbar o `Ctrl+S`,
  che apre il `SaveDialog` per inserire il nome.
- **AI merge**: applicazione del risultato di `processPrompt` allo stato
  `quote` in `App.tsx:269-270` (`setQuote(result.quote); markDirty();`).
- **Cooldown**: finestra di tempo dopo la fine dell'AI processing in cui
  l'auto-save è comunque sospeso, per permettere alla stato React di
  propagare il merge.
- **Dirty bit**: flag `isDirty` in `App.tsx:141`, settato a `true` da
  `markDirty()` su ogni modifica.

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: L'auto-save silenzioso NON deve fire quando
  `isProcessing === true`.
- **REQ-002**: Dopo che `isProcessing` passa da `true` a `false`,
  l'auto-save deve restare sospeso per 5 secondi (cooldown).
- **REQ-003**: L'auto-save silenzioso NON deve appendere ` (auto)` al
  titolo del preventivo. Il suffisso è riservato ai salvataggi manuali
  con dialog senza titolo personalizzato.
- **REQ-004**: Il save manuale (`SaveDialog` con titolo) mantiene il
  comportamento attuale: usa il titolo inserito dall'utente.
- **REQ-005**: Il save manuale senza dialog (click "Salva" senza
  modificare il nome proposto) usa il titolo corrente senza suffisso.
- **REQ-006**: `saveCurrentQuote` accetta un parametro opzionale
  `opts?: { title?: string; silent?: boolean }` con backward compatibility
  per la signature attuale `saveCurrentQuote(title?: string)`.
- **SEC-001**: Nessuna modifica ai controlli di ownership su
  `dataService.saveQuote` (l'email dell'utente resta il gate).
- **CON-001**: Nessun nuovo dependency. Nessuna nuova env var.
- **CON-002**: Nessuna migrazione database. Nessuna modifica a
  `api/index.ts` o `db/schema.ts`.
- **CON-003**: Il `setInterval(30000)` resta a 30 secondi. Non si
  introducono timer più aggressivi.
- **GUD-001**: Seguire `AGENTS.md` sezione "Test — OBBLIGATORI":
  bug fix deve avere un regression test che riproduce il bug PRIMA del
  fix e verifica che passi DOPO.
- **GUD-002**: Seguire `AGENTS.md` sezione "Git Guardrails": nessun
  commit, nessun push senza conferma esplicita dell'utente.
- **GUD-003**: Seguire la skill `vercel-react-best-practices` per i
  pattern React (refs vs state, effect cleanup).
- **GUD-004**: Seguire la skill `test-driven-development` (obra): scrivi
  il test che fallisce prima, poi implementa la fix.
- **PAT-001**: Pattern ref + effect per evitare stale closure nel
  `setInterval`: usare `processingRef` e `cooldownRef` come già si fa
  con `dirtyRef` e `saveRef` in `EditorView.tsx:119-122`.
- **PAT-002**: Pattern opts-object per retrocompatibilità:
  ```ts
  const saveCurrentQuote = (optsOrTitle?: { title?: string; silent?: boolean } | string) => {
    const opts = typeof optsOrTitle === 'string' ? { title: optsOrTitle } : (optsOrTitle || {});
    // ...
  };
  ```

## 4. Interfaces & Data Contracts

### `EditorView.tsx` — nuove props invariate

Nessuna nuova prop. `isProcessing` è già passato (linea 533 di
`App.tsx`). L'auto-save riceve già `saveQuote` come prop (linea 537 di
`App.tsx`).

### `App.tsx` — `saveCurrentQuote` nuova signature

```ts
// Prima (attuale):
const saveCurrentQuote = (title?: string) => { ... };

// Dopo:
const saveCurrentQuote = (
  optsOrTitle?: { title?: string; silent?: boolean } | string
) => {
  const opts = typeof optsOrTitle === 'string'
    ? { title: optsOrTitle }
    : (optsOrTitle || {});
  const title = opts.title
    ?? (opts.silent ? quote.project.title : `${quote.project.title} (auto)`);
  const saved = { ...quote, project: { ...quote.project, title } };
  // resto invariato
};
```

### `EditorView.tsx` — auto-save effect modificato

```tsx
const processingRef = React.useRef(isProcessing);
processingRef.current = isProcessing;
const cooldownRef = React.useRef(0);

React.useEffect(() => {
  if (isProcessing) {
    cooldownRef.current = Date.now() + 5000;
  }
}, [isProcessing]);

React.useEffect(() => {
  const timer = setInterval(() => {
    if (!dirtyRef.current) return;
    if (processingRef.current) return;
    if (Date.now() < cooldownRef.current) return;
    saveRef.current({ silent: true });
  }, 30000);
  return () => clearInterval(timer);
}, []);
```

## 5. Acceptance Criteria

- **AC-001**: Given l'AI sta processando (`isProcessing === true`) e
  l'editor è dirty da 31 secondi, When il `setInterval(30000)` fire,
  Then `saveRef.current` NON viene chiamato.
- **AC-002**: Given l'AI ha appena finito (`isProcessing` passato da
  `true` a `false` da 3 secondi) e l'editor è dirty, When il
  `setInterval` fire, Then `saveRef.current` NON viene chiamato
  (cooldown 5s non trascorso).
- **AC-003**: Given l'AI ha finito 6 secondi fa e l'editor è dirty,
  When il `setInterval` fire, Then `saveRef.current({ silent: true })`
  viene chiamato.
- **AC-004**: Given auto-save silenzioso fire, When il titolo del
  preventivo è "Preventivo Sito Web", Then il titolo persistito è
  "Preventivo Sito Web" (senza ` (auto)`).
- **AC-005**: Given l'utente click "Salva" nella Topbar, When il
  `SaveDialog` si apre e l'utente inserisce "My Custom Title", Then il
  titolo persistito è "My Custom Title".
- **AC-006**: Given l'utente preme `Ctrl+S`, When `saveCurrentQuote`
  viene chiamato senza argomenti, Then il titolo persistito è
  `${quote.project.title} (auto)` (backward compat con il comportamento
  attuale).
- **AC-007**: Given l'utente chiude `EditorView` (unmount), When il
  cleanup dell'effect gira, Then il `setInterval` viene cancellato
  (no leak).
- **AC-008**: Given `npm run typecheck`, When viene eseguito, Then
  esce con code 0.
- **AC-009**: Given `npm run test`, When viene eseguito, Then esce con
  code 0 e il nuovo test `EditorView.autosave.test.tsx` passa.

## 6. Test Automation Strategy

- **Test Levels**: Unit + Integration (component rendering con
  timer mockati).
- **Frameworks**: Vitest 4, React Testing Library 16, jsdom 29
  (già nel progetto).
- **Test Data Management**: nessun DB, nessun localStorage reale. Usare
  `vi.useFakeTimers()` per controllare il `setInterval`. Mockare
  `saveRef.current` con `vi.fn()` per verificare le chiamate.
- **CI/CD Integration**: nessuna CI configurata al momento. I test
  girano localmente con `npm run test`. Pre-push checklist in
  `AGENTS.md`: `npm run typecheck && npm run test` devono essere verdi.
- **Coverage Requirements**: ≥60% per i file modificati (regola
  `AGENTS.md`). Il nuovo test file deve coprire tutti gli AC-001 →
  AC-009.
- **Performance Testing**: non applicabile (logica sincrona).
- **Regression Test File**: `src/components/__tests__/EditorView.autosave.test.tsx`
  - Test 1: auto-save non fire durante `isProcessing=true`
  - Test 2: auto-save non fire nei 5s dopo la fine di `isProcessing`
  - Test 3: auto-save fire dopo 6s dalla fine di `isProcessing` con
    `silent: true`
  - Test 4: auto-save silenzioso NON appende ` (auto)` al titolo
  - Test 5: save manuale con titolo personalizzato usa il titolo
    inserito
  - Test 6: `Ctrl+S` senza argomenti mantiene backward compat con
    suffisso ` (auto)`
  - Test 7: unmount di EditorView cancella il timer (no leak)

## 7. Rationale & Context

**Perché la race condition è un problema reale (non solo teorico)**:

L'AI merge in `App.tsx:269-270` esegue `setQuote(result.quote); markDirty();`
solo DOPO che `processPrompt` risolve. Se l'AI impiega 35 secondi
(prompt complessi con tool calling multi-turn possono arrivare a 40-60s
su DeepSeek), il flusso è:

1. T=0s: utente edita → `markDirty()` → `isDirty=true`
2. T=2s: utente invia prompt AI → `isProcessing=true`
3. T=30s: `setInterval` fire, `dirtyRef.current === true`, salva lo
   stato pre-AI con titolo "... (auto)"
4. T=35s: AI risolve, `setQuote(result.quote)`, `markDirty()` →
   `isDirty=true` di nuovo
5. T=60s: `setInterval` fire di nuovo, salva lo stato AI-modificato

L'utente osserva: durante i 30-35s, vede il titolo cambiare in
"... (auto)" senza aver fatto nulla, e si chiede se le modifiche AI
verranno applicate (perché lo stato in memoria è ancora pre-AI).

**Perché cooldown di 5s e non 0s**:

Quando `isProcessing` passa a `false`, React schedula il re-render con
il nuovo `quote`. Se l'auto-save fire immediatamente (T=35.001s), il
`saveRef.current` potrebbe leggere lo state precedente al re-render
(stale closure via `useRef` aggiornato). 5 secondi danno a React il
tempo di propagare il merge al DOM e ai refs. È una finestra
conservativa; in pratica React propaga in <100ms.

**Perché `silent: true` invece di ricalcolare il titolo**:

L'auto-save non dovrebbe mai modificare il titolo del preventivo. Il
suffisso ` (auto)` era un fallback per i salvataggi manuali senza nome
personalizzato, ma è stato erroneamente applicato all'auto-save
silenzioso quando `saveCurrentQuote` è stato introdotto. Separare
esplicitamente i due path con un flag `silent` rende l'intento
inequivocabile.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: Nessuna nuova integrazione esterna.

### Third-Party Services
- **SVC-001**: Nessuna nuova dipendenza di servizio.

### Infrastructure Dependencies
- **INF-001**: Vercel Hobby plan — nessun impatto (logica client-side).
- **INF-002**: Neon Postgres free tier — nessun impatto (nessuna
  modifica allo schema).

### Data Dependencies
- **DAT-001**: localStorage key `precisionQuote_quotes` — nessuna
  modifica al formato.
- **DAT-002**: Tabella `quotes` (DB) — nessuna modifica.

### Technology Platform Dependencies
- **PLT-001**: React 18 — uso di `useRef` e `useEffect` con cleanup,
  API stabile.
- **PLT-002**: Vitest 4 + jsdom 29 — `vi.useFakeTimers()` supportato.

### Compliance Dependencies
- **COM-001**: Nessun requisito compliance aggiuntivo.

## 9. Examples & Edge Cases

### Edge case 1: AI finisce esattamente al cooldown boundary

```ts
// T=0: isProcessing=true, cooldownRef=5000
// T=4999ms: isProcessing=false, cooldownRef resta 5000
// T=5001ms: setInterval fire, Date.now()=5001 > 5000 → save OK
```

Non c'è race al boundary perché il check è `Date.now() < cooldownRef.current`
(strict less-than).

### Edge case 2: Utente edita durante AI processing

```ts
// T=0: isProcessing=true (AI in corso)
// T=10s: utente edita manualmente → markDirty() → isDirty=true
// T=30s: setInterval fire, processingRef.current=true → skip save
// T=35s: AI risolve, setQuote(merged), markDirty()
// T=40s: cooldown scaduto, setInterval fire → save silent
```

L'edit manuale durante l'AI è persistito insieme al merge (ultimo
write wins, entrambi gli state sono nello stesso oggetto `quote`).

### Edge case 3: Utente fa Ctrl+S durante AI processing

```ts
// T=0: isProcessing=true
// T=10s: utente preme Ctrl+S → saveCurrentQuote() (no silent flag)
// → titolo con suffisso (auto), ma isProcessing ancora true
// → l'AI merge a T=35s sovrascriverà con result.quote
```

Il save manuale durante AI processing non è bloccato (è un'azione
esplicita dell'utente). L'AI merge successivo sovrascriverà. Questo è
comportamento accettabile: l'utente ha deciso consapevolmente di
salvare.

### Edge case 4: EditorView unmount durante AI processing

```ts
// T=0: isProcessing=true, setInterval attivo
// T=15s: utente naviga via (setView('collection')) → EditorView unmount
// → cleanup function del useEffect gira: clearInterval(timer)
// → no leak, no fire residuo
```

## 10. Validation Criteria

Prima di considerare la fase 0 completata, verificare:

1. `npm run typecheck` esce con code 0.
2. `npm run test` esce con code 0.
3. Il test `EditorView.autosave.test.tsx` copre tutti gli AC-001 →
   AC-009.
4. `git diff src/components/EditorView.tsx` mostra:
   - `processingRef` e `cooldownRef` aggiunti
   - Effect `useEffect([isProcessing])` per aggiornare `cooldownRef`
   - `setInterval` body con 3 guard clauses
5. `git diff App.tsx` mostra:
   - `saveCurrentQuote` con nuova signature opts-object + backward
     compat per `string`
   - Logica `silent` che salta il suffisso ` (auto)`
6. Nessuna modifica a `api/`, `db/`, `vercel.json`, `package.json`.
7. `git status` mostra solo i 3 file modificati/aggiunti:
   - `src/components/EditorView.tsx`
   - `App.tsx`
   - `src/components/__tests__/EditorView.autosave.test.tsx`

## 11. Related Specifications / Further Reading

- `AGENTS.md` — regole test, git guardrails, pre-push checklist
- `.agents/guardrails/git-guardrails.md` — comandi git bloccati
- `src/components/EditorView.tsx:119-128` — codice attuale dell'auto-save
- `App.tsx:280-293` — `saveCurrentQuote` attuale
- `src/hooks/useAI.ts` — sorgente di `isProcessing`
- Skill `test-driven-development` (obra/superpowers) — disciplina TDD
- Skill `vercel-react-best-practices` — pattern React per performance
- `docs/spec/SPEC_MULTI_DOCUMENT.md` — piano generale (riferimento
  storico, è stato sostituito dalle 8 spec in `spec/`)

### Prossima fase

Dopo il completamento della fase 0, procedere con
`spec/spec-tool-phase1-qr-code.md` (QR Code generator).
