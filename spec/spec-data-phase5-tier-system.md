---
title: Phase 5 — Tier system free+watermark+unlock code
version: 1.0
date_created: 2026-06-21
owner: Giovanni Cidu
tags: [data, tier, watermark, unlock-code, freemium, retention, migration, admin]
---

# Introduction

La fase 5 introduce il modello freemium per trattenere gli utenti e
monetizzare i pacchetti branding. Tre livelli: free senza account, free
con account (con watermark e limiti), unlocked (pacchetto sbloccato via
codice). L'admin genera codici manualmente dalla dashboard; in v2
arriverà Stripe per automazione.

Il watermark è applicato a tutti i generatori PDF/PNG (QR, bigliettino,
volantino, logo) tramite un parametro `tier`. Per utenti free:
watermark testuale diagonale + footer, risoluzione PDF 150 DPI max,
PNG 72 DPI max. Per unlocked: full quality.

La fase 5 è la più complessa delle 8 perché tocca: schema DB (2 nuove
colonne su `user_settings` + nuova tabella `unlock_codes`), 5 endpoint
API nuovi, 4 generatori PDF/PNG da modificare, UI SettingsPage per
redeem codice, UI AdminDashboard per generazione codici, e UI per
limite documenti free (modale di blocco + CTA).

## 1. Purpose & Scope

**Purpose**: trasformare l'app da "tutto gratis per tutti" a
"free+watermark+unlock", per trattenere gli utenti (possono provare
tutto prima di pagare) e monetizzare i pacchetti branding.

**Scope**:
- Migrazione Drizzle: aggiunta `tier`, `unlock_code`, `unlocked_at`,
  `document_count` a `user_settings` + nuova tabella `unlock_codes`
- Estensione `db/schema.ts` e `api/index.ts` (schema inline, righe
  ~60-70)
- Estensione `src/utils/dataService.js`: `redeemUnlockCode(email,
  code)`, `getUserTier(email)`, `incrementDocumentCount(email)`,
  admin: `generateUnlockCode(package)`, `listUnlockCodes()`
- Nuovi endpoint in `api/index.ts`:
  - `POST /users/redeem-code`
  - `POST /admin/generate-unlock-code` (adminEmail required)
  - `GET /admin/unlock-codes` (adminEmail required)
  - `PATCH /users/document-count` (internal, chiamato da saveDocument)
  - `GET /users/tier?email=...` (per il frontend check)
- Estensione `src/utils/qrGenerator.ts`: parametro `tier` in
  `generateQrPng`
- Estensione `src/utils/cardGenerator.ts`: parametro `tier` in
  `generateCardPDF`, `generateCardPng`
- Estensione `src/utils/flyerGenerator.ts`: parametro `tier` in
  `generateFlyerPDF`, `generateFlyerPng`
- Estensione `src/utils/logoGenerator.ts`: parametro `tier` in
  `svgToPng`
- Nuovo file `src/utils/watermark.ts` con `applyWatermarkToPdf(doc,
  tier)`, `applyWatermarkToCanvas(ctx, tier)`, `getDpiForTier(tier,
  default)`
- Estensione `src/components/SettingsPage.tsx`: sezione "Il mio
  account" con stato tier + form inserimento codice
- Estensione `src/pages/AdminDashboard.tsx`: tab "Codici sblocco" con
  generazione e lista
- Estensione `App.tsx`: `tier` state + propagazione a tutti gli editor
- Estensione `src/components/EditorView.tsx` (preventivi): aggiungere
  watermark ai PDF preventivi? Deciso: NO, i preventivi sono full
  quality per tutti (non sono un deliverable stampabile, sono un
  documento commerciale). Il tier si applica solo a QR, card, flyer,
  logo.
- Nuovo componente `src/components/TierLimitModal.tsx`: modale che
  appare quando free utente tenta di salvare il 4° documento

**Out of scope**:
- Stripe integration — out of scope v2
- Tier `pro` o `enterprise` — solo `free` e `unlocked` in v1
- Watermark sui preventivi — i preventivi sono documento commerciale,
  non deliverable
- Tier per admin — admin ha sempre unlocked implicito

**Intended audience**: sviluppatore che implementa il tier system;
reviewer che verifica i test, in particolare i casi di edge per il
watermark e il redeem codice.

**Assumptions**:
- Tutte le fasi 1-4 sono completate (generatori PDF/PNG esistono con
  parametro `tier` già accettato ma no-op).
- `AdminDashboard.tsx` esistente è estensibile (ha già tab users,
  quotes, deepseek-status).
- L'admin `admin@gmail.com` ha tier implicito `unlocked` (non ha
  `user_settings` row per FK constraint, vedi AGENTS.md).

## 2. Definitions

- **Tier**: livello utente, valori `'free'` (default) o `'unlocked'`.
- **Free tier**: utente con account, può creare/salvare max 3
  documenti, export con watermark e risoluzione ridotta.
- **Unlocked tier**: utente che ha riscattato un codice pacchetto,
  documenti illimitati, export full quality senza watermark.
- **Watermark**: pattern diagonale "PRECISIONQUOTE" semi-trasparente
  (10% opacity) + footer "Crea il tuo con PrecisionQuote ·
  precisionquote.vercel.app" in ogni pagina PDF.
- **Unlock code**: stringa UUID-like `PQ-XXXX-XXXX-XXXX` generata
  dall'admin, riscattabile una volta.
- **Document count**: numero di documenti salvati dall'utente (tutti
  i tipi confusi). Incrementato su `saveDocument` se nuovo ID, non su
  update.
- **Pacchetto**: tipologia di codice sblocco: `starter` (€149),
  `apertura` (€349), `presenza` (€690), `custom` (manuale).

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: Ogni utente ha `tier` in `user_settings`, default
  `'free'`. L'admin `admin@gmail.com` ha sempre tier `unlocked`
  implicito (short-circuit nel backend e frontend).
- **REQ-002`: Migration Drizzle aggiunge 4 colonne a `user_settings`:
  `tier VARCHAR(20) DEFAULT 'free'`, `unlock_code VARCHAR(50)`,
  `unlocked_at TIMESTAMP`, `document_count INTEGER DEFAULT 0`.
- **REQ-003**: Migration Drizzle crea nuova tabella `unlock_codes`:
  ```sql
  CREATE TABLE unlock_codes (
    code VARCHAR(50) PRIMARY KEY,
    package VARCHAR(50) NOT NULL,
    used_by VARCHAR(255),
    used_at TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```
- **REQ-004**: Endpoint `POST /users/redeem-code` body
  `{ email, code }`:
  - Validazione Zod: `email` email, `code` string non vuota
  - Lookup `unlock_codes` per `code` case-insensitive (LOWER)
  - Se non trovato → 404 `{ error: 'Codice non valido' }`
  - Se `used_by` non null → 409 `{ error: 'Codice già utilizzato' }`
  - Se valido → UPDATE `unlock_codes` SET `used_by=email`,
    `used_at=now()` WHERE `code=?`
  - UPDATE `user_settings` SET `tier='unlocked'`,
    `unlock_code=?`, `unlocked_at=now()` WHERE `user_email=?`
  - Se `user_settings` non esiste → INSERT (upsert)
  - Response 200 `{ data: { tier: 'unlocked' } }`
- **REQ-005**: Endpoint `POST /admin/generate-unlock-code` body
  `{ adminEmail, package }`:
  - Verifica `adminEmail === 'admin@gmail.com'` → altrimenti 403
  - Validazione `package` in `['starter', 'apertura', 'presenza',
    'custom']`
  - Genera codice `PQ-<8hex>-<8hex>-<8hex>` (24 char totali, UUID-like)
  - INSERT in `unlock_codes` con `created_by=adminEmail`
  - Response 201 `{ data: { code } }`
- **REQ-006**: Endpoint `GET /admin/unlock-codes?adminEmail=...`:
  - Verifica admin
  - Response 200 `{ data: [{ code, package, used_by, used_at,
    created_at }] }`
- **REQ-007**: Endpoint `GET /users/tier?email=...`:
  - Response 200 `{ data: { tier, documentCount, documentLimit } }`
  - Per admin: `{ tier: 'unlocked', documentCount: 0, documentLimit:
    null }`
- **REQ-008**: Endpoint `PATCH /users/document-count` body
  `{ email, delta }`:
  - Internal endpoint, chiamato da `saveDocument` backend
  - Incrementa `document_count` di `delta` (default +1)
  - Response 200 `{ data: { documentCount } }`
- **REQ-009**: `dataService.saveDocument` chiama
  `incrementDocumentCount` dopo salvataggio riuscito, solo se
  l'ID è nuovo (non update).
- **REQ-010**: Frontend: ogni editor (QR, card, flyer, logo) riceve
  prop `tier` e la passa ai generatori.
- **REQ-011`: Watermark PDF: funzione `applyWatermarkToPdf(docDefinition,
  tier)` modifica il `docDefinition` pdfmake aggiungendo:
  - `background`: funzione che renderizza testo "PRECISIONQUOTE"
    diagonale 10% opacity, ripetuto a 80px di distanza
  - `footer`: funzione che renderizza
    "Crea il tuo con PrecisionQuote · precisionquote.vercel.app"
    centrato, 8pt, grigio chiaro
- **REQ-012**: Watermark PNG: funzione
  `applyWatermarkToCanvas(ctx, tier, width, height)` disegna stesso
  pattern dopo il render del contenuto.
- **REQ-013**: Risoluzione gate:
  - PDF: 300 DPI per unlocked, 150 DPI per free
  - PNG: 300 DPI per unlocked, 72 DPI per free
- **REQ-014**: Limite documenti free: max 3. Quando
  `documentCount >= 3` e tier `free`, il salvataggio mostra modale
  `TierLimitModal` con:
  - Messaggio "Hai raggiunto il limite di 3 documenti nel piano
    free."
  - Bottoni "Inserisci codice sbloccato" (apre form inline) +
    "Contattaci" (mailto: admin@gmail.com con subject precompilato)
- **REQ-015`: SettingsPage sezione "Il mio account":
  - Mostra stato tier ("Free" o "Sbloccato")
  - Se free: form "Inserisci codice sbloccato" con input + bottone
    "Riscatta"
  - Se unlocked: mostra `unlockCode` mascherato (prime 4 char + ****)
    e `unlockedAt` data
- **REQ-016**: AdminDashboard tab "Codici sblocco":
  - Form "Genera codice" con select `package` + bottone "Genera"
  - Tabella codici esistenti con colonne: codice, pacchetto, usato da,
    usato il, generato il
  - Copy-to-clipboard per codice
- **REQ-017**: Endpoint `/users/redeem-code` rate limit: 5
  tentativi/15min per IP (scope `redeem`, allineato a login).
- **SEC-001**: Validazione Zod su tutti i nuovi endpoint.
- **SEC-002`: Codice unlock case-insensitive nel lookup (LOWER(code)
  = LOWER(input)), ma salvato in uppercase.
- **SEC-003`: Nessun codice esposto in log. Logger client filtra
  `code` nei payload.
- **SEC-004`: Admin check (`adminEmail === 'admin@gmail.com'`) su
  `/admin/generate-unlock-code` e `/admin/unlock-codes`.
- **SEC-005`: Watermark non rimovibile client-side: anche se l'utente
  manipola il DOM, il PDF generato ha watermark baked-in (pdfmake
  renderizza in un blob non modificabile post-generation).
- **CON-001**: Vercel Hobby: nessun endpoint AI nuovo.
- **CON-002`: Migration non-distruttiva: `ALTER TABLE user_settings
  ADD COLUMN ...` + `CREATE TABLE unlock_codes`.
- **CON-003`: Backward compat: utenti esistenti senza `tier` →
  default `'free'` via column default.
- **CON-004`: `document_count` parte da 0 per utenti esistenti. Non
  contiamo retroattivamente i preventivi già salvati (sembrerebbe
  un limite arbitrario).
- **GUD-001**: Seguire `AGENTS.md` "Test — OBBLIGATORI": coverage
  ≥60% per i nuovi file.
- **GUD-002**: Seguire `AGENTS.md` "API Schema Duplication": update
  `db/schema.ts` + `api/index.ts` in parallelo.
- **GUD-003`: Seguire `AGENTS.md` "API Design Principles": status
  codes 200/201/400/401/403/404/409/429/500, JSON uniforme
  `{ data }` o `{ error }`.
- **GUD-004`: Seguire `AGENTS.md` "Auth Security": admin check,
  rate limit, no stack trace.
- **GUD-005`: Seguire `AGENTS.md` "Admin User": admin bypass per
  tier, non salvato in DB, short-circuit in tutti i check.
- **GUD-006`: Seguire skill `web-security` per validazione codice,
  rate limit, admin gate.
- **GUD-007`: Seguire skill `vercel-react-best-practices` per
  propagazione `tier` (context o prop drilling minimale).
- **GUD-008`: Seguire skill `web-design-guidelines` per UI
  SettingsPage e AdminDashboard accessibili.
- **PAT-001**: Pattern tier propagation via Context:
  ```tsx
  // App.tsx
  const [tier, setTier] = useState<'free' | 'unlocked'>('free');
  useEffect(() => {
    if (user?.email === 'admin@gmail.com') { setTier('unlocked'); return; }
    if (user?.email) dataService.getUserTier(user.email).then(({ tier }) => setTier(tier));
  }, [user?.email]);
  // passa tier a tutti gli editor
  ```
- **PAT-002`: Pattern watermark pdfmake background:
  ```ts
  function watermarkBackground(pageWidth, pageHeight) {
    return function(curPage, pageSize) {
      const ctx = this; // pdfmake context
      ctx.save();
      ctx.translate(pageWidth / 2, pageHeight / 2);
      ctx.rotate(-Math.PI / 6);
      ctx.font('Helvetica');
      ctx.fontSize(40);
      ctx.fill(204, 204, 204); // 10% opacity gray
      ctx.text('PRECISIONQUOTE', { width: pageSize.width, align: 'center' });
      ctx.restore();
    };
  }
  ```

## 4. Interfaces & Data Contracts

### Schema DB (estensione)

```ts
const userSettingsTable = pgTable('user_settings', {
  // ...campi esistenti
  tier: varchar('tier', { length: 20 }).default('free'),
  unlockCode: varchar('unlock_code', { length: 50 }),
  unlockedAt: timestamp('unlocked_at'),
  documentCount: integer('document_count').default(0),
});

const unlockCodesTable = pgTable('unlock_codes', {
  code: varchar({ length: 50 }).primaryKey(),
  package: varchar('package', { length: 50 }).notNull(),
  usedBy: varchar('used_by', { length: 255 }),
  usedAt: timestamp('used_at'),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### `src/utils/watermark.ts` (nuovo)

```ts
import type { DocumentDefinition } from 'pdfmake';

export function applyWatermarkToPdf(
  doc: DocumentDefinition,
  tier: 'free' | 'unlocked'
): DocumentDefinition {
  if (tier === 'unlocked') return doc;
  return {
    ...doc,
    background: watermarkBackground(),
    footer: watermarkFooter(),
  };
}

function watermarkBackground() {
  return (curPage: any, pageSize: any) => {
    // pdfmake canvas API per testo diagonale ripetuto
  };
}

function watermarkFooter() {
  return (curPage: any, pageSize: any) => {
    return {
      text: 'Crea il tuo con PrecisionQuote · precisionquote.vercel.app',
      alignment: 'center',
      fontSize: 8,
      color: '#999999',
      margin: [0, 10, 0, 0],
    };
  };
}

export function applyWatermarkToCanvas(
  ctx: CanvasRenderingContext2D,
  tier: 'free' | 'unlocked',
  width: number,
  height: number
): void {
  if (tier === 'unlocked') return;
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = '#999999';
  ctx.font = '20px sans-serif';
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 6);
  // Pattern ripetuto
  for (let y = -height; y < height; y += 80) {
    for (let x = -width; x < width; x += 200) {
      ctx.fillText('PRECISIONQUOTE', x, y);
    }
  }
  ctx.restore();
  // Footer
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#999999';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Crea il tuo con PrecisionQuote · precisionquote.vercel.app', width / 2, height - 10);
}

export function getDpiForTier(tier: 'free' | 'unlocked', defaultDpi: number): number {
  return tier === 'unlocked' ? defaultDpi : Math.min(defaultDpi, 150);
}
```

### `src/utils/dataService.js` (estensione)

```js
async getUserTier(email) {
  if (email === 'admin@gmail.com') return { tier: 'unlocked', documentCount: 0, documentLimit: null };
  if (IS_LOCAL) {
    const settings = lsGet(`userSettings_${email}`) || {};
    return {
      tier: settings.tier || 'free',
      documentCount: settings.documentCount || 0,
      documentLimit: 3,
    };
  }
  return api('GET', `/users/tier?email=${encodeURIComponent(email)}`);
}

async redeemUnlockCode(email, code) {
  if (IS_LOCAL) {
    // mock: 'TEST-UNLOCK' funziona sempre
    if (code.toUpperCase() === 'TEST-UNLOCK') {
      const settings = lsGet(`userSettings_${email}`) || {};
      settings.tier = 'unlocked';
      settings.unlockCode = code.toUpperCase();
      settings.unlockedAt = new Date().toISOString();
      lsSet(`userSettings_${email}`, settings);
      return { success: true, tier: 'unlocked' };
    }
    return { error: 'Codice non valido' };
  }
  return api('POST', '/users/redeem-code', { email, code });
}

async incrementDocumentCount(email) {
  if (email === 'admin@gmail.com') return { documentCount: 0 };
  if (IS_LOCAL) {
    const settings = lsGet(`userSettings_${email}`) || {};
    settings.documentCount = (settings.documentCount || 0) + 1;
    lsSet(`userSettings_${email}`, settings);
    return { documentCount: settings.documentCount };
  }
  return api('PATCH', '/users/document-count', { email, delta: 1 });
}

async adminGenerateUnlockCode(packageName) {
  if (IS_LOCAL) {
    const codes = lsGet('unlock_codes') || [];
    const code = `PQ-${randomHex(8)}-${randomHex(8)}-${randomHex(8)}`;
    codes.push({ code, package: packageName, createdBy: 'admin@gmail.com', createdAt: new Date().toISOString() });
    lsSet('unlock_codes', codes);
    return { success: true, code };
  }
  return api('POST', '/admin/generate-unlock-code', { adminEmail: 'admin@gmail.com', package: packageName });
}
```

### Generatori (estensione)

Ogni generatore (`qrGenerator.ts`, `cardGenerator.ts`, `flyerGenerator.ts`,
`logoGenerator.ts`) ha i parametri `tier` già accettati dalla fasi 1-4
(no-op). In questa fase, integrare `applyWatermarkToPdf` e
`applyWatermarkToCanvas` effettivamente.

### `src/components/TierLimitModal.tsx` (nuovo)

```tsx
interface TierLimitModalProps {
  open: boolean;
  onClose: () => void;
  onRedeem: (code: string) => Promise<void>;
}
// Modale con form inline per codice + bottone "Contattaci" (mailto)
```

### `src/components/SettingsPage.tsx` (estensione)

Nuova sezione "Il mio account" con stato tier + form redeem.

### `src/pages/AdminDashboard.tsx` (estensione)

Nuova tab "Codici sblocco" con generazione + lista.

## 5. Acceptance Criteria

- **AC-001**: Given utente free con 3 documenti salvati, When tenta
  di salvare il 4°, Then `TierLimitModal` appare e il salvataggio è
  bloccato.
- **AC-002**: Given utente free vede modale limite, When inserisce
  codice `TEST-UNLOCK` (locale) o codice valido (prod), Then modale
  chiude, tier diventa `unlocked`, salvataggio procede.
- **AC-003**: Given utente free, When esporta PDF bigliettino, Then
  il PDF ha watermark diagonale "PRECISIONQUOTE" + footer
  "Crea il tuo con PrecisionQuote".
- **AC-004**: Given utente unlocked, When esporta PDF bigliettino,
  Then il PDF NON ha watermark, risoluzione 300 DPI.
- **AC-005**: Given utente free, When esporta PNG QR 1024, Then il
  PNG ha watermark e risoluzione 72 DPI (max 1024×1024 ma
  effettivamente 72 DPI rendering).
- **AC-006**: Given admin `admin@gmail.com`, When apre SettingsPage,
  Then vede tier "Sbloccato" senza possibilità di inserire codice.
- **AC-007**: Given admin, When apre AdminDashboard tab "Codici
  sblocco", Then vede form generazione + tabella codici esistenti.
- **AC-008**: Given admin, When click "Genera" con package `starter`,
  Then nuovo codice `PQ-<8hex>-<8hex>-<8hex>` appare in tabella.
- **AC-009`: Given utente non admin, When tenta `POST
  /admin/generate-unlock-code`, Then 403 Forbidden.
- **AC-010**: Given codice già usato, When utente tenta redeem, Then
  409 Conflict `{ error: 'Codice già utilizzato' }`.
- **AC-011**: Given codice inesistente, When utente tenta redeem,
  Then 404 Not Found `{ error: 'Codice non valido' }`.
- **AC-012`: Given IP ha fatto 6 tentativi redeem falliti in 15min,
  When 7° tentativo, Then 429 Too Many Requests.
- **AC-013**: Given utente free riscatta codice valido, When
  `redeemUnlockCode` ritorna, Then `tier` state in App.tsx si
  aggiorna a `unlocked` e tutti gli editor riflettono il nuovo tier.
- **AC-014**: Given `saveDocument` con nuovo ID, When salvataggio
  riuscito, Then `incrementDocumentCount` chiamato e
  `document_count` incrementato.
- **AC-015`: Given `saveDocument` con ID esistente (update), When
  salvataggio riuscito, Then `incrementDocumentCount` NON chiamato
  (no double count).
- **AC-016`: Given utente loggato, When apre SettingsPage, Then vede
  sezione "Il mio account" con stato tier + (se free) form codice.
- **AC-017`: Given utente unlocked, When apre SettingsPage, Then
  vede codice mascherato `PQ-XXXX-****` + data sblocco.
- **AC-018`: Given `npm run typecheck`, Then code 0.
- **AC-019`: Given `npm run test`, Then code 0 e tutti i nuovi test
  passano.

## 6. Test Automation Strategy

- **Test Levels**: Unit (watermark, dataService, schema), Integration
  (componenti con tier prop), Contract (endpoint).
- **Frameworks**: Vitest 4, React Testing Library 16, jsdom 29.
- **Test Data Management**: mock DB con `vi.mock`. Codici di test
  hardcoded (`TEST-UNLOCK`, `PQ-AAAAAAAA-BBBBBBBB-CCCCCCCC`).
- **Coverage Requirements**: ≥60% per i nuovi file.

### File di test da creare

| File | Cosa copre |
|------|-----------|
| `src/utils/__tests__/watermark.test.ts` | `applyWatermarkToPdf` per free (watermark aggiunto) e unlocked (no-op); `applyWatermarkToCanvas` per free (disegna pattern) e unlocked (no-op); `getDpiForTier` per 3 casi (free 150, unlocked 300, default < 150 per free) |
| `src/utils/__tests__/dataService.tier.test.ts` | `getUserTier` per admin (unlocked) + user free + user unlocked; `redeemUnlockCode` per codice valido/invalido/esausto; `incrementDocumentCount` incrementa; `adminGenerateUnlockCode` genera formato corretto |
| `src/components/__tests__/TierLimitModal.test.tsx` | render modale, form codice, submit con successo (mock), submit con errore, bottone Contattaci (mailto) |
| `src/components/__tests__/SettingsPage.tier.test.tsx` | render sezione "Il mio account", stato free (form visibile), stato unlocked (codice mascherato), submit form redeem |
| `src/pages/__tests__/AdminDashboard.unlockCodes.test.tsx` | tab "Codici sblocco" render, form generazione, click genera (mock), tabella codici, copy-to-clipboard |
| `api/__tests__/redeemCode.test.ts` | endpoint `POST /users/redeem-code` con codice valido/invalido/esausto, rate limit, auth required |
| `api/__tests__/adminUnlockCodes.test.ts` | endpoint `POST /admin/generate-unlock-code` con admin/non-admin, validazione package; endpoint `GET /admin/unlock-codes` con admin/non-admin |
| `api/__tests__/userTier.test.ts` | endpoint `GET /users/tier` per admin/free/unlocked |
| `src/__tests__/migrationTier.test.ts` | la migrazione aggiunge colonne a `user_settings` + crea `unlock_codes` senza perdere dati esistenti |

### Test matrice

| AC | Test file |
|----|-----------|
| AC-001 | TierLimitModal.test.tsx + integration EditorView |
| AC-002 | TierLimitModal.test.tsx |
| AC-003 | watermark.test.ts + integration generator |
| AC-004 | watermark.test.ts |
| AC-005 | watermark.test.ts + integration qrGenerator |
| AC-006 | SettingsPage.tier.test.tsx |
| AC-007 | AdminDashboard.unlockCodes.test.tsx |
| AC-008 | AdminDashboard.unlockCodes.test.tsx |
| AC-009 | adminUnlockCodes.test.ts |
| AC-010 | redeemCode.test.ts |
| AC-011 | redeemCode.test.ts |
| AC-012 | redeemCode.test.ts |
| AC-013 | integration App.tsx (mock) |
| AC-014 | dataService.tier.test.ts |
| AC-015 | dataService.tier.test.ts |
| AC-016 | SettingsPage.tier.test.tsx |
| AC-017 | SettingsPage.tier.test.tsx |
| AC-018 | typecheck |
| AC-019 | test run |

## 7. Rationale & Context

**Perché free+watermark e non free trial temporaneo**:

Free trial (14 giorni) richiede:
- Tracking data registrazione + scadenza
- Email reminder per convertire
- Blocco duro dopo scadenza (utente frustrato se non ha finito)

Free+watermark:
- L'utente può provare tutto illimitatamente nel tempo
- Il watermark è la CTA visiva permanente
- Nessuna urgenza artificiale, ma nessuna dimenticanza
- Allineato a Canva/VistaPrint model (validato dal mercato)

**Perché codice manuale e non Stripe subito**:

Stripe integration richiede:
- Setup account Stripe (KYC, IBAN, ecc.)
- Webhook handler su Vercel
-gestione pagamenti falliti, refund, invoice
- VAT europea (MOSS/OSS)
- 3-4 settimane di lavoro

Per 0-10 clienti (fase pre-clienti e primi clienti), gestire codici
manualmente è:
- 0 costi fissi
- 5 minuti admin per generare codice dopo pagamento manuale
- Validazione del modello prima di investire in automazione

In v2, quando si superano 20 clienti/mese, Stripe si amortizza.

**Perché limite 3 documenti e non 5 o 10**:

- 3 documenti = 1 preventivo + 1 bigliettino + 1 volantino (per
  testing cross-document)
- Sotto 3, l'utente non può provare il flusso "pacchetto completo"
- Sopra 5, l'utente non sente urgenza di upgradare
- 3 è il sweet spot per "provare tutto, ma sentire il limite"

**Perché watermark testo e non logo SVG**:

Testo "PRECISIONQUOTE" è:
- Brandable (riconoscibile)
- Minor costo render (testo vs SVG raster)
- Difficile da rimuovere clean (anche con strumento editing, pattern
  ripetuto diagonale è hard to remove)
- Non offusca completamente il contenuto (l'utente vede il risultato)

Logo SVG sarebbe più bello esteticamente ma più easy da rimuovere con
content-aware fill di Photoshop.

**Perché tier implicito per admin**:

L'admin non ha `user_settings` row (FK constraint a `users.email`, ma
admin non è in `users`). Short-circuit in `getUserTier` ritorna
`unlocked` per `admin@gmail.com`. Coerente con tutti gli altri admin
short-circuit nel codice (vedi AGENTS.md "Admin User").

**Perché `document_count` non contato retroattivamente**:

Utenti esistenti con 10 preventivi salvati pre-fase-5 non devono essere
bloccati improvvisamente. `document_count` parte da 0. Il limite si
applica solo ai nuovi documenti salvati dopo la fase 5.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: Nessuna nuova integrazione esterna.

### Third-Party Services
- **SVC-001`: Nessuna nuova dipendenza di servizio. Stripe è out of
  scope v2.

### Infrastructure Dependencies
- **INF-001`: Vercel Hobby — 5 nuovi endpoint inline in `api/index.ts`,
  sotto il limite 12-function.
- **INF-002`: Neon Postgres — 1 nuova migrazione, 1 nuova tabella
  (`unlock_codes` ~50 righe per 50 clienti, trascurabile).

### Data Dependencies
- **DAT-001`: localStorage `precisionQuote_documents:v1` (riuso).
- **DAT-002`: localStorage `userSettings_<email>` esteso con
  `tier`, `unlockCode`, `unlockedAt`, `documentCount`.
- **DAT-003`: localStorage `unlock_codes` (nuova chiave, solo per
  local dev).
- **DAT-004`: Tabella DB `user_settings` estesa.
- **DAT-005`: Tabella DB `unlock_codes` (nuova).

### Technology Platform Dependencies
- **PLT-001`: pdfmake 0.3.11 — `background` e `footer` functions
  supportate.
- **PLT-002`: Canvas API per watermark PNG.

### Compliance Dependencies
- **COM-001`: GDPR — `unlock_codes.used_by` contiene email (PII).
  Trattamento standard come `users.email`. Nessun log del codice.
- **COM-002`: WCAG AA — form redeem accessibile (label, focus, ARIA).

## 9. Examples & Edge Cases

### Edge case 1: Utente fa redeem mentre ha 5 documenti già salvati

```ts
// documentCount = 5, tier = 'free' (limite superato in passato)
// redeem code → tier = 'unlocked'
// documentCount resta 5 (non reset)
// Ora può salvare altri documenti (unlocked = illimitato)
```

### Edge case 2: Codice redeem con spazi bianchi

```ts
// input: "  PQ-AAAA-BBBB-CCCC  "
// trim → "PQ-AAAA-BBBB-CCCC"
// LOWER per lookup → "pq-aaaa-bbbb-cccc"
// match case-insensitive → OK
```

### Edge case 3: Redeem in locale senza backend

```ts
// IS_LOCAL = true
// 'TEST-UNLOCK' funziona sempre (mock)
// qualsiasi altro codice → "Codice non valido"
// per testare il flusso completo in dev
```

### Edge case 4: Admin tenta redeem codice

```ts
// admin@gmail.com fa POST /users/redeem-code
// → short-circuit: admin ha sempre unlocked
// → response 200 { data: { tier: 'unlocked' } } senza toccare DB
```

### Edge case 5: Watermark su PDF con 10 pagine (volantino magazine)

```ts
// pdfmake background function viene chiamata per ogni pagina
// → watermark appare su tutte le 10 pagine
// footer function stessa cosa
```

### Edge case 6: Export PNG 2048 per free (limite 72 DPI)

```ts
// user richiede PNG 2048
// tier = 'free' → DPI = min(300, 150) = 150? No, per PNG free è 72
// → rendering a 72 DPI → 2048×2048 px ma rendering quality 72 DPI
// → canvas rendering con quality settings bassi
// → file size più piccolo, qualità visiva inferiore
```

Wait, la specifica dice "PNG: 300 DPI per unlocked, 72 DPI per free".
Per PNG, il "DPI" è un metadata nel file, ma il rendering è pixel-based.
Per free, limitiamo la dimensione massima del PNG a 1200×1200 (72 DPI
equivalente per un'immagine da ~16 pollici). Per unlocked, max 4096×4096.

```ts
// logoBuilder export PNG size 2048 richiesto da free
// → clamp a 1200 (free limit)
// → messaggio "Free tier limitato a 1200×1200. Upgrade per 2048."
```

### Edge case 7: Due utenti riscattano lo stesso codice contemporaneamente

```ts
// user A: POST /users/redeem-code code=X (T=0)
// user B: POST /users/redeem-code code=X (T=0.001)
// → race condition: entrambi leggono used_by=null
// → primo UPDATE vince, secondo UPDATE sovrascrive used_by
// → entrambi hanno tier='unlocked' ma solo l'ultimo usato dal code
// → mitigazione: SELECT ... FOR UPDATE (postgres) o unique constraint
//   su used_by (ma nullable, problematico)
// → alternativa: check used_by !== null prima di UPDATE, dentro
//   transazione
// → implementazione: usare transazione serializzabile
```

Questo edge case richiede attenzione. Implementare con:
```sql
BEGIN;
SELECT used_by FROM unlock_codes WHERE code = ? FOR UPDATE;
-- se used_by è null, procedi
UPDATE unlock_codes SET used_by = ?, used_at = now() WHERE code = ?;
UPDATE user_settings SET tier = 'unlocked' WHERE user_email = ?;
COMMIT;
```

## 10. Validation Criteria

Prima di considerare la fase 5 completata, verificare:

1. `npm run typecheck` code 0.
2. `npm run test` code 0, tutti i nuovi test passano.
3. `npm run db:generate` produce una migration `*_add_tier_system/`
   con `ALTER TABLE user_settings ADD COLUMN ...` + `CREATE TABLE
   unlock_codes`.
4. `npm run db:migrate` (con DB test) applica senza errori.
5. `git diff db/schema.ts` mostra nuove colonne + `unlockCodesTable`.
6. `git diff api/index.ts` mostra schema inline aggiornato + 5 nuovi
   endpoint handler.
7. `git status` mostra i nuovi file:
   - `src/utils/watermark.ts`
   - `src/components/TierLimitModal.tsx`
   - `src/utils/__tests__/watermark.test.ts`
   - `src/utils/__tests__/dataService.tier.test.ts`
   - `src/components/__tests__/TierLimitModal.test.tsx`
   - `src/components/__tests__/SettingsPage.tier.test.tsx`
   - `src/pages/__tests__/AdminDashboard.unlockCodes.test.tsx`
   - `api/__tests__/redeemCode.test.ts`
   - `api/__tests__/adminUnlockCodes.test.ts`
   - `api/__tests__/userTier.test.ts`
   - `src/__tests__/migrationTier.test.ts`
8. `git diff src/utils/qrGenerator.ts` mostra `applyWatermarkToCanvas`
   chiamato in `generateQrPng` se `tier === 'free'`.
9. `git diff src/utils/cardGenerator.ts` mostra
   `applyWatermarkToPdf` e `applyWatermarkToCanvas` integrati.
10. `git diff src/utils/flyerGenerator.ts` stesso.
11. `git diff src/utils/logoGenerator.ts` stesso.
12. `git diff src/components/SettingsPage.tsx` mostra sezione "Il mio
    account".
13. `git diff src/pages/AdminDashboard.tsx` mostra tab "Codici
    sblocco".
14. Manuale: `npm run dev`, registrare utente free, creare 3
    documenti, verificare modale limite al 4°, inserire
    `TEST-UNLOCK`, verificare tier unlocked.
15. Manuale: come admin, generare codice da AdminDashboard, copiarlo,
    fare redeem come user di test, verificare unlock.
16. Manuale: export PDF come free, verificare watermark visibile;
    come unlocked, verificare no watermark.
17. Manuale: rate limit — 6 tentativi redeem falliti di seguito
    dovrebbero triggerare 429 sulla 6a (aspettare 15min tra test).

## 11. Related Specifications / Further Reading

- `spec/spec-process-phase0-autosave-fix.md` — auto-save
- `spec/spec-tool-phase1-qr-code.md` — `qrGenerator` esteso con
  watermark
- `spec/spec-design-phase2-business-card.md` — `cardGenerator`
  esteso
- `spec/spec-design-phase3-flyer.md` — `flyerGenerator` esteso, AI
  copy gate per free
- `spec/spec-tool-phase4-logo-builder.md` — `logoGenerator` esteso
- `spec/spec-architecture-phase6-unified-collection.md` —
  CollectionView mostra tier badge
- `spec/spec-process-phase7-polish.md` — docs watermark + tier,
  HomePage updated
- `AGENTS.md` — sezioni "Admin User", "Auth Security", "API Design
  Principles", "API Schema Duplication"
- `README.md` — sezione "Sicurezza" (rate limit esistente)
- Skill `web-security` — admin gate, rate limit, validation
- Skill `vercel-react-best-practices` — tier propagation
- Skill `web-design-guidelines` — SettingsPage, AdminDashboard
  accessibilità

### Out of scope v2

- **Stripe integration**: webhook, checkout session, gestione pagamenti
  falliti, refund, invoice, VAT MOSS/OSS.
- **Tier `pro` o `enterprise`**: solo `free` e `unlocked` in v1.
- **Watermark personalizzato**: il watermark "PRECISIONQUOTE" è fisso,
  non configurabile dall'admin in v1.
- **Tier per AI preventivi**: i preventivi sono full quality per tutti,
  non hanno watermark.

### Prossima fase

Dopo il completamento della fase 5, procedere con
`spec/spec-architecture-phase6-unified-collection.md` (CollectionView
unificata + migration preventivi esistenti).
