# T6 — Agent mode non genera immagini AI (logo bg / card cover+photo / flyer hero)

Labels: wayfinder:ticket, task (AFK)
Blocked by:
Status: closed, assigned to opencode

## Risoluzione

Implementato (2026-08-13):

- `enrichAgentDocWithImages` in `useAutoBuildGenerate.ts`: dopo ogni
  tool testuale dell'agente genera le immagini mancanti riusando gli
  helper esistenti — logo: bg via image-flash + `textBackdrop:'pill'`
  default (§27.4); card: photo via `/api/ai/card-photo` (CON-IS-001) +
  cover via image-flash; flyer: hero via image-flash. Best-effort, mai
  fatale (il testo si salva comunque). aiStats per immagine.
- **Compressione saveDraft path-aware** (bug collaterale trovato live:
  persistita 768×429 sotto soglia): `DRAFT_IMAGE_PATHS` con
  maxDim/maxBytes per path — cover/background/hero 1536px/400KB,
  photo/logoUrl 1024px/400KB (era 768px/200KB piatto). Retry quota con
  override esplicito (1024/200KB).
- Test: T6 hook test (immagini nel save + dims compressione), 39/39.
- Verifica live: Phase B verify TUTTE le immagini ≥1000 (1376×768,
  765×1024, 1376×768, 1024×572) — ALL CHECKS PASS.

## Question

Trovato dalla verifica live T2 (2026-08-13): il flusso agente
("Genera bozze AI" con `agentMode: true`) salva solo il CONTENUTO
testuale dei documenti. `executeTool` in `agentOrchestrator.ts` non
genera mai immagini: `builder.backgroundImage` (logo),
`front.coverImageUrl`/`front.photoUrl` (card), `content.heroImage`
(flyer) restano null — a differenza del path non-agente
(`generateLogoDraft`/`generateCardDraft`/`generateFlyerDraft`) che le
genera sempre.

Fix atteso: dopo ogni tool testuale, generare le immagini riusando gli
stessi helper/endpoint del path non-agente (stesso grounding, stessa
compressione pre-save, §27.4 textBackdrop 'pill' su logo con
backgroundImage). Il save avviene in `onToolResult` con le immagini
incluse. Test: hook test che verifica le immagini nel data salvato.
