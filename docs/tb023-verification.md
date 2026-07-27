# TB-023 Verification — Checklist REQ & Esito

> Data verifica: 2026-07-22 (originale), aggiornata 2026-07-23 (fix responsive/vision/log).
> Metodo: audit codice (4 agenti paralleli), cross-check documentazione,
> test unitari/e2e, screenshot Playwright.
> Spec di riferimento: `spec/spec-design-ai-harness-upgrade.md`.
> Legenda: ✅ implementato / 🔶 deviato-equivalente / ⚠️ parziale /
> ❌ mancante / 🗑️ rimosso deliberatamente / 🛠️ fixato in questa verifica.

---

## 1. Multi-Provider AI (§3.1)

| REQ | Esito | Evidenza |
|-----|-------|----------|
| REQ-MP-001 OllamaProProvider | ✅ | `src/ai/providers/ollamaPro.ts:46`. Deviazione prevista dalla spec: proxy via `/api/ai/chat` (`provider:'ollama'`), Bearer solo server-side. |
| REQ-MP-002 registry 3 modelli | ✅ | `src/ai/providers/registry.ts:13-15` (minimax-m3, deepseek-v4-pro, qwen-3.5). |
| REQ-MP-003 GeminiFlashImageProvider | ✅ | `src/ai/providers/geminiFlashImage.ts` + endpoint `/api/ai/image-flash` (`api/index.ts:2097`). Nota: classe provider usata solo dai test; l'endpoint inlinizza la logica (gotcha #6 AGENTS.md). |
| REQ-MP-004 selector provider | 🔶 | Dropdown in `AIProviderBadge.tsx:133-171`; persistenza in `pq_ui:v1` (non `pq_provider_default:v1`). Equivalente. |
| REQ-MP-005 orchestratori leggono provider | ✅ | card/flyer/logo/social/onboarding accettano `modelId` + fallback via `resolveProviderId`. |
| REQ-MP-006 routing `/api/ai/chat` | ✅ | `api/index.ts:1145` (non-stream) e `:1499` (stream); 503 "Configura OLLAMA_API_KEY" se mancante. |
| CON-MP-001 no key nel bundle | ✅ | Solo proxy; grep pulito. |
| CON-MP-002 no import statici ESM-only | ✅ | Solo drizzle/bcryptjs/crypto/zod in cima ad `api/index.ts`. |
| GUD-MP-001 mapping format json | ✅ | `ollamaPro.ts:139`, `api/index.ts:1184`. |

## 2. MiniMax M3 Vision (§3.2)

| REQ | Esito | Evidenza |
|-----|-------|----------|
| REQ-MM-001 chatWithImages | ✅ | `ollamaPro.ts:91` (images base64, NDJSON stream). |
| REQ-MM-002/003 screenshot helper | 🔶 | Non esistono `utils/card/screenshot.ts` / `utils/flyer/screenshot.ts`. Equivalente: inline in `useAICard.ts:104-133` (renderCardSideDataUrl) e `captureElementAsBase64` su `[data-flyer-preview]` in `useAIFlyer.ts`. |
| REQ-MM-004 useAIDesignReview | 🗑️ | Due implementazioni (hook legacy + `aiModule.runDesignReview`) entrambe senza UI: bottone "Analizza preview" rimosso deliberatamente (regression test in `AIConsole.test.tsx`). Endpoint `/api/ai/design-review` esiste ed è funzionante ma orfano. |
| REQ-MM-005 vision-grounded generation | ✅ | Toggle Vision in `AIConsole.tsx:154-164` (solo provider vision-capable); hook card/quote/flyer/logo/social gated su `getAiVisionEnabled()`. |
| CON-MM-001 compressione screenshot | 🔶 | Nessuna soglia 500KB/quality 0.7; capture JPEG 0.8-0.85 maxWidth 1024, server accetta 600k char. Equivalente come bound. |
| CON-MM-002 mai screenshot a DeepSeek | 🛠️ | Prima metà già OK (orchestratori scartano immagine se `!supportsVision`). **Fixato in questa verifica**: gli hook ora saltano la cattura dello screenshot se il provider non è vision-capable (`providerSupportsVision` in `resolveProviderId.ts`), prima catturavano e scartavano silenziosamente. Routing automatico a MiniMax NON implementato (documentato come gap: l'utente sceglie il provider). |

## 3. Tracking Costi (§3.3)

| REQ | Esito | Evidenza |
|-----|-------|----------|
| REQ-TC-001 providerPricing | 🔶 | `src/ai/providerPricing.ts` valori identici alla spec; unit `'flat_monthly'` invece di `'flat_20_month'`. |
| REQ-TC-002 trackUsage costUsd | ✅ | `BaseOrchestrator.ts:239-255` → `dataService.trackTokens(email, tokens, costUsd)`. |
| REQ-TC-003 migration | ✅ | `db/migrations/0027_token_cost.sql` + schema inline `api/index.ts:36`. |
| REQ-TC-004 /users/tokens costUsd | ✅ | `api/index.ts:348,619-643`, backward compatibile. |
| REQ-TC-005 badge costo | ✅ DONE 2026-07-27 | Costo ultima operazione inline con guard `isFlat` ✅. Tooltip/popover breakdown 30gg ✅ aggiunto: hover ≥300ms su `AIProviderBadge` mostra `totalCostUsd` sessione + hint admin breakdown. `totalCostUsd` forwarded da `AIHarnessConsole` → `AIConsole` → badge. |
| REQ-TC-006 cost-breakdown admin | 🛠️ | **Implementato in questa verifica**: `GET /users/cost-breakdown` (`api/index.ts:598-628`) + test `api/__tests__/costBreakdown.test.ts`. Deviazione documentata: non esiste storico per-chiamata nel DB → ritorna aggregati lifetime per utente + `ollamaProFlatMonthly`, `days` è echo. |

## 4. Pattern Decorativi (§3.4)

| REQ | Esito | Evidenza |
|-----|-------|----------|
| REQ-PD-001 5 pattern | ✅ DONE | `src/utils/decorations/patterns.ts` — `renderDecorativePattern(id,w,h,opts)` + 5 renderer interni. Palette `{primary,secondary,accent}`. |
| REQ-PD-002 DecorationId | ✅ DONE | `DecorativePatternId` senza `'none'` (il "nessuno" è `pattern: null`). |
| REQ-PD-003 schema | ✅ DONE 2026-07-27 | `decorations` top-level, shape `{pattern, opacity, palette, userLocked}`. `userLocked` per CON-PD-002. Nessun supporto `corner` per blob-corner (hardcoded bottom-right — deviazione minore). |
| REQ-PD-004 DecorationPicker | ✅ DONE 2026-07-27 | `src/components/DecorationPicker.tsx` con 6 thumbnail SVG 80×50 (none + 5 pattern). Integrato in `CardStyleFields` + `CardAIDecorationSection` (card) + `FlyerStyleFields` (flyer, con opacity slider). |
| REQ-PD-005 preview layer | ✅ DONE | `CardPreview.tsx` (front+back), flyer via `svgRenderer.ts`. |
| REQ-PD-006 export layer | ✅ DONE | card `svgRenderer.ts`; flyer `svgRenderer.ts`; PNG/PDF via `buildCardSvg`/`buildFlyerSvg`. |
| REQ-PD-007 AI sceglie decoration | ✅ DONE 2026-07-27 | `aiCardInputSchema` accetta `decorations {pattern, opacity, palette}`. `cardMerge` fa merge rispettando `userLocked` (CON-PD-002). Prompt `cardSystem.ts` documenta 5 pattern + esempi settore (food→wave-bottom, tech→blob-corner, finance→full-overlay, wellness→wave-split, education→splash-corners). |
| REQ-PD-008 quick action chip | ✅ DONE 2026-07-27 | 5 chip in `cardQuickActions` + gruppo "Decorazione" in `CardAIQuickActions`: Onda, Blob, Splash, Overlay, No decoro. |
| CON-PD-001 solo geometria | ✅ DONE | Solo path/circle/gradient. |
| CON-PD-002 userLocked | ✅ DONE 2026-07-27 | Flag `userLocked: boolean` in schema card/flyer decorations. `cardMerge` salta AI decoration se `userLocked === true` e registra change esplicito. |
| CON-PD-001 solo geometria | ✅ | Solo path/circle/gradient. |
| CON-PD-002 userLocked | ❌ de-facto OK | Flag inesistente; il merge AI non tocca le decoration perché non sono negli schema AI. |

**Gap aperti (documentati, non fixati in questa verifica — stimati ~10h):**
REQ-PD-007/008 (AI decoration), DecorationPicker thumbnail (REQ-UX-001), flyer decoration UI.

## 5. Drag Foto Grid-Mode (§3.5)

| REQ | Esito | Evidenza |
|-----|-------|----------|
| REQ-DF-001 photoPlacement | ✅ DONE | Per-element in grid (`placement {x,y,scale}` generico + legacy `photoPlacement`). Implementato `useDraggablePlacement` hook. |
| REQ-DF-002 solo grid-mode | ✅ DONE | `enabled` richiede `showGrid` (`CardPreview.tsx`). |
| REQ-DF-003 pointer events + wheel | ✅ DONE 2026-07-27 | pointerdown/move/up sincrono. Wheel scale ✅ aggiunto: `onWheel` handler in `useDraggablePlacement`, ±0.1 clamp [0.5, 2]. Wired a photo/logo/name/title/company. E2E `card-drag-wheel-overlay.spec.ts` test (a) wheel on name. |
| REQ-DF-004 overflow hidden + transform | ✅ DONE | `cardPreviewSide.css`. |
| REQ-DF-005 controlli placement | ✅ DONE 2026-07-27 | Frecce nudge ±0.05 + slider zoom 0.5-2 + readout `grid-placement-readout` (x/y/s live) + bottone `grid-placement-reset` (patch a {0,0,1}). E2E test (c) Reset. |
| REQ-DF-006 export transform | ✅ DONE | Geometria inline equivalente a `transform`. E2E test (e) export SVG front verificato. |
| CON-DF-001 drag solo se selezionato | ✅ DONE | + test. E2E test (h) overlay disappears. |
| CON-DF-002 drag disabilitato senza foto | ✅ DONE | `hasContent` in `useDraggablePlacement`. |
| GUD-DF-001 cursor grab/grabbing | ✅ DONE | `.card-grid-cell--draggable/--dragging`. |
| GUD-DF-002 dead zone 0.05 | ✅ DONE | Snap a 0 per \|nextX\|, \|nextY\| < 0.05. |
| REQ-UX-003 overlay coords | ✅ DONE 2026-07-27 | `PlacementOverlay` component in `CardPreview.tsx`: badge in basso-destra cella con `x:0.34 y:-0.12 s:1.20`. Render solo quando elemento selezionato. Esteso a name/title/company/logo. E2E test (b) nudge name shows overlay, (h) disappears on deselect. |

## 6. Icone AI (§3.6)

| REQ | Esito | Evidenza |
|-----|-------|----------|
| REQ-IS-001 iconOrchestrator | 🔶 | Nessuna classe: hook `useAIIconHero.ts` + endpoint `/api/ai/image-flash`. Funzionalmente equivalente. |
| REQ-IS-002 default flash + fallback | ⚠️ | Default = Nano Banana (`gemini-3.1-flash-image`), invertito rispetto alla spec; nessun fallback automatico tra modelli. |
| REQ-IS-003 prompt 2-colori 256px | 🔶 | Prompt flat 2-colori ✅; size `'1K'` invece di 256×256 (fix pixelazione, issue #3 known-issues — spec mai aggiornata). |
| REQ-IS-004 UI genera icona | 🔶 | Sezione `CardAIIconHeroSection` nella rail AI (non in CardFormFields). |
| REQ-IS-005 schema iconUrl | ❌ | Nessun campo dedicato: l'icona va in `photoUrl`. By-design (CON-IS-001). |
| REQ-IS-006 heroIllustration flyer | ❌ | Flyer hero solo fotografico (`/api/flyer-hero`); `kind:'hero'` flat esiste in image-flash ma è wireato solo nella card. |
| REQ-IS-007 preview prima di applicare | ⚠️ | Applicazione diretta a `photoUrl`. |
| CON-IS-001 sostituire foto con icona AI | ✅ DONE | L'icona AI generata va sempre in `photoUrl`, sostituendo la foto corrente; `logoUrl` caricato dall'utente non viene mai toccato. |
| CON-IS-002 compressione icone >200KB | ❌ | Solo clamp server 500KB che rifiuta (413) invece di comprimere. |
| 🛠️ Reset log card pulisce anche icon hero logs | ✅ DONE | `resetCardChat` ora chiama `clearIconHeroLogs` (via `handleResetCardChat` in `CardEditorShell`), garantendo che "Nuova conversazione" pulisca tutti i log AI. Regression test `CardEditorShell.test.tsx`. |
| 🛠️ **Icona AI 1K end-to-end verificata (issue 2b)** | ✅ DONE 2026-07-27 | E2E `card-icon-ai-1k.spec.ts` (3 test): mock `/api/ai/image-flash` con PNG 1024×1024 (sfondo bianco + cerchio rosso + quadrato verde) → `removeWhiteBackground` (tolerance 240) rimuove solo near-white puro, NON i colori saturi. Verifica pixel rossi+verdi sopravvivono. Screenshot `e2e/__screenshots__/tb023-icon-ai-1k-*.png`. Issue 2b chiusa: quadrato vuoto era causato da icone AI chiare/pastello su bianco (Gemini), non dal codice — con icone colorate removeBackground funziona correttamente. |

**Issue 2b (icona quadrato vuoto) — valutazione cause:**
CORS: non plausibile (data URL same-origin). Clamp 500KB: plausibile ma darebbe errore 413, non quadrato vuoto. **Causa più plausibile: `removeBackground.ts` con `tolerance=240`** — se Gemini produce icona chiara/pastello su bianco, ampie zone dell'icona stessa superano la tolleranza e diventano trasparenti. Non fixato in questa verifica (richiede test manuale con immagini reali Gemini); raccomandazione: ridurre tolerance a ~250 solo per near-white puro o rendere il removal opzionale.

## 7. A/B Provider (§3.7)

| REQ | Esito | Evidenza |
|-----|-------|----------|
| REQ-AB-001..003 | 🗑️ | Rimosso deliberatamente (commit `15aa0d5`): nessuna UI "Confronta provider", `resolveProviderId` senza salt, `aiABTestingEnabled` assente. `modelId` resta nei log (eredita lo scopo di REQ-AB-003). |

## 8. UX (§3.9)

| REQ | Esito | Evidenza |
|-----|-------|----------|
| REQ-UX-001 DecorationPicker thumbnail | ✅ DONE 2026-07-27 | `src/components/DecorationPicker.tsx` con 6 thumbnail SVG 80×50 (none + 5 pattern). Integrato in `CardStyleFields` + `CardAIDecorationSection` + `FlyerStyleFields`. |
| REQ-UX-002 badge dropdown | ✅ DONE | Click-outside + ESC + lista provider + pricing. |
| REQ-UX-003 drag overlay coords + dead zone | ✅ DONE 2026-07-27 | Dead zone fixata. Overlay coords `PlacementOverlay` in `CardPreview.tsx`: badge in basso-destra cella con `x:0.34 y:-0.12 s:1.20`. E2E test (b)+(h). |
| REQ-UX-004 modal icona 2-col 3 esempi | ❌ | Sezione singola, 1 immagine per chiamata. |
| REQ-UX-005 "I miei clienti" Settings | ❌ | Non iniziato. |
| REQ-UX-006 tooltip breakdown 30gg | ✅ DONE 2026-07-27 | Tooltip costi 30gg in `AIProviderBadge`: hover ≥300ms mostra total sessione + hint admin breakdown. `totalCostUsd` forwarded da `AIHarnessConsole` → `AIConsole` → badge. |
| REQ-UX-007 toggle Vision | ⚠️ | Toggle ✅ (persistenza, default OFF, tooltip); manca icona occhio (testo "Vision ✓/✕"). |
| CON-UX-002 no emoji nuovi componenti | ❌ | Spot-check: `🔒`/`✨` in `CardAIIconHeroSection`, emoji nei log hook. |

---

## 9. Focus utente: Mobile vs Desktop (modulo card)

### Struttura (verificata)
Desktop 3-col (form/preview/rail AI) vs mobile tabs (Anteprima/Modifica/AI) + FAB + bottom sheet. `formContent` condiviso (zero duplicazione), export menu identico (7 azioni), salvataggio identico. Parità form/export/save/sezioni AI: piena.

### Bug trovati e FIXATI in questa verifica
1. 🛠️ **Preset mobile divergenti**: `MobileGridEditor` non passava `onApplyPreset` → fallback inline duplicato con photo h:4 **sovrapposto al logo** (riga 3), senza alignH/alignV. Fix: callback propagati da `CardEditorShell`; fallback in `CardGridControls` ora usa i preset canonici. Regression test in `MobileGridEditor.test.tsx` + e2e `card-mobile-desktop-parity.spec.ts`.
2. 🛠️ **Toast blocco mobile sempre 'border'**: `reason` hardcoded; ora `blockedMoveReason()` distingue collision/border come desktop.
3. 🛠️ **Drag senza contenuto** (CON-DF-002), **grabbing CSS**, **dead zone** (vedi §5).

### Differenze by-design (documentate, non bug)
- Resize celle e matrice allineamento 3×3: nessun equivalente mobile (già noto in AGENTS.md "Known Issues" — drag-and-drop diretto valutato come evoluzione).
- Zoom placement foto/QR: solo slider desktop; su mobile il drag diretto copre x/y ma non scale.
- Rail AI: contenuto identico, contenitore diverso (bottom sheet vs AIConsole) — Phase 14 documentata.
- Font contatti ridotti in preview mobile ≤900px (`cardBase.css:152-164`): scelta responsive preview-only; l'export non cambia. **Nota**: questa è una differenza preview/export visibile solo su mobile (vedi §10).

## 10. Focus utente: Preview vs Export (PDF/PNG/SVG)

### Architettura (verificata)
PNG e PDF passano entrambi per `buildCardSvg` — **nessuna divergenza tra i 3 formati**; tutte le differenze sono preview-React vs `svgRenderer.ts`.

### Mismatch trovati e FIXATI in questa verifica (v2.16)
1. 🛠️ **QR nero in export vs textColor in preview**: `fgColor` era hardcoded `#000000` (2 punti in `svgRenderer.ts`) → ora `card.style.textColor`.
2. 🛠️ **Placement QR ignorato in preview**: la CSS var `--card-photo-transform` era consumata solo da `.card-photo` → aggiunta regola per `.card-grid-cell--qr .card-back-qr`. Nota residua: la preview scala anche la label QR, l'export no (font label invariato).
3. 🛠️ **Wash fronte mid-stop 40% vs 25%**: export allineato al valore preview (hex alpha `40` = 25%).
4. 🛠️ **Bordo accent foto**: preview `.card-photo` ha `border: 2px solid accent`, export niente → stroke aggiunto in export grid-mode (rect/circle).
5. 🛠️ **Espansione servizi condizioni diverse**: export espandeva solo se l'elemento `socials` mancava; ora espande se i *contenuti* socials sono vuoti (come la preview), ereditando l'altezza dell'elemento.
6. 🛠️ **Logo fallback in cella foto**: preview mostra il logo nella cella photo senza foto e senza elemento logo; export lasciava la cella vuota → aggiunto.
7. 🛠️ **`logoBackground: 'card'`**: assente nella preview della cella logo dedicata → aggiunto (bg + borderRadius, come l'export).

### Mismatch residui documentati (non fixati)
- **Wrapping testo**: preview CSS `overflow-wrap: break-word` vs export `wrapTextAtWhitespace` (nome/titolo/company/wordmark/QR label a riga singola in export, socials con wrapping divergente). Richiede layout engine condiviso — gap noto v2.15, mantenuto.
- **Font metrics**: baseline/line-height approssimate in export (naturale, tolleranza sub-pixel).
- **Font preview ridotti su mobile** (vedi §9): preview-only.
- Test lunghi in export senza clip (nomi molto lunghi escono dalla cella).

### Stato mismatch AGENTS.md v2.15 (aggiornato)
1. Wrapping socials → **ancora presente** (vedi sopra).
2. Short-contacts collapse in preview → **RISOLTO** (`effectiveBackGridForRender` usato da entrambi) — voce AGENTS.md obsoleta, da rimuovere.
3. Font metrics → presente per natura, documentato.
4. Gotcha "wrapTextAtWhitespace non spezza email/URL" → **obsoleto** (ora hard-break per chunk).

---

## 11. Codice morto / debito trovato

- `src/hooks/useAIDesignReview.ts` — legacy, non importato (sostituito da `aiModule.runDesignReview`, a sua volta senza caller).
- `src/components/card/ai/CardAIDecorationSection.tsx` — importato solo dal suo test.
- Endpoint `/api/ai/design-review` — funzionante ma orfano (nessuna UI lo chiama).
- `src/ai/providers/geminiFlashImage.ts` — usato solo dai suoi test (endpoint inlinizza).

## 12. Incoerenze doc trovate (fixate in questa verifica)

- AGENTS.md fase 15 dichiarava A/B provider e vision feedback "completati": A/B rimosso, design review senza UI → aggiornato.
- `docs/post-tb023-known-issues.md` riga 46 citava "A/B salt" in contraddizione con riga 69 → corretto.
- known-issues "Prossimi passi" proponeva di aggiungere toggle Vision (già esistente) e bottone Analizza preview (rimosso deliberatamente) → checklist riscritta.

## 13. Test aggiunti in questa verifica

**Unitari**: `AIConsole.test.tsx` (+1 quickActions singolo), `svgRenderer.test.ts` (+5 parity v2.16), `CardPreview.test.tsx` (+2 parity + drag guard + dead zone), `MobileGridEditor.test.tsx` (+4 preset/reason), `CardEditorShell.test.tsx` (+3 CON-IS-001, +1 reset card clears all AI logs), `useAI.test.ts`/`useAICard.test.ts` (gating vision), `providerPricing.test.ts` (nuovo), `BaseOrchestrator.cost.test.ts` (nuovo), `api/__tests__/costBreakdown.test.ts` (nuovo).

**E2E nuovi**: `e2e/card-mobile-desktop-parity.spec.ts` (3 test: contenuto identico mobile/desktop, preset canonico mobile no-overlap, preset canonico desktop), `e2e/card-preview-export-parity.spec.ts` (3 test: bordo foto export, nudge QR preview+export, decoration wave preview+export). Screenshot in `e2e/__screenshots__/parity-*.png/svg`.
