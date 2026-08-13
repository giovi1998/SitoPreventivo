# Mappa: Sync bidirezionale CRM ↔ Website (wayfinder:map)

## Destination

I dati brand di un cliente (font, colori, contatti, social) sono identici e
sempre aggiornati tra il CRM (CustomerDetail) e il WebsiteEditor: modificare
un campo in uno dei due lo aggiorna nell'altro, e i social sono aggiungibili
da entrambe le parti. Il sync copre i doc website esistenti (non solo i
draft auto-build) e vale per i path locale (localStorage) e PROD (API).

## Notes

- Dominio: CRM (TB-027) + Website Builder (TB-028) + dataService.
- Skill da consultare: `lean-code`, `adhd-caveman`, `test-driven-development`,
  `langfuse` (se il sync tocca chiamate AI).
- Vincolo architetturale: i path locale (`src/utils/dataService/crm.js`) e
  PROD (`src/server/handler.ts`) devono restare speculari (commento esplicito
  in `crm.js:246-247`).
- PATCH /customers/:id ha whitelist campi (`handler.ts:790`) e
  `UpdateCustomerSchema` (`schemas.ts:190-208`) — estendere se il sync scrive
  campi oggi bloccati.
- Stato attuale (esplorato 2026-08-13): customer → website solo via auto-build
  (snapshot unico) + logo propagation; website → customer NON esiste; il
  customer non ha campi social né font; Firecrawl estrae `social_links`
  (`crm.ts:139`) ma lo scarta; `webData.brandingFonts` esiste ma mai propagato
  al brief (auto-build hardcoda `font: ''`).

## Decisions so far

<!-- una riga per ticket chiuso: titolo link + gist -->

- [Dove vivono i social del cliente](tickets/t01-social-schema-cliente.md) — colonna dedicata `socials jsonb` su customers (migrazione + UpdateCustomerSchema + whitelist PATCH), shape `{platform,url}` identica al website
- [Sync website → customer](tickets/t02-sync-website-customer.md) — solo on save esplicito; campi font/colori/contatti/social; last-write-wins; guard anti-loop `skipSync`
- [Sync customer → website esistenti](tickets/t03-sync-customer-website.md) — on PATCH customer; aggiorna i doc website con customerId; last-write-wins con confronto updatedAt; guard anti-loop
- [Font nel customer](tickets/t04-font-cliente.md) — campo dedicato `font varchar(50)` su customers; editabile nel CRM; auto-build usa `cust.font` con fallback `webData.brandingFonts[0]`
- [UI social nel CRM](tickets/t05-ui-social-crm.md) — sezione Contatti di CustomerDetail, pattern identico al website; prefill da Firecrawl `social_links` al research (piattaforma dal dominio)

## Implementazione (2026-08-13)

Tutti i 5 ticket implementati e testati (73 test rilevanti verdi, typecheck ok):

- **DB**: `socials jsonb` + `font varchar(50)` su customers (db/schema.ts + src/server/db.ts + migrazione `drizzle/20260812224621_simple_jigsaw`)
- **API**: UpdateCustomerSchema + whitelist PATCH con `socials`/`font`/`skipSync`; `syncCustomerToWebsiteDocs` in crm.ts (on PATCH, last-write-wins con updatedAt)
- **Locale**: `syncCustomerToWebsiteLocal` in crm.js (mirror); prefill social/font da Firecrawl nel research locale
- **UI CRM**: campo Font nel Brief + sezione Social nei Contatti (CustomerDetail.tsx)
- **UI Website**: sync on save esplicito → updateCustomer con skipSync (WebsiteEditor.tsx)
- **Auto-build**: `font: cust.font` + `socials: cust.socials` nei draft website (server + locale)
- **Prefill research**: social_links Firecrawl → customer.socials (piattaforma dal dominio), brandingFonts → customer.font

## Ticket aperti

(nessuno — mappa completa, implementazione completata)

## Not yet specified

- Conflitti: ~~cosa succede se customer e website modificano lo stesso campo
  (font/colori) in momenti diversi~~ — **DECISO: last-write-wins** (t02/t03)
- ~~Quando sincronizzare customer → website esistenti~~ — **DECISO: on PATCH
  customer** (t03)
- ~~Il sync tocca anche card/flyer/logo?~~ — **DECISO: solo website per ora;
  estensione a card/flyer/logo per i campi brand da valutare in ticket
  dedicato** (t02 §5)

## Out of scope

- Sync con altri tipi di documento (card/flyer/logo): già parzialmente
  gestito dalla palette apply in CustomerDetail; non è il focus di questa
  mappa.
- Sync multi-cliente o batch.
