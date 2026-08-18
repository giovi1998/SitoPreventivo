# T9 - Guardia anti-regressione permanente: soglie asset/tipografiche in CI

## Problema

Le soglie qualità di `scripts/ai-image-quality-verify.mjs` (Phase B:
gerarchia card 22/16/14, floor contatti retro ~7pt, zero overflow celle,
floor flyer 24pt/10pt, ratio tagline logo 0.30-0.55×, immagini persistite
≥1000px long side) erano **solo script manuali fuori CI** — nessuna
protezione da regressioni silenziose su render preview e densità
immagini (item "Guardia anti-regressione permanente" della mappa,
residuo to-be-done #2 "Immagini AI pixelate — verifica Playwright").

## Fix

Nuovo spec `e2e/ai-image-quality-guard.spec.ts` (4 test, zero chiamate
AI — documenti fixture seedati FLAT in localStorage, gotcha §23;
immagini JPEG 1280×960 generate via canvas, sopra soglia 1000px):

1. **card preview**: gerarchia name>title≥company, floor name 20px /
   company 12px, contatti retro ≥17px (~7pt stampa), zero celle
   `.card-grid-cell--text` in overflow (scrollWidth/Height vs client).
2. **flyer preview**: headline ≥8.4mm (24pt), body ≥3.4mm (10pt), zero
   testi fuori viewBox. qrLabel esente dal floor body (fine print by
   design 5-7pt, `layoutEngine.ts` minFontSizePt:5) — escluso via
   `clip-path="url(#clip-qrLabel)"`.
3. **logo preview**: ratio tagline/wordmark 0.30-0.55 (§27.2), zero
   testi fuori viewBox.
4. **immagini persistite non degradate**: card photo, flyer hero e logo
   background renderizzati ≥1000px long side (separa l'era 512/768px).

Spec aggiunto a `scripts/e2e-gate.mjs` (CRITICAL) → entra nel gate
`npm run test:e2e:critical`.

Gotcha scoperto: il seed back deve avere `back.useGrid: true` — senza,
la preview ignora `backGrid` persistita e deriva il preset default
(services h:1), overflow falso positivo su label + 3 voci
(`CardPreview.tsx` v2.8, `isGridModeFor('back')`).

## Test

- Lo spec stesso: 4/4 verdi standalone (26s).
- Gate completo `npm run test:e2e:critical`: 28/28 verdi (3.0m).

## Stato

Chiuso 2026-08-18. La mappa qualita-oggetti non ha più item aperti di
guardia: soglie asset card/flyer/logo ora in CI.
