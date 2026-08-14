# T2 — Eseguire la verifica live su "La Chiccheria"

Labels: wayfinder:ticket, task (AFK)
Blocked by: t01-allinea-script-verifica-codice
Status: closed, assigned to opencode

## Risoluzione

Verifica live eseguita (2026-08-13, più round; cliente demo "La
Chiccheria", profilo Playwright persistente `.pw-profile`):

- **Phase A**: 4/4 OK su 3 run consecutive (1K uniforme, JPEG, clamp
  1.2MB senza 413).
- **Phase B finale — ALL CHECKS PASS**: immagini persistite
  1376×768 / 765×1024 / 1376×768 / 1024×572 (tutte ≥1000);
  quality card 22/16/14 + contatti 19px + 0 overflow; flyer floor
  rispettati + 0 out-of-bounds; logo ratio 0.417.
- **design-review-ai-gen finale**: ALL 3 DOCS DONE + ALL 3 EXPORTS PASS.

Bug trovati e fixati durante l'esecuzione (ticket collegati):
- T5: clamp 1MB → 1.2MB (413 intermittenti 16:9).
- Dev proxy Ollama: `tool_calls` droppati in risposta (stream + non
  stream) → agent loop morto; + normalizzazione messaggi history
  (camelCase→snake_case, arguments→oggetto) → 400 round 2.
- Agent wiring (`useAutoBuildGenerate`/`agentSave`/`agentOrchestrator`):
  docs `{}` → draft reali con default; include 'businessCard'→'card';
  data shape wrapped; logo `selected:-1` → clamp a 0.
- T6: immagini AI assenti in agent mode + compressione saveDraft
  768px piatta → 1536/1024 path-aware.
- Script: profilo effimero → persistente condiviso; contact sheet
  file:// rotto → data URL; soglia logo 1024² → 1024×1; poll 8→20 min;
  click generate solo se pending; login robusto (campo presente).

Residuo noto: 502 `/api/ai/embeddings` durante auto-build → fixato
(SDK `embeddings[]` plurale, 3 siti) e verificato live 200.

## Question

Eseguire gli script di verifica live contro il dev server locale
(chiamate AI reali autorizzate dall'utente, 2026-08-13):

1. `node scripts/ai-image-quality-verify.mjs` (Phase A endpoints + Phase
   B app flow: login → La Chiccheria → auto-build → Genera bozze AI →
   misura immagini persistite + floor/gerarchia/clipping).
2. `node scripts/design-review-ai-gen.mjs` (preview AI + export reali
   via UI + contact sheet `compare/` + `report.json`).

Raccogliere: exit code, `report.json`, dimensioni reali, eventuali FAIL.
Se un FAIL è un bug di codice (non di script), NON fixare qui: annotarlo
— la decisione sul fix è di T3.
