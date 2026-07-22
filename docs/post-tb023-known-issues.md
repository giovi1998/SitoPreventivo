# Post-TB-023 Known Issues & Stato Implementazione

> Ultimo aggiornamento: 2026-07-21

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

---

## ⚠️ APERTI / DA VERIFICARE

### 2b. Icona AI non si carica (CORS / removeBackground / clamp 500KB)

- **Stato**: fix 1K applicato; indagine aggiuntiva su rendering quadrato vuoto in corso.
- **Possibili cause**:
  - CORS su URL immagine generata.
  - `removeBackground.ts` canvas pixel manipulation fallisce in browser reale.
  - Immagine 1K > 500KB → 413 dal clamp server.
  - Card preview container non scalava l'immagine; il CSS `img` della grid cell usava `max-width:100%;max-height:100%`, ma in alcune celle la dimensione calcolata poteva collassare a 0 se la cella non aveva altezza esplicita.
- **File**: `src/hooks/useAIIconHero.ts`, `src/utils/ai/removeBackground.ts`, `api/index.ts`, `src/components/card/CardPreview.tsx`.
- **Test manuale**: generare icona AI su card con sfondo chiaro e scuro, esportare PNG, verificare che l'icona appaia e non sia un quadrato vuoto.

### 3. AI Log Image Preview — persa al refresh

- **Stato**: by design. `imagePreviewBase64` strippato prima di `sessionStorage` per evitare `QuotaExceededError`.
- **Decisione**: non cambiare finché non serve debug produzione.
- **File**: `src/hooks/useAILogs.ts` (`stripPreview`).

---

## 🔧 IMPLEMENTATO: Modulo AI Unificato

### Cosa è stato fatto

1. **Nuovo `useAIHarness` hook** (`src/utils/ai/aiModule.ts`):
   - Risolve provider (default, A/B salt, fallback).
   - Espone preferenze AI: `visionEnabled`, provider, image model.
   - Cattura screenshot preview tramite `capturePreview(selector)`.
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

### Prossima sessione (priorità alta)

1. **Verificare icona AI 1K end-to-end**
   - Apri `/app/card`, genera icona AI.
   - Controlla preview + export PNG/SVG.
   - Se 413, abbassare quality/compressione o tornare a 512 con upscaling.

2. **Aggiungere toggle "Vision AI" nella UI**
   - Posizione consigliata: AIConsole header (icona occhio) o Settings.
   - Quando attivo, `useAI`/`useAICard`/`useAIFlyer`/`useAILogo` continuano a inviare screenshot preview (già fanno).
   - Quando spento, saltare capture per risparmiare token.

3. **Aggiungere bottone "Analizza preview"**
   - Usa `useAIHarness().runDesignReview(docType, docJson, previewSelector)`.
   - Mostrare i suggerimenti in AIConsole children.
   - `docType` supportati: `'card' | 'flyer'`.

### Media priorità

4. **Auto-fallback**
   - Implementare retry in `useAIHarness` o in hook AI: se provider Ollama restituisce 429/503 e `aiAutoFallback` è ON, riprova con `deepseek-chat`.

6. **Costi immagini Gemini**
   - Verificare che `calculateCostUsd('gemini-nano-banana', undefined, 1)` venga propagato nei log dei cover/photo/hero.
   - Oggi è hardcoded `$0.04`/`$0.02`, da confermare in dashboard.

### Bassa priorità / backlog

7. **AI Module test coverage**
   - `src/utils/ai/__tests__/aiModule.test.ts` — provider resolution, capture fallback, design review mock.

8. **Dev proxy `/api/ai/design-review`**
   - Aggiungere in `vite.config.js` se si vuole testare in locale senza chiamare Ollama diretto.
   - Attuale: `useAIDesignReview` chiama `/api/ai/design-review` che in dev passa a Vercel monolith.

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
