---
title: URL Document-ID Routing for Editors (quote, QR, card, logo, flyer, social)
version: 1.0
date_created: 2026-07-13
owner: Giovanni
tags: architecture, routing, ux, state-management
---

# Introduction

Oggi l'app naviga a `/app/card` (o `/app/qr`, `/app/logo`, `/app/flyer`, `/app/editor`) quando l'utente clicca "Apri" su un documento nella Collection. Il documento selezionato passa **solo via React context** (`AppShell.cardDocument`, `qrDocument`, ecc.): l'URL non contiene l'ID del documento aperto. Dopo un refresh (F5), il documento aperto si perde e l'editor torna vuoto.

Questa spec introduce **URL con ID documento** per ogni editor: `/app/card/:docId` quando si apre un documento esistente, `/app/card` (senza ID) quando si crea un nuovo documento o si preme "Nuovo/reset". L'ID nell'URL rende il documento aperto **deep-linkable, ripristinabile dopo refresh e condivisibile** (dietro auth wall), e uniforma la semantica del "reset" (URL senza ID = nuovo doc).

## 1. Purpose & Scope

**Scopo**: Rendere l'URL l'unica fonte di verità per il documento attivo in ogni editor (`quote`, `qrCode`, `businessCard`, `logo`, `flyer`, opzionalmente `social`). L'URL riflette lo stato: `/app/<type>/:id` = documento esistente, `/app/<type>` = nuovo documento vuoto.

**Audience**: Sviluppatori dell'app Quickbrand. Spec pensata per consumo AI-driven (implementabile da un agente di coding).

**In scope**:
- Refactor del routing in `src/main.tsx` (param dinamici `:docId`).
- Refactor del bridge `src/hooks/useRouteView.ts` per supportare dynamic segments.
- `AppShell.openDocument` naviga a URL con ID.
- Editor "Nuovo/reset" naviga a URL senza ID + pulisce context.
- Page component leggono `useParams().docId` e caricano il documento per ID (da localStorage o API) se il context è vuoto.
- Attiva highlight nella Collection derivato dall'URL per **tutti** i tipi (non solo quote).
- Aggiunta "Nuovo" button in `QREditor` e `EditorView` (quote) per uniformità.

**Out of scope** (in questa fase):
- URL con query params per stato interno non persistito (es. tab attivo, zoom preview).
- Condivisione pubblica di URL senza auth (resta auth wall).
- Modifica dei layout/struttura visiva degli editor (solo wiring routing + reset).
- Persistenza dell'`aiStateRef` del Logo AI (già coperto dal gotcha 12 di AGENTS.md, non toccare).

## 2. Definitions

| Termine | Definizione |
|---------|-------------|
| **docId** | Identificatore unico del documento nella collection (`doc.id`, già presente nello schema `documents` Neon e in `precisionQuote_documents:v1` localStorage). Per i preventivi è `quoteId` (legacy alias). |
| **Route ID-based** | Route con segmento parametrico: `/app/card/:docId`. |
| **Route root** | Route base senza ID: `/app/card`. Rappresenta un documento nuovo/vuoto. |
| **Source of truth URL** | L'URL contiene l'ID del documento attivo. Context state è derivato/cache. |
| **Hydration** | Caricamento di un documento dallo storage (localStorage o API) in base all'ID nell'URL, quando il context è vuoto (es. dopo F5). |
| **Open action** | Click "Apri" nella Collection → naviga a `/app/<type>/:docId` + imposta context. |
| **Reset action** | Click "Nuovo" o "reset" nell'editor → naviga a `/app/<type>` (root) + pulisce context. |

## 3. Requirements, Constraints & Guidelines

### REQ — Requisiti Funzionali

- **REQ-001**: Ogni editor ha due route: root (`/app/<type>`, documento nuovo) e ID-based (`/app/<type>/:docId`, documento esistente). Tipi coinvolti: `editor` (quote), `qr`, `card`, `logo`, `flyer`. `social` opzionale (Fase 2).
- **REQ-002**: Click "Apri" nella Collection (`CollectionView.onOpen`) naviga alla route ID-based `/app/<type>/:docId` e imposta il documento nel context (payload completo passato da Collection, come oggi).
- **REQ-003**: Premere "Nuovo" o "reset" in un editor naviga alla route root `/app/<type>` (sostituzione, no `push` history per evitare stack-pollution: `navigate('/app/<type>', { replace: true })`) e pulisce il context (`ctx.setCardDocument(null)`, `ctx.setQrDocument(null)`, ecc.).
- **REQ-004**: Al primo render di un editor con `:docId` nell'URL e context vuoto, il page component esegue **hydration**: fetch-by-id via `dataService.getDocument(userEmail, docId, documentType)`. Se non trovato → toast error + navigate root.
- **REQ-005**: Al primo render di un editor senza `:docId` (root), l'editor parte da documento vuoto (es. `createEmptyCard()`). Context ignorato se l'URL è root (il context potrebbe contenere un doc residuo da sessione precedente).
- **REQ-006**: Dopo auto-save di un nuovo documento (primo salvataggio), l'URL viene aggiornato a `/app/<type>/:docId` via `navigate('/app/<type>/' + newId, { replace: true })` (replace per non aggiungere step history).
- **REQ-007**: Refresh (F5) su `/app/card/:docId` ripristina il documento: hydration come REQ-004. Se l'utente è loggato e il doc esiste, lo carica; se non esiste più, toast + redirect root.
- **REQ-008**: Active highlight nella Collection è derivato dall'URL: il documento aperto corrisponde a `:docId` nell'URL del viewer corrente. Funziona per tutti i tipi, non solo quote. `CollectionView` legge un prop `activeId` che i page component passano derivandolo da `useParams().docId`.
- **REQ-009**: `QREditor` ottiene un bottone "Nuovo" (al momento assente) che esegue `resetQr` + naviga root. Stesso pattern degli altri editor.
- **REQ-010**: `EditorView` (quote) ottiene un bottone "Nuovo preventivo" (al momento assente nell'editor, solo nella sidebar) che esegue reset quote + naviga root `/app/editor`.
- **REQ-011**: Navigazione diretta (sidebar/URL) tra editor diversi non lascia documenti "fantasma" nel context errato (es. da `/app/card/abc` a `/app/qr` non deve portare `cardDocument` nel QR editor). Il page component dell'editor di destinazione legge solo `:docId` e fa hydration solo del tipo corretto.
- **REQ-012**: Tornando alla Collection da un editor (sidebar "Collection"), l'active highlight si basa sull'ultima route visitata che aveva `:docId` (preso dall'ultimo location pathname con `:docId`). Se si è appena premuto "Nuovo", nessun doc appare attivo.

### SEC — Requisiti di Sicurezza

- **SEC-001**: L'ID documento nell'URL non è considerato dato sensibile (è un UUID/seriale, non un nome/email). Nessuna PII in URL. Verificare che gli ID generati non contengano dati personali (già vero oggi: UUIDv4 o seriale Neon).
- **SEC-002**: L'hydration (REQ-004) verifica che il documento appartenga all'utente corrente (`userEmail`). Un utente non può aprire `/app/card/<docId-di-un-altro>`: `dataService.getDocument` ritorna `null` per doc non-owned, il page component redirect a root con toast "Documento non trovato".
- **SEC-003**: Nessun documento passato via URL query string (solo `:docId` nel path, niente `?card={...}` o `?data=...`).

### CON — Vincoli

- **CON-001**: Nessun nuovo endpoint API. `dataService.getDocument` deve già esistere o essere aggiunto come helper client-side che wrappa il fetch dalla collection (localStorage o API `/api/documents/:id`). In locale legge da `precisionQuote_documents:v1`; in prod GET `/api/documents/:id` (se mancante, aggiungere endpoint in `api/index.ts` con stesso pattern del monolite).
- **CON-002**: Mantenere la dipendenza `react-router-dom` v6 (già in uso). Niente upgrade a v7 in questa spec.
- **CON-003**: Il monolite `api/index.ts` rimane tale. Se serve un nuovo endpoint `GET /api/documents/:id` per la hydration in prod, va aggiunto inline nello stesso file (vedi AGENTS.md "Vercel Routing").
- **CON-004**: Il bridge `useRouteView` va esteso per supportare dynamic segments, NON rimosso. Altri consumatori (es. `Layout`/`Topbar`) continuano a usare `view: string`. Il valore `view` per una route ID-based è la stessa della root (es. `/app/card/abc` → `view='card'`).
- **CON-005**: No deep-link cross-user (URL di un doc di altro utente non è accessibile, vedi SEC-002).
- **CON-006**: `social` editor è **opzionale** in questa fase. Se implementato, stesso pattern. Valutare in Fase 2.
- **CON-007**: I link nel browser history devono rimanere navigabili (back/forward tra documenti aperti funziona). Usare `navigate` con `replace: true` SOLO per reset/save-new-doc, NON per l'"Apri" (che è una nuova entry history, utile per back).

### GUD — Linee Guida

- **GUD-001**: Validare il `docId` nell'URL via regex (`/^[a-zA-Z0-9_-]{1,100}$/`) prima di procedere all'hydration. Rifiutare ID malformati (es. path traversal) con redirect root + toast.
- **GUD-002**: L'editor non deve fetchare da API se il context ha già il documento con ID corrispondente (fast path: skip hydration se `ctx.cardDocument?.id === docId`). Solo se context vuoto o ID mismatch → fetch.
- **GUD-003**: L'editor non deve fetchare da API se l'utente non è loggato (`ProtectedRoute` già lo blocca a `/login`, ma l'helper di hydration deve essere null-safe).
- **GUD-004**: Per i tipi con auto-save aggressivo (quote, card, flyer), l'update URL post-save (REQ-006) non deve triggare re-render dell'editor (replace navigation, stato già presente in context). Usare `navigate(..., { replace: true })` fuori dall'useEffect di autosave per evitare loop.
- **GUD-005**: UX di transizione: premendo "Nuovo" mostra un loader breve (200ms) o un fade-out del vecchio contenuto per evitare flash. Opzionale se le performance lo consentono senza jank.

### PAT — Pattern

- **PAT-001**: **Single-direction flow URL → state**: l'URL è la fonte. Context è cache. Ogni cambio URL con ID triggera hydration solo se mismatch. Mai scrivere nell'URL dal context state (solo dopo save, che genera un nuovo ID).
- **PAT-002**: **Idempotent hydration**: chiamare `loadDocument(docId)` più volte per lo stesso ID non causa side effect (usa un `useRef` per tracciare l'ultimo ID caricato, evita loop).
- **PAT-003**: **Page component come controller**: il page (`CardPage`, `QrPage`, ecc.) legge `useParams().docId` e decide se passare `initialCard={ctx.cardDocument}` (fast path) o triggare fetch. L'editor (`CardEditor`, `QREditor`) resta stupido: continua a ricevere `initial*` prop, come oggi.
- **PAT-004**: **Reset handler centralizzato**: ogni editor espone `resetHandler` che fa `setState(empty)` + `ctx.setXDocument(null)` + `navigate('/app/<type>', { replace: true })`. Il navigate va nel page o nel shell, NON nel sub-editor (che non conosce react-router).

## 4. Interfaces & Data Contracts

### 4.1 Route Map (aggiornamento `src/main.tsx`)

| Method | Path | Component | Guard |
|--------|------|-----------|-------|
| GET | `/app/editor` | `EditorPage` (documento nuovo) | admin |
| GET | `/app/editor/:docId` | `EditorPage` (documento esistente) | admin + ownership |
| GET | `/app/qr` | `QrPage` (documento nuovo) | login |
| GET | `/app/qr/:docId` | `QrPage` (documento esistente) | login + ownership |
| GET | `/app/card` | `CardPage` (documento nuovo) | login |
| GET | `/app/card/:docId` | `CardPage` (documento esistente) | login + ownership |
| GET | `/app/logo` | `LogoPage` (documento nuovo) | login |
| GET | `/app/logo/:docId` | `LogoPage` (documento esistente) | login + ownership |
| GET | `/app/flyer` | `FlyerPage` (documento nuovo) | login |
| GET | `/app/flyer/:docId` | `FlyerPage` (documento esistente) | login + ownership |
| GET | `/app/social` | `SocialPage` (opzionale) | login |
| GET | `/app/social/:docId` | `SocialPage` (opzionale) | login + ownership |
| GET | `/app/collection` | `CollectionPage` (nessun ID, highlight da stato URL precedente) | login |

### 4.2 Bridge `useRouteView.ts` — nuova interfaccia

```ts
// src/hooks/useRouteView.ts
export const ROUTE_PATHS = {
  editor: '/app/editor',
  qr: '/app/qr',
  card: '/app/card',
  logo: '/app/logo',
  flyer: '/app/flyer',
  social: '/app/social',
  collection: '/app/collection',
  settings: '/app/settings',
  admin: '/app/admin',
} as const;

export type ViewName = keyof typeof ROUTE_PATHS;

// Esegue il prefix-match (non più exact) estrae il primo segmento dopo /app/
export function pathToView(pathname: string): ViewName {
  const match = pathname.match(/^\/app\/([a-z]+)/i);
  if (!match) return DEFAULT_VIEW;
  const seg = match[1].toLowerCase();
  return (seg in ROUTE_PATHS) ? (seg as ViewName) : DEFAULT_VIEW;
}

export function viewToPath(view: ViewName): string {
  return ROUTE_PATHS[view] ?? ROUTE_PATHS.editor;
}

// Naviga alla view, opzionalmente con docId
export function buildPath(view: ViewName, docId?: string | null): string {
  const base = viewToPath(view);
  return docId ? `${base}/${docId}` : base;
}

export function useRouteView() {
  const location = useLocation();
  const navigate = useNavigate();
  const view = useMemo(() => pathToView(location.pathname), [location.pathname]);
  const setView = useCallback((v: ViewName, docId?: string | null) => {
    navigate(buildPath(v, docId));
  }, [navigate]);
  return { view, setView };
}
```

**Breaking change**: `setView(v)` diventa `setView(v, docId?)`. Tutti i chiamanti esistenti (sidebar, `AppShell.openDocument`) devono essere aggiornati. `setView(v)` senza `docId` resta valido (naviga alla root della view).

### 4.3 `AppShell.openDocument` — nuovo contratto

```ts
// src/components/AppShell.tsx
const openDocument = (doc) => {
  if (!doc?.id) return;
  switch (doc.documentType) {
    case 'quote':        setQuote(migrateQuote(doc)); setView('editor', doc.id); break;
    case 'qrCode':       setQrDocument(doc);          setView('qr', doc.id);     break;
    case 'businessCard': setCardDocument(doc);         setView('card', doc.id);   break;
    case 'logo':         setLogoDocument(doc);         setView('logo', doc.id);   break;
    case 'flyer':        setFlyerDocument(doc);        setView('flyer', doc.id);  break;
  }
};
```

**Notare**: `setView` ora accetta `docId` come secondo argomento. L'ID viene dal `doc.id` (per i preventivi legacy, `doc.quoteId` è alias di `doc.id` dopo la Phase 6 unificazione).

### 4.4 Reset handler (esempio Card)

```ts
// src/components/card/CardEditorShell.tsx (o CardPage, preferibilmente)
const handleReset = () => {
  if (!window.confirm('Vuoi svuotare la card e tornare a un documento vuoto?')) return;
  setCard(createEmptyCard());
  // reset grid/template flags locali...
  ctx.setCardDocument(null);  // pulisce context
  navigate('/app/card', { replace: true });  // URL root, no stack pollution
  addToast('info', 'Documento svuotato');
};
```

### 4.5 Hydration helper (esempio CardPage)

```ts
// src/pages/app/CardPage.tsx
function CardPage() {
  const ctx = useContext(AppContext);
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const lastLoadedRef = useRef<string | null>(null);

  const initialCard = useMemo(() => {
    if (!docId) return ctx?.cardDocument ?? null;  // root: usa context o null
    if (ctx?.cardDocument?.id === docId) return ctx.cardDocument;  // fast path
    return null;  // triggare fetch via useEffect
  }, [docId, ctx?.cardDocument]);

  useEffect(() => {
    if (!docId || lastLoadedRef.current === docId) return;
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(docId)) {
      addToast('error', 'ID documento non valido');
      navigate('/app/card', { replace: true });
      return;
    }
    if (ctx?.cardDocument?.id === docId) { lastLoadedRef.current = docId; return; }
    lastLoadedRef.current = docId;
    dataService.getDocument(ctx.user.email, docId, 'businessCard')
      .then(doc => {
        if (!doc) { addToast('error', 'Documento non trovato'); navigate('/app/card', { replace: true }); return; }
        ctx.setCardDocument(doc);
      })
      .catch(err => { addToast('error', 'Errore caricamento: ' + err.message); });
  }, [docId]);

  return <CardEditor initialCard={initialCard} onReset={handleReset} />;
}
```

### 4.6 `dataService.getDocument` — nuovo helper

```ts
// src/utils/dataService.js (aggiunta)
async function getDocument(userEmail, docId, documentType) {
  if (IS_LOCAL) {
    const all = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') ?? '[]');
    return all.find(d => d.id === docId && d.userEmail === userEmail && d.documentType === documentType) ?? null;
  }
  const res = await fetch(`/api/documents/${encodeURIComponent(docId)}?userEmail=${encodeURIComponent(userEmail)}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) return null;
  const { data } = await res.json();
  return data;
}
```

**Se l'endpoint GET `/api/documents/:id` non esiste**: aggiungerlo in `api/index.ts` con lo stesso pattern dei `GET /quotes/:id` esistenti, ma unificato per `documentType`. Verificare ownership via `userEmail` query param + check `doc.userEmail === userEmail`.

### 4.7 CollectionView — activeId esteso

```tsx
// src/pages/app/CollectionPage.tsx
function CollectionPage() {
  const location = useLocation();
  const match = useMatch('/app/:type/:docId');  // solo se route ha :docId
  const activeId = match?.params.docId ?? null;

  return <CollectionView activeId={activeId} onOpen={...} />;
}
```

**Nota**: l'`activeId` non dipende più da `ctx.editingQuote?.quoteId`. È derivato dalla route URL corrente. Permette highlight di card/QR/logo/flyer aperti, non solo quote.

## 5. Acceptance Criteria

- **AC-001**: Given un utente nella Collection con un documento "Bigliettino Giovanni Finale" (id=`abc123`), When clicca "Apri", Then l'URL diventa `/app/card/abc123` (push history, non replace) e il `CardEditor` mostra il documento. La voce "Bigliettino Giovanni Finale" nella Collection ha classe active-highlight.
- **AC-002**: Given l'utente è su `/app/card/abc123` e preme F5, Then dopo reload la pagina mostra lo stesso documento (hydration via `dataService.getDocument`), non un documento vuoto.
- **AC-003**: Given l'utente è su `/app/card/abc123`, When preme il bottone "Nuovo"/"reset" nel CardEditor, Then l'URL diventa `/app/card` (replace), il `CardEditor` mostra un documento vuoto, e `ctx.cardDocument` è `null`.
- **AC-004**: Given l'utente naviga manualmente a `/app/card` (senza ID), Then il `CardEditor` mostra un documento vuoto (`createEmptyCard()`) anche se `ctx.cardDocument` contiene ancora un documento residuo.
- **AC-005**: Given l'utente crea una nuova card da `/app/card` (root), compila campi, l'auto-save genera id=`new456`, Then l'URL viene aggiornato a `/app/card/new456` via `replace` (no nuovo step history, no re-render dell'editor).
- **AC-006**: Given l'utente tenta di aprire `/app/card/<docId-di-altro-utente>`, Then `dataService.getDocument` ritorna `null`, viene mostrato toast "Documento non trovato" e redirect a `/app/card` (replace).
- **AC-007**: Given l'utente naviga `/app/card/abc` → sidebar "QR" → `/app/qr/xyz`, Then il `QREditor` carica il documento `xyz` (nessun bleed del `cardDocument` nel QR editor). Tornando a Collection, "Card abc" non è più attivo, "QR xyz" è attivo.
- **AC-008**: Given l'utente preme il tasto back del browser dopo aver aperto 3 documenti diversi in sequenza (card → qr → logo), Then il back ripercorre gli URL `/app/logo/x` → `/app/qr/y` → `/app/card/x` → `/app/collection` in ordine inverso (history reale, non saltata).
- **AC-009**: Given l'utente è su `/app/qr/abc` e il `QREditor` non ha bottone "Nuovo" (pre-fix), Then dopo l'implementazione della spec il `QREditor` mostra un bottone "Nuovo" che, premuto, esegue reset + navigate root `/app/qr` (replace).
- **AC-010**: Given l'utente è su `/app/editor` (quote) e l'`EditorView` non ha bottone "Nuovo preventivo" interno (pre-fix), Then dopo l'implementazione l'`EditorView` mostra un bottone "Nuovo preventivo" che, premuto, esegue reset quote + navigate `/app/editor` (replace, anche se è già root — serve a pulire il context).
- **AC-011**: Given l'utente è su `/app/card/abc` e il docId è malformato (es. `/app/card/..%2F..`), Then il validatore regex GUD-001 rifiuta, toast "ID documento non valido", redirect root.
- **AC-012**: Given il `AppShell.openDocument` è chiamato con un doc senza `id` (es. doc legacy non migrato), Then `openDocument` ritorna early (no navigation, no context update) e logga un warning.

## 6. Test Automation Strategy

- **Test Levels**:
  - **Unit**: `pathToView`/`viewToPath`/`buildPath` con path dinamici (es. `pathToView('/app/card/abc') === 'card'`). `dataService.getDocument` con mock localStorage e mock fetch.
  - **Integration**: `CardPage` con `MemoryRouter` initialEntries=`['/app/card/abc']` → renderizza `CardEditor` con il documento corretto. Simula F5 con remount → stessa hydration.
  - **E2E**: Click "Apri" nella Collection → URL contiene ID → back → URL precedente. Premere "Nuovo" → URL root + editor vuoto.

- **Framework**: Vitest + React Testing Library + `MemoryRouter` (già in uso). Test in `src/__tests__/routing.test.ts`, `src/pages/app/__tests__/CardPage.test.tsx`, ecc.
- **Mocking**: `dataService.getDocument` mockato con `vi.spyOn` per i test unit. `useNavigate` mockato nei test del reset handler.
- **Copertura minima**: 80% per i nuovi file (`CardPage`/`QrPage`/`LogoPage`/`FlyerPage` controller layer, `useRouteView` extended). 60% per i file modificati (`AppShell`, editor shells).
- **Regression tests**: Aggiungere test che rompono **senza** il fix per ogni AC: es. AC-002 deve fallire se `CardPage` non fa hydration (test simula context vuoto + URL con ID).
- **CI**: `npm run typecheck && npm run test` devono essere verdi (vedi Pre-push Checklist AGENTS.md).

## 7. Rationale & Context

**Perché URL con ID invece di solo context?**
- **Refresh-friendly**: oggi F5 perde il documento aperto. Con URL ID + hydration, F5 ripristina. Utente non perde lavoro in caso di crash/refresh accidentale.
- **Back/forward reale**: history del browser contiene i documenti aperti. Utile per confrontare due documenti (apri A → apri B → back → vedi A senza dover tornare in Collection).
- **Semantica del reset uniforme**: `/app/card` (root) = nuovo doc; `/app/card/:id` = doc esistente. Auto-documentante, niente flag `isNew` sparsi nel codice.
- **Debug & support**: un utente che riporta un bug può incollare l'URL con l'ID del documento problematico. Oggi l'URL è inutile (`/app/card` per tutti).
- **Shareable (future)**: se in futuro si vogliono aggiungere link condivisibili tra membri di un team (dietro auth), l'infrastruttura URL c'è già.
- **Consistenza**: oggi solo i quote avevano un `activeId` highlight nella Collection. Con URL ID, tutti i tipi hanno highlight uniforme.

**Perché non Deep Linking pubblico (senza auth)?**
- I documenti contengono dati business dell'utente (nome, email, telefono, prezzi). Non devono essere pubblicamente accessibili. L'URL ID serve per **identificazione**, non per **autorizzazione**. L'auth wall resta (vedi SEC-002 ownership check).

**Perché `replace: true` su reset/save-new ma `push` su Apri?**
- "Apri" è un'azione intenzionale dell'utente (nuovo step nella sua narrativa di navigazione). Merita un'entry history per il back.
- "Reset"/"Nuovo" e "Save new doc" sono transizioni di stato dell'editor corrente, non cambio contesto. `replace` evita di inquinare lo history stack (l'utente non vuole vedere 5 step "ho premuto reset" nel back).

**Perché estendere `useRouteView` invece di bypassarlo?**
- Il bridge è usato da `Layout`/`Topbar` per highlight attivo nella sidebar. Se bypassiamo per le route ID-based, l'highlight della sidebar si rompe. Estendere `pathToView` con prefix-match + mantenere il valore `view` (senza ID) è la soluzione minima invasiva.
- `setView` con `docId` opzionale è backward-compatible: `setView('card')` continua a funzionare (naviga a `/app/card`).

**Caveat: doppia fonte di verità (URL + context)**
- Rischio: URL dice `abc`, context dice `xyz`. Mitigazione PAT-001 (URL è fonte, context è cache): la hydration triggara solo su mismatch e prevale sul context. Fast path salta fetch se context ID === URL ID (evita refetch inutile dopo "Apri", dove il doc è già in context).
- Rischio: context modificato fuori dal sync URL (es. autosave aggiorna `ctx.cardDocument.id` dopo save). Mitigazione REQ-006: dopo save con nuovo ID, navigate replace a `/app/card/:newId` prima che il context venga letto dal prossimo render. Race window < 1 frame, trascurabile.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: **React Router v6** — già in uso (`react-router-dom`). Niente upgrade. Le API usate (`useParams`, `useNavigate`, `useMatch`, `useLocation`, `MemoryRouter` per test) sono tutte v6 stable.

### Third-Party Services
- Nessuna nuova dipendenza di terze parti.

### Infrastructure Dependencies
- **INF-001**: **Vercel SPA fallback** — `vercel.json` ha già `{ "source": "/(.*)", "destination": "/index.html" }` come catch-all. Le route `/app/card/:docId` sono servite client-side dallo stesso fallback. **Nessuna modifica a `vercel.json`** (vedi AGENTS.md "Vercel Routing").
- **INF-002**: **Neon Postgres** — se serve il nuovo endpoint `GET /api/documents/:id` (prod), usa la stessa `DATABASE_URL` esistente. Nessun DB aggiuntivo.

### Data Dependencies
- **DAT-001**: **`precisionQuote_documents:v1`** (localStorage, dev) — array di documenti con `id`, `userEmail`, `documentType`. L'helper `dataService.getDocument` filtra per i tre campi.
- **DAT-002**: **Tabella `documents`** (Neon, prod) — già esiste (Drizzle schema `db/schema.ts`). Endpoint `GET /api/documents/:id` query per `id` + `userEmail` + ownership check.

### Technology Platform Dependencies
- **PLT-001**: **React 18** + **react-router-dom v6** — entrambi già in uso. Nessuna nuova API richiesta.

## 9. Examples & Edge Cases

### Edge case: Apri un documento appena cancellato

```text
Scenario: Utente apre la Collection in tab A, cancella il doc `abc` in tab B
(richiesta DELETE via API), poi torna in tab A e clicca "Apri" su `abc`.

Comportamento atteso:
1. openDocument imposta context (ha ancora il payload in memoria Collection).
2. Navigate a /app/card/abc.
3. Page component triggare hydration (context ha già abc — fast path, skip fetch).
4. L'editor mostra il doc (stale cache).
5. Al primo autosave, il save fallisce (404 da /api/documents/:id se doc deleted).
6. Toast error + l'utente decide se ricaricare come nuovo o tornare in Collection.

Mitigazione: alla prima hydration fare sempre un fetch HEAD/check (o GET leggero)
se il doc è in context da > 5 minuti (stale threshold). Opzionale, Fase 2.
```

### Edge case: Auto-save crea ID, poi l'utente preme back

```text
Scenario: Utente è su /app/card (root), compila campi, autosave genera id=new456,
navigate replace a /app/card/new456. Utente preme back.

Comportamento atteso:
1. Back porta al penultimo entry history.
2. Se l'utente era arrivato alla root da /app/collection, back → /app/collection.
3. Il doc new456 è salvato in storage, resta accessibile dalla Collection.

Se l'utente era arrivato da /app/card/abc → /app/card (reset) → autosave new456:
1. History: /app/card/abc → [replace] /app/card/new456.
2. Back → entry precedente /app/card/abc (che ancora esiste in storage).
3. L'utente vede abc, non new456 (corretto: è andato indietro a dove era).

Questo comportamento è intenzionale. Il replace su save-new-doc evita
stack-pollution ("ho salvato 10 volte" = 10 step history) ma preserva
il back al contesto precedente.
```

### Edge case: ID legacy senza `id` field

```text
Scenario: Un preventivo legacy (pre-Phase 6) salvato in precisionQuote_quotes
non ha il campo `id`, ma solo `quoteId`. La Phase 6 ha migrato con
`pq_migration_v1_done_<email>` flag, aggiungendo `id = quoteId`.

Comportamento: se un doc arriva senza `id` (solo `quoteId`), openDocument
deve usare `doc.id ?? doc.quoteId` come ID per l'URL. Validare con test.

L'helper getDocument deve matchare entrambi i campi per retrocompatibilità
con localStorage legacy non migrato (safety net).
```

### Esempio flusso completo

```text
1. User login → /app (IndexRedirect) → /app/qr (user normale).
2. User va in Collection → vede 5 documenti.
3. User clicca "Apri" su "QR Sito Web" (id=qr_001).
   URL: /app/qr/qr_001 (push history). QREditor mostra il QR.
4. User fa modifica → autosave (no cambio URL, doc già esistente).
5. User preme "Nuovo" nel QREditor (REQ-009, nuovo bottone).
   URL: /app/qr (replace). QREditor vuoto.
6. User preme back → torna a /app/qr/qr_001 (push history al punto 3).
7. User fa F5 → hydration carica qr_001 da storage.
8. User naviga a Collection. "QR Sito Web" è highlighted (activeId=qr_001).
9. User clicca "Apri" su "Bigliettino Finale" (id=card_abc).
   URL: /app/card/card_abc (push). CardEditor mostra il doc.
10. User fa F5 → hydration carica card_abc da storage.
```

## 10. Validation Criteria

- **[V-001]**: `npm run typecheck` passa senza errori (TypeScript strict su `useRouteView` extended, `CardPage`/`QrPage`/`LogoPage`/`FlyerPage` controller layer).
- **[V-002]**: `npm run test` — tutti i test esistenti + nuovi test routing/hydration/reset verdi. Coverage ≥ 80% sui nuovi file.
- **[V-003]**: In locale (`npm run dev`), navigazione manuale `/app/card/abc123` (dopo aver creato un doc con quell'ID) carica il documento. F5 ripristina.
- **[V-004]**: Premere "Nuovo/reset" in CardEditor → URL diventa `/app/card`, editor vuoto. Back button non mostra `abc123`.
- **[V-005]**: Active highlight nella Collection funziona per tutti i tipi (quote, QR, card, logo, flyer), non solo quote.
- **[V-006]**: `QREditor` e `EditorView` (quote) hanno entrambi un bottone "Nuovo" visibile e funzionante.
- **[V-007]**: Test di regression: un test simula context `cardDocument={id: 'xyz'}` + URL `/app/card/abc` → verifica che `CardPage` fa fetch di `abc` (non usa `xyz` dal context).
- **[V-008]**: Nessuna modifica a `vercel.json`. SPA fallback serve le route `/app/:type/:docId` senza 404.
- **[V-009]**: Navigazione cross-tipo non bleed: da `/app/card/abc` a `/app/qr/xyz`, il `QREditor` non mostra dati della card.

## 11. Related Specifications / Further Reading

- `AGENTS.md` — Sezione "App Routes", "Vercel Routing" (critica: non modificare `vercel.json` rewrites), "Git Guardrails".
- `src/main.tsx` — Route definitions attuali (righe 44-71).
- `src/hooks/useRouteView.ts` — Bridge view↔pathname attuale (51 righe, da estendere).
- `src/components/AppShell.tsx:491-519` — `openDocument` attuale (da aggiornare con `docId`).
- `src/components/CollectionView.tsx:514` — Active highlight attuale (solo quote, da estendere a tutti).
- `src/utils/dataService.js` — Data layer (da aggiungere `getDocument` helper).
- `api/index.ts` — Monolite API (aggiungere `GET /api/documents/:id` se non esiste, rispettando ownership e lezioni "Vercel Routing").
- `src/components/Layout.tsx:54,259-261` — Sidebar/Drawer "Nuovo preventivo" buttons (da uniformare con reset handler).

---

## Appendice A: Phasing (raccomandato)

Per ridurre rischio di regression, implementare in 3 fasi verificabili:

### Fase 1 — Routing core (minimo viable)
- Refactor `useRouteView` (prefix-match + `setView(v, docId?)`).
- Aggiornare `main.tsx` con route `:docId`.
- Aggiornare `AppShell.openDocument` per navigare con ID.
- Aggiungere `dataService.getDocument` + endpoint `GET /api/documents/:id` (se necessario).
- Page component fanno hydration via `useParams`.
- **Verifica**: AC-001, AC-002, AC-006, AC-007, AC-011 passano.

### Fase 2 — Reset & uniformità UX
- Aggiungere bottone "Nuovo" a `QREditor` (REQ-009).
- Aggiungere bottone "Nuovo preventivo" a `EditorView` (REQ-010).
- Wireare reset handler in tutti gli editor (navigate root + clear context).
- Aggiornare Collection active highlight via URL (REQ-008).
- **Verifica**: AC-003, AC-004, AC-005, AC-009, AC-010 passano.

### Fase 3 — Edge cases & regression
- Gestione doc legacy senza `id` field (edge case 3).
- Stale cache detection (opzionale, Fase 2 futura).
- URL update post-save (REQ-006, navigate replace).
- Test di regression completi.
- **Verifica**: AC-005, AC-008, AC-012 passano. V-001..V-009 verdi.

---

## Appendice B: Mappatura file da modificare

| File | Modifica | Priorità |
|------|----------|----------|
| `src/hooks/useRouteView.ts` | Prefix-match + `setView(v, docId?)` + `buildPath` | Fase 1 |
| `src/main.tsx` | Aggiungere route `:docId` per editor/qr/card/logo/flyer | Fase 1 |
| `src/components/AppShell.tsx` | `openDocument` naviga con `docId`; reset handler esposto nel context | Fase 1 |
| `src/utils/dataService.js` | Aggiungere `getDocument(userEmail, docId, documentType)` | Fase 1 |
| `api/index.ts` | Aggiungere `GET /api/documents/:id` (se non esiste), ownership check | Fase 1 |
| `src/pages/app/CardPage.tsx` | Hydration via `useParams`, reset handler | Fase 1+2 |
| `src/pages/app/QrPage.tsx` | Hydration via `useParams`, reset handler | Fase 1+2 |
| `src/pages/app/LogoPage.tsx` | Hydration via `useParams`, reset handler | Fase 1+2 |
| `src/pages/app/FlyerPage.tsx` | Hydration via `useParams`, reset handler | Fase 1+2 |
| `src/pages/app/EditorPage.tsx` | Hydration via `useParams` per quote (admin) | Fase 1 |
| `src/pages/app/CollectionPage.tsx` | `activeId` derivato da `useMatch('/app/:type/:docId')` | Fase 2 |
| `src/components/CollectionView.tsx` | Active highlight esteso a tutti i tipi (già funziona via prop `activeId`) | Fase 2 |
| `src/components/QREditor.tsx` | Aggiungere bottone "Nuovo" (REQ-009) | Fase 2 |
| `src/components/EditorView.tsx` | Aggiungere bottone "Nuovo preventivo" (REQ-010) | Fase 2 |
| `src/components/card/CardEditorShell.tsx` | Reset handler naviga root (invece di solo setState) | Fase 2 |
| `src/components/flyer/FlyerEditorShell.tsx` | Reset handler naviga root | Fase 2 |
| `src/components/LogoEditor.tsx` | `handleNew` naviga root | Fase 2 |
| `src/components/Layout.tsx` | Sidebar "Nuovo preventivo" → reset handler context (non solo navigate) | Fase 2 |
| `src/__tests__/routing.test.ts` | Nuovo: test `pathToView`/`viewToPath`/`buildPath` | Fase 1 |
| `src/pages/app/__tests__/CardPage.test.tsx` | Nuovo: hydration + reset | Fase 1+2 |
| `src/pages/app/__tests__/QrPage.test.tsx` | Nuovo: hydration + nuovo bottone | Fase 2 |
| `api/__tests__/documents.test.ts` | Nuovo: `GET /api/documents/:id` ownership | Fase 1 |