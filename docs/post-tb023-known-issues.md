# Post-TB-023 Known Issues & Limitazioni

> Ultimo aggiornamento: 2026-07-21

---

## 1. Preview vs Export — Differenze visive (cover AI, wash opacity)

**Sintomo**: il background generato da AI (cover) appare diverso nella preview React rispetto all'export SVG/PNG/PDF.

### Causa radice

| Differenza | Dettaglio | File |
|------------|-----------|------|
| **`coverImageUrl` non risolto in PNG export** | `pngExport.ts` risolve `photoUrl` e `logoUrl` in base64 via `resolveToBase64DataUrl()`, ma **NON** fa lo stesso per `coverImageUrl`. Se la cover è un URL esterno/blob URL (non data:), il canvas non riesce a caricarla (CORS). | `src/utils/card/pngExport.ts:33-44` |
| **Back cover wash opacity mismatch** | Preview React: `opacity: 0.35`. SVG export: `opacity="0.6"`. Differenza visibile su card retro con cover. | Preview `CardPreview.tsx:411`, SVG `svgRenderer.ts:449` |
| **Gradient stop positions** | Front wash: preview stop a `40%`, export stop a `55%`. Simili ma non identici. | `CardPreview.tsx:230`, `svgRenderer.ts:219-222` |

### Fix necessari

1. **`pngExport.ts`**: aggiungere `resolveToBase64DataUrl` per `coverImageUrl` (come già fatto per `photoUrl`/`logoUrl`).
2. **`svgRenderer.ts`**: allineare back cover wash opacity da `0.6` a `0.35`.
3. **Gradient stops**: verificare che preview e export usino gli stessi valori di stop-opacity e posizione.

---

## 2. Card Icona AI — Pixelata / Non si carica in preview/export

**Sintomo**: l'icona generata da AI appare pixelata nell'anteprima e nell'export, oppure non si carica.

### Causa radice

| Differenza | Dettaglio | File |
|------------|-----------|------|
| **Risoluzione generazione: 512×512** | Gemini Flash riceve `size: '512'` → immagine 512×512px. Per card in export a 1700×1100 (300 DPI), una cella foto 2×2 può essere ~700px → upscaling da 512px = pixelazione visibile. | `src/hooks/useAIIconHero.ts:53`, `api/index.ts:2162` |
| **Clamp server 500KB** | Se l'immagine supera 500KB viene scartata con 413. L'utente non vede errore chiaro (toast generico). | `api/index.ts:2176` |
| **`removeWhiteBackground` non scala** | La funzione preserva la dimensione originale (512×512), non fa upscaling. | `src/utils/ai/removeBackground.ts:12-14` |
| **Logo in cella: max 72%** | Quando applicata come logo, viene ridotta a `max-width: 72%` della cella. Se la cella è piccola (~113px), il logo esce a ~81px → nessun problema. Ma in export grande la cella può essere 370px+ → il logo 512px è al limite. | `cardPreviewSide.css:91-100`, `svgRenderer.ts:310-332` |
| **Foto in cella: 100% width** | Quando applicata come foto, riempie tutta la cella. Cella 2×2 in export = ~700px → upscaling da 512px = pixelata. | `cardPreviewSide.css:67-76` |

### Fix necessari

1. **Aumentare risoluzione**: cambiare `size: '512'` → `'1K'` in `useAIIconHero.ts`. Attenzione al clamp 500KB server-side.
2. **Alternativa**: usare `size: '1K'` solo per export (richiede cambiare il flusso per passare la dimensione desiderata).
3. **UI hint**: aggiungere indicatore risoluzione nella sezione "Icona AI" (es. "512×512px — per export HD, usa 1K").
4. **Fallback graceful**: se l'immagine è troppo piccola per l'export, downscale il container invece di upscaling l'immagine.

---

## 3. AI Log Image Preview — Comportamento attuale

**Sintomo**: le immagini dei log AI non sopravvivono al refresh della pagina.

### Comportamento attuale (by design)

| Campo | Comportamento | File |
|-------|---------------|------|
| `imagePreviewBase64` | Salvato in React state, **strippato** prima di sessionStorage | `useAILogs.ts:49-55` (`stripPreview()`) |
| `hasImage` | Flag booleano, **persiste** in sessionStorage | `useAILogs.ts:103` |
| `detail` | Truncato a 8192 chars per storage | `useAILogs.ts:25-29` |
| `costUsd`, `modelId` | Persistono normalmente | `useAILogs.ts:225-226` |

### Perché le immagini vengono strippate

- `localStorage`/`sessionStorage` ha quota 5-10MB/origin condivisa con altri dati dell'app.
- 40 log × 150KB (JPEG 1024px) = ~6MB → supera la quota → crash `QuotaExceededError`.
- Il crash nella cleanup sincrona di `useEffect` propagava l'eccezione all'`ErrorBoundary` → schermata rossa (bug già fixato in fase v2.3 del logo, documentato in AGENTS.md gotcha #12).

### Workaround attuale

- `hasImage` resta visibile come badge 🖼️ anche dopo refresh (ma il click non mostra l'immagine).
- Le immagini sono disponibili solo nella sessione corrente (fino al cambio tab o refresh).
- `captureElementAsBase64` produce JPEG 1024px × 0.85 quality (~50-150KB per entry).

### Possibili miglioramenti futuri

| Opzione | Pro | Contra |
|---------|-----|--------|
| **A) Salva solo le ultime N immagini** (es. 5) | Riduce storage a ~750KB | L'utente perde preview dei log più vecchi |
| **B) Salva a risoluzione ridotta** (256px, quality 0.5) | ~10-20KB per entry | Qualità molto bassa |
| **C) Salva su IndexedDB** | Quota dedicata, non condivisa | Complessità aggiuntiva, necessita cleanup |
| **D) Non cambiare** (status quo) | Zero rischio, zero complessità | Preview persa al refresh |

---

## 4. TB-023 Features — UI Wiring mancante

**Sintomo**: molte feature TB-023 sono implementate nel codice ma non hanno alcuna UI esposta all'utente. L'utente non può attivarle/disattivarle.

### Audit completo

| Preferenza | Getter | Setter chiamato da UI? | Consumer in produzione | Stato |
|------------|--------|----------------------|----------------------|-------|
| `aiProviderDefault` | `getAiProviderDefault()` | **SI** — `AIProviderBadge.tsx:59` | `resolveProviderId.ts:19,44` | ✅ Wired |
| `aiImageModelDefault` | `getAiImageModelDefault()` | No (solo badge provider) | Logo orchestrator | ⚠️ Parziale |
| `aiVisionEnabled` | `getAiVisionEnabled()` | **NO** — setter mai importato | **Orfano** — nessun consumer lo legge | ❌ Dead code |
| `aiRagClientsEnabled` | `getAiRagClientsEnabled()` | **SI** — `ClientRagPanel.tsx:77` | `ClientRagPanel.tsx:36,45` | ⚠️ Panel orfano |
| `aiAutoFallback` | `getAiAutoFallback()` | **NO** — setter mai importato | **Orfano** — nessun consumer lo legge | ❌ Dead code |
| `aiABTestingEnabled` | `getAiABTestingEnabled()` | **NO** — setter mai importato | `resolveProviderId.ts:16` (sempre false) | ❌ Irraggiungibile |

### Componenti orfani (implementati ma non montati)

| Componente | File | Stato |
|------------|------|-------|
| `useAIDesignReview` hook | `src/hooks/useAIDesignReview.ts` | **Nessun `.tsx` lo importa** — hook completamente implementato ma mai usato |
| `ClientRagPanel` | `src/components/rag/ClientRagPanel.tsx` | **Nessun genitore lo monta** — ha il suo toggle interno ma il pannello è irraggiungibile |

### Cosa manca

1. **`SettingsPage` non ha preferenze AI** — La pagina impostazioni ha solo "Sicurezza" e "Account". Zero toggle per provider, vision, A/B, fallback, RAG.
2. **`AIProviderBadge` non espone A/B** — Il dropdown provider seleziona il provider di default ma non ha toggle per A/B testing.
3. **`AIConsole` non ha settings** — È solo presentazione (collapse, prompt, log). Nessun pannello impostazioni.
4. **`resolveProviderId` legge `aiABTestingEnabled`** ma è sempre `false` perché nessuno può cambiarlo → il ramo A/B è unreachable.

### Fix necessari

1. **Aggiungere tab "AI" in `SettingsPage`** con toggle per:
   - Provider di default (riusare `AIProviderBadge` o selettore dedicato)
   - Vision feedback ON/OFF (`aiVisionEnabled`)
   - A/B testing ON/OFF (`aiABTestingEnabled`)
   - Auto-fallback ON/OFF (`aiAutoFallback`)
   - RAG clienti ON/OFF (`aiRagClientsEnabled`)
2. **Montare `ClientRagPanel`** da qualche parte (settings o sidebar)
3. **Wire `useAIDesignReview`** nei componenti che generano card/quote/flyer/logo
4. **Wire `aiVisionEnabled`** — attualmente nessun consumer lo legge, quindi anche con il toggle non farebbe nulla. Serve collegarlo al flusso di screenshot capture.

---

## 5. Riepilogo priorità

| # | Issue | Severità | Sforzo fix | Priorità |
|---|-------|----------|------------|----------|
| 1a | `coverImageUrl` non risolto in PNG export | Alta (cover mancante in PNG) | Basso | **P1** |
| 1b | Back cover wash opacity mismatch | Media (visibile ma non bloccante) | Basso | **P2** |
| 2a | Icona AI 512px pixelata in export HD | Media (visibile su export grande) | Medio (serve 1K + gestione clamp) | **P2** |
| 2b | Icona AI non si carica (errori CORS/removeBackground) | Alta (funzionalità rotta) | Basso | **P1** |
| 3  | Log image preview persa al refresh | Bassa (by design) | Medio (IndexedDB o simile) | **P3** |
| 4a | A/B testing toggle assente da UI | Alta (feature implementata ma irraggiungibile) | Medio (SettingsPage tab AI) | **P1** |
| 4b | `useAIDesignReview` hook orfano | Media (hook mai importato) | Basso (wire nei parent) | **P2** |
| 4c | `ClientRagPanel` orfano | Media (componente mai montato) | Basso (montare in settings/sidebar) | **P2** |
| 4d | `aiVisionEnabled` / `aiAutoFallback` orfani | Media (toggle esistono ma nessun consumer) | Medio (servirebbe consumer logic) | **P2** |
| 4e | `SettingsPage` senza preferenze AI | Alta (utente non può configurare nulla) | Medio (nuova tab AI) | **P1** |

---

## 6. File coinvolti (mappa rapida)

```
src/utils/card/pngExport.ts          ← fix coverImageUrl resolve (1a)
src/utils/card/svgRenderer.ts        ← fix back cover opacity (1b)
src/hooks/useAIIconHero.ts           ← aumentare size 512→1K (2a)
api/index.ts                         ← clamp 500KB (2a), endpoint /ai/image-flash
src/utils/ai/removeBackground.ts     ← verifica CORS/fallback (2b)
src/hooks/useAILogs.ts               ← stripPreview, MAX_DETAIL_CHARS (3)
src/components/AILogPanel.tsx        ← render imagePreviewBase64 (3)
src/utils/ai/captureElement.ts       ← maxWidth=1024, quality=0.85 (3)
src/pages/SettingsPage.tsx           ← aggiungere tab AI con tutti i toggle (4a-4e)
src/components/rag/ClientRagPanel.tsx ← montare in settings o sidebar (4c)
src/hooks/useAIDesignReview.ts       ← wire nei componenti card/quote/flyer/logo (4b)
src/utils/uiPrefs.ts                 ← 5 preferenze AI orfane (4d)
src/utils/resolveProviderId.ts       ← A/B branching unreachable (4a)
```
