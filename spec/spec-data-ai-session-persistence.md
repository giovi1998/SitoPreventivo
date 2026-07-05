---
title: AI Session Persistence — chatStore con adapter localStorage
version: 1.0
date_created: 2026-07-05
last_updated: 2026-07-05
owner: Giovanni Cidu
tags: [data, ai, persistence, localStorage, session, chat-store]
---

# Introduction

`chatStore` (`src/ai/chat/store.ts`) è in-memory: sessioni perdute al
refresh pagina, niente replay, niente multi-tab. Questa spec introduce un
adapter localStorage (chiave versionata `pq_ai_sessions:v1`) che persiste
sessioni mantenendo backward compat. Risolve il gap più visibile: utente
lavora a un preventivo, refresha per errore, perde tutta la chat AI.

## 1. Purpose & Scope

**Purpose**: persistere sessioni AI in localStorage, permettere replay e
continuità tra refresh.

**Scope**:
- Refactor `src/ai/chat/store.ts` (ChatStore + adapter)
- Nuovo `src/ai/chat/localStorageAdapter.ts`
- Nuovo `src/ai/chat/__tests__/persistence.test.ts`
- Aggiornamento `src/ai/chat/__tests__/store.test.ts` (spy localStorage)

**Audience**: sviluppatore AI.

**Assunzioni**:
- `chatStore` singleton resta esportato da `store.ts`.
- API `ChatStore` resta identica (backward compat).
- `localStorage` disponibile in browser (jsdom in test). In ambiente
  server (Vercel function) niente localStorage → adapter no-op.
- Chiave versionata `pq_ai_sessions:v1` (conforme AGENTS.md localStorage
  schema).
- Cap sessioni persistite: 5 (per non saturare localStorage 5MB).
- Cap messaggi per sessione: 50 (invariato).

## 2. Definitions

- **ChatStore**: classe esistente in `src/ai/chat/store.ts`, in-memory
  `Map<id, ChatSession>`.
- **SessionAdapter**: interfaccia per persistenza. Implementazione
  `localStorageSessionAdapter` (browser), `noopSessionAdapter` (server).
- **ChatSession**: `{ id: string; messages: ChatMessage[]; createdAt: string; updatedAt: string }`.
- **Versioning chiave**: `pq_ai_sessions:v1`. Se schema cambia, `v2` +
  fallback lettura `v1` (conforme AGENTS.md).

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: Definire interfaccia `SessionAdapter`:
  ```typescript
  interface SessionAdapter {
    load(): ChatSession[]; // tutte le sessioni persistite
    save(sessions: ChatSession[]): void;
    clear(): void;
  }
  ```
- **REQ-002**: Implementare `localStorageSessionAdapter`:
  - `load()`: `JSON.parse(localStorage.getItem('pq_ai_sessions:v1') ?? '[]')`,
    fallback `[]` su parse error
  - `save(sessions)`: `localStorage.setItem('pq_ai_sessions:v1', JSON.stringify(sessions))`
  - `clear()`: `localStorage.removeItem('pq_ai_sessions:v1')`
  - Cap 5 sessioni: se `sessions.length > 5`, keep le 5 più recenti per
    `updatedAt`
- **REQ-003**: Implementare `noopSessionAdapter` (per SSR/Vercel):
  - `load()` → `[]`
  - `save()` → no-op
  - `clear()` → no-op
- **REQ-004**: `ChatStore` refactor:
  - Costruttore opzionale `constructor(adapter?: SessionAdapter)`. Se non
    passato, detect: `typeof localStorage !== 'undefined'` →
    localStorageSessionAdapter, altrimenti noop.
  - Su `addMessage`: dopo update in-memory, `this.adapter.save(top 5
    sessions)` (debounce 500ms per non scrivere ogni messaggio)
  - Su `clearSession`: update in-memory + save
  - Su `cleanup`: remove old sessions in-memory + save
  - Su init (costruttore): `this.sessions = new Map(adapter.load().map(s =>
    [s.id, s]))`
- **REQ-005**: Backward compat: API `ChatStore` pubblica identica
  (`createSession`, `getSession`, `addMessage`, `clearSession`,
  `getHistory`, `getRecentSessionIds`, `cleanup`).
- **REQ-006**: Singleton `chatStore` istanziato con auto-detect adapter.
- **REQ-007**: Su schema change futuro, `load()` legge `v1` e migra a
  `v2`. Per ora solo `v1` esiste.
- **CON-001**: Zero breaking change. Test esistenti verdi.
- **CON-002**: niente IndexedDB (overkill per 5 sessioni × 50 msg).
- **CON-003**: Debounce save 500ms per non bloccare UI su stream rapido.
- **CON-004**: In SSR (Vercel function, niente localStorage), adapter
  noop. `chatStore` comunque funziona in-memory (sessioni perdute a
  fine request, come prima).
- **GUD-001**: Chiave `pq_ai_sessions:v1` conforme AGENTS.md "localStorage
  schema versionato".
- **GUD-002**: Niente PII utente nel log di save (messaggi AI sono
  payload utente, restano in localStorage locale, niente upload server).
- **PAT-001**: Adapter pattern (strategia): `ChatStore` dipende da
  `SessionAdapter` interfaccia, non implementazione. Testabile con mock.
- **PAT-002**: Auto-detect environment (come `IS_LOCAL` in
  `dataService.js`).

## 4. Interfaces & Data Contracts

**SessionAdapter**:

```typescript
export interface SessionAdapter {
  load(): ChatSession[];
  save(sessions: ChatSession[]): void;
  clear(): void;
}

export class localStorageSessionAdapter implements SessionAdapter {
  constructor(private key: string = 'pq_ai_sessions:v1', private maxSessions: number = 5) {}
  load(): ChatSession[];
  save(sessions: ChatSession[]): void;
  clear(): void;
}

export class noopSessionAdapter implements SessionAdapter {
  load(): ChatSession[] { return []; }
  save(_sessions: ChatSession[]): void {}
  clear(): void {}
}
```

**ChatStore refactor**:

```typescript
export class ChatStore {
  private sessions = new Map<string, ChatSession>();
  private adapter: SessionAdapter;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(adapter?: SessionAdapter) {
    this.adapter = adapter ?? autoDetectAdapter();
    // Hydrate from adapter
    const loaded = this.adapter.load();
    for (const s of loaded) this.sessions.set(s.id, s);
  }

  // API esistenti identiche
  createSession(): ChatSession;
  getSession(id: string): ChatSession | undefined;
  addMessage(sessionId: string, message: ChatMessage): void; // + debounced save
  clearSession(sessionId: string): void; // + save
  getHistory(sessionId: string, maxMessages?: number): ChatMessage[];
  getRecentSessionIds(maxAgeMs?: number): string[];
  cleanup(maxAgeMs?: number): number; // + save
}

function autoDetectAdapter(): SessionAdapter {
  if (typeof localStorage !== 'undefined') return new localStorageSessionAdapter();
  return new noopSessionAdapter();
}

export const chatStore = new ChatStore(); // auto-detect
```

## 5. Acceptance Criteria

- **AC-001**: Given `ChatStore` con localStorage mock, When si chiama
  `createSession` + `addMessage`, Then `localStorage.getItem('pq_ai_sessions:v1')`
  contiene la sessione dopo 500ms debounce.
- **AC-002**: Given `ChatStore` freshly istanziato (simula refresh), When
  `adapter.load()` ritorna 2 sessioni, Then `chatStore.getRecentSessionIds()`
  ritorna quei 2 id.
- **AC-003**: Given 7 sessioni salvate, When `adapter.save(7 sessions)`,
  Then localStorage contiene solo 5 (le più recenti per `updatedAt`).
- **AC-004**: Given `localStorage.setItem('pq_ai_sessions:v1', 'invalid json')`,
  When `adapter.load()` eseguito, Then ritorna `[]` (no crash).
- **AC-005**: Given `noopSessionAdapter`, When `save()` chiamato, Then
  no-op (no localStorage touch).
- **AC-006**: Given `chatStore.clearSession(id)`, When eseguito, Then
  localStorage aggiornato (session rimossa).
- **AC-007**: Given `chatStore.cleanup(24h)`, When eseguito, Then
  localStorage aggiornato (session vecchie rimosse).
- **AC-008**: Given test esistenti `store.test.ts`, When eseguiti, Then
  passano (con localStorage mock se necessario).
- **AC-009**: Given `npm run typecheck`, Then verde.
- **AC-010**: Given `npm test`, Then 1662+ verdi.

## 6. Test Automation Strategy

- **Test Levels**: Unit (adapter, ChatStore con mock localStorage).
- **Frameworks**: Vitest, jsdom (localStorage disponibile).
- **Test Data Management**: fixture ChatSession inline. Mock
  `localStorage` via `vi.spyOn`.
- **CI/CD Integration**: `npm test` pre-push.
- **Coverage Requirements**: ≥80% su `localStorageAdapter.ts`, ≥70% su
  `store.ts` refactor.
- **Test nuovi** (~10):
  - `persistence.test.ts`:
    - `localStorageSessionAdapter.load()` empty
    - `load()` con dati validi
    - `load()` con JSON invalid → `[]`
    - `save()` cap 5 sessioni
    - `save()` ordina per `updatedAt`
    - `clear()` rimuove chiave
    - `noopSessionAdapter` tutti no-op
    - `ChatStore` hydrate da adapter
    - `ChatStore.addMessage` + debounce save (vi.useFakeTimers)
    - `ChatStore.clearSession` + save
    - `ChatStore.cleanup` + save

## 7. Rationale & Context

Perdita sessione AI al refresh è il gap UX più lamentato. Soluzione
 semplice: localStorage. IndexedDB è overkill (5 sessioni × 50 msg ×
~500 char = ~125KB, ben sotto 5MB localStorage). Adapter pattern permette
test deterministici (mock adapter) e futuro swap a IndexedDB se volume
cresce. Debounce 500ms evita write su ogni chunk stream (potrebbero essere
100+/s). Auto-detect gestisce SSR senza if diffusi.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: `localStorage` browser API. Disponibile in jsdom (test).

### Third-Party Services
- Nessuno.

### Infrastructure Dependencies
- Nessuna.

### Data Dependencies
- **DAT-001**: `src/ai/chat/store.ts` (refactor).
- **DAT-002**: AGENTS.md "localStorage Schema" — chiavi versionate
  (`pq_ai_sessions:v1` conforme).

### Technology Platform Dependencies
- **PLT-001**: TypeScript, Vitest, jsdom.

### Compliance Dependencies
- **COM-001**: Messaggi AI in localStorage sono dati utente locali. GDPR:
  niente upload server senza consenso. Questa spec non uploada niente.

## 9. Examples & Edge Cases

**Esempio hydrate al refresh**:

```typescript
// Pre-refresh: chatStore ha 3 sessioni
chatStore.createSession(); // session1
chatStore.addMessage('session1', { role: 'user', content: 'cambia prezzo' });
// ... 500ms dopo localStorage ha session1

// Post-refresh: nuovo chatStore
// constructor() → adapter.load() → [session1] → this.sessions.set(...)
// chatStore.getSession('session1') ritorna la sessione con messaggio ✓
```

**Edge case — localStorage pieno**: `QuotaExceededError` su `save`.
Adapter catch e log warning (no crash). Sessioni in-memory preservate.

**Edge case — chiave v1 → v2 futuro**: `load()` prova `v2`, fallback
`v1` + migrazione (per ora solo `v1`, no migrazione necessaria).

**Edge case — SSR Vercel**: `typeof localStorage === 'undefined'` →
`noopSessionAdapter`. `chatStore` funziona in-memory, sessioni perdute a
fine request (come pre-refactor, nessun regression).

## 10. Validation Criteria

- Tutti AC-001..010 verdi.
- `src/ai/chat/localStorageAdapter.ts` esiste con 2 implementazioni.
- `src/ai/chat/store.ts` refactorato, API identica.
- `src/ai/chat/__tests__/persistence.test.ts` con ≥10 test.
- `npm test` verde (1662 + ~10 nuovi).
- `npm run typecheck` verde.

## 11. Related Specifications / Further Reading

- `spec/spec-architecture-ai-base-orchestrator.md` — BaseOrchestrator usa
  chatStore.
- `AGENTS.md` sezione "localStorage Schema" — convenzione versionamento
  chiavi.
- `src/ai/chat/store.ts` — file refactorare.
- `src/utils/dataService.js` — pattern `IS_LOCAL` auto-detect riferimento.