# Ticket: Coherence pass post-run — palette/font unificati CRM (t21-bis)

Labels: `wayfinder:ticket`, `wayfinder:grilling`
Blocked by: —
Status: open, unassigned

## Question

Dopo il run completo (`generateAll` CRM: logo → card → flyer → website),
l'AI genera ogni oggetto con prompt locale: i colori, le palette e i
font possono divergere (il logo scelto può avere una palette diversa
dalla card, il website usa palette dal brief ma non dal logo). Risultato:
il cliente vede oggetti non coerenti tra loro.

Soluzione: **1 call AI post-run** che guarda tutto l'output generato e
rigenera solo le palette/font sbagliate (coherence pass). Scope: CRM
(`agentMode`), post-loop.

**Domanda**: la call post-run deve anche revisionare il copy (t18) in
stessa call, o separata? — Separata: t18 è per singolo oggetto (verify+
rigenera), questa è cross-object (coerenza). Separata evita collisioni.
Consiglio: la coherence call legge gli aiStats generati e le palette
concrete, restituisce patch JSON `{flyer: {...}, website: {...}}` che
applichiamo con un merge locale (no regenerate completo).

Costo: ~1 call post-run (~2K token). Soglia budget (t15) include questa.
