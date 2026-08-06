---
title: Quickbrand CRM + Auto-Research & Auto-Build Pipeline
version: 1.0
date_created: 2026-07-28
owner: Giovanni
tags: [architecture, infrastructure, process, backend, frontend, crm]
---

# Introduction

Quickbrand smette di essere un generatore di documenti multi-utente con
signup pubblica e diventa un **CRM admin-only** orientato al cliente
(business). Ogni cliente è un record first-class; i documenti (logo,
card, flyer, social, quote, futuro sito) sono raggruppati per cliente.
L'admin (founder) lavora i clienti dentro l'app. La registrazione
pubblica è **disabilitata** ma il codice di signup/onboarding **non viene
cancellato** (riusabile per futura modalità whitelabel/SaaS).

Il flusso obiettivo: il cliente inserisce i dati minimi (via form intake
pubblico o admin manual) → parte un'automazione che cerca su internet
(indirizzo Google Maps, NAP, foto, logo se esistono, informazioni settore)
→ i campi vuoti sono riempiti da AI → l'app costruisce il brand kit
(logo, card, flyer, social) e in futuro il sito. L'admin fa quality
check obbligatorio prima della consegna.

Questa spec ridefinisce l'architettura dati, l'intake, l'auto-research,
l'auto-build e la riposizionamento della roadmap business.

## 1. Purpose & Scope

### Purpose

Trasformare Quickbrand da "editor documenti per utenti registrati" a
"CRM + pipeline automatica di brand building per clienti gestiti
dall'admin". L'obiettivo è ridurre il lavoro manuale per cliente da
2-3h a <30min tramite ricerca dati automatica e generazione AI guidata.

### Scope IN

- **Modello CRM**: tabella `customers`, documenti collegati a cliente.
- **Registrazione disabilitata**: signup pubblico off, admin crea
  clienti manualmente o via intake. Codice signup conservato (feature
  flag).
- **Intake riposizionato**: TB-019 NON è post-validazione. È la porta
  di ingresso del CRM. Form pubblico → record cliente → pipeline.
- **Auto-research pipeline**: dal nome attività + indirizzo (se noto)
  cercare su internet: Google Places/Maps (NAP, orari, categorie,
  foto), rilevamento logo esistente, foto locale/reale, recensioni.
- **AI gap-filling**: campi vuoti dopo research → AI decide (settore
  default, mood, target, palette) basandosi su settore + nome.
- **Auto-build brand kit**: dai dati raccolti pre-compilare +
  (opzionale) generare automaticamente logo, card, flyer, social.
  L'admin review resta obbligatoria (CON-001).
- **Rivisita roadmap**: to-be-done.md ristrutturato per riflettere
  la nuova priorità (CRM + intake prima, non dopo 5+ clienti).

### Scope OUT (questa spec)

- **Implementazione codice**: questa spec è solo design. Nessun
  codice viene scritto in questa fase.
- **Sito publish automatico**: TB-012 resta spec separata, qui solo
  accenno come modulo futuro del brand kit.
- **Stripe / monetizzazione self-service**: `spec-api-saas-monetization`
  resta traccia separata. Il CRM è admin-only, non SaaS pubblico.
- **Portal cliente self-service**: out of scope v1. Il cliente non ha
  account, vede deliverable via email/WhatsApp dall'admin.
- **Whitelabel attivo**: il codice signup è conservato ma NON
  esposto. Riattivazione è decisione business futura, non tecnica.

### Audience

Founder (admin unico in v1). Sviluppatori che estendono l'app.
Collaboratori futuri (admin aggiuntivi manuali).

### Assumptions

- App Quickbrand esiste e funziona (15 fasi, 2500+ test).
- Orchestratori AI (logo, card, flyer, social) già costruiti.
- Vercel Hobby + Neon free tier (costo €0 ricorrente).
- Google Places API free tier sufficiente per volume < 100
  clienti/mese (vedi §8 dipendenze).

## 2. Definitions

| Termine | Definizione |
|---------|-------------|
| **Cliente** | Business per cui l'admin costruisce brand kit. Record in `customers`. Non ha account Quickbrand. |
| **CRM** | Modulo gestione clienti: lista, dettaglio, documenti collegati, status pipeline. |
| **Intake** | Primo contatto strutturato: form pubblico (Google Form/Tally) o inserimento admin manuale. |
| **Brief** | Dati minimi cliente: businessName, settore, contatti, pacchetto. |
| **Auto-research** | Pipeline automatica che arricchisce il brief cercando su internet (Google Places, foto, logo, NAP). |
| **Gap-filling AI** | AI riempie campi vuoti dopo research (mood, target, palette, copy default) basandosi su settore. |
| **Auto-build** | Pre-compilazione + generazione AI opzionale di logo/card/flyer/social dai dati arricchiti. |
| **Brand kit** | Insieme documenti di un cliente: logo + card + flyer + social (+ futuro sito). |
| **Quality check** | Revisione umana obbligatoria dell'admin prima di consegnare output al cliente. |
| **Feature flag** | `REGISTRATION_ENABLED` env var, default `false`. Codice signup conservato, non esposto. |
| **NAP** | Name, Address, Phone — dati standard local SEO. |
| **Whitelabel** | Modalità futura in cui Quickbrand viene venduto ad altre agenzie con signup propria. Codice conservato per questo. |

## 3. Requirements, Constraints & Guidelines

### Functional Requirements — CRM

- **REQ-CRM-001**: Aggiungere tabella `customers` (id, businessName,
  ownerName, sector, contacts JSONB, package, status, source
  'manual'|'intake', intakeId FK nullable, logoUrl, placeId, placeData
  JSONB, notes, assignedTo, createdAt, updatedAt).
- **REQ-CRM-002**: Aggiungere colonna `customerId` (FK nullable) a
  `documents`. Retrocompatibile: documenti esistenti hanno
  `customerId = null` (non collegati, visibili in "Documenti sciolti").
- **REQ-CRM-003**: L'admin vede una vista "Clienti" (CRM) in sidebar
  sopra "Collection". Lista clienti con status pipeline, numero
  documenti, ultimo aggiornamento.
- **REQ-CRM-004**: Click su cliente → dettaglio cliente: dati brief,
  dati research (placeData), lista documenti collegati, bottone
  "Aggiungi documento" (logo/card/flyer/social/quote), bottone "Lancia
  auto-build".
- **REQ-CRM-005**: `documents.customerId` popolato automaticamente
  quando un documento è creato dal contesto cliente.
- **REQ-CRM-006**: Collection esistente filtra per cliente via
  dropdown. Default: "Tutti". Documenti senza cliente → gruppo
  "Sciolti".

### Functional Requirements — Registrazione

- **REQ-REG-001**: Signup pubblico disabilitato di default. Variabile
  d'ambiente `REGISTRATION_ENABLED` (default `false`). Se `false`,
  `POST /api/register` risponde 403 "Registrazione non disponibile".
- **REQ-REG-002**: Codice di signup, onboarding,LoginPage register form
  **non cancellati**. Nascosti dietro feature flag. Commento
  `// WHITELABEL: riattivare con REGISTRATION_ENABLED=true`.
- **REQ-REG-003**: Login resta attivo per admin (email + password).
- **REQ-REG-004**: Nessun utente non-admin può registrarsi. L'admin
  crea clienti in CRM senza account Quickbrand (il cliente non accede
  all'app).

### Functional Requirements — Intake (riposizionato)

- **REQ-INT-001**: Riusa spec `spec-intake-pipeline.md` per endpoint
  `/api/intake`, tabella `intakes`, webhook form. **Modifica**: ogni
  intake crea anche un record `customers` (source='intake',
  intakeId FK) oltre all'intake stesso.
- **REQ-INT-002**: Intake non è più "post 5+ clienti". È la porta di
  ingresso del CRM. Priorità: **subito dopo qualità prodotto**,
  prima di landing generator (TB-012) e monetizzazione.
- **REQ-INT-003**: L'admin può anche creare un cliente manualmente
  (REQ-CRM-004 "Aggiungi cliente") senza passare dal form.

### Functional Requirements — Auto-Research

- **REQ-AR-001**: Endpoint `POST /api/customers/:id/research` (admin)
  lancia la pipeline di auto-research per un cliente.
- **REQ-AR-002**: Step 1 — Google Places API: query da businessName +
  indirizzo (se presente). Se match, salva `placeId` + `placeData`
  (NAP, orari, categorie, rating, foto refs).
- **REQ-AR-003**: Step 2 — Foto rilevamento: se Places restituisce
  foto, scaricarle (proxy server-side, clamp 500KB) e salvarle come
  `customerPhotos` JSONB array di data URL.
- **REQ-AR-004**: Step 3 — Logo rilevamento: se il cliente ha un
  sito (da Places website o campo contacts.website), fetch homepage +
  estrai `<img>` / favicon candidate. Salva `detectedLogoUrl` (data
  URL, clamp 200KB).
- **REQ-AR-005**: Step 4 — Settore inferenza: se settore non specificato
  nel brief, AI inferisce da Places categories + nome attività. Salva
  in `customers.sector`.
- **REQ-AR-006**: Tutti gli step sono **best-effort**: fallimenti
  parziali non bloccano. Status pipeline traccia quali step sono
  riusciti/falliti in `customers.researchStatus` JSONB.
- **REQ-AR-007**: Rate limit: 1 research per cliente per ora (evita
  abuso Places API quota).

### Functional Requirements — AI Gap-Filling

- **REQ-AI-001**: Endpoint `POST /api/customers/:id/ai-fill` (admin)
  riempie i campi del brief ancora vuoti dopo research usando AI.
- **REQ-AI-002**: Campi target: mood, target, preferredColors,
  activity descrizione, copy default flyer/social. Basati su settore
  + placeData + nome.
- **REQ-AI-003**: Riusa orchestratori esistenti (DeepSeek copy). I
  campi AI sono marcati `aiSuggested: true` in placeData; l'admin può
  overrides.
- **REQ-AI-004**: Costi AI tracciati (TB-026 aiStats) per cliente.

### Functional Requirements — Auto-Build

- **REQ-AB-001**: Endpoint `POST /api/customers/:id/auto-build` (admin)
  crea documenti draft (logo, card, flyer, social) pre-compilati dai
  dati cliente + research + AI fill.
- **REQ-AB-002**: Pre-compilazione riusa `intakeToDocument` (spec
  intake) esteso con dati research (logoUrl detected, foto place,
  indirizzo, settore).
- **REQ-AB-003**: Auto-build **non genera** automaticamente gli SVG
  finali. Crea draft con campi popolati. L'admin attiva AI per ogni
  modulo manualmente (CON-001 quality check).
- **REQ-AB-004**: Opzione `autoGenerate: boolean` nel body: se true,
  lancia anche `generateLogo`/`generateCard`/`generateFlyer` AI in
  sequenza (non parallelo, per rate limit Gemini). Default false
  (solo draft). L'admin vede comunque output prima di applicare.

### Security Requirements

- **SEC-001**: Endpoint `/api/customers*` e `/api/customers/:id/research|ai-fill|auto-build`
  richiedono `adminEmail=admin@gmail.com` (pattern esistente). 403 per
  non-admin.
- **SEC-002**: Firecrawl API key solo server-side (`FIRECRAWL_API_KEY`
  env var). Mai esposta al browser.
- **SEC-003**: Fetch di siti terzi (logo detection) server-side solo.
  Sanitizza URL, niente SSRF verso IP interni (allow http/https,
  reject private ranges).
- **SEC-004**: Foto Places scaricate via proxy server, clamp 500KB,
  sanificazione MIME type.
- **SEC-005**: PII clienti (email, telefono) non loggati server-side
  (pattern esistente SEC-002 intake).
- **SEC-006**: Rate limit research: 1/ora per cliente. Rate limit
  ai-fill: 5/ora per cliente. Auto-build: 3/ora per cliente.

### Constraints

- **CON-001**: Admin review obbligatorio. Nessun output AI va al
  cliente senza click esplicito "Genera" + review. Match BP "consegna
  3 giorni con quality check".
- **CON-002**: Vercel Hobby: niente Puppeteer. Ricerca web via API
  ufficiali (Google Places) + fetch HTTP server-side (node fetch).
  Niente headless browser.
- **CON-003**: Monolite `api/index.ts` rimane. Nuovi endpoint
  `/api/customers*` inline (pattern esistente).
- **CON-004**: Schema duplication: `customers` in `db/schema.ts` +
  mirror in `api/index.ts` (AGENTS.md).
- **CON-005**: Google Places API free tier: 2850 richieste/mese
  (Places Details). Sufficiente per < 100 clienti/mese. Foto Places
  richiedono Places Photo API (quota separata).
- **CON-006**: `documents.customerId` FK nullable per retrocompatibilità.
  Documenti esistenti (pre-CRM) non vengono migrati forzatamente.
- **CON-007**: Codice signup/onboarding conservato. Feature flag
  `REGISTRATION_ENABLED`. Niente cancellazione di LoginPage register
  form, `/api/register`, onboarding wizard.

### Guidelines

- **GUD-001**: Privilegiare Google Places su scraping HTML. Places ha
  NAP strutturato, foto, categorie — gratis fino a 2850/mese. Scraping
  è fragile e legalmente grigio.
- **GUD-002**: Logo detection best-effort: molti siti non hanno logo
  machine-readable. Se fallisce, AI genera da nome. Non bloccare.
- **GUD-003**: Auto-build default = draft solo. `autoGenerate: true`
  è opzione esplicita admin che vuole risparmiare click ma accetta
  di rivedere output AI per ogni modulo.
- **GUD-004**: Feature flag `REGISTRATION_ENABLED` documentato in
  `.env.example` con commento whitelabel.
- **GUD-005**: Il CRM è la nuova "home" dell'app. L'admin apre e vede
  "Clienti da lavorare" (status pipeline). Collection diventa
  secondaria (archivio documenti).
- **GUD-006**: Un cliente può avere più brand kit nel tempo (es.
  rebrand). `customers` + `documents` 1:N. Nessuna tabella brand kit
  separata in v1 (YAGNI).

### Patterns

- **PAT-001**: Endpoint inline `api/index.ts` con `if (path === ...)`
  (pattern esistente).
- **PAT-002**: Zod schema a livello modulo per riutilizzo test.
- **PAT-003**: `consumeRateLimit(ip, 'research', 1, 60*60*1000)`.
- **PAT-004**: `json(req, res, status, data)` response.
- **PAT-005**: Admin guard `adminEmail !== ADMIN_EMAIL → 403`.
- **PAT-006**: `await (await getDb()).select()...` (await su catena,
  gotcha §1.2).
- **PAT-007**: Feature flag lettura `process.env.REGISTRATION_ENABLED === 'true'`.

## 4. Interfaces & Data Contracts

### Tabella `customers` (schema)

```sql
CREATE TABLE customers (
  id VARCHAR(50) PRIMARY KEY,
  businessName VARCHAR(255) NOT NULL,
  ownerName VARCHAR(255),
  sector VARCHAR(100),
  activity TEXT,
  mood VARCHAR(100),
  target TEXT,
  preferredColors TEXT,
  contacts JSONB,
  package VARCHAR(50) DEFAULT 'apertura',
  source VARCHAR(20) DEFAULT 'manual',   -- 'manual' | 'intake'
  intakeId VARCHAR(50),                   -- FK intakes.id nullable
  status VARCHAR(30) DEFAULT 'new',       -- new | researching | researched | building | done | rejected
  logoUrl TEXT,                            -- detected/uploaded logo (data URL)
  placeId VARCHAR(100),                   -- Google Places ID
  placeData JSONB,                        -- NAP, orari, categorie, foto refs
  customerPhotos JSONB,                    -- array data URL foto Places
  detectedLogoUrl TEXT,
  researchStatus JSONB,                    -- { places: 'ok'|'fail', photos: ..., logo: ..., sector: ... }
  aiSuggestedFields JSONB,                 -- campi riempiti da AI (marcati)
  notes TEXT,
  assignedTo VARCHAR(255),
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

### Modifica `documents` (schema)

```sql
ALTER TABLE documents
  ADD COLUMN customer_id VARCHAR(50) REFERENCES customers(id);
  -- nullable per retrocompatibilità
```

### POST /api/customers (admin, manuale)

```json
Request body:
{ "adminEmail": "admin@gmail.com", "businessName": "Bar XYZ", "sector": "bar", "contacts": { "address": "..." } }

Response 201:
{ "data": { "id": "cust_abc", "status": "new" } }
```

### POST /api/customers/:id/research (admin)

```json
Response 202 (async, avvia pipeline):
{ "data": { "id": "cust_abc", "researchStatus": "running" } }
```

Pipeline aggiorna `customers.researchStatus` + `placeData` + foto.
L'admin polling `GET /api/customers/:id` vede stato.

### POST /api/customers/:id/ai-fill (admin)

```json
Response 200:
{ "data": { "id": "cust_abc", "aiSuggestedFields": { "mood": "moderno", "target": "...", "preferredColors": "..." } } }
```

### POST /api/customers/:id/auto-build (admin)

```json
Request body:
{ "adminEmail": "admin@gmail.com", "autoGenerate": false }

Response 201:
{ "data": { "customerId": "cust_abc", "createdDocuments": ["logo_1", "card_1", "flyer_1", "social_1"] } }
```

### GET /api/customers?status=new&adminEmail=... (admin)

Lista clienti con status, count documenti, ultimo update.

### GET /api/customers/:id?adminEmail=... (admin)

Dettaglio cliente completo (brief + research + documenti collegati).

### Feature flag registrazione

```
REGISTRATION_ENABLED=false   # WHITELABEL: impostare true per riattivare signup pubblico
```

## 5. Acceptance Criteria

- **AC-CRM-001**: Given admin autenticato, When GET /api/customers,
  Then 200 con lista clienti.
- **AC-CRM-002**: Given non-admin, When GET /api/customers, Then 403.
- **AC-CRM-003**: Given admin crea cliente manuale, When POST
  /api/customers, Then 201 con record `customers` source='manual'.
- **AC-CRM-004**: Given intake form inviato, When webhook /api/intake,
  Then crea record `intakes` AND `customers` (source='intake',
  intakeId FK).
- **AC-CRM-005**: Given cliente con 3 documenti, When GET
  /api/customers/:id, Then response include array documenti
  collegati.
- **AC-REG-001**: Given REGISTRATION_ENABLED non set o false, When
  POST /api/register, Then 403 "Registrazione non disponibile".
- **AC-REG-002**: Given REGISTRATION_ENABLED=true, When POST
  /api/register con dati validi, Then 201 (comportamento legacy
  conservato).
- **AC-REG-003**: Given LoginPage render, Then form di registrazione
  è nascosto quando REGISTRATION_ENABLED=false (flag esposto via
  `/api/config` o env client).
- **AC-INT-001**: Given intake valido, When pipeline completa, Then
  `customers.status` = 'new' e `intakes.status` = 'new'.
- **AC-AR-001**: Given cliente con businessName "Bar Da Mario" +
  indirizzo, When POST /api/customers/:id/research, Then Places API
  chiamata, placeData salvato se match trovato.
- **AC-AR-002**: Given Places restituisce foto, When research
  completa, Then `customerPhotos` array popolato con data URL clamp
  500KB.
- **AC-AR-003**: Given cliente senza indirizzo, When research, Then
  Places query fallback su solo businessName (best-effort, può non
  trovare).
- **AC-AR-004**: Given research fallisce (Places quota), When
  pipeline, Then `researchStatus.places = 'fail'` ma cliente non
  bloccato, auto-build può procedere con AI fill.
- **AC-AI-001**: Given cliente researched con mood vuoto, When POST
  /api/customers/:id/ai-fill, Then mood popolato con `aiSuggested:
  true`.
- **AC-AB-001**: Given cliente researched + ai-filled, When POST
  /api/customers/:id/auto-build con autoGenerate=false, Then 4
  documenti draft creati con customerId popolato e campi
  pre-compilati.
- **AC-AB-002**: Given autoGenerate=true, When auto-build, Then 4
  documenti draft creati AND AI generate lanciata in sequenza
  (logo, card, flyer, social).
- **AC-SEC-001**: Given non-admin, When POST
  /api/customers/:id/research, Then 403.
- **AC-SEC-002**: Given PII in contacts, When server logga evento
  cliente, Then log NON contiene email/telefono.
- **AC-CON-001**: Given auto-build completato, When admin apre
  documento draft, Then vede output AI ma non è "consegnato" finché
  non click "Salva/Applica" esplicito.

## 6. Test Automation Strategy

- **Test Levels**: Unit (backend Zod + endpoint), Integration (DB
  mock), E2E (intake → CRM → research mock → auto-build → review).
- **Frameworks**: Vitest (backend + frontend), RTL (componenti),
  Playwright (e2e).
- **Test Data**: fixture `sampleCustomer.json`, `sampleIntake.json`,
  mock Places API responses in `api/__tests__/fixtures/places*.json`.
- **Coverage**: min 60% su nuovi file.
- **Mock Google Places**: no chiamate reali in test; factory
  `createMockPlacesResponse(opts)`.

### Test file richiesti (indicativi, pre-implementazione)

- `api/__tests__/customers.test.ts`: CRUD admin guard, non-admin 403.
- `api/__tests__/customerResearch.test.ts`: Places mock, foto clamp,
  logo detection, fail soft.
- `api/__tests__/customerAiFill.test.ts`: AI fill campi, tracking
  costi.
- `api/__tests__/customerAutoBuild.test.ts`: draft creation,
  autoGenerate true/false, customerId propagation.
- `api/__tests__/registrationFlag.test.ts`: REGISTRATION_ENABLED
  false → 403, true → 201.
- `src/components/__tests__/CustomerList.test.tsx`: render lista,
  status badge.
- `src/components/__tests__/CustomerDetail.test.tsx`: dettaglio +
  documenti collegati + bottoni azione.
- `e2e/crm-pipeline.spec.ts`: intake mock → cliente → research mock
  → auto-build → admin review.

## 7. Rationale & Context

### Perché CRM e non editor multi-utente

Il modello "utenti registrati creano documenti propri" non ha
validato: nessun cliente vuole imparare l'app. Il modello che funziona
è founder-fatto-per-te (BP §C): il cliente paga per il risultato, non
per lo strumento. Il CRM riflette questo: l'admin lavora, il cliente
non accede. Riduce friction a zero per il cliente.

### Perché conservare il codice signup

Whitelabel futuro: se Quickbrand si vende come strumento ad altre
agenzie, la modalità multi-utente riattiva. Cancellare codice = lavoro
perso. Feature flag è 1 riga. lean-code: non cancellare ciò che ha
valore futuro noto.

### Perché auto-research con Google Places

1. **Strutturato**: Places dà NAP, orari, categorie, foto — dati che
   scraping HTML non dà in modo affidabile.
2. **Gratis**: 2850 req/mese free, sufficiente bootstrap.
3. **Stabile**: API ufficiale, niente fragilità scraping.
4. **Foto**: Places Photo API dà foto reali del locale (utile per
   flyer/card hero).

### Perché AI gap-filling separato da research

Research è dati fattuali (Place esiste o no). AI gap-filling è
creativo (mood, target, palette). Separare permette retry indipendente
e tracking costi AI separato (TB-026 aiStats).

### Perché auto-build non genera in automatico di default

CON-001 quality check. L'admin vuole vedere i draft pre-compilati
prima di spendere token AI su generazione. `autoGenerate: true` è
opzione esplicita per chi vuole risparmiare click ma accetta review
post-generation.

### Riposizionamento TB-019

Originale: "SOLO dopo 5+ clienti reali (volume giustifica infra)".
Nuovo: intake è la porta del CRM. Senza intake, il CRM è manuale
(solo admin inserisce). L'intake è prerequisito del CRM, non post-
validazione. La roadmap viene ristrutturata in to-be-done.md.

## 8. Dependencies & External Integrations

### External Systems

- **EXT-001**: Firecrawl — scraping sito cliente per testo, branding,
  logo. Key `FIRECRAWL_API_KEY` server-side.
- **EXT-002**: Gemini Embeddings (`gemini-embedding-2`) — RAG sui chunk
  salvati in `customer_knowledge`.
- **EXT-003**: Google Forms / Tally.so — intake form (riuso spec
  intake-pipeline).
- **EXT-004**: HTTP fetch server-side — logo detection da sito cliente
  (homepage, favicon).

### Third-Party Services

- **SVC-001**: Neon Postgres — tabelle `customers`, `intakes`.
- **SVC-002**: Vercel Hobby — endpoint `/api/customers*`, `/api/intake`.
- **SVC-003**: DeepSeek API — AI gap-filling copy (riuso orchestratori).
- **SVC-004**: Google Gemini — AI immagini logo/cover/hero (esistente).

### Infrastructure Dependencies

- **INF-001**: `api/index.ts` monolith — nuovi endpoint inline.
- **INF-002**: `db/schema.ts` + mirror `api/index.ts` — tabelle
  `customers`, colonna `documents.customerId`.
- **INF-003**: `src/utils/dataService.js` — funzioni
  `getCustomers`, `createCustomer`, `researchCustomer`, ecc.
- **INF-004**: Feature flag system — lettura env `REGISTRATION_ENABLED`
  + `/api/config` endpoint per client.

### Data Dependencies

- **DAT-001**: Schema Drizzle `customers` — source of truth, mirror in
  `api/index.ts`.
- **DAT-002**: `intakeToDocument` esteso con dati research (riuso
  spec intake + estensione).
- **DAT-003**: `documentSchemas.ts` — nessun cambiamento, i documenti
  restano identici, solo `customerId` aggiunto.

### Technology Platform Dependencies

- **PLT-001**: Vercel Hobby — no Puppeteer, solo API HTTP + fetch.
- **PLT-002**: Drizzle ORM — migrazione `customers` + `documents`
  alter.
- **PLT-003**: React 18 + react-router-dom v6 — nuove route
  `/app/customers`, `/app/customers/:id`.

### Compliance Dependencies

- **COM-001**: GDPR — form intake raccoglie PII. Privacy policy
  (TB-022) prereq. Dati clienti in Postgres Neon (EU region).
- **COM-002**: Logo detection da siti terzi — fair use per ricerca
  interna, non redistribuire logo altrui. Se cliente non possiede
  logo, AI genera.
- **COM-003**: Foto Places — licenza Google Places API permette uso
  interno. Non redistribuire senza permesso cliente.

## 9. Examples & Edge Cases

### Esempio: intake → research → ai-fill → auto-build

1. Cliente compila Tally: "Ristorante Da Mario", settore
   "ristorante", indirizzo "Via Roma 1, Cagliari", email.
2. Webhook → `/api/intake` → `intakes` + `customers` creati.
3. Admin apre CRM → vede cliente "Ristorante Da Mario" status `new`.
4. Click "Lancia research" → Places trova place, salva NAP + 3 foto,
   rileva logo da sito. Status `researched`.
5. Click "AI fill" → mood "caldo tradizionale", target "famiglie
   30-60", palette "rosso/legno/bianco". Status `researched` (ai
   suggested).
6. Click "Auto-build" (autoGenerate=false) → 4 draft creati: logo
   (primaryText="Ristorante Da Mario", detectedLogoUrl), card
   (name=ownerName, company, contacts, foto place), flyer (title,
   settore, foto hero place), social (derivato).
7. Admin apre ogni draft, click "Genera" AI, review, esporta.

### Edge case: cliente senza sito, senza foto, senza indirizzo

Research: Places query su solo businessName. Se match vago,
`researchStatus.places = 'weak'`. Foto: niente. Logo: niente.
AI fill: genera tutto da settore + nome. Auto-build: draft con
placeholder AI-generated. L'admin corregge a mano dove serve.

### Edge case: cliente con logo esistente forte

Logo detection trova logo vettoriale sul sito. `detectedLogoUrl`
salvato. Auto-build logo draft usa `detectedLogoUrl` come
`logoUrl` (non rigenera AI). L'admin può scegliere "mantieni" o
"rigenera AI".

### Edge case: Places quota esaurita

`researchStatus.places = 'quota_exceeded'`. Pipeline non blocca.
AI fill può procedere con solo nome. Admin notificato via badge
"research parziale".

### Edge case: signup attempt con flag off

`POST /api/register` → 403. LoginPage nasconde tab "Registrati".
Messaggio: "Registrazione chiusa. Contattaci per un account." Link
WhatsApp/email.

### Edge case: whitelabel riattivato

Admin imposta `REGISTRATION_ENABLED=true` in Vercel env. Signup
riappare. Il codice non è stato cancellato, niente work duplicato.

## 10. Validation Criteria

Per considerare la spec implementata:

1. Tutti gli AC-CRM/REG/INT/AR/AI/AB/SEC passano.
2. `npm run typecheck` verde.
3. `npm run test` verde (nuovi + esistenti).
4. Migrazione DB applicata: `customers` table + `documents.customerId`.
5. `REGISTRATION_ENABLED=false` default → signup 403.
6. `REGISTRATION_ENABLED=true` → signup 201 (legacy).
7. Intake form crea `customers` + `intakes`.
8. Research pipeline: Places mock → placeData salvato.
9. AI fill: campi popolati con `aiSuggested: true`.
10. Auto-build: 4 draft con `customerId` popolato.
11. CRM UI: lista clienti + dettaglio + azioni.
12. Collection: filtro per cliente funzionante.
13. No PII in log server.
14. Codice signup conservato, commentato `// WHITELABEL`.

## 11. Related Specifications / Further Reading

- `spec-intake-pipeline.md` — base per endpoint `/api/intake` +
  tabella `intakes`. Estesa per creare `customers`.
- `spec-api-saas-monetization.md` — Stripe / API keys. Traccia
  futura, non blocca CRM. Whitelabel può riattivare signup.
- `docs/to-be-done.md` — roadmap riposizionata (TB-019 prima, non
  dopo 5+ clienti; TB-027 CRM aggiunto).
- `docs/business-plan.md` §C (servizio fatto-per-te) — modello
  operativo che il CRM supporta.
- `AGENTS.md` "API Schema Duplication" — constraint mirror schema.
- `AGENTS.md` "Vercel Routing" — monolith, endpoint inline.
- `AGENTS.md` "Auth Security" — pattern rate limit + admin guard.