# Ticket: Sync website → customer (wayfinder:ticket, grilling)

Labels: `wayfinder:ticket`, `grilling`
Blocked by:
Status: closed, assigned to opencode

## Question

Oggi website → customer NON esiste: `WebsiteEditor.handleSave`
(WebsiteEditor.tsx:314-349) e l'auto-save 30s (135-149) salvano solo il
documento. Quando l'utente modifica font/colori/contatti/social nel website,
il customer deve aggiornarsi.

Decisioni:
1. **Quando**: on save website (handleSave + auto-save)? Solo on save
   esplicito? On open editor?
2. **Quali campi**: font → customer, preferredColors → customer,
   address/phone/email → customer.contacts, socials → customer.socials.
   Tutti o un sottoinsieme?
3. **Conflitti**: ~~se il customer ha un valore e il website un altro, vince
   l'ultima modifica (last-write-wins)? Serve un timestamp?~~
   **DECISO (2026-08-13): last-write-wins.** On-save = chi salva per ultimo
   vince, senza timestamp espliciti. Serve un guard anti-loop: il sync
   website→customer non deve ri-triggerare il sync customer→website (e
   viceversa) — un flag/parametro "skipSync" nella chiamata.
4. **Path**: PATCH /customers/:id (whitelist handler.ts:790 da estendere) +
   updateCustomer locale (crm.js:61-71).

## Risoluzione

**DECISO (2026-08-13, confermato dall'utente):**

1. **Quando**: SOLO on save esplicito (handleSave). L'auto-save 30s non tocca
   il customer — evita PATCH a raffica durante l'editing.
2. **Campi**: font → customer.font, preferredColors → customer.preferredColors,
   address/phone/email → customer.contacts, socials → customer.socials.
3. **Conflitti**: last-write-wins (chi salva per ultimo vince). Guard
   anti-loop `skipSync` nella chiamata PATCH/saveDocument: il sync
   website→customer non ri-triggera il sync customer→website.
4. **Path**: PATCH /customers/:id (whitelist estesa con font/socials) +
   updateCustomer locale (crm.js:61-71).
5. **Estensione futura (non decisa)**: card/flyer/logo → customer per i campi
   brand (colori/font/contatti/social). Il logo NO (regola "manual wins").
   Da valutare in un ticket dedicato se richiesto.
