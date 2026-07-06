---
title: Logo AI v2.2 — Rich Rendering, Auto-fit, 3 Concepts, Background Visibile, Decorations
version: 1.0
date_created: 2026-07-06
owner: Giovanni Cidu
tags: [design, ai, logo, v2-2, rich-render, auto-fit, concepts, decorations, nano-banana]
---

# Introduction

Estensione di spec v2.1 (Nano Banana background). Risolve quattro problemi
emersi dal feedback utente post-v2.1:

1. **Logo troncato**: viewBox hardcodato 400×160 non basta per testi lunghi
   ("Pedagogista Susanna" + tagline). ViewBox dinamico + auto-fit del font.
2. **Logo "troppo semplice"**: builder produce solo icona geometrica + testo.
   Arricchito con gradient, sfondo brandato, decorazioni (underline, dot-ring,
   top-accent) — sia AI-driven che controlli manuali nel Builder.
3. **Tab Builder↔AI perde stato**: chat answers + step non persistiti.
   Persistenza localStorage (`logoAiChat:v1`).
4. **Background AI non visibile nel Builder**: il PNG generato da Nano Banana
   appare solo nell'AI panel. Renderizzato anche nel Builder preview + badge
   "AI bg" + bottone "Rimuovi background".
5. **3 concept per generazione**: l'AI produce 3 varianti distinte, l'utente
   sceglie quale applicare (come namelix originale).
6. **Log AI nel Social editor**: `AILogPanel` mostra "Nessuna attività"
   anche quando i log ci sono. Fix: wiring corretto tra `useAISocial.logs`
   e `AILogPanel` props.

## 1. Purpose & Scope

**Purpose**: rendere il Logo AI visivamente ricco, deterministico nel
fitting del testo, multi-concept, e coerente tra tab Builder↔AI.

**Scope**:
- `src/utils/logoGenerator.ts`: `getViewBox` dinamico + auto-fit font + render
  decorations/gradient/backgroundColor.
- `src/utils/documentSchemas.ts`: 3 nuovi campi `logoBuilderSchema`
  (`backgroundColor`, `gradientFill`, `decorativeElements`).
- `src/components/BuilderPanel.tsx`: fieldset "Decorazioni" + badge AI bg +
  bottone rimuovi background + render backgroundImage visibile.
- `src/components/LogoAiPanel.tsx`: 3 concept + persistenza localStorage +
  log "Powered by Gemini" + log config attiva.
- `src/components/LogoEditor.tsx`: badge "AI" sul tab quando background.
- `src/components/SocialEditor.tsx`: fix AILogPanel wiring (log vuoti).
- `src/hooks/useAISocial.ts`: verifica export `logs`.
- `src/ai/prompts/logoSystem.ts`: esempi 6+ settori + sezione DECORATIONS +
  output JSON esteso con 3 nuovi campi.
- `src/ai/logoOrchestrator.ts`: `generateLogo` ritorna 3 concept;
  `buildBackgroundPrompt` con prompt settoriali ricchi.
- `src/ai/prompts/registry.ts`: nessuna modifica (riusa `logo-system`).
- Test: viewBox dinamico, decorations, 3 concept, persistenza, social log.
- AGENTS.md aggiornato.

**Audience**: sviluppatore AI, utente finale.

**Assunzioni**:
- v2.1 già implementata (backgroundImage, Nano Banana provider, endpoint).
- `GEMINI_API_KEY` opzionale: senza key, AI genera solo parametri (no bg).
- 3 concept = 3 chiamate DeepSeek (costo 3× token rispetto a v2.1).
- Auto-fit: algoritmo binsearch su font-size per stare in viewBox.

## 2. Definitions

- **ViewBox dinamico**: `getViewBox(layout, primaryText, tagline)` calcola
  dimensioni in base alla lunghezza testo. Clamp `[400, 800]` per horizontal.
- **Auto-fit font**: `fitText(text, maxWidth, maxFont)` ritorna il font-size
  massimo che fa stare `text` in `maxWidth` (binsearch, range 14-48).
- **3 concept**: array di 3 `LogoBuilder` distinti. L'AI genera 3 varianti
  in una singola chiamata (JSON array). L'utente sceglie → `onPatch(builder)`.
- **Decorations**: elementi SVG opzionali dentro al logo:
  - `underline`: linea orizzontale sotto primaryText, primaryColor, 2px.
  - `dotRing`: 8 cerchi piccolo raggio attorno all'icona, primaryColor.
  - `topAccent`: barra orizzontale 4px sopra al logo, primaryColor.
- **Gradient**: `<defs><linearGradient>` con `primaryColor → secondaryColor`.
  Applicato come fill del testo primaryText quando `gradientFill=true`.
- **BackgroundColor**: `<rect>` solid dietro tutto il logo. Mutuamente
  esclusivo con `backgroundImage` (se entrambi, bg image vince, rect sotto).
- **Persistenza chat**: `localStorage['logoAiChat:v1']` = `{ answers, step,
  concepts, selected, timestamp }`. TTL 24h.

## 3. Requirements, Constraints & Guidelines

### Rendering

- **REQ-R01**: `getViewBox(layout, primaryText, tagline)`:
  - `horizontal`: `W = clamp(iconSize + 28 + textWidth + 28, 400, 800)`,
    `H = tagline ? 180 : 160`. `textWidth = fitTextWidth(primaryText, 36)`.
  - `vertical`: `W = clamp(maxTextWidth + 40, 300, 500)`, `H = 300 + (tagline ? 40 : 20)`.
  - `stacked`: come vertical ma `H = 320 + (tagline ? 40 : 20)`.
- **REQ-R02**: `fitText(text, maxWidth, startSize=36, minSize=14)`:
  - Stima larghezza: `0.55 * size * text.length` (Inter bold approx).
  - Se `estWidth > maxWidth`: binsearch size in `[14, startSize]`.
  - Ritorna size che fa stare text in maxWidth.
  - Usato da `buildSvgForLayout` per primaryText (non tagline, sempre 14).
- **REQ-R03**: Render decorations in `buildSvgForLayout`:
  - `underline`: `<line x1=textX y1=textY+8 x2=textX+textWidth y2=textY+8 stroke=primary stroke-width=2/>`.
  - `dotRing`: 8 `<circle>` raggio 2 attorno a iconCenter, raggio `iconSize/2 + 8`.
  - `topAccent`: `<rect x=W*0.3 y=4 width=W*0.4 height=4 fill=primary/>`.
  - Ordine nel DOM: decorations PRIMA del testo (z-index sotto), dopo icon.
- **REQ-R04**: Render gradient in `buildSvgForLayout`:
  - Se `gradientFill=true`: `<defs><linearGradient id="textGrad" x1=0 y1=0 x2=1 y2=0><stop offset=0 stop-color=primary/><stop offset=1 stop-color=secondary/></linearGradient></defs>`.
  - `renderText` usa `fill="url(#textGrad)"` invece di `fill=textColor`.
- **REQ-R05**: Render backgroundColor in `buildSvgForLayout`:
  - Se `backgroundColor` non null e `backgroundImage` è null: `<rect width=W height=H fill=backgroundColor/>` come PRIMO elemento.
  - Se `backgroundImage` valorizzato: l'`<image>` resta primo, rect di
    background SOLO se `backgroundColor` non null (rect sotto l'immagine).
- **REQ-R06**: `builderToSvg` invariato: inietta `<image>` backgroundImage
  come primo elemento (z-index più basso).

### Schema

- **REQ-S01**: `logoBuilderSchema` esteso in `documentSchemas.ts`:
  - `backgroundColor: z.string().nullable().default(null)` (regex `^#[0-9a-fA-F]{6}$` o null).
  - `gradientFill: z.boolean().default(false)`.
  - `decorativeElements: z.array(z.enum(['underline','dotRing','topAccent'])).default([])`.
- **REQ-S02**: `createEmptyLogo` e `createLogoTemplate` inizializzano i 3 nuovi campi (`backgroundColor: null, gradientFill: false, decorativeElements: []`).
- **REQ-S03**: `logoAIOutputSchema` esteso in `logoOrchestrator.ts`:
  - `backgroundColor: z.string().nullable().optional()`.
  - `gradientFill: z.boolean().optional()`.
  - `decorativeElements: z.array(z.enum(['underline','dotRing','topAccent'])).optional()`.
- **REQ-S04**: `mergeLogoAIResponse` applica i 3 nuovi campi se presenti.

### 3 Concept

- **REQ-C01**: `generateLogo` ritorna `concepts: LogoBuilder[]` (length 3).
  - System prompt richiede array di 3 oggetti.
  - `parseJsonResponse` valida `z.array(logoAIOutputSchema).length(3)`.
  - Se AI ritorna 1 o 2, fallback: replica con variazioni colore.
- **REQ-C02**: `LogoProcessResult` esteso: `concepts: LogoBuilder[]`,
  `selected: number` (default -1, nessuno applicato).
- **REQ-C03**: `LogoAiPanel` step `result` mostra 3 card cliccabili. Click →
  `onPatch(concept)` + `setSelected(i)` + avanzamento step `applied`.
- **REQ-C04**: "Genera un altro" rigenera 3 concept nuovi (no cache).
- **REQ-C05**: Background AI generato SOLO dopo che l'utente seleziona un
  concept (non per tutti e 3, costo).

### Persistenza

- **REQ-P01**: `localStorage['logoAiChat:v1']` salva:
  ```json
  { "answers": {...}, "step": "chat|result", "concepts": [...], "selected": -1, "ts": 1690000000000 }
  ```
- **REQ-P02**: Al mount di `LogoAiPanel`: legge la chiave, se `ts` < 24h
  ripristina `answers` e `step`. `concepts` ripristinati solo se `step==='result'`.
- **REQ-P03**: Ad ogni cambio di `answers`/`step`/`concepts`/`selected`,
  salva in localStorage (debounce 500ms).
- **REQ-P04**: Bottone "Reset chat" pulisce anche la chiave localStorage.
- **REQ-P05**: Se l'utente applica un concept e chiude/riapre, `step=result`
  mostra il concept applicato + "Genera un altro".

### Builder UX

- **REQ-B01**: `BuilderPanel` fieldset "Decorazioni":
  - Checkbox "Gradient sui colori" → `gradientFill`.
  - Color picker "Sfondo brandato" (con "Nessuno" che resetta a null) → `backgroundColor`.
  - Chip group: "Sottolineatura" / "Anello punti" / "Accent superiore" → `decorativeElements`.
- **REQ-B02**: Sotto la preview, se `backgroundImage` valorizzato:
  - Badge "Background AI attivo" (verde pill).
  - Bottone "Rimuovi background" → `onPatch('builder.backgroundImage', null)`.
- **REQ-B03**: `LogoEditor` tab "AI Generation" mostra badge "●" (rosso)
  quando `logo.builder.backgroundImage !== null` (indica che c'è bg AI).

### System Prompt

- **REQ-PR01**: `logoSystem.ts` esteso:
  - Output JSON = array di 3 oggetti (non singolo).
  - 3 concept devono differire per almeno 2 campi tra: primaryText, iconType,
    layout, colori, decorations.
  - Esempi estesi: 6+ settori (food, tech, fashion, professionista, wellness,
    education, real estate, fitness).
  - Sezione "DECORATIONS": quando usare `underline` (testo corto), `dotRing`
    (icone lucide), `topAccent` (layout horizontal), `gradientFill` (mood
    bold/playful), `backgroundColor` (solo se contrasto garantito).
  - Tagline evocativa con verbo/benefit (es. "Dove le idee prendono forma"
    non "Studio grafico").
- **REQ-PR02**: `buildBackgroundPrompt` in `logoOrchestrator.ts` esteso:
  - Descrizioni settoriali specifiche (food→texture organica, tech→circuit
    pattern, wellness→waves morbide, education→open book motif, fitness→
    motion lines, real estate→skyline astratto).
  - "high contrast con primaryColor, NOT flat, subtle texture".
  - "should suggest motion or activity, decorative not photographic".
  - 1024×340 fisso (3:1).

### Social Log Fix

- **REQ-SL01**: `SocialEditor.tsx` deve passare `logs` a `AILogPanel`:
  - Verificare che `useAISocial().logs` sia esposto.
  - `AILogPanel logs={logs} isProcessing={isProcessing}` (non undefined).
- **REQ-SL02**: Se `logs.length === 0`, `AILogPanel` mostra "Nessuna
  attività" (comportamento attuale, corretto). Il bug è che `logs` non
  arriva, non che il componente è rotto.

### Sicurezza

- **SEC-001**: `backgroundColor` validato con `isHexColor` o null.
- **SEC-002**: Gradient ID `textGrad` è fisso, collision-free in singolo SVG.
- **SEC-003**: Decorations usano solo colori già validati (`primary`,
  `secondary`). Nessun input utente in path/coords.

## 4. Interfaces & Data Contracts

### `logoBuilderSchema` (esteso)

```ts
{
  primaryText: string (max 50),
  tagline: string (max 50),
  iconType: 'none' | 'shape' | 'monogram' | 'lucide',
  iconGlyph: string (max 20),
  iconShape: 'circle' | 'square' | 'rounded' | 'hex',
  primaryColor: #RRGGBB,
  secondaryColor: #RRGGBB,
  fontFamily: string,
  layout: 'horizontal' | 'vertical' | 'stacked',
  icons: string[],
  backgroundImage: string | null,         // v2.1
  backgroundColor: string | null,         // v2.2 NEW
  gradientFill: boolean,                  // v2.2 NEW
  decorativeElements: Array<'underline'|'dotRing'|'topAccent'>,  // v2.2 NEW
}
```

### `logoAIOutputSchema` (esteso, 3 concept)

```ts
z.array({
  primaryText: string (max 30),
  tagline: string (max 60),
  iconType: 'none'|'shape'|'monogram'|'lucide',
  iconShape?: 'circle'|'square'|'rounded'|'hex',
  iconName?: string,
  monogram?: string (max 2),
  primaryColor: #RRGGBB,
  secondaryColor: #RRGGBB,
  layout: 'horizontal'|'vertical'|'stacked',
  backgroundColor?: string | null,        // v2.2
  gradientFill?: boolean,                  // v2.2
  decorativeElements?: Array<'underline'|'dotRing'|'topAccent'>,  // v2.2
}).length(3)
```

### localStorage `logoAiChat:v1`

```ts
{
  answers: { activity: string; mood: string; target: string; sector: LogoSector },
  step: 'chat' | 'result' | 'applied',
  concepts: LogoBuilder[],    // 3 o []
  selected: number,           // -1 se nessuno
  ts: number                 // Date.now()
}
```

## 5. Acceptance Criteria

- **AC-R01**: Given logo "Pedagogista Susanna" + tagline "Pedagogista clinica",
  When `builderToSvg`, Then viewBox ≥ 600×180, testo non troncato.
- **AC-R02**: Given `decorativeElements=['underline']`, When `builderToSvg`,
  Then SVG contiene `<line>` sotto primaryText con `stroke=primaryColor`.
- **AC-R03**: Given `gradientFill=true`, When `builderToSvg`, Then SVG
  contiene `<linearGradient id="textGrad">` e primaryText ha `fill="url(#textGrad)"`.
- **AC-R04**: Given `backgroundColor='#FFFFFF'` e `backgroundImage=null`,
  When `builderToSvg`, Then SVG contiene `<rect width=W height=H fill="#FFFFFF">` come primo elemento.
- **AC-R05**: Given `backgroundImage=data:...` valorizzato, When
  `builderToSvg`, Then SVG contiene `<image href="data:...">` come primo
  elemento e `<rect>` background (se presente) subito dopo.
- **AC-S01**: Given `logo.builder.gradientFill` senza campo nello schema
  salvato, When `mergeLogoWithDefaults`, Then `gradientFill=false` di default.
- **AC-C01**: Given AI chiamata con brief "Pizzeria Cagliari", When
  `generateLogo`, Then `result.concepts.length === 3`.
- **AC-C02**: Given 3 concept generati, When utente clicca concept #2, Then
  `onPatch(concept[1])` + `selected=1` + step `applied`.
- **AC-C03**: Given background AI abilitato, When concept selezionato, Then
  background generato SOLO per concept selezionato (1 chiamata Gemini).
- **AC-P01**: Given utente compila activity="X", When refresha pagina entro
  24h, When riapre tab AI, Then activity="X" ripristinato.
- **AC-P02**: Given utente al step `result` con 3 concept, When refresha
  pagina entro 24h, When riapre tab AI, Then 3 concept ripristinati.
- **AC-P03**: Given utente clicca "Reset chat", When localStorage letto,
  Then `logoAiChat:v1` assente.
- **AC-B01**: Given `backgroundImage` valorizzato, When utente nel Builder,
  Then badge "Background AI attivo" visibile + bottone "Rimuovi background".
- **AC-B02**: Given `backgroundImage` valorizzato, When utente clicca
  "Rimuovi background", Then `backgroundImage=null` e preview senza bg.
- **AC-B03**: Given `backgroundImage` valorizzato, When tab AI, Then tab
  "AI Generation" ha badge "●" rosso.
- **AC-PR01**: Given brief "wellness", When AI genera, Then almeno 1
  concept ha `decorativeElements` non vuoto o `gradientFill=true`.
- **AC-SL01**: Given `useAISocial` con logs non vuoti, When SocialEditor
  renderizza, Then `AILogPanel` mostra i log (non "Nessuna attività").
- **AC-SL02**: Given `useAISocial` con logs vuoti, When SocialEditor
  renderizza, Then `AILogPanel` mostra "Nessuna attività" (corretto).

## 6. Test Automation Strategy

- **Test Levels**: Unit (vitest + jsdom), Integration (component test).
- **Frameworks**: Vitest, React Testing Library, jsdom.
- **Coverage**: ≥ 60% per nuovi file.

### Nuovi test

- `src/utils/__tests__/logoGenerator.viewBox.test.ts`:
  - viewBox 400 default per testo corto.
  - viewBox 600+ per "Pedagogista Susanna".
  - viewBox clamp a 800 max.
  - tagline aggiunge 20 a H.
- `src/utils/__tests__/logoGenerator.decorations.test.ts`:
  - underline render.
  - dotRing render (8 cerchi).
  - topAccent render.
  - gradient defs presente.
  - backgroundColor rect primo elemento.
  - backgroundImage vince su backgroundColor (image primo, rect secondo).
- `src/utils/__tests__/logoGenerator.fitText.test.ts`:
  - fitText ritorna 36 per testo corto.
  - fitText ritorna 14 per testo lunghissimo.
  - fitText proporzionale a maxWidth.
- `src/ai/__tests__/logoOrchestrator.concepts.test.ts`:
  - generateLogo ritorna 3 concept.
  - 3 concept differiscono per almeno 2 campi.
  - fallback a 3 cloni se AI ritorna 1.
- `src/components/__tests__/LogoAiPanel.persistence.test.tsx`:
  - mount legge localStorage.
  - change salva in localStorage (debounced).
  - reset pulisce localStorage.
- `src/components/__tests__/BuilderPanel.decorations.test.tsx`:
  - checkbox gradient → onPatch.
  - color picker background → onPatch.
  - chip decorations → onPatch array.
  - badge "Background AI attivo" visibile se backgroundImage.
  - bottone "Rimuovi background" → onPatch null.
- `src/components/__tests__/SocialEditor.log.test.tsx`:
  - logs non vuoti → AILogPanel mostra entries.
  - logs vuoti → "Nessuna attività".

### Test aggiornati

- `src/utils/__tests__/logoGenerator.test.ts`: signature `getViewBox`
  cambia (3 args), `buildSvgForLayout` output esteso.
- `src/utils/__tests__/documentSchemas.test.ts`: 3 nuovi campi logo.
- `src/ai/__tests__/logoOrchestrator.test.ts`: 3 concept output.

## 7. Rationale & Context

- **ViewBox dinamico vs auto-fit**: l'utente ha scelto auto-fit (font scale).
  ViewBox resta clampato a 800 max per evitare SVG troppo larghi (export
  PNG 1024px = qualità accettabile). Auto-fit garantisce testo sempre leggibile.
- **3 concept vs 1 diretto**: l'utente vuole 3 (più valore, più scelta).
  Costo 3× token DeepSeek ma 1 chiamata sola (JSON array). Background Gemini
  SOLO sul concept scelto (costo 1 chiamata Gemini, non 3).
- **Decorations AI + manuali**: l'utente vuole entrambi. AI le propone
  nel prompt, Builder le fa modificare/rimuovere.
- **Persistenza 24h**: bilanciamento tra UX (non perde lavoro) e privacy
  (non salva indefinitamente). 24h = sessione lavorativa tipica.
- **Social log fix**: bug banale di wiring, non di design. `useAISocial`
  espone `logs`, `SocialEditor` non lo passa a `AILogPanel`.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: DeepSeek API — 3 concept in 1 chiamata (JSON array output).

### Third-Party Services
- **SVC-001**: Gemini Nano Banana 2 Lite — 1 background per concept scelto.

### Infrastructure Dependencies
- **INF-001**: Vercel serverless `/api/ai/logo-background` (v2.1, esiste).
- **INF-002**: Vite dev middleware `/api/logo-background` (v2.1, esiste).

### Data Dependencies
- **DAT-001**: `localStorage['logoAiChat:v1']` — chat state persistito.

### Technology Platform Dependencies
- **PLT-001**: Vitest + jsdom per test SVG rendering (no canvas).
- **PLT-002**: React 18 + React Router v6 (esistente).

### Compliance Dependencies
- **COM-001**: Nessuna PII in `logoAiChat:v1` (activity è testo libero utente,
  salvato solo localmente, mai inviato a server se non per generazione).

## 9. Examples & Edge Cases

### Esempio: 3 concept per "Pizzeria Cagliari"

```json
[
  {
    "primaryText": "Pizzeria del Porto",
    "tagline": "Pizza napoletana dal 1985",
    "iconType": "lucide",
    "iconName": "ChefHat",
    "iconShape": "rounded",
    "primaryColor": "#E62020",
    "secondaryColor": "#1A1A1A",
    "layout": "stacked",
    "decorativeElements": ["underline"],
    "gradientFill": false,
    "backgroundColor": null
  },
  {
    "primaryText": "Da Marco",
    "tagline": "Il gusto della tradizione",
    "iconType": "monogram",
    "monogram": "DM",
    "iconShape": "circle",
    "primaryColor": "#B91C1C",
    "secondaryColor": "#F5F5F4",
    "layout": "horizontal",
    "decorativeElements": ["dotRing"],
    "gradientFill": true,
    "backgroundColor": "#1A1A1A"
  },
  {
    "primaryText": "Pizzeria Cagliari",
    "tagline": "Pizza fritta e pizza al piatto",
    "iconType": "lucide",
    "iconName": "Utensils",
    "iconShape": "hex",
    "primaryColor": "#F59E0B",
    "secondaryColor": "#1F2937",
    "layout": "vertical",
    "decorativeElements": ["topAccent"],
    "gradientFill": false,
    "backgroundColor": null
  }
]
```

### Edge case: testo lunghissimo

```ts
fitText("Supercalifragilistichespiralidoso", 380, 36)
// → 14 (min size, testo ancora non entra → viewBox espande)
// getViewBox: W = clamp(400, 800) → 800, refit con maxWidth=740 → size 18
```

### Edge case: AI ritorna 1 concept

```ts
parseJsonResponse('[{...}]', z.array(schema).length(3))
// → fail validation
// Fallback: replica il concept con variazioni colore:
//   concept2 = { ...c1, primaryColor: shiftHue(c1.primaryColor, 30) }
//   concept3 = { ...c1, layout: 'vertical', decorativeElements: ['underline'] }
```

### Edge case: background AI fallisce

```ts
generateBackground(logo, ctx)
// → { applied: false, error: 'GEMINI_QUOTA_EXCEEDED' }
// UI: toast error, concept applicato senza background, bottone "Riprova background"
// disponibile nel result step.
```

## 10. Validation Criteria

- `npm run typecheck` verde.
- `npm run test` verde (tutti i test esistenti + nuovi).
- `npm run build` verde.
- Smoke test manuale:
  - "Pedagogista Susanna" non troncato.
  - 3 concept visibili e selezionabili.
  - Background AI visibile nel Builder.
  - Decorazioni applicate e visibili.
  - Persistenza chat dopo refresh.
  - Social editor mostra log quando presenti.

## 11. Related Specifications / Further Reading

- `spec/spec-design-ai-logo-v2-1-nano-banana.md` (v2.1, predecessore).
- `spec/spec-design-ai-logo-v2.md` (v2, originale).
- `spec/spec-design-ai-social-module.md` (modulo social, per il log fix).
- `.agents/skills/.agents/skills/frontend-design/SKILL.md` (design guidelines).
- `.agents/skills/gpt-taste/SKILL.md` (taste skill, agent-only).