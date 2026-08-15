# T4 — Residui tipografici §27.1/§27.4 card e logo

Labels: wayfinder:ticket, task (AFK)
Blocked by:
Status: closed, assigned to opencode

## Risoluzione

Decisioni sui 4 residui (2026-08-13):

1. **Safe margin card 16px < 4mm → WONTFIX (per ora), motivato**:
   `GRID_PAD_REF=16` (=2.1mm su 85mm) è usato da render + collision
   clamp; le celle grid hanno coordinate ASSOLUTE → alzare il padding
   sposterebbe il clamp e rilayouterebbe tutti i documenti esistenti
   (migrazione). Rimandato a una grid v3 a coordinate relative; 2.1mm
   è accettato dalla maggior parte delle tipografie.
2. **Socials/services sotto 7pt → già risolto parzialmente da v2.19**
   (base/floor 16px = 6pt, floor frazionario DPI-independent). Il 7pt
   pieno (19px) è un tradeoff design (ingrandisce socials/services del
   ~19%): **domanda aperta all'utente**, non applicata unilateralmente.
3. **Thumbnail Collection front-only → WONTFIX (YAGNI)**: la Collection
   mostra il fronte per design; renderizzare anche il retro raddoppia il
   costo delle thumbnail per valore marginale.
4. **Fallback no-grid sizing legacy → CONGELATO**: i documenti nuovi
   usano la grid; il fallback no-grid serve solo retrocompatibilità doc
   pre-grid. Dichiarato legacy frozen: nessun allineamento a CARD_REF
   pianificato.

Nessun fix di codice; punti 1/2 riportati nella sezione "Not yet
specified" della mappa come decisioni future candidate.

## Question

Chiudere i residui noti della design review tipografica
(`docs/agent-gotchas.md` §27.1, decisione 2026-08-06 "realign completo
deferred"), fix diretti con root cause già nota:

1. **Safe margin card 16px < 4mm stampa**: il criterio
   (`design-criteria.md`) chiede 4mm/5-10mm; il frame logico è 640×414
   su 85×55mm → 4mm ≈ 30px logici. Decidere: alzare il padding grid o
   documentare l'eccezione.
2. **Socials/services retro sotto 7pt** ai floor minimi: base già alzata
   a 16px logici (v2.19) ma con shrink possono scendere sotto soglia —
   floor assoluto su socials/services?
3. **Thumbnail Collection front-only**: la card in CollectionView mostra
   solo il fronte — valutare se è il comportamento voluto (YAGNI) o
   aggiungere il retro.
4. **Fallback no-grid sizing legacy**: layout senza griglia usa sizing
   legacy non allineato a CARD_REF — allineare o dichiarare legacy
   congelato.

Ogni punto: fix minimale (lean-code) + test, oppure chiusura motivata
"wontfix" con riga in Risoluzione. Non espandere lo scope oltre i 4
punti.
