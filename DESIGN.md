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
- `QREditor`: **Phase 1**, generatore QR Code con 7 tipi, stili square/rounded/dots, logo overlay, export SVG/PNG.
- `CardEditor`: **Phase 2**, editor bigliettini 3-col desktop / tabs mobile, 3 layout, 3 formati, FAB AI.
- `LogoEditor`: **Phase 4**, Logo Builder con tab Builder + AI (AI disabilitato v1), lucide picker, 3 export sizes.
- `TierLimitModal`: **Phase 5**, modale limite free tier con input codice sblocco.
- `CollectionView`: **Phase 6**, griglia unificata multi-documento (quote, QR, card, logo) con tab per tipo.
- `OnboardingModal`: **Phase 7**, wizard 6 step con preferenza documento finale.
- `LogoAiDocsPage`: **Phase 7**, pagina pubblica `/docs/logo-ai` che spiega la disattivazione AI in v1.
- `Login page`: form email/password con design pulito e accessibile.
- `404 page`: pagina di errore personalizzata con link per tornare alla home.

## EDITMODE
- `accentColor`: primary action/document accent.
- `sidebarInk`: sidebar background.
- `canvasWarmth`: workspace background.
- `documentScale`: preview scale.
- `density`: controls workspace spacing rhythm for panels and main content.


## Modularizzazione corrente

L'app è strutturata come SPA multipage (`react-router-dom` v6) con
route reali (no `useState('view')`):

```
/                  → HomePage (landing pubblica)
/login             → LoginPage
/docs/logo-ai      → LogoAiDocsPage (Phase 7, public, lazy)
/app/editor        → EditorPage (preventivi, default landing dopo login)
/app/collection    → CollectionPage (griglia unificata multi-doc, Phase 6)
/app/qr            → QrPage → QREditor (Phase 1, lazy)
/app/card          → CardPage → CardEditor (Phase 2, lazy)
/app/logo          → LogoPage → LogoEditor (Phase 4, lazy)
/app/settings      → SettingsRoute → SettingsPage
/app/admin         → AdminPage → AdminDashboard (Phase 5 codici sblocco, lazy, AdminRoute guard)
*                  → NotFoundPage
```

- `App.tsx` (root) → `AppShell` (default) + `AuthProvider`/`AuthContext` (named export).
- `src/main.tsx` → Router setup con `BrowserRouter` + `Routes`/`Route`.
- `src/components/AppShell.tsx` → global state shell (quote, AI, toasts, exports, theme), render di `<Outlet/>`.
- `src/hooks/useRouteView.ts` → bridge hook `pathname ↔ view` (editor/collection/qr/card/logo/settings/admin).
- `src/pages/app/*` → thin page wrappers che leggono da `AppContext`.

State globale centralizzato in `AppContext` (fornito da `AppShell`).
Modularizzazione editor (per tipo documento):
- **Quote**: `EditorView.tsx` + `DocumentPreview` (legacy) + `pdfmake` per PDF
- **QR**: `QREditor` + `qrcode` lib + `qrGenerator.ts` per export
- **Card**: `CardEditor` + `CardPreview` (flexbox + CSS Grid) + `cardGenerator.ts` (PDF 10-up / PNG / SVG / JSON)
- **Logo**: `LogoEditor` + `BuilderPanel` + `logoGenerator.ts` (SVG / PNG 512/1024/2048) + `lucideIconPaths.ts`

Persistenza:
- `localhost` → `localStorage` (chiavi versionate `:v1`).
- Produzione → API REST (`api/index.ts` monolith) + Drizzle ORM + Neon Postgres.

Tier system (Phase 5):
- Free: 3 documenti max, watermark su export PDF/PNG/SVG, 150/72 DPI.
- Unlocked: illimitati, no watermark, 300/4096 DPI.
- Watermark è "QUICKBRAND · FREE" diagonale, maiuscolo, fill neutro (non il red brand).
