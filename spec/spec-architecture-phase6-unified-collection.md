---
title: Phase 6 — CollectionView unificata + migration preventivi
version: 1.0
date_created: 2026-06-21
owner: Giovanni Cidu
tags: [architecture, collection, migration, backward-compat, tabs, search, filter]
---

# Introduction

La fase 6 unifica il `CollectionView` esistente (che mostra solo
preventivi) in una vista multi-tipo con tab per tipo documento, ricerca
cross-tipo, filtri per stato/data, e badge tier. Migra anche i
preventivi esistenti dalla chiave localStorage `precisionQuote_quotes`
alla nuova `precisionQuote_documents:v1` con `documentType='quote'`,
mantenendo backward compatibility con l'endpoint `/quotes` legacy per
1 release.

Questa fase è architetturalmente importante perché completa la transizione
al modello multi-documento: dopo la fase 6, l'utente vede tutti i suoi
documenti (preventivi, QR, bigliettini, volantini, loghi) in un'unica
vista navigabile.

## 1. Purpose & Scope

**Purpose**: fornire una vista unificata di tutti i documenti dell'utente,
con navigazione per tipo, ricerca, filtri, e azioni per-tipo (apri,
duplica, elimina, esporta).

**Scope**:
- Refactor `src/components/CollectionView.tsx`:
  - Tab per tipo: "Tutti" | "Preventivi" | "QR" | "Bigliettini" |
    "Volantini" | "Loghi"
  - Ricerca cross-tipo (su titolo + contenuto)
  - Filtri: stato (per preventivi), data creazione, data modifica
  - Sort: data (default), titolo, tipo
  - Card per-tipo con icona + titolo + meta + tier badge
  - Azioni: apri (in editor corrispondente), duplica, elimina,
    esporta (PDF/PNG/SVG in base al tipo)
- Migrazione automatica al primo login: copia documenti da
  `precisionQuote_quotes` a `precisionQuote_documents:v1` con
  `documentType='quote'`
- Estensione `src/utils/dataService.js`: `migrateLegacyQuotes(email)`
  funzione che copia e marca migrato (flag `migrated_v1` in
  localStorage)
- Estensione `App.tsx`: al primo login dell'utente, chiama
  `migrateLegacyQuotes` se non già fatto
- Backward compat: `getQuotes` legacy continua a funzionare (legge
  da `precisionQuote_quotes`), ma `getDocuments` legge da
  `precisionQuote_documents:v1` (post-migrazione). Entrambi
  ritornano preventivi per backward compat.

**Out of scope**:
- Share link pubblico per documenti (out of scope v2)
- Cartelle/etichette personalizzate (out of scope v2)
- Bulk actions (elimina multipla, esporta ZIP) — out of scope v2
- Migration del DB `quotes` esistente (già fatto in fase 1 con
  rename a `documents`). Qui migriamo solo localStorage lato client.

**Intended audience**: sviluppatore che refactora CollectionView e
implementa la migration; reviewer che verifica i test di
backward compat.

**Assumptions**:
- Fasi 1-5 completate: endpoint `/documents` esiste, `dataService`
  ha `saveDocument`/`getDocuments`/`deleteDocument`.
- L'utente ha fino a ~50 documenti salvati (fase pre-clienti).
  Performance non è un problema con liste di questa dimensione.

## 2. Definitions

- **CollectionView**: componente che mostra la lista dei documenti
  salvati dall'utente.
- **Tab per tipo**: raggruppamento dei documenti per `documentType`.
- **Migration legacy**: copia dei preventivi da
  `precisionQuote_quotes` (formato legacy flat) a
  `precisionQuote_documents:v1` (formato nuovo con
  `documentType='quote'` + `_premium` embed).
- **Backward compat endpoint**: `/quotes` legacy continua a
  funzionare per 1 release, poi deprecato.
- **Tier badge**: indicatore visivo nella card ("Free" o
  "Sbloccato") — mostra se il documento è stato creato in tier free
  (quindi con watermark se esportato) o unlocked.

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: CollectionView ha 6 tab: "Tutti" (default), "Preventivi",
  "QR Code", "Bigliettini", "Volantini", "Loghi".
- **REQ-002**: Tab "Tutti" mostra tutti i documenti mescolati per data
  di modifica desc. Altri tab filtrano per `documentType`.
- **REQ-003**: Ogni tab mostra il count dei documenti nel badge.
- **REQ-004`: Ricerca cross-tipo in alto: input text con debounce 200ms.
  Cerca su `title` + (per preventivi) `client.name` + (per bigliettini)
  `front.name` + (per volantini) `content.headline` + (per QR)
  `data.payload` + (per logo) `builder.primaryText`.
- **REQ-005**: Filtri dropdown:
  - Stato (solo per preventivi: draft/sent/accepted/rejected/archived)
  - Data creazione (questa settimana / questo mese / quest'anno / tutto)
  - Sort (data modifica desc default, data creazione, titolo A-Z, tipo)
- **REQ-006**: Card documento mostra:
  - Icona per tipo (preventivo: doc, QR: qr-code, card: id-card,
    flyer: file-text, logo: sparkle)
  - Titolo (truncato a 50 char)
  - Meta: tipo label + data modifica relativa ("2h fa")
  - Tier badge (se documento creato in free, badge "Free"; se
    unlocked, niente badge o badge "Pro" discreto)
  - Azioni: "Apri", "Duplica", "Elimina" (con confirm)
- **REQ-007`: Click "Apri" naviga all'editor corrispondente:
  - preventivo → `view='editor'` + `setQuote(migrated)`
  - QR → `view='qr'` + `setQrDocument(doc)`
  - card → `view='card'` + `setCardDocument(doc)`
  - flyer → `view='flyer'` + `setFlyerDocument(doc)`
  - logo → `view='logo'` + `setLogoDocument(doc)`
- **REQ-008**: "Duplica" crea nuovo ID, prepone " (copia)" al title,
  apre nell'editor corrispondente.
- **REQ-009**: "Elimina" mostra ConfirmModal, poi chiama
  `deleteDocument(id, email)` + refresh lista.
- **REQ-010**: Stato vuoto: se nessun documento nel tab corrente,
  mostrare placeholder "Nessun documento. Crea il tuo primo <tipo>
  dalla sidebar."
- **REQ-011`: Migration automatica al primo login:
  - Check `localStorage.getItem('pq_migration_v1_done_<email>')`
  - Se non fatto, chiama `migrateLegacyQuotes(email)`
  - Copia ogni quote da `precisionQuote_quotes` (filter by owner)
    a `precisionQuote_documents:v1` con `documentType='quote'` +
    `_premium` embed + nuovo ID (`migrate_<oldid>_<timestamp>`)
  - Set flag `pq_migration_v1_done_<email>='1'`
  - Se fallisce, log error ma NON bloccare l'utente (i preventivi
    restano accessibili via `/quotes` legacy)
- **REQ-012**: `dataService.getQuotes` legacy continua a funzionare
  (legge da `precisionQuote_quotes`), ma `getDocuments` legge da
  `precisionQuote_documents:v1` (post-migrazione). Entrambi
  ritornano preventivi per backward compat.
- **REQ-013`: `dataService.saveDocument` per un preventivo salva in
  `precisionQuote_documents:v1` con `documentType='quote'`. NON
  salva in `precisionQuote_quotes` (nuovi preventivi vanno solo nel
  nuovo storage).
- **REQ-014`: `dataService.saveQuote` legacy è deprecato ma
  funzionante: salva ancora in `precisionQuote_quotes` per utenti
  non ancora migrati. Smetterà di essere chiamato dal frontend dopo
  la fase 6 (solo `saveDocument`).
- **REQ-015**: Performance: liste fino a 100 documenti renderizzate
  senza virtualizzazione. Sopra 100, considerare virtualizzazione in
  v2.
- **SEC-001`: Migration è idempotente: se fallisce a metà, retry non
  duplica (check `_premium.quoteId` per evitare duplicati).
- **SEC-002`: Ownership check: ogni documento letto/modificato deve
  avere `userEmail === email` (o `admin@gmail.com` per admin).
- **CON-001`: Vercel Hobby: nessun endpoint nuovo in questa fase.
- **CON-002`: Migration localStorage client-side, nessun impatto DB.
- **CON-003`: Backward compat per 1 release: endpoint `/quotes` e
  `precisionQuote_quotes` localStorage restano funzionanti.
- **GUD-001`: Seguire `AGENTS.md` "Test — OBBLIGATORI": coverage
  ≥60% per i file modificati.
- **GUD-002`: Seguire `AGENTS.md` "localStorage Schema":
  `pq_migration_v1_done_<email>` è una chiave di stato, non
  versionata (flag boolean).
- **GUD-003`: Seguire skill `vercel-react-best-practices`:
  `React.memo` per le card, lazy-loadCollection (già fatto in
  App.tsx).
- **GUD-004`: Seguire skill `vercel-composition-patterns`: se
  CollectionView cresce troppo, estrarre `CollectionTabs`,
  `CollectionCard`, `CollectionFilters` come compound components.
- **GUD-005`: Seguire skill `web-design-guidelines` per accessibilità
  tablist, keyboard nav, ARIA.
- **GUD-006`: Seguire skill `frontend-design` per il design delle
  card — non "lista generica", ma personalità visiva per tipo.
- **PAT-001`: Pattern tab accessibile:
  ```tsx
  <div role="tablist" aria-label="Tipo documento">
    {TABS.map(t => (
      <button role="tab" aria-selected={active === t.id}
        aria-controls={`panel-${t.id}`} id={`tab-${t.id}`}
        onClick={() => setActive(t.id)}>
        {t.label} <span className="count">{counts[t.id]}</span>
      </button>
    ))}
  </div>
  <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`}>
    {/* cards */}
  </div>
  ```
- **PAT-002`: Pattern migration idempotente:
  ```ts
  async function migrateLegacyQuotes(email) {
    const flag = `pq_migration_v1_done_${email}`;
    if (localStorage.getItem(flag)) return { migrated: 0, skipped: true };
    const legacy = lsGet('precisionQuote_quotes') || [];
    const mine = legacy.filter(q => q.owner === email);
    const docs = lsGet('precisionQuote_documents:v1') || [];
    const existingIds = new Set(docs.map(d => d.id));
    let migrated = 0;
    for (const q of mine) {
      const newId = `migrate_${q.id}_${Date.now()}`;
      if (existingIds.has(newId)) continue;
      docs.push({
        ...q,
        id: newId,
        documentType: 'quote',
        data: null,
        // _premium embed preserved (q._premium)
      });
      migrated++;
    }
    lsSet('precisionQuote_documents:v1', docs);
    localStorage.setItem(flag, '1');
    return { migrated, skipped: false };
  }
  ```
- **PAT-003`: Pattern apertura editor per tipo:
  ```tsx
  function openDocument(doc) {
    switch (doc.documentType) {
      case 'quote': setQuote(migrateFromLegacy(doc)); setView('editor'); break;
      case 'qrCode': setQrDocument(doc); setView('qr'); break;
      case 'businessCard': setCardDocument(doc); setView('card'); break;
      case 'flyer': setFlyerDocument(doc); setView('flyer'); break;
      case 'logo': setLogoDocument(doc); setView('logo'); break;
    }
  }
  ```

## 4. Interfaces & Data Contracts

### `src/components/CollectionView.tsx` (refactor)

```tsx
interface CollectionViewProps {
  activeId?: string;  // highlight current document
  // contesto App (via AppContext) per setView + setQuote + setQrDocument + ecc.
}

type TabId = 'all' | 'quote' | 'qrCode' | 'businessCard' | 'flyer' | 'logo';

const TABS: { id: TabId; label: string; type?: DocumentType }[] = [
  { id: 'all', label: 'Tutti' },
  { id: 'quote', label: 'Preventivi', type: 'quote' },
  { id: 'qrCode', label: 'QR Code', type: 'qrCode' },
  { id: 'businessCard', label: 'Bigliettini', type: 'businessCard' },
  { id: 'flyer', label: 'Volantini', type: 'flyer' },
  { id: 'logo', label: 'Loghi', type: 'logo' },
];

export default function CollectionView({ activeId }: CollectionViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'week' | 'month' | 'year' | 'all'>('all');
  const [sort, setSort] = useState<'updated' | 'created' | 'title' | 'type'>('updated');
  const { documents, loading, error, refresh } = useDocuments();
  // ...filters, sort, render
}
```

### `src/utils/dataService.js` (estensione)

```js
async migrateLegacyQuotes(email) {
  if (IS_LOCAL) {
    const flag = `pq_migration_v1_done_${email}`;
    if (localStorage.getItem(flag)) return { migrated: 0, skipped: true };
    const legacy = lsGet('precisionQuote_quotes') || [];
    const mine = legacy.filter(q => q.owner === email);
    const docs = lsGet('precisionQuote_documents:v1') || [];
    let migrated = 0;
    for (const q of mine) {
      const newId = `migrate_${q.id}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
      docs.push({
        ...q,
        id: newId,
        documentType: 'quote',
        data: null,
      });
      migrated++;
    }
    lsSet('precisionQuote_documents:v1', docs);
    localStorage.setItem(flag, '1');
    return { migrated, skipped: false };
  }
  // In produzione, la migrazione DB è già avvenuta in fase 1 (rename tabella).
  // Qui non facciamo nulla, ma segniamo flag per coerenza.
  localStorage.setItem(`pq_migration_v1_done_${email}`, '1');
  return { migrated: 0, skipped: true };
}
```

### `App.tsx` (estensione)

```ts
useEffect(() => {
  if (user?.email) {
    dataService.migrateLegacyQuotes(user.email).then((result) => {
      if (result.migrated > 0) {
        addToast('success', `${result.migrated} preventivi migrati nel nuovo formato`);
      }
    }).catch((err) => {
      console.error('[Migration] Failed:', err);
      // non bloccare l'utente
    });
  }
}, [user?.email]);
```

### State per documenti non-quote

```ts
// App.tsx aggiunge:
const [qrDocument, setQrDocument] = useState<QRCode | null>(null);
const [cardDocument, setCardDocument] = useState<BusinessCard | null>(null);
const [flyerDocument, setFlyerDocument] = useState<Flyer | null>(null);
const [logoDocument, setLogoDocument] = useState<Logo | null>(null);
```

Ogni editor riceve il documento corrente come prop + setter per
aggiornamenti.

## 5. Acceptance Criteria

- **AC-001`: Given utente con 5 preventivi esistenti (pre-migrazione),
  When logga per la prima volta dopo fase 6, Then migration gira
  automaticamente, toast "5 preventivi migrati", i 5 preventivi
  appaiono in tab "Preventivi" e in tab "Tutti".
- **AC-002`: Given utente già migrato, When logga di nuovo, Then
  migration NON gira (flag check), nessun toast.
- **AC-003`: Given utente con 3 preventivi + 2 QR + 1 bigliettino,
  When apre CollectionView, Then tab "Tutti" mostra 6 card mescolate,
  tab "Preventivi" mostra 3, tab "QR Code" mostra 2, tab "Bigliettini"
  mostra 1.
- **AC-004`: Given ricerca "Acme", When utente digita nella search
  box, Then risultato mostra tutti i documenti con "Acme" in
  qualsiasi campo cercato (titolo, client.name, front.name,
  content.headline, data.payload, builder.primaryText).
- **AC-005`: Given filtro stato "accepted", When utente applica, Then
  solo preventivi con `status='accepted'` appaiono (altri tipi
  nascosti perché non hanno status).
- **AC-006`: Given sort "title A-Z", When utente applica, Then card
  ordinate alfabeticamente per titolo.
- **AC-007`: Given card preventivo, When utente click "Apri", Then
  `view='editor'` + quote caricata nell'editor.
- **AC-008`: Given card QR, When utente click "Apri", Then
  `view='qr'` + QR caricato nell'editor.
- **AC-009`: Given card bigliettino, When utente click "Duplica",
  Then nuovo documento creato con ID nuovo + title " (copia)" +
  aperto nell'editor card.
- **AC-010`: Given card qualsiasi, When utente click "Elimina" +
  conferma, Then documento eliminato + lista refresh + toast
  "Eliminato".
- **AC-011`: Given tab "Loghi" vuoto, When utente apre, Then
  placeholder "Nessun documento. Crea il tuo primo logo dalla
  sidebar."
- **AC-012`: Given utente free con tier badge, When apre "Tutti",
  Then card mostrano badge "Free" per documenti creati in free.
- **AC-013`: Given utente ha 50 documenti, When apre "Tutti", Then
  render senza lag visibile (<500ms).
- **AC-014`: Given utente naviga tab con keyboard (Tab + Enter),
  When arriva a tab "QR Code" e preme Enter, Then tab si attiva.
- **AC-015`: Given migrazione fallisce (mock error), When utente
  logga, Then toast errore "Migrazione non riuscita, i tuoi
  preventivi sono comunque accessibili" + i preventivi sono ancora
  leggibili via tab "Preventivi" (fallback a `getQuotes` legacy).
- **AC-016`: Given `npm run typecheck`, Then code 0.
- **AC-017`: Given `npm run test`, Then code 0 e tutti i nuovi test
  passano.

## 6. Test Automation Strategy

- **Test Levels**: Unit (migration, dataService), Integration
  (CollectionView con documenti mock), E2E (flussi apertura).
- **Frameworks**: Vitest 4, React Testing Library 16, jsdom 29.
- **Test Data Management**: localStorage mockato con documenti di
  test per tipo. Funzione `seedDocuments(email, types[])` helper.
- **Coverage Requirements**: ≥60% per i file modificati.

### File di test da creare

| File | Cosa copre |
|------|-----------|
| `src/utils/__tests__/dataService.migration.test.ts` | `migrateLegacyQuotes` per: nessun preventivo (no-op), 5 preventivi (migrate 5), già migrato (skip), fallimento localStorage (catch + no throw), idempotenza (2 chiamate = 1 migrazione) |
| `src/components/__tests__/CollectionView.tabs.test.tsx` | render 6 tab, click tab filtra, count badge corretto, keyboard nav |
| `src/components/__tests__/CollectionView.search.test.tsx` | ricerca per titolo, per client.name, per front.name, per content.headline, per data.payload, per builder.primaryText, ricerca vuota = no filter, ricerca senza match = empty state |
| `src/components/__tests__/CollectionView.filters.test.tsx` | filtro stato (solo preventivi), filtro data (week/month/year/all), sort 4 modalità |
| `src/components/__tests__/CollectionView.actions.test.tsx` | click Apri per ogni tipo (verifica setView + setDocument), Duplica (nuovo ID + title copiato), Elimina (confirm + deleteDocument + refresh) |
| `src/components/__tests__/CollectionView.empty.test.tsx` | empty state per ogni tab, empty state per ricerca senza match |
| `src/components/__tests__/CollectionView.migration.test.tsx` | integrazione: utente logga con 3 preventivi pre-migrazione, verifica migrazione + toast + visualizzazione |

### Test matrice

| AC | Test file |
|----|-----------|
| AC-001 | CollectionView.migration.test.tsx |
| AC-002 | dataService.migration.test.ts |
| AC-003 | CollectionView.tabs.test.tsx |
| AC-004 | CollectionView.search.test.tsx |
| AC-005 | CollectionView.filters.test.tsx |
| AC-006 | CollectionView.filters.test.tsx |
| AC-007 | CollectionView.actions.test.tsx |
| AC-008 | CollectionView.actions.test.tsx |
| AC-009 | CollectionView.actions.test.tsx |
| AC-010 | CollectionView.actions.test.tsx |
| AC-011 | CollectionView.empty.test.tsx |
| AC-012 | CollectionView.tabs.test.tsx (tier badge) |
| AC-013 | (manuale o performance test) |
| AC-014 | CollectionView.tabs.test.tsx (keyboard) |
| AC-015 | dataService.migration.test.ts (fail + fallback) |
| AC-016 | typecheck |
| AC-017 | test run |

## 7. Rationale & Context

**Perché tab per tipo e non unica lista con filtro tipo**:

Una lista unica con filtro "tipo" nel dropdown sarebbe più compatta ma:
- L'utente deve aprire il dropdown per filtrare (2 click vs 1 click
  tab)
- Il count per tipo non è immediatamente visibile
- Mobile UX: tab sono più touch-friendly di dropdown

Il pattern tab è standard (Gmail, Drive, Notion) per navigazione tra
tipi di contenuto.

**Perché tab "Tutti" come default e non "Preventivi"**:

L'utente medio di PrecisionQuote post-fase 6 ha preventivi + altri
documenti. "Tutti" mostra tutto, l'utente filtra per tipo se serve.
Se default è "Preventivi", l'utente nuovo (che non ha preventivi ma
ha QR) vede empty state e pensa "l'app è vuota".

**Perché migration client-side e non server-side**:

La migrazione DB (rename `quotes` → `documents`) è avvenuta nella fase
1 con `drizzle-kit migrate`. Quella migrazione ha gestito i dati
production-side.

Per localStorage (dev mode), la migrazione è client-side perché:
- I dati sono nel browser dell'utente
- Non c'è un server che può migrarli
- Idempotenza garantita con flag `pq_migration_v1_done_<email>`

Per production, il DB è già migrato, quindi `migrateLegacyQuotes` è
no-op (imposta solo il flag).

**Perché backward compat per 1 release e non drop subito**:

Se un utente ha l'app aperta in una tab vecchia (pre-fase 6) mentre
facciamo deploy, la sua sessione continua a chiamare `/quotes` e
`saveQuote`. Se dropiamo subito, perde il lavoro. Backward compat per
1 release (2-4 settimane) dà tempo a tutti gli utenti di ricaricare
l'app e migrare.

**Perché no virtualizzazione per 100 documenti**:

Virtualizzazione (react-window, react-virtualized) ha costo di setup
e complessità. Per ≤100 card (fase pre-clienti e primi clienti), il
render nativo è <500ms. Sopra 100, aggiungere virtualizzazione in v2.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001`: Nessuna nuova integrazione esterna.

### Third-Party Services
- **SVC-001`: Nessuna nuova dipendenza di servizio.

### Infrastructure Dependencies
- **INF-001`: Vercel Hobby — nessun endpoint nuovo, nessun impatto.
- **INF-002`: Neon Postgres — nessuna migrazione DB in questa fase
  (già fatto in fase 1).

### Data Dependencies
- **DAT-001`: localStorage `precisionQuote_documents:v1` (sorgente
  primaria post-migrazione).
- **DAT-002`: localStorage `precisionQuote_quotes` (sorgente legacy,
  read-only per backward compat).
- **DAT-003`: localStorage `pq_migration_v1_done_<email>` (flag
  booleano).
- **DAT-004`: Tabella DB `documents` (sorgente primaria production).

### Technology Platform Dependencies
- **PLT-001`: React 18 — `useMemo` per filtri/sort, `memo` per card.
- **PLT-002`: localStorage API — `JSON.parse`/`stringify` con
  try/catch (helper `lsGet`/`lsSet` esistenti).

### Compliance Dependencies
- **COM-001`: GDPR — nessun dato nuovo raccolto. Migration non
  trasferisce dati a terzi.
- **COM-002`: WCAG AA — tablist accessibile (ARIA roles, keyboard
  nav).

## 9. Examples & Edge Cases

### Edge case 1: Utente con 50 preventivi pre-migrazione

```ts
// 50 quote in precisionQuote_quotes
// migrateLegacyQuotes: copia 50 in precisionQuote_documents:v1
// localStorage size: 50 * ~5KB = 250KB (sotto 5MB limite)
// toast "50 preventivi migrati"
// Tab "Tutti" mostra 50 card
// Performance: render 50 card <500ms
```

### Edge case 2: Utente con 1000 preventivi (edge estremo)

```ts
// 1000 quote in precisionQuote_quotes
// localStorage size: 1000 * ~5KB = 5MB (al limite)
// migrateLegacyQuotes potrebbe fallire per QuotaExceeded
// → catch, toast "Migrazione non riuscita per limiti di spazio.
//   Usa 'Esporta CSV' per backup, poi elimina vecchi preventivi."
// → i preventivi restano accessibili via /quotes legacy
```

Questo edge case è improbabile per la fase pre-clienti ma va gestito.

### Edge case 3: Ricerca con caratteri speciali

```ts
// search = "Acme & Sons"
// ricerca su title: "Acme & Sons" match
// ricerca su payload con regex: nessun problema (substring match)
// → nessun escape necessario per substring search
```

### Edge case 4: Documento eliminato mentre CollectionView è aperto

```ts
// Utente A apre CollectionView (10 documenti)
// In un'altra tab, elimina un documento via API diretta
// Utente A torna alla tab CollectionView, click "Apri" sul documento
//   eliminato
// → load fallisce (404 dal backend)
// → toast "Documento non trovato, forse eliminato"
// → refresh lista (9 documenti)
```

### Edge case 5: Sort per tipo quando ci sono documenti di tipo diverso

```ts
// sort = 'type'
// ordine: businessCard < flyer < logo < qrCode < quote (alfabetico)
// → card businessCard per prime, quote per ultime
// → utile per raggruppare visivamente
```

### Edge case 6: Tab "Tutti" con 0 documenti

```ts
// utente nuovo, nessun documento
// tab "Tutti" mostra empty state "Nessun documento. Crea il tuo
//   primo dalla sidebar."
// → CTA: link "Crea preventivo" (view='editor'), "Crea QR"
//   (view='qr'), ecc.
```

### Edge case 7: Migration fallisce a metà (5 di 10 preventivi migrati)

```ts
// 10 preventivi in precisionQuote_quotes
// migrateLegacyQuotes: 5 migrati, poi localStorage.setItem fallisce
//   per QuotaExceeded
// → catch, flag NON impostato
// → retry al prossimo login: 5 già migrati (idempotente via ID
//   check), altri 5 migrati
// → alla fine, 10 documenti in precisionQuote_documents:v1, alcuni
//   con ID `migrate_<oldid>_<timestamp1>` altri con timestamp2
```

L'idempotenza è critica: il check `existingIds.has(newId)` previene
duplicati. Ma se il calcolo di `newId` è random (`Date.now() + Math.random`),
due run possono generare ID diversi per lo stesso quote. Per vera
idempotenza, usare `migrate_<oldid>` (senza timestamp/random):
```ts
const newId = `migrate_${q.id}`;
if (existingIds.has(newId)) continue; // già migrato
```

Questo è un fix importante nel pattern PAT-002: rimuovere timestamp
da newId per idempotenza vera.

## 10. Validation Criteria

Prima di considerare la fase 6 completata, verificare:

1. `npm run typecheck` code 0.
2. `npm run test` code 0, tutti i nuovi test passano.
3. `git diff src/components/CollectionView.tsx` mostra:
   - Tab list con 6 tab + count badge
   - Ricerca + filtri + sort
   - Card per-tipo con icona + tier badge
   - Azioni Apri/Duplica/Elimina
   - Empty state
4. `git diff src/utils/dataService.js` mostra
   `migrateLegacyQuotes(email)`.
5. `git diff App.tsx` mostra:
   - useEffect per `migrateLegacyQuotes` al login
   - State per `qrDocument`, `cardDocument`, `flyerDocument`,
     `logoDocument`
   - `openDocument(doc)` helper che dispatcha per tipo
6. `git status` mostra i nuovi file:
   - `src/utils/__tests__/dataService.migration.test.ts`
   - `src/components/__tests__/CollectionView.tabs.test.tsx`
   - `src/components/__tests__/CollectionView.search.test.tsx`
   - `src/components/__tests__/CollectionView.filters.test.tsx`
   - `src/components/__tests__/CollectionView.actions.test.tsx`
   - `src/components/__tests__/CollectionView.empty.test.tsx`
   - `src/components/__tests__/CollectionView.migration.test.tsx`
7. Manuale: `npm run dev`, login con utente esistente (che ha
   preventivi), verificare toast migrazione + visualizzazione in
   CollectionView.
8. Manuale: creare un documento per tipo (QR, card, flyer, logo),
   verificare che appaiono in tab "Tutti" e nel tab specifico.
9. Manuale: test ricerca "Acme" con documenti Acme in più tipi,
   verificare match cross-tipo.
10. Manuale: test keyboard nav tra tab (Tab + Enter + Esc).
11. Manuale: test migrazione idempotente — ricaricare la pagina,
    verificare nessun toast "migrato" la seconda volta.
12. Manuale: test fallback migrazione — simulare errore (rimuovere
    localStorage manualmente), verificare toast errore + preventivi
    ancora accessibili via tab "Preventivi" (che chiama `getQuotes`
    legacy).

## 11. Related Specifications / Further Reading

- `spec/spec-process-phase0-autosave-fix.md` — auto-save
- `spec/spec-tool-phase1-qr-code.md` — endpoint `/documents` usato
  qui
- `spec/spec-design-phase2-business-card.md` — `documentType='businessCard'`
- `spec/spec-design-phase3-flyer.md` — `documentType='flyer'`
- `spec/spec-tool-phase4-logo-builder.md` — `documentType='logo'`
- `spec/spec-data-phase5-tier-system.md` — tier badge nelle card
- `spec/spec-process-phase7-polish.md` — aggiornare README con
  nuova struttura CollectionView
- `AGENTS.md` — sezioni "localStorage Schema", "Test — OBBLIGATORI"
- `README.md` — sezione "Funzionalità" (Collection entry da
  aggiornare in fase 7)
- `DESIGN.md` — `Collection card` component (spec da aggiornare in
  fase 7)
- Skill `vercel-react-best-practices` — memo card, lazy
- Skill `vercel-composition-patterns` — compound components se
  CollectionView cresce
- Skill `web-design-guidelines` — tablist accessibile
- Skill `frontend-design` — design delle card per tipo

### Prossima fase

Dopo il completamento della fase 6, procedere con
`spec/spec-process-phase7-polish.md` (Onboarding, HomePage, docs
update).
