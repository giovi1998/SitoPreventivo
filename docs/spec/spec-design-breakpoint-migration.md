---
title: Breakpoint Migration — Canonical 767/1023 Responsive Shell
version: 1.0
date_created: 2026-07-31
owner: Founder
tags: [design, frontend, responsive]
---

# Introduction

Specifica la migrazione dei breakpoint responsivi sparsi della webapp
Quickbrand (900/768/1100/1180/1200/1279/1400/640/680/480…) verso i due
breakpoint canonici del progetto (`BP_SHELL=768` → `MQ_SHELL=max-width:767px`,
`BP_WORKSPACE=1024` → `MQ_WORKSPACE=max-width:1023px`). Risolve due bug
conosciuti: il dead zone di navigazione 769–900px (né sidebar né mobile-topbar)
e la doppia header su viewport medi. Interviene solo su CSS/layout: zero
cambi di logica documenti, dati o API.

## 1. Purpose & Scope

**Purpose**: (a) eliminare il dead zone di navigazione tra 769px e 900px dove
la sidebar è nascosta ma la mobile-topbar non è ancora visibile, (b) eliminare
la doppia header (desktop `.topbar` + `.mobile-topbar`) quando il shell commuta,
(c) sostituire tutti i breakpoint storici sparsi con i canonici 767/1023.

**Scope**: componenti React e fogli CSS della UI (`src/components/**`,
`src/pages/**`, `src/hooks/useMediaQuery.ts`). Fuori scope: `api/`, `db/`,
logica documenti, export PDF/PNG/SVG, generazione AI.

**Audience**: agenti AI di coding, founder. Nessuna conoscenza pregressa
richiesta oltre alla struttura repo in `AGENTS.md`.

**Assunzioni**: la regola progetto "conditional render, non CSS-hide per layout
strutturali" si applica solo dove il DOM è significativo (sidebar 260px).
Le regole "breakpoint canonici 768/1024" e "iOS input 16px" restano hard.

## 2. Definitions

| Termine | Definizione |
|---|---|
| `BP_SHELL` | 768px. Soglia del shell app (sidebar vs drawer hamburger). |
| `BP_WORKSPACE` | 1024px. Soglia del workspace editor (colonne vs stack). |
| `MQ_SHELL` | `(max-width: 767px)` — media query derivata da `BP_SHELL - 1`. |
| `MQ_WORKSPACE` | `(max-width: 1023px)` — media query derivata da `BP_WORKSPACE - 1`. |
| Dead zone | Intervallo viewport senza navigazione utilizzabile (769–900px). |
| Shell switch | Commutazione sidebar desktop ↔ mobile-topbar + drawer. |
| 3-col editor | Layout editor a tre colonne (manual | preview | AI). |
| Eccezione 480 | `@media(max-width:480px)` — tweak cosmetici small-phone, NON strutturali. |

## 3. Requirements, Constraints & Guidelines

### REQ — Requirement

- **REQ-001**: Shell switch unificato a `MQ_WORKSPACE` (`max-width:1023px`):
  a ≤1023 la sidebar è nascosta e la mobile-topbar è visibile. Nessun
  intervallo viewport senza navigazione.
- **REQ-002**: La desktop `.topbar` è nascosta nello stesso blocco `@1023` del
  shell switch (mai doppia header).
- **REQ-003**: Gli editor a colonne (preventivo, card, flyer, QR, logo, social,
  CRM) collassano a ≤1023 con l'eccezione dei 3-col che già collassano a soglie
  inferiori ma devono essere allineati a 1023 (vedi CON-002).
- **REQ-004**: L'editor-col (pannello laterale) usa `width:clamp(280px,30vw,380px)`
  al posto dei gradini fissi 380→320→280.
- **REQ-005**: Tutti i breakpoint CSS devono usare esclusivamente 767 o 1023,
  tranne l'eccezione 480 documentata (vedi GUD-004).
- **REQ-006**: Il componente `Layout.tsx` renderizza sidebar e mobile-topbar in
  modo condizionale in base a `useIsMobileWorkspace()` (no CSS-hide per questo
  layout strutturale).
- **REQ-007**: La preview flyer scala con auto-fit via ResizeObserver
  (pattern esistente di `CardPreviewSurface`), proporzioni identiche
  mobile/desktop.

### CON — Constraint

- **CON-001**: Nessuna nuova dipendenza o libreria. Solo CSS nativo, hook
  `useMediaQuery` esistenti, pattern ResizeObserver già presente.
- **CON-002**: I 3-col che collassano sotto i canonici (card `@1100`,
  flyer `@899`, QR `@1200`) vanno allineati a 1023 con la regola:
  `grid-template-columns:1fr` (stack) e, dove il 3-col era già strutturalmente
  mobile, si unifica il blocco.
- **CON-003**: `AILogPanel.css:318` `@media(min-width:1024px)` è già canonico
  → resta invariato.
- **CON-004**: `.editor-mobile-*` di preventivo (`EditorView.tsx`) resta
  CSS-gated (già `display:none` di default) — nessun conditional render JS
  aggiuntivo per elementi piccoli (ponytail: CSS prima di JS).
- **CON-005**: Il merge del blocco `@media(max-width:768px)` → `@1023` allarga
  a ≤1023 anche i tweak "shell mobile" (padding document/collection/theme).
  Accettato: coerente con shell a 1023.

### GUD — Guideline

- **GUD-001**: Mappatura breakpoint storici → canonici: `900/899/880/1100/
  1180/1200/1279/1400` → `1023` (o eliminati); `640/680/760/767/768` → `767`.
- **GUD-002**: `@1180` (topbar `btn-label`) resta — intervallo desktop
  1024–1180 dove la topbar è ancora visibile.
- **GUD-003**: Eccezione 480 mantenuta in `cardResponsive.css:211` e
  `AdminDashboard.tsx:696` con commento `/* ≤480 small-phone exception
  (canonical 767/1023) */`.
- **GUD-004**: Ogni media query rimossa va verificata con `grep` che non ci
  siano altre occorrenze dello stesso valore di scarto nel file (deletion
  sicura, non solo sostituzione puntuale).
- **GUD-005**: AdminDashboard: eliminare il hiding `nth-child(7),(8)` e usare
  `overflow-x:auto` sul wrapper tabella (deletion > addition).

### PAT — Pattern

- **PAT-001**: Auto-fit preview: misurare il container con ResizeObserver,
  guard `typeof ResizeObserver === 'undefined'` → default costante (jsdom).
  Fonte: `CardPreviewSurface.tsx:57-75`.

## 4. Interfaces & Data Contracts

### Hook pubblici (invariati)

`src/hooks/useMediaQuery.ts` espone costanti e hook già presenti; nessun cambio
di firma:

```ts
export const BP_SHELL = 768;        // soglia shell app
export const BP_WORKSPACE = 1024;   // soglia workspace editor
export const MQ_SHELL = `(max-width: ${BP_SHELL - 1}px)`;         // '(max-width: 767px)'
export const MQ_WORKSPACE = `(max-width: ${BP_WORKSPACE - 1}px)`; // '(max-width: 1023px)'
export function useIsMobileShell(): boolean;      // true ≤767
export function useIsMobileWorkspace(): boolean;  // true ≤1023
```

### Tabella migrazione (file:line → valore)

| File:line | Ora | Dopo |
|---|---|---|
| `GlobalStyles.tsx:551` | `@media(max-width:900px)` shell switch (`.app-shell{1fr}`, `.sidebar{display:none}`) | `@media(max-width:1023px)` + `.topbar{display:none}` |
| `GlobalStyles.tsx:552` | `@media(max-width:768px)` (mobile-topbar, editor stack) | `@media(max-width:1023px)` |
| `GlobalStyles.tsx:234` | `@1024` hide `.save-status` | DELETE (topbar nascosta ≤1023) |
| `GlobalStyles.tsx:235` | `@900` hide `.theme-pills` | DELETE |
| `GlobalStyles.tsx:233` | `@1180` btn-label | KEEP (1024–1180) |
| `GlobalStyles.tsx:254` | `.editor-col{width:380px}` | `width:clamp(280px,30vw,380px)` |
| `GlobalStyles.tsx:548` | `@1400` editor-col 320 | DELETE |
| `GlobalStyles.tsx:549` | `@1200` editor-col 280 | DELETE |
| `GlobalStyles.tsx:385` | `@768` doc-comparison-wrap | → `767` |
| `GlobalStyles.tsx:586` | `@680` swatches/tabelle | → `767` |
| `GlobalStyles.tsx:550` / `:579` | `@1023` collection 2col / `@767` 1col | KEEP |
| `Layout.tsx:38,191` | sidebar + mobile-topbar sempre in DOM | conditional render `useIsMobileWorkspace()` |
| `CardEditorShell.tsx:87` | `useMediaQuery('(max-width: 900px)')` | `useIsMobileWorkspace()` |
| `card/cardResponsive.css:5` | `@900` tabs mobile | → `1023` |
| `card/cardResponsive.css:170` | `@900` pannello AI mobile | → `1023` |
| `card/cardResponsive.css:211` | `@480` cover-grid 1col | KEEP + commento |
| `card/cardAiLayout.css:309` | `@1100` 3col→1col | → `1023` |
| `card/cardBase.css:93` | `@880` grid→1col | → `1023` |
| `card/cardMobileToolbar.css:103` | `@900` padding | → `1023` |
| `QREditor.css:64` | `@900` grid→1col | → `1023` |
| `QREditor.css:296` | `@1200` 3col→2col | → `1023` |
| `QREditor.css:305` | `@760` 2col→1col | → `767` |
| `SocialEditor.css:101,124,320` | `@900` | → `1023` |
| `LogoEditor.css:119` | `@900` builder-panel→1col | → `1023` |
| `flyer/styles/shell.css:30` | `@1279` grid stretta | DELETE (sostituito da stack unico) |
| `flyer/styles/shell.css:38` | `@899` flex column | → `1023` |
| `flyer/styles/manual.css:133` | `@640` | → `767` |
| `ai/AIConsole.css:315` | `@768` bottom drawer | → `767` |
| `ai/AIProviderBadge.css:195` | `@768` | → `767` |
| `pages/AdminDashboard.tsx:678` | `@768` | → `767` |
| `pages/AdminDashboard.tsx:696` | `@480` | KEEP + commento |
| `pages/AdminDashboard.tsx:687,703` | `nth-child(7),(8){display:none}` | DELETE |
| `pages/AdminDashboard.tsx:688` | `.admin-table-wrap{overflow-x:hidden}` | `overflow-x:auto` |
| `pages/LoginPage.tsx:313` | `@900` auth→1col | → `1023` |
| `pages/HomePage.tsx:429` | `@900` bento 4→2 | → `1023` |
| `pages/HomePage.tsx:430` | `@600` bento 2→1 | → `767` |
| `crm/crm.css:60` | `@900` webdata→1col | ✅ → `1023` |
| `crm/crm.css:151,167` | `@768` | ✅ → `767` |
| `crm/crm.css:94` | `minmax(340px,1fr)` palette | ✅ `minmax(min(340px,100%),1fr)` |
| `crm/crm.css:80` | `.crm-doc-row` no wrap (doc info + 2 bottoni) | `@767`: `flex-wrap:wrap` + `.crm-doc-info{flex:1 1 100%;min-width:0}` |
| `flyer/FlyerPreview.tsx:12-41` | scala fissa 380 | auto-fit ResizeObserver |
| `LogoAiPanel.css` | — | + `@media(max-width:767px)` block (vedi §9) |

**Fix aggiuntivi (bug responsive, fuori migrazione breakpoint):**

| File:line | Problema | Fix |
|---|---|---|
| `GlobalStyles.tsx:214` | grid-item `.workspace` `min-width:auto` → contenuti larghi (URL lunghi) allargano il track grid → `overflow-x:hidden` clippa tutto senza scrollbar | ✅ `.workspace{min-width:0}` |
| `crm/crm.css:26-27` | `.crm-field` flex: valore URL senza spazi min-content ≈ larghezza URL → brief/sezioni tagliati a 320-375px | ✅ `.crm-field{min-width:0}` + `.crm-field-value{min-width:0;overflow-wrap:anywhere;word-break:break-word}` |
| `crm/crm.css:81` | `.crm-doc-info` `flex:1` senza `min-width:0` (titoli doc lunghi) | ✅ `.crm-doc-info{min-width:0;overflow-wrap:anywhere}` |

## 5. Acceptance Criteria

- **AC-001**: Given viewport width 800px, When un utente apre `/app/editor`,
  Then `.mobile-topbar` è visibile e `.sidebar`/`.topbar` sono nascosti.
- **AC-002**: Given viewport width 1024px, When un utente apre `/app/editor`,
  Then `.sidebar` e `.topbar` sono visibili e `.mobile-topbar` è nascosto.
- **AC-003**: Given viewport width 769–1023px, When l'utente tocca l'hamburger,
  Then il drawer si apre con la stessa navigazione della sidebar desktop.
- **AC-004**: Given viewport width 800px nel flyer editor, When l'editor
  carica, Then `.editor-mobile-bar` (tab AI/Form) è visibile e il grid 3col
  non è attivo.
- **AC-005**: Given viewport width 800px nel card editor, When l'editor
  carica, Then `[data-testid="card-editor-tabs"]` è visibile; a 1280px non lo è.
- **AC-006**: Given viewport width 375px nel logo editor, When il pannello AI
  renderizza i concept, Then la griglia concept è a 1 colonna e il menu
  variants usa tutta la larghezza (override `min-width:18rem`).
- **AC-007**: Given viewport 375px e 1440px, When una card identica viene
  renderizzata, Then il ratio font/card resta identico (test parity esistente).
- **AC-008**: Nessun file CSS mantiene valori storici non canonici
  (`900/899/880/1100/1180/1200/1279/1400/640/680/760` come `max-width`), salvo
  `@1180` topbar e l'eccezione `@480`.
- **AC-009**: Given un documento preventivo aperto a viewport 769–1023px,
  When l'utente salva/esporta, Then i controlli mobile sono disponibili
  (`.editor-mobile-actions`/`.editor-mobile-bar`).

## 6. Test Automation Strategy

- **Test Levels**: Unit (Vitest + RTL + jsdom), End-to-End (Playwright).
- **Frameworks**: Vitest per unit; Playwright per E2E (esistenti).
- **Unit — aggiornare**:
  - `card/__tests__/CardEditor.responsive.test.tsx:54,67`: mock
    `(max-width: 900px)` → `(max-width: 1023px)`.
  - `components/__tests__/Layout.collapsed-styling.test.tsx` (source-based):
    assert assenza blocco `@900` con `.sidebar{display:none}`; presenza
    `.topbar{display:none}` dentro blocco `@1023`.
- **Unit — nuovi**:
  - `hooks/__tests__/useMediaQuery.test.ts`: test costanti
    `MQ_SHELL === '(max-width: 767px)'`, `MQ_WORKSPACE === '(max-width: 1023px)'`.
  - `flyer/__tests__/FlyerPreview.test.tsx`: default width invariata; con
    FakeResizeObserver il preview si restringe al containerW.
  - `components/__tests__/Layout.mobile-shell.test.tsx`: mock matchMedia a
    1024 → sidebar presente, mobile-topbar assente; a 800 → invertito.
- **E2E — nuovo** `e2e/breakpoints.spec.ts`: casi AC-001..AC-007.
- **E2E — regressioni da mantenere verdi**:
  `layout-mobile.spec.ts` (375px), `topbar.spec.ts` (1280px),
  `card-mobile-desktop-parity.spec.ts` (390/1440).
- **CI**: gate standard `npm run typecheck && npm run test`; e2e mirati
  manuali pre-merge. Nessun `.skip`/`xit`.

## 7. Rationale & Context

- Il dead zone 769–900 nasce da due soglie disallineate in `GlobalStyles.tsx`:
  la sidebar sparisce a 900 (riga 551) ma la mobile-topbar compare a 768
  (riga 553). Unificare a 1023 elimina l'intervallo e allinea il shell ai
  3-col editor che collassano già a 1023–1100.
- La topbar desktop e la mobile-topbar duplicano il tema e le azioni save;
  nascondere la topbar nello stesso blocco evita la doppia header senza
  aggiungere logica JS.
- I gradini `editor-col` 380/320/280 sono responsabilità di layout "media"
  non critiche: un clamp fluido le elimina senza perdere usabilità.
- La regola "conditional render" si applica solo al shell (DOM pesante). I
  pannelli mobile dei editor pesano pochi nodi e hanno già `display:none`
  di default: il CSS basta (principio YAGNI, CSS nativo prima di JS).
- L'eccezione 480 resta perché riguarda densità di componenti piccoli
  (cover-grid, stat admin) dove "tutto ≤767" cambierebbe layout tablet senza
  beneficio.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: Nessuna — migrazione puramente client-side.

### Third-Party Services
- **SVC-001**: Nessuno nuovo. Nessuna nuova dipendenza npm (CON-001).

### Infrastructure Dependencies
- **INF-001**: Browser target: supporto CSS `clamp()`, `min()`,
  `ResizeObserver`, CSS `zoom` (fallback `transform: scale` già in
  `CardPreviewSurface`). Stessa matrice browser attuale del progetto.

### Data Dependencies
- **DAT-001**: Nessun dato coinvolto. Nessun cambiamento a `db/schema.ts`,
  `api/index.ts`, localStorage shape.

### Technology Platform Dependencies
- **PLT-001**: React 18 + Vite, `useMediaQuery` esistente (invariato).

### Compliance Dependencies
- **COM-001**: Accessibility: i pulsanti mobile mantengono `aria-label`; il
  drawer conserva overlay e close. Nessun contenuto funzionale diventa
  invisibile senza alternativa (AC-003).

## 9. Examples & Edge Cases

### Shell switch unificato (REQ-001/002)

```css
/* prima */
@media(max-width:900px){.app-shell{grid-template-columns:1fr}.sidebar{display:none}…}
@media(max-width:768px){.mobile-topbar{display:flex}…}

/* dopo — unico blocco shell a 1023 */
@media(max-width:1023px){
  .app-shell{grid-template-columns:1fr}
  .sidebar{display:none}
  .topbar{display:none}
  .preview-wrap{min-height:60vh;overflow-x:hidden}
  .top-actions{flex-wrap:wrap;gap:6px}.top-actions button span{display:none}
}
```

### Editor-col fluido (REQ-004)

```css
.editor-col{width:clamp(280px,30vw,380px);flex-shrink:0;position:relative;transition:width .25s ease;overflow:hidden}
```

### LogoAiPanel mobile (REQ-005)

```css
@media(max-width:767px){
  .logo-ai-panel{padding:1rem;max-width:none}
  .logo-ai-concepts{grid-template-columns:1fr}
  .logo-ai-variants-menu{min-width:0;width:100%;left:0;right:0} /* override 18rem (LogoAiPanel.css:459) */
}
```

### Flyer preview auto-fit (REQ-007)

```tsx
const fitRef = useRef<HTMLDivElement | null>(null);
const [containerW, setContainerW] = useState(FLYER_PREVIEW_REF_WIDTH); // 380
useEffect(() => {
  const el = fitRef.current;
  if (!el) return;
  const measure = (w: number) => { if (w > 0) setContainerW(w); };
  measure(el.clientWidth);
  if (typeof ResizeObserver === 'undefined') return; // jsdom guard (PAT-001)
  const ro = new ResizeObserver((es) => measure(es[0]?.contentRect?.width ?? 0));
  ro.observe(el);
  return () => ro.disconnect();
}, []);
const previewW = Math.min(containerW, FLYER_PREVIEW_REF_WIDTH);
```

### Edge cases

- **Viewport 1024 esatto**: `MQ_WORKSPACE` è `max-width:1023px` → 1024 = desktop
  (sidebar + topbar). Test AC-002.
- **Resize live** 1024→800: il drawer resta chiuso; la sidebar sparisce dal
  DOM (conditional render), la mobile-topbar compare. Nessuna race con lo
  stato `drawerOpen`.
- **jsdom senza ResizeObserver** (FlyerPreview test): guard PAT-001 → default
  `REF_WIDTH`, nessun crash.
- **Tabella admin a 600px**: colonne 7/8 non più nascoste; scroll orizzontale
  (AC implicito) — verificare che `.admin-table-wrap` abbia `overflow-x:auto`
  e la tabella `table-layout:fixed;min-width` adeguata.

## 10. Validation Criteria

1. `grep -rn "max-width: *9\|max-width: *8\|max-width: *11\|max-width: *12\|max-width: *14\|max-width: *6"` su `src/**/*.css` e template CSS in `.tsx` non restituisce i valori storici (esclusi `@1180` topbar e `@480` eccezione).
2. Nessuna occorrenza di `useMediaQuery('(max-width: 900px)')` o analoghi nel codice (resta solo `useIsMobileShell`/`useIsMobileWorkspace`).
3. `npm run typecheck && npm run test` verdi.
4. E2E `breakpoints.spec.ts` verde + regressioni `layout-mobile`, `topbar`,
   `card-mobile-desktop-parity` verdi.
5. Screenshot manuale a 800px (editor preventivo) mostra una sola header
   (mobile-topbar), nessuna sidebar, tab AI/Form attivi.

## 11. Related Specifications / Further Reading

- `docs/spec/spec-design-flyer-refactor-preview-ai.md` — layout preview flyer.
- `docs/spec/spec-design-ai-harness-upgrade.md` — rail AI (`AIConsole`).
- `docs/agent-gotchas.md` — §12 dev proxy, §23 storage flat (non toccati).
- `AGENTS.md` → "Responsive Patterns" (da aggiornare a migrazione completata).
- `docs/to-be-done.md` → "Audit responsiveness" (da aggiornare a migrazione completata).
