# Ticket: Dove vivono i social del cliente (wayfinder:ticket, grilling)

Labels: `wayfinder:ticket`, `grilling`
Blocked by:
Status: closed, assigned to opencode

## Question

Il customer (tabella `customers`, `src/server/db.ts:59-89`) non ha un campo
social. Il website ha `brief.socials: {platform, url}[]`. Dove salvare i
social del cliente per il sync bidirezionale?

Opzioni:
- **A. Colonna dedicata `socials jsonb`** su customers (db.ts + migrazione
  Drizzle + UpdateCustomerSchema + whitelist PATCH handler.ts:790) — tipizzato,
  queryabile, ma richiede migrazione DB.
- **B. Dentro `contacts.socials`** (contacts è già jsonb libero,
  `z.record(z.string(), z.unknown())` in schemas.ts:183/199) — zero migrazione,
  ma fuori schema tipizzato e il PATCH contacts è già whitelisted.
- **C. Dentro `webData.social_links`** (Firecrawl già estrae `social_links` in
  crm.ts:139 ma lo scarta) — dati di ricerca, non di editing utente.

Nota: Firecrawl estrae `social_links` (crm.ts:139) ma il valore non viene mai
salvato né usato — il sync potrebbe partire da lì come prefill.

## Risoluzione

**DECISO (2026-08-13, confermato dall'utente): opzione A — colonna dedicata
`socials jsonb` su customers.**

- Migrazione Drizzle: `socials jsonb` default `[]` (stesso pattern di
  `customerPhotos`/`promptLabels` in db.ts:76/82).
- `UpdateCustomerSchema` (schemas.ts:190-208): aggiungere `socials` come
  `z.array(z.object({ platform: z.string().max(50), url: z.string().max(300) }))`.
- Whitelist PATCH (handler.ts:790): aggiungere `socials` al loop.
- Shape identica a `website.brief.socials` (`{platform, url}`) per il sync
  bidirezionale senza mapping.
- Prefill: al research (crm.ts:139 `social_links`), se il customer non ha
  social, popolarli da Firecrawl (ticket t05).
