---
title: Phase 1 — QR Code generator
version: 1.0
date_created: 2026-06-21
owner: Giovanni Cidu
tags: [tool, qr, client-side, pdf, schema, migration, watermark-pending]
---

# Introduction

La fase 1 introduce il primo nuovo tipo di documento dopo i preventivi:
il QR Code. È la feature più semplice delle 4 (QR, bigliettino, volantino,
logo) e serve da rampa per validare l'architettura multi-documento prima
di attaccare le feature più complesse. In questa fase si introduce anche
la migrazione Drizzle che rinomina `quotes` in `documents` con la colonna
`document_type`, e il nuovo endpoint API `/documents`.

Il QR è generato client-side con la libreria `qrcode` (~50KB), nessun
backend richiesto per la generazione. Il salvataggio usa il nuovo
endpoint `/documents` con `documentType: 'qrCode'`.

Il watermark e il tier system vengono applicati nella fase 5; in questa
fase l'export è full quality per tutti gli utenti loggati.

## 1. Purpose & Scope

**Purpose**: permettere all'utente di generare QR Code personalizzati
(URL, vCard, WiFi, ecc.) con anteprima live, salvataggio in collection,
ed export PNG/SVG. Introdurre l'architettura multi-documento e la
migrazione del database.

**Scope**:
- Nuovo file `src/utils/documentSchemas.ts` con `qrCodeSchema` + helper
- Nuovo file `src/utils/qrGenerator.ts` con `generateQrSvg`,
  `generateQrPng`, `buildQrPayload`
- Nuovo componente `src/components/QREditor.tsx`
- Nuova voce sidebar "QR Code" in `src/components/Layout.tsx`
- Nuova voce nel `view` state di `App.tsx`: `'qr'`
- Migrazione Drizzle: `db/schema.ts` + `api/index.ts` (schema inline)
  rinominano `quotes` → `documents`, aggiungono `document_type` + `data`
- Nuovi endpoint in `api/index.ts`: `GET/POST/DELETE /documents`
- Estensione `src/utils/dataService.js`: `saveDocument`,
  `getDocuments`, `deleteDocument`
- Template Giovanni pre-popolato con `https://webdeveloperca.netlify.app/`

**Out of scope**:
- Watermark e tier system (fase 5)
- QR dinamici con short-url e statistiche (out of scope v2)
- Integrazione del QR dentro bigliettino e volantino (fasi 2 e 3)
- Modifica al `CollectionView` (fase 6)

**Intended audience**: sviluppatore che implementa il QR + la migrazione
DB; reviewer che verifica i test.

**Assumptions**:
- La migrazione `quotes` → `documents` è backward compatible: i
  preventivi esistenti continuano a usare i campi `options`/`clauses`
  legacy, con `document_type='quote'` e `data=null`.
- L'endpoint `/quotes` esistente resta funzionante per 1 release (deprecato).

## 2. Definitions

- **Document**: entità generica salvata in tabella `documents`,
  discriminata dalla colonna `document_type`.
- **DocumentType**: enum `'quote' | 'qrCode' | 'businessCard' | 'flyer' | 'logo'`.
- **QR payload**: stringa codificata nel QR, formato dipendente dal
  `data.type` (URL grezzo per `url`, `mailto:` per `email`, `tel:` per
  `phone`, `MATMSG:` per `sms`, `BEGIN:VCARD...END:VCARD` per `vcard`,
  `WIFI:` per `wifi`).
- **Error correction**: livello di ridondanza del QR (`L` 7%, `M` 15%,
  `Q` 25%, `H` 30%). Default `M`.
- **Dot style**: stile dei moduli del QR (`square`, `rounded`, `dots`).
  Default `rounded`.
- **Logo overlay**: immagine base64 opzionale centrata sul QR (max 20%
  dell'area, altrimenti illeggibile).

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: L'utente può creare un QR partendo da vuoto o dal
  template Giovanni pre-popolato.
- **REQ-002**: L'editor espone 7 tipi di payload: `url`, `text`,
  `email`, `phone`, `vcard`, `wifi`, `sms`.
- **REQ-003**: Per ogni tipo, l'editor mostra i campi appropriati:
  - `url`: 1 input (URL con validazione `^https?://`)
  - `text`: 1 textarea (max 500 caratteri)
  - `email`: 2 input (email + subject opzionale)
  - `phone`: 1 input (validazione formato internazionale `+39...`)
  - `vcard`: 6 input (nome, cognome, organizzazione, ruolo, telefono, email)
  - `wifi`: 3 input (SSID, password, encryption `WPA|WEP|nopass`)
  - `sms`: 2 input (numero + messaggio)
- **REQ-004**: L'anteprima si aggiorna live (debounce 300ms) ad ogni
  modifica dei campi.
- **REQ-005**: L'utente può configurare stile: `errorCorrection`
  (4 livelli), `fgColor`, `bgColor` (con contrast check WCAG AA),
  `size` (128-2048px, slider), `margin` (0-16, slider), `dotStyle`
  (3 stili), `logoOverlay` (drop image, max 100KB, resize client-side
  a 20% dell'area QR).
- **REQ-006**: Export PNG (alla `size` scelta) e SVG (vettoriale
  scalabile) tramite 2 bottoni sotto l'anteprima.
- **REQ-007**: Salvataggio in collection tramite `dataService.saveDocument`
  con `documentType: 'qrCode'`.
- **REQ-008**: Auto-save riusa il meccanismo della fase 0 con
  `isProcessing` (QR non usa AI processing, ma l'auto-save silenzioso
  si applica comunque se l'utente edita).
- **SEC-001**: Validazione URL con `new URL()` + protocollo
  `http:` o `https:`. Rifiutare `javascript:`, `data:`, `file:`.
- **SEC-002**: Logo overlay sanitizzato: solo `data:image/png` o
  `data:image/jpeg` o `data:image/svg+xml`. Rifiutare altri MIME.
- **SEC-003**: Nessun QR payload con PII sensitivo (password WiFi in
  chiaro) viene loggato. Il logger client filtra `wifi` payloads.
- **CON-001**: Libreria `qrcode` ^1.5.4 aggiunta a `package.json`
  dependencies. Costo bundle ~50KB gzipped.
- **CON-002**: Vercel Hobby plan: nessun endpoint AI nuovo, nessun
  timeout >10s.
- **CON-003**: Migrazione Drizzle NON distruttiva: `ALTER TABLE quotes
  RENAME TO documents; ALTER TABLE documents ADD COLUMN document_type
  VARCHAR(30) NOT NULL DEFAULT 'quote'; ALTER TABLE documents ADD
  COLUMN data jsonb;`
- **CON-004**: Schema DB in `db/schema.ts` e inline in `api/index.ts`
  (righe 38-58) aggiornato in parallelo (regola AGENTS.md "API Schema
  Duplication").
- **GUD-001**: Seguire `AGENTS.md` sezione "Vercel Routing — CRITICAL":
  non aggiungere file in `api/`, tutto inline in `api/index.ts`.
- **GUD-002**: Seguire `AGENTS.md` sezione "localStorage Schema":
  nuove chiavi versionate. Usare `precisionQuote_documents:v1` per i
  nuovi documenti (QR, card, flyer, logo). I preventivi esistenti
  restano in `precisionQuote_quotes` per backward compat.
- **GUD-003**: Seguire `AGENTS.md` sezione "Test — OBBLIGATORI":
  nuovo codice → nuovi test. Coverage ≥60% per i nuovi file.
- **GUD-004**: Seguire skill `vercel-react-best-practices`:
  `React.memo` per il preview SVG, lazy-load `QREditor` in `App.tsx`.
- **GUD-005**: Seguire skill `web-design-guidelines` per accessibilità:
  contrasto minimo 4.5:1 tra fg e bg, label per tutti gli input,
  focus visibile.
- **GUD-006**: Seguire skill `web-security` per validazione input e
  sanitizzazione del logo overlay.
- **PAT-001**: Pattern discriminated union per `documentSchemas.ts`:
  ```ts
  export const documentTypeSchema = z.enum(['quote', 'qrCode', 'businessCard', 'flyer', 'logo']);
  export const qrCodeSchema = z.object({
    documentType: z.literal('qrCode'),
    // ...campi
  });
  ```
- **PAT-002**: Pattern lazy-load in `App.tsx`:
  ```ts
  const QREditor = lazy(() => import('./src/components/QREditor'));
  ```
- **PAT-003**: Pattern debounce per anteprima live: `useDebouncedValue`
  con 300ms (implementazione custom, no lodash).
- **PAT-004**: Pattern file-type allowlist per upload:
  ```ts
  const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/svg+xml'];
  if (!ALLOWED_MIME.includes(file.type)) throw new Error('Formato non supportato');
  ```

## 4. Interfaces & Data Contracts

### Schema `src/utils/documentSchemas.ts`

```ts
import { z } from 'zod';

export const documentTypeSchema = z.enum([
  'quote', 'qrCode', 'businessCard', 'flyer', 'logo'
]);
export type DocumentType = z.infer<typeof documentTypeSchema>;

export const qrCodeSchema = z.object({
  documentType: z.literal('qrCode'),
  id: z.string(),
  title: z.string().default(''),
  data: z.object({
    type: z.enum(['url', 'text', 'email', 'phone', 'vcard', 'wifi', 'sms']),
    payload: z.string(),
  }),
  style: z.object({
    errorCorrection: z.enum(['L', 'M', 'Q', 'H']).default('M'),
    fgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#000000'),
    bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#FFFFFF'),
    size: z.number().min(128).max(2048).default(512),
    margin: z.number().min(0).max(16).default(2),
    logoOverlay: z.string().nullable().default(null),
    dotStyle: z.enum(['square', 'rounded', 'dots']).default('rounded'),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type QRCode = z.infer<typeof qrCodeSchema>;

export function createEmptyQrCode(): QRCode {
  const now = new Date().toISOString();
  return {
    documentType: 'qrCode',
    id: `qr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: 'QR Code',
    data: { type: 'url', payload: '' },
    style: {
      errorCorrection: 'M', fgColor: '#000000', bgColor: '#FFFFFF',
      size: 512, margin: 2, logoOverlay: null, dotStyle: 'rounded',
    },
    createdAt: now, updatedAt: now,
  };
}

export function createGiovanniQrTemplate(): QRCode {
  return {
    ...createEmptyQrCode(),
    title: 'QR personale — Giovanni',
    data: { type: 'url', payload: 'https://webdeveloperca.netlify.app/' },
  };
}
```

### Generatore `src/utils/qrGenerator.ts`

```ts
import QRCode from 'qrcode';

export function buildQrPayload(data: QRCode['data']): string {
  switch (data.type) {
    case 'url': return data.payload;
    case 'text': return data.payload;
    case 'email': {
      const [email, subject] = data.payload.split('|');
      return `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
    }
    case 'phone': return `tel:${data.payload}`;
    case 'sms': {
      const [number, message] = data.payload.split('|');
      return `SMSTO:${number}:${message || ''}`;
    }
    case 'vcard': return data.payload; // già formattato BEGIN:VCARD...
    case 'wifi': {
      const [ssid, password, encryption] = data.payload.split('|');
      return `WIFI:T:${encryption};S:${ssid};P:${password};;`;
    }
  }
}

export async function generateQrSvg(qr: QRCode): Promise<string> {
  return QRCode.toString(buildQrPayload(qr.data), {
    type: 'svg',
    errorCorrectionLevel: qr.style.errorCorrection,
    margin: qr.style.margin,
    color: { dark: qr.style.fgColor, light: qr.style.bgColor },
  });
}

export async function generateQrPng(qr: QRCode): Promise<Uint8Array> {
  return QRCode.toBuffer(buildQrPayload(qr.data), {
    type: 'png',
    errorCorrectionLevel: qr.style.errorCorrection,
    margin: qr.style.margin,
    width: qr.style.size,
    color: { dark: qr.style.fgColor, light: qr.style.bgColor },
  });
}

export function validateQrContrast(fg: string, bg: string): boolean {
  // WCAG AA: contrast ratio ≥ 4.5
  const fgRgb = hexToRgb(fg);
  const bgRgb = hexToRgb(bg);
  const l1 = relativeLuminance(fgRgb);
  const l2 = relativeLuminance(bgRgb);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return ratio >= 4.5;
}
```

### Endpoint API `api/index.ts` (estensione)

```ts
// GET /documents?email=...&type=...
// POST /documents body: { email, document: QRCode }
// DELETE /documents/:id body: { email }
```

I nuovi endpoint convivono con `/quotes` esistente (deprecato).

### `dataService.js` (estensione)

```js
async saveDocument(email, document) {
  if (IS_LOCAL) {
    const all = lsGet('precisionQuote_documents:v1') || [];
    const updated = [document, ...all.filter(d => d.id !== document.id)];
    lsSet('precisionQuote_documents:v1', updated);
    return { success: true, data: document };
  }
  return api('POST', '/documents', { email, document });
}

async getDocuments(email, documentType) {
  if (IS_LOCAL) {
    const all = lsGet('precisionQuote_documents:v1') || [];
    return { documents: all.filter(d => !documentType || d.documentType === documentType) };
  }
  return api('GET', `/documents?email=${email}&type=${documentType || ''}`);
}

async deleteDocument(id, email) { /* spec simile a deleteQuote */ }
```

### Sidebar `Layout.tsx`

Nuova voce "QR Code" con icona SVG QR (4 quadrati), chiama
`setView('qr')`.

### `App.tsx` — view state

```ts
const [view, setView] = useState<'editor' | 'qr' | 'collection' | 'settings' | 'admin'>('editor');
```

Render condizionale: `view === 'qr'` → `<Suspense><QREditor /></Suspense>`.

## 5. Acceptance Criteria

- **AC-001**: Given utente loggato, When click su "QR Code" nella
  sidebar, Then `QREditor` viene renderizzato con un QR vuoto
  (`createEmptyQrCode`).
- **AC-002**: Given utente loggato per la prima volta, When apre il QR
  editor, Then vede un banner "Usa template personale" che, se cliccato,
  carica `createGiovanniQrTemplate()` con URL
  `https://webdeveloperca.netlify.app/`.
- **AC-003**: Given QR con `data.type='url'` e
  `data.payload='https://example.com'`, When l'utente cambia tipo in
  `email`, Then i campi si resettano e `payload` diventa `''`.
- **AC-004**: Given QR con `data.type='wifi'`, When l'utente compila
  SSID+password+WPA, Then `buildQrPayload` ritorna
  `WIFI:T:WPA;S:<ssid>;P:<password>;;`.
- **AC-005**: Given QR con fgColor `#000000` e bgColor `#FFFFFF`, When
  l'utente cambia fgColor in `#eeeeee`, Then appare un warning
  "Contrasto insufficiente (WCAG AA non soddisfatto)" ma il QR viene
  comunque generato.
- **AC-006**: Given QR valido, When l'utente click "Scarica PNG", Then
  viene scaricato un file `qr_<id>.png` alla `size` configurata.
- **AC-007**: Given QR valido, When l'utente click "Scarica SVG", Then
  viene scaricato un file `qr_<id>.svg` vettoriale.
- **AC-008**: Given QR modificato, When l'auto-save silenzioso fire
  (30s), Then `dataService.saveDocument` viene chiamato con il QR
  corrente (no suffisso nel titolo, vedi fase 0).
- **AC-009**: Given utente loggato, When click "Salva" nella Topbar,
  Then `SaveDialog` si apre con default name = `qr.title`.
- **AC-010**: Given utente non loggato, When tenta di accedere a
  `/app` con `view='qr'`, Then `ProtectedRoute` reindirizza a `/login`.
- **AC-011**: Given migrazione Drizzle applicata, When l'API riceve
  `POST /documents` con `documentType='qrCode'`, Then la riga viene
  inserita in tabella `documents` con `document_type='qrCode'` e
  `data` jsonb popolato.
- **AC-012**: Given preventivo esistente (pre-migrazione), When
  l'utente logga, Then il preventivo è leggibile via endpoint
  `/quotes` (legacy) e appare ancora in CollectionView.
- **AC-013**: Given logo overlay upload di un file `.exe`, When l'utente
  rilascia il file, Then appare errore "Formato non supportato. Usa PNG,
  JPEG o SVG." e il file NON viene processato.
- **AC-014**: Given `npm run typecheck`, When eseguito, Then code 0.
- **AC-015**: Given `npm run test`, When eseguito, Then code 0 e tutti
  i nuovi test passano.

## 6. Test Automation Strategy

- **Test Levels**: Unit (schema, generator, dataService),
  Integration (componente EditorView con preview), Contract (API).
- **Frameworks**: Vitest 4, React Testing Library 16, jsdom 29.
- **Test Data Management**: localStorage mockato con `vi.spyOn` su
  `Storage.prototype`. Nessun DB reale.
- **CI/CD Integration**: pre-push checklist AGENTS.md.
- **Coverage Requirements**: ≥60% per i nuovi file.

### File di test da creare

| File | Cosa copre |
|------|-----------|
| `src/utils/__tests__/documentSchemas.test.ts` | parse OK per `qrCodeSchema`, rifiuto tipo sbagliato, default values, helper `createEmptyQrCode` e `createGiovanniQrTemplate` |
| `src/utils/__tests__/qrGenerator.test.ts` | `buildQrPayload` per ogni tipo (7 casi), `generateQrSvg` ritorna SVG valido, `generateQrPng` ritorna buffer PNG, `validateQrContrast` con 3 casi (pass, fail, edge) |
| `src/utils/__tests__/dataService.documents.test.ts` | `saveDocument`/`getDocuments`/`deleteDocument` con localStorage mockato, filter per `documentType` |
| `src/components/__tests__/QREditor.test.tsx` | render iniziale con QR vuoto, click template Giovanni, cambio tipo resetta payload, validazione URL, export PNG/SVG (mock `URL.createObjectURL`), upload logo overlay (mock `FileReader`) |
| `api/__tests__/documents.test.ts` (nuova cartella) | endpoint `GET/POST/DELETE /documents` con DB mockato, validazione Zod, ownership check |
| `src/__tests__/migration.test.ts` (regressione migrazione) | la migrazione `quotes → documents` mantiene i dati esistenti (legge una riga `quotes` pre-migrazione e verifica che sia leggibile come `documents` con `document_type='quote'` post-migrazione) |

### Test matrice

| AC | Test file |
|----|-----------|
| AC-001 | QREditor.test.tsx |
| AC-002 | QREditor.test.tsx |
| AC-003 | QREditor.test.tsx |
| AC-004 | qrGenerator.test.ts |
| AC-005 | QREditor.test.tsx + qrGenerator.test.ts |
| AC-006 | QREditor.test.tsx |
| AC-007 | QREditor.test.tsx |
| AC-008 | QREditor.test.tsx (con fake timers) |
| AC-009 | QREditor.test.tsx |
| AC-010 | integration con ProtectedRoute (già esistente) |
| AC-011 | documents.test.ts |
| AC-012 | migration.test.ts |
| AC-013 | QREditor.test.tsx |
| AC-014 | typecheck |
| AC-015 | test run |

## 7. Rationale & Context

**Perché QR è la prima feature non preventivo**:

Il QR è la feature più semplice delle 4: 1 schema, 1 generatore, 1
componente, 0 chiamate AI, 0 upload complessi. Introduce però tutta
l'architettura multi-documento (schema union, endpoint `/documents`,
migrazione DB, nuova voce sidebar, lazy-load). Farla prima significa
validare questa architettura sul caso più semplice prima di attaccare
bigliettino (upload foto), volantino (AI copy), logo (SVG builder
complesso).

**Perché migrazione `quotes → documents` ora e non dopo**:

La migrazione è un momento di rischio. Farla nella fase 1 (feature
piccola) significa che se qualcosa si rompe, il blast radius è limitato
alla feature QR. Se la facessimo nella fase 5 (tier system) con già 4
feature sopra, un problema alla migrazione bloccherebbe tutto.

**Perché endpoint `/documents` e non riusare `/quotes`**:

`/quotes` ha uno schema di validazione Zod specifico per i preventivi
(campi `options`, `clauses`, `vat`, ecc.). Un QR non ha questi campi.
Riusare `/quotes` richiederebbe di rendere tutti i campi opzionali,
indebolendo la validazione per i preventivi. Un endpoint separato
`/documents` con validazione dispatch su `document_type` è più pulito.

**Perché `qrcode` e non `qrcode.react`**:

`qrcode` è la libreria low-level che `qrcode.react` stessa usa
internamente. Usarla direttamente dà controllo completo su SVG vs PNG,
error correction, dot style (via opzioni custom), e riduce il bundle di
~20KB rispetto al wrapper React.

**Perché `precisionQuote_documents:v1` e non estendere `precisionQuote_quotes`**:

La chiave localStorage `precisionQuote_quotes` ha un formato legacy
flat (vedi `quoteAdapter.ts`). Estenderla per contenere QR/logo/cards
richiederebbe di mockare tutti i campi legacy (`options`, `clauses`,
`vat`) per documenti che non li hanno. Una chiave separata versionata
`v1` è più pulita e segue la regola AGENTS.md "localStorage Schema".

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: Nessuna nuova integrazione esterna (generazione
  client-side).

### Third-Party Services
- **SVC-001**: Nessuna nuova dipendenza di servizio.

### Infrastructure Dependencies
- **INF-001**: Vercel Hobby plan — 3 nuovi endpoint inline in
  `api/index.ts`, sotto il limite 12-function.
- **INF-002**: Neon Postgres free tier — 1 nuova migrazione, nessun
  costo aggiuntivo.

### Data Dependencies
- **DAT-001**: localStorage key `precisionQuote_documents:v1` (nuova).
- **DAT-002**: localStorage key `precisionQuote_quotes` (esistente,
  read-only in questa fase per backward compat).
- **DAT-003**: Tabella DB `documents` (rinominata da `quotes`) con
  nuove colonne `document_type`, `data`.

### Technology Platform Dependencies
- **PLT-001**: `qrcode` ^1.5.4 (npm) — libreria Node/browser, nessun
  worker, nessun WASM. Compatibile Vite 5.
- **PLT-002**: React 18 — `lazy()` + `Suspense` per il lazy-load di
  `QREditor`.
- **PLT-003**: Drizzle ORM 1.0-beta — `ALTER TABLE` supportato via
  `drizzle-kit migrate`.

### Compliance Dependencies
- **COM-001**: WCAG AA contrast 4.5:1 per QR leggibili (accessibilità).
- **COM-002**: GDPR — i QR vCard contengono PII. Nessun log del
  payload. Logger client filtra `wifi` e `vcard`.

## 9. Examples & Edge Cases

### Edge case 1: URL senza protocollo

```ts
// Input: "example.com"
// Validazione: new URL("example.com") throw → errore "URL non valido.
// Includi http:// o https://"
```

### Edge case 2: vCard con caratteri speciali

```ts
// Input: nome "Müller & Sons"
// buildQrPayload deve escapare: "Müller & Sons" → "M\üller \& Sons"
// (vCard 3.0 escape rules: \; \, \: \\\n)
```

Il generatore deve applicare l'escape vCard 3.0 su nome, organizzazione,
ruolo. Implementare `escapeVcard(value)` in `qrGenerator.ts`.

### Edge case 3: WiFi con SSID che contiene `;`

```ts
// SSID "My;Network" → WIFI:T:WPA;S:My\;Network;P:password;;
// Escape: \; \\\:
```

### Edge case 4: Logo overlay troppo grande

```ts
// File 2MB → resize client-side a 20% area QR (es. 100x100px su 512x512)
// Se dopo resize >100KB base64 → reject "Logo troppo pesante anche
// dopo compressione. Usa un'immagine più semplice."
```

### Edge case 5: fg e bg uguali

```ts
// fgColor=#000000, bgColor=#000000 → contrast ratio 1.0 → warning
// "Contrasto insufficiente" ma QR generato anyway (utente può volerlo
// per scopi artistici). Validazione soft, non hard fail.
```

### Edge case 6: Payload troppo lungo per error correction H

```ts
// URL lungo 2000 caratteri con errorCorrection='H' (30% redundancy)
// → QRCode.toBuffer throw "too big for EC level H"
// → catch e mostra errore "Payload troppo lungo. Riduci a <N> caratteri
// oppure abbassa error correction a M o L."
// Calcolo N dinamico in base al tipo e EC level.
```

## 10. Validation Criteria

Prima di considerare la fase 1 completata, verificare:

1. `npm run typecheck` code 0.
2. `npm run test` code 0, tutti i nuovi test passano.
3. `npm run db:generate` produce una migration `*_rename_quotes_to_documents/`
   con `ALTER TABLE quotes RENAME TO documents` + 2 `ADD COLUMN`.
4. `npm run db:migrate` (con `DATABASE_URL` di test) applica la
   migration senza errori.
5. `git diff db/schema.ts` mostra `documentsTable` rinominata con
   nuove colonne.
6. `git diff api/index.ts` mostra lo schema inline aggiornato (righe
   ~38-58) + nuovi handler `handleDocuments` per `GET/POST/DELETE /documents`.
7. `git diff src/components/Layout.tsx` mostra nuova voce sidebar
   "QR Code".
8. `git diff App.tsx` mostra `view` state con `'qr'` + render
   condizionale con `Suspense` + `lazy(QREditor)`.
9. `git diff package.json` mostra `"qrcode": "^1.5.4"` in dependencies.
10. `git status` mostra i nuovi file:
    - `src/utils/documentSchemas.ts`
    - `src/utils/qrGenerator.ts`
    - `src/components/QREditor.tsx`
    - `src/utils/__tests__/documentSchemas.test.ts`
    - `src/utils/__tests__/qrGenerator.test.ts`
    - `src/utils/__tests__/dataService.documents.test.ts`
    - `src/components/__tests__/QREditor.test.tsx`
    - `api/__tests__/documents.test.ts`
    - `src/__tests__/migration.test.ts`
    - `drizzle/<timestamp>_rename_quotes_to_documents/` (migration files)
11. Manuale: avviare `npm run dev`, loggare, click "QR Code", verificare
    anteprima live, export PNG e SVG, salvataggio in collection.

## 11. Related Specifications / Further Reading

- `spec/spec-process-phase0-autosave-fix.md` — fix auto-save (deve
  essere completata prima di questa)
- `spec/spec-design-phase2-business-card.md` — userà lo stesso schema
  pattern e lo stesso endpoint `/documents`
- `spec/spec-data-phase5-tier-system.md` — aggiungerà watermark e
  tier check ai generatori (incluso `qrGenerator`)
- `spec/spec-architecture-phase6-unified-collection.md` — mostrerà
  i QR salvati nel CollectionView unificato
- `AGENTS.md` — sezioni "Vercel Routing", "API Schema Duplication",
  "localStorage Schema", "Test — OBBLIGATORI"
- `README.md` — sezione "Schema Database" (da aggiornare dopo
  migrazione, fase 7)
- `REQUIREMENTS.md` — sezione "Dati localStorage" (da aggiornare)
- Skill `vercel-react-best-practices` — performance React
- Skill `web-design-guidelines` — accessibilità
- Skill `web-security` — validazione input
- Skill `test-driven-development` — disciplina TDD

### Prossima fase

Dopo il completamento della fase 1, procedere con
`spec/spec-design-phase2-business-card.md` (Bigliettino da visita).
