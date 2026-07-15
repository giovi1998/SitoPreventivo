# To Be Done — Gap analysis spec ↔ codebase

Snapshot 2026-07-15. Cross-check di 12 spec in `spec/` con
l'implementazione attuale di `src/`, `api/`, `e2e/`.

## Legenda stato

- **DONE** — tutti i REQ funzionali coperti, test verdi
- **PARTIAL** — parte implementata, gap specifici elencati
- **NOT-STARTED** — solo spec scritta, nessun codice/test
- **SUPERSEDED** — sostituito da spec successivo (vedi footer)

---

## Stato per spec

| # | Spec | Stato | Note |
|---|------|-------|------|
| 1 | `spec-ai-assist-unification.md` | **DONE** | Hero flyer spostato SOLO in `FlyerAiPanel`; manual panel mostra solo upload manuale. Audit UI rimane in backlog (TB-006). |
| 2 | `spec-design-ai-card-context-aware-cover.md` | **DONE** | `cardImage`+`logoImage` end-to-end |
| 3 | `spec-design-ai-card-cover-image.md` | **SUPERSEDED → 2** | Sostituito da spec vision-grounded |
| 4 | `spec-design-ai-card-text-vision-split.md` | **DONE** | Architettura isolata, buildCardAIContext già striscia base64 |
| 5 | `spec-design-ai-card-vision-input.md` | **DONE** | Multimodal Gemini immagini di riferimento |
| 6 | `spec-design-ai-flyer-hero-image.md` | **DONE** | Endpoint, hook, heroImage persist |
| 7 | `spec-design-ai-flyer-vision-grounded-hero.md` | **DONE** | Endpoint `/ai/flyer-hero` coperto da `api/__tests__/flyerHero.test.ts` (text-only, image, aspect ratio, 413, 429, 504) |
| 8 | `spec-design-ai-logo-vision-grounded-background.md` | **DONE** | Endpoint `/ai/logo-background` coperto da `api/__tests__/logoBackground.test.ts` |
| 9 | `spec-design-card-grid-layout-event-audit.md` | **DONE** | Harness, events, audit, WYSIWYG, 8 e2e file migrati |
| 10 | `spec-design-flyer-refactor-preview-ai.md` | **DONE** (gap storico noto) | 12/12 utils + 11/11 components, test 4/10 (vedi AGENTS §11) |
| 11 | `spec-design-logo-text-auto-positioning.md` | **DONE** | `hasBgImage` + `textColorMode` + `textBackdrop` + `unionTextBox` |
| 12 | `spec-tool-ai-card-flyer-tools.md` | **DONE** | `ToolAwareOrchestrator` wired end-to-end in `AIOrchestrator`, `CardAIOrchestrator`, `FlyerAIOrchestrator`; test tool path e fallback verdi |

---

## Triage per priorità

### 🔴 P0 — Bloccante produzione / impatta costi

#### TB-001 Wiring `ToolAwareOrchestrator` end-to-end ✅ COMPLETED
- **Spec**: #12 (tool-ai-card-flyer-tools.md) REQ-003/004/005/006
- **Implementato**: `ToolAwareOrchestrator<T>` aggiunto a `BaseOrchestrator.ts`;
  `AIOrchestrator`, `CardAIOrchestrator`, `FlyerAIOrchestrator` estendono la
  classe generica; tool registrati e multi-turn con tool funzionante.
- **Test**: `cardOrchestrator.test.ts` e `flyerOrchestrator.test.ts` includono
  caso tool path e no-tool fallback.
- **Commit/PR**: pronto per push dopo verifica typecheck+test.

#### TB-002 Test server `cardCover`, `logoBackground`, `flyerHero`, `cardPhoto` ✅ COMPLETED
- **Spec**: #2/5/7/8 (tutte le vision-grounded) §6
- **Implementato**: 4 nuovi test in `api/__tests__/` con shared harness
  `api/__tests__/helpers/apiTest.ts` che mocka Drizzle + GoogleGenAI.
- **Casi coperti**: text-only vs parts input, grounding, 500KB clamp,
  rate-limit 429, copyright filter 400, timeout 504, aspect ratio.

#### TB-003 Flyer hero bottone in MANUAL panel (contro REQ-020 spec #1) ✅ COMPLETED
- **Spec**: #1 REQ-020/REQ-007 + V-007
- **Implementato**: rimosso bottone "Genera hero AI" da `FlyerManualPanel`;
  ora mostra solo upload manuale + rimando "usa il pannello AI Assist".
  `FlyerAiPanel` è il single entry point. Test `FlyerManualPanel.test.tsx`
  e `FlyerAiPanel.test.tsx` aggiornati e verdi.

---

### 🟡 P1 — Quality / coverage gap

#### TB-004 Test helper `backgroundImage.ts` (logo)
- **Spec**: #8 REQ-002/003/004 + §6
- **Gap**: `src/utils/logo/backgroundImage.ts` ha
  `renderLogoScreenshot`, `compressPreviousBackground`,
  `buildLogoBackgroundPayload`. **Nessun test file**.
  `compressForAI.test.ts` esiste come helper, ma la composizione
  specifica del logo no.
- **Test da creare**: `src/utils/logo/__tests__/backgroundImage.test.ts`
  - `renderLogoScreenshot` ritorna data URL quando `builderToSvg` OK
  - `renderLogoScreenshot` ritorna undefined quando builder vuoto (no text)
  - `compressPreviousBackground` ritorna undefined quando `backgroundImage` null
  - `buildLogoBackgroundPayload` include `logoImage` + `previousBackground` se presenti
  - Body-size fallback (AC-004 spec #8): drop `previousBackground` prima, poi `logoImage`

#### TB-005 Test `cardCover.test.ts` lato client
- **Spec**: #2 §6, #5 §6
- **Gap**: `useAICard.test.ts` testa `generateCover` ma
  `buildCoverRequest` (REQ-005 spec #2) non esiste come unit isolata.
  La composizione payload + fallback body-size non è testata in
  isolamento.
- **Test da creare**: `src/utils/card/__tests__/aiCoverImage.test.ts`
  - `buildCoverRequest` ritorna `{ prompt, context, cardImage, logoImage, side }` corretto per AC-002/003/004
  - Body-size fallback: drop logoImage prima, poi cardImage, poi text-only
  - `compressForAI` re-encodes 1MB PNG → JPEG < 400KB

#### TB-006 Audit condivisione REQ-040/041 (spec #1)
- **Spec**: #1 AC-040 — "produce documento che elenca minimo 5 pattern
  duplicati con proposta di astrazione per ciascuno"
- **Gap**: `doc/audit-ui-components.md` non esiste.
  **Stato noto** (analisi statica di questa sessione):
  1. **Font picker**: estratto ✅ in `ai-ui/AiFontPicker.tsx`
  2. **Color picker**: vedo usi sparsi (`CardStyleFields`, `FlyerStyleFields`, `BuilderPanel`, `EditorView`) ma nessun `AiColorPicker` centralizzato
  3. **Tier guard**: esiste `AiTierGuard` in `ai-ui/` ma `CardFormFields`/`FlyerManualPanel`/logo AI fanno check `tier === 'unlocked'` inline (vedi `FlyerManualPanel.tsx:234` vs `FlyerAiPanel.tsx:100`)
  4. **AI panel "section + tier guard + helper text" pattern**: replicato 5+ volte (card, flyer, logo, social, onboarding) — potrebbe diventare composable unico
  5. **Prompt library** (salva/applica/elimina brief AI): replicato in `LogoAiPanel` (logo) e `FlyerEditorShell` (flyer hero) — stessa shape `PromptLibraryEntry`, due storage separati
  6. **Hero upload + preview + remove**: replicato 2x (card photo + flyer hero)
- **Impatto**: 5 pattern duplicati, ma con scope e API diversi. La
  priorità è fare un documento di audit + identificare quale estrarre
  per prima. Raccomandato partire da **prompt library** (più
  duplicato, refactor indolore) e **tier guard** (già esiste, basta
  usarlo ovunque).

#### TB-007 Test mancanti per refactor flyer (spec #10)
- **Spec**: #10 §6 — `geometry.test.ts`, `svgRenderer.test.ts`,
  `templateCatalog.test.ts` (oltre a quelli esistenti)
- **Stato noto** (AGENTS.md §11 fase 11): test matrix 4/10. Mancano
  i 6 file elencati sopra.
- **Impatto**: il layout engine è il "source of truth" della geometria
  del flyer. Senza unit test esaustivi, qualsiasi modifica al fitting
  testo può rompere output. Le fix recenti sui gotcha volantino (vedi
  AGENTS.md "Volantino rendering gotchas" punti 1-9) sono il tipo di
  bug che test mancanti lasciano passare.

---

### 🟢 P2 — Polish / nice to have

#### TB-008 README privacy section per spec vision-grounded
- **Spec**: #2/5/7/8 §COM-001 follow-up
- **Gap**: card screenshot (con PII nome/cognome/email) e logo
  screenshot (con brand) sono inviati a Google Gemini API. Manca
  disclosure in `README.md`.
- **Impatto**: GDPR/privacy compliance. Non blocca, ma va fatto.

#### TB-009 Verifica costi Gemini vision-grounded
- **Spec**: #2/5/7/8 §11 — tutte avvertono "must be confirmed in
  dashboard"
- **Gap**: numeri `~$0.04/call` non verificati. Nessun `costTracker`
  né budget alert.
- **Impatto**: rampa produzione potrebbe costare più del previsto. Da
  fare una tantum guardando dashboard.

#### TB-010 `cardHarness` estensioni (spec #9 §4.1)
- **Spec**: #9 REQ-HAR-002 — il harness ha 15 funzioni elencate
- **Stato**: le 15 funzioni ci sono (`e2e/helpers/cardHarness.ts`).
  Possibile estensione: helper per `parseCardSvg` (esiste già come
  pura, da verificare copertura 8 file e2e).

---

## Spec da cancellare (già implementati e sostituiti)

| File | Motivo cancellazione |
|------|----------------------|
| `spec/spec-design-ai-card-cover-image.md` | **SUPERSEDED** da `spec-design-ai-card-context-aware-cover.md` (testo+visione). Vision-grounded l'ha reso obsoleto |
| `spec/spec-design-ai-card-text-vision-split.md` | **MERGED** in `context-aware-cover.md` §REQ-001/002/003. Architettura documentata ma non c'è codice nuovo da tracciare separatamente |
| `spec/spec-design-ai-card-vision-input.md` | **MERGED** in `context-aware-cover.md` (input shape A/B e grounding instruction). Stesso destino del text-vision-split |

Le 3 spec sopra possono essere rimosse o mantenute come archivio
storico. Suggerimento: mantenere le superseded come riferimento
(rimangono informative sul perché delle scelte), marcare
`status: superseded` in frontmatter.

---

## Roadmap raccomandata

```
Sprint 1 ✅ done:    TB-001 wiring ToolAwareOrchestrator
                    TB-003 rimuovere bottone hero da manual panel
                    TB-002 test 4 endpoint Gemini (regression gratis)

Sprint 2 (next):    TB-004 + TB-005 test helper mancanti
                    TB-006 audit-ui-components.md (doc-only)

Sprint 3 (opz):     TB-007 test flyer refactor (6 file)
                    TB-008 README privacy
                    TB-009 verifica costi
```

**Effort rimanente**: ~2-3 giorni uomo (P1+P2).

**Quick win già fatti**: TB-003 + 4 file test Gemini.

---

## Note su come migliorare la "harness della codebase"

1. **Mancano fixture builders condivisi**. Ogni test e2e ricrea da zero
   la card. Creare `e2e/fixtures/` con:
   - `giovanniTemplate.json` (snapshot di `createGiovanniCardTemplate`)
   - `sampleFlyer.json`
   - `sampleQuote.json`
   - `adminUser.json` / `freeUser.json` / `unlockedUser.json`
   Permette test deterministici senza dipendere da `createXxx()`.

2. **`test:db` mancante**. `dataService.js` ha `IS_LOCAL` per
   localStorage vs API. I test usano localStorage (ok) ma nessun
   reset esplicito. Aggiungere `globalThis.beforeEach` con reset
   chiavi conosciute (`precisionQuote_documents:v1`,
   `userSettings_*`, ecc.) — oggi fatto inline in alcuni file.

3. **Coverage report non in CI**. `vitest.config.ts` ha threshold?
   Verificare; se manca, aggiungere `--coverage` in `npm run test`
   e threshold 60% su `src/`.

4. **E2E `__screenshots__/` è committed** (vedi spec #9 §REQ-E2E-004).
   Se le PNG pesano > 1MB ciascuna, valutare LFS o rigenerazione on
   demand. Corrente: `< 500KB` per file, OK.

5. **`api/__tests__/` manca `setup.ts` comune**. Ogni test fa
   `vi.mock('@/lib/db')` (o simile) inline. Estrarre in
   `api/__tests__/setup.ts` con mock Drizzle standardizzati.

6. **Manca `test:e2e:ci`** in `package.json`. Aggiungere:
   ```json
   "test:e2e:ci": "playwright test --reporter=line --workers=1"
   ```
   Per CI seriale (debug) e `"test:e2e:local": "playwright test"`
   per dev parallelo.

7. **Mock DeepSeek / Gemini centralizzato**. Ogni orchestrator test
   ricrea il mock provider. Estrarre in `src/ai/__mocks__/` con
   factory `createMockProvider(opts)`.
