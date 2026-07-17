---
title: AI-First UX Redesign — Design System Unification, AI Console, AI Observability
version: 1.0
date_created: 2026-07-18
owner: Giovanni
tags: [design, ux, ai-first, logging, observability, architecture, frontend]
supersedes: spec-ai-assist-unification
skills: [gpt-taste, frontend-design, create-specification]
---

# Introduction

Quickbrand oggi ha tre problemi strutturali documentati (audit 2026-07-18):

1. **UX/UI frammentata**: due design system sovrapposti (PrecisionQuote legacy +
   "The Classic" Red & Ink), palette residue teal `#01696F` e blu `#0B57D0` in
   ~10 file, token usati ma mai definiti (`--primary`, `--ink-soft`, `--bg`…),
   5 pattern AI diversi tra gli editor, toast architetturalmente rotti
   (9 componenti chiamano `addToast` su istanze locali mai renderizzate).
2. **Logging AI incoerente e parzialmente rotto**: 6 hook AI con plumbing
   duplicato e comportamenti divergenti, `BaseOrchestrator.trackUsage()` usa
   `require()` in browser ESM (no-op silenzioso → token di logo/social/
   onboarding mai tracciati), rate limit "fantasma" su 3 scope, nessuna
   correlazione client↔server (no request-id), nessuna persistenza dei log.
3. **AI percepita come feature secondaria**: l'AI è nascosta in tab/colonne
   diverse per editor, il copy pubblico (HomePage, Login, Onboarding) parla
   ancora di "preventivi", il flusso di creazione parte dal form manuale.

Questo spec definisce la trasformazione **AI-first** di Quickbrand in tre fasi:
Fase 12 (AI Observability), Fase 13 (Design System & UX foundations), Fase 14
(AI Console unificata & AI-first flows). Ogni fase è rilasciabile
indipendentemente e nell'ordine indicato.

## 1. Purpose & Scope

### 1.1 Scopo

| Fase | Nome | Obiettivo |
|------|------|-----------|
| 12 | AI Observability | Un hook di logging condiviso, token tracking corretto al 100%, correlazione request-id client↔server, log server strutturati, rate limit reali |
| 13 | Design System & UX | Un solo design system ("The Classic" esteso), toast funzionanti ovunque, kit `ai-ui` stilizzato, action bar primaria uniforme, breakpoint consolidati, copy allineato |
| 14 | AI Console & AI-first | Un solo pattern AI (AI Console rail/bottom-sheet) per tutti gli editor, creazione documenti AI-first, HomePage/Login/Onboarding riposizionati sull'AI |

### 1.2 In scope

- `src/components/GlobalStyles.tsx`, `src/components/ai-ui/*`, `Layout.tsx`,
  `Topbar.tsx`, tutte le shell editor (`EditorView`, `CardEditorShell`,
  `FlyerEditorShell`, `LogoEditor`, `SocialEditor`, `QREditor`), `HomePage`,
  `LoginPage`, `OnboardingModal`, `CollectionView`.
- `src/hooks/useAI*.ts` (6 hook), nuovo `src/hooks/useAILogs.ts`,
  `src/ai/BaseOrchestrator.ts`, `src/ai/eventLog.ts`, `src/ai/types.ts`,
  `src/components/AILogPanel.tsx`, `src/utils/logger.ts`.
- `api/index.ts`: solo logging strutturato delle route `/api/ai/*` esistenti,
  enforcement rate limit già dichiarati, header `X-Request-Id`. **Nessun nuovo
  endpoint.**

### 1.3 Out of scope

- Nuovi endpoint API, nuovi provider AI, tool AI aggiuntivi.
- GSAP o altre librerie di animazione (v1: CSS + IntersectionObserver, vedi
  CON-002).
- Redesign dei documenti esportati (PDF/SVG/PNG): restano invariati.
- `spec-api-saas-monetization` (track separato, NOT-STARTED).
- QR editor: resta manuale (eccezione documentata, REQ-AI-007).

### 1.4 Assunzioni

- Stato attuale verificato via audit del codice 2026-07-18 (vedi §7.1).
- Convenzione progetto: ogni modifica a `src/`/`api/` richiede test
  (AGENTS.md "Test, OBBLIGATORI").

## 2. Definitions

| Termine | Definizione |
|---------|-------------|
| **AI Console** | Componente shell unico (`AIConsole`) che ospita prompt, azioni rapide, log e tier guard di qualunque editor. Pattern unico AI-first. |
| **AILogEntry** | Record UI di un evento AI (info/success/error/tool/stream), reso da `AILogPanel`. |
| **requestId** | UUID v4 generato dal client per ogni generazione AI, propagato al server via header, presente in ogni log entry e log server correlato. |
| **sessionId** | Identificativo della chat session dell'orchestratore (`chatStore`). |
| **Token (AI)** | Unità di quota utente (`tokensUsed`/`tokenLimit` in `users`). |
| **IMAGE_TOKEN_COST** | Costo flat in token di una generazione immagine Gemini (cover, photo, hero, background). |
| **The Classic** | Palette brand Quickbrand: Red `#E62020` & Ink `#1A1A1A` (fase 8). |
| **Ghost rate limit** | Scope di rate limiting che usa `checkRateLimit` (read-only) senza `recordRateAttempt`: limite dichiarato ma mai applicato. |
| **AIDA** | Struttura pagina marketing: Attention (hero) → Interest (features) → Desire (media/motion) → Action (CTA finale). |
| **Signature element** | L'unico elemento visivo memorabile e distintivo della pagina (skill frontend-design). |

## 3. Requirements, Constraints & Guidelines

### 3.1 Fase 12 — AI Observability (REQ-LOG)

- **REQ-LOG-001**: Estrarre `src/hooks/useAILogs.ts`: unica implementazione di
  stato entries (cap 40), `updateLog`, stream buffer con soglia **80 caratteri**
  (non temporale), finalizzazione uniforme. I 6 hook (`useAI`, `useAICard`,
  `useAIFlyer`, `useAILogo`, `useAISocial`, `useAIOnboarding`) DEVONO migrare a
  questo helper. Il plumbing duplicato (threshold, capping, StreamBuffer) viene
  cancellato dai singoli hook.
- **REQ-LOG-002**: Messaggio finale di stream uniforme per tutti gli hook:
  `Risposta ricevuta · N token · Xs` con `detail` = raw response (troncata a
  2 KB). Oggi 3 formati diversi.
- **REQ-LOG-003**: In caso di errore, l'entry di stream DEVE passare a
  `status: 'error'`. Oggi `useAILogo`/`useAISocial`/`useAIOnboarding` la
  lasciano `pending` per sempre.
- **REQ-LOG-004**: `AILogEntry` v2 aggiunge i campi opzionali `requestId`,
  `sessionId`, `modelId`, `tokens?: { prompt: number; completion: number;
  total: number }`. Rendering back-compat: entry senza i nuovi campi restano
  valide.
- **REQ-LOG-005**: Ogni generazione AI genera un `requestId`
  (`crypto.randomUUID()`), inviato al server come header `X-Request-Id` su
  TUTTE le chiamate `/api/ai/*` (chat, chat/stream, copy-flyer, card-cover,
  card-photo, flyer-hero, logo-background, onboarding-suggest). Il server DEVE
  includere `requestId` in ogni log della request e nella risposta di errore
  JSON (`{ error, requestId }`). Il client, su errore, mostra il requestId
  nell'entry di log (campo `detail`).
- **REQ-LOG-006**: Fix `BaseOrchestrator.trackUsage()`: rimuovere
  `require('../utils/dataService')` (no-op silenzioso in browser ESM) e
  sostituire con `import` statico o `await import()` ESM. Regression test
  obbligatorio: trackUsage chiama `dataService.trackTokens` con l'email e il
  totale corretto.
- **REQ-LOG-007**: Token tracking uniforme: `useAIFlyer` DEVE usare
  `result.response.usage.totalTokens` reale (oggi stima `chars/4`). Le 4 route
  immagine Gemini (`card-cover`, `card-photo`, `flyer-hero`, `logo-background`)
  DEVONO consumare `IMAGE_TOKEN_COST` (costante condivisa, default **500**
  token/immagine) via `POST /users/tokens` dopo successo, lato client negli
  hook corrispondenti.
- **REQ-LOG-008**: Log server strutturati per ogni route `/api/ai/*`, formato
  JSON su `console.info`/`console.error`:
  `{ tag, requestId, email, model, durationMs, tokens?, outcome: 'ok'|'error', errorKind? }`.
  Le route Gemini DEVONO loggare anche successo (`sizeKB`) ed errore upstream
  (`status`, `kind`: timeout/copyright/clamp413/quota). Oggi loggano solo
  "user X ha chiamato".
- **REQ-LOG-009**: Eliminare i ghost rate limit: per gli scope `logs`,
  `tokens`, `aistream` aggiungere `recordRateAttempt` (o migrare a
  `consumeRateLimit`). Limiti effettivi: logs 200/min/IP, tokens 30/min/IP,
  aistream 30/min/IP. Test API di regressione: N+1 richieste → 429.
- **REQ-LOG-010**: Errori di validazione AI visibili: quando
  `parseJsonResponse` produce `schema_fail`, l'hook DEVE (a) mostrare nell'entry
  `detail` il riepilogo issue (count + primo path), (b) inviare
  `logger.error` con meta `{ requestId, issueCount, firstPath }` (mai il raw
  JSON, vedi SEC-003).
- **REQ-LOG-011**: Persistenza log di sessione: ring buffer delle ultime **100**
  entry in `sessionStorage` chiave `pq_ai_logs:v1` (schema versionato).
  `detail` troncato a 2 KB, MAI immagini base64 (SEC-001). Restore al mount
  degli hook. `localStorage` NON usato (lezione quota v2.3: immagini → crash).
- **REQ-LOG-012**: `AILogPanel` v2: badge `N token` e `durationMs` per entry
  quando presenti, requestId nella funzione "Copia log", filtro per tipo
  (tutti/errori/tool), tema light/dark (REQ-DS-008). Il tipo `'result'` morto
  viene rimosso da tipi, mappe icone e label.
- **REQ-LOG-013**: I log di `useAIOnboarding` DEVONO essere visibili:
  `AILogPanel` compatto dentro `OnboardingModal` step 1 durante/dopo una
  generazione. Oggi raccolti e mai renderizzati.
- **REQ-LOG-014**: Una sola istanza `useAILogo` per LogoEditor: sollevare a
  `LogoEditor` (o context) e passare a `LogoAiPanel` e `BuilderPanel`. Oggi
  `BuilderPanel` crea una seconda istanza con log scartati.
- **REQ-LOG-015**: `logger.error` su fallimento in TUTTI e 6 gli hook (oggi
  solo 3). Meta minima: `{ route: 'useAI*', requestId, errorKind }`.

### 3.2 Fase 13 — Design System & UX (REQ-DS, REQ-UX)

- **REQ-DS-001**: Un solo design system: promuovere "The Classic" a token
  globali in `GlobalStyles.tsx` `:root` (light+dark): `--accent:#E62020`,
  `--ink:#1A1A1A`, `--paper:#FFFFFF`, `--muted:#5C5C5C`,
  `--surface:#F7F7F7`, `--line:rgba(26,26,26,.18)`, `--accent-soft:#FCE8E8`,
  `--success:#10B981`. Sidebar: navy `#082033` → ink. I duplicati `--qb-*`
  scoped di HomePage vengono rimossi (alias ai globali).
- **REQ-DS-002**: Bonifica palette residue: sostituire ogni occorrenza
  hardcoded di teal `#01696F` (e `rgba(1,105,111,*)`) e blu `#0B57D0` (e
  `rgba(11,87,208,*)`) nei fogli UI chrome (card CSS, LogoEditor, QREditor,
  SaveDialog, TierLimitModal, OnboardingModal, swatch quote) con i token.
  Eccezione: i **temi documento** (`doc-theme-*`, creative gradient teal)
  restano — sono contenuto utente, non chrome.
- **REQ-DS-003**: Definire o eliminare i token usati ma mai definiti:
  `--primary`, `--ink-soft`, `--ink-muted`, `--bg`, `--surface-2`,
  `--danger-bg`, `--accent-bg`, `--radius-pill`. Rinominare `--blue-bg` /
  `--info-bg` (contengono rosso) in `--accent-soft` / `--accent-softer`.
- **REQ-DS-004**: Tipografia a 2 ruoli: display **Outfit** (600–800) per H1/H2
  editoriali e HomePage; body **Inter** (400–700) per UI. Scala token
  `--text-xs..--text-4xl` (12/14/16/20/24/32/40/48px). JetBrains Mono caricato
  davvero per `AILogPanel` (o rimosso dai font-stack).
- **REQ-DS-005**: Font loading: rimuovere l'`@import` di 14 famiglie dal
  `<style>` React in `GlobalStyles.tsx`. `index.html`: `<link rel="preconnect">`
  + CSS statico per Inter e Outfit. Le famiglie dei font-picker documento
  vengono caricate lazy (un `<link>` iniettato alla prima apertura del picker).
- **REQ-DS-006**: Sidebar riorganizzata in gruppi: **Crea** (QR, Bigliettini,
  Loghi, Volantini, Social AI), **Archivio** (Documenti), **Sistema**
  (Impostazioni/Admin/Editor admin). Stato collapsed persistito in
  `localStorage` chiave versionata `pq_ui:v1`.
- **REQ-DS-007**: `AILogPanel` theme-aware: variante light (sfondo
  `--surface`, testo `--ink`, bordo `--line`) in light mode; il terminale scuro
  resta solo come variante "fullscreen".
- **REQ-UX-001**: Fix architettura toast: `ToastProvider` in `AppShell` con
  context; `useToast()` ritorna il context (errore in dev se fuori provider).
  Tutti i 9+ componenti che oggi creano istanze locali fantasma DEVONO
  consumare il context. Regression test: `addToast` da `CardEditorShell` →
  toast visibile nel DOM.
- **REQ-UX-002**: Varianti toast complete: `info|success|warning|error` con
  colori da token (info = ink/accent, non verde). Rimuovere gli stili inline
  `TOAST_COLORS` a favore di classi CSS.
- **REQ-UX-003**: Stilizzare il kit `ai-ui`: nuovo foglio
  `src/components/ai-ui/ai-ui.css` per `.ai-section`, `.ai-action-chip`,
  `.ai-quick-action-card`, `.ai-action-grid`, `.ai-select`,
  `.ai-prompt-textarea`, `.ai-generate-btn`. Gerarchia: solo
  `.ai-generate-btn` è primary extrabold; chip e quick card sono ghost/soft.
- **REQ-UX-004**: Primary Action Bar uniforme in ogni editor: cluster fisso
  bottom-right desktop / sticky-bottom mobile (safe-area) con **Salva**
  (primary), **Esporta** (secondary con menu), **Nuovo** (ghost). Sostituisce:
  bottoni in fondo al form QR, header a 6 bottoni di LogoEditor, toolbar card,
  azioni sparse flyer. La topbar globale resta solo titolo + theme toggle.
- **REQ-UX-005**: Logo export: i 3 bottoni PNG → menu "Esporta" unico
  (SVG / PNG 512 / 1024 / 2048 / JSON).
- **REQ-UX-006**: Breakpoint consolidati: solo **768px** (shell: drawer
  hamburger) e **1024px** (workspace: colonne editor). `useMediaQuery`
  centralizzato con costanti esportate `BP_SHELL`, `BP_WORKSPACE`. Migrazione
  documentata dei breakpoint sparsi (1400/1280/1100/900/880/680/640/600…)
  verso i due canonici; eliminata la zona morta 768–900.
- **REQ-UX-007**: Fix CSS rotto: regola orfana `QREditor.css` (blocco dopo
  `.flyer-preview-watermark`, ~L249-264) invalida il blocco seguente.
- **REQ-UX-008**: `SocialEditor` ottiene il suo foglio `SocialEditor.css`
  (classi `.social-*` oggi mai definite).
- **REQ-UX-009**: Copy alignment: LoginPage parla di brand kit (non
  preventivi); OnboardingModal "PrecisionQuote" → "Quickbrand"; HomePage Free
  "3 documenti" → "10 documenti" (allineato a `FREE_DOCUMENT_LIMIT`);
  placeholder codice sblocco `PQ-XXXX` → `QB-XXXX`.
- **REQ-UX-010**: HomePage ristrutturata AIDA (skill gpt-taste):
  1. **Attention**: H1 su container `max-w-5xl`+ che NON supera 2 righe a
     viewport ≥1280px (`clamp(2.5rem,5vw,4.5rem)`), copy AI-first (es.
     "Descrivi la tua attività. L'AI costruisce il tuo brand kit."), 2 CTA
     (primaria rossa piena + ghost) con contrasto verificato.
  2. **Interest**: bento grid `grid-flow-dense` dei 5 strumenti AI, zero
     celle vuote (col/row-span interlock verificato).
  3. **Desire**: sezione demo (flip card FREE vs SBLOCCATO esistente, o
     scroll-reveal CSS). Immagini/hero demo con `scale .95→1` + fade via
     IntersectionObserver.
  4. **Action**: pricing + final CTA su banda ink.
  Vietati: meta-label cheap ("SECTION 01", "QUESTION 05"), badge/stamp
  fluttuanti sull'H1, pill-tag sotto l'hero, statistiche raw nell'hero.
  Spaziatura tra sezioni `py-24`+ (capitoli distinti).
- **REQ-UX-011**: Motion v1: scroll-reveal via IntersectionObserver (classe
  `.reveal` → `.reveal-visible`), hover physics sulle card interattive
  (`transform scale` dentro `overflow:hidden`, 300–700ms ease-out). Tutto
  disattivato con `prefers-reduced-motion: reduce`.

### 3.3 Fase 14 — AI Console & AI-first (REQ-AI)

- **REQ-AI-001**: Componente condiviso `src/components/ai/AIConsole.tsx`
  (PAT-001): rail destro desktop (collassabile in tab verticale, pattern già
  presente in EditorView/Card) / bottom sheet 85vh mobile (pattern
  `CardAIBottomSheet` generalizzato). Slot: header brand "AI Assist" + badge
  provider, prompt textarea, quick actions, children per modulo, `AILogPanel`,
  `AiTierGuard`.
- **REQ-AI-002**: Migrazione dei 5 pattern esistenti alla AI Console:
  quote (colonna sx → rail), card (colonna dx + expander → rail), flyer
  (colonna sx → rail), logo (tab top-level → rail affiancata al builder),
  social (pagina intera → layout con rail). Un solo modello mentale: "l'AI
  sta nella rail a destra".
- **REQ-AI-003**: AI-first entry: aprendo un editor con documento vuoto, la
  AI Console è espansa con prompt suggerito contestuale (es. card: "Descrivi
  la tua attività, creo il bigliettino"). Il form manuale resta accessibile
  via toggle "Modifica manuale". Documento con contenuto → stato rail
  invariato (persistito in `pq_ui:v1`).
- **REQ-AI-004**: Creazione da Collection: "Nuovo {tipo}" apre l'editor con AI
  Console espansa e focus sul prompt (non sul form vuoto).
- **REQ-AI-005**: Onboarding AI-first: step 1 mostra di default
  `BrandNameGenerator` + "Suggerisci da nome" (oggi dietro toggle); il path
  manuale resta ("Preferisco scrivere io").
- **REQ-AI-006**: Badge provider uniforme: componente unico
  `AIProviderBadge` ("DeepSeek · Gemini") nel footer della AI Console,
  sostituisce la dicitura ad-hoc del Logo AI.
- **REQ-AI-007**: Eccezione QR: nessuna AI nel QR editor (nessun valore
  generativo). Documentato, non forzato.
- **REQ-AI-008**: HomePage/Login/Onboarding riposizionati AI-first nel copy:
  l'AI è il soggetto della proposizione di valore ("l'AI costruisce", non
  "strumenti con AI inclusa").

### 3.4 Sicurezza (SEC)

- **SEC-001**: Nessuna immagine base64 in: log entry client, log server,
  ring buffer sessionStorage, payload `/api/logs`. Strip prima del log.
- **SEC-002**: Rimuovere `console.info` con `key length` in
  `src/ai/providers/deepseek.ts`. Nessun dato di chiave, nemmeno derivato,
  in console/log.
- **SEC-003**: `detail` delle entry e payload `/api/logs`: troncamento 2 KB;
  mai raw JSON AI completo lato server; regola PII WiFi invariata.
- **SEC-004**: `/api/logs` rate limit realmente enforced (REQ-LOG-009):
  protezione log-flooding sui Vercel logs.

### 3.5 Constraints (CON)

- **CON-001**: Zero servizi esterni di osservabilità (no Sentry/Logtail):
  Vercel function logs + `/api/logs` esistente.
- **CON-002**: Nessuna nuova dipendenza runtime in v1: niente GSAP, niente
  framework CSS. Motion = CSS + IntersectionObserver. GSAP ScrollTrigger è il
  riferimento se in futuro si introduce una motion library (decisione
  separata).
- **CON-003**: `api/index.ts` resta monolite; nessun nuovo endpoint; solo
  logging + header `X-Request-Id` + enforcement rate limit esistenti.
- **CON-004**: Chiavi localStorage nuove versionate (`pq_ui:v1`,
  `pq_ai_logs:v1`); immagini base64 MAI in localStorage/sessionStorage.
- **CON-005**: Ogni REQ di Fase 12/13/14 con test (AGENTS.md "Test,
  OBBLIGATORI"); `npm run typecheck && npm run test` verdi pre-push.

### 3.6 Guidelines (GUD)

- **GUD-001** (taste): AIDA, H1 ≤ 2 righe, zero meta-label cheap, bento
  gapless con `grid-flow-dense`, hover physics su ogni card cliccabile,
  contrasto bottoni verificato (scuro → testo bianco, chiaro → testo ink).
- **GUD-002** (restraint): un solo signature element per superficie. App:
  la AI Console rail. HomePage: il bento strumenti + demo flip. Tutto il
  resto quieto e disciplinato.
- **GUD-003** (copy): voce attiva, sentence case, errori che spiegano cosa è
  successo e come risolvere; niente "Errore generico".

### 3.7 Patterns (PAT)

- **PAT-001**: AIConsole a slot: `<AIConsole header prompt actions log
  guard>{moduleChildren}</AIConsole>`. I moduli forniscono solo i contenuti
  specifici (quick actions, sezioni tipo "Sfondo AI").
- **PAT-002**: `useAILogs` unica sorgente di verità per entries/persistenza;
  gli hook di dominio aggiungono solo business logic (token check, tool
  callbacks, merge).
- **PAT-003**: Toast solo via context (REQ-UX-001); mai `useState` locale.
- **PAT-004**: Token solo da `GlobalStyles.tsx` `:root`; vietato introdurre
  hex hardcoded in nuovi fogli UI chrome (lint manuale in review).

## 4. Interfaces & Data Contracts

### 4.1 `AILogEntry` v2 (`src/ai/types.ts`)

```ts
type AILogEntryType = 'info' | 'success' | 'error' | 'tool' | 'stream';
// 'result' rimosso (REQ-LOG-012)

interface AILogEntry {
  id: string;
  type: AILogEntryType;
  msg: string;
  time: string;                    // HH:MM:SS locale (display)
  status?: 'pending' | 'done' | 'error';
  durationMs?: number;
  detail?: string;                 // max 2 KB
  // v2 (opzionali, back-compat):
  requestId?: string;              // UUID v4
  sessionId?: string;
  modelId?: string;                // es. 'deepseek-chat'
  tokens?: { prompt: number; completion: number; total: number };
}
```

### 4.2 `useAILogs` (`src/hooks/useAILogs.ts`)

```ts
interface UseAILogsReturn {
  logs: AILogEntry[];                       // cap 40 in memoria
  isProcessing: boolean;
  startStream(msg: string, meta?: Partial<AILogEntry>): string; // → entryId
  appendStream(entryId: string, chunk: string): void;           // soglia 80 char
  finalizeStream(entryId: string, ok: boolean, meta?: { tokens?; durationMs?; detail?; errorMsg? }): void;
  info(msg: string, detail?: string): void;
  success(msg: string, detail?: string): void;
  error(msg: string, detail?: string): void;                    // + logger.error se meta fornita
  tool(msg: string, durationMs?: number): void;
  clear(): void;
}
```

Persistenza: ring buffer 100 entry in `sessionStorage['pq_ai_logs:v1']`
(`{ version: 1, entries: AILogEntry[] }`), restore lazy al mount, write
debounced 300 ms, try/catch sempre (mai crash su quota).

### 4.3 Contratto `X-Request-Id`

| Lato | Contratto |
|------|-----------|
| Client | Genera `crypto.randomUUID()` per generazione; header `X-Request-Id` su ogni `fetch`/`stream` verso `/api/ai/*`; lo stesso id in tutte le entry della generazione |
| Server | Legge header (fallback: genera UUID server-side); include `requestId` in ogni `console.*` della request; errori JSON: `{ error: string, requestId: string }` |
| SSE | Per `/api/ai/chat/stream`: primo evento `data: {"requestId":"…"}` prima dei chunk content |

### 4.4 Log server JSON (REQ-LOG-008)

```json
{ "tag": "ai_card_cover", "requestId": "…", "email": "u@x.it",
  "model": "gemini-3.1-flash-image", "durationMs": 4210,
  "outcome": "ok", "sizeKB": 182 }
```

### 4.5 `IMAGE_TOKEN_COST`

`src/ai/costs.ts`: `export const IMAGE_TOKEN_COST = 500;` — usato dagli hook
dopo successo immagine (`trackTokens(email, IMAGE_TOKEN_COST)`).

### 4.6 `AIConsole` (PAT-001)

```tsx
interface AIConsoleProps {
  title?: string;                    // default "AI Assist"
  isProcessing: boolean;
  logs: AILogEntry[];
  tier: 'free' | 'unlocked';
  onSubmitPrompt(text: string): void;
  quickActions?: ReactNode;
  children?: ReactNode;              // sezioni modulo (es. "Sfondo AI")
  defaultExpanded?: boolean;         // REQ-AI-003
}
```

### 4.7 `pq_ui:v1`

`{ version: 1, sidebarCollapsed: boolean, aiConsoleExpanded: Record<EditorKind, boolean> }`

## 5. Acceptance Criteria

### Fase 12

- **AC-LOG-001**: Given un qualsiasi dei 6 hook AI, When una generazione va a
  buon fine, Then l'entry finale è `Risposta ricevuta · N token · Xs` con
  `detail` ≤ 2 KB e `requestId` valorizzato.
- **AC-LOG-002**: Given `useAILogo`/`useAISocial`/`useAIOnboarding`, When la
  chiamata fallisce, Then l'entry di stream ha `status: 'error'` (mai
  `pending` residuo) e parte un `logger.error` con `requestId`.
- **AC-LOG-003**: Given `LogoAIOrchestrator.generateLogo`, When completa,
  Then `dataService.trackTokens` è chiamato con i token reali (regression su
  REQ-LOG-006; prima del fix il test fallisce).
- **AC-LOG-004**: Given `useAIFlyer.generateCopy`, When completa, Then i token
  tracciati sono `usage.totalTokens` reale (non `chars/4`).
- **AC-LOG-005**: Given 201 POST `/api/logs` in 60s dallo stesso IP, Then la
  201ª risponde 429. Idem: 31ª `/users/tokens` → 429; 31ª `/ai/chat/stream` → 429.
- **AC-LOG-006**: Given una generazione card-cover, When il server logga,
  Then esiste una riga JSON con `tag`, `requestId`, `durationMs`, `outcome`
  e, su errore upstream, `errorKind`.
- **AC-LOG-007**: Given una risposta DeepSeek non-JSON, When `parseJsonResponse`
  fallisce con `schema_fail`, Then l'entry `detail` mostra il riepilogo issue
  e il server riceve `logger.error` con `issueCount` + `firstPath` (no raw).
- **AC-LOG-008**: Given 100+ entry generate, When si ricarica la pagina
  (stessa tab), Then le ultime 100 sono restaurate da `pq_ai_logs:v1`; cambio
  tab del browser → buffer azzerato (sessionStorage).
- **AC-LOG-009**: Given `LogoEditor`, When `BuilderPanel` rigenera un
  background, Then le entry appaiono nello stesso `AILogPanel` di
  `LogoAiPanel` (istanza unica).

### Fase 13

- **AC-DS-001**: Given dark+light, When ispeziono `:root`, Then esistono tutti
  i token di REQ-DS-001/003 e nessuna classe UI chrome usa hex teal/blu
  hardcoded (grep su `src/components/**/*.css` esclusi `doc-theme-*`).
- **AC-DS-002**: Given apertura app, When si misurano le richieste font,
  Then sono caricate solo Inter e Outfit all'avvio; le famiglie picker solo
  dopo apertura picker.
- **AC-UX-001**: Given `CardEditorShell` (o altro editor), When scatta
  `addToast('success', …)`, Then il toast è visibile nel DOM (oggi: mai).
- **AC-UX-002**: Given `addToast('info', …)`, Then il toast NON è verde né
  con ✓ di success.
- **AC-UX-003**: Given ogni editor, Then il cluster Salva/Esporta/Nuovo è
  nello stesso punto (bottom-right desktop, sticky-bottom mobile) con lo
  stesso stile.
- **AC-UX-004**: Given viewport 800px (zona morta 768–900), Then shell e
  workspace hanno comportamento deterministico definito dai 2 breakpoint.
- **AC-UX-005**: Given HomePage a 1280px, Then l'H1 occupa ≤ 2 righe; non
  esistono stringhe "SECTION 0", "QUESTION 0"; la bento non ha celle vuote.
- **AC-UX-006**: Grep: "PrecisionQuote" assente da Onboarding/Login;
  HomePage Free dice "10 documenti"; placeholder codice `QB-XXXX`.

### Fase 14

- **AC-AI-001**: Given quote/card/flyer/logo, When apro l'editor desktop,
  Then l'AI è nella rail destra collassabile con header "AI Assist" e
  `AIProviderBadge`; su mobile è il bottom sheet con la stessa struttura.
- **AC-AI-002**: Given editor con documento vuoto, When lo apro, Then la AI
  Console è espansa con prompt suggerito e focus nel textarea.
- **AC-AI-003**: Given Collection → "Nuovo Bigliettino", Then l'editor si
  apre in stato AC-AI-002.
- **AC-AI-004**: Given Onboarding step 1, Then `BrandNameGenerator` è visibile
  senza click preliminari.

## 6. Test Automation Strategy

- **Unit (Vitest + RTL, jsdom)**:
  - `src/hooks/__tests__/useAILogs.test.ts`: cap 40, soglia 80 char,
    finalize ok/errore (REQ-LOG-002/003), persistenza sessionStorage
    (quota → no crash), restore.
  - `src/ai/__tests__/baseOrchestrator.trackUsage.test.ts`: REQ-LOG-006
    (scrivere PRIMA del fix — TDD).
  - Hook migrati: aggiornare i 6 test esistenti al nuovo formato entry.
  - `api/__tests__/rateLimit.test.ts`: 429 su scope logs/tokens/aistream.
  - `api/__tests__/aiLogging.test.ts`: log JSON con requestId su route
    rappresentative (chat, card-cover).
  - Toast: `ToastProvider` context + regression visibilità da editor.
  - Token: grep-test CI-style (vitest che legge i CSS) per hex vietati
    `#01696F`/`#0B57D0` fuori da `doc-theme-*` (opzionale ma raccomandato).
- **E2E (Playwright)**: `e2e/ai-console.spec.ts` (rail open/collapse, mobile
  bottom sheet), `e2e/toast-visibility.spec.ts` (save da card → toast),
  `e2e/homepage-aida.spec.ts` (H1 ≤ 2 righe a 1280px, no meta-label).
  Riusare `e2e/helpers/cardHarness.ts` dove applicabile.
- **Coverage**: ≥ 60% su ogni nuovo file (target progetto).
- **CI**: `npm run typecheck && npm run test` verdi pre-push (AGENTS.md).
- **Regression-first**: ogni bug fix (REQ-LOG-003, REQ-LOG-006, REQ-UX-001,
  REQ-UX-002, REQ-UX-007) nasce con test che fallisce prima del fix.

## 7. Rationale & Context

### 7.1 Evidenze dall'audit 2026-07-18 (perché questi REQ)

| Evidenza | REQ |
|----------|-----|
| `trackUsage` con `require()` → no-op silenzioso browser, token logo/social/onboarding mai contati | REQ-LOG-006 |
| Flyer stima token `chars/4` pur avendo `usage` reale | REQ-LOG-007 |
| Scope `logs`/`tokens`/`aistream`: `checkRateLimit` senza `recordRateAttempt` → limiti mai applicati | REQ-LOG-009 |
| Entry stream `pending` per sempre su errore in 3 hook | REQ-LOG-003 |
| 6 hook, 3 formati messaggio finale, plumbing copiato | REQ-LOG-001/002 |
| Nessun requestId/sessionId → debug prod cieco | REQ-LOG-004/005 |
| 9 componenti fanno toast nel vuoto (solo AppShell renderizza `ToastContainer`) | REQ-UX-001 |
| Tipo toast `info` cade su successo (verde) | REQ-UX-002 |
| Kit `ai-ui` senza CSS → muri di bottoni extrabold | REQ-UX-003 |
| Doppia palette + teal/blu residui + token fantasma | REQ-DS-001/002/003 |
| 5 pattern AI diversi + QR senza AI + log invisibili onboarding | REQ-AI-001/002, REQ-LOG-013 |
| Copy: Login/Onboarding parlano di preventivi/PrecisionQuote; "3 documenti" vs limite 10 | REQ-UX-009 |
| AGENTS.md doc drift (400ms, "solo warn/error", rate limit) | aggiornamento doc contestuale |

### 7.2 Direzione design (skill frontend-design + gpt-taste)

- **Palette**: "The Classic" estesa — Red `#E62020` (azione/AI), Ink
  `#1A1A1A` (struttura/testo), Paper `#FFFFFF`, Muted `#5C5C5C`, Surface
  `#F7F7F7`, Accent-soft `#FCE8E8`, Success `#10B981`. Scelta: non nuova
  direzione ma consolidamento del rebrand fase 8 (equità brand esistente).
- **Tipo**: Outfit (display, carattere geometrico contemporaneo, mai Inter
  per i titoli — skill taste) + Inter (body, già caricato). Mono: JetBrains
  Mono per log.
- **Signature element**: la **AI Console rail** — pannello ink scuro con
  stream log vivo: "l'AI che lavora in vista" è il tratto memorabile e il
  manifesto AI-first. HomePage: bento strumenti + demo flip esistente.
- **Motion**: orchestrata e sobria (scroll-reveal + hover physics); niente
  librerie nuove in v1 (CON-002) — motion eccessivo = sensazione
  "AI-generated" (frontend-design).
- **AIDA HomePage**: hero largo 2 righe → bento gapless → demo → pricing/CTA.
- **Rischio estetico giustificato**: rail AI scura (ink) persistente in tema
  chiaro: contrasto voluto che marca la presenza dell'AI come elemento
  strutturale, non decorativo. `AILogPanel` dentro la rail resta scuro; fuori
  rail (fullscreen) theme-aware.

### 7.3 Perché quest'ordine di fasi

1. **Fase 12 prima**: il logging è il prerequisito per debuggare tutto il
   resto (e richiesta originale esplicita). Fix rotti (trackUsage, rate
   limit) hanno valore immediato su costi e sicurezza.
2. **Fase 13 poi**: feedback visivi (toast) e design system sono il
   fondamento su cui la AI Console si appoggia; fare 14 senza 13 =
   replicare il disordine in un componente nuovo.
3. **Fase 14 ultima**: la migrazione dei 5 pattern è il cambiamento più
   invasivo; con log e design system stabili il rischio è contenuto.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: Vercel function logs — destinazione unica dei log server
  (console JSON). Nessuna retention/query API aggiuntiva.

### Third-Party Services
- **SVC-001**: DeepSeek API (via proxy esistente) — invariata.
- **SVC-002**: Google Gemini (`@google/genai`, Nano Banana) — invariata;
  aggiunto solo tracciamento costo in token (REQ-LOG-007).

### Infrastructure Dependencies
- **INF-001**: Vercel Hobby (monolite `api/index.ts`, limiti 12 funzioni) —
  vincolo CON-003.

### Data Dependencies
- **DAT-001**: `users.tokens_used` (Neon) — unico contatore quota, ora
  alimentato anche da immagini Gemini e dai 3 orchestratori prima scoperti.

### Technology Platform Dependencies
- **PLT-001**: React 18 + Vite + Vitest + Playwright esistenti. Nessuna
  nuova dipendenza runtime (CON-002). Font: Google Fonts (Outfit aggiunto).

### Compliance Dependencies
- **COM-001**: GDPR — strip base64/PII dai log (SEC-001/003); disclosure
  Gemini in README resta debito aperto (TB-008 in `doc/to-be-done.md`).

## 9. Examples & Edge Cases

### 9.1 Entry v2 di successo

```json
{ "id": "log-1721300000-7", "type": "stream", "status": "done",
  "msg": "Risposta ricevuta · 812 token · 6.2s",
  "time": "14:33:07", "durationMs": 6200,
  "requestId": "9f1c…", "sessionId": "card-abc", "modelId": "deepseek-chat",
  "tokens": { "prompt": 540, "completion": 272, "total": 812 },
  "detail": "{\"front\":{\"name\":\"Giovanni…" }
```

### 9.2 Edge cases gestiti

- **Stream interrotto a metà**: `finalizeStream(entryId, false)` → entry
  `status:'error'`, `detail` con chunk parziale (troncato), `logger.error`.
- **sessionStorage pieno/disabilitato**: try/catch → persistenza saltata,
  log in memoria sola, nessun crash (lezione quota v2.3).
- **requestId assente in risposta errore vecchia** (server non aggiornato):
  client mostra il proprio requestId generato (sempre presente lato client).
- **SSE primo evento requestId perso**: fallback a id client-side; la
  correlazione degrada a "client-side only" senza errori UI.
- **Documento non vuoto + AI-first**: rail rispetta `pq_ui:v1` (REQ-AI-003
  non forza l'espansione su documenti esistenti).
- **Tier free**: `AiTierGuard` dentro AIConsole blocca la submit con CTA
  sblocco (pattern esistente, non reinventato).
- **Admin**: nessun tier guard, token illimitati — log completi comunque
  attivi (debug produzione).

## 10. Validation Criteria

- [ ] `npm run typecheck` verde.
- [ ] `npm run test` verde, incluse le nuove suite di §6; coverage ≥ 60% sui
      nuovi file.
- [ ] Grep: zero `#01696F` / `#0B57D0` in UI chrome (esclusi `doc-theme-*`);
      zero token indefiniti tra quelli di REQ-DS-003.
- [ ] Grep: zero `require(` in `src/ai/**`.
- [ ] Test manuali: generazione logo+social+onboarding muove `tokensUsed`;
      201ª chiamata `/api/logs` → 429; errore AI mostra requestId; toast da
      ogni editor visibile; H1 HomePage ≤ 2 righe a 1280px.
- [ ] AGENTS.md aggiornato (fasi 12–14, drift corretti) nella stessa PR
      dell'ultima fase.

## 11. Related Specifications / Further Reading

- `spec-design-flyer-refactor-preview-ai.md` — unico spec attivo preesistente
  (gap test TB-007).
- `spec-api-saas-monetization.md` — track futuro, NOT-STARTED, fuori scope.
- `doc/to-be-done.md` — gap analysis registry (TB-004…TB-010 aperti).
- `AGENTS.md` — convenzioni progetto, gotcha flyer/logo/card, regole test.
- Skill applicate: `gpt-taste` (AIDA, bento, motion), `frontend-design`
  (token system, signature element, restraint), `create-specification`
  (struttura documento).
