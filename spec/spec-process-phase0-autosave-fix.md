---
title: Phase 0 — Fix auto-save race con AI merge + UX merge feedback
version: 1.1
date_created: 2026-06-21
last_updated: 2026-06-21
owner: Giovanni Cidu
tags: [process, bugfix, autosave, ai-merge, react, regression, ux, feedback]
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

La fase 0 include anche 3 miglioramenti UX strettamente correlati al
flusso auto-save + AI merge: stato "salvato" chiaro durante AI
processing (sostituisce "Non salvato" che confonde), toast post-merge
dettagliato con count delle modifiche applicate (sostituisce il toast
generico "AI: prompt applicato con successo"), e recovery errori AI con
suggerimenti azionabili (sostituisce il messaggio minimo "Errore AI").
Questi 3 miglioramenti sono nel scope del phase0 perché il fix auto-save
cambia quando il save fire, e l'UX deve riflettere il nuovo flusso per
non confondere l'utente.

Questa è la prima fase dell'espansione multi-documento di PrecisionQuote
e va completata prima di ogni altra fase perché tocca i file che tutte
le altre fasi modificheranno.

**Out of scope v1.1**: AI harness generico (retry logic, fallback
provider, JSON schema validation stretta, token budget warning, response
caching, merge quality scoring, system prompt per-settore, context
builder LLM-based) e UX preventivi AI generica (diff preview, undo
merge, prompt suggestions contestuali, multi-turn chat UI, streaming
visualization formattata, token counter visibile, keyboard shortcut,
prompt history). Questi sono argomenti troppo grandi per il phase0 e
verranno trattati in spec dedicati (Phase 8 AI harness, Phase 9 UX
preventivi AI) quando l'utente lo richiederà.

## 1. Purpose & Scope

**Purpose**: eliminare la race condition auto-save vs AI merge senza
introdurre regressioni sul flusso di salvataggio manuale, e migliorare
il feedback UX durante e dopo il merge AI per ridurre la confusione
dell'utente.

**Scope**:
- Modificare `src/components/EditorView.tsx` (auto-save timer)
- Modificare `App.tsx` (`saveCurrentQuote` signature, `runAI` toast
  post-merge, `runAI` error recovery)
- Modificare `src/components/Topbar.tsx` (stato save durante AI
  processing)
- Aggiungere test di regressione in `src/components/__tests__/EditorView.autosave.test.tsx`
- Aggiungere test in `src/components/__tests__/Topbar.saveStatus.test.tsx`
  per il nuovo stato save
- Aggiungere test in `App.test.tsx` (nuovo file) per il toast post-merge
  dettagliato e la recovery errori

**Out of scope**:
- Refactor del sistema di salvataggio in una state machine esplicita
  (`'idle' | 'dirty' | 'saving' | 'aiMerging'`) — rimandato a v2
- Modifica al comportamento del dialog `SaveDialog`
- Modifica al flow del `PdfImportModal`
- AI harness generico (retry, fallback provider, caching, ecc.) —
  Phase 8
- UX preventivi AI generica (diff preview, undo, multi-turn chat UI,
  ecc.) — Phase 9

**Intended audience**: sviluppatore che implementa la fix e i 3
miglioramenti UX; reviewer che verifica i test di regressione.

**Assumptions**:
- L'AI processing è tracciato dallo stato `isProcessing` di `useAI`,
  già cablato come prop in `EditorView` (linea 107 di `EditorView.tsx`).
- L'auto-save attuale è l'unico consumer silenzioso di `saveCurrentQuote`.
- `ProcessResult.changes` in `src/ai/types.ts` espone la lista delle
  modifiche applicate dal merge (gia popolata da `mergeAIResponse` e
  dai tool results).
- `useToast` hook è disponibile in `App.tsx` (già usato per i toast
  esistenti).

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
- **Save status**: stato visualizzato nella Topbar
  (`src/components/Topbar.tsx:62-67`). Valori attuali: "Non salvato"
  (dirty), "Salvato HH:MM" (saved), null (initial). Nuovo valore
  introdotto in questa fase: "AI in corso, salvataggio sospeso".
- **Merge change**: entry nell'array `ProcessResult.changes` restituito
  da `AIOrchestrator.processPrompt`. Tipi: `tool:<name>` (tool
  eseguito), `error:<kind>` (errore di merge), testo libero (modifica
  applicata al quote, es. "Titolo progetto: \"Nuovo titolo\"").
- **Recovery suggestion**: messaggio azionabile mostrato all'utente
  quando l'AI fallisce, con suggerimento su come riprovare o
  workaround.

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
- **REQ-007**: La Topbar mostra un nuovo stato save quando
  `isProcessing === true`: "AI in corso, salvataggio sospeso" con
  icona spinner o pulsante (invece di "Non salvato" che confonde
  l'utente facendogli pensare che le modifiche saranno perse).
- **REQ-008**: Dopo AI merge riuscito con ≥1 modifica applicata
  (`result.changes` contiene almeno una entry non-error), il toast
  post-merge mostra un summary dettagliato: "AI: 5 modifiche applicate
  (2 prezzi, 1 descrizione, 2 clausole). Vedi log." invece del generico
  "AI: prompt applicato con successo".
- **REQ-009**: Dopo AI merge con 0 modifiche (analysis mode, o AI non
  ha applicato nulla), il toast mostra: "AI: nessuna modifica applicata
  — vedi log per la risposta testuale" (per analysis mode) oppure
  "AI: nessuna modifica riconosciuta dal prompt. Riformula più
  specificamente?" (per modify mode che non ha prodotto cambiamenti).
- **REQ-010**: Quando l'AI fallisce con errore (catch block in
  `App.tsx:273-275`), il toast error include un suggerimento azionabile
  basato sul tipo di errore:
  - `402 Payment Required` → "Credito DeepSeek esaurito. Ricarica su
    platform.deepseek.com e riprova."
  - `429 Too Many Requests` → "Troppe richieste AI. Attendi 30s e
    riprova."
  - `timeout` / `network` → "Connessione assente o lenta. Verifica la
    rete e riprova."
  - `JSON parse error` → "AI non ha restituito JSON valido. Prova con
    un prompt più specifico (es. 'cambia il titolo in X' invece di
    'migliora')."
  - altro → "Errore AI. Riprova, o modifica manualmente dalla colonna
    di sinistra."
- **REQ-011**: Il toast post-merge dettagliato e il toast error con
  suggerimento usano `useToast` esistente con tipo `success` o `error`.
  Durata: 5s (invece dei 3s default) per dare tempo di leggere il
  summary.
- **REQ-012**: Il nuovo stato save "AI in corso, salvataggio sospeso"
  scompare non appena `isProcessing` passa a `false`, sostituito da
  "Non salvato" (perché il merge ha settato `isDirty=true`). Questo
  transizione chiara comunica all'utente: AI finita, ora devi salvare.
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

### `Topbar.tsx` — nuovo stato save durante AI processing

```tsx
interface TopbarProps {
  // ...prop esistenti
  isProcessing?: boolean;  // nuovo prop opzionale
}

// Nel render del save-status (linea 61-67 attuale):
{isProcessing ? (
  <span className="save-status-processing">
    <span className="spinner-mini" aria-hidden="true" />
    AI in corso, salvataggio sospeso
  </span>
) : isDirty ? (
  <span className="save-status-dirty">● Non salvato</span>
) : lastSaveTime ? (
  <span className="save-status-saved">● Salvato {formatTime(lastSaveTime)}</span>
) : null}
```

La priorità visiva è: `isProcessing` > `isDirty` > `lastSaveTime`. Il
nuovo stato ha un'icona spinner per renderlo distinguibile dal "Non
salvato" statico.

### `App.tsx` — `runAI` toast post-merge dettagliato + error recovery

```ts
// Helper nuovo (in App.tsx o estratto in src/utils/mergeSummary.ts):
function summarizeMergeChanges(changes: string[]): {
  count: number;
  breakdown: { tools: number; textEdits: number; errors: number };
  summary: string;
} {
  let tools = 0, errors = 0, textEdits = 0;
  for (const c of changes) {
    if (c.startsWith('tool:')) tools++;
    else if (c.startsWith('error:')) errors++;
    else textEdits++;
  }
  const count = tools + textEdits;
  const parts: string[] = [];
  if (tools > 0) parts.push(`${tools} tool`);
  if (textEdits > 0) parts.push(`${textEdits} modifiche testo`);
  const summary = parts.length > 0
    ? `${count} modifiche applicate (${parts.join(', ')}). Vedi log.`
    : 'nessuna modifica applicata';
  return { count, breakdown: { tools, textEdits, errors }, summary };
}

function buildErrorSuggestion(errorMessage: string): string {
  const lower = errorMessage.toLowerCase();
  if (lower.includes('402') || lower.includes('payment') || lower.includes('credito')) {
    return 'Credito DeepSeek esaurito. Ricarica su platform.deepseek.com e riprova.';
  }
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('troppe')) {
    return 'Troppe richieste AI. Attendi 30s e riprova.';
  }
  if (lower.includes('timeout') || lower.includes('network') || lower.includes('fetch')) {
    return 'Connessione assente o lenta. Verifica la rete e riprova.';
  }
  if (lower.includes('json') || lower.includes('parse')) {
    return 'AI non ha restituito JSON valido. Prova con un prompt più specifico (es. "cambia il titolo in X" invece di "migliora").';
  }
  return 'Errore AI. Riprova, o modifica manualmente dalla colonna di sinistra.';
}

// Nel runAI (App.tsx:262-275), sostituire il blocco try/catch:
try {
  const result = await processPrompt(quote, userPrompt, {
    modelId: aiModel,
    onProgress: () => {},
    onStream: () => {},
  });

  setQuote(result.quote as PremiumQuote);
  markDirty();

  const { count, summary } = summarizeMergeChanges(result.changes);
  if (count > 0) {
    addToast('success', `AI: ${summary}`, 5000);
  } else {
    // Distingui analysis mode da modify mode vuoto
    const wasAnalysis = needsAnalysis(userPrompt);
    addToast(
      'info',
      wasAnalysis
        ? 'AI: nessuna modifica applicata — vedi log per la risposta testuale'
        : 'AI: nessuna modifica riconosciuta dal prompt. Riformula più specificamente?',
      5000
    );
  }
} catch (err: any) {
  const suggestion = buildErrorSuggestion(err.message || '');
  addToast('error', suggestion, 5000);
}
```

`useToast.addToast` esistente accetta `(type, message, durationMs?)` —
verificare la signature attuale; se non supporta `durationMs`, aggiungerlo
in `useToast.ts` come parametro opzionale (default 3000, override
esplicito per i toast AI a 5000ms).

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
- **AC-010**: Given AI sta processando (`isProcessing === true`) e
  l'editor è dirty, When l'utente guarda la Topbar, Then vede "AI in
  corso, salvataggio sospeso" con spinner (NON "Non salvato").
- **AC-011**: Given AI merge riuscito con `result.changes = ['tool:apply_discount', 'Titolo: "X"', 'Cliente: "Y"']`,
  When il toast appare, Then il testo è "AI: 3 modifiche applicate
  (1 tool, 2 modifiche testo). Vedi log." con durata 5s.
- **AC-012**: Given AI merge con `result.changes = []` e prompt era
  "analizza il preventivo" (analysis mode), When il toast appare, Then
  il testo è "AI: nessuna modifica applicata — vedi log per la
  risposta testuale" con durata 5s.
- **AC-013**: Given AI merge con `result.changes = []` e prompt era
  "rendi premium" (modify mode, nessun risultato), When il toast
  appare, Then il testo è "AI: nessuna modifica riconosciuta dal
  prompt. Riformula più specificamente?" con durata 5s.
- **AC-014**: Given AI fallisce con errore "402 Payment Required",
  When il toast error appare, Then il testo include "Credito DeepSeek
  esaurito. Ricarica su platform.deepseek.com e riprova." con durata 5s.
- **AC-015**: Given AI fallisce con errore "Failed to fetch" (network),
  When il toast error appare, Then il testo include "Connessione
  assente o lenta. Verifica la rete e riprova." con durata 5s.
- **AC-016**: Given AI finisce (`isProcessing` va a false) e il merge
  ha settato `isDirty=true`, When l'utente guarda la Topbar, Then lo
  stato save passa da "AI in corso, salvataggio sospeso" a "Non
  salvato" (transizione chiara).
- **AC-017**: Given `useToast.addToast` viene chiamato con durata
  esplicita 5000ms, When il toast appare, Then sparisce dopo 5s (non
  3s default).

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

### Test per UX merge feedback (nuovi)

**File**: `src/components/__tests__/Topbar.saveStatus.test.tsx`
- Test 8: Topbar mostra "AI in corso, salvataggio sospeso" con spinner
  quando `isProcessing=true` (anche se `isDirty=true`)
- Test 9: Topbar mostra "Non salvato" quando `isProcessing=false` e
  `isDirty=true`
- Test 10: Topbar mostra "Salvato HH:MM" quando `isProcessing=false`,
  `isDirty=false`, `lastSaveTime` settata
- Test 11: Transizione `isProcessing=true → false` con `isDirty=true`
  mostra prima "AI in corso" poi "Non salvato"

**File**: `App.test.tsx` (nuovo file, o estensione se esiste)
- Test 12: `runAI` con `result.changes` contenente 3 entry (1 tool, 2
  testo) → toast "AI: 3 modifiche applicate (1 tool, 2 modifiche
  testo). Vedi log." con `durationMs=5000`
- Test 13: `runAI` con `result.changes=[]` e prompt "analizza" → toast
  info "AI: nessuna modifica applicata — vedi log per la risposta
  testuale"
- Test 14: `runAI` con `result.changes=[]` e prompt "rendi premium" →
  toast info "AI: nessuna modifica riconosciuta dal prompt. Riformula
  più specificamente?"
- Test 15: `runAI` throw con message "402 Payment Required" → toast
  error "Credito DeepSeek esaurito. Ricarica su
  platform.deepseek.com e riprova."
- Test 16: `runAI` throw con message "Failed to fetch" → toast error
  "Connessione assente o lenta. Verifica la rete e riprova."
- Test 17: `runAI` throw con message "Unexpected token < in JSON" →
  toast error "AI non ha restituito JSON valido. Prova con un prompt
  più specifico..."
- Test 18: `summarizeMergeChanges(['tool:x', 'error:y', 'Titolo: z'])`
  ritorna `{ count: 2, breakdown: { tools: 1, textEdits: 1, errors: 1 } }`
  (errors non contano in count)
- Test 19: `buildErrorSuggestion("unknown error")` ritorna il fallback
  "Errore AI. Riprova, o modifica manualmente dalla colonna di
  sinistra."

**File**: `src/hooks/__tests__/useToast.test.ts` (estensione)
- Test 20: `addToast('success', 'msg', 5000)` crea toast con
  `durationMs=5000` (non 3000 default)

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

**Perché i 3 miglioramenti UX sono nel phase0 e non in fase separata**:

Il fix auto-save cambia quando il save fire. Senza i 3 miglioramenti UX
correlati, l'utente osserva comportamenti confusi:
1. Durante AI processing (30s+), la Topbar mostra "Non salvato" →
   l'utente pensa che le modifiche saranno perse, click "Salva"
   manualmente → ma il save è nello stato pre-merge, sovrascrivibile
   a 35s dal merge AI. Il nuovo stato "AI in corso, salvataggio
   sospeso" comunica chiaramente che il salvataggio è pausato per
   motivo.
2. Dopo merge riuscito, toast generico "AI: prompt applicato con
   successo" non dice cosa è cambiato. L'utente deve aprire il log per
   capirlo. Il toast dettagliato "AI: 5 modifiche applicate (2 prezzi,
   1 descrizione, 2 clausole)" dà feedback immediato.
3. Dopo errore AI, toast "Errore AI" è inazione. L'utente non sa se
   riprovare, modificare il prompt, o controllare la rete. Il
   suggerimento azionabile ("Credito esaurito, ricarica su X" o
   "Prova con prompt più specifico") guida l'utente al prossimo step.

Questi 3 miglioramenti sono strettamente legati al flusso "AI
processing → merge → save" che il phase0 modifica, e non avrebbero
senso senza il fix auto-save (perché il fix cambia quando il save fire,
e l'UX deve rifletterlo). Separarli in un'altra fase significherebbe
o passare per una fase 0 con UX confusa temporanea, o bloccare il fix
auto-save finché l'UX non è pronta. Entrambe le opzioni sono peggio
dell'inclusione diretta.

**Perché durata toast 5s invece di 3s default**:

Il toast post-merge dettagliato e il toast error con suggerimento
contengono più testo del toast generico attuale. 3s non sono
sufficienti per leggere "AI: 5 modifiche applicate (1 tool, 2
modifiche testo, 2 clausole). Vedi log." o "Credito DeepSeek
esaurito. Ricarica su platform.deepseek.com e riprova.". 5s sono
ancora sotto la soglia di "toast fastidioso" (7s+) ma danno tempo
di lettura.

**Perché `summarizeMergeChanges` è helper puro e non metodo della
classe AIOrchestrator**:

L'helper non dipende da stato interno dell'orchestrator, solo
dall'array `changes` restituito. Separarlo come funzione pura in
`src/utils/mergeSummary.ts` (o inline in App.tsx se piccolo) permette
di testarlo in isolamento senza mockare l'orchestrator, e di riusarlo
in futuro in altri context (es. CollectionView potrebbe mostrare
"questo preventivo è stato modificato 5 volte dall'AI" leggendo
`changes` salvati).

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

### Edge case 5: AI merge con 0 modifiche ma prompt era "analizza"

```ts
// prompt = "analizza il preventivo"
// needsAnalysis(prompt) === true (keyword "analizza")
// → AI mode = analysis, result.changes = []
// → toast info: "AI: nessuna modifica applicata — vedi log per la
//   risposta testuale"
// → l'utente sa che era analysis mode e deve leggere il log per
//   vedere i suggerimenti
```

### Edge case 6: AI merge con errori in changes ma anche modifiche

```ts
// result.changes = ['tool:apply_discount', 'error:invalid_quote:3', 'Titolo: "X"']
// → count = 2 (tool + textEdit), errors = 1
// → toast: "AI: 2 modifiche applicate (1 tool, 1 modifiche testo).
//   Vedi log."
// → l'utente vede che 2 modifiche sono andate, ma il log mostra che
//   1 errore è stato skippato (trasparenza)
```

### Edge case 7: Errore AI con message non riconosciuto

```ts
// err.message = "Unexpected server error"
// → buildErrorSuggestion non matcha nessun pattern noto
// → fallback: "Errore AI. Riprova, o modifica manualmente dalla
//   colonna di sinistra."
// → l'utente ha un'azione alternativa (modifica manuale) anche se il
//   messaggio originale è criptico
```

### Edge case 8: Transizione rapida isProcessing true → false → true

```ts
// T=0: utente invia prompt 1 → isProcessing=true, Topbar="AI in corso"
// T=5s: AI 1 finisce, isProcessing=false, merge applicato, isDirty=true
//       Topbar="Non salvato"
// T=6s: utente invia prompt 2 (prima del cooldown 5s scaduto)
//       isProcessing=true di nuovo, Topbar="AI in corso"
//       cooldownRef aggiornato a T=6s + 5s = T=11s
// T=11s: cooldown scaduto, ma isProcessing ancora true (prompt 2 lungo)
//        → auto-save skippato per processingRef
// T=40s: prompt 2 finisce, isProcessing=false, merge applicato
//        cooldownRef = T=40s + 5s = T=45s
// T=45s: auto-save fire con silent=true, salva il quote con merge 1+2
```

L'utente vede: "AI in corso" → "Non salvato" → "AI in corso" → "Non
salvato" → salvato. Transizioni chiare ad ogni step.

## 10. Validation Criteria

Prima di considerare la fase 0 completata, verificare:

1. `npm run typecheck` esce con code 0.
2. `npm run test` esce con code 0.
3. Il test `EditorView.autosave.test.tsx` copre tutti gli AC-001 →
   AC-017.
4. `git diff src/components/EditorView.tsx` mostra:
   - `processingRef` e `cooldownRef` aggiunti
   - Effect `useEffect([isProcessing])` per aggiornare `cooldownRef`
   - `setInterval` body con 3 guard clauses
5. `git diff App.tsx` mostra:
   - `saveCurrentQuote` con nuova signature opts-object + backward
     compat per `string`
   - Logica `silent` che salta il suffisso ` (auto)`
   - Helper `summarizeMergeChanges` e `buildErrorSuggestion` (inline
     o estratti in `src/utils/mergeSummary.ts`)
   - `runAI` con toast post-merge dettagliato (success o info in base
     a count modifiche)
   - `runAI` catch block con `buildErrorSuggestion(err.message)`
6. `git diff src/components/Topbar.tsx` mostra:
   - Nuovo prop `isProcessing?: boolean`
   - Save-status con 3 rami: `isProcessing` → spinner, `isDirty` →
     "Non salvato", `lastSaveTime` → "Salvato HH:MM"
7. `git diff src/hooks/useToast.ts` mostra:
   - `addToast` accetta `durationMs?: number` opzionale (default 3000)
8. Nessuna modifica a `api/`, `db/`, `vercel.json`, `package.json`.
9. `git status` mostra solo i file modificati/aggiunti:
   - `src/components/EditorView.tsx`
   - `App.tsx`
   - `src/components/Topbar.tsx`
   - `src/hooks/useToast.ts`
   - `src/components/__tests__/EditorView.autosave.test.tsx`
   - `src/components/__tests__/Topbar.saveStatus.test.tsx`
   - `App.test.tsx` (nuovo)
   - `src/utils/mergeSummary.ts` (se estratto) +
     `src/utils/__tests__/mergeSummary.test.ts`

## 10b. Future phases (riferimento, NON implementare in phase0)

I seguenti miglioramenti sono identificati come desiderabili ma out of
scope per il phase0. Verranno trattati in spec dedicati quando
l'utente lo richiederà.

### Phase 8 — AI harness (TBD)

Gap identificati nel codice AI attuale (`src/ai/`):

- **Retry logic con backoff**: se DeepSeek 502/timeout, retry
  automatico 1 volta con 2s backoff. Attualmente l'errore propaga
  direttamente all'utente (`src/ai/index.ts:162-399`).
- **Fallback provider**: se DeepSeek down, fallback automatico a
  OpenAI o Anthropic (già previsto in `AI_ARCHITECTURE.md` ma non
  implementato).
- **JSON schema validation stretta**: `quoteSchema.partial().safeParse`
  in `src/ai/index.ts:335,373` scarta silenziosamente se invalid.
  Aggiungere logging delle issue specifiche per debug.
- **Token budget warning**: check token solo prima di processare
  (`src/hooks/useAI.ts:118-129`). Aggiungere warning a 80% budget con
  toast "Hai usato l'80% del tuo budget AI".
- **Response caching per prompt identici**: se l'utente fa lo stesso
  prompt 2 volte entro 1h, riusa la risposta cacheata. Hash di
  `(prompt + quote.quoteId + quote.updatedAt)`.
- **System prompt per-settore**: `src/ai/prompts/system.ts` ha 2
  versioni fisse. Aggiungere personalizzazione per settore
  (`user_settings.profession`) con esempi specifici.
- **Context builder LLM-based**: `src/ai/prompts/context.ts:40-74`
  usa keyword matching fragile. Sostituire con LLM-based field
  detection (1 chiamata veloce per identificare campi rilevanti).
- **Merge quality scoring**: `src/ai/merge.ts` applica cambiamenti
  senza score. Aggiungere score 0-100 basato su: campi cambiati,
  validation, conflict resolution. Mostrare nello UI.
- **Tool call result structured**: `ToolResult.changes` è stringa.
  Strutturare come `{ toolName, summary, affectedFields[] }` per
  UI più ricca.
- **Model routing per task**: l'utente sceglie "deepseek-chat" o
  "deepseek-v4-pro" manualmente. Routing automatico: analysis →
  modello costoso, modify → modello economico, numeric → modello
  veloce.

### Phase 9 — UX preventivi AI (TBD)

Gap identificati nei componenti AI UX attuali:

- **Diff preview pre-merge**: modal "AI propone 5 modifiche: [diff].
  Accetta tutto / Accetta parziale / Rifiuta." prima di applicare.
- **Undo merge**: bottone "Undo AI" per 30s dopo merge, ripristina
  stato pre-AI. Richiede history stack in App.tsx.
- **Prompt suggestions contestuali**: invece di 4 bottoni fissi
  (premium, faq, discount, simple), suggerimenti basati sul contesto
  ("Vedo che hai 3 opzioni senza manutenzione. Vuoi aggiungerla?").
- **Multi-turn chat UI**: `ChatStore` ha la cronaca ma UI mostra solo
  log. Esporre come chat navigabile con bubble user/assistant.
- **Streaming visualization formattata**: streamed content mostrato
  come log entry "Generazione in corso... X caratteri" ma non come
  testo formattato live. Aggiungere preview live del testo in arrivo.
- **Token counter visibile**: counter in topbar "Token: 12.3K / 1M"
  aggiornato in tempo reale.
- **Keyboard shortcut per prompt**: `Cmd+Enter` per submit prompt
  (standard industriale), `Esc` per cancellare.
- **Prompt history**: utente può vedere/riusare prompt passati.
  Dropdown "Prompt recenti" nella AI panel.
- **Prompt template library**: salvare prompt riusabili come
  template (es. "Aggiungi clausola FAQ" personalizzato).
- **Comparison view pre/post merge**: side-by-side del quote prima e
  dopo il merge AI, con highlight delle differenze.
- **Log readability improvements**: `AILogPanel.tsx` ha entries
  testuali con icone. Aggiungere: color-coded per severity,
  collapsable per categoria (tool/stream/error/success), filter per
  tipo.
- **Recovery path per merge fallito**: se merge fallisce (JSON
  invalid), invece di solo toast errore, mostrare "AI ha restituito
  JSON non valido. Vuoi vedere la risposta raw? [Si] [No, riprova]".

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

### Fasi future opzionali (TBD)

- **Phase 8 — AI harness**: retry logic, fallback provider, JSON
  validation stretta, token budget warning, response caching, system
  prompt per-settore, context builder LLM-based, merge quality
  scoring, tool call result structured, model routing per task. Vedi
  sezione 10b per dettagli.
- **Phase 9 — UX preventivi AI**: diff preview pre-merge, undo merge,
  prompt suggestions contestuali, multi-turn chat UI, streaming
  visualization formattata, token counter visibile, keyboard shortcut,
  prompt history, prompt template library, comparison view, log
  readability, recovery path merge fallito. Vedi sezione 10b per
  dettagli.
