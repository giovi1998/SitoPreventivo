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

## 4. Modulo AI Unificato — Architettura da definire

**Sintomo**: le feature AI TB-023 (provider, A/B, vision, fallback) sono
implementate nel codice ma frammentate: ogni toggle è un silo, nessun modulo
trasversale. Attaccarle in una tab "AI" di SettingsPage sarebbe un cerotto.

### Direzione architetturale

AI non è una preferenza utente — è **infrastruttura trasversale**.
Deve vivere in un modulo unico che ogni editor (card, flyer, logo, social,
quote) può interrogare.

```
┌─────────────────────────────────────┐
│           AI Module (core)          │
│  provider selection · A/B split     │
│  vision · fallback · cost tracking  │
│  rate limiting · retry logic        │
├─────────────────────────────────────┤
│  Observability (logs · metrics)     │
│  useAILogs · AIConsole · AIProvider │
│  Badge · cost breakdown per call    │
└─────────────────────────────────────┘
         ↕               ↕
   ┌──────────┐   ┌──────────┐
   │ Card Ed. │   │ Logo Ed. │  ...flyer, social, quote
   └──────────┘   └──────────┘
```

### Stato attuale (audit)

| Preferenza | Getter | Consumer | Stato |
|------------|--------|----------|-------|
| `aiProviderDefault` | `getAiProviderDefault()` | `resolveProviderId.ts` | ✅ Wired |
| `aiImageModelDefault` | `getAiImageModelDefault()` | Logo orchestrator | ⚠️ Parziale |
| `aiVisionEnabled` | `getAiVisionEnabled()` | Nessun consumer | ❌ Dead code |
| `aiAutoFallback` | `getAiAutoFallback()` | Nessun consumer | ❌ Dead code |
| `aiABTestingEnabled` | `getAiABTestingEnabled()` | `resolveProviderId.ts` (always false) | ❌ Irraggiungibile |

### Componenti orfani

| Componente | File | Stato |
|------------|------|-------|
| `useAIDesignReview` | `src/hooks/useAIDesignReview.ts` | Hook implementato, mai importato |

### Cosa serve (non un toggle in Settings)

1. **AI Module** — classe/servizio unico che wrappa provider selection, A/B
   split, vision feedback, auto-fallback, cost tracking. Tutti gli editor
   lo usano, nessuno configura i provider direttamente.
2. **Observability** — `useAILogs` + `AILogPanel` + `AIProviderBadge` già
   funzionano. Servono solo wiring nei punti giusti (screenshot capture
   via `useAIDesignReview`, cost breakdown live).
3. **SettingsPage** resta per preferenze utente (theme, doc type default,
   non la config AI).

### Priorità

| # | Issue | Severità | Stato |
|---|-------|----------|-------|
| ~~1a~~ | ~~`coverImageUrl` non risolto in PNG export~~ | ~~Alta~~ | ✅ Fixato |
| ~~1b~~ | ~~Back cover wash opacity mismatch~~ | ~~Media~~ | ✅ Fixato |
| ~~2a~~ | ~~Icona AI 512px pixelata in export HD~~ | ~~Media~~ | ✅ Fixato |
| ~~CONTATTI~~ | ~~Header retro nascosto da stacking context~~ | ~~Media~~ | ✅ Fixato |
| 2b | Icona AI non si carica (errori CORS/removeBackground) | Alta | ⚠️ Da verificare con 1K |
| 3  | Log image preview persa al refresh | Bassa (by design) | — |
| 4  | Modulo AI unificato | Alta | **Da progettare** |
| 4b | `useAIDesignReview` wiring screenshot | Media | **Dopo modulo AI** |

---

## 5. File coinvolti (mappa rapida)

```
FIXATI:
src/utils/card/pngExport.ts          ← coverImageUrl resolve (1a) ✅
src/utils/card/svgRenderer.ts        ← back cover opacity 0.35 (1b) ✅
src/hooks/useAIIconHero.ts           ← size 1K (2a) ✅
src/components/card/cardPreviewSide.css ← CONTATTI header z-index ✅

RIMANENTI (da progettare come modulo):
src/utils/resolveProviderId.ts       ← A/B branching unreachable
src/hooks/useAIDesignReview.ts       ← hook orfano, da wiring
src/utils/uiPrefs.ts                 ← 4 preferenze AI orfane
api/index.ts                         ← clamp 500KB (2b)
src/utils/ai/removeBackground.ts     ← verifica CORS/fallback con 1K
src/hooks/useAILogs.ts               ← stripPreview, MAX_DETAIL_CHARS (3)
```
