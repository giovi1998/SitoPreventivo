# T1 — Allineare gli script di verifica al codice merged

Labels: wayfinder:ticket, task (AFK)
Blocked by:
Status: closed, assigned to opencode

## Risoluzione

Allineato `scripts/ai-image-quality-verify.mjs` (2026-08-13):

- **Header Phase A**: JPEG = output default di `gemini-3.1-flash-image`
  (nessun output control accettato, probe live 2026-08-07); 1K su tutti
  gli endpoint, 2K mai (limite risposta Vercel 4.5MB). Rimosso il
  riferimento a `image_output_options` come prova accettata.
- **Stop rule / nota FATAL**: testo aggiornato ("rifiuto config Gemini",
  il concetto resta — un 400/502 di forma richiesta deve fermare il run).
- **Soglie persistite Phase B**: `IMG_FIELDS` 1300/1100/1024 → **1000
  uniforme**. Motivo: generazione 1K uniforme (long side 1024–1408 a
  seconda dell'aspect) + cap persistenza `compressDataUrl` 1024px
  (background/hero 1536) → le vecchie soglie (era 2K) fallirebbero a
  prescindere (photo persistita = 1024, hero 3:2 ≈ 1248). 1000 separa
  nettamente l'era 512px senza dipendere dall'aspect ratio.
- **Phase A `RAW_MIN` 1024** invariato: misura l'output raw Gemini, caso
  peggiore 1:1 = 1024.
- **Check qualità oggetti** (floor font card/flyer/logo, gerarchia,
  overflow/clipping) invariati.
- `scripts/design-review-ai-gen.mjs` **confermato senza modifiche**: le
  sue soglie misurano gli export client-side (logo PNG 1024², card 300
  DPI 1004×650, flyer ≥1000), indipendenti dalla risoluzione Gemini.


## Question

`scripts/ai-image-quality-verify.mjs` riflette la spec originaria
(2026-08-06): Phase A asserisce `image_size` 2K su flyer-hero /
logo-background e descrive `image_output_options` come accettato. Il
codice merged (2026-08-13, gotchas §2.5 corretta) è: **1K uniforme** su
tutti gli endpoint, clamp 1MB, JPEG default (output options rifiutate,
probe live 2026-08-07 → 400). Le soglie Phase A/B dello script vanno
riallineate al comportamento reale (1K → long side ≥1024 ovunque), senza
indebolire i check di qualità oggetti (floor font, gerarchia, clipping).
Verificare anche le soglie export di `scripts/design-review-ai-gen.mjs`
(logo w===1024, card w≥1000 h≥600, flyer max-side ≥1000): sono misure di
export client-side, probabilmente ancora corrette — confermare o fixare.
