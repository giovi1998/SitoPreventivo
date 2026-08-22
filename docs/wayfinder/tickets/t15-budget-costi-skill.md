# Ticket: Budget costo per documento con skill attive

Labels: `wayfinder:ticket`, `wayfinder:grilling`
Blocked by: —
Status: closed (2026-08-20, resolution below)

## Risoluzione

Deciso in sessione 2026-08-20 (grilling con utente):

- **Warning visibile**, non blocco: oltre soglia $X per documento,
  DocumentAiStats mostra un badge di avviso (arancione) con la spesa
  corrente, senza bloccare la generazione.
- Soglia di default da decidere nel ticket di implementazione del widget
  (candidati: $0.50 / $1). Non serve blocco hard finché il volume
  pay-per-token resta basso — il monitoring è già garantito da aiStats.
- Collegamenti: t16 (refactor hook, elimina duplicazioni costo),
  Report run CRM (decisione in fog harness).

## Question

Le skill aggiungono token input a ogni call (da ~350 token per card fino
a ~4K per logo con brandkit). `aiStats` (TB-026) traccia i costi per
documento ma non cappa. Serve un tetto o un warning per documento (es.
avviso a $X in DocumentAiStats), o il tracciamento esistente basta?
Rilevante solo per provider pay-per-token (DeepSeek/Kimi extra): con
Ollama flat il costo è zero. Da decidere con l'utente in base a quanto
pesa il pay-per-token nel suo uso reale.
