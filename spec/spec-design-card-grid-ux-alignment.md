---
title: Card Grid Editor UX & QR Resilience
version: 1.0
date_created: 2026-07-03
last_updated: 2026-07-03
owner: PrecisionQuote frontend
tags: [design, card, grid, ux, ai]
---

# Introduction

Il modulo Business Card è stato refactorato in modo che la **griglia CSS sia l'unico layout engine**. Il toggle "Griglia ON/OFF" controlla solo la visibilità delle guide, non il render path. Questa spec affronta i problemi residui di usabilità del grid editor e il clipping del QR quando le celle vengono ridotte.

## 1. Purpose & Scope

Definire i requisiti per:

- **UX del grid editor**: label chiare, preset significativi, separazione social/contatti.
- **Controllo allineamento per elemento**: permettere all'utente (e all'AI) di specificare l'allineamento orizzontale e verticale di ogni elemento nella sua cella grid.
- **Resilienza QR**: il QR non deve mai essere tagliato quando la cella è più piccola della dimensione nominale; deve scalare mantenendo l'aspect ratio.
- **AI awareness**: il system prompt e lo schema di merge devono riflettere il nuovo modello "grid sempre attiva" e l'uso dell'allineamento per cella.

## 2. Definitions

| Termine | Definizione |
|---------|-------------|
| `CardGrid` | Struttura `{ cols, rows, elements }` che descrive la griglia CSS di un lato della card. |
| `GridElementKey` | Chiave di un elemento posizionabile: `photo`, `name`, `title`, `company`, `logo`, `qr`, `contacts`, `socials`, `services`. |
| `Cell alignment` | Allineamento di un elemento all'interno della sua cella: orizzontale (`left`/`center`/`right`) e verticale (`top`/`center`/`bottom`). |
| `qrSize` | Dimensione nominale del QR in flexbox-mode: `small` (84px), `medium` (120px), `large` (160px). |

## 3. Requirements, Constraints & Guidelines

### UX Grid Editor

- **REQ-UX-001**: Il select "Preset griglia" deve avere un'opzione placeholder leggibile, es. "Seleziona un preset", non simboli come `,` o `:`.
- **REQ-UX-002**: Il select "Elemento selezionato" deve avere un'opzione placeholder leggibile, es. "Nessun elemento selezionato", non `:`.
- **REQ-UX-003**: Il preset retro deve includere `contacts`, `services`, `qr` e `socials` come elementi separati, così l'utente può muoverli/ridimensionarli in modo indipendente.
- **REQ-UX-004**: I nomi dei preset devono descrivere il risultato visivo, non usare abbreviazioni o nomi tecnici.

### Allineamento per elemento

- **REQ-ALI-001**: Ogni elemento grid deve poter avere un allineamento orizzontale (`left`, `center`, `right`) e verticale (`top`, `center`, `bottom`).
- **REQ-ALI-002**: L'allineamento di default deve essere `center`/`center` per immagini e QR, `left`/`center` per testo/contatti/socials.
- **REQ-ALI-003**: L'UI del grid editor deve mostrare due controlli di allineamento quando un elemento è selezionato.
- **REQ-ALI-004**: L'AI deve poter ricevere e applicare l'allineamento per elemento dalle istruzioni dell'utente.

### QR clipping

- **REQ-QR-001**: Il QR renderizzato in una cella grid non deve mai essere tagliato: se la cella è più piccola della dimensione nominale, il QR deve scalare in modo proporzionale (`max-width:100%; max-height:100%`).
- **REQ-QR-002**: Il QR deve mantenere aspect ratio 1:1.
- **REQ-QR-003**: Il frame, la label e il wordmark sotto il QR devono rimanere visibili e non uscire dalla cella.

### AI awareness

- **REQ-AI-001**: Il system prompt card AI deve essere aggiornato per riflettere che la griglia è **sempre** il layout engine, quindi muovere/ridimensionare elementi significa modificare `grid.elements`.
- **REQ-AI-002**: Il system prompt deve spiegare che allargare una cella ingrandisce visivamente l'elemento (foto/logo/QR), mentre restringerla lo rimpicciolisce.
- **REQ-AI-003**: `aiCardInputSchema` e `cardMerge.ts` devono supportare l'allineamento per elemento e ignorare/deprecare `front.useGrid`/`back.useGrid` come master switch.

## 4. Interfaces & Data Contracts

### Schema aggiornato `CardGridElement`

```ts
export interface CardGridElement {
  x: number;
  y: number;
  w: number;
  h: number;
  alignH?: 'left' | 'center' | 'right';
  alignV?: 'top' | 'center' | 'bottom';
}
```

### Schema AI input (estensione)

```ts
grid: {
  elements: {
    photo?:  { x, y, w, h, alignH?, alignV? };
    name?:   { x, y, w, h, alignH?, alignV? };
    // ... etc
  }
}
```

### CSS mapping

Gli stili di allineamento sono applicati inline dalle celle (via `gridPlacement()`). Il CSS dei componenti **non** deve sovrascrivere `align-items`/`justify-content`/`text-align` sulle celle testuali, altrimenti i controlli di allineamento diventano inutili.

| alignH | CSS |
|--------|-----|
| left   | `justify-content: flex-start; text-align: left` |
| center | `justify-content: center; text-align: center` |
| right  | `justify-content: flex-end; text-align: right` |

| alignV | CSS |
|--------|-----|
| top    | `align-items: flex-start` |
| center | `align-items: center` |
| bottom | `align-items: flex-end` |

## 5. Acceptance Criteria

- **AC-001**: Given l'utente apre il grid editor, When guarda il select preset, Then vede "Seleziona un preset" e non `, seleziona preset:`.
- **AC-002**: Given l'utente apre il select elemento, Then vede "Nessun elemento selezionato" e non `:`.
- **AC-003**: Given il preset retro viene applicato, Then `backGrid.elements` contiene `contacts`, `services`, `socials` e `qr` come elementi separati.
- **AC-004**: Given una cella QR viene ridotta a 1×1 in una griglia 4×4, Then il QR renderizzato non è tagliato e rimane quadrato.
- **AC-005**: Given l'utente seleziona l'elemento `name`, Then appaiono controlli per allineamento orizzontale e verticale.
- **AC-006**: Given l'AI riceve l'istruzione "centra il nome in alto", Then aggiorna `grid.elements.name.alignH='center'` e `alignV='top'`.
- **AC-PAR-001**: Given la preview mostra il fronte con foto+testo+logo, Then l'export SVG/PDF/PNG posiziona gli stessi elementi nelle stesse celle (la preview è la sorgente di verità per il layout).
- **AC-PAR-002**: Given il retro ha `contacts` in una cella stretta, Then l'email viene wrappata e non tagliata con ellissi nella preview e nell'export.
- **AC-PAR-003**: Given l'export SVG/PDF/PNG del retro, Then mantiene header "Contatti" + wordmark, QR, contatti e social separati come nella preview.

## 6. Preview / Export Parity

### 6.1 Single source of truth

Il layout di entrambi i lati della card è definito da `card.grid` (fronte) e `card.backGrid` (retro). Sia `CardPreview.tsx` che i generatori SVG/PDF/PNG devono usare questi oggetti come unica sorgente. Non devono esistere branch flexbox paralleli che producano layout diversi.

### 6.2 Front parity checklist

| Elemento | Preview (`CardPreview.tsx`) | Export SVG (`svgRenderer.ts`) | Export PDF (`pdfExport.ts`) |
|----------|-----------------------------|-------------------------------|-----------------------------|
| `photo`  | `<img>` dentro cella grid, `object-fit: cover` | `<image>` taglia nella cella corrispondente | `pdfmake` image nelle coordinate della cella |
| `name`   | `<div class="card-name">` in cella grid | `<text>` con font-size scalato | testo nelle coordinate della cella |
| `title`  | `<div class="card-title">` in cella grid | `<text>` colore accent | testo nelle coordinate della cella |
| `company`| `<div class="card-company">` in cella grid | `<text>` | testo nelle coordinate della cella |
| `logo`   | `<img class="card-logo grid">` in cella grid | `<image>` in cella corrispondente | image nelle coordinate della cella |

### 6.3 Back parity checklist

| Elemento | Preview (`CardPreview.tsx`) | Export SVG (`svgRenderer.ts`) | Export PDF (`pdfExport.ts`) |
|----------|-----------------------------|-------------------------------|-----------------------------|
| Header   | `.card-back-header` sopra il body grid | `<text>` CONTATTI + wordmark | header nelle coordinate top |
| `contacts` | `.card-grid-cell--text` con `.card-back-line` | colonne di contatti a sinistra | contatti nella cella grid |
| `services` | `.card-grid-cell--text` con `.card-back-services` | lista servizi separata | servizi nella cella grid |
| `qr`     | `.card-grid-cell--qr` con SVG QR scalato | QR a destra con size `qrSize` | QR nella cella grid |
| `socials`| `.card-grid-cell--text` con `.card-back-socials` | riga social sotto i contatti | social nella cella grid |

### 6.4 Readability fixes in export

- L'email e gli altri valori di contatto **non devono** essere forzati su una singola riga con `white-space: nowrap` quando la cella grid è stretta.
- Nella preview i valori di contatto in grid-mode usano `white-space: normal; overflow-wrap: break-word; word-break: normal`.
- Nell'export SVG/PDF, se il valore eccede la larghezza disponibile, deve andare a capo usando linee multiple (non troncato con ellissi). Il wrapper usato per lo SVG split a spazi/slash con `wrapTextAtWhitespace` per mantenere le URL integre.
- I social devono usare `overflow-wrap: break-word` e **mai** `word-break: break-word`, per evitare che URL lunghi vengano spezzati carattere per carattere.

### 6.5 Implementation notes

- `src/utils/card/svgRenderer.ts`: `buildFrontSvg` e `buildBackSvg` leggono direttamente `card.grid` e `card.backGrid`. Ogni elemento è posizionato con `cellW = pxW / cols`, `cellH = pxH / rows`. Photo/logo usano `preserveAspectRatio` con cover/contain. Testo rispetta `alignH`/`alignV`. Il retro mantiene header, contatti in `contacts`, servizi in `services`, QR scalato in `qr`, social in `socials`. I valori di contatto usano `dominant-baseline="text-before-edge"` per un allineamento verticale prevedibile.
- `src/utils/card/pngExport.ts`: il PDF 10-up usa il raster PNG generato dallo SVG. La rotazione del foglio A4 landscape viene applicata direttamente nello SVG tramite `buildCardSvg(..., { rotate: 90 })`, così il canvas non deve ruotare l'immagine raster (evita distorsioni e semplifica il rendering).
- `src/components/card/cardPreviewSide.css`: le celle testuali non forzano più `align-items`/`justify-content`, permettendo agli stili inline di `gridPlacement()` di controllare l'allineamento. Contatti in grid-mode usano `flex-wrap: wrap` e `.card-back-val` sovrascritto con wrapping.

## 7. Test Automation Strategy

- **Unit**: aggiornare `documentSchemas.test.ts` per validare `alignH`/`alignV` opzionali.
- **Component**: aggiungere test in `CardPreview.test.tsx` per verificare che l'allineamento si rifletta nelle classi CSS inline.
- **E2E**: aggiungere in `e2e/card-grid-behavior.spec.ts` un test che riduce la cella QR e verifica che `getBBox` del QR non superi i bounds della cella.
- **Coverage**: ogni nuovo file/funzione >= 60%.

## 8. Rationale & Context

Il passaggio a grid come unico layout engine ha reso possibile muovere e ridimensionare elementi, ma ha introdotto limiti:

1. Gli elementi erano forzati a `align-items:center; justify-content:center`, togliendo controllo all'utente.
2. Il QR veniva stirato o tagliato perché non aveva un `max-*` di contenimento.
3. Le label placeholder usavano simboli poco comprensibili.
4. L'AI ancora ragionava in termini di `useGrid` booleano.
5. La preview e l'export non erano perfettamente allineati: l'export SVG/PDF usava ancora un layout "a colonne" hardcoded mentre la preview usava la griglia.

Aggiungere allineamento per elemento risolve (1) e apre all'AI comandi naturali come "metti il logo in basso a destra". La parity preview/export garantisce che ciò che l'utente vede nell'editor sia esattamente ciò che riceve in PDF/PNG/SVG.

## 9. Dependencies & External Integrations

Nessuna dipendenza esterna. Si usano solo React, CSS Grid/Flexbox, Zod e il parser AI esistente.

## 10. Examples & Edge Cases

### Esempio: allineamento nome in alto a sinistra

```ts
card.grid.elements.name = {
  x: 2, y: 0, w: 2, h: 1,
  alignH: 'left',
  alignV: 'top',
};
```

CSS risultante sulla cella:
```css
justify-content: flex-start; /* orizzontale: sinistra */
align-items: flex-start;     /* verticale: alto */
text-align: left;
```

### Edge case: QR in cella 1×1

```ts
card.backGrid.elements.qr = { x: 3, y: 0, w: 1, h: 1 };
card.back.qrSize = 'large'; // 160px nominale
```

Con `max-width:100%; max-height:100%`, il QR sarà ridotto alla dimensione della cella ma quadrato.

### Edge case: email lunga in cella stretta

```ts
card.back.email = 'mario.rossi.da.vimercate@agenzia-immobiliare-milano.it';
card.backGrid.elements.contacts = { x: 0, y: 0, w: 2, h: 4 };
```

Nella preview e nell'export l'email deve andare a capo alla fine della riga (overflow-wrap) senza spezzare l'indirizzo carattere per carattere (word-break: normal).

## 11. Validation Criteria

- `npm run typecheck` passa.
- `npm run test -- --run` passa (tutti i test).
- Screenshot Playwright del grid editor mostra label chiare.
- Screenshot di QR ridotto non mostra clipping.
- Screenshot di nome allineato in alto a sinistra mostra il testo in quella posizione.
- Screenshot preview retro vs export PDF/PNG mostrano lo stesso layout e l'email leggibile.

## 12. Related Specifications / Further Reading

- `spec/spec-design-phase2-2-card-refactor.md`
- `spec/spec-design-card-refactor-submodules.md`
- `src/utils/card/previewHelpers.ts`
- `src/components/card/cardPreviewSide.css`
- `src/utils/card/svgRenderer.ts`
- `src/utils/card/pdfExport.ts`
