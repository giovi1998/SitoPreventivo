# Ticket: Resume run agente — stato minimo (t17)

Labels: `wayfinder:ticket`, `wayfinder:grilling`
Blocked by: —
Status: open, unassigned

## Question

Oggi "Genera bozze AI" (`useAutoBuildGenerate`) riparte sempre da zero:
ogni oggetto riparte da createEmpty, il run fallito non si riprende e gli
errori sono "tutto o niente". L'utente vuole poter dire "rifai solo il
logo" o riprendere dove si è fermato.

Deciso in sessione 2026-08-20: **salvare solo lo stato minimo del run**
(luogo: `sessionStorage` o `localStorage` per CRM — deciso qui).

Stato minimo:
- `runId` (riuso) + `startedAt`
- `steps`: array `{step, status, docId?, error?}` (pending/running/done/error)
- `resumeKey`: customerId + docIds (evita resume su cliente diverso)

Logica: in `generateAll`, se il resume key matcha e step status=done
rimane done, gli error tornano in queue per retry selettivo. `onToolResult`
salva per-step. Nessun persistenza cross-tab/sessione oltre il run
stesso (TTL sessionStorage).

Domande aperte:
1. Dove: sessionStorage (per CRM, in-memory) o localStorage (survive
   refresh)? — sessione decide qui.
2. Trigger: auto-resume al click nuovo "Genera bozze" vs prompt
   esplicito "riprendi run precedente"? — prompt esplicito è più
   semplice e prevedibile.
3. TTL: fino a navigazione CRM o `N minuti`? — 30 min in-memory senza
   persistenza.
