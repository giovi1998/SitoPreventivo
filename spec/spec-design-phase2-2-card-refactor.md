---
title: Phase 2.2 — Refactor & fix del modulo Bigliettino (griglia, AI, parità mobile, preview)
version: 1.0
date_created: 2026-06-30
last_updated: 2026-06-30
owner: Giovanni Cidu
tags: [design, business-card, refactor, clean-code, grid, ai, responsive, vercel, mobile-parity]
---

# Introduction

La fase 2.2 è un intervento di **refactor e bug-fixing** sul modulo
Bigliettino (`CardEditor`) già consegnato in fase 2/2.1. Non aggiunge
nuove funzionalità di prodotto: rende affidabili e coerenti quelle
esistenti, eliminando una serie di bug confermati nel codice e colmando
i gap di parità tra desktop e mobile.

L'analisi del codice ha individuato dieci difetti, raggruppabili in
quattro aree: (A) griglia + AI, (B) parità mobile, (C) stabilità della
preview, (D) sezione Stile + UX. La spec definisce requisiti, interfacce,
criteri di accettazione e strategia di test per ciascuna area, nel
rispetto dei vincoli architetturali del progetto (PDF/export 100%
client-side, API monolitica Vercel invariata, nessun nuovo endpoint).

Il lavoro è organizzato in commit separati per fase, con test obbligatori
e **senza push** (push manuale a cura dell'utente).

## 1. Purpose & Scope

**Purpose**: rendere il modulo Bigliettino corretto, coerente e
manutenibile, in particolare per quanto riguarda (1) lo spostamento e il
ridimensionamento degli elementi sulla griglia, (2) le modifiche operate
dall'AI, (3) la parità di funzioni tra desktop e mobile, (4) la stabilità
della preview al variare di zoom e dimensione schermo, (5) la sezione
Stile (colori, font, layout).

**Scope** (file toccati):
- `src/components/CardEditor.tsx` — fix collision check, instradamento
  grid front/back, unificazione azioni AI, estrazione sezioni form in
  componenti condivisi desktop/mobile.
- `src/components/CardPreview.tsx` — separazione "layout a griglia attivo"
  da "linee guida"; evidenziazione elemento selezionato.
- `src/components/MobileGridEditor.tsx` — selettore lato fronte/retro.
- `src/ai/cardMerge.ts` — instradamento elementi retro su `backGrid`,
  clamp per-asse con fallback graduale.
- `src/hooks/useCardPreviewZoom.ts` — zoom reattivo al breakpoint.
- `src/utils/documentSchemas.ts` — eventuale flag esplicito di grid-mode
  e set font sicuri (vedi CON-005).
- `src/components/CardEditor.css` — preview che riserva spazio (no
  `transform: scale` che esce dal flusso), responsive Stile su mobile.
- **Nuovi componenti** (estratti, condivisi): `CardFrontFields`,
  `CardBackFields`, `CardMediaFields`, `CardStyleFields`,
  `CardServicesFields`, `CardSocialsFields`, `CardQrAdvanced`,
  `CardGridControls` (in `src/components/card/`).
- File di test corrispondenti in `src/**/__tests__/`.

**Out of scope**:
- Drag-and-drop diretto sulla griglia mobile (si mantengono frecce +
  selettore lato — decisione utente).
- Nuovi formati di export o nuovi layout grafici.
- Modifiche all'API monolitica `api/index.ts` o a `db/schema.ts`.
- Modifiche alla HomePage.
- Integrazione Stripe / tier (fase 5, già consegnata).

**Intended audience**: sviluppatore che implementa il refactor; reviewer
che verifica test e assenza di regressioni.

**Assumptions**:
- Le funzioni di `src/utils/gridUtils.ts` (`collides`,
  `wouldCollideOnMove`, `wouldCollideOnResize`, `clampMove`,
  `clampResize`, `canMove`, `canResize`) sono corrette e restano stabili.
- Lo schema `businessCardSchema` (front/back/style/grid/backGrid) è
  invariato salvo le aggiunte esplicitamente elencate.
- La suite test attuale è verde (986 test) e `typecheck` è pulito.

## 2. Definitions

- **Card / Bigliettino**: documento `documentType='businessCard'` con
  `front`, `back`, `style`, `grid` (fronte), `backGrid` (retro).
- **Grid-mode**: modalità di rendering in cui gli elementi della card
  vengono posizionati via CSS Grid usando `grid`/`backGrid`, invece del
  layout flexbox (`centered`/`left`/`split`).
- **Linee guida (overlay)**: SVG 4×4 tratteggiato sovrapposto alla
  preview, puramente visivo, attivato dal toggle "Griglia".
- **Grid editor**: controlli (frecce/ridimensiona desktop, popup frecce
  mobile) per spostare e ridimensionare gli elementi nella griglia.
- **`activeGrid`**: la griglia del lato attualmente in modifica
  (`card.grid` se fronte, `card.backGrid` se retro).
- **Parità mobile**: requisito per cui ogni funzione editabile su desktop
  deve essere editabile anche su mobile.
- **Clamp**: limitazione di una mossa/resize alla posizione valida più
  vicina (entro i bordi e senza collisione).
- **Clamp graduale (per-asse)**: applicazione separata di delta su X e Y
  (e su W e H), in modo che una mossa multi-cella avanzi finché possibile
  invece di essere scartata interamente in caso di collisione finale.

## 3. Requirements, Constraints & Guidelines

### Fase A — Griglia + AI

- **REQ-A01**: Il controllo di collisione nel grid editor desktop DEVE
  usare la griglia reale (`activeGrid`) e non un oggetto privo di
  `elements`. I flag `canMove*`/`canGrow*`/`canShrink*` devono riflettere
  bordi **e** collisioni, in modo che lo stato disabilitato dei bottoni
  coincida con l'effettivo esito di `clampMove`/`clampResize`.
- **REQ-A02**: La preview DEVE entrare in grid-mode in base all'uso
  effettivo del grid editor, NON in base al toggle delle linee guida. Il
  toggle "Griglia" controlla SOLO la visibilità dell'overlay di aiuto.
- **REQ-A03**: Cambiare `front.layout` o `style.sizePreset` mentre la
  card è in grid-mode NON DEVE produrre sovrapposizioni o overflow: il
  sistema deve o disattivare il grid-mode, o ri-clampare gli elementi al
  nuovo contesto, con un avviso non bloccante all'utente.
- **REQ-A04**: `cardMerge` DEVE instradare gli elementi del retro
  (`qr`, `contacts`, `socials`) su `card.backGrid` e gli elementi del
  fronte (`photo`, `name`, `title`, `company`, `logo`) su `card.grid`.
  Nessun elemento del retro deve finire in `card.grid` (e viceversa).
- **REQ-A05**: Le azioni AI rapide DEVONO avere identici identificativi
  tra desktop e mobile. In particolare l'azione "Compila da nome" usa la
  chiave `fill` in entrambe le viste.
- **REQ-A06**: `cardMerge` per le mosse/resize della griglia DEVE
  applicare un clamp graduale per-asse: una richiesta AI di spostamento
  multi-cella avanza fino all'ultima cella valida invece di essere
  scartata interamente in caso di collisione sulla posizione finale.

### Fase B — Parità mobile

- **REQ-B01**: Ogni sezione del form editabile su desktop DEVE essere
  editabile su mobile: Fronte, Retro, **Foto**, **Logo** (+ sfondo logo),
  **Servizi**, **Social**, **Opzioni QR avanzate**, **Stile** (formato,
  bordo, colori sfondo/testo/accento, **font**).
- **REQ-B02**: Le sezioni del form DEVONO essere estratte in componenti
  riutilizzabili e renderizzate sia dal layout desktop 3-colonne sia dai
  tab mobile, senza duplicazione del JSX.
- **REQ-B03**: Il grid editor mobile (`MobileGridEditor`) DEVE permettere
  di selezionare il lato (fronte/retro) come la versione desktop,
  mantenendo l'interazione a frecce + popup.
- **CON-B01**: Su mobile gli `input` devono mantenere `font-size: 16px`
  per evitare l'auto-zoom iOS (pattern già in uso).

### Fase C — Preview stabile

- **REQ-C01**: Lo zoom della preview NON DEVE causare overflow o
  sovrapposizione con la UI circostante: lo spazio occupato deve scalare
  con il fattore di zoom (il contenitore riserva l'area effettiva).
- **REQ-C02**: Il fattore di zoom di default DEVE adeguarsi al cambio di
  breakpoint (mobile/desktop) durante la sessione, non solo al primo
  render.
- **GUD-C01**: Preferire una scala che resti accessibile (testo non
  illeggibile a zoom minimo); mantenere `ZOOM_MIN`/`ZOOM_MAX` correnti.

### Fase D — Stile + UX

- **REQ-D01**: La sezione Stile DEVE includere un selettore di
  `fontFamily` con un set di font sicuri predefiniti, riflesso
  immediatamente nella preview.
- **REQ-D02**: I controlli colore (sfondo/testo/accento) DEVONO applicare
  il valore alla preview in tempo reale su entrambe le viste.
- **REQ-D03**: La selezione dell'elemento nel grid editor
  (`selectedGridElement`) DEVE persistere al cambio di tab/pannello e
  l'elemento selezionato DEVE essere evidenziato nella preview.

### Vincoli architetturali e di processo

- **CON-001**: Tutta la generazione PDF/PNG/SVG resta **client-side**.
  Nessuna chiamata di rete aggiuntiva, nessun nuovo endpoint.
- **CON-002**: `api/index.ts` (funzione serverless monolitica) e
  `db/schema.ts` restano **invariati**.
- **CON-003**: L'AI riusa il flusso esistente (`CardAIOrchestrator`,
  provider DeepSeek, nessun tool). Nessun nuovo endpoint AI.
- **CON-004**: Nessun push automatico. Commit separati per fase A/B/C/D.
- **CON-005**: Eventuali aggiunte allo schema (`useGrid`, set font) DEVONO
  avere `default` retro-compatibili così da non invalidare card salvate.
- **SEC-001**: L'upload immagini mantiene i controlli esistenti (MIME
  allowlist PNG/JPEG/SVG, limite 5MB, compressione canvas, PNG per il
  logo per preservare la trasparenza).
- **SEC-002**: `cardMerge` mantiene la sanitizzazione Zod
  (`businessCardSchema.partial()`) e la protezione anti-hallucination;
  non deve mai sovrascrivere `photoUrl`/`logoUrl` (base64 utente).
- **PAT-001**: Clean code — single responsibility per componente,
  funzioni pure dove possibile, niente prop-drilling superfluo, niente
  `as unknown as` per aggirare i tipi (la rimozione del cast errato in
  REQ-A01 è esemplare).
- **PAT-002**: Vercel/React best practices — `React.memo` sui componenti
  preview pesanti, `useCallback`/`useMemo` per handler e valori derivati,
  conditional render (non CSS hide) per evitare DOM duplicato
  desktop/mobile.

## 4. Interfaces & Data Contracts

### 4.1 Schema (aggiunte retro-compatibili)

```ts
// documentSchemas.ts — opzione esplicita di grid-mode per lato
front: z.object({
  // ...campi esistenti
  useGrid: z.boolean().default(false), // NEW: layout a griglia attivo sul fronte
}),
back: z.object({
  // ...campi esistenti
  useGrid: z.boolean().default(false), // NEW: layout a griglia attivo sul retro
}),

// Set font sicuri (UI selector). Stringa libera mantenuta per retro-compat.
export const SAFE_FONT_FAMILIES = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
  'Georgia', 'Times New Roman', 'Courier New',
] as const;
```

> Nota: in alternativa a `useGrid`, il grid-mode può essere derivato
> dalla presenza di una grid editata dall'utente. La scelta finale è
> implementativa, purché soddisfi REQ-A02 e CON-005.

### 4.2 Componenti estratti (firme proposte)

```ts
interface CardSectionProps {
  card: BusinessCard;
  patchFront: (p: Partial<BusinessCard['front']>) => void;
  patchBack:  (p: Partial<BusinessCard['back']>)  => void;
  patchStyle: (p: Partial<BusinessCard['style']>) => void;
}

function CardFrontFields(p: CardSectionProps): JSX.Element;     // nome, ruolo, azienda, layout
function CardMediaFields(p: CardSectionProps & {                // foto, logo, sfondo logo
  onUpload: (f: File, field: 'photoUrl' | 'logoUrl') => void;
  onRemovePhoto: () => void; onRemoveLogo: () => void;
  uploadError: string | null;
}): JSX.Element;
function CardBackFields(p: CardSectionProps): JSX.Element;       // telefono, email, web, indirizzo, p.iva
function CardServicesFields(p: CardSectionProps): JSX.Element;   // lista servizi (max 8)
function CardSocialsFields(p: CardSectionProps): JSX.Element;    // social CRUD
function CardQrAdvanced(p: CardSectionProps): JSX.Element;       // payload/label QR
function CardStyleFields(p: CardSectionProps): JSX.Element;      // formato, bordo, colori, FONT
function CardGridControls(p: {                                   // selettore lato + frecce + resize
  card: BusinessCard;
  side: 'front' | 'back';
  onSideChange: (s: 'front' | 'back') => void;
  selected: keyof CardGrid['elements'] | '';
  onSelect: (k: keyof CardGrid['elements'] | '') => void;
  onMove:  (dx: number, dy: number) => void;
  onResize:(dw: number, dh: number) => void;
  onApplyPreset: (p: 'left' | 'centered' | 'split') => void;
}): JSX.Element;
```

### 4.3 cardMerge — instradamento griglia

```ts
// Mappatura elemento → griglia di destinazione
const FRONT_KEYS = ['photo', 'name', 'title', 'company', 'logo'] as const;
const BACK_KEYS  = ['contacts', 'qr', 'socials'] as const;

// Gli elementi FRONT_KEYS aggiornano updated.grid
// Gli elementi BACK_KEYS aggiornano updated.backGrid
// (clamp calcolato sulla griglia di destinazione corretta)
```

## 5. Acceptance Criteria

- **AC-A01**: Given una card in grid-mode con due elementi adiacenti,
  When seleziono un elemento e il movimento verso l'altro causerebbe
  collisione, Then il bottone freccia corrispondente è disabilitato e,
  se abilitato, il click sposta effettivamente l'elemento (nessun
  bottone "abilitato ma inerte").
- **AC-A02**: Given un utente che sposta un elemento nel grid editor con
  il toggle linee guida spento, When applica la mossa, Then la preview
  riflette la nuova posizione (grid-mode attivo) e le linee tratteggiate
  restano nascoste.
- **AC-A03**: Given una card con `backGrid` definita, When l'AID applica
  "← Sposta QR", Then `card.backGrid.elements.qr` viene aggiornato e il
  retro mostra il QR spostato (nessuna scrittura su `card.grid`).
- **AC-A04**: Given la vista mobile, When premo "Compila da nome", Then
  viene eseguito il prompt `fill` (non il testo custom).
- **AC-A05**: Given una richiesta AI di spostare un elemento di 2 celle
  con la cella finale occupata ma una intermedia libera, When `cardMerge`
  elabora la mossa, Then l'elemento avanza fino all'ultima cella valida
  invece di non muoversi.
- **AC-B01**: Given la vista mobile nel tab "Modifica", Then sono presenti
  e funzionanti i controlli per foto, logo (+sfondo), servizi, social,
  opzioni QR e Stile (formato, bordo, colori, font).
- **AC-B02**: Given il `MobileGridEditor`, When seleziono "Fronte", Then
  posso spostare foto/nome/ruolo/azienda/logo; selezionando "Retro" posso
  spostare contatti/QR/social.
- **AC-B03**: The system shall renderizzare le stesse sezioni del form da
  un unico set di componenti, senza duplicazione del markup tra desktop
  e mobile (verificato da assenza di JSX duplicato e da test di render).
- **AC-C01**: Given la preview a zoom 150%, Then non si verifica
  sovrapposizione con i controlli adiacenti né overflow orizzontale; lo
  spazio riservato cresce con lo zoom.
- **AC-C02**: Given una sessione iniziata su desktop, When la finestra
  scende sotto il breakpoint mobile, Then il fattore di zoom di default
  si adegua.
- **AC-D01**: Given la sezione Stile, When cambio il font, Then la preview
  aggiorna il `font-family` in tempo reale.
- **AC-D02**: Given un elemento selezionato nel grid editor, When cambio
  tab e torno, Then la selezione persiste ed è evidenziata nella preview.

## 6. Test Automation Strategy

- **Test Levels**: Unit (utility, hook, merge), Component (React Testing
  Library), nessun E2E richiesto per questa fase.
- **Frameworks**: Vitest + React Testing Library + jsdom (stack progetto).
- **Test Data Management**: factory `createEmptyCard()` /
  `createGiovanniCardTemplate()`; griglie costruite con i preset
  (`gridPresetLeft/Centered/Split/BackDefault`).
- **Nuovi test obbligatori**:
  - `CardEditor.test.tsx`: collision desktop (REQ-A01) — bottone
    disabilitato ⇔ mossa inerte; persistenza selezione (REQ-D03).
  - `cardMerge.test.ts`: instradamento front/back (REQ-A04), clamp
    graduale (REQ-A06), non-sovrascrittura `photoUrl`/`logoUrl`.
  - `CardPreview.test.tsx`: grid-mode indipendente dal toggle overlay
    (REQ-A02); font-family applicato (REQ-D01).
  - `MobileGridEditor.test.tsx`: selettore lato fronte/retro (REQ-B03).
  - Render parità mobile: presenza controlli Stile/foto/logo/social/
    servizi/QR nel tab Modifica (REQ-B01).
  - `useCardPreviewZoom.test.ts`: reattività breakpoint (REQ-C02).
- **CI/CD Integration**: `npm run typecheck` + `npm run test` verdi prima
  di proporre commit/push (Pre-push Checklist AGENTS.md).
- **Coverage Requirements**: ≥60% sui nuovi file estratti (target
  progetto); nessun test `.skip`.
- **Performance Testing**: non applicabile (componenti UI client-side).

## 7. Rationale & Context

- **REQ-A01**: il cast `bounds as unknown as CardGrid` passa a
  `wouldCollideOnMove` un oggetto senza `elements`, che quindi ritorna
  sempre `false`. I bottoni risultano abilitati ma `moveSelectedElement`
  usa `clampMove` sulla griglia reale e blocca: l'utente clicca e non
  succede nulla. È la causa principale del "Sposta elementi non funziona".
- **REQ-A02**: oggi `isGridMode` richiede `showGrid===true` (default
  `false`), quindi spostare gli elementi non si vede finché non si accende
  l'overlay. Conflate due concetti distinti (layout vs aiuto visivo).
- **REQ-A03**: in grid-mode il `front.layout` viene ignorato e il
  `sizePreset` cambia l'aspect-ratio senza riposizionare gli elementi,
  causando overflow con `overflow:hidden` ("il layout si rompe").
- **REQ-A04**: `cardMerge` scrive sempre `updated.grid`, ma il retro si
  renderizza da `backGrid ?? grid`; con `backGrid` presente (template
  Giovanni) le mosse AI sul QR risultano invisibili.
- **REQ-A05**: i bottoni mobile chiamano `runCardAI('fillName')` mentre la
  mappa prompt definisce `fill`; il fallback esegue il testo custom.
- **REQ-B01/B02**: il tab "Modifica" mobile renderizza solo nome/ruolo/
  azienda/layout + contatti, omettendo foto, logo, servizi, social, QR e
  l'intera sezione Stile: su mobile non si possono cambiare i colori né il
  font ("i colori non si applicano" = controlli assenti). L'estrazione in
  componenti condivisi risolve sia la parità sia la duplicazione (~600
  righe).
- **REQ-C01/C02**: lo zoom via `transform: scale()` non altera il box di
  layout, generando overflow/spazi vuoti e instabilità percepita al
  variare della dimensione schermo; l'initial zoom non reagisce al cambio
  breakpoint.
- **REQ-D01**: lo schema e l'AI supportano `fontFamily`, ma manca il
  controllo UI; l'utente non può cambiare font manualmente.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: DeepSeek Chat API — usata SOLO via flusso esistente
  (`CardAIOrchestrator`), nessuna nuova integrazione.

### Third-Party Services
- **SVC-001**: Nessun nuovo servizio. Export e rendering restano
  client-side.

### Infrastructure Dependencies
- **INF-001**: Vercel Hobby — vincolo di funzione serverless monolitica
  invariata; nessun nuovo endpoint (CON-002).

### Data Dependencies
- **DAT-001**: localStorage/Neon via `dataService.saveDocument`
  (invariato); card serializzate devono restare valide con i nuovi
  default (CON-005).

### Technology Platform Dependencies
- **PLT-001**: React 18 + Vite; Vitest + RTL + jsdom per i test; Canvas
  API per export (già richiesta dalla fase 2).

### Compliance Dependencies
- **COM-001**: Watermark tier-free (fase 5) preservato in preview ed
  export per i documenti `free`; il refactor non deve rimuoverlo.

## 9. Examples & Edge Cases

```ts
// REQ-A01 — collision check con la griglia REALE (non un oggetto fittizio)
const canGrowW =
  !!selectedGridElement &&
  !!activeGrid &&
  !wouldCollideOnResize(activeGrid, selectedGridElement, 1, 0);

// REQ-A04 — instradamento corretto in cardMerge
const target = BACK_KEYS.includes(key) ? 'backGrid' : 'grid';
const destGrid = updated[target] ?? defaultGridFor(target);
// ...applica clamp su destGrid, poi updated[target] = newGrid

// REQ-A06 — clamp graduale per-asse (pseudo)
function stepMove(grid, key, dx, dy) {
  let { x, y } = grid.elements[key];
  const sx = Math.sign(dx), sy = Math.sign(dy);
  for (let i = 0; i < Math.abs(dx); i++)
    if (!wouldCollideOnMove(grid, key, sx, 0)) x += sx; else break;
  for (let i = 0; i < Math.abs(dy); i++)
    if (!wouldCollideOnMove(grid, key, 0, sy)) y += sy; else break;
  return { x, y };
}
```

**Edge cases**:
- Card senza `grid`/`backGrid` (card vecchie): i nuovi default
  (`useGrid:false`) le mantengono in layout flexbox classico.
- AI che invia una grid con tutti gli elementi a `(0,0,1,1)`:
  `isGridHallucinated` continua a scartare l'intera grid.
- Cambio `sizePreset` con elementi grid che eccedono i nuovi bordi:
  re-clamp o disattivazione grid-mode (REQ-A03), mai overflow.
- Zoom al minimo con card quadrata: testo deve restare leggibile (GUD-C01).
- `fontFamily` con valore non presente in `SAFE_FONT_FAMILIES` (card
  importata): il selettore mostra opzione "Personalizzato" / valore
  corrente, non lo sovrascrive.

## 10. Validation Criteria

- Tutti gli Acceptance Criteria (AC-A01…AC-D02) coperti da test verdi.
- `npm run typecheck` pulito; `npm run test` verde (≥ 986 test, nessuno
  `.skip`).
- Nessuna modifica a `api/index.ts`, `db/schema.ts`, `vercel.json`,
  HomePage.
- Nessun `as unknown as` residuo nel grid editor; nessuna duplicazione di
  JSX del form tra desktop e mobile.
- Watermark tier-free ancora presente in preview ed export.
- Commit separati per fase (A, B, C, D); nessun push automatico.

## 11. Related Specifications / Further Reading

- `spec/spec-design-phase2-business-card.md` — spec originale Bigliettino.
- `spec/spec-data-phase5-tier-system.md` — watermark e tier (vincolo
  COM-001).
- `AGENTS.md` — sezioni "Business Card Module", "Responsive Patterns",
  "Test — OBBLIGATORI", "Pre-push Checklist", "Known Issues — Card Module".
- `.agents/skills/vercel-react-best-practices/SKILL.md` — pattern
  performance React (PAT-002).
- `.agents/skills/vercel-composition-patterns/SKILL.md` — estrazione
  componenti condivisi (REQ-B02).
</content>
</invoke>
