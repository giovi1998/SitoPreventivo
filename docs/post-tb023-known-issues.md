# Post-TB-023 Known Issues & Stato Implementazione

> Ultimo aggiornamento: 2026-07-23 (fix responsive preview, vision capture,
> AI log image previews, auto-grow textarea — vedi commit 7a4c349..3cd1b70).

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
| 8 | **Preview mobile ≠ desktop (card)**: font contatti retro ridotti su ≤900px, zoom forzato 0.7 | 🛠️ Auto-fit via ResizeObserver (CardPreviewSurface): la card è sempre renderizzata a 640px logici e scalata intera. Rimossi override font mobile (`cardBase.css`) e zoom forzato (`CardEditorShell`). Proporzioni identiche mobile/desktop. | `src/components/card/CardPreviewSurface.tsx`, `src/components/card/cardBase.css`, `src/components/card/CardEditorShell.tsx` |
| 9 | **Vision capture inconsistente (flyer/logo/quote)**: DOM query `[data-*]` non trovava l'elemento quando il tab era diverso | 🛠️ Server-side preview renderers: `quotePreviewImage`, `flyerPreviewImage`, `logoPreviewImage` rendono l'anteprima su canvas senza DOM. Content check: skip se documento vuoto. | `src/utils/quote/quotePreviewImage.ts`, `src/utils/flyer/flyerPreviewImage.ts`, `src/utils/logo/logoPreviewImage.ts`, `src/hooks/useAI.ts`, `src/hooks/useAIFlyer.ts`, `src/hooks/useAILogo.ts` |
| 10 | **captureElement blob URL revoked prematurely**: `URL.revokeObjectURL` chiamato prima del resolve del loadImage | 🛠️ Data URL invece di blob URL, white fill per JPEG trasparenza, 5s timeout. | `src/utils/ai/captureElement.ts` |
| 11 | **data-flyer-preview su wrapper sbagliato**: il data attribute era su `FlyerPreviewPanel` ma la query usava `[data-flyer-preview]` su `FlyerPreview` | 🛠️ Attributo spostato su `FlyerPreview`. | `src/components/flyer/FlyerPreview.tsx`, `src/components/flyer/FlyerPreviewPanel.tsx` |
| 12 | **Logo AI panel senza preview per vision**: `data-logo-preview` mancante nella tab AI | 🛠️ `LogoAiPanel` ora rende un'anteprima SVG live del logo corrente con `data-logo-preview`. | `src/components/LogoAiPanel.tsx`, `src/components/LogoAiPanel.css` |
| 13 | **AI log panel details troppo piccoli**: max-height 280px non bastava per immagini e dettagli lunghi | 🛠️ Aumentato max-height (280→400px, fullscreen 400→600px), word-break `break-word`. | `src/components/AILogPanel.css` |
| 14 | **AI log detail cap troppo basso** (2048 chars): risposte AI lunghe troncate nei log | 🛠️ Cap aumentato a 16384 in tutti gli hooks (useAI, useAICard, useAIFlyer, useAILogo, useAISocial, useAIOnboarding) e MAX_DETAIL_CHARS in useAILogs. | `src/hooks/useAI.ts`, `src/hooks/useAICard.ts`, `src/hooks/useAIFlyer.ts`, `src/hooks/useAILogo.ts`, `src/hooks/useAISocial.ts`, `src/hooks/useAIOnboarding.ts`, `src/hooks/useAILogs.ts` |
| 15 | **Prompt textarea non espandibile**: textarea in flyer/logo partiva con rows=3 senza auto-grow | 🛠️ `AiPromptTextarea` ora ha auto-grow via scrollHeight (max 320px). | `src/components/ai-ui/AiPromptTextarea.tsx` |
| 16 | **Provider selection non persisteva tra editor**: cambiare provider in un editor non si propagava agli altri | 🛠️ `onProviderChange` callback in AIHarnessConsole → AppShell → `setAiProviderDefault`. | `src/components/ai/AIHarnessConsole.tsx`, `src/components/AppShell.tsx`, `src/components/EditorView.tsx`, `src/pages/app/EditorPage.tsx` |
| 17 | **Flyer svgRenderer body in foreignObject non rasterizzabile**: `<img>` e canvas non supportano foreignObject | 🛠️ Opzione `renderBodyAsText` per rendering SVG nativo (text) quando il SVG viene rasterizzato. | `src/utils/flyer/svgRenderer.ts` |

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

- **Stato**: ✅ FIXATO (2026-07-23). Ora i log di flyer/logo/quote includono
  `imagePreviewBase64` (screenshot server-side o immagine generata). La preview
  resta in memoria durante la sessione; al refresh viene strippata da
  `sessionStorage` (by design, per `QuotaExceededError`).
- **File**: `src/hooks/useAILogs.ts` (`stripPreview`), `src/hooks/useAIFlyer.ts`,
  `src/hooks/useAILogo.ts`, `src/hooks/useAI.ts`.

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

> Aggiornata 2026-07-23 dopo i fix responsive/vision/log (commit 7a4c349..3cd1b70).

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
   wrapping testo (richiede layout engine condiviso), font metrics.
   ~~Font preview ridotti su mobile~~ → **RISOLTO** (issue 8: auto-fit).

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
NUOVO (2026-07-23):
src/utils/quote/quotePreviewImage.ts    ← server-side quote preview renderer
src/utils/flyer/flyerPreviewImage.ts    ← server-side flyer preview renderer
src/utils/logo/logoPreviewImage.ts      ← server-side logo preview renderer
docs/agent-gotchas.md                   ← detailed gotchas per ogni modulo

MODIFICATI (2026-07-23):
src/components/card/CardPreviewSurface.tsx  ← auto-fit ResizeObserver
src/components/card/cardBase.css            ← rimosso @media ≤900px
src/components/card/CardEditorShell.tsx     ← rimosso zoom forzato mobile
src/components/flyer/FlyerPreview.tsx       ← data-flyer-preview spostato qui
src/components/LogoAiPanel.tsx              ← live preview SVG con data-logo-preview
src/components/ai-ui/AiPromptTextarea.tsx   ← auto-grow
src/components/AILogPanel.css               ← max-height aumentato
src/utils/ai/captureElement.ts              ← data URL, timeout, white fill
src/hooks/useAI.ts / useAICard.ts / useAIFlyer.ts / useAILogo.ts / useAISocial.ts  ← detail cap 16384
src/components/ai/AIHarnessConsole.tsx      ← onProviderChange callback
src/components/AppShell.tsx                 ← provider persistence

NUOVO (pre-2026-07-23):
src/utils/ai/aiModule.ts              ← AI Module core (useAIHarness)
src/components/ai/AIHarnessConsole.tsx  ← AIConsole pre-wired

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
