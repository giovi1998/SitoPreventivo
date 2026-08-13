# Tracker locale wayfinder — operazioni

Tracker di default (gh non autenticato nel repo). Le mappe e i ticket
vivono qui, in markdown, sotto `docs/wayfinder/`.

## Convenzioni

- **Mappa**: `docs/wayfinder/<name>-map.md` (o `map.md`), etichettata
  `wayfinder:map` nel titolo. È l'indice: Decisions so far + link ai
  ticket, mai il dettaglio completo.
- **Ticket**: `docs/wayfinder/tickets/<slug>.md`, intestazione con
  labels `wayfinder:ticket` + tipo (`research`/`grilling`/`prototype`/
  `task`), `Blocked by:` (slug dei ticket), `Status: open|closed,
  assigned to <chi>|unassigned`.
- **Claim**: prima di lavorare un ticket, aggiornare Status con
  `assigned to <dev>` (concorrenza tra sessioni).
- **Frontier**: ticket open, non bloccati, non assegnati. Blocco = riga
  `Blocked by:` non vuota con ticket ancora open.
- **Refer by name**: nei messaggi e in Decisions so far, citare i ticket
  per titolo (link), mai per slug/id nudo.

## Ciclo di vita

1. **Creazione**: aprire il ticket con `Status: open, unassigned`; dopo
   la creazione di tutti i ticket, cablare le righe `Blocked by:`.
2. **Lavoro**: claim (Status + assignee) → risolvere → postare la
   risposta come sezione `## Risoluzione` nel ticket → `Status: closed`.
3. **Decisioni so far**: dopo la chiusura, aggiungere una riga in mappa
   (titolo link + gist di una riga).
4. **Fog → ticket**: ciò che diventa specificabile esce da "Not yet
   specified" e diventa ticket figlio (create-then-wire).
5. **Fuori scope**: chiudere e spostare in "Out of scope" della mappa.
