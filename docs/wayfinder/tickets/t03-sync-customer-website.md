# Ticket: Sync customer → website esistenti (wayfinder:ticket, grilling)

Labels: `wayfinder:ticket`, `grilling`
Blocked by:
Status: closed, assigned to opencode

## Question

Oggi customer → website esiste solo via auto-build (snapshot unico,
handler.ts:1082-1123) + logo propagation (CustomerDetail.tsx:394-420). La
palette apply (CustomerDetail.tsx:370-386) propaga a card/flyer/logo ma NON
ai doc website. Quando l'utente modifica font/colori/contatti/social nel CRM,
i doc website ESISTENTI (non solo i draft) devono aggiornarsi.

Decisioni:
1. **Quando**: on PATCH customer (saveField/saveContact in
   CustomerDetail.tsx:147-166)? On open editor website?
2. **Quali campi**: font, preferredColors, contacts (address/phone/email),
   socials. Tutti o un sottoinsieme?
3. **Come**: aggiornare `website.brief` dei doc con customerId = cliente
   (query documents + PATCH /documents/:id o saveDocument locale)?
4. **Conflitti**: ~~se il website ha un valore modificato dall'utente e il
   customer cambia, sovrascrivere? (il website è "figlio" del customer?)~~
   **DECISO (2026-08-13): last-write-wins.** Il customer che cambia
   sovrascrive i doc website SOLO se il doc non è stato salvato dopo
   l'ultima modifica del customer (confronto updatedAt). Se il doc è più
   recente, il doc vince (l'utente ha personalizzato dopo). Guard
   anti-loop: il sync customer→website non deve ri-triggerare il sync
   website→customer.

## Risoluzione

**DECISO (2026-08-13, confermato dall'utente):**

1. **Quando**: on PATCH customer (saveField/saveContact in
   CustomerDetail.tsx:147-166) — il sync parte quando l'utente salva un campo
   nel CRM. On open editor website: NO (troppo aggressivo, il doc si
   aggiorna al prossimo save).
2. **Campi**: font, preferredColors, contacts (address/phone/email), socials.
3. **Come**: query documents con customerId = cliente + documentType =
   'website', aggiornare `brief` (font/preferredColors/address/phone/email/
   socials/contacts composta) e salvare con `skipSync` (guard anti-loop).
   PROD: PATCH /documents/:id; locale: saveDocument.
4. **Conflitti**: last-write-wins con confronto updatedAt — il customer
   sovrascrive il doc solo se `doc.updatedAt < customer.updatedAt`. Se il doc
   è più recente, il doc vince.
