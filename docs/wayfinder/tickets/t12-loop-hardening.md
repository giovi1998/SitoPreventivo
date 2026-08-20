# Ticket: Loop hardening — dedup tool ed early-stop nell'agente

Labels: `wayfinder:ticket`, `wayfinder:research`
Blocked by: —
Status: closed (2026-08-20, resolution below)

## Risoluzione

Misura effettuata su Langfuse (v2/observations, 17-19/08, ~30 run
`agent:auto-build`):

**Osservazioni reali:**
1. **verify:fix non converge**: 9/30 run terminano con step
   `agent:auto-build:verify:fix` come ultimo step — il modello insiste
   a fixare ma la verify non passa mai (nessun `verify:pass` dopo).
   Questo è lo spreco principale: round bruciati su fix che non chiudono.
2. **Doppio verify:pass**: 1 run con `pass1` DEFAULT + `pass2` DEFAULT +
   `pass2` ERROR (17/08 09:43-09:46) — "riprova una volta" già eseguito,
   poi fallisce.
3. **Nessun dedup args**: nessuna coppia di tool call identica ravvicinata
   osservata. Il dedup per args **non è giustificato** dai dati.

**Decisione (guardia minima):**
- **Early-stop su 2 fix consecutivi senza pass**: in `AgentOrchestrator.run`,
  contare i fallimenti consecutivi; a 2 → stop del loop con sintesi finale
  ("riassumi cosa è stato generato finora"), non nuovo tool call.
- **Niente dedup args** (non osservato; aggiungere solo se le trace future
  mostrano duplicati).
- La sintesi forzata è già il comportamento del round finale: va solo
  assicurata anche sul path early-stop.

**Follow-up registrato in mappa**: bug trace (root duplicate + generation
orfana nella stessa trace — g0qieJCR e A3EJgT+r) da verificare in t07
(threading runid), non è loop hardening.

## Question

Il loop plan→act (8 round, `agentOrchestrator.run`) non ha guardie contro
round sprecati: il modello può richiamare lo stesso tool con argomenti
identici, o insistere dopo fallimenti ripetuti (il "riprova una volta"
è dichiarato solo nel prompt, non enforced in codice). Quali guardie
valgono la pena — dedup per (nome tool + args), stop dopo N fallimenti
consecutivi, round di sintesi forzato — e quali rispondono a un problema
reale osservato nelle trace Langfuse piuttosto che a un timore
speculativo? Misurare prima sulle sessioni `auto-build` esistenti, poi
decidere la guardia minima.
