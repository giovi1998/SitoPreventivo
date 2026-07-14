---
title: URL-ID Routing per documenti della Collection
version: 1.0
date_created: 2026-07-13
owner: Giovanni
tags: design, routing, architecture, ux
---

# Introduction

Ogni documento salvato nella Collection (preventivo, QR, card, logo, flyer)
attualmente vive solo nello stato in-memory di `AppShell`: l'URL resta
`/app/card` anche quando l'utente sta editando "Bigliettino Giovanni, Web
Developer Finale". Un refresh perde il contesto, il bottone indietro del
browser non torna al documento precedente, e non è possibile bookmarkare o
condividere un documento specifico.

Questa spec introduce **URL con ID documento** (`/app/card/{idCard}`,
`/app/qr/{idQr}`, ecc.) come fonte primaria di verità per il documento
corrente, mantenendo la rotta bare (`/app/card`) come target del reset
"Nuovo". L'analisi di fattibilità tecnica è in §7.

## 1. Purpose & Scope

**Scopo**: Rendere ogni documento indirizzabile via URL, consentire
bookmark/share/refresh, e sincronizzare il bottone "Nuovo" con la rotta
bare.

**In scope**:
- Route dinamiche `/app/:docType/:id` per i 5 tipi documento (`quote`,
  `qr`, `card`, `logo`, `flyer`).
- Endpoint server `GET /documents/:id` + metodo `dataService.getDocumentById`.
- Reload-on-id-change per QR/Logo/Flyer editor (CardEditor lo ha già).
- "Nuovo" → `navigate` alla rotta bare + clear stato locale.
- Generazione ID preventivo hardening (UUID-safe).
- Verifica `vercel.json` SPA catch-all compatibile con i nuovi path.

**Out of scope** (questa fase):
- Multi-tab / multi-documento simultanei (un solo documento attivo per
  tipo, come oggi).
- Condivisione pubblica via URL (tutti i documenti richiedono login).
- Cronologia browser per navigazione tra documenti (la si ottiene già
  gratis con `pushState`).

**Audience**: Sviluppatori del frontend Quickbrand. La feature è
invisibile agli utenti API (vedi `spec-api-saas-monetization.md`).

## 2. Definitions

| Termine | Definizione |
|---------|-------------|
| **Doc type** | Uno di `quote \| qr \| card \| logo \| flyer`. Mappa 1:1 sui 5 editor. |
| **Doc id** | Stringa PK del documento nella tabella `documents` (es. `card_1720900000_a1b2c3`). URL-safe. |
| **Rotta bare** | `/app/{docType}` senza segmento id. Target del reset "Nuovo". |
| **Rotta id** | `/app/{docType}/{id}`. Documento specifico caricato da storage. |
| **Slot documento** | Stato in `AppShell` per un tipo: `quote`, `qrDocument`, `cardDocument`, `logoDocument`, `flyerDocument`. |
| **LoadedIdRef** | `useRef` che tiene traccia dell'ultimo id caricato in un editor, per evitare ricarichi ridondanti. Già presente in `CardEditorShell`. |
| **Cold-open** | Accesso diretto a un URL id senza passaggio dalla Collection (es. bookmark, refresh, link esterno). |

## 3. Requirements, Constraints & Guidelines

### REQ — Requisiti Funzionali

- **REQ-001**: Ogni documento aperto dalla Collection deve navigare a
  `/app/{docType}/{id}` invece di `/app/{docType}`. L'id usato è
  `document.id` (PK esistente, URL-safe).
- **REQ-002**: Apertura diretta (cold-open) di un URL id deve caricare
  il documento da storage se non già nello slot di `AppShell`, e
  renderizzare l'editor. Se il documento non appartiene all'utente
  corrente o non esiste → redirect alla rotta bare + toast informativo.
- **REQ-003**: Il reset "Nuovo" in ciascun editor deve
  `navigate('/app/{docType}')` (rotta bare) E azzerare lo stato locale
  (comportamento attuale). Doppio effetto: URL coerente + stato pulito.
- **REQ-004**: Il duplicato da Collection deve navigare al nuovo id
  dopo il salvataggio (`/app/{docType}/{newId}`), non al vecchio.
- **REQ-005**: Auto-save non deve sovrascrivere l'URL: se l'utente
  edita un documento id `X`, l'URL resta `/app/card/X` anche dopo
  save. Cambiare documento = cambiare URL.
- **REQ-006**: Refresh pagina (F5) su `/app/card/X` deve ripristinare
  lo stesso documento nello stesso stato di editing (lo stato di
  editing non editato si perde come oggi, ma il documento si ricarica).
- **REQ-007**: Il layout/sidebar deve evidenziare il documento
  corrente nella Collection (`activeId`) leggendo l'id dalla URL, non
  dallo slot di `AppShell` (fonte unica di verità = URL).

### SEC — Requisiti di Sicurezza

- **SEC-001**: Cold-open su `/app/{docType}/{id}` deve verificare
  ownership: `document.userEmail === currentUser.email`. Mancanza → 404
  visibile come redirect bare + toast "Documento non trovato" (non
  rivelare l'esistenza di documenti altrui).
- **SEC-002**: Gli id documento sono già PK globali senza sequenza
  indovinabile per QR/card/logo/flyer (timestamp + rand6). Per i
  preventivi (`PRV-YYYY-NNN`, 3 cifre) — vedi SEC-003.
- **SEC-003**: Hardening generazione id preventivo: passare da
  `PRV-YYYY-NNN` (3 cifre, 900/anno, collision-prone) a
  `PRV-YYYY-${rand6}` come gli altri documenti. Retrocompatibile:
  gli id legacy restano validi (sono solo stringhe PK).

### CON — Vincoli

- **CON-001**: Nessun nuovo endpoint richiede >10s (Vercel Hobby).
  `GET /documents/:id` è una SELECT indexed by PK, <5ms.
- **CON-002**: Monolite `api/index.ts` resta tale (vedi AGENTS.md
  lessons learned). Il nuovo endpoint è un handler inline.
- **CON-003**: `useRouteView` attuale ha path table hardcoded senza
  parametri (v. analisi §7). Estenderlo o bypassarlo con `useParams`
  nei page wrapper, NON riscriverlo (rotture a cascata).
- **CON-004**: L'auto-save debounce non deve triggerare navigazioni
  URL (l'URL cambia SOLO su azione esplicita: Apri, Nuovo, Duplica).
- **CON-005**: `vercel.json` ha SPA catch-all `/(.*) -> /index.html`.
  I nuovi path `/app/card/{id}` sono gestiti lato client, nessun
  rewrite extra richiesto. Test regressione `vercelConfig.test.ts`
  deve restare verde.
- **CON-006**: LocalStorage path (`IS_LOCAL`) deve supportare
  `getDocumentById` con la stessa signature del path API.

### GUD — Linee Guida

- **GUD-001**: Ordine segmenti URL: `/app/{docType}/{id}`. Non
  invertire (`/app/{id}/{docType}`): il docType determina quale
  editor montare, e React Router matcha prima il segmento statico.
- **GUD-002**: L'id nell'URL non va mai URL-encoded (è già
  `[a-z0-9_]`). I caratteri speciali, se introdotti in futuro,
  andranno `encodeURIComponent`-ati.
- **GUD-003**: Redirect alla rotta bare (non 404 hard) per documenti
  non trovati/non autorizzati. Evita loop: la rotta bare non fa
  lookup id, quindi non può re-redirigere.
- **GUD-004**: Mantenere `setView(name)` come API interna — l'estensione
  URL-id è additiva, non sostitutiva. `useRouteView` resta il bridge
  per le view senza id (collection, settings, admin).
- **GUD-005**: Evitare fetch waterfall al cold-open: il page wrapper
  chiama `getDocumentById` una sola volta, e solo se lo slot
  `AppShell` non contiene già un documento con stesso id (risparmio
  fetch nel caso Apri→refresh).

### PAT — Pattern

- **PAT-001**: Page wrapper come data-loader. Ogni `XPage.tsx` (es.
  `CardPage`) diventa un loader elementare: legge `useParams().id`,
  confronta con `ctx.{type}Document?.id`, se mismatch o assente →
  `getDocumentById` → `ctx.setXDocument(doc)`. Pattern uniforme sui
  5 page wrapper.
- **PAT-002**: `loadedIdRef` uniforme. QR/Logo/Flyer editor
  importano il pattern già in `CardEditorShell.tsx:99-108`:
  `useEffect` che quando `initialX.id` cambia resetta lo stato
  interno con `mergeXWithDefaults(initialX)`. Previene editing
  cross-doc quando si naviga A→B senza smontare.
- **PAT-003**: `openDocument` in `AppShell` naviga con id. Modifica
  inline: dopo `setXDocument(doc)`, chiamare `navigate('/app/{type}/
  {doc.id}')` invece di `setView(type)`. Lo slot resta la cache
  in-memory; l'URL è la verità esposta.
- **PAT-004**: "Nuovo" handler composto. Ogni editor "Nuovo":
  (a) `setX(createEmptyX())` locale; (b) chiama una prop `onReset`
  passata dal page wrapper che fa `navigate('/app/{type}')`; (c)
  clear eventuale `aiStateRef` / localStorage chat (logo già lo fa).
- **PAT-005**: `activeId` dalla URL, non dallo slot. `CollectionPage`
  legge `useParams` del router (o riceve `activeId` via prop calcolato
  dal pathname) per highlight riga. Fonte unica: URL.

## 4. Interfaces & Data Contracts

### 4.1 Route — main.tsx

```tsx
// Sostituire le 5 route bare con coppia bare + id:
<Route path="editor" element={<AdminEditorRoute><EditorPage /></AdminEditorRoute>} />
<Route path="editor/:id" element={<AdminEditorRoute><EditorPage /></AdminEditorRoute>} />
<Route path="qr" element={<QrPage />} />
<Route path="qr/:id" element={<QrPage />} />
<Route path="card" element={<CardPage />} />
<Route path="card/:id" element={<CardPage />} />
<Route path="logo" element={<LogoPage />} />
<Route path="logo/:id" element={<LogoPage />} />
<Route path="flyer" element={<FlyerPage />} />
<Route path="flyer/:id" element={<FlyerPage />} />
// quote, collection, settings, admin, social restano singole (no id)
```

### 4.2 Endpoint API — `GET /documents/:id`

```http
GET /documents/card_1720900000_a1b2c3?email=user@example.com HTTP/1.1
Authorization: Bearer <sessionToken>

→ 200 OK
{ "data": { "id": "card_1720900000_a1b2c3", "userEmail": "user@example.com",
            "documentType": "businessCard", "title": "Bigliettino Giovanni",
            "name": "Giovanni", "title": "Web Developer", ... ,
            "createdAt": "2026-07-10T...", "updatedAt": "2026-07-13T..." } }

→ 404 Not Found (id inesistente OR userEmail mismatch)
{ "error": "Documento non trovato" }
```

 ownership check: `WHERE id = $1 AND userEmail = $2`. Mai rivelare
l'esistenza di id altrui (same error shape di 404 puro).

### 4.3 `dataService.getDocumentById(id, email)`

```js
async getDocumentById(id, email) {
  if (IS_LOCAL) {
    const all = JSON.parse(localStorage.getItem('precisionQuote_documents:v1') || '[]');
    const doc = all.find(d => d.id === id && d.userEmail === email);
    if (!doc) throw new NotFoundError('Documento non trovato');
    return hydrateDocument(doc);
  }
  const res = await api('GET', `/documents/${encodeURIComponent(id)}?email=${encodeURIComponent(email)}`);
  if (res.status === 404) throw new NotFoundError('Documento non trovato');
  return hydrateDocument(res.data);
}
```

### 4.4 Page wrapper — pattern loader

```tsx
// CardPage.tsx (esempio; replicare su QrPage, LogoPage, FlyerPage, EditorPage)
export default function CardPage() {
  const ctx = useAppContext();
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;                              // rotta bare: niente fetch
    if (ctx?.cardDocument?.id === id) return;     // già in slot, skip
    if (!ctx?.user?.email) return;
    setLoading(true);
    dataService.getDocumentById(id, ctx.user.email)
      .then(doc => ctx.setCardDocument(doc))
      .catch(() => { setError('Documento non trovato'); navigate('/app/card', { replace: true }); })
      .finally(() => setLoading(false));
  }, [id, ctx?.cardDocument?.id, ctx?.user?.email]);

  if (loading) return <Spinner />;
  return <CardEditor initialCard={ctx?.cardDocument} onReset={() => navigate('/app/card')} />;
}
```

### 4.5 `openDocument` modificato — AppShell

```ts
// AppShell.tsx:491-519, modifica minimale
function openDocument(doc) {
  switch (doc.documentType) {
    case 'quote':       setQuote(migrateFromLegacy(doc)); navigate(`/app/editor/${doc.id}`); break;
    case 'qrCode':      setQrDocument(doc);               navigate(`/app/qr/${doc.id}`);    break;
    case 'businessCard': setCardDocument(doc);            navigate(`/app/card/${doc.id}`);  break;
    case 'logo':        setLogoDocument(doc);             navigate(`/app/logo/${doc.id}`);  break;
    case 'flyer':       setFlyerDocument(doc);           navigate(`/app/flyer/${doc.id}`);  break;
  }
}
```

### 4.6 Hardening id preventivo

```ts
// AppShell.tsx:29-33, prima:
//   `PRV-${year}-${String(Math.floor(Math.random()*900)+100)}`
// dopo:
function generateQuoteId() {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8); // 6 char base36
  return `PRV-${year}-${rand}`;
}
```

Retrocompatibile: id legacy `PRV-2026-123` restano PK valide.

## 5. Acceptance Criteria

- **AC-001**: Given un utente autenticato con un documento card id
  `X` nella Collection, When clicca "Apri", Then l'URL diventa
  `/app/card/X` e l'editor mostra i dati di `X`.
- **AC-002**: Given un utente su `/app/card/X` con il documento
  caricato, When preme F5 (refresh), Then il documento `X` viene
  ricaricato da storage e l'editor riparte dallo stesso documento
  (stato di editing non salvato perso, come oggi).
- **AC-003**: Given un utente su `/app/card/X`, When preme "Nuovo",
  Then l'URL diventa `/app/card` (rotta bare) e l'editor mostra una
  card vuota (`createEmptyCard()`).
- **AC-004**: Given un utente che naviga manualmente a
  `/app/card/ID_INESISTENTE`, Then viene redirectato a `/app/card`
  con toast "Documento non trovato".
- **AC-005**: Given un utente A che tenta `/app/card/X` dove `X`
  appartiene all'utente B, Then riceve redirect bare + toast
  "Documento non trovato" (no info leak sull'esistenza).
- **AC-006**: Given Collection aperta, When l'utente è su
  `/app/card/X`, Then la riga `X` nella Collection è evidenziata
  come attiva (fonte: URL, non slot AppShell).
- **AC-007**: Given duplicazione di un documento card `X`, When la
  copia `Y` viene salvata, Then l'URL diventa `/app/card/Y` (non
  `X`).
- **AC-008**: Given auto-save in corso su `/app/card/X`, When il
  debounce scatta, Then l'URL resta `/app/card/X` (niente pushState).
- **AC-009**: Given 5 tipi documento, When si apre un documento di
  tipo `T` con id `I`, Then l'URL è esattamente `/app/{T}/{I}`
  con `T ∈ {editor, qr, card, logo, flyer}`. L'editor `T` è
  montato, non un altro.
- **AC-010**: Given test regressione `vercelConfig.test.ts`, When
  gira, Then resta verde (i nuovi path non richiedono rewrite
  extra).

## 6. Test Automation Strategy

- **Unit**:
  - `dataService.getDocumentById` — localStorage path + API path,
    caso felice + 404 (id inesistente, userEmail mismatch).
  - `generateQuoteId` — formato `PRV-YYYY-{base36-6}`, lunghezza,
    no collision su 10k sample.
  - `useRouteView` esteso — parsing di `/app/card/X` → view `card`,
    id `X`.
- **Integration**:
  - `GET /documents/:id` handler in `api/index.ts` — owner ritorna
    200, non-owner ritorna 404, id inesistente ritorna 404.
- **Component** (React Testing Library):
  - `CardPage` loader — render con `id=undefined` non fa fetch;
    con `id='X'` e slot vuoto fa fetch; con slot già `X` skip.
  - `QrEditor` / `LogoEditor` / `FlyerEditor` — mount con
    `initialX.id` che cambia dopo 1s → stato interno resettato
    (loadedIdRef effect analogo a CardEditor).
  - `CollectionPage` — `activeId` derivato dal pathname, non dallo
    slot. Test con `/app/card/X` passato come location → riga `X`
    ha classe `active`.
- **E2E** (Playwright opzionale, non bloccante per merge):
  - Apri Collection → click "Apri" → URL contiene id → F5 →
    stesso documento.
  - "Nuovo" → URL bare → editor vuoto.
- **Framework**: Vitest + React Testing Library + jsdom (già in
  uso). Nuovi test in `src/pages/__tests__/` e `src/utils/__tests__/`.
- **Coverage minima**: 70% per i file nuovi/modificati
  (`getDocumentById`, 5 page wrapper, `openDocument` diff).

## 7. Rationale & Context

**Perché URL-id adesso?**

Analisi di fattibilità sul codice corrente (esplorazione completa in
`task ses_0a5673bc6ffefEzLgr8fflfYck`):

| Aspetto | Stato pre-feature |
|---------|-------------------|
| ID documento URL-safe | ✅ già PK stringa `card_..._...` |
| Server ha pattern `/documents/:id` | ✅ DELETE lo usa già |
| `dataService` fetch-by-id | ❌ solo list, da aggiungere |
| `useRouteView` supporta param | ❌ path table fissa |
| Editor reload-on-id-change | ⚠️ solo CardEditor, altri 3 da aggiungere |
| "Nuovo" sincronizza URL | ❌ solo stato locale |
| Generazione id preventivo robusta | ⚠️ `PRV-YYYY-NNN` 3 cifre |

**Costo stimato**: 5 page wrapper + 1 metodo dataService + 1 endpoint
+ 3 effect loadedIdRef + 5 handler "Nuovo" + 1 hardening id. ~200
linee di codice di produzione, ~400 di test. Nessuna migrazione DB,
nessun nuovo schema.

**Perché non multi-documento / multi-tab?**

L'architettura `AppShell` ha 5 slot monodocumento per tipo.
Permettere `X` documenti simultanei richiederebbe array di slot o un
store esterno (Zustand/Jotai) — fuori scope. L'URL-id dà
bookmark/share/refresh senza rompere il modello single-slot.

**Perché redirect bare e non 404 page?**

Una 404 page rompe il flusso: l'utente voleva editare una card, non
vedere "Not Found". Il redirect bare preserva l'intento (voglio stare
nell'editor card) e comunica il problema via toast. Inoltre evita loop
infiniti (la bare non fa lookup).

**Perché l'URL è verità, non lo slot?**

Se lo slot fosse verità, refresh su `/app/card/X` dovrebbe decidere:
l'URL dice `X`, lo slot dice `Y` (l'ultimo aperto prima del refresh).
L'URL vince (è ciò che l'utente vede e bookmarka). Lo slot è solo
cache: se `slot.id !== url.id` → fetch e sovrascrivi slot.

## 8. Dependencies & External Integrations

### External Systems
- Nessuno nuovo. Neon Postgres e Vercel Hobby già in uso.

### Third-Party Services
- Nessuno.

### Infrastructure Dependencies
- **INF-001**: Vercel Hobby SPA catch-all `/(.*) -> /index.html` in
  `vercel.json`. I path `/app/{type}/{id}` sono serviti lato client.
  Test regressione `vercelConfig.test.ts` garantisce l'ordine
  rewrites.

### Data Dependencies
- **DAT-001**: Tabella `documents` (Neon). SELECT indexed by PK
  `id` + filter `userEmail`. Nessuno schema change.

### Technology Platform Dependencies
- **PLT-001**: React Router v6 (`react-router-dom@6`) — `useParams`,
  `useNavigate` già in uso. Route annidate con `:id` supportate.

### Compliance Dependencies
- Nessuna.

## 9. Examples & Edge Cases

### Edge case: Apri documento + refresh immediato

```text
Utente apre "Bigliettino Giovanni" (id card_X) → URL /app/card/card_X.
Premuto F5 prima che l'auto-save scritta anything.
Slot AppShell è vuoto al boot → page wrapper vede url.id='card_X'
≠ slot (undefined) → fetch getDocumentById → setCardDocument →
editor render. L'utente vede lo stesso documento. Perdite: editing
non salvato (come già oggi).
```

### Edge case: URL id di un documento eliminato in un altro tab

```text
Utente ha /app/card/card_X aperto. In un altro tab elimina card_X
dalla Collection. Torna al primo tab, fa una modifica → auto-save
chiama POST /documents con upsert. Il documento risorge (id esiste
nel body). Comportamento accettabile: l'utente non perde editing.
Se invece F5 senza modifiche → 404 → redirect bare.
```

### Edge case: Condivisione link tra utenti

```text
Utente A copia /app/card/card_X, invia a utente B. B apre:
- B non ha card_X nel suo slot → fetch → server ritorna 404
  (userEmail mismatch) → redirect bare + toast.
B non vede il documento di A. Sicurezza: same error shape 404 puro,
no enumeration.
```

### Esempio: ordine rewrites vercel.json

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

I path `/app/card/card_X` matchano la catch-all `/` → servono
`index.html` → React Router gestisce `/app/card/:id` lato client.
Nessun rewrite aggiuntivo. L'ordine (API prima, SPA dopo) è
critico e già garantito da `vercelConfig.test.ts`.

## 10. Validation Criteria

- **[V-001]**: `npm run typecheck` passa senza errori.
- **[V-002]**: `npm run test` — tutti i test esistenti + nuovi verdi.
- **[V-003]**: In locale, `npm run dev` → Collection → click "Apri"
  su un documento → URL contiene id. F5 → stesso documento.
- **[V-004]**: In locale, naviga manualmente a
  `/app/card/id_inesistente` → redirect a `/app/card` + toast.
- **[V-005]**: In locale, "Nuovo" da un documento aperto → URL bare
  + editor vuoto.
- **[V-006]**: `GET /documents/:id` ritorna 200 per owner, 404 per
  non-owner (curl test con due email diverse).
- **[V-007]**: Test regressione `vercelConfig.test.ts` verde.

## 11. Related Specifications / Further Reading

- `spec/spec-api-saas-monetization.md` — API SaaS via Stripe. Gli
  endpoint `/v1/{type}/svg` non si sovrappongono ai `/documents/:id`
  (quelli sono per API key esterne, questi per la sessione utente
  dell'app React).
- `api/index.ts` — pattern DELETE `/documents/:id` riusato per GET.
- `src/components/AppShell.tsx:491-519` — `openDocument` da modificare.
- `src/components/card/CardEditorShell.tsx:99-108` — `loadedIdRef`
  pattern da replicare negli altri 3 editor.
- `src/hooks/useRouteView.ts` — bridge pathname ↔ view, non toccare
  per le view senza id.
- `db/schema.ts:15-37` — tabella `documents`, PK `id varchar(50)`.