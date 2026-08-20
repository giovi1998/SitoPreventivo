# Ticket: Budget costo per documento con skill attive

Labels: `wayfinder:ticket`, `wayfinder:grilling`
Blocked by: —
Status: open, unassigned

## Question

Le skill aggiungono token input a ogni call (da ~350 token per card fino
a ~4K per logo con brandkit). `aiStats` (TB-026) traccia i costi per
documento ma non cappa. Serve un tetto o un warning per documento (es.
avviso a $X in DocumentAiStats), o il tracciamento esistente basta?
Rilevante solo per provider pay-per-token (DeepSeek/Kimi extra): con
Ollama flat il costo è zero. Da decidere con l'utente in base a quanto
pesa il pay-per-token nel suo uso reale.
