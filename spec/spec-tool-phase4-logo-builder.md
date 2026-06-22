---
title: Phase 4 — Logo SVG builder (no AI nella v1)
version: 1.0
date_created: 2026-06-21
owner: Giovanni Cidu
tags: [tool, logo, svg, builder, no-ai, lucide, watermark-pending]
---

# Introduction

La fase 4 introduce il logo builder. A differenza di Looka (AI puro),
questa v1 usa un **SVG builder templated**: l'utente compone il logo da
testo + icona (libreria lucide-react) + forma + colore + layout. Zero
costo AI, zero timeout Vercel, output realmente editabile in
Illustrator/Inkscape dopo l'export.

Lo schema include campi per AI generation (`brief`, `concepts`,
`selected`, `edits`) ma questi restano **dormienti** nella v1. Saranno
attivati in v2 quando l'utente passa a Vercel Pro e configura
`REPLICATE_API_TOKEN`.

Il builder produce SVG vettoriale pulito (niente metadata, viewBox
standardizzato, raggruppamenti semantici). Export PNG via canvas
`toDataURL`.

## 1. Purpose & Scope

**Purpose**: permettere all'utente di comporre un logo professionale
senza competenze di design, con output SVG editabile ePNG ad alta
risoluzione.

**Scope**:
- Estensione `src/utils/documentSchemas.ts` con `logoSchema` + helper
  `createEmptyLogo()`, `createLogoTemplate(settore)`
- Nuovo file `src/utils/logoGenerator.ts` con:
  - `builderToSvg(builder: LogoBuilder): string`
  - `extractTexts(svg: string): string[]`
  - `replaceText(svg: string, oldText: string, newText: string): string`
  - `replaceColor(svg: string, oldColor: string, newColor: string): string`
  - `applyLayout(svg: string, layout): string`
  - `sanitizeSvg(svg: string): string`
  - `svgToPng(svg: string, size: number): Promise<Uint8Array>`
- Nuovo componente `src/components/LogoEditor.tsx` con 2 tab:
  - "Builder" (sempre attivo)
  - "AI Generation" (disabilitato con messaggio "Configura
    REPLICATE_API_TOKEN su Vercel per attivare" + link alla docs)
- Nuova dipendenza: `lucide-react` ^0.395.0 per libreria icone
- Estensione `src/components/Layout.tsx`: nuova voce sidebar "Loghi"
- Estensione `App.tsx`: view state `'logo'`

**Out of scope**:
- AI logo generation (Replicate) — out of scope v2 con Vercel Pro
- Brand book automatico (palette espansa, font pairing) — out of scope
  v2
- Mockup generator (logo su bigliettino, volantino, t-shirt) — out of
  scope v2
- Tier system e watermark — fase 5
- Modifica del `CollectionView` — fase 6

**Intended audience**: sviluppatore che implementa il logo builder;
reviewer che verifica i test e l'output SVG.

**Assumptions**:
- L'utente ha browser moderni con `DOMParser` per parsing SVG
  (compatibile tutti i browser supportati).
- `lucide-react` è tree-shakeable, solo le icone usate finiscono nel
  bundle.

## 2. Definitions

- **Logo**: documento `documentType='logo'` con `source` ('builder' |
  'ai'), `builder` (configurazione v1), `brief`, `concepts`, `selected`,
  `edits` (per v2 AI).
- **Builder**: configurazione del logo composto manualmente:
  - `primaryText`: testo principale (es. "Acme")
  - `tagline`: testo secondario opzionale (es. "Solutions")
  - `iconType`: `none` | `shape` | `monogram` | `lucide`
  - `iconGlyph`: per `monogram` (1-2 lettere), per `lucide` (nome
    icona es. "coffee")
  - `iconShape`: `circle` | `square` | `rounded` | `hex` (contorno
    dell'icona)
  - `primaryColor`, `secondaryColor`: hex
  - `fontFamily`: Inter (default), Georgia, system-ui
  - `layout`: `horizontal` | `vertical` | `stacked`
- **SVG sanitize**: rimozione di `<metadata>`, `<desc>`, commenti,
  normalizzazione `viewBox` a `0 0 W H`, rimozione `width`/`height`
  fissi (lascia solo `viewBox` per scalabilità).

## 3. Requirements, Constraints & Guidelines

- **REQ-001**: L'utente può creare un logo da vuoto o da un template
  per settore (`tech`, `food`, `fashion`, `professionista`).
- **REQ-002**: Tab "Builder" sempre attivo. Form con 9 campi:
  `primaryText`, `tagline`, `iconType`, `iconGlyph`, `iconShape`,
  `primaryColor`, `secondaryColor`, `fontFamily`, `layout`.
- **REQ-003**: Anteprima SVG live (debounce 200ms). L'SVG è renderizzato
  in un `<div dangerouslySetInnerHTML>` con sanitize lato rendering.
- **REQ-004**: Quando `iconType='none'`, i campi `iconGlyph` e
  `iconShape` sono hidden e disabilitati.
- **REQ-005**: Quando `iconType='lucide'`, appare una grid di icone
  (search box + 48 icone popolari pre-filtrate per categoria:
  business, food, tech, nature). Click sull'icona popola `iconGlyph`
  con il nome lucide.
- **REQ-006**: Quando `iconType='monogram'`, appare input per 1-2
  lettere (auto-uppercase).
- **REQ-007`: Layout switcher live: `horizontal` (icona a sinistra,
  testo a destra), `vertical` (icona sopra, testo sotto, tutto
  centrato), `stacked` (icona sopra, primaryText sotto, tagline
  sotto in piccolo).
- **REQ-008**: Export SVG (file `.svg`, download via Blob).
- **REQ-009**: Export PNG (3 size: 512×512, 1024×1024, 2048×2048).
  L'utente sceglie la size, l'export renderizza SVG → canvas → PNG.
- **REQ-010**: Tab "AI Generation" presente ma disabilitato. Click →
  toast "AI generation non disponibile nella v1. Configura
  `REPLICATE_API_TOKEN` su Vercel e upgrada a Pro. Vedi docs." + link
  a `/docs/logo-ai` (pagina da creare in fase 7).
- **REQ-011**: Salvataggio in collection tramite `dataService.saveDocument`
  con `documentType='logo'`.
- **SEC-001**: `primaryText` e `tagline` sanitizzati: escape XML (`&`
  → `&amp;`, `<` → `&lt;`, ecc.) prima di inserire nell'SVG.
- **SEC-002**: `iconGlyph` per `lucide` validato contro allowlist di
  48 nomi lucide. Rifiuta nomi non in lista (prevenzione injection).
- **SEC-003`: `primaryColor` e `secondaryColor` validati con regex
  `^#[0-9a-fA-F]{6}$`.
- **SEC-004**: SVG renderizzato in anteprima è sanitizzato
  (`sanitizeSvg`) prima di `dangerouslySetInnerHTML` per prevenire
  XSS.
- **CON-001**: Vercel Hobby: nessun endpoint AI nuovo. Endpoint
  `/ai/vector` NON esiste in v1.
- **CON-002**: `lucide-react` ^0.395.0 aggiunto a dependencies. Bundle
  ~30KB tree-shakeable (solo 48 icone usate).
- **CON-003**: SVG generato è validato da `DOMParser`: se il parsing
  fallisce, errore "SVG non valido, modifica la configurazione".
- **GUD-001**: Seguire `AGENTS.md` "Test — OBBLIGATORI": coverage
  ≥60% per i nuovi file.
- **GUD-002`: Seguire skill `vercel-react-best-practices`: lazy-load
  `LogoEditor`, memo preview.
- **GUD-003**: Seguire skill `frontend-design`: il logo builder non
  deve sembrare "Canva template". Scegliere typography, proporzioni,
  default colors con intenzione.
- **GUD-004**: Seguire skill `web-security` per sanitize SVG e
  validation input.
- **GUD-005**: Seguire skill `web-design-guidelines` per accessibilità:
  keyboard nav tra i tab, focus visibile, ARIA roles per tablist.
- **GUD-006`: Seguire AGENTS.md "API Schema Duplication": nessun
  impatto DB in questa fase (lo schema logo è salvato in `data` jsonb,
  come già fatto nelle fasi 1-3).
- **PAT-001**: Pattern sanitize SVG:
  ```ts
  function sanitizeSvg(svg: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    // Rimuovi <metadata>, <desc>, commenti
    doc.querySelectorAll('metadata, desc').forEach(el => el.remove());
    // Normalizza viewBox
    const root = doc.querySelector('svg')!;
    if (!root.getAttribute('viewBox')) {
      const w = root.getAttribute('width') || '100';
      const h = root.getAttribute('height') || '100';
      root.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }
    root.removeAttribute('width');
    root.removeAttribute('height');
    return new XMLSerializer().serializeToString(root);
  }
  ```
- **PAT-002**: Pattern escape XML:
  ```ts
  function escapeXml(s: string): string {
    return s.replace(/[<>&'"]/g, c => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
    }[c]!));
  }
  ```
- **PAT-003**: Pattern builder SVG:
  ```ts
  function builderToSvg(b: LogoBuilder): string {
    const iconSvg = renderIcon(b);  // ritorna "" o "<g>...</g>"
    const textSvg = renderText(b);  // ritorna "<text>...</text>"
    const W = 400, H = 200;  // default, layout-specific
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
      ${iconSvg}
      ${textSvg}
    </svg>`;
  }
  ```

## 4. Interfaces & Data Contracts

### Schema `src/utils/documentSchemas.ts` (estensione)

```ts
export const logoSchema = z.object({
  documentType: z.literal('logo'),
  id: z.string(),
  title: z.string().default(''),
  source: z.enum(['builder', 'ai']).default('builder'),
  builder: z.object({
    primaryText: z.string().max(50).default(''),
    tagline: z.string().max(50).default(''),
    iconType: z.enum(['none', 'shape', 'monogram', 'lucide']).default('none'),
    iconGlyph: z.string().max(20).default(''),
    iconShape: z.enum(['circle', 'square', 'rounded', 'hex']).default('circle'),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#01696F'),
    secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1a1a2e'),
    fontFamily: z.string().default('Inter'),
    layout: z.enum(['horizontal', 'vertical', 'stacked']).default('horizontal'),
  }),
  // Campi AI generation (dormienti nella v1)
  brief: z.string().default(''),
  concepts: z.array(z.string()).default([]),
  selected: z.number().int().min(-1).default(-1),
  edits: z.object({
    primaryText: z.string().default(''),
    primaryColor: z.string().default('#01696F'),
    secondaryColor: z.string().default('#1a1a2e'),
  }).default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Logo = z.infer<typeof logoSchema>;
export type LogoBuilder = Logo['builder'];

export function createEmptyLogo(): Logo { /* defaults */ }

export function createLogoTemplate(settore: 'tech' | 'food' | 'fashion' | 'professionista'): Logo {
  // 4 template con default colors + iconType + iconShape per settore
  // primaryText placeholder "Your Brand"
}
```

### Generatore `src/utils/logoGenerator.ts`

```ts
export function builderToSvg(b: LogoBuilder): string { /* vedi PAT-003 */ }
export function extractTexts(svg: string): string[] { /* DOMParser */ }
export function replaceText(svg: string, oldText: string, newText: string): string { /* regex su <text> */ }
export function replaceColor(svg: string, oldColor: string, newColor: string): string { /* regex su fill= */ }
export function applyLayout(svg: string, layout: 'horizontal' | 'vertical' | 'stacked'): string { /* re-render */ }
export function sanitizeSvg(svg: string): string { /* vedi PAT-001 */ }
export async function svgToPng(svg: string, size: number): Promise<Uint8Array> {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  await new Promise(r => img.onload = r);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, size, size);
  URL.revokeObjectURL(url);
  return new Uint8Array(await canvas.toBlob('image/png')!.arrayBuffer());
}

// Allowlist icone lucide (48 icone popolari)
export const LUCIDE_ICONS = [
  'coffee', 'utensils', 'wine', 'pizza', 'cake',  // food
  'code', 'cpu', 'database', 'cloud', 'terminal',  // tech
  'shirt', 'scissors', 'sparkles', 'gem', 'crown',  // fashion
  'briefcase', 'building', 'scale', 'stethoscope', 'palette',  // professionisti
  // ... 28 altre
] as const;
export type LucideIconName = typeof LUCIDE_ICONS[number];

export function isValidLucideIcon(name: string): name is LucideIconName {
  return (LUCIDE_ICONS as readonly string[]).includes(name);
}
```

### Componente `src/components/LogoEditor.tsx`

```tsx
interface LogoEditorProps {
  logo: Logo;
  onPatch: (path: string, value: any) => void;
  onExportSvg: () => void;
  onExportPng: (size: 512 | 1024 | 2048) => void;
  tier: 'free' | 'unlocked';
}

export default function LogoEditor(props: LogoEditorProps) {
  const [tab, setTab] = useState<'builder' | 'ai'>('builder');
  return (
    <div className="logo-editor">
      <div role="tablist">
        <button role="tab" aria-selected={tab === 'builder'} onClick={() => setTab('builder')}>Builder</button>
        <button role="tab" aria-selected={tab === 'ai'} onClick={() => setTab('ai')}>AI Generation</button>
      </div>
      {tab === 'builder' ? <BuilderPanel {...props} /> : <AIPanelDisabled />}
    </div>
  );
}
```

### Sidebar `Layout.tsx` (estensione)

Nuova voce "Loghi" con icona SVG logo ( sparkle o shape), chiama
`setView('logo')`.

### `App.tsx` — view state (estensione)

```ts
const [view, setView] = useState<'editor' | 'qr' | 'card' | 'flyer' | 'logo' | 'collection' | 'settings' | 'admin'>('editor');
```

## 5. Acceptance Criteria

- **AC-001**: Given utente loggato, When click "Loghi" sidebar, Then
  `LogoEditor` renderizzato con logo vuoto (`createEmptyLogo`), tab
  "Builder" attivo.
- **AC-002**: Given prima apertura, When utente vede banner "Template
  per settore", Then 4 bottoni (Tech, Food, Fashion, Professionista)
  caricano i rispettivi template.
- **AC-003**: Given `builder.primaryText=''`, When utente digita "Acme",
  Then anteprima si aggiorna (debounce 200ms) con "Acme" renderizzato
  nell'SVG.
- **AC-004**: Given `iconType='none'`, When utente cambia in `lucide`,
  Then appare grid di 48 icone con search box.
- **AC-005**: Given `iconType='lucide'` e `iconGlyph='coffee'`, When
  anteprima, Then l'icona coffee di lucide è renderizzata dentro la
  `iconShape` scelta (es. cerchio colorato).
- **AC-006**: Given `iconType='monogram'`, When utente digita "AC",
  Then `iconGlyph` diventa "AC" (auto-uppercase) e l'anteprima mostra
  "AC" centrato nella shape.
- **AC-007**: Given layout `horizontal`, When utente cambia in
  `stacked`, Then anteprima riaggiorna con icona sopra, primaryText
  sotto, tagline sotto in piccolo.
- **AC-008**: Given utente click "Esporta SVG", Then file `logo_<id>.svg`
  scaricato. Il file è validato da `DOMParser` come XML well-formed.
- **AC-009**: Given utente click "Esporta PNG 1024", Then file
  `logo_<id>_1024.png` scaricato alla risoluzione 1024×1024.
- **AC-010**: Given utente click tab "AI Generation", Then appare
  messaggio "AI generation non disponibile nella v1. Configura
  `REPLICATE_API_TOKEN` su Vercel e upgrada a Pro. Vedi docs." +
  link a `/docs/logo-ai`.
- **AC-011**: Given `primaryText='A<B>'`, When `builderToSvg` gira,
  Then l'SVG contiene `&lt;B&gt;` (escape XML) e NON `<B>` (XSS
  prevented).
- **AC-012**: Given `iconGlyph='evil-icon'` non in allowlist, When
  validazione, Then errore "Icona non valida. Scegli dalla lista.".
- **AC-013**: Given SVG renderizzato in anteprima, When `sanitizeSvg`
  gira, Then `<metadata>`, `<desc>`, commenti rimossi, `viewBox`
  normalizzato.
- **AC-014**: Given `npm run typecheck`, Then code 0.
- **AC-015`: Given `npm run test`, Then code 0 e tutti i nuovi test
  passano.

## 6. Test Automation Strategy

- **Test Levels**: Unit (schema, generator, sanitize),
  Integration (componente con anteprima).
- **Frameworks**: Vitest 4, React Testing Library 16, jsdom 29.
- **Test Data Management**: SVG di esempio hardcoded nei test. Mock
  `URL.createObjectURL` e `Image.onload` per i test PNG.
- **Coverage Requirements**: ≥60% per i nuovi file.

### File di test da creare

| File | Cosa copre |
|------|-----------|
| `src/utils/__tests__/documentSchemas.test.ts` (estensione) | parse OK per `logoSchema`, default values, helper `createEmptyLogo`, 4 template per settore |
| `src/utils/__tests__/logoGenerator.test.ts` | `builderToSvg` per ogni layout (3) × ogni iconType (4) = 12 combinazioni; `extractTexts` ritorna array corretto; `replaceText` modifica solo il testo specificato; `replaceColor` modifica solo il colore specificato; `sanitizeSvg` rimuove metadata/desc/commenti; `svgToPng` ritorna buffer non vuoto (mock Image); `isValidLucideIcon` accetta icone in lista e rifiuta altre |
| `src/components/__tests__/LogoEditor.test.tsx` | render iniziale con tab Builder attivo, click tab AI mostra messaggio disabilitato, click template settore, cambio iconType mostra/nasconde campi, cambio layout live, escape XML (input `<B>`), export SVG (mock Blob), export PNG 3 size, validazione iconGlyph non in allowlist |
| `src/components/__tests__/BuilderPanel.test.tsx` | grid 48 icone render, search box filtra, click icona popola `iconGlyph`, layout switcher, color picker, font family select |

### Test matrice

| AC | Test file |
|----|-----------|
| AC-001 | LogoEditor.test.tsx |
| AC-002 | LogoEditor.test.tsx |
| AC-003 | LogoEditor.test.tsx |
| AC-004 | BuilderPanel.test.tsx |
| AC-005 | logoGenerator.test.ts (builderToSvg + lucide) |
| AC-006 | BuilderPanel.test.tsx |
| AC-007 | logoGenerator.test.ts (applyLayout) |
| AC-008 | logoGenerator.test.ts (sanitizeSvg) + LogoEditor.test.tsx (export) |
| AC-009 | logoGenerator.test.ts (svgToPng) + LogoEditor.test.tsx |
| AC-010 | LogoEditor.test.tsx |
| AC-011 | logoGenerator.test.ts (escapeXml via builderToSvg) |
| AC-012 | logoGenerator.test.ts (isValidLucideIcon) |
| AC-013 | logoGenerator.test.ts (sanitizeSvg) |
| AC-014 | typecheck |
| AC-015 | test run |

## 7. Rationale & Context

**Perché SVG builder e non AI nella v1**:

L'utente vorrebbe Looka-style (AI puro), ma:
1. Vercel Hobby ha timeout 10s. Recraft-V3 impiega 10-30s per 3 SVG.
2. Replicate addebita anche su sync mode fallita per timeout.
3. AI image generation per loghi ha qualità tipografica variabile
   (testo storpiato comune).
4. L'utente ha 0 clienti, quindi 0 budget AI.

L'SVG builder dà:
- Zero costo AI
- Zero timeout Vercel
- Output editabile (SVG vettoriale vero)
- Qualità garantita (composizione deterministica)

Il tab "AI Generation" resta presente ma disabilitato, per comunicare
che la feature è pianificata e rendersiconto del perché non è attiva
(need Pro + token).

**Perché 48 icone lucide e non tutte**:

Lucide ha 1000+ icone. Mostarle tutte in una grid è
- Scroll infinito, UX pessima
- Bundle più pesante anche tree-shakeable (lookup table)

48 icone pre-filtrate per categoria (business, food, tech, nature,
fashion, professionisti) coprono il 90% dei casi reali per il target
(piccole attività locali). Search box filtra per nome.

**Perché 4 layout e non di più**:

3 layout (horizontal, vertical, stacked) + opzione "no icona"
coprono il 95% dei loghi di piccole attività. Aggiungere layout
complessi (emblem, lettermark puro, wordmark) richiederebbe UI
molto più complessa per ogni variante.

**Perché 4 settori per template e non 11 come `defaultTemplates.js`**:

I template per settore del logo sono placeholder ("Your Brand" +
icona settore + colori default). 4 settori coprono i verticali del
business plan (ristoranti, tech, fashion, professionisti). Aggiungerne
altri in v2 se la domanda lo richiede.

**Perché sanitize SVG prima di `dangerouslySetInnerHTML`**:

L'SVG è generato dalla nostra funzione `builderToSvg`, ma:
- L'utente potrebbe aver caricato un SVG custom in v2 (AI concepts)
- Difesa in profondità: anche se il nostro builder è sicuro, sanitize
  previene XSS se il flusso cambia

`DOMParser` + `XMLSerializer` è l'approccio standard per sanitize SVG
lato client. Rimuove `<script>` (se presente), normalizza attributi.

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: Nessuna nuova integrazione esterna (SVG builder
  client-side).

### Third-Party Services
- **SVC-001**: Nessuna nuova dipendenza di servizio.
- **SVC-002**: Lucide Icons (libreria open source, npm package, no
  API call).

### Infrastructure Dependencies
- **INF-001**: Vercel Hobby — nessun endpoint nuovo, nessun timeout
  problema.
- **INF-002**: Neon Postgres — `data` jsonb con SVG incluso (max
  ~5KB per SVG, ben sotto il limite jsonb).

### Data Dependencies
- **DAT-001**: localStorage `precisionQuote_documents:v1` (riuso).
- **DAT-002**: Tabella DB `documents` con `document_type='logo'`.

### Technology Platform Dependencies
- **PLT-001**: `lucide-react` ^0.395.0 — React components per icone,
  tree-shakeable.
- **PLT-002**: `DOMParser` + `XMLSerializer` — API native browser.
- **PLT-003**: Canvas API per `svgToPng`.

### Compliance Dependencies
- **COM-001**: WCAG AA contrast 4.5:1 per testo su bgColor (preview).
- **COM-002`: Nessun PII raccolto (logo builder non ha campi PII).

## 9. Examples & Edge Cases

### Edge case 1: `primaryText` vuoto

```ts
// primaryText = ""
// builderToSvg ritorna SVG con solo icona, nessun <text>
// anteprima mostra solo icona, layout non cambia
```

### Edge case 2: `primaryText` con 50 caratteri (max)

```ts
// primaryText = "Supercalifragilistichespiralidoso Worldwide Solutions Ltd"
// SVG text si adatta: fontSize scala per stare nel viewBox
// → antprima mostra testo piccolissimo, l'utente vede e riduce
```

### Edge case 3: `tagline` più lunga di `primaryText`

```ts
// primaryText = "Acme"
// tagline = "International Worldwide Solutions Corporation"
// layout stacked: tagline scala per stare nella width
// → antprima proporzioni asimmetriche, l'utente vede e shortens
```

### Edge case 4: Cambio `fontFamily` a Georgia

```ts
// fontFamily = "Georgia, serif"
// SVG <text> usa font-family attribute
// anteprima renderizza con Georgia (se installato, fallback serif)
// export PNG via canvas: canvas NON ha accesso ai font system,
//   usa font fallback di default (Arial)
// → export PNG può avere font diverso dall'anteprima
// → workaround: caricare font via @font-face in document,
//   canvas userà i font caricati
```

Questo edge case richiede documentazione per l'utente: "Per export
PNG con font custom, assicurati che il font sia caricato nella pagina
(prima anteprima)."

### Edge case 5: `iconShape='hex'` con `iconType='lucide'` e icona
`coffee` (rettangolare)

```ts
// icona coffee ha aspect ratio ~1:1, shape hex ha 6 lati
// → l'icona viene centrata e scalata per stare dentro l'hex
// → whitespace attorno all'icona dentro l'hex
// → accettabile, non tentare di croppare
```

### Edge case 6: Export PNG 2048 con SVG complesso (500 elementi)

```ts
// svgToPng con size=2048
// canvas 2048×2048 = 16MB memoria
// → browser moderni OK, browser vecchi possono crashare
// → se canvas.toBlob throw (QuotaExceeded), catch e mostra errore
//   "Riduci la size a 1024 o 512."
```

### Edge case 7: Tab "AI Generation" click in successione rapida

```ts
// utente click AI tab, poi Builder tab, poi AI tab di nuovo
// → ogni click AI mostra lo stesso toast, ma non devono accumularsi
// → ToastContainer dedup per messaggio (gia gestito da useToast)
```

## 10. Validation Criteria

Prima di considerare la fase 4 completata, verificare:

1. `npm run typecheck` code 0.
2. `npm run test` code 0, tutti i nuovi test passano.
3. `git diff src/utils/documentSchemas.ts` mostra `logoSchema` +
   helper.
4. `git diff package.json` mostra `"lucide-react": "^0.395.0"` in
   dependencies.
5. `git status` mostra i nuovi file:
   - `src/utils/logoGenerator.ts`
   - `src/components/LogoEditor.tsx`
   - `src/components/BuilderPanel.tsx` (se estratto)
   - `src/utils/__tests__/logoGenerator.test.ts`
   - `src/components/__tests__/LogoEditor.test.tsx`
   - `src/components/__tests__/BuilderPanel.test.tsx`
6. `git diff src/components/Layout.tsx` mostra nuova voce "Loghi".
7. `git diff App.tsx` mostra view state `'logo'` + lazy-load
   `LogoEditor`.
8. Manuale: `npm run dev`, loggare, click "Loghi", creare logo con
   "Acme" + icona coffee, verificare anteprima live, export SVG
   (aprire in browser o Inkscape), export PNG 1024.
9. Manuale: click tab "AI Generation", verificare messaggio
   disabilitato con link docs.
10. Manuale: test XSS — input `primaryText='<script>alert(1)</script>'`,
    verificare che l'anteprima mostri testo escaped e NON esegua
    script.

## 11. Related Specifications / Further Reading

- `spec/spec-process-phase0-autosave-fix.md` — auto-save
- `spec/spec-tool-phase1-qr-code.md` — pattern schema, sidebar, lazy
  load
- `spec/spec-design-phase2-business-card.md` — `logoUrl` del
  bigliettino può puntare a un logo salvato in collection
- `spec/spec-design-phase3-flyer.md` — futura integrazione logo nel
  volantino
- `spec/spec-data-phase5-tier-system.md` — watermark PNG export,
  risoluzione gate
- `spec/spec-architecture-phase6-unified-collection.md` — visualizzazione
  loghi in CollectionView
- `AGENTS.md` — regole test, localStorage, Vercel routing
- Skill `frontend-design` — design intenzionale del builder
- Skill `vercel-react-best-practices` — lazy-load, memo
- Skill `web-security` — sanitize SVG, escape XML, allowlist icone
- Skill `web-design-guidelines` — accessibilità tablist

### Out of scope v2 (riferimento futuro)

- **AI logo generation (Replicate)**: richiede Vercel Pro per timeout
  60s o Deno Deploy proxy. Costo AI €0.10-0.30 per 3 concept SVG.
- **Brand book automatico**: palette espansa, font pairing, mockup
  generator.
- **Mockup generator**: logo su bigliettino, volantino, t-shirt, segnaletica.

### Prossima fase

Dopo il completamento della fase 4, procedere con
`spec/spec-data-phase5-tier-system.md` (Tier system free+watermark+unlock
code).

## Note: Logo nelle card

I logo creati nel logo builder possono essere usati come ront.logoUrl nelle card. Pattern: il logo builder genera un''immagine base64 che l''utente carica nel card editor tramite il file input esistente. In futuro, un dropdown ''Usa logo salvato'' puo riusare dataService.getDocuments(email, ''logo'').
