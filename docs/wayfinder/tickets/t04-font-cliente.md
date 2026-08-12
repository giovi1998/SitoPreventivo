# Ticket: Font nel customer (wayfinder:ticket, grilling)

Labels: `wayfinder:ticket`, `grilling`
Blocked by:
Status: closed, assigned to opencode

## Question

Il customer non ha un campo font. `webData.brandingFonts` esiste (scritto da
Firecrawl in crm.ts:269, mostrato in CustomerWebDataPanel.tsx:61,113-115) ma
l'auto-build hardcoda `font: ''` nel brief website (handler.ts:1101,
crm.js:340) — il font Firecrawl non viene mai propagato.

Decisioni:
1. **Dove vive il font del cliente**: campo dedicato `font` su customers
   (migrazione) vs `webData.brandingFonts` (già esistente, ma è dato di
   ricerca non di editing)?
2. **Prefill**: all'auto-build, se il customer ha un font (da webData o campo
   dedicato), propagarlo al brief website invece di `''`?
3. **UI**: il CRM deve poter editare il font (come preferredColors) o basta
   mostrarlo (WebDataPanel)?

## Risoluzione

**DECISO (2026-08-13, confermato dall'utente): campo dedicato `font` su
customers.**

- Migrazione Drizzle: `font varchar(50)` default `''` (stesso pattern di
  `sector`/`mood` in db.ts:63/65).
- `UpdateCustomerSchema` (schemas.ts:190-208): aggiungere `font`.
- Whitelist PATCH (handler.ts:790): aggiungere `font`.
- UI CRM: campo editabile in CustomerDetail (accanto a preferredColors,
  righe 598-607) — stesso pattern click-to-edit di `renderField`.
- Auto-build: `font: cust.font || ''` al posto dell'hardcoded `''`
  (handler.ts:1101, crm.js:340). Se il customer non ha font, fallback a
  `webData.brandingFonts[0]` (prefill dal research).
- `webData.brandingFonts` resta dato di ricerca (sola lettura, WebDataPanel).
