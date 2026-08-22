# Ticket: Trace Langfuse nei test endpoint non devono uscire al cloud

Labels: `wayfinder:ticket`, `wayfinder:task`
Blocked by: —
Status: closed (2026-08-20, verificato — fix già in main)

## Question

Le trace `flyer-hero` con `{prompt:"p"}` e `sizeKB: 0.0029` (3 byte) su
cloud.langfuse.com erano **trace di test unitari** che scappavano al
cloud: `resetApiTests` non azzerava `LANGFUSE_*`/`VITE_LANGFUSE_*` e
`ingestLangfuse` fa fallback VITE_* → env reali da .env locale → ogni
test endpoint (flyerHero, card-cover, ecc.) mandava OTLP reale con dati
mock.

Fix già applicato (2026-08-12):

- `src/server/__tests__/helpers/apiTest.ts`: `resetApiTests` azzera le 6
  env Langfuse (LANGFUSE_* + VITE_LANGFUSE_*) prima di ogni test.
- Regression test in `flyerHero.test.ts`: nessuna chiamata
  `/api/public/otel/v1/traces` o `/api/public/media` durante i test.
- I test di ingest che VOGLIONO verificare OTLP impostano le proprie env
  DOPO resetApiTests (già così in langfuse.test.ts / langfuseApi.test.ts)
  con fetch stubato.

Output: commit dedicato, `npm run typecheck && npm run test` verdi.
