# Spec: Intake Pipeline (Google Form → Quickbrand)

**Stato**: NOT-STARTED
**Effort stimato**: ~20h
**Modello**: Architettura A (ibrida) — intake automatico, generazione semi-manuale con quality check
**Out of scope**: full-auto (Architettura B), sito web publish (TB-012 separato)

---

## 1. Obiettivo

Permettere a un cliente di compilare un Google Form con i dati della
sua attività. Il brief arriva in Quickbrand come documento pre-compilato.
L'admin (founder) apre il brief, click "Genera" per modulo (logo, card,
flyer, social), controlla qualità, export, consegna.

**Non** è un SaaS self-service: l'admin review rimane obbligatorio
(match con BP "consegna in 3 giorni con quality check").

## 2. Architettura

```
[Google Form] → onFormSubmit (Apps Script, 6 righe)
   ↓ POST JSON
[/api/intake] (nuovo endpoint, validazione Zod, rate-limit)
   ↓ INSERT
[tabella intakes] (Postgres)
   ↓ trigger notifica
[email admin + badge Collection "Brief da lavorare"]
   ↓ admin click
[Editor pre-compilato: logo/card/flyer/social con dati brief]
   ↓ admin click "Genera" per modulo
[Orchestratori AI esistenti: DeepSeek + Gemini]
   ↓ admin review + export
[Consegna cliente]
```

## 3. Schema DB

Nuova tabella `intakes` in `db/schema.ts` + mirror in `api/index.ts`
(richiesto da Vercel monolith, vedi AGENTS.md "API Schema Duplication"):

```ts
export const intakes = pgTable('intakes', {
  id: varchar({ length: 50 }).primaryKey(),           // UUID
  status: varchar({ length: 20 }).default('new'),     // new | in_progress | done | rejected
  // Dati brief dal Google Form
  businessName: varchar({ length: 255 }).notNull(),
  ownerName: varchar({ length: 255 }),
  sector: varchar({ length: 100 }),                  // ristorante | b&b | bar | negozio | studio | altro
  activity: text(),                                  // descrizione libera
  mood: varchar({ length: 100 }),                    // moderno | classico | minimal | vivace
  target: text(),                                     // target cliente
  preferredColors: text(),                           // CSV liberi
  contacts: jsonb(),                                  // { email, phone, address, website }
  package: varchar({ length: 50 }).default('apertura'), // starter | apertura | presenza | custom
  // Tracking
  sourceRef: varchar({ length: 100 }),               // id riga Google Sheet (idempotenza)
  notes: text(),                                      // note admin interne
  assignedTo: varchar({ length: 255 }),              // email admin che sta lavorando
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

**Idempotenza**: `sourceRef` = id riga Sheet. Se lo stesso brief arriva
2 volte (retry webhook), non duplica. `INSERT ... ON CONFLICT (sourceRef)
DO NOTHING` oppure check pre-insert.

**Status flow**: `new` → `in_progress` (admin apre) → `done` (export
consegnato) | `rejected` (brief non valido).

**Migrazione**: `npm run db:generate` + `npm run db:migrate`. Costa
€0 (Neon free tier).

## 4. Endpoint `/api/intake`

**POST /api/intake** — pubblico (no auth, il cliente non ha account),
rate-limitato per IP.

```ts
// Zod schema validazione
const intakeSchema = z.object({
  businessName: z.string().min(2).max(255),
  ownerName: z.string().max(255).optional(),
  sector: z.enum(['ristorante', 'b&b', 'bar', 'negozio', 'studio', 'altro']),
  activity: z.string().max(2000).optional(),
  mood: z.enum(['moderno', 'classico', 'minimal', 'vivace', 'altro']).optional(),
  target: z.string().max(500).optional(),
  preferredColors: z.string().max(200).optional(),
  contacts: z.object({
    email: z.string().email().optional(),
    phone: z.string().max(50).optional(),
    address: z.string().max(500).optional(),
    website: z.string().max(255).optional(),
  }).optional(),
  package: z.enum(['starter', 'apertura', 'presenza', 'custom']).default('apertura'),
  sourceRef: z.string().max(100).optional(),          // id riga Sheet
});
```

**Rate limit**: 5 intake / ora / IP (anti-spam). Usa `consumeRateLimit`
esistente con scope `'intake'`.

**Response 201**: `{ data: { id, status: 'new' } }`
**Response 409**: `{ error: 'Brief già ricevuto' }` (sourceRef duplicato)
**Response 429**: `{ error: 'Troppi brief, riprova tra un'ora' }`

**Sicurezza**:
- No PII in log server (email/telefono filtrati come già fa per
  unlock codes)
- Zod su tutti i campi
- Body size limit 1MB (già globale)
- CORS: endpoint pubblico, CORS aperto ma rate-limitato

**Log**: solo `businessName`, `sector`, `package`, `sourceRef`. Mai
`contacts.email` o `contacts.phone`.

## 5. Google Form + Apps Script

### Form campi (mappa 1:1 con Zod)
- Nome attività * (text)
- Nome proprietario (text)
- Settore * (select: ristorante/b&b/bar/negozio/studio/altro)
- Descrivi la tua attività (textarea, max 2000 char)
- Mood (select: moderno/classico/minimal/vivace/altro)
- Target cliente (text)
- Colori preferiti (text)
- Email (email)
- Telefono (text)
- Indirizzo (text)
- Sito web se esiste (text)
- Pacchetto (select: starter/apertura/presenza/custom, default apertura)

### Apps Script (da incollare in Sheet → Estensioni → Apps Script)

```javascript
function onFormSubmit(e) {
  const WEBHOOK_URL = 'https://TUO-DOMINIO.vercel.app/api/intake';
  const row = e.range.getRow();
  const values = e.values;
  const payload = {
    businessName: values[1],
    ownerName: values[2] || undefined,
    sector: values[3],
    activity: values[4] || undefined,
    mood: values[5] || undefined,
    target: values[6] || undefined,
    preferredColors: values[7] || undefined,
    contacts: {
      email: values[8] || undefined,
      phone: values[9] || undefined,
      address: values[10] || undefined,
      website: values[11] || undefined,
    },
    package: values[12] || 'apertura',
    sourceRef: 'sheet_row_' + row,
  };
  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}
```

**Setup**: Sheet → Estensioni → Apps Script → incolla → salva →
Trigger (icona orologio) → onFormSubmit → da foglio di lavoro →
all'invio del modulo. Gratis, niente server.

## 6. Frontend: Collection "Brief da lavorare"

### Badge count in Layout sidebar

`AppShell` legge count intakes `status='new'` via `GET /api/intakes?status=new`.
Mostra badge rosso accanto a "Collection" nella sidebar se count > 0.

### Sezione "Brief" in CollectionView

Nuova tab/section sopra la griglia documenti:

```
┌──────────────────────────────────────────────┐
│ Brief da lavorare (3)                          │
├──────────────────────────────────────────────┤
│ [Ristorante Da Mario]  aperitura  2h fa [Apri] │
│ [B&B Costa Serena]     presenza  1g fa [Apri] │
│ [Bar Il Faro]         starter   3g fa [Apri] │
└──────────────────────────────────────────────┘
```

Click "Apri" → apre l'editor pre-compilato (vedi §7).

### Endpoint admin

- `GET /api/intakes?status=new` — lista brief nuovi (admin only)
- `GET /api/intakes/:id` — dettaglio brief (admin only)
- `PATCH /api/intakes/:id` — aggiorna status / notes / assignedTo (admin only)

Admin guard: `adminEmail=admin@gmail.com` query param (pattern esistente).

## 7. Pre-compilazione editor

Quando admin click "Apri" su un brief:

1. **Crea documento draft** per ogni modulo rilevante (logo, card, flyer,
   social) con `data` pre-compilato dai campi brief:
   - Logo: `builder.primaryText = businessName`, `activity`, `mood`,
     `target` → tab AI pronto per "Genera concept"
   - Card: `front.name = ownerName`, `front.company = businessName`,
     `front.sector`, `back.contacts = contacts` → AI pronto
   - Flyer: `content.title = businessName`, `content.body = activity`,
     `sector` → AI copy pronto
   - Social: derivato dal brand generato (post-AI logo/card)

2. **Apre l'editor** con il primo modulo (logo di default)

3. **Status intake** → `in_progress`, `assignedTo = admin.email`

4. **Workflow admin**:
   - Tab AI → click "Genera concept" (logo) → seleziona → applica
   - Cambia modulo (card) → tab AI → click "Genera" → applica
   - Stesso per flyer, social
   - Export PDF/PNG/SVG per ciascuno
   - Status intake → `done`, note opzionali

**Non** è auto-generazione: ogni click "Genera" è un'azione esplicita
dell'admin, che vede il risultato prima di appliclo. Match con BP
"consegna in 3 giorni con quality check".

## 8. Notifiche admin

### Email (gratis, via Vercel o servizio esterno)

Opzione semplice: endpoint `/api/intake` manda email a
`admin@gmail.com` usando un servizio transazionale gratuito:
- **Resend** (3.000 email/mese gratis, SDK Node)
- **EmailJS** (200 email/mese gratis, client-side)
- O semplicemente: **nessuna email**, solo badge in Collection. L'admin
  apre Quickbrand 1-2 volte al giorno e vede il badge.

**Raccomandato**: niente email in v1. Badge Collection basta. Aggiungi
email solo se perdi brief (dopo 2 settimane di uso reale).

### WhatsApp (opzionale, post-validazione)

Twilio free trial: €15 crediti, ~500 messaggi. Alert su nuovo brief
`status='new'`. Setup ~3h. **Solo se** il volume lo giustifica (>10
brief/mese).

## 9. Sicurezza

- **Rate limit**: 5 intake / ora / IP (anti-spam form)
- **Zod** su tutti i campi (anti-injection)
- **No PII in log**: email/telefono filtrati come unlock codes
- **Idempotenza**: `sourceRef` unique, retry webhook non duplica
- **Admin guard** su GET/PATCH intakes
- **CORS pubblico** su POST /api/intake (il form non ha auth)
- **Body 1MB** (globale, già enforced)
- **GDPR**: form ha link privacy policy, dati conservati in Postgres
  (Neon EU), cliente può chiedere cancellazione via email

## 10. Test richiesti

### Backend (`api/__tests__/intake.test.ts`)

- POST /api/intake: payload valido → 201, intake salvato
- POST /api/intake: sourceRef duplicato → 409
- POST /api/intake: payload invalido (sector non enum) → 400
- POST /api/intake: rate limit > 5/h → 429
- GET /api/intakes?status=new: admin → 200, lista
- GET /api/intakes: non-admin → 403
- PATCH /api/intakes/:id: admin → 200, status aggiornato
- PATCH /api/intakes/:id: non-admin → 403
- No PII in log: verify logger non scrive contacts.email

### Frontend (`src/components/__tests__/IntakeList.test.tsx`)

- Render lista brief con status, settore, tempo relativo
- Click "Apri" → naviga a editor pre-compilato
- Badge count in sidebar (3 nuovi → badge "3")

### E2E (`e2e/intake-pipeline.spec.ts`)

- Mock webhook POST /api/intake con payload valido
- Admin login → vede badge in sidebar
- Click Collection → vede brief in lista
- Click "Apri" → editor apre con dati pre-compilati
- Click "Genera concept" (logo AI, mock DeepSeek) → concept appare
- PATCH intake status done → sparisce dalla lista new

## 11. File da creare/modificare

| File | Azione | Scope |
|------|--------|-------|
| `db/schema.ts` | modifica: aggiungi `intakes` table | ~15 righe |
| `api/index.ts` | modifica: `intakesTable` mirror + 4 endpoint | ~150 righe |
| `src/utils/dataService.js` | modifica: `getIntakes`, `updateIntake`, `createIntake` | ~60 righe |
| `src/components/IntakeList.tsx` | nuovo: lista brief in Collection | ~120 righe |
| `src/components/CollectionView.tsx` | modifica: render IntakeList sopra griglia | ~20 righe |
| `src/components/Layout.tsx` | modifica: badge count intakes in sidebar | ~15 righe |
| `src/hooks/useIntakes.ts` | nuovo: fetch + polling intakes | ~60 righe |
| `src/utils/intakeToDocument.ts` | nuovo: mappa brief → document data per modulo | ~80 righe |
| `docs/apps-script-snippet.js` | nuovo: snippet da incollare in Sheet | ~30 righe |
| `api/__tests__/intake.test.ts` | nuovo: test backend | ~150 righe |
| `src/components/__tests__/IntakeList.test.tsx` | nuovo: test frontend | ~100 righe |
| `e2e/intake-pipeline.spec.ts` | nuovo: e2e | ~80 righe |

**Totale**: ~880 righe, ~20h lavoro.

## 12. Out of scope

- **Full-auto (Architettura B)**: server genera SVG+PDF da solo, email
  al cliente. Richiede Puppeteer + backend separato (Render/Fly.io
  €15-30/mo). Valutare dopo 10+ clienti reali.
- **Sito web publish**: TB-012 (landing generator), spec separata.
  Intake pipeline produce documenti, non siti.
- **Self-service portal cliente**: il cliente vede lo stato del suo
  brief. Futuro, non v1.
- **Email notifica admin**: badge Collection basta in v1.
- **WhatsApp alert**: post-validazione, solo se volume giustifica.

## 13. Roadmap

1. **Spec approvata** (questo documento)
2. **Migrazione DB** (30 min): `db:generate` + `db:migrate`
3. **Backend** (4h): endpoint + test
4. **Frontend** (8h): IntakeList + pre-compilazione + test
5. **Apps Script** (30 min): snippet + setup Form
6. **E2E** (3h): test end-to-end
7. **Doc** (1h): README sezione intake, AGENTS.md update
8. **Test verde + typecheck** (1h)

**Totale**: ~18-20h.