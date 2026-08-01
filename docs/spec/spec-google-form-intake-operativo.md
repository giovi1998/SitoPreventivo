---
title: Google Form Intake — Setup Operativo (webhook → /api/intake)
version: 1.0
date_created: 2026-08-01
owner: Founder
tags: [process, infrastructure, external-integration, gdpr]
---

# Introduction

Specifica il setup operativo del Google Form di intake: il form pubblico,
lo script Apps Script (webhook) e il trigger che alimentano il CRM
Quickbrand via `POST /api/intake`. Il backend dell'endpoint è già
implementato e testato (spec `spec-intake-pipeline.md`, TB-019); questa
spec chiude il gap residuo: la porta di ingresso reale dei clienti.

## 1. Purpose & Scope

**Purpose**: rendere operativo il Google Form che porta i clienti (senza
account) nel CRM come brief + record `customers` (`source='intake'`), pronto
per research → AI fill → auto-build → review → consegna.

**Scope**:
- Google Form pubblico (campi business UX-friendly + branching sito web)
- Google Sheet collegato alle risposte
- Apps Script versionato (`scripts/intake-google-form.gs`) → webhook
- Trigger `onFormSubmit`
- Idempotenza via `sourceRef = 'sheet_row_<n>'`
- **Auto-research**: se il cliente ha un sito web, scraping Firecrawl
  automatico dentro POST `/api/intake` (best-effort)
- **webAnswers**: risposte del form per la futura landing page, salvate su
  `intakes` + `customers` (generazione landing = sottoclasse in to-be-done)
- Verifica end-to-end (form → Sheet → CRM)
- Link privacy policy nel form (TB-022 prereq)

**Out of scope**:
- **Generazione landing page da `webAnswers`** (TB-012 step 2 — to-be-done)
- Modifica backend `/api/intake` (già live in `api/index.ts`) — in questa
  iterazione è stato esteso (webAnswers + auto-research)
- Form interno alla webapp (scelta deliberata: provider esterno gratis)
- Email/WhatsApp notifica admin
- Tally.so / Typeform (provider alternativi documentati in guida)
- Upload file nel form

**Intended audience**: founder (unico admin, crea e gestisce il form).

**Assumptions**:
- Endpoint `/api/intake` deployato su Vercel e raggiungibile
- Account Google del founder (Form/Sheet/Apps Script gratis)
- La tabella `intakes` + `customers` esiste in Neon (migrazione TB-019
  applicata); migrazione `web_answers` applicata al deploy (build =
  `db:migrate`)

## 2. Definitions

- **Intake**: primo contatto strutturato con un cliente (brief dati)
- **Webhook**: POST HTTP da Apps Script a `/api/intake`
- **sourceRef**: identificatore univoco della risposta (riga Sheet) per idempotenza
- **Apps Script**: runtime JS di Google, esegue su trigger di form submit
- **CRM**: sezione `/app/customers` di Quickbrand
- **COL map**: costante in Apps Script che mappa indice colonna Sheet → campo JSON

## 3. Requirements, Constraints & Guidelines

### Functional Requirements

- **REQ-001**: Il Google Form deve avere i campi business UX-friendly
  nell'ordine definito dalla COL map (Tabella in §4): Nome attività
  (obbligatorio), Referente, Settore (helper), Descrizione attività (helper),
  Stile/atmosfera (ex "Mood", helper), Target (helper), Colori preferiti
  (helper), Email (obbligatorio, validata), Telefono, Indirizzo, sezione
  sito web con branching, sezione landing (5 domande), Pacchetto (dropdown
  `apertura|presenza|custom`, default `apertura`).
- **REQ-001a**: Il campo sito web usa branching condizionale nativo
  (Sì/No → se Sì sezione URL, se No salta a sezione landing).
- **REQ-001b**: La sezione landing raccoglie 5 risposte salvate in
  `webAnswers`: wantsPage, headline, offer, cta, tone (generazione landing
  NON implementata, vedi to-be-done).
- **REQ-001c**: Campo "Mood" rinominato "Stile/atmosfera" con helper text
  (chiarezza per l'utente, stessa chiave `mood`).
- **REQ-001d**: `testWebhook()` nel `.gs` per diagnosi catena webhook→DB.
- **REQ-002**: Il form deve essere collegato a un Google Sheet (Risposte →
  Collega a Sheets) per avere riga univoca → `sourceRef`.
- **REQ-003**: Lo script webhook deve essere versionato nel repo a
  `scripts/intake-google-form.gs` (fonte unica di verità, non codice inline
  in docs).
- **REQ-004**: `WEBHOOK_URL` deve puntare a `https://quickbrand.vercel.app/api/intake` (già settato in `scripts/intake-google-form.gs`).
- **REQ-005**: Il trigger `onFormSubmit` deve essere configurato su "Invio
  modulo" nel pannello Triggers di Apps Script.
- **REQ-006**: `sourceRef` deve essere `'sheet_row_' + e.range.getRow()` per
  garantire idempotenza (retry webhook → 409, nessun duplicato).
- **REQ-007**: Una risposta valida deve produrre: nuova riga Sheet + record
  `intakes` (status `new`) + record `customers` (`source='intake'`,
  `intakeId` FK) visibili in CRM.
- **REQ-007a**: Il POST `/api/intake` deve accettare `webAnswers`
  (oggetto JSON arbitrario, validato come `z.record(z.string(), z.unknown())`)
  e salvarlo su `intakes.webAnswers` + `customers.webAnswers`.
- **REQ-007b**: Auto-research: se `contacts.website` è URL http(s) valido,
  POST `/api/intake` deve lanciare `runCustomerResearch` (pipeline Firecrawl
  condivisa con l'endpoint admin) in best-effort — il 201 non fallisce mai
  per research; senza `FIRECRAWL_API_KEY` → `researchStatus.web='no_key'`.
- **REQ-008**: Il form deve includere un link alla privacy policy (TB-022)
  perché raccoglie PII.

### Security Requirements

- **SEC-001**: Lo script deve loggare SOLO `sourceRef` + status code HTTP,
  mai PII (email/telefono). Il backend già filtra PII dai log server.
- **SEC-002**: Nessun segreto nel file Apps Script: `WEBHOOK_URL` è pubblico,
  nessuna API key.
- **SEC-003**: Anti-spam gestito dal backend (rate limit 5/ora/IP su
  `/api/intake`) — nessuna logica client.
- **SEC-004**: `muteHttpExceptions: true` per non esporre stack al foglio.

### Constraints

- **CON-001**: Nessuna modifica a `api/index.ts` o `db/schema.ts`: endpoint
  e tabelle già in prod.
- **CON-002**: L'ordine dei campi nel form è immutabile dopo il primo
  submit: l'indice colonna Sheet (COL map) si rompe se si inserisce/sposta
  una domanda. Documentare nel form stesso.
- **CON-003**: Limiti free Google: 20k righe Sheet, 6h/giorno Apps Script.
  Ampiamente sotto a 100 clienti/mese.
- **CON-004**: Modifica del dominio Vercel richiede aggiornare
  `WEBHOOK_URL` e risalvare lo script.

### Guidelines

- **GUD-001**: Creare il form solo dopo aver messo `WEBHOOK_URL` reale nel
  file `.gs` (evita test contro endpoint inesistente).
- **GUD-002**: Testare subito con 1 risposta reale e verificare il record
  in CRM prima di diffondere il link.
- **GUD-003**: Se il webhook fallisce, il brief resta comunque in Sheet
  (fallback manuale 1×/settimana).

### Patterns

- **PAT-001**: Apps Script come file singolo autocontenuto
  (`scripts/intake-google-form.gs`), due funzioni piccole:
  `onFormSubmit` (orchestrazione) + `buildIntakePayload` (mapping puro).
- **PAT-002**: COL map come costante nominata — mai indici magici inline.
- **PAT-003**: `Logger.log` per diagnosi, formato `[intake] <sourceRef> → <code>`.

## 4. Interfaces & Data Contracts

### Tabella campi Form → colonna Sheet → campo JSON

Ordine fisso (0 = Timestamp auto, colonna A). Il form è strutturato in 4
sezioni; la sezione sito web usa **branching nativo**: domanda Sì/No →
sezione URL (se Sì) oppure sezione landing (se No). Le colonne landing
(`wantsPage`…`tone`) sono popolate solo se l'utente passa dalla sezione
landing (i campi non visti restano vuoti).

| # | Campo Form | Tipo | Obbligatorio | Colonna | Campo JSON |
|---|-----------|------|-------------|---------|------------|
| 1 | Nome attività | testo breve | sì | B (idx 1) | `businessName` |
| 2 | Referente | testo breve | no | C (idx 2) | `ownerName` |
| 3 | Settore | testo breve (helper) | no | D (idx 3) | `sector` |
| 4 | Descrizione attività | testo lungo (helper) | no | E (idx 4) | `activity` |
| 5 | Stile/atmosfera (ex Mood) | testo breve (helper) | no | F (idx 5) | `mood` |
| 6 | Target | testo lungo (helper) | no | G (idx 6) | `target` |
| 7 | Colori preferiti | testo breve (helper) | no | H (idx 7) | `preferredColors` |
| 8 | Email | email | sì | I (idx 8) | `contacts.email` |
| 9 | Telefono | testo breve | no | J (idx 9) | `contacts.phone` |
| 10 | Indirizzo | testo breve | no | K (idx 10) | `contacts.address` |
| 11 | Sito web presente? | dropdown Sì/No (branching) | no | L (idx 11) | *(non inviato)* |
| 12 | URL sito web | testo breve (solo se Sì) | no | M (idx 12) | `contacts.website` |
| 13 | Vuole pagina web? | dropdown Sì/No | no | N (idx 13) | `webAnswers.wantsPage` |
| 14 | Testo principale (headline) | testo lungo | no | O (idx 14) | `webAnswers.headline` |
| 15 | Cosa offre (offer) | testo lungo | no | P (idx 15) | `webAnswers.offer` |
| 16 | Invito all'azione (CTA) | testo breve | no | Q (idx 16) | `webAnswers.cta` |
| 17 | Tono/voce (tone) | testo breve (helper) | no | R (idx 17) | `webAnswers.tone` |
| 18 | Pacchetto | dropdown (apertura/presenza/custom) | no | S (idx 18) | `package` |

### Payload webhook (esteso: `webAnswers`)

```json
{
  "businessName": "Ristorante Da Mario",
  "ownerName": "Mario Rossi",
  "sector": "ristorante",
  "activity": "Cucina sarda tradizionale",
  "mood": "caldo",
  "target": "Famiglie 30-60",
  "preferredColors": "rosso, bianco, legno",
  "contacts": {
    "email": "mario@example.com",
    "phone": "+39 333 1234567",
    "address": "Via Roma 1, Cagliari",
    "website": "https://ristorantedamario.it"
  },
  "webAnswers": {
    "wantsPage": "sì",
    "headline": "Cucina sarda dal 1985",
    "offer": "Menù degustazione e catering",
    "cta": "Prenota un tavolo",
    "tone": "familiare"
  },
  "package": "apertura",
  "sourceRef": "sheet_row_42"
}
```

Il backend salva `webAnswers` su `intakes.webAnswers` + `customers.webAnswers`
e, se `contacts.website` è http(s), lancia `runCustomerResearch` in
best-effort (vedi REQ-007b).

Risposte attese (contratto backend già esistente):
- `201 { data: { id, status: "new" } }` — creato
- `400 { error: "Brief non valido" }` — validation fail
- `409 { error: "Brief già ricevuto" }` — sourceRef duplicato
- `429 { error: "Troppi brief, riprova tra un'ora" }` — rate limit

### Script Apps Script

Fonte: `scripts/intake-google-form.gs` (da incollare in Estensioni → Apps
Script del Sheet). Trigger: `onFormSubmit`, evento "Invio modulo".

## 5. Acceptance Criteria

- **AC-001**: Given form compilato con businessName+email validi, When si
  invia, Then Sheet ha nuova riga e POST a `/api/intake` risponde 201.
- **AC-002**: Given il webhook ritenta per lo stesso `sourceRef`, When il
  secondo POST arriva, Then risponde 409 e non duplica intakes/customers.
- **AC-003**: Given una risposta, When l'admin apre `/app/customers`, Then
  vede il cliente con `source='intake'` e i campi brief popolati.
- **AC-004**: Given una risposta, When l'admin apre `/app/collection`, Then
  vede il brief in "Brief da lavorare" (badge count incrementato).
- **AC-005**: Given submit del form, When si ispezionano i log server e i
  log Apps Script, Then nessun log contiene email/telefono.
- **AC-006**: Given il form è pubblico, When un utente lo apre, Then vede
  il link alla privacy policy prima di inviare.
- **AC-007**: Given una risposta con URL sito web, When il POST 201 ritorna,
  Then il customer ha `webData` popolato (se FIRECRAWL_API_KEY settata) o
  `researchStatus.web='no_key'` (senza key), e il 201 NON fallisce mai.
- **AC-008**: Given una risposta con sezione landing compilata, When il
  customer è aperto in `/app/customers/:id`, Then la sezione "Risposte form
  pagina web" mostra i 5 campi (`webAnswers`).

## 6. Test Automation Strategy

- **Test Levels**: l'endpoint `/api/intake` è coperto da test unitari
  (`api/__tests__/intake.test.ts`: validazione, idempotenza, rate limit,
  admin guard, no-PII, **webAnswers**, **auto-research** con/senza key).
  Questa spec copre la parte **operativa/manuale** (Google non è testabile
  in CI).
- **Test manuale obbligatorio** (prima di diffondere il link): 1 risposta
  reale → verificare 201 + record in CRM (AC-001/003) e `webAnswers` visibile
  (AC-008); se cliente con sito → verificare `webData`/`researchStatus` (AC-007).
- **Test manuale idempotenza**: re-inviare stesso `sourceRef` via curl →
  atteso 409 (AC-002).
- **CI/CD**: `npm run typecheck && npm run test` verdi (34 test intake+customers),
  `npm run build` pulito; migrazione `web_answers` applicata al deploy Vercel.

## 7. Rationale & Context

**Perché Google Form e non form interno**: gratis, 5 min per creare, zero
hosting file/CAPTCHA/anti-spam custom. Il backend già gestisce rate limit e
idempotenza. Decisione già presa in `spec-intake-pipeline.md` §7.

**Perché versionare lo script nel repo**: il codice webhook non deve vivere
solo nel Google editor (non versionato, non reviewabile, soggetto a drift
rispetto alla guida). `scripts/intake-google-form.gs` è la fonte unica; la
guida lo referenzia.

**Perché mapping per indice colonna e non per nome**: Apps Script
`e.values` è un array posizionale. La COL map nominata rende gli indici
leggibili; l'ordine fisso è il contratto (CON-002).

**Perché niente log PII**: GDPR (COM-001 della spec pipeline). Il log deve
permettere diagnosi senza esporre dati personali.

**Perché branching sito web + 18 colonne**: il form deve guidare l'utente
(sezione dedicata solo se il sito esiste) ma il backend/COL map restano un
contratto posizionale: le colonne landing esistono sempre, i valori sono
vuoti se l'utente non ha visto la sezione. `wantsPage` + landing risposte
alimentano la futura generazione landing (to-be-done, out of scope qui).

**Perché auto-research nel POST /intake**: il primo contatto col sito è il
momento ideale per lo scraping (webData subito disponibile in CRM, zero
click admin). Best-effort: research guasta NON deve bloccare l'onboarding
(il 201 ritorna comunque, `researchStatus` informativo). Pipeline condivisa
`runCustomerResearch` con l'endpoint admin → un solo codice da mantenere.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: Google Forms — form pubblico raccolta brief. Gratis, limite
  risposte praticamente illimitato (20k righe Sheet).
- **EXT-002**: Google Sheets — storage risposte + riga per `sourceRef`.
- **EXT-003**: Google Apps Script — webhook su trigger form submit. Gratis,
  6h/giorno. Runtime V8 (supporta `const`/`let`/arrow).

### Third-Party Services
- **SVC-001**: Vercel (già in uso) — hosting `/api/intake`.

### Infrastructure Dependencies
- **INF-001**: `api/index.ts` monolith — esteso in questa iterazione:
  `IntakeSchema.webAnswers`, insert su intakes+customers, refactor pipeline
  research in `runCustomerResearch`, auto-research in POST `/intake`.
- **INF-002**: Tabella `intakes` + `customers` in Neon — migrazione
  `web_answers` (jsonb su entrambe) applicata al deploy.

### Data Dependencies
- **DAT-001**: COL map (ordine colonne Sheet) — fonte di verità del mapping.

### Technology Platform Dependencies
- **PLT-001**: Apps Script V8 — ES6 supportato.
- **PLT-002**: UrlFetchApp — HTTP client integrato, retry nativo 3 tentativi
  su errori transienti (non su 4xx).

### Compliance Dependencies
- **COM-001**: GDPR — PII nel form (nome, email, telefono). Richiede privacy
  policy linkata (TB-022) + cancellazione via CRM. Dati in Postgres Neon (EU).

## 9. Examples & Edge Cases

```javascript
// scripts/intake-google-form.gs — comportamento atteso
function onFormSubmit(e) {
  const payload = buildIntakePayload(e.values, e.range.getRow());
  const response = UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  Logger.log('[intake] %s -> %s', payload.sourceRef, response.getResponseCode());
}
```

**Edge: campo vuoto (non obbligatorio)** → `values[i] || undefined`, il
backend lo salva come `null`. La pre-compilazione popola solo i campi presenti.

**Edge: campi landing non visti (branching No)** → colonne vuote →
`webAnswers` con solo `wantsPage` valorizzato (o oggetto parziale); la UI
mostra solo i campi non vuoti.

**Edge: retry webhook** → stesso `sourceRef` → backend risponde 409, nessun
duplicato. NOTA: il retry NON rilanciasce l'auto-research (il 409 esce
prima), quindi un research fallito non si ripete da solo — l'admin usa il
bottone "Research" in CRM (fallback manuale).

**Edge: form modificato (colonna spostata)** → mapping rotto (400 o dati
mappati male). Mitigazione: MAI riordinare le domande dopo il primo submit
(CON-002); in caso di modifica, aggiornare COL map e Sheet.

**Edge: auto-research senza FIRECRAWL_API_KEY** → `researchStatus.web='no_key'`,
201 ok, nessun errore (best-effort).

**Edge: webhook fallisce (5xx/timeout)** → Apps Script ritenta (3×); se
tutto fallisce, il brief resta solo in Sheet → fallback manuale (GUD-003).

**Edge: 4xx (validation)** → Apps Script NON ritenta (errore non
transiente). Il brief resta in Sheet; l'admin corregge e re-invia via curl.

## 10. Validation Criteria

Per considerare la spec implementata (verifica manuale, non automatica):

1. Google Form creato con 4 sezioni + branching sito web (tabella §4,
   18 colonne).
2. Sheet collegato; `scripts/intake-google-form.gs` incollato in Apps Script
   con `WEBHOOK_URL` reale; `createIntakeForm()` eseguito per il bootstrap
   automatico (form+Sheet+trigger) se il form non è già stato creato a mano.
3. Trigger `onFormSubmit` configurato su "Invio modulo".
4. 1 risposta di test → 201 (log Apps Script) + cliente `source='intake'` in
   CRM (AC-001/003).
5. Idempotenza verificata: stesso `sourceRef` → 409 (AC-002).
6. Nessun PII nei log (AC-005).
7. Privacy policy linkata nel form (AC-006).
8. Con URL sito nel test → `webData`/`researchStatus` visibili in CRM (AC-007);
   con sezione landing → "Risposte form pagina web" visibile (AC-008).
9. `npm run typecheck && npm run test` verdi (34 test intake+customers),
   `npm run build` pulito.
10. Migrazione `web_answers` applicata su Neon (al deploy Vercel).

## 11. Related Specifications / Further Reading

- `docs/spec/spec-intake-pipeline.md` — spec madre TB-019 (backend, già
  implementata). Questa spec ne è il completamento operativo.
- `docs/intake-google-form-setup.md` — guida manuale passo-passo
  (referenzia `scripts/intake-google-form.gs`).
- `docs/to-be-done.md` — voce "Google Form intake operativo".
- `docs/agent-gotchas.md` §17 — TB-019/027 (intake → CRM).
