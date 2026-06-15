---
version: alpha
name: PrecisionQuote Design System
---

## Overview
Sistema professionale per un'app di creazione preventivi personalizzabili: editor assistito, anteprima documento PDF e collection dei preventivi salvati.

## colors
- `accent`: blu operativo modificabile via EDITMODE, default `#0B57D0`.
- `sidebar`: inchiostro navy modificabile via EDITMODE, default `#082033`.
- `canvas`: fondo workspace modificabile via EDITMODE, default `#F6F8FC`.
- `ink`: near-black freddo `#07111f` per titoli e testo principale.
- `muted`: `#647086` per descrizioni, date e metadati.
- `line`: `#c8d0df` per bordi app e separatori documento.
- `surface`: bianco per card, pannelli e documento.
- `green`: `#11845b` per stati positivi.
- `amber`: `#a66200` per stati accettati/attenzione.

## typography
- Font stack: system UI sans-serif per velocità, leggibilità e compatibilità PDF.
- Titoli app: peso 850-950, tracking negativo, scala fluida `clamp()`.
- Label form: uppercase, tracking largo, peso 850.
- Documento: gerarchia editoriale con heading blu, meta uppercase e numeri tabulari.

## rounded
- App panels: `22px`.
- Controls: `12-14px`.
- Pills/status: `999px`.
- Document cards: `14px`.

## spacing
- Shell desktop: sidebar 280px, topbar 72px.
- Content desktop: 34-40px.
- Panel sections: 22px.
- Document padding: 56px 60px.
- Mobile: bottom navigation floating, content bottom padding 110px.

## components
- `Sidebar`: brand, primary navigation, utilities.
- `Topbar`: workspace title, search, save and PDF export actions.
- `AI Assistant`: chat bubbles plus prompt for text/style requests.
- `Content editor`: fields for client, title, VAT and line items.
- `Document preview`: A4-like quote surface with live totals and sections.
- `Collection card`: status, title, client, date, amount and actions: modifica, duplica, elimina.
- `AI Modifier`: assistente stile Claude Design che applica modifiche reali a testi, sezioni, stile, colore e voci del preventivo.
- `Manual inspector`: pannello laterale con tutti i box documento editabili manualmente.
- `Style controls`: preset iniziali con 10 stili documento e 10 colori brand.
- `Login page`: form email/password con design pulito e accessibile.
- `404 page`: pagina di errore personalizzata con link per tornare alla home.

## EDITMODE
- `accentColor`: primary action/document accent.
- `sidebarInk`: sidebar background.
- `canvasWarmth`: workspace background.
- `documentScale`: preview scale.
- `density`: controls workspace spacing rhythm for panels and main content.


## Modularizzazione corrente

- `App.jsx` resta l'artefatto preview self-contained richiesto dal runner.
- `src/components/Layout.jsx`, `Topbar.jsx`, `EditorView.jsx`, `DocumentPreview.jsx` e `CollectionView.jsx` definiscono la struttura modulare da usare in una build React/Vite.
- La regola di prodotto rimane: navigazione solo `Editor` + `Collection`, senza dashboard.
- L'editor core combina controlli manuali, AI applicativa, 10 colori, 10 stili e anteprima documento live.
