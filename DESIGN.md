---
version: beta
name: Quickbrand Design System
---

## Overview
Suite branding AI-first per piccole attività. 6 strumenti (biglietti, volantini, logo, social, QR, preventivi) con generazione AI DeepSeek + Gemini, tier free/unlocked, export PDF/PNG/SVG.

## The Classic Palette

### Base
- `--accent`: `#E62020` (rosso Quickbrand)
- `--ink`: `#07111f` (near-black freddo)
- `--canvas`: `#F6F8FC` (fondo workspace)
- `--surface`: `#fff` (card, pannelli)
- `--paper`: `#fff` (documento)
- `--line`: `#c8d0df` (bordi)
- `--muted`: `#647086` (testo secondario)

### Semantica
- `--green` / `--success`: `#11845b` / `#10B981`
- `--red` / `--amber`: `#dc2626` / `#a66200`
- `--accent-soft`: `#FCE8E8` (sfondo hover/ghost)
- `--accent-softer`: `#FFF1F1` (sfondo badge)
- `--danger-bg` / `--info-bg`: `#fef2f2` / `#FFF1F1`

### Ghost token (alias compat)
- `--primary` = `var(--accent)`
- `--ink-soft` / `--ink-muted` = `var(--muted)`
- `--bg` / `--surface-2` = `var(--surface)` / `var(--surface-sun)`
- `--accent-bg` = `var(--accent-soft)`

### Dark mode
- Accent: `#FF3B3B` / Canvas: `#0f1117` / Ink: `#e8eaf0` / Surface: `#1a1d27`
- Paper: `#1a1d27` (fondo documento scuro)

## Typography
- **Display**: Outfit 600-800 (`--font-display`)
- **Body**: Inter 300-900 (`--font-body`)
- **Mono**: JetBrains Mono 400/600 (`--font-mono`) per log/code
- **Document accent**: Source Serif 4 (pesi 400/600/700 + italic) per tema `.doc-theme-creative`
- **Scala**: `--text-xs` (12px) → `--text-4xl` (48px), fluida via `clamp()`
- **Sidebar brand**: Outfit 800, tracking tight
- **Form label**: uppercase, tracking largo, peso 600-700

## Spacing & Radius
- **Space scale**: `--space-1` (4px) → `--space-12` (48px)
- **Radius**: `--radius-sm` 6px, `--radius-md` 10px, `--radius-lg` 16px, `--radius-xl` 20px, `--radius-full` 9999px
- **Panel**: 22px padding, 14px radius
- **Sidebar**: 280px collapsed → gruppi (Crea/Archivio/Sistema)
- **Topbar**: 72px sticky
- **Document**: 56px 60px padding, 14px radius card
- **Mobile**: bottom nav floating, content bottom padding 110px

## Shadows & Glass
- `--shadow-sm`: `0 2px 12px rgba(19,35,58,.04)`
- `--shadow-md`: `0 8px 24px rgba(19,35,58,.08)`
- `--shadow-lg`: `0 20px 60px rgba(0,0,0,.15)`
- `--glass-bg`: `rgba(255,255,255,0.75)` + `--glass-blur: 20px` (backdrop blur)

## Components

### App Shell
- `Layout`: sidebar + workspace, sticky topbar con tema/search/actions
- `AppShell`: global state (quote, AI, toasts, exports, theme), `<Outlet/>`
- `Topbar`: tema toggle, salva/esporta globali, breadcrumb
- `ActionBar`: fixed bottom-right Salva/Export menu/Nuovo (logo + QR editor)
- `ToastContainer`: notifiche toast (success/error/info/warning)

### Preventivo (Quote)
- `EditorView`: editor multi-opzione (4 opzioni, IVA, acconto/saldo, clausole, preview PDF)
- `DocumentPreview`: anteprima A4-like con sezioni e totali live
- AI: `AIConsole` rail destra con prompt/azioni/log

### Bigliettini (Card)
- `CardEditorShell`: 3-col desktop / tabs mobile (Preview/Edit/AI)
- `CardFormFields`: tutti i campi (fronte, retro, media, servizi, social, stile)
- `CardGridControls`: preset grid, frecce move/resize, cols/rows
- `CardPreviewSurface`: anteprima live (flexbox + CSS Grid mode)
- AI: `CardAIControls` via `AIConsole` rail destra
- Export: PDF 10-up, PNG, SVG, JSON

### Volantino (Flyer)
- `FlyerEditorShell`: 3 pannelli (Manuale / Preview / AI) con grid `"manual preview ai"`
- 4 layout: classic / centered / split / magazine
- 5 formati: A6 / A5 / A4 / Letter / Square
- AI copy generator DeepSeek (10/min/IP)
- Export PDF+PNG con bleed 3mm

### Logo
- `LogoEditor`: tab Builder (SVG templated) + tab AI (3-step chat namelix-like)
- 3 layout: horizontal / vertical / stacked
- 4 template: tech / food / fashion / professionista
- AI: DeepSeek (3 concept) + Gemini (background image)
- Export SVG, PNG 512/1024/2048

### Social
- `SocialEditor`: genera 3 post (Instagram/Facebook/LinkedIn) da card o flyer
- `AIConsole` rail con form config come children
- Preview + export post

### QR Code
- `QREditor`: 7 tipi (URL, text, email, phone, vCard, WiFi, SMS)
- 3 stili: square / rounded / dots
- Logo overlay (max 20% area)
- Export SVG, PNG

### Altri
- `OnboardingModal`: wizard 5-step, BrandNameGenerator AI-first di default
- `CollectionView`: griglia unificata multi-documento con tab per tipo
- `TierLimitModal`: limite free tier con input codice sblocco
- `AIConsole`: rail AI unificata (collapse persistito, suggestedPrompt, AIProviderBadge)
- `AIProviderBadge`: "DeepSeek · Gemini"

## Routes

| Path | Component | Guard |
|------|-----------|-------|
| `/login` | `LoginPage` | — |
| `/` | `HomePage` (AIDA + bento 6 strumenti) | — |
| `/app` | redirect `/app/editor` o `/app/qr` | login |
| `/app/editor` | `EditorView` | login |
| `/app/editor/:docId` | `EditorView` (load by ID) | login |
| `/app/collection` | `CollectionView` | login |
| `/app/qr` | `QREditor` | login |
| `/app/qr/:docId` | `QREditor` (load by ID) | login |
| `/app/card` | `CardEditor` | login |
| `/app/card/:docId` | `CardEditor` (load by ID) | login |
| `/app/logo` | `LogoEditor` | login |
| `/app/logo/:docId` | `LogoEditor` (load by ID) | login |
| `/app/flyer` | `FlyerEditor` | login |
| `/app/flyer/:docId` | `FlyerEditor` (load by ID) | login |
| `/app/social` | `SocialEditor` | login |
| `/app/settings` | `SettingsPage` | login |
| `/app/admin` | `AdminDashboard` | admin |
| `*` | `NotFoundPage` | — |

## Architecture
- **Frontend**: React 18 + Vite, react-router-dom v6 (route reali, no `useState('view')`)
- **Backend**: Singola Vercel Serverless Function `api/index.ts` (monolite intenzionale)
- **Database**: Drizzle ORM → Neon Postgres
- **Storage split**: `localhost` = localStorage (`:v1` versionato), produzione = API
- **Auth**: bcrypt + localStorage (dev) / Drizzle + Neon (prod). Admin: `admin@gmail.com` via `ADMIN_PASSWORD`
- **Observability**: logger client (`sendBeacon` → `/api/logs`) + server logs JSON

## AI Architecture
- **Provider**: DeepSeek (chat/testo) + Gemini Nano Banana (`gemini-3.1-flash-image`, solo immagini background logo)
- **Orchestratori**: `BaseOrchestrator` astratto → `CardOrchestrator`, `FlyerOrchestrator`, `LogoAIOrchestrator`, `SocialAIOrchestrator`, `OnboardingAIOrchestrator`
- **Streaming**: tutte le risposte AI streammate, multi-turn per sintesi finale
- **Proxy**: lato server (`api/index.ts`), chiavi mai nel bundle
- **UX**: `AIConsole` rail persistita per editor, `AIProviderBadge` unico, log AI in sessionStorage

## Tier System
| Feature | Free | Unlocked |
|---------|------|----------|
| **Documenti** | max 10 | illimitati |
| **Watermark PDF/PNG** | "QUICKBRAND · FREE" diagonale + footer | nessuno |
| **PDF DPI** | 150 | 300 |
| **PNG DPI / max side** | 72 / 1200px | 300 / 4096px |
| **AI features** | bloccate (`AiTierGuard`) | completo |
| **Sblocco** | codice `QB-XXXXXXXX-XXXXXXXX-XXXXXXXX` | admin/unlock code |

## Persistenza
- Locale: `localStorage` versionato (`precisionQuote_documents:v1`, `userSettings_<email>`, `pq_ui:v1`, sessionStorage `pq_ai_logs:v1`)
- Produzione: API REST (`api/index.ts`) + Drizzle + Neon Postgres
- Sessione: `authToken`, `userEmail`, `username`, `userRole` in localStorage
