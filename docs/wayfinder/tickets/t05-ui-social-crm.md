# Ticket: UI social nel CRM (wayfinder:ticket, grilling)

Labels: `wayfinder:ticket`, `grilling`
Blocked by: t01-social-schema-cliente (closed)
Status: closed, assigned to opencode

## Question

Il website ha la UI social (WebsiteEditor.tsx:612-622: addSocial/updateSocial/
removeSocial). Il CRM non ha nessuna UI social. L'utente vuole aggiungere
social anche dal CRM.

Decisioni:
1. **Dove**: sezione Contatti di CustomerDetail (accanto a email/phone/
   address, righe 609-616)? Nuova sezione dedicata?
2. **Pattern**: stesso pattern del website (righe social con platform+url,
   bottone "+ Aggiungi social")?
3. **Prefill da Firecrawl**: i `social_links` estratti (crm.ts:139) devono
   precompilare i social del customer al primo research?

## Risoluzione

**DECISO (2026-08-13, confermato dall'utente):**

1. **Dove**: sezione Contatti di CustomerDetail (dopo email/phone/address,
   righe 609-616) — i social sono dati di contatto.
2. **Pattern**: identico al website (righe social con platform+url, bottone
   "+ Aggiungi social", ✕ per rimuovere) — riuso del pattern
   WebsiteEditor.tsx:612-622.
3. **Prefill**: SÌ — al research (crm.ts:139 `social_links`), se il customer
   non ha social, popolarli da Firecrawl (editabili dopo). Mapping
   `social_links` (stringhe URL) → `{platform, url}`: piattaforma derivata
   dal dominio (instagram.com → Instagram, facebook.com → Facebook, ecc.).
