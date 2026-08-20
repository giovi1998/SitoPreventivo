# Ticket: Loop hardening — dedup tool ed early-stop nell'agente

Labels: `wayfinder:ticket`, `wayfinder:research`
Blocked by: —
Status: open, unassigned

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
