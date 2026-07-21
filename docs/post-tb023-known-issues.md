# Post-TB-023 Known Issues & Limitazioni

> Ultimo aggiornamento: 2026-07-21

---

## ~~1. Preview vs Export — Differenze visive (cover AI, wash opacity)~~ ✅ FIXATO

**Fix applicato** (commit non ancora pushato):

| Fix | Dettaglio | File |
|-----|-----------|------|
| `coverImageUrl` risolto in PNG export | Aggiunto `resolveToBase64DataUrl` per `coverImageUrl` front e back in entrambe le funzioni | `src/utils/card/pngExport.ts` |
| Back cover wash opacity allineato | `opacity="0.6"` → `opacity="0.35"` + gradient semplificato 2-stop (0%→45%) | `src/utils/card/svgRenderer.ts:449` |
| Test aggiornato | Verifica `opacity="0.35"` per back cover wash | `src/utils/card/__tests__/svgRenderer.test.ts:547` |

**Nota residua**: il front cover wash gradient ha stop leggermente diversi tra preview (`40%` hex) e export (`0.4` a `55%`). Differenza minima, non visibile nella maggior parte dei casi.

---

## ~~2. Card Icona AI — Pixelata / Non si carica in preview/export~~ ✅ FIXATO

**Fix applicato**:

| Fix | Dettaglio | File |
|-----|-----------|------|
| Risoluzione aumentata | `size: '512'` → `size: '1K'` (1024×1024px) | `src/hooks/useAIIconHero.ts:53` |

**Nota**: il clamp server 500KB resta attivo. Se un'immagine 1K lo supera, l'utente riceve 413 "Immagine troppo grande". In quel caso può riprovare con un prompt più semplice.

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

| # | Issue | Severità | Stato |
|---|-------|----------|-------|
| ~~1a~~ | ~~`coverImageUrl` non risolto in PNG export~~ | ~~Alta~~ | ✅ Fixato |
| ~~1b~~ | ~~Back cover wash opacity mismatch~~ | ~~Media~~ | ✅ Fixato |
| ~~2a~~ | ~~Icona AI 512px pixelata in export HD~~ | ~~Media~~ | ✅ Fixato |
| 2b | Icona AI non si carica (errori CORS/removeBackground) | Alta | ⚠️ Da verificare con 1K |
| 3  | Log image preview persa al refresh | Bassa (by design) | — |
| 4a | A/B testing toggle assente da UI | Alta | **P1** |
| 4b | `useAIDesignReview` hook orfano | Media | **P2** |
| 4c | `ClientRagPanel` orfano | Media | **P2** |
| 4d | `aiVisionEnabled` / `aiAutoFallback` orfani | Media | **P2** |
| 4e | `SettingsPage` senza preferenze AI | Alta | **P1** |

---

## 6. File coinvolti (mappa rapida)

```
FIXATI:
src/utils/card/pngExport.ts          ← coverImageUrl resolve (1a) ✅
src/utils/card/svgRenderer.ts        ← back cover opacity 0.35 (1b) ✅
src/hooks/useAIIconHero.ts           ← size 1K (2a) ✅

RIMANENTI:
api/index.ts                         ← clamp 500KB (2b), endpoint /ai/image-flash
src/utils/ai/removeBackground.ts     ← verifica CORS/fallback con 1K (2b)
src/hooks/useAILogs.ts               ← stripPreview, MAX_DETAIL_CHARS (3)
src/components/AILogPanel.tsx        ← render imagePreviewBase64 (3)
src/utils/ai/captureElement.ts       ← maxWidth=1024, quality=0.85 (3)
src/pages/SettingsPage.tsx           ← aggiungere tab AI con tutti i toggle (4a-4e)
src/components/rag/ClientRagPanel.tsx ← montare in settings o sidebar (4c)
src/hooks/useAIDesignReview.ts       ← wire nei componenti card/quote/flyer/logo (4b)
src/utils/uiPrefs.ts                 ← 5 preferenze AI orfane (4d)
src/utils/resolveProviderId.ts       ← A/B branching unreachable (4a)
```
