---
title: Quickbrand Direct API SaaS — Monetization & Server-Side Rendering
version: 1.0
date_created: 2026-07-08
owner: Giovanni
tags: infrastructure, architecture, api, monetization
---

# Introduction

Trasformare il backend monolite Vercel + Neon di Quickbrand in una piattaforma
API vendibile come Direct SaaS via Stripe, con API key authentication, usage
metering, tiered pricing, e rendering server-side opzionale.

## 1. Purpose & Scope

**Scopo**: Permettere a sviluppatori terzi di acquistare subscription e chiamare
le API di Quickbrand (QR, business card, logo, flyer, AI text, AI image) con
una propria API key, ricevendo output in formato SVG/PNG/PDF senza passare dal
frontend React.

**Out of scope** (in questa fase):
- Frontend React Quickbrand (resta com'è, non impattato dal cambiamento)
- Migrazione utenti esistenti a API keys (sono due sistemi distinti)
- Marketplace Apify (si parte con Direct API SaaS, eventuale Apify è Fase 2)

**Audience**: Sviluppatori e agency che vogliono integrare generazione card/logo/flyer/QR/AI nei propri flussi.

## 2. Definitions

| Termine | Definizione |
|---------|-------------|
| **API Key** | Stringa UUIDv4 generata per un cliente, associata a un tier e a un owner |
| **Tier** | Piano tariffario (Starter/Pro/Enterprise), determina limite richieste/mese e formati accessibili |
| **Usage Metering** | Conteggio richieste mensili per API key, resettato a inizio mese |
| **Rendering Server-Side** | Generazione di SVG/PNG/PDF lato server (Node) invece che nel browser |
| **Direct API SaaS** | Vendita diretta di accesso API tramite Stripe, senza intermediari (no Apify/RapidAPI) |
| **SVG-only phase** | Prima release che espone solo endpoint SVG (pure string, nessuna dipendenza nativa) |
| **Hobby Plan** | Vercel Hobby: timeout 10s, 512MB RAM, 60 req/min burst, 100GB banda |

## 3. Requirements, Constraints & Guidelines

### REQ — Requisiti Funzionali

- **REQ-001**: Esporre tutti i formati di output come endpoint REST: SVG, PNG, PDF per ogni prodotto (QR, card, logo, flyer)
- **REQ-002**: Sistema di API key con generazione, rotazione, revoca e stato attivo/inattivo
- **REQ-003**: Stripe Checkout per subscription: Starter (€19/mo, 1k req, solo SVG), Pro (€49/mo, 10k req, SVG+PNG), Enterprise (€149/mo, 100k req, tutto incluso)
- **REQ-004**: Webhook Stripe per lifecycle: `checkout.session.completed` → attiva key, `invoice.paid` → resetta usage, `customer.subscription.deleted` → disattiva key
- **REQ-005**: Usage metering per API key con reset mensile lato DB (Neon)
- **REQ-006**: Rate-limiting per API key: N richieste/minuto in base al tier
- **REQ-007**: Sandbox/free tier (10 richieste/giorno, solo SVG, senza carta di credito) per onboarding sviluppatori
- **REQ-008**: Endpoint `GET /v1/me` che mostra tier, usage, reset date della API key
- **REQ-009**: Pagina `/app/admin/api-keys` nella dashboard admin per vedere, disattivare, rigenerare key di tutti i clienti
- **REQ-010**: Documentazione API pubblica su `/docs/api` con esempi curl
- **REQ-011**: Watermark server-side: applicato in base al tier (free watermark, pro watermark rimosso)
- **REQ-012**: CORS aperto per il tier free/sandbox (allow origin *), ristretto per tier a pagamento se il cliente richiede origins specifiche
- **REQ-013**: Idempotenza webhook Stripe via `stripeEventId` (header `stripe-id`). Webhook ritentati non creano duplicati in `api_keys` (UNIQUE su `stripeCustomerId`, INSERT ... ON CONFLICT DO UPDATE)
- **REQ-014**: Endpoint admin `DELETE /v1/admin/api-keys/:id` per revoca + cancellazione record (GDPR cancellation, vedi COM-002). Ritorna 204, non lascia traccia in `api_keys` (logs restano con solo `keyHash`)

### SEC — Requisiti di Sicurezza

- **SEC-001**: API key trasmessa solo via header `x-api-key`, mai in URL o body
- **SEC-002**: API key salvata come hash SHA-256 nel DB. La key in chiaro è mostrata UNA volta al checkout, poi non recuperabile
- **SEC-003**: Stripe webhook verificato via `stripe-signature` header e secret
- **SEC-004**: Rate-limit server-side su endpoint AI (DeepSeek/Gemini) per evitare abuso delle key rubate
- **SEC-005**: Logging di ogni chiamata API con timestamp, key hash, endpoint, IP, status code (tabella `api_logs`)
- **SEC-006**: Revoca immediata della key su sospetto abuso dalla dashboard admin
- **SEC-007**: Header `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options` su tutte le risposte API

### CON — Vincoli

- **CON-001**: Vercel Hobby plan — timeout massimo 10s per richiesta. PNG/PDF rendering server-side richiedono >10s e sono quindi ESCLUSI in fase 1 SVG-only
- **CON-002**: Nessun database aggiuntivo — tutto su Neon (già presente). Rate-limit condiviso via tabella DB anziché Redis (evita costi Upstash)
- **CON-003**: Monolite `api/index.ts` rimane tale — nessun split in più file (vedi lesson learned in AGENTS.md)
- **CON-004**: Bundle size funzione serverless <50MB (limite Vercel Hobby). `sharp` (~30MB) è escluso in fase 1
- **CON-005**: Stripe webhook deve essere un handler nello stesso `api/index.ts`, non un endpoint separato
- **CON-006**: `@google/genai` resta solo import dinamico nell'handler (nel punto 7 del logo gotchas, vedi AGENTS.md)

### GUD — Linee Guida

- **GUD-001**: Prefisso `/v1/` per tutti gli endpoint API (es. `/v1/qr/svg`, `/v1/card/svg`) per versionamento futuro
- **GUD-002**: Output uniforme JSON: `{ data: ... }` per successo, `{ error: string }` per errore
- **GUD-003**: Codici HTTP REST standard: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 429 Too Many Requests, 500 Internal
- **GUD-004**: Validazione input con Zod su ogni endpoint (stile attuale)
- **GUD-005**: Documentazione OpenAPI 3.0 generata a partire dagli schemi Zod (o manuale markdown per fase 1)

### PAT — Pattern

- **PAT-001**: Tutti i generatori SVG puramente funzionali (già presenti in `src/utils/*`) vanno estratti in un modulo condiviso importabile sia dal browser che da `api/index.ts`
- **PAT-002**: Medio Stripe subscription con Checkout Session redirect (non Customer Portal per fase 1)
- **PAT-003**: Usage tracking lazy: query DB incrementale su ogni chiamata API, non batch processing (non ci sono cron job su Hobby)
- **PAT-004**: API key generation: `crypto.randomUUID()` → SHA-256 hash → salva hash. Ritorna la key in chiaro al checkout. L'utente DEVE copiarla subito

## 4. Interfaces & Data Contracts

### 4.1 Database — Nuova tabella `api_keys`

```sql
-- Drizzle schema in db/schema.ts
export const apiKeys = pgTable("api_keys", {
  id: serial().primaryKey(),
  keyHash: varchar("key_hash", { length: 64 }).notNull().unique(),  -- SHA-256 hex
  label: varchar({ length: 100 }),                                   -- "Agency XYZ - Prod"
  ownerEmail: varchar("owner_email", { length: 255 }).notNull(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 100 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 100 }),
  tier: varchar({ length: 20 }).notNull().default("free"),           -- free | starter | pro | enterprise
  monthlyLimit: integer("monthly_limit").notNull().default(100),
  usedThisMonth: integer("used_this_month").default(0),
  usageResetAt: timestamp("usage_reset_at"),                         -- data ultimo reset
  rateLimitPerMin: integer("rate_limit_per_min").default(10),
  active: boolean().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  lastUsedAt: timestamp("last_used_at"),
  allowedOrigins: text("allowed_origins"),                            -- JSON array opzionale
});
```

### 4.2 Database — Nuova tabella `api_logs`

```sql
export const apiLogs = pgTable("api_logs", {
  id: serial().primaryKey(),
  keyHash: varchar("key_hash", { length: 64 }).notNull(),
  endpoint: varchar({ length: 100 }).notNull(),
  method: varchar({ length: 10 }).notNull(),
  statusCode: integer("status_code").notNull(),
  ip: varchar({ length: 45 }),
  responseTimeMs: integer("response_time_ms"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

### 4.3 Endpoint API — Schema

| Method | Path | Descrizione | Tier minimo | Auth |
|--------|------|-------------|-------------|------|
| GET | `/v1/me` | Info API key (tier, usage, limit) | free | API key |
| POST | `/v1/qr/svg` | QR Code → SVG string | free | API key |
| POST | `/v1/qr/png` | QR Code → PNG binary | starter | API key |
| POST | `/v1/card/svg` | Business card → SVG string | free | API key |
| POST | `/v1/card/png` | Card → PNG image | pro | API key |
| POST | `/v1/card/pdf` | Card 10-up → PDF | pro | API key |
| POST | `/v1/logo/svg` | Logo → SVG string | free | API key |
| POST | `/v1/logo/png` | Logo → PNG image | pro | API key |
| POST | `/v1/flyer/svg` | Flyer → SVG string | free | API key |
| POST | `/v1/flyer/png` | Flyer → PNG image | pro | API key |
| POST | `/v1/flyer/pdf` | Flyer → PDF | pro | API key |
| POST | `/v1/ai/text` | AI copy generation (DeepSeek) | starter | API key |
| POST | `/v1/ai/image` | AI background generation (Gemini) | starter | API key |

### 4.4 Esempi richiesta/risposta

```http
POST /v1/qr/svg HTTP/1.1
Host: api.quickbrand.app
x-api-key: a1b2c3d4-e5f6-7890-abcd-ef1234567890
Content-Type: application/json

{
  "data": "https://example.com",
  "type": "url",
  "style": "rounded",
  "foreground": "#000000",
  "background": "#ffffff"
}

→ 200 OK
Content-Type: application/json

{
  "data": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 300 300\">...</svg>",
  "format": "svg",
  "meta": {
    "tier": "free",
    "usage": {
      "used": 12,
      "limit": 100,
      "resets_at": "2026-08-01T00:00:00Z"
    }
  }
}
```

```http
POST /v1/qr/png HTTP/1.1
x-api-key: a1b2c3d4-...
Content-Type: application/json

{ "data": "https://example.com", "type": "url" }

→ 200 OK
Content-Type: image/png
x-tier: starter
x-usage-remaining: 9872

<binary PNG data>
```

### 4.5 Stripe Checkout — Integration contract

```
Cliente → [Click "Abbonati" su quickbrand.app/pricing]
        → Stripe Checkout Session (mode: subscription, line_items: [price_xxx])
        → Stripe redirect a quickbrand.app/welcome?session_id={id}
        → La welcome page fa GET /v1/internal/claim-key?session_id={id}
        → Mostra API key UNA VOLTA + invite a copiarla
        → Stripe webhook POST /api/stripe-webhook (verificato via signature)
```

### 4.6 Middleware API Key — Flow

```
Richiesta → api/index.ts → routing → [Middleware API Key]
  1. Leggi header "x-api-key"
  2. Se assente → 401 { error: "API key required. Send x-api-key header." }
  3. Calcola SHA-256(key)
  4. Query: SELECT * FROM api_keys WHERE key_hash = $1 AND active = true
  5. Se non trovata → 401 { error: "Invalid or inactive API key." }
  6. Tier check: endpoint richiede tier X, key ha tier Y >= X?
     - free: solo /v1/qr/svg, /v1/card/svg, /v1/logo/svg, /v1/flyer/svg
     - starter: + /v1/qr/png, /v1/ai/text, /v1/ai/image
     - pro: + /v1/card/png, /v1/card/pdf, /v1/flyer/png, /v1/flyer/pdf
     - enterprise: tutto + priority queue
  7. Usage check: usedThisMonth < monthlyLimit? Se no → 429
  8. Rate-limit: check tabella api_logs per key, ultimo minuto. Se > rateLimitPerMin → 429
  9. Incrementa usedThisMonth, UPDATE lastUsedAt
  10. Logga in api_logs (async, non bloccare la response)
  11. Passa req.apiKey al handler
```

## 5. Acceptance Criteria

- **AC-001**: Given una API key valida, When chiamo `POST /v1/qr/svg`, Then ricevo 200 con SVG valido. Given la stessa key falsificata, When chiamo lo stesso endpoint, Then ricevo 401.
- **AC-002**: Given una key tier "free", When chiamo `POST /v1/qr/png`, Then ricevo 403 con messaggio "Formato PNG richiede tier Starter o superiore".
- **AC-003**: Given una key con monthlyLimit=100 e 100 richieste già effettuate, When chiamo un endpoint, Then ricevo 429 con header `x-ratelimit-reset`.
- **AC-004**: Given uno Stripe Checkout completato con successo, When lo webhook `checkout.session.completed` arriva, Then viene creata una riga in `api_keys` con tier corretto e active=true.
- **AC-005**: Given uno Stripe subscription cancellato, When lo webhook `customer.subscription.deleted` arriva, Then la riga `api_keys` corrispondente passa active=false.
- **AC-006**: Given una richiesta a `/v1/me` con API key valida, Then la risposta include `{ tier, used_this_month, monthly_limit, usage_reset_at }`.
- **AC-007**: Given un watermark free-tier, When genero SVG tramite API con tier=free, Then l'SVG contiene il testo "QUICKBRAND" in overlay.
- **AC-008**: Given un tier pro, When genero SVG tramite API, Then l'SVG NON contiene watermark.
- **AC-009**: Given un client che usa la stessa API key da due IP diversi contemporaneamente, When il rate-limit per-min viene superato, Then entrambe ricevono 429.

## 6. Test Automation Strategy

- **Test Levels**:
  - **Unit**: Middleware API key (estrae key, calcola hash, lookup DB mock), tier check, rate-limit logic, AI quota tracking
  - **Integration**: Endpoint `/v1/qr/svg` con DB reale Neon (test locale con DATABASE_URL di test)
  - **E2E**: Stripe webhook simulato → create key → chiama endpoint → verify log

- **Framework**: Vitest (già in uso). Test in `api/__tests__/apiKeys.test.ts`
- **Mocking**: Mockare `drizzle` per test unitari del middleware. Usare Neon test DB per integration test
- **Stripe**: Usare `stripe.webhooks.constructEvent` con secret di test. Eventi mockati da file JSON (vedi `api/__tests__/fixtures/stripe-events/`)
- **Copertura minima**: 70% per nuovo codice (api/index.ts handler + db/schema.ts + middleware)
- **CI**: I test API girano in `npm test` insieme a quelli esistenti
- **Test specifici AI quota** (se REQ-AI-quota approvato): over-ai-limit → 429 con header `x-ai-remaining: 0`; reset `aiUsedThisMonth` lazy come `usedThisMonth`; tier downgrade non resetta `aiUsedThisMonth` (grace al mese successivo).
- **Test idempotenza webhook**: stesso `stripeEventId` processato 2 volte → nessun duplicato in `api_keys`.
- **Test security**: key in URL → 401; key in body → 401 (solo header accettato); IP spoofing non bypassa rate-limit (rate-limit keyed su `keyHash`, non IP).

## 7. Rationale & Context

**Perché Direct API SaaS e non Apify/RapidAPI?**
- Zero commissioni (Stripe: 2.9% + $0.30, Apify: ~20%)
- Controllo completo su pricing, rate-limit, tier
- Dashboard admin già esistente — estensione naturale
- Nessun vendor lock-in

**Perché iniziare con solo SVG su Hobby?**
- I generatori SVG sono funzioni pure senza dipendenze esterne — <50ms a chiamata
- Si incastrano nel timeout 10s di Hobby
- `sharp` (~30MB) e pdfmake (~5MB con font) rischiano di far esplodere il bundle Hobby (50MB limite funzione)
- Il PNG/PDF è fattibile in Fase 2 con Vercel Pro (60s timeout, più banda)

**Rate-limit su Neon invece di Redis?**
- Upstash Redis gratis parte da ~$0 ma diventa un servizio esterno da mantenere
- Neon è già in uso, nessun setup aggiuntivo
- Il rate-limit su DB ha latenza extra di ~5-10ms per chiamata, accettabile per volumi bassi (fino a ~50k req/mese su Hobby)
- Se le API scalano oltre, Upstash Redis è un upgrade semplice senza cambiare logica

**Stato watermark:**
- Attualmente è client-side (`watermark.ts`) — nella fase API va applicato server-side
- I generatori SVG sono puri e accettano un parametro `tier`, quindi basta passare `tier` dal middleware al costruttore SVG

## 8. Dependencies & External Integrations

### External Systems

- **EXT-001**: **Stripe** — Subscription management, pagamenti, webhook lifecycle. API keys verificate via `stripe-signature` header.
- **EXT-002**: **Neon Postgres** — Database già in uso. Nuove tabelle: `api_keys`, `api_logs`. Stessa connection string `DATABASE_URL`.

### Third-Party Services

- **SVC-001**: **DeepSeek API** — Già integrata. Per `/v1/ai/text`, chiamata server-side con `DEEPSEEK_API_KEY`. Costo pass-through o assorbito dal margine.
- **SVC-002**: **Gemini API** — Già integrata via `@google/genai`. Per `/v1/ai/image`. Costo pass-through.

### Infrastructure Dependencies

- **INF-001**: **Vercel Hobby** — Funzione serverless singola, timeout 10s, 512MB RAM, 60 req/min burst. Endpoint esposti su `*.vercel.app` o dominio custom.
- **INF-002**: Nessun cron job — usage reset via logica lazy (controllo sulla prima richiesta del mese).

### Technology Platform Dependencies

- **PLT-001**: **Node.js 18+** su Vercel — `crypto.randomUUID()`, `crypto.createHash('sha256')`, native fetch
- **PLT-002**: **Drizzle ORM** — Già in uso. Nuove tabelle in `db/schema.ts`, migrate via `db:migrate`

### Compliance Dependencies

- **COM-001**: **PCI DSS** — Stripe gestisce i dati carta. La piattaforma Quickbrand non tocca mai PAN/CVV. Obbligo: nessuno storage locale di dati carta, redirect-only a Stripe Checkout. Compliance delegate a Stripe (SAQ-A).
- **COM-002**: **GDPR** — API key è associata a `ownerEmail` (PII). Diritto cancellazione: endpoint admin `DELETE /v1/admin/api-keys/:id` revoca e cancella il record `api_keys`. Log `api_logs` contengono solo `keyHash` (SHA-256, non invertibile), nessun PII.
- **COM-003**: **Stripe Terms of Service** — L'account Quickbrand deve essere in good standing. Webhook signature verification obbligatoria (SEC-003). Nessuna elaborazione payment fuori Stripe.

### Data Dependencies

- **DAT-001**: **Tabella `api_keys`** — Dati inseriti via Stripe webhook o dashboard admin. Letti da ogni chiamata API. Mai esposti in chiaro dopo la creazione.
- **DAT-002**: **Tabella `api_logs`** — Append-only. Trattenuta 90 giorni per audit, poi cleanup manuale o job scheduled (Vercel Cron, Hobby: 1 job/giorno gratis).

## 9. Examples & Edge Cases

### Edge case: Cold start e rate-limit

```text
Scenario: Dopo 30 minuti di inattività, Vercel fa cold start della funzione.
La prima richiesta dopo cold start vede rateLimitStore vuoto (Mappa in memoria).
Chiamata 1: passa (nessun record)
Chiamata 2 (stesso minuto): passa (record creato da chiamata 1, count=1)
...
Chiamata N (stesso minuto): passa o bloccata in base a count

Rischio: subito dopo cold start, 2 client diversi su 2 istanze diverse
possono fare più richieste del consentito perché ogni istanza ha la sua mappa.

Mitigazione (CON-002): usare tabella api_logs su Neon per rate-limit,
non mappa in memoria. Query: SELECT COUNT(*) FROM api_logs WHERE key_hash=$1
AND created_at > NOW() - INTERVAL '1 minute'.
Costo: ~5ms extra per richiesta.
```

### Edge case: Chiave non copiata al checkout

```text
Cliente completa Stripe Checkout → redirect a /welcome?session_id=xxx
La pagina mostra la API key in chiaro UNA VOLTA, con bottone "Copia".
Cliente chiude la pagina senza copiare → key persa.

Soluzione: Oltre alla pagina welcome:
1. Inviare la key via email (stessa email Stripe)
2. Dashboard admin può rigenerare la key su richiesta
3. La key originale non è mai recuperabile (solo hash salvato)
```

### Edge case: Overflow del mese

```text
Cliente Starter (1k req/mese) fa 1000 richieste il giorno 1.
Per i successivi 29 giorni tutte le chiamate danno 429.
Il reset avviene al primo giorno del mese successivo.

Logica lazy reset:
- La richiesta GET /v1/me controlla: usageResetAt < inizio mese corrente?
- Se sì: resetta usedThisMonth = 0, usageResetAt = now()
- Idem su ogni chiamata API prima di incrementare
- Nessun cron job necessario
```

### Edge case: Stripe webhook duplicato

```text
Stripe ritenta i webhook 3 volte se il endpoint non risponde 2xx entro 10s.
Se l'handler 200 ma il DB commit è lento (Neon cold), Stripe ritenta
e potrebbe creare una seconda riga api_keys.

Mitigazione: idempotenza via `stripeEventId` (header `stripe-id`).
Tabella api_keys ha UNIQUE su `stripeCustomerId` (un customer = una key
attiva). INSERT ... ON CONFLICT (stripe_customer_id) DO UPDATE SET
active = true, tier = EXCLUDED.tier. La ritentativa diventa un
no-op invece di un duplicato.
```

### Edge case: Cliente downgrada tier mid-month

```text
Cliente Pro → Starter il giorno 15. usedThisMonth=4200.
La key passa tier=starter, monthlyLimit=1000.
Le successive chiamate ritornano 429 (over limit).
Il cliente perde accesso a /v1/card/png (tier check fallisce → 403).

Decisione: nessun refund pro-rata, nessuna grace period. Comportamento
allineato a Stripe subscription proration (il cliente vede il cambio
fattura su Stripe). Documentare nella docs/api.
```

### Edge case: AI cost pass-through

```text
/v1/ai/text chiama DeepSeek (cost ~$0.001/1k token per cache miss).
/v1/ai/image chiama Gemini (cost ~$0.03/image a 512).
Tier Starter (1k req/mese) che usa solo AI text → costo margine OK.
Tier Starter che usa solo AI image → 1k image/mese = $30, subscription
$19 → LOSS di $11/mese per cliente.

Mitigazione: separare AI quota dalla main quota.
api_keys aggiunge `aiUsedThisMonth` + `aiMonthlyLimit` (default 100 per
starter, 1000 per pro, 10000 enterprise). /v1/ai/* incrementa
aiUsedThisMonth, non usedThisMonth. Limite soft (over → 429 con
header x-ai-remaining).
```

### Edge case: Vercel cold start + Stripe webhook timeout

```text
Vercel Hobby cold start ~500ms-3s. Stripe webhook deve rispondere
entro 10s (Stripe default). Se cold start + Neon query + DB write
> 10s, Stripe ritenta.

Mitigazione: handler webhook risponde 200 PRIMA di completare il
DB write usando un fire-and-forget promise (race condition
accettabile: Stripe ritenta su 2xx comunque). Documentare il
trade-off. Alternativa più sicura: attendere il write, fallback
su idempotenza (edge case sopra).
```

### Esempio curl per documentazione

```bash
# Genera QR code SVG
curl -X POST https://quickbrand.vercel.app/v1/qr/svg \
  -H "x-api-key: a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  -H "Content-Type: application/json" \
  -d '{"data": "https://miosito.com", "type": "url", "style": "rounded"}'

# Risposta: { "data": "<svg>...</svg>", "format": "svg", "meta": { ... } }

# Genera business card SVG da JSON
curl -X POST https://quickbrand.vercel.app/v1/card/svg \
  -H "x-api-key: a1b2c3d4-..." \
  -H "Content-Type: application/json" \
  -d '{
    "side": "front",
    "card": {
      "name": "Mario Rossi",
      "title": "CEO",
      "company": "Rossi SRL",
      "email": "mario@rossi.it",
      "phone": "+39 333 1234567"
    }
  }'

# Ottieni info API key
curl -H "x-api-key: a1b2c3d4-..." https://quickbrand.vercel.app/v1/me
# → { "tier": "starter", "used_this_month": 42, "monthly_limit": 1000, ... }
```

## 10. Validation Criteria

- **[V-001]**: `npm run typecheck` passa senza errori
- **[V-002]**: `npm run test` — tutti i test esistenti + nuovi test API key verdi
- **[V-003]**: In locale, una chiamata `curl` con API key valida a `/v1/qr/svg` ritorna SVG valido
- **[V-004]**: In locale, una chiamata `curl` senza header `x-api-key` ritorna 401
- **[V-005]**: Stripe webhook simulato (tramite `stripe trigger checkout.session.completed`) crea record in `api_keys`
- **[V-006]**: Il deploy su Vercel Hobby non supera il limite di 50MB per la funzione serverless
- **[V-007]**: Il bundle size della funzione si può verificare con `vercel build` e leggendo il log: `Lambda size: XX MB`

## 12. Open Questions

Decisioni pendenti da confermare prima dell'implementazione:

1. **AI quota separata?** Vedi edge case "AI cost pass-through". Se sì,
   aggiungere campi `aiUsedThisMonth` + `aiMonthlyLimit` a `api_keys`
   e REQ-AI-001/002. Se no, accettare il margine negativo per tier
   Starter che abusa `/v1/ai/image` (mitigato dal rate-limit/min).
2. **Pricing in EUR o USD?** Stripe accetta entrambi. REQ-003 indica
   €/mo. Se clienti sono UE, EUR riduce attrito. Se globali, USD.
3. **Webhook fire-and-forget o await-write?** Vedi edge case cold
   start. Fire-and-forget risponde 200 subito ma rischia perdita
   evento su crash dell'istanza. Await-write risponde 200 post-commit
   ma rischia timeout Stripe. Raccomandato: await-write + idempotenza
   via `stripeEventId` (più sicuro, costo: latenza extra).
4. **Docs API statiche o interattive?** REQ-010 dice `/docs/api`.
   Opzioni: (a) markdown statico in repo; (b) Stoplight/Redoc con
   OpenAPI generato da Zod; (c) pagina `/docs/api` nell'app React
   con esempi curl copiabili. Per fase 1: markdown statico, (b)/(c)
   fase 2.
5. **Admin dashboard `/app/admin/api-keys` come tab o pagina nuova?**
   L'AdminDashboard esistente ha tabs (utenti, preventivi, limiti).
   Aggiungere tab "API Keys" è meno invasivo di una pagina separata.
6. **Tier Enterprise "priority queue"**: REQ-003 menziona "priority
   queue" per Enterprise. Su Vercel Hobby (single instance) non c'è
   queue reale. Implementare come: rate-limit Enterprise 1000/min vs
   Pro 60/min, e logica "skip AI cost gate" (aiUsedThisMonth non
   blocca, solo warn). Da chiarire.
7. **Retention `api_logs`**: DAT-002 dice 90 giorni. Cleanup via
   Vercel Cron (Hobby: 1 job/giorno gratis) o query manuale? Se cron,
   serve un endpoint `/v1/internal/cleanup-logs` con secret shared.

## 13. Related Specifications / Further Reading

- `spec/spec-design-url-id-routing.md` — URL-ID routing per documenti (implementata e cancellata, tutti gli AC sono in produzione)
- `docs/logo-ai.md` — Architettura provider Gemini già integrata (riusata da `/v1/ai/image`)
- `api/index.ts` — Monolite esistente, contiene tutti i pattern Zod/CORS/auth da replicare
- `src/utils/watermark.ts` — Sistema tier watermark da portare server-side
- `src/utils/qrGenerator.ts` — Generatore QR già puro (funziona in Node)
- `src/utils/card/svgRenderer.ts` — Card SVG builder già puro
- `src/utils/logoGenerator.ts` — Logo SVG builder già puro
- `src/utils/flyer/svgRenderer.ts` — Flyer SVG builder già puro
