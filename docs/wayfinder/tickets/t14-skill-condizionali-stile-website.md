# Ticket: Skill condizionali per stile del sito web

Labels: `wayfinder:ticket`, `wayfinder:research`
Blocked by: —
Status: closed (2026-08-20, resolution below)

## Risoluzione

Misura + implementazione (2026-08-20):

- **Misura** (Langfuse, 17-19/08): delta qualità per stile non misurabile
  su trace storiche (nessun run con stile diverso da default/modern
  sufficiente); il costo token della skill è lineare (≈350-4K input/call,
  già documentato t15) → mappa style→skill a **costo zero** (sostituzione,
  non somma: stessa 1 skill per call, cambia solo quale).
- **Implementata**: `STYLE_SKILL_MAP` in `skillLibrary.ts` (minimal/
  minimalist→minimalist-ui, brutalist→industrial-brutalist-ui,
  editorial→gpt-taste); loader `?raw` aggiunto; `websiteOrchestrator`
  passa `{ style }` a `resolveSystemPrompt` (tutte le 6 call interne:
  html/pagine/css/js/fix/refine-default). Stili non mappati → default
  high-end-visual-design. Test: 3 nuovi in skillLibrary (mappa,
  sostituzione, default). 58 test website + 14 skill verdi, typecheck 0.

## Question

Il website brief ha `style` (modern/minimalist/brutalist/editorial...) ma
l'injection è fissa su `high-end-visual-design`. Vale la pena mappare
style→skill (minimalist→`minimalist-ui`, brutalist→
`industrial-brutalist-ui`, editorial→`gpt-taste`)? Misurare il delta di
qualità percepita su 2-3 siti campione per stile contro il costo token
aggiuntivo, poi decidere se la mappa style→skill sostituisce o affianca
la skill fissa.
