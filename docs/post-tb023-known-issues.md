# Post-TB-023 Known Issues & Stato Implementazione

> Ultimo aggiornamento: 2026-07-22 (verifica completa TB-023 — vedi
> `docs/tb023-verification.md` per la checklist REQ con esiti).

---

## ✅ FIXATI (verificati in codebase)

| # | Issue | Fix | File coinvolti |
|---|-------|-----|----------------|
| 1 | `coverImageUrl` non risolto in PNG export | `resolveToBase64DataUrl` per `coverImageUrl` front/back in `pngExport.ts` | `src/utils/card/pngExport.ts` |
| 2 | Back cover wash opacity mismatch | `opacity="0.35"` + gradient 2-stop (0%→45%) | `src/utils/card/svgRenderer.ts` |
| 3 | Icona AI 512px pixelata | `size: '1K'` (1024×1024) | `src/hooks/useAIIconHero.ts` |
| 4 | CONTATTI header retro nascosto | `position: relative; z-index: 2` su `.card-back-header` | `src/components/card/cardPreviewSide.css` |
| 5 | Costi immagini Gemini / log `modelId` | `calculateCostUsd` per logo background e flyer hero; `modelId` e `costUsd` passati al log | `src/hooks/useAILogo.ts`, `src/hooks/useAIFlyer.ts`, `src/utils/logo/backgroundImage.ts`, `src/ai/logoOrchestrator.ts` |
| 6 | Badge provider mostrava costo per-call su Ollama flat | `isFlat` check in `AIProviderBadge` nasconde `lastCostUsd` per provider `unit: 'flat_monthly'` | `src/components/ai/AIProviderBadge.tsx` |
| 7 | "Nuova conversazione" card non puliva log icon hero | `handleResetCardChat` ora chiama sia `resetCardChat()` che `clearIconHeroLogs()`. `useAIIconHero` espone `clear` per il reset. | `src/components/card/CardEditorShell.tsx`, `src/hooks/useAIIconHero.ts` |

---

## ⚠️ APERTI / DA VERIFICARE

### 2b. Icona AI non si carica (removeBackground / clamp 500KB)

- **Stato**: fix 1K applicato; causa CORS esclusa dalla verifica 2026-07-22
  (le immagini sono data URL same-origin, `crossOrigin` irrilevante).
- **Causa più plausibile (da verifica codice)**: `src/utils/ai/removeBackground.ts`
  con `tolerance=240` — se Gemini produce un'icona chiara/pastello su bianco,
  ampie zone dell'icona stessa superano la tolleranza e diventano trasparenti
  → quadrato (quasi) vuoto. Il catch silenzioso in `useAIIconHero.ts:81-83`
  maschera i fallimenti.
- **Causa secondaria**: immagine 1K > 500KB → 413 dal clamp server
  (`api/index.ts:2176-2179`) — ma si manifesta come errore/toast, non come
  quadrato vuoto.
- **Raccomandazione**: test manuale con icone reali; se confermato, alzare la
  tolerance a ~250 (solo near-white puro) o rendere il background removal
  opzionale (toggle "Rimuovi sfondo").
- **File**: `src/hooks/useAIIconHero.ts`, `src/utils/ai/removeBackground.ts`, `api/index.ts`.
- **Test manuale**: generare icona AI su card con sfondo chiaro e scuro, esportare PNG, verificare che l'icona appaia e non sia un quadrato vuoto.

### 3. AI Log Image Preview — persa al refresh

- **Stato**: by design. `imagePreviewBase64` strippato prima di `sessionStorage` per evitare `QuotaExceededError`.
- **Decisione**: non cambiare finché non serve debug produzione.
- **File**: `src/hooks/useAILogs.ts` (`stripPreview`).

---

## 🔧 IMPLEMENTATO: Modulo AI Unificato

### Cosa è stato fatto

1. **Nuovo `useAIHarness` hook** (`src/utils/ai/aiModule.ts`):
   - Risolve provider (default, fallback). ~~A/B salt~~ — A/B testing rimosso
     definitivamente (commit `15aa0d5`), `resolveProviderId` non ha più il
     parametro `salt`.
   - Espone preferenze AI: `visionEnabled`, provider, image model.
   - Cattura screenshot preview tramite `capturePreview(selector)` (usato solo dai singoli hook AI quando vision è attiva).
   - Tracking costi live (`totalCostUsd`, `lastCostUsd`).

2. **Nuovo `AIHarnessConsole` component** (`src/components/ai/AIHarnessConsole.tsx`):
   - Wrapper pre-wired di `AIConsole`.
   - Legge costi e provider da `useAIHarness`.
   - Sostituisce `AIConsole` in tutti gli editor per uniformare il wiring.

3. **Wiring negli editor**:
   - `EditorView.tsx` (quote)
   - `CardEditorShell.tsx` (card)
   - `FlyerEditorShell.tsx` (flyer)
   - `SocialEditor.tsx` (social)

### Cosa ancora NON è cablato (richiede UI esplicita)

| Feature | Stato | Nota |
|---------|-------|------|
| `aiVisionEnabled` toggle | ✅ mostrato in `AIConsole` solo per provider vision-enabled (MiniMax/Gemini) | Off di default; i singoli hook catturano screenshot solo se attiva |
| `aiAutoFallback` toggle | ✅ mostrato in `AIConsole` | Logica di fallback da implementare nel provider layer quando serve |
| `aiABTestingEnabled` toggle | ❌ rimosso definitivamente | A/B testing rimosso dal codebase |
| `useAIDesignReview` wiring UI | ❌ rimossa | Bottone "Analizza preview" tolto: non funzionava e non serviva nel flusso attuale |

---

## 📋 Checklist Prossimi Passi

> Aggiornata 2026-07-22 dopo la verifica completa (`docs/tb023-verification.md`).
> Gli item obsoleti (toggle Vision — già esistente; bottone "Analizza
> preview" — rimosso deliberatamente) sono stati rimossi.

### Priorità alta

1. **Verificare icona AI 1K end-to-end** (issue 2b sopra)
   - Apri `/app/card`, genera icona AI.
   - Controlla preview + export PNG/SVG.
   - Se quadrato vuoto: investigare `removeBackground.ts` tolerance 240.
   - Se 413, abbassare quality/compressione o tornare a 512 con upscaling.

### Media priorità

2. **Gap TB-023 documentati** (stima ~10h, da `tb023-verification.md` §4/§8):
   - REQ-PD-007/008: AI sceglie decoration (schema output + prompt settore + quick chip).
   - REQ-UX-001: DecorationPicker con 6 thumbnail SVG.
   - Flyer: UI decoration manuale (schema+render esistono).
   - REQ-UX-006: tooltip breakdown costi 30gg in `AIProviderBadge`.

3. **Costi immagini Gemini**
   - Verificare che `calculateCostUsd('gemini-nano-banana', undefined, 1)` venga propagato nei log dei cover/photo/hero.
   - Oggi è hardcoded `$0.04`/`$0.02`, da confermare in dashboard.

4. **Mismatch preview/export residui** (`tb023-verification.md` §10):
   wrapping testo (richiede layout engine condiviso), font metrics,
   font preview ridotti su mobile.

### Bassa priorità / backlog

5. **AI Module test coverage**
   - `src/utils/ai/__tests__/aiModule.test.ts` — provider resolution, capture fallback, design review mock.

6. **Codice morto da valutare**
   - `src/hooks/useAIDesignReview.ts` (legacy non importato),
     `src/components/card/ai/CardAIDecorationSection.tsx` (solo test),
     endpoint `/api/ai/design-review` (orfano),
     `src/ai/providers/geminiFlashImage.ts` (solo test).
   - Decisione: tenere per futura UI design-review o rimuovere.

7. **Dev proxy `/api/ai/design-review`**
   - Aggiungere in `vite.config.js` solo se si riattiva la design review in locale.

---

## 🗺️ Mappa File

```
NUOVO:
src/utils/ai/aiModule.ts              ← AI Module core (useAIHarness)
src/components/ai/AIHarnessConsole.tsx  ← AIConsole pre-wired

MODIFICATI:
src/components/EditorView.tsx         ← usa AIHarnessConsole
src/components/card/CardEditorShell.tsx  ← usa AIHarnessConsole
src/components/flyer/FlyerEditorShell.tsx ← usa AIHarnessConsole
src/components/SocialEditor.tsx       ← usa AIHarnessConsole

RIMANGONO:
src/utils/resolveProviderId.ts         ← default + fallback (no A/B)
src/hooks/useAIDesignReview.ts         ← sostituito da aiModule.ts (legacy, non importato)
src/utils/uiPrefs.ts                  ← preferenze AI (vision/fallback/provider)
src/utils/ai/removeBackground.ts       ← verificare con icona 1K
src/hooks/useAILogs.ts                 ← stripPreview (by design)
api/index.ts                           ← clamp 500KB
```

---

## Test manuali consigliati

1. **Icona AI end-to-end**: `/app/card` → tab AI → "Genera icona" → preview + export PNG.
2. **Provider switch**: apri AIConsole in qualsiasi editor, cambia provider dal badge, genera → verifica log modelId.
3. **Vision toggle**: se aggiunto, verificare che screenshot non venga inviato quando OFF.
4. **Design review**: quando aggiunto il bottone, cliccare su card/flyer e verificare che arrivino suggerimenti.
5. **Costi**: generare copy e immagine, controllare che `AILogPanel` mostri costo > 0.
