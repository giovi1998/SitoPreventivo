# TB-019 Intake — Setup Google Form / Tally.so

Form pubblico → webhook → `/api/intake` → record `intakes` + `customers` nel CRM.

L'endpoint `/api/intake` è **provider-agnostic**: accetta lo stesso JSON da Google Form, Tally.so o Typeform. Scegli uno dei due provider qui sotto.

## Opzione A — Google Form + Apps Script (gratis, illimitato sotto 20k righe/mese)

### 1. Crea il Google Form

Crea un form con questi campi (ordine importante per il mapping riga Sheet):

| # | Campo Form | Tipo | Obbligatorio | Note |
|---|-----------|------|-------------|------|
| 1 | Timestamp | automatico | — | Google lo aggiunge |
| 2 | Nome attività | testo breve | sì | → `businessName` |
| 3 | Referente | testo breve | no | → `ownerName` |
| 4 | Settore | testo breve | no | → `sector` (es. ristorante, bar, b&b) |
| 5 | Descrizione attività | testo lungo | no | → `activity` |
| 6 | Mood | testo breve | no | → `mood` (es. moderno, caldo, minimal) |
| 7 | Target | testo lungo | no | → `target` |
| 8 | Colori preferiti | testo breve | no | → `preferredColors` |
| 9 | Email | email | sì | → `contacts.email` |
| 10 | Telefono | testo breve | no | → `contacts.phone` |
| 11 | Indirizzo | testo breve | no | → `contacts.address` |
| 12 | Sito web | testo breve | no | → `contacts.website` |
| 13 | Pacchetto | dropdown (apertura/presenza/custom) | no | → `package` (default `apertura`) |

### 2. Collega a un Google Sheet

In Google Form → Risposte → “Collega a Sheets” → nuovo Sheet.

### 3. Aggiungi Apps Script

In Google Sheet → Estensioni → Apps Script. Incolla:

```javascript
function onFormSubmit(e) {
  const WEBHOOK_URL = 'https://TUO-DOMINIO.vercel.app/api/intake';
  const row = e.range.getRow();
  const v = e.values;
  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      businessName: v[1],          // col B = Nome attività
      ownerName: v[2] || undefined, // col C = Referente
      sector: v[3] || undefined,    // col D = Settore
      activity: v[4] || undefined,  // col E = Descrizione
      mood: v[5] || undefined,      // col F = Mood
      target: v[6] || undefined,    // col G = Target
      preferredColors: v[7] || undefined, // col H = Colori
      contacts: {
        email: v[8] || undefined,    // col I = Email
        phone: v[9] || undefined,    // col J = Telefono
        address: v[10] || undefined, // col K = Indirizzo
        website: v[11] || undefined, // col L = Sito
      },
      package: v[12] || 'apertura',  // col M = Pacchetto
      sourceRef: 'sheet_row_' + row, // idempotency: riga Sheet univoca
    }),
    muteHttpExceptions: true,
  });
}
```

Sostituisci `TUO-DOMINIO` con il tuo dominio Vercel.

### 4. Imposta il trigger

In Apps Script → Triggers (icona orologio) → “Aggiungi trigger”:
- Funzione: `onFormSubmit`
- Evento: “Dal foglio di lavoro” → “Invio modulo”
- Salva. Google chiederà autorizzazione una tantum (scope UrlFetchApp).

### 5. Idempotency

`sourceRef = 'sheet_row_' + row` (numero riga Sheet) è univoco. Se il webhook fallisce e Apps Script ritenta (3 retry nativi), `/api/intake` risponde 409 al secondo tentativo con lo stesso `sourceRef` — non duplica il record.

### 6. Test

Invia una risposta dal form. Verifica:
- Google Sheet ha una nuova riga.
- In Quickbrand CRM (`/app/customers`) appare un nuovo cliente con `source='intake'`.
- In Collection (`/app/collection`) appare il brief in “Brief da lavorare” (admin).

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
    "website": ""
  },
  "package": "apertura",
  "sourceRef": "sheet_row_42"
}
```

Risposte:
- `201 { data: { id, status: "new" } }` — creato
- `400 { error: "Brief non valido" }` — validation fail
- `409 { error: "Brief già ricevuto" }` — sourceRef duplicato (idempotency)
- `429 { error: "Troppi brief, riprova tra un'ora" }` — rate limit

Ogni intake crea **2 record**: `intakes` (brief) + `customers` (cliente, `source='intake'`, `intakeId` FK). L'admin vede il cliente in CRM → “Lancia research” → “AI fill” → “Auto-build draft” → apre draft nell'editor → genera AI → review → consegna.

## Privacy (GDPR)

Il form raccoglie PII (nome, email, telefono). Requisiti:
- Privacy policy linkata nel form (TB-022).
- Dati in Postgres Neon (region EU).
- Server non logga PII (SEC-002: filtra `contacts.email`/`contacts.phone`).
- Diritto cancellazione: l'admin può eliminare cliente + intake dal CRM.