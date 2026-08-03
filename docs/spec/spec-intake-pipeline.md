---
title: Intake Pipeline — Google Form to Quickbrand Brief
version: 1.0
date_created: 2026-07-20
owner: Founder
tags: [infrastructure, process, backend, frontend]
---

# Introduction

Specifica la pipeline di intake che permette a un cliente (senza account)
di compilare un Google Form con i dati della sua attività. Il brief arriva
in Quickbrand come documento pre-compilato. L'admin (founder) apre il
brief, genera i moduli del brand (logo, card, flyer, social) con un click,
controlla qualità, esporta e consegna. L'automazione è ibrida: intake
automatico, generazione semi-manuale con quality check obbligatorio.

## 1. Purpose & Scope

**Purpose**: sostituire l'intake manuale (email/WhatsApp) con un form
strutturato che produce brief pre-compilati nell'app Quickbrand.

**Scope**: 
- Form pubblico (Google Form o Tally.so) → Google Sheet → webhook
- Endpoint `/api/intake` (pubblico, rate-limitato, Zod-validato)
- Tabella Postgres `intakes`
- Frontend admin: lista brief in Collection, badge count, editor pre-compilato
- Pre-compilazione documenti (logo, card, flyer, social) dai campi brief

**Out of scope**:
- Full-auto generation (server genera SVG+PDF da solo, email al cliente)
- Sito web publish (TB-012, spec separata)
- Self-service portal cliente (stato brief)
- Email/WhatsApp notifica admin (badge Collection basta in v1)
- Upload file nel form (link esterno per v1)

**Intended audience**: founder (admin unico in v1), eventuali collaboratori
futuri (admin aggiuntivi creati manualmente). Quickbrand non è un SaaS
pubblico: la registrazione utente è disabilitata (o admin-only),
l'admin accede all'app per lavorare i brief, i clienti compilano il
form pubblico senza account.

**Assumptions**:
- L'app Quickbrand esiste e funziona (14 fasi, 2100+ test)
- Gli orchestratori AI (logo, card, flyer, social) sono già costruiti
- L'admin ha già accesso via auth esistente
- Vercel Hobby + Neon free tier (costo €0)

## 2. Definitions

- **Intake**: il primo contatto strutturato con un cliente (brief dati)
- **Brief**: insieme di dati che descrivono l'attività del cliente
- **Admin**: utente con ruolo admin (default `admin@gmail.com`)
- **Source ref**: identificativo della riga Google Sheet (idempotenza)
- **Pre-compilazione**: riempimento automatico dei campi documento dai
  dati brief, pronto per click "Genera"
- **Modulo**: tipo di documento (logo, card, flyer, social, quote)
- **Quality check**: revisione umana obbligatoria dell'output AI prima
  della consegna (non self-service)
- **Apps Script**: JavaScript runtime ospitato da Google, gira sui
  server Google, gratis, si attiva su trigger (form submit)
- **Webhook**: HTTP POST inviato da Apps Script al endpoint `/api/intake`
- **Idempotenza**: lo stesso brief inviato 2 volte non duplica il record

## 3. Requirements, Constraints & Guidelines

### Functional Requirements

- **REQ-001**: Il sistema deve accettare un POST HTTP pubblico a
  `/api/intake` con body JSON contenente i campi brief (businessName,
  ownerName, sector, activity, mood, target, preferredColors, contacts,
  package, sourceRef).
- **REQ-002**: Il sistema deve validare il body con Zod schema. Campi
  invalidi → 400 Bad Request con messaggio esplicito.
- **REQ-003**: Il sistema deve salvare il brief in tabella `intakes`
  con status default `new`.
- **REQ-004**: Il sistema deve garantire idempotenza tramite `sourceRef`
  unique: retry webhook non duplica (UPDATE il record esistente invece di 409).
- **REQ-005**: L'admin deve poter listare i brief con `GET /api/intakes?status=new`
  filtrati per status.
- **REQ-006**: L'admin deve poter aprire un brief e vedere i dettagli con
  `GET /api/intakes/:id`.
- **REQ-007**: L'admin deve poter aggiornare status/notes/assignedTo con
  `PATCH /api/intakes/:id`.
- **REQ-008**: Il frontend deve mostrare un badge count di brief `new`
  nella sidebar, accanto a "Collection". (Rimosso 2026-08-01: il banner
  "Brief da lavorare" non è più mostrato in Collection; i brief sono
  visibili solo via CRM.)
- **REQ-009**: (Rimosso 2026-08-01: la sezione "Brief da lavorare" in
  CollectionView è stata eliminata. L'admin lavora i brief dal CRM.)
- **REQ-010**: (Rimosso 2026-08-01: il click "Apri" non esiste più.
  I brief arrivano via webhook e l'admin li gestisce dal CRM.)
- **REQ-011**: La pre-compilazione deve popolare i campi AI-ready:
  logo (primaryText=businessName, activity, mood, target), card
  (name=ownerName, company=businessName, contacts), flyer (title, body,
  sector), social (derivato post-brand).
- **REQ-012**: (Rimosso 2026-08-01: non c'è più click "Apri".)
- **REQ-013**: Il sistema deve supportare 3 form provider intercambiabili:
  Google Form (con Apps Script), Tally.so (webhook nativo), Typeform
  (webhook nativo). Il endpoint `/api/intake` accetta lo stesso JSON
  da tutti e 3.

### Security Requirements

- **SEC-001**: Rate limit 5 intake / ora / IP su POST /api/intake
  (anti-spam form pubblico).
- **SEC-002**: Nessun PII (email, telefono) in log server. Logger
  filtra `contacts.email` e `contacts.phone` come già fa per unlock codes.
- **SEC-003**: Zod validation su tutti i campi (anti-injection).
- **SEC-004**: Body size limit 1MB (già globale, enforce esistente).
- **SEC-005**: CORS aperto su POST /api/intake (form non ha auth).
- **SEC-006**: GET/PATCH /api/intakes richiedono `adminEmail=admin@gmail.com`
  come query param (pattern esistente).
- **SEC-007**: Non-admin che tenta GET/PATCH /api/intakes → 403.
- **SEC-008**: `sourceRef` è unique constraint a livello DB.

### Constraints

- **CON-001**: Vercel Hobby plan: niente Puppeteer, niente Chrome binary.
  La generazione PDF/PNG resta client-side (browser admin), come oggi.
- **CON-002**: L'endpoint `/api/intake` deve essere inline in `api/index.ts`
  (monolith intenzionale, vedi AGENTS.md "Vercel Routing").
- **CON-003**: La tabella `intakes` deve essere mirror-ata in `api/index.ts`
  (schema duplication requirement, vedi AGENTS.md).
- **CON-004**: L'admin review è obbligatorio: nessuna generazione
  automatica senza click esplicito "Genera" per modulo. Match con BP
  "consegna in 3 giorni con quality check".
- **CON-005**: Google Form + Apps Script + Google Sheet sono gratis ma
  con limite 20k righe Sheet e 6h/giorno Apps Script. Per 100
  clienti/mese si è largamente sotto.

### Guidelines

- **GUD-001**: Privilegiare Tally.so su Google Form per branding migliore
  (gratis, 1000 risposte/mese, webhook nativo, niente Apps Script).
  Google Form come fallback se Tally limiti raggiunti.
- **GUD-002**: Niente email notifica admin in v1. Badge Collection basta.
  Aggiungere email solo se brief persi (dopo 2 settimane di uso reale).
- **GUD-003**: Pre-compilazione non è generazione. I documenti draft
  hanno i campi testo popolati, ma l'AI va attivata manualmente per ogni
  modulo (logo, card, flyer, social). L'admin vede sempre l'output
  prima di appliclo.
- **GUD-004**: Status flow: `new` → `in_progress` (admin apre) →
  `done` (export consegnato) | `rejected` (brief non valido). Nessuno
  stato intermedio complesso in v1.

### Patterns

- **PAT-001**: Endpoint inline in `api/index.ts` con pattern
  `if (path === '/intake' && method === 'POST')` (come tutti gli altri).
- **PAT-002**: Zod schema definito a livello modulo, non inline, per
  riutilizzo test.
- **PAT-003**: `consumeRateLimit(ip, 'intake', 5, 60 * 60 * 1000)` per
  rate limiting (funzione esistente).
- **PAT-004**: `json(req, res, status, data)` per response (funzione
  esistente, gestisce CORS).
- **PAT-005**: Admin guard `if (adminEmail !== ADMIN_EMAIL) return 403`
  (pattern esistente).

## 4. Interfaces & Data Contracts

### POST /api/intake (pubblico)

```json
Request body:
{
  "businessName": "Ristorante Da Mario",
  "ownerName": "Mario Rossi",
  "sector": "ristorante",
  "activity": "Ristorante di cucina sarda tradizionale, 40 coperti...",
  "mood": "moderno",
  "target": "Famiglie e turisti 30-60 anni",
  "preferredColors": "rosso, bianco, legno",
  "contacts": {
    "email": "mario@example.com",
    "phone": "+39 333 1234567",
    "address": "Via Roma 1, Cagliari",
    "website": ""
  },
  "package": "apertura",
  "sourceRef": "sheet_row_42"
}

Response 201 (nuovo):
{ "data": { "id": "intake_abc123", "status": "new", "updated": false } }

Response 200 (upsert, sourceRef già noto):
{ "data": { "id": "intake_abc123", "status": "new", "updated": true } }

Response 400 (validation):
{ "error": "Settore non valido" }

Response 429 (rate limit):
{ "error": "Troppi brief, riprova tra un'ora" }
```

### GET /api/intakes?status=new&adminEmail=admin@gmail.com (admin)

```json
Response 200:
{
  "data": [
    {
      "id": "intake_abc123",
      "status": "new",
      "businessName": "Ristorante Da Mario",
      "sector": "ristorante",
      "package": "apertura",
      "createdAt": "2026-07-20T10:00:00Z",
      "assignedTo": null
    }
  ]
}

Response 403 (non-admin):
{ "error": "Admin only" }
```

### GET /api/intakes/:id?adminEmail=admin@gmail.com (admin)

```json
Response 200:
{
  "data": {
    "id": "intake_abc123",
    "status": "new",
    "businessName": "Ristorante Da Mario",
    "ownerName": "Mario Rossi",
    "sector": "ristorante",
    "activity": "Ristorante di cucina sarda...",
    "mood": "moderno",
    "target": "Famiglie e turisti 30-60 anni",
    "preferredColors": "rosso, bianco, legno",
    "contacts": { "email": "...", "phone": "..." },
    "package": "apertura",
    "sourceRef": "sheet_row_42",
    "notes": null,
    "assignedTo": null,
    "createdAt": "2026-07-20T10:00:00Z",
    "updatedAt": "2026-07-20T10:00:00Z"
  }
}
```

### PATCH /api/intakes/:id (admin)

```json
Request body:
{ "adminEmail": "admin@gmail.com", "status": "in_progress", "notes": "Contattato via WhatsApp" }

Response 200:
{ "data": { "id": "intake_abc123", "status": "in_progress" } }
```

### Tabella `intakes` (schema)

```sql
CREATE TABLE intakes (
  id VARCHAR(50) PRIMARY KEY,
  status VARCHAR(20) DEFAULT 'new',
  businessName VARCHAR(255) NOT NULL,
  ownerName VARCHAR(255),
  sector VARCHAR(100),
  activity TEXT,
  mood VARCHAR(100),
  target TEXT,
  preferredColors TEXT,
  contacts JSONB,
  package VARCHAR(50) DEFAULT 'apertura',
  sourceRef VARCHAR(100) UNIQUE,
  notes TEXT,
  assignedTo VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Apps Script snippet (Google Sheet)

Il file sorgente versionato è `scripts/intake-google-form.gs`. Include
`sendToWebhook(payload)` (helper condiviso), `onFormSubmit(e)` (trigger),
`resendRowToWebhook(row)` (re-invio manuale), `aggiornaRiga(row)` (upsert
per correzioni foglio). L'endpoint `/api/intake` upserta: stesso sourceRef
→ UPDATE, non 409.

## 5. Acceptance Criteria

- **AC-001**: Given un form compilato con tutti i campi validi, When
  Apps Script manda POST a `/api/intake`, Then il server risponde 201
  e il brief è salvato in `intakes` con status `new`.
- **AC-002**: Given lo stesso sourceRef inviato 2 volte, When il
  secondo POST arriva, Then il server risponde 200 e UPDATE il record
  (non duplica, non 409).
- **AC-003**: Given un body con sector non valido (es. "fabbrica"),
  When POST /api/intake, Then 400 con messaggio "Settore non valido".
- **AC-004**: Given 6 POST /api/intake dalla stessa IP entro 1 ora,
  When il 6° arriva, Then 429 "Troppi brief, riprova tra un'ora".
- **AC-005**: Given admin autenticato, When GET /api/intakes?status=new,
  Then 200 con lista di brief con status new.
- **AC-006**: Given non-admin, When GET /api/intakes, Then 403.
- **AC-007**: (Rimosso 2026-08-01: il banner "Brief da lavorare" non
  esiste più in Collection.)
- **AC-008**: (Rimosso 2026-08-01: non c'è più click "Apri".)
- **AC-009**: (Rimosso 2026-08-01: non c'è più click "Apri".)
- **AC-010**: Given un brief con contacts.email valorizzato, When il
  server logga l'evento, Then il log NON contiene l'email (filtrato).
- **AC-011**: Given admin PATCH /api/intakes/:id con status `done`,
  When il brief viene aggiornato, Then sparisce dalla lista "new" e
  resta nello storico.
- **AC-012**: Given Tally.so webhook con stesso formato JSON, When
  POST /api/intake, Then il sistema lo accetta come Google Form
  (provider-agnostic).

## 6. Test Automation Strategy

- **Test Levels**: Unit (backend Zod + endpoint), Integration (DB),
  E2E (form → badge → editor → done)
- **Frameworks**: Vitest (backend + frontend), React Testing Library
  (componenti), Playwright (e2e)
- **Test Data Management**: mock Drizzle in backend test (pattern
  esistente `api/__tests__/helpers/apiTest.ts`), fixture JSON per
  payload intake, localStorage reset in frontend test
- **CI/CD Integration**: `npm run test` deve passare prima di push
  (AGENTS.md Pre-push Checklist)
- **Coverage Requirements**: minimo 60% su nuovi file (target progetto)
- **Performance Testing**: out of scope v1 (volume < 100/mese)

### Test file richiesti

- `api/__tests__/intake.test.ts`: 9 casi (POST valido, idempotenza,
  validation, rate limit, GET admin, GET non-admin, PATCH admin, PATCH
  non-admin, no PII in log)
- `src/components/__tests__/IntakeList.test.tsx`: 3 casi (render lista,
  click Apri, badge count)
- `src/utils/__tests__/intakeToDocument.test.ts`: 4 casi (mapping
  logo, card, flyer, social)
- `e2e/intake-pipeline.spec.ts`: 1 caso end-to-end (mock webhook →
  badge → editor → done)

## 7. Rationale & Context

**Perché Architettura A (ibrida) e non B (full-auto)**:

1. **Costo/effort**: A è 20h + €0/mo, B è 100h + €15-30/mo (headless
   browser su Render/Fly.io). Vercel Hobby non fa Puppeteer.
2. **Qualità**: A mantiene admin review (match BP "consegna 3 giorni
   con quality check"). B diventa SaaS self-service, modello che il
   founder ha esplicitamente escluso.
3. **Rischio**: B è fragile su Vercel (Puppeteer > 50MB, limite
   funzione). A riusa tutta infrastruttura esistente.
4. **Vantaggio competitivo**: il differenziale vs Durable è la qualità
   controllata. Toglierla = valere meno di Durable (loro $20M funding).

**Perché Google Form/Tally e non form interno**:

1. **Gratis**: Google Form + Apps Script €0, Tally.so €0 (1000/mese).
   Form interno richiede pagina pubblica, CAPTCHA, anti-spam, hosting
   file.
2. **Tempo**: Google Form si crea in 5 min. Form interno è 8-10h.
3. **Branding**: Tally.so è bello e personalizzabile. Google Form è
   funzionale. Per v1 basta. Branding totale sul form quando 50+
   clienti/mese.
4. **Idempotenza**: sourceRef (id riga Sheet) garantisce che retry
   webhook non duplica. Tally ha id evento nativo.

**Perché niente email notifica in v1**:

Badge Collection basta. L'admin apre Quickbrand 1-2 volte al giorno.
Aggiungere email (Resend, 3000/mese gratis) è 3h, ma risolve un problema
che non si è ancora manifestato. YAGNI.

## 8. Dependencies & External Integrations

### External Systems

- **EXT-001**: Google Forms — form pubblico per raccolta brief.
  Integrazione: Apps Script webhook → /api/intake.
- **EXT-002**: Google Sheets — storage risposte form, trigger Apps
  Script. Gratis, 20k righe.
- **EXT-003**: Tally.so (alternativa) — form pubblico con webhook
  nativo. Gratis 1000 risposte/mese.
- **EXT-004**: Google Apps Script — JavaScript runtime su server Google.
  Gratis, 6h/giorno esecuzione. Trigger onFormSubmit.

### Third-Party Services

- **SVC-001**: Neon Postgres — database `intakes` table. Free tier,
  0.5GB storage, sufficiente per 10k+ brief.
- **SVC-002**: Vercel Hobby — hosting endpoint `/api/intake`. Free,
  100k invocations/mese.

### Infrastructure Dependencies

- **INF-001**: `api/index.ts` esistente (monolith Vercel) — deve
  accettare nuovo endpoint inline.
- **INF-002**: `db/schema.ts` + mirror in `api/index.ts` — deve
  aggiungere tabella `intakes` (constraint schema duplication).
- **INF-003**: `src/utils/dataService.js` — deve aggiungere funzioni
  `getIntakes`, `updateIntake`, `createIntake` (pattern esistente).

### Data Dependencies

- **DAT-001**: Schema Drizzle `intakes` — source of truth, mirror in
  `api/index.ts`.
- **DAT-002**: Mappa `intakeToDocument.ts` — trasforma brief in `data`
  per ogni tipo documento (logo, card, flyer, social). Riusa schemi
  Zod esistenti in `documentSchemas.ts`.

### Technology Platform Dependencies

- **PLT-001**: Vercel Hobby — runtime Node.js serverless, no Puppeteer.
- **PLT-002**: Drizzle ORM — query builder, migrazione via
  `npm run db:generate` + `db:migrate`.
- **PLT-003**: React 18 + react-router-dom v6 — frontend, riusa
  CollectionView e editor esistenti.

### Compliance Dependencies

- **COM-001**: GDPR — form raccoglie PII (nome, email, telefono).
  Richiede privacy policy linkata nel form (TB-022) e diritto
  cancellazione. Dati in Postgres Neon (EU region).
- **COM-002**: Log filtering — server non logga PII (SEC-002),
  pattern esistente per unlock codes.

## 9. Examples & Edge Cases

### Esempio: payload valido da Google Form

```json
{
  "businessName": "B&B Costa Serena",
  "ownerName": "Lucia Ferraris",
  "sector": "b&b",
  "activity": "B&B 3 camere con vista mare, colazione inclusa, apertura aprile",
  "mood": "minimal",
  "target": "Coppie adulte, turisti nord europei",
  "preferredColors": "blu, sabbia, bianco",
  "contacts": {
    "email": "lucia@example.com",
    "phone": "+39 333 9876543",
    "address": "Via Costa 5, Villasimius",
    "website": ""
  },
  "package": "presenza",
  "sourceRef": "sheet_row_15"
}
```

### Edge case: sourceRef mancante (Tally senza riga Sheet)

Il campo `sourceRef` è optional nello Zod. Se mancante, il server
genera `sourceRef = 'auto_' + nanoid()` per garantire idempotenza
anche senza Sheet. Ma raccomandato: Tally passa sempre event_id nativo.

### Edge case: brief con campi vuoti

L'utente compila solo businessName e sector (minimi richiesti). Gli
altri campi sono optional. La pre-compilazione popola solo i campi
presenti. L'admin completa a mano o rigenera.

### Edge case: form compilato 2 volte dallo stesso cliente

sourceRef (id riga) è diverso per ogni risposta. Il server salva 2
intakes distinti. L'admin vede 2 brief e può mergerli o rifiutarne uno
(status `rejected`).

### Edge case: webhook fallito (Apps Script timeout)

Apps Script ha retry nativo (3 tentativi). Se tutti falliscono, il
brief resta solo in Sheet (non in Quickbrand). L'admin controlla il
Sheet manualmente 1 volta/settimana come fallback. Per Tally, webhook
retry nativo + log errori.

### Edge case: payload con sector valore enum non standard

Zod rifiuta con 400. Apps Script non retry (4xx = non transient). Il
brief resta in Sheet. L'admin vede il mismatch nel Sheet e corregge a
mano, poi re-invia via curl/script admin.

## 10. Validation Criteria

Per considerare la spec implementata:

1. Tutti gli AC-001..AC-012 passano (test automatici).
2. `npm run typecheck` verde.
3. `npm run test` verde (nuovi test + esistenti).
4. Migrazione DB applicata: `npm run db:migrate` senza errori.
5. Endpoint `/api/intake` risponde 201 a un curl con payload valido.
6. Idempotenza verificata: stesso sourceRef inviato 2 volte → 201 poi 409.
7. Rate limit verificato: 6 POST in 1 ora → 6° 429.
8. Badge count appare in sidebar con 3 brief new in DB.
9. Click "Apri" apre editor con campi pre-compilati (verifica manuale).
10. No PII in log server (verifica `console.error` output).
11. Apps Script snippet testato con Sheet reale (verifica manuale).
12. Privacy policy linkata nel form (TB-022 prereq).

## 11. Related Specifications / Further Reading

- `spec-api-saas-monetization.md` — Stripe integration (TB-011),
  trigger 15+ transazioni/mese. L'intake pipeline prepara il terreno
  per Stripe: quando il cliente paga online, il form può includere
  pagamento diretto.
- `docs/business-plan.md` §C (servizio fatto-per-te) — il modello
  operativo che l'intake pipeline supporta.
- `docs/to-be-done.md` TB-019 — traccia implementazione.
- `AGENTS.md` "API Schema Duplication" — constraint sul mirror schema
  in `api/index.ts`.
- `AGENTS.md` "Vercel Routing" — constraint monolith, endpoint inline.
- `AGENTS.md` "Auth Security" — pattern rate limit e admin guard.