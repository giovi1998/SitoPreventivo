# TB-019 Intake — Setup Google Form / Tally.so

Form pubblico → webhook → `/api/intake` → record `intakes` + `customers` nel CRM.

L'endpoint `/api/intake` è **provider-agnostic**: accetta lo stesso JSON da Google Form, Tally.so o Typeform. Scegli uno dei due provider qui sotto.

## Opzione A — Google Form + Apps Script (gratis, illimitato sotto 20k righe/mese)

### 1. Crea il form in automatico (bootstrap)

In un nuovo progetto Apps Script (`https://script.new`), incolla il contenuto di
[`scripts/intake-google-form.gs`](../scripts/intake-google-form.gs) (fonte unica,
versionata nel repo — non duplicare codice inline qui). `WEBHOOK_URL` è già
settato a `https://quickbrand.vercel.app/api/intake`.

Seleziona la funzione `createIntakeForm` nel dropdown e premi Run. Autorizza
una tantum (scope FormApp + SpreadsheetApp + ScriptApp). Lo script crea da
solo: Google Form (4 sezioni + branching sito web), Google Sheet collegato
alle risposte, trigger `onFormSubmit` su "Invio modulo". Dal log copia
l'URL del form (`Form: ...`).

> **Nome progetto**: prima di incollare il codice, rinomina il progetto Apps
> Script in **`Quickbrandformv1`** (icona ⚙️ Project settings → Name). È il
> nome canonico: salva così anche su Google Drive e in ogni copia/backup.
>
> **Attenzione — non duplicare**: se il form esiste già (per es. l'hai creato
> in una sessione precedente), **NON** rieseguire `createIntakeForm()`: ne
> creerebbe un secondo identico. Il comando è idempotente solo per nome —
> usa `makeQuickbrandFormPublic()` per rendere pubblico il form esistente e
> `getFormInfo()` per recuperarne ID/URL. Per aggiornare il codice, incolla la
> versione nuova e riesegui solo `makeQuickbrandFormPublic()`.

Per diagnosi: esegui `testWebhook()` (invia un brief di prova a
`/api/intake`, stampa status + body).

**Form pubblico**: i form creati via `FormApp.create()` non sono pubblici di
default — chi apre il link vede "Non condiviso" e serve login. Dopo il
bootstrap esegui `makeQuickbrandFormPublic()` (o è già chiamato dentro
`createIntakeForm()`) per rendere il form compilabile da chiunque con il
link, senza login.

### 2. Verifica i campi del form (riferimento mapping)

Campi creati dal bootstrap (ordine importante per il mapping riga Sheet —
colonna A = Timestamp automatico; da qui **indice colonna** = n° colonna):

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
| 11 | Sito web presente? | dropdown Sì/No (**branching**) | no | L (idx 11) | *(non inviato)* |
| 12 | URL sito web | testo breve (solo se Sì) | no | M (idx 12) | `contacts.website` |
| 13 | Vuole pagina web? | dropdown Sì/No | no | N (idx 13) | `webAnswers.wantsPage` |
| 14 | Testo principale (headline) | testo lungo | no | O (idx 14) | `webAnswers.headline` |
| 15 | Cosa offre (offer) | testo lungo | no | P (idx 15) | `webAnswers.offer` |
| 16 | Invito all'azione (CTA) | testo breve | no | Q (idx 16) | `webAnswers.cta` |
| 17 | Tono/voce (tone) | testo breve (helper) | no | R (idx 17) | `webAnswers.tone` |
| 18 | Pacchetto | dropdown (apertura/presenza/custom) | no | S (idx 18) | `package` |

**Branching**: la sezione "Sito web" è condizionale — chi risponde "No" alla
domanda 11 salta l'URL (col 12 vuota) e va dritto alla sezione landing
(col 13-17). Le colonne landing restano vuote per chi non le vede.

**webAnswers**: le risposte 13-17 sono salvate su `intakes` + `customers`
come oggetto `webAnswers` (vedi endpoint sotto). Serviranno per la futura
generazione landing page (non ancora implementata).

**Auto-research**: se `contacts.website` è un URL http(s), il POST
`/api/intake` lancia lo scraping Firecrawl in best-effort (webData
disponibile subito in CRM). Senza `FIRECRAWL_API_KEY` → `researchStatus.web='no_key'`.
Il research NON riparte se il webhook ritenta con 409 (v. idempotency sotto):
in caso di research fallito usa il bottone "Research" in CRM.

### 4. Idempotency

`sourceRef = 'sheet_row_' + row` (numero riga Sheet) è univoco. Se il webhook fallisce e Apps Script ritenta (3 retry nativi), `/api/intake` upserta: stesso `sourceRef` → UPDATE il record (non duplica).

### 5. Test

Invia una risposta dal form. Verifica:
- Google Sheet ha una nuova riga.
- In Quickbrand CRM (`/app/customers`) appare un nuovo cliente con `source='intake'`.

### Note

- **Gratis**: Google Form + Apps Script + Sheet sono €0 (limite 20k righe Sheet, 6h/giorno Apps Script).
- **Privacy**: il form raccoglie PII (email, telefono). Aggiungi link a privacy policy nel form (TB-022 prereq).
- **Retry**: Apps Script ha retry nativo (3 tentativi) su errori transienti. Errori 4xx (es. validation 400) non ritenta.
- **Fallback**: se il webhook fallisce sempre, il brief resta solo in Sheet. L'admin controlla il Sheet manualmente 1 volta/settimana come fallback.

## Opzione B — Tally.so (webhook nativo, gratis 1000 risposte/mese)

Tally.so ha webhook nativo, niente Apps Script.

### 1. Crea il form su Tally.so

Crea un form con i campi equivalenti (nome attività, referente, settore, ecc.). Tally permette branding migliore di Google Form.

### 2. Configura webhook

In Tally → Integrations → Webhooks → aggiungi URL: `https://TUO-DOMINIO.vercel.app/api/intake`.

### 3. Mappa i campi

Tally invia un payload JSON con `field_id` chiavi. Mappa i campi Tally ai campi `/api/intake` tramite una funzione di trasformazione (Tally → JSON Quickbrand). Esempio:

```json
{
  "businessName": "<valore campo Tally 'Nome attività'>",
  "ownerName": "<valore campo 'Referente'>",
  "sector": "<valore campo 'Settore'>",
  ...
  "sourceRef": "tally_<tally_event_id>"
}
```

Tally passa sempre un `event_id` nativo → usalo come `sourceRef` per idempotency.

### Vantaggi Tally

- Branding personalizzabile (colori, font, logo).
- Webhook nativo, niente Apps Script.
- 1000 risposte/mese gratis (sufficiente bootstrap).

### Svantaggi

- Limite 1000/mese vs Google Form illimitato.
- Mappatura campi richiede configurazione manuale (Tally field_id → JSON key).

## Endpoint reference

`POST /api/intake` (pubblico, rate limit 5/ora/IP):

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

`webAnswers` è opzionale (`z.record(z.string(), z.unknown())`): accetta
qualsiasi coppia chiave→valore, per compatibilità con Tally/Typeform.

Risposte:
- `200 { data: { id, status, updated: true } }` — upsert (sourceRef già noto, aggiornato)
- `201 { data: { id, status: "new", updated: false } }` — creato
- `400 { error: "Brief non valido" }` — validation fail
- `429 { error: "Troppi brief, riprova tra un'ora" }` — rate limit

Ogni intake crea **2 record**: `intakes` (brief, incl. `webAnswers`) +
`customers` (cliente, `source='intake'`, `intakeId` FK, `webAnswers`).
L'admin vede il cliente in CRM → research automatica (se c'è sito web) o
“Lancia research” manuale → “AI fill” → “Auto-build draft” → apre draft
nell'editor → genera AI → review → consegna. Nel dettaglio cliente, la
sezione "Risposte form pagina web" mostra i 5 campi landing (se presenti).

## Privacy (GDPR)

Il form raccoglie PII (nome, email, telefono). Requisiti:
- Privacy policy linkata nel form (TB-022).
- Dati in Postgres Neon (region EU).
- Server non logga PII (SEC-002: filtra `contacts.email`/`contacts.phone`).
- Diritto cancellazione: l'admin può eliminare cliente + intake dal CRM.