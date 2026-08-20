# Ticket: Widget soglia budget in DocumentAiStats (t23)

Labels: `wayfinder:ticket`, `wayfinder:task`
Blocked by: —
Status: open, unassigned

## Question

Follow-up di t15 (chiuso: warning visibile, no blocco). Implementare il
widget:

- `src/components/DocumentAiStats.tsx`: oltre soglia $X per documento,
  badge arancione "⚠ spesa $X" accanto al costo cumulato, senza bloccare
  la generazione.
- Soglia di default da decidere qui: candidati $0.50 / $1.00 (per-document
  aiStats.totalCostUsd, TB-026).
- Rilevante solo per provider pay-per-token: dal 2026-08-20 tutto Ollama è
  flat ($20/mo) e DeepSeek resta pay-per-token → la soglia ha senso solo
  se il chiamante usa DeepSeek/Kimi legacy.

Deliverable: badge + test (sotto soglia → nessun badge, sopra → badge con
costo formattato da formatCostUsd).
