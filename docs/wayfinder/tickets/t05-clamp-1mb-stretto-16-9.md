# T5 — Clamp 1MB troppo stretto: logo-background 16:9 va in 413

Labels: wayfinder:ticket, task (AFK)
Blocked by:
Status: closed, assigned to opencode

## Risoluzione

Clamp uniforme 1MB → **1.2MB** (2026-08-13):

- `src/server/core.ts` `GEMINI_IMG_CLAMP_BYTES = 1_200_000` + commento
  probe aggiornato (varianza 16:9 ~1.05MB, 413 intermittenti misurati live).
- `src/server/ai.ts` + dev proxy `vite.config.js`: 5 siti clamp + messaggi
  errore ">1.2MB".
- Test: 413 mock 1.4M→1.8M chars (~1.35MB) su 4 file; titoli aggiornati;
  **nuovo regression test** `logoBackground.test.ts` "~1.05MB accept"
  (caso live esatto). 42/42 verdi sui 5 file Gemini.
- Verifica live post-fix: Phase A 4/4 OK (logo-background 1376×768
  804KB, nessun 413).

## Question

Trovato dalla verifica live T2 (Phase A, 2026-08-13): `logo-background`
(1K, aspect 16:9 fisso → 1376×768 JPEG ≈ 850KB-1.05MB) supera il clamp
uniforme `GEMINI_IMG_CLAMP_BYTES = 1_000_000` con varianza normale →
HTTP 413 "Immagine troppo grande (>1MB)" in faccia all'utente (2 run su
lo stesso prompt: 878KB OK, poi >1MB 413). A rischio anche `flyer-hero`
con `aspectRatio: '16:9'`.

Root cause: il probe 2026-08-07 (~850KB) ha sottostimato la varianza
JPEG del 16:9. Il limite vero da proteggere è la risposta Vercel 4.5MB
(base64 + JSON): un clamp binario di 1.2MB → ~1.6MB on the wire, margine
ampio. La persistenza è già protetta da `compressDataUrl` (400KB/1536px)
quindi localStorage non peggiora.

Fix atteso: clamp uniforme 1MB → **1.2MB** (`src/server/core.ts` +
dev proxy `vite.config.js` + messaggi errore) e test aggiornati
(`flyerHero.test.ts`, `logoBackground.test.ts` e altri che citano il
clamp 1MB).
