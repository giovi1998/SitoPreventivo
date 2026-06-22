# PrecisionQuote — Preventivi Web Professionali

App React/TypeScript + Vite per creare preventivi multi-opzione per servizi digitali. Layout PDF professionale con 4 opzioni, IVA, acconto/saldo, clausole e riepilogo comparativo. Moduli aggiuntivi: QR Code, Bigliettini da visita, **Logo Builder**. Integrazione AI DeepSeek per modifiche rapide.

## Requisiti di sistema

- **Node.js** ≥ 18
- **npm** ≥ 9
- **Browser**: Chrome/Firefox/Edge/Safari ultima versione

## Installazione

```bash
git clone https://github.com/giovi1998/SitoPreventivo.git
cd SitoPreventivo
npm install
npm run dev
```

Server su `http://localhost:8000`

> **Windows**: se `npm run dev` fallisce per policy di esecuzione:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
> ```
> Poi riapri il terminale.

## Funzionalità

| Funzione | Descrizione |
|----------|-------------|
| **Multi-opzione** | 4 preventivi preimpostati (WordPress/su misura, con/senza manutenzione) |
| **AI Co-Editor** | Modifica testi, prezzi, clausole con AI — chiave condivisa gestita dall'admin |
| **Log AI visibili** | Pannello log in tempo reale con risposta DeepSeek raw |
| **Pannelli collassabili** | Pannelli AI e Manuale si collassano in tabs sempre visibili (AI/Man) sul bordo, per vedere il PDF a pieno schermo |
| **Salva con nome** | Dialog che chiede un nome personalizzato prima del salvataggio |
| **Admin Dashboard** | Gestione utenti, limiti token, chiave DeepSeek condivisa |
| **Token tracking** | Monitoraggio token AI usati per utente, con limite configurabile |
| **PDF export** | Genera PDF con **pdfmake** — tabelle, page break, header/footers automatici |
| **Riepilogo economico** | Tabella Imponibile / IVA / Totale per ogni opzione |
| **Acconto/Saldo** | 50% acconto sviluppo, 50% saldo a consegna |
| **Riepilogo comparativo** | Confronto tra tutte le opzioni |
| **Clausole** | Sezione personalizzabile con condizioni generali |
| **10 colori brand** | Palette di colori per personalizzare il documento |
| **Collection** | Salva, duplica, elimina preventivi, cambia stato (BOZZA/INVIATO/ACCETTATO/RIFIUTATO) |
| **QR Code Generator** | Crea QR code personalizzati (URL, vCard, WiFi, SMS, email, phone) con stili (square/rounded/dots), logo overlay, export SVG/PNG |
| **Bigliettini da Visita** | Editor fronte/retro con 3 layout, 3 formati (EU/US/square), grid editor manuale, AI Design Mode, export PDF 10-up/PNG/SVG/JSON |
| **AI Design Mode (Card)** | 7 quick actions per bigliettini (premium, minimal, compila, palette, stampa, sposta QR, allarga foto) + prompt personalizzato |
| **Logo Builder** | Generatore di loghi SVG da testo + icona (lucide 48 icone allowlist) + 4 forme + 3 layout. AI disabilitata nella v1 (placeholder per Replicate). Export SVG + PNG 512/1024/2048. Zero costo AI, output editabile in Illustrator/Inkscape. |
| **Responsive** | Layout adattivo desktop (3-col), tablet e mobile (tab system + FAB AI + zoom preview) |

## AI Co-Editor (DeepSeek)

### Configurazione

1. **Produzione (Vercel)**: vai su **Vercel Dashboard → Settings → Environment Variables** e aggiungi `DEEPSEEK_API_KEY` con scope **Production, Preview**. La chiave viene letta solo dalla Serverless Function e non deve essere esposta come variabile `VITE_*`.
2. **Locale (`npm run dev`)**: nella Dashboard Admin (sidebar → Admin), incolla la chiave nel campo "Chiave DeepSeek" e salva (viene conservata in localStorage)
3. Tutti gli utenti usano la stessa chiave condivisa — l'admin controlla i **limiti token** per ogni utente
4. Gli utenti vedono selettore "Modello AI" e stato connessione nel pannello

### Token e Limiti

- Ogni chiamata AI consuma token (monitorati automaticamente)
- L'admin può impostare un limite token per ogni utente dalla Dashboard
- Se il limite viene raggiunto, l'AI si disabilita per quell'utente

### Azioni rapide

| Pulsante | Effetto |
|----------|---------|
| ✨ Rendi premium | Descrizioni esclusive, colore viola, titolo premium |
| ❓ Aggiungi FAQ | Aggiunge sezione FAQ alle clausole |
| 💰 Sconto finale | -10% su tutte le opzioni |
| 📄 Semplifica | Riduce descrizioni, mantiene prime 2 clausole |
| ⚡ Prompt personalizzato | Qualsiasi modifica via testo libero |

## Layout Documento (PDF)

Il PDF è generato con **pdfmake** (nessun canvas, page break intelligenti):

1. **Intestazione**: Titolo colorato, cliente, data, preparato da
2. **Testo introduttivo**: Descrizione progetto
3. **Opzioni** (ognuna su nuova pagina):
   - Titolo opzione con descrizione
   - Tabella costi (sviluppo, dominio, hosting, manutenzione)
   - Riepilogo economico (Imponibile, IVA %, Totale)
   - Acconto 50% + Saldo 50%
4. **Clausole e condizioni generali** (nuova pagina)
5. **Riepilogo comparativo** (nuova pagina)
6. **Footer**: Validità 30 giorni

## QR Code Generator

Generatore di QR Code personalizzati con anteprima live e salvataggio in collection.

### Tipi supportati

| Tipo | Payload |
|------|---------|
| URL | Link web (https://...) |
| Testo | Testo libero |
| Email | `mailto:` |
| Telefono | `tel:` |
| vCard | Contatto (nome, organizzazione, ruolo, telefono, email) |
| WiFi | `WIFI:S:...;T:...;P:...;H:...;` |
| SMS | `SMSTO:` |

### Stili

- **Dot style**: `square` (predefinito), `rounded` (moduli arrotondati), `dots` (punti)
- **Error correction**: L (7%), M (15%), Q (25%), H (30%)
- **Logo overlay**: immagine base64 opzionale centrata sul QR (max 20% area)
- **Colori**: foreground e background personalizzabili con validazione contrasto

### Export

- **SVG**: vettoriale, editabile in Illustrator/Inkscape
- **PNG**: raster ad alta risoluzione (256px)
- **Salvataggio**: in collection come documento `qrCode`

## Bigliettini da Visita

Editor completo per bigliettini da visita professionali con anteprima live fronte/retro.

### Formati

| Preset | Dimensioni | Standard |
|--------|-----------|----------|
| EU 85×55 | 85×55 mm | Europeo |
| US 89×51 | 89×51 mm | Americano |
| Square 65×65 | 65×65 mm | Quadrato |

### Layout fronte

- **Centrato**: foto in alto, nome/titolo/azienda centrati
- **Sinistra**: foto a sinistra, testo a destra, divisore accent
- **Split**: foto full-height a sinistra, testo a destra

### Grid editor

- **Sistema a griglia** (4×4 di default, espandibile 2×2 → 8×8)
- **Preset**: Sinistra (foto a sx), Centrato, Diviso (contatti + QR)
- **Editor manuale**: seleziona elemento → frecce ←↑→↓ per spostare, +/− per ridimensionare
- **Editor mobile**: menu popup compatto con frecce in griglia 3×3
- **Grid overlay**: toggle per visualizzare le linee guida

### Grid editor per lato (Phase 2.1)

A partire dalla fase 2.1, l'editor griglia è **per lato** (Fronte / Retro) — non
si possono spostare elementi del front nel retro o viceversa.

- **Lato Fronte**: mostra solo `Foto`, `Logo`, `Nome`, `Ruolo`, `Azienda`
- **Lato Retro**: mostra solo `Contatti`, `QR`, `Social`
- **Preset Fronte**: Sinistra / Centrato / Diviso
- **Preset Retro**: "Default retro" (contatti a sx + QR + social a dx)
- **Spostamenti separati**: `card.grid` per il front, `card.backGrid` per il back

### Collision detection BLOCK (Phase 2.1)

Le mosse sulla grid rispettano sia i bordi sia la **non-sovrapposizione** con
altri elementi. Se una mossa causerebbe overlap, il bottone si disabilita con
tooltip "Limite (collisione)". L'helper `src/utils/gridUtils.ts` espone
`collides / wouldCollideOnMove / wouldCollideOnResize / canMove / canResize /
clampMove / clampResize` ed è usato anche dal merge AI (l'AI non può generare
grid con elementi sovrapposti).

### Logo (Phase 2.1)

L'elemento `logo` è ora parte degli elementi della grid (opzionale, 5° elemento
del front). Size target ~30% della card:

- Preview CSS: 100px (left) / 125px (centered) / 110px (split)
- Export PDF: `Math.min(25mm, dims.w * 0.30)` ≈ 25mm su 85mm = ~29%
- Export SVG: `photoSize * 0.48` (left) / `pxH * 0.20` (split) / centered aggiunto
- Template Giovanni: `logoUrl` = SVG trasparente "WebdevCA" embeddato come data URI

### Griglia OFF = layout classico (Phase 2.1)

Il toggle "Griglia ON/OFF" controlla sia l'overlay sia la modalità di rendering:

- **Griglia OFF** (default) → layout flexbox basato su `front.layout` (split/left/centered)
- **Griglia ON** → CSS Grid basato su `card.grid` + overlay visivo

Questo evita che il front resti "sminchiato" dopo aver usato l'editor
griglia e spento l'overlay.

### AI Design Mode

7 quick actions + prompt personalizzato:

| Azione | Effetto |
|--------|---------|
| Rendi premium | Accent sofisticato (navy/bordeaux/teal), layout split, font Inter |
| Minimal | Rimuove campi vuoti, accent neutro #333 |
| Compila da nome | Genera titolo professionale dal nome |
| Cambia palette | Palette predefinite coerenti (teal, navy, bordeaux, monochrome) |
| Ottimizza per stampa | Verifica contrasto, suggerimenti leggibilità (analysis mode) |
| ← Sposta QR | Sposta il QR a sinistra via grid |
| ↔ Allarga foto | Aumenta la larghezza della foto via grid |

### Protezione merge AI (Phase 2.1)

Il `mergeCardAIResponse` ora protegge da 4 tipi di hallucination:

1. **Campi inventati** (`visible`, `enabled`, ecc.) → Zod strippa via `businessCardSchema.partial().safeParse()`
2. **Cancellazione back fields** (es. `phone: ""`) → helper `shouldUpdateString` blocca
3. **Grid hallucination** (tutti gli elementi a `(0,0,1,1)`) → `isGridHallucinated` rileva e skipppa
4. **photoUrl/logoUrl clearing** → sempre preservato (mai sovrascritto)

6 nuovi test in `cardMerge.test.ts` (`AI hallucination protection` describe block).

### Template Giovanni

Template preconfigurato con dati reali (foto `public/giovanni-photo.jpg`,
logo SVG trasparente "WebdevCA" come data URI, company "HPE CDS", QR che punta
al sito personale, GitHub social, layout split). Da `src/utils/documentSchemas.ts:createGiovanniCardTemplate()`.

### Export

| Formato | Descrizione |
|---------|-------------|
| **PDF 10-up** | A4 con 10 bigliettini (5×2), pronto per tipografia |
| **PNG fronte/retro** | Immagine raster ad alta risoluzione |
| **SVG fronte/retro** | Vettoriale editabile |
| **JSON** | Backup completo dati card |

### Responsive

- **Desktop** (≥900px): layout 3-col (form | preview | AI panel)
- **Mobile** (<900px): tab system (Anteprima | Modifica | AI) + FAB AI floating
- **Zoom preview**: controlli −/reset/+ (50%–150%), default 70% mobile / 100% desktop
- **AI always-accessible**: FAB con badge log non letti → bottom sheet dal basso

## Logo Builder

Generatore di loghi vettoriali componibile. **Nessuna AI nella v1**: l'utente compone il logo da testo + icona + forma + colore + layout. Output SVG pulito e modificabile in Illustrator/Inkscape.

> La fase 3 (Volantino) è stata **skippata** per dare priorità al logo (input di fase 2 `card.front.logoUrl`). Vedi `AGENTS.md` → "Phase Status & Roadmap" e `spec/spec-tool-phase4-logo-builder.md` §7 (Rationale).

### Tipi di icona

| Tipo | Comportamento |
|------|---------------|
| **Nessuna** | Solo testo, nessuna icona |
| **Forma geometrica** | `circle` / `square` / `rounded` / `hex` colorato |
| **Monogramma** | 1-2 lettere (auto-uppercase) dentro la forma |
| **Lucide** | Icona reale dalla libreria `lucide-react` (48 nomi allowlist, 5 categorie: food, tech, fashion, business, nature) |

### Layout

| Layout | Composizione |
|--------|--------------|
| **Horizontal** | Icona a sinistra, primaryText + tagline a destra (400×160 viewBox) |
| **Vertical** | Icona in alto centrata, primaryText sotto, tagline sotto (300×300) |
| **Stacked** | Icona in alto, primaryText sotto, tagline in piccolo sotto (300×320) |

### Template per settore

4 preset pronti all'uso (tech / food / fashion / professionista), ognuno con default colors + iconType + iconShape ottimizzati.

### Sicurezza

- **Escape XML**: `primaryText` e `tagline` passano per `escapeXml()` prima di finire nell'SVG (impedisce XSS via `<script>` injection)
- **Allowlist icone**: 48 nomi lucide pre-validati, niente injection di nomi arbitrari
- **Sanitize SVG**: `DOMParser` + `XMLSerializer` rimuovono `<metadata>`, `<desc>`, `<script>`, commenti, `on*` event handlers prima di `dangerouslySetInnerHTML`
- **Validazione colori**: regex `^#[0-9a-fA-F]{6}$` su `primaryColor` / `secondaryColor`

### Export

| Formato | Descrizione |
|---------|-------------|
| **SVG** | Vettoriale, editabile in Illustrator/Inkscape |
| **PNG 512** | Raster 512×512 (web, social) |
| **PNG 1024** | Raster 1024×1024 (high-DPI) |
| **PNG 2048** | Raster 2048×2048 (stampa) |

### AI (placeholder v2)

Il tab "AI Generation" è presente ma **disabilitato** con messaggio:  
*"AI generation non disponibile nella v1. Configura `REPLICATE_API_TOKEN` su Vercel e upgrada a Pro."*

L'attivazione richiede Vercel Pro (timeout 60s) per Replicate Recraft-V3 ed è deferred alla v2.

### Generazione runtime dei path SVG

I path SVG delle 48 icone sono estratti a build-time da `node_modules/lucide-react/dist/esm/icons/*.js` con lo script `scripts/extract-lucide-paths.mjs` e salvati in `src/utils/lucideIconPaths.ts`. Questo permette di renderizzare l'icona lucide reale nell'SVG esportato senza dipendere da React a runtime. Per rigenerare dopo un upgrade di lucide-react:

```bash
node scripts/extract-lucide-paths.mjs
```

## Architettura Dati

**Separazione netta produzione/locale:**

| Ambiente | Storage |
|----------|---------|
| **Produzione** (Vercel + Neon) | Solo API → Neon Postgres |
| **Locale** (`npm run dev`) | Solo localStorage |

La selezione è automatica in base all'hostname: `localhost` = localStorage, altrimenti = API.

### Variabili d'ambiente Vercel

In produzione il progetto ha bisogno delle seguenti variabili d'ambiente su Vercel:

- `DATABASE_URL`: connection string Neon Postgres (`postgresql://...`). Necessaria per connettere la Serverless Function al database. Scope: **Production, Preview**.
- `DEEPSEEK_API_KEY`: chiave API DeepSeek. Serve solo alla Function `/api/ai/chat`; il browser non la riceve mai. Scope: **Production, Preview**.

Per configurare:

1. Crea un database su [neon.tech](https://neon.tech) (piano Free)
2. Copia la connection string `postgresql://...`
3. Vai su **Vercel Dashboard → Settings → Environment Variables** e aggiungi `DATABASE_URL` e `DEEPSEEK_API_KEY`
4. Applica le migration: `DATABASE_URL="postgresql://..." npm run db:migrate`

### Sicurezza

- **Password hashate**: bcryptjs (12 rounds) su tutti gli endpoint
- **Rate limiting**: max 5 tentativi di login falliti per IP in 15 minuti (in-memory)
- **Ownership check**: ogni operazione su preventivi verifica che l'email corrisponda al proprietario
- **Validazione input**: Zod su tutti gli endpoint (email, password, quote)
- **Admin**: autenticato via env var (`ADMIN_PASSWORD`), mai salvato su database

### Password admin

L'admin `admin@gmail.com` non viene salvato su database. La password viene letta direttamente dalla variabile d'ambiente `ADMIN_PASSWORD` (server) / `VITE_ADMIN_PASSWORD` (locale).  
In produzione, imposta `ADMIN_PASSWORD` su **Vercel Dashboard → Environment Variables**. In locale, modifica `.env`.

### Setup variabili d'ambiente

```bash
# Copia il file di esempio
cp .env.example .env
# Modifica .env con le tue chiavi
```

### localStorage keys

| Chiave | Descrizione |
|--------|-------------|
| `registeredUsers` | Array JSON utenti registrati |
| `authToken` | Token sessione |
| `userEmail` | Email utente corrente |
| `username` | Username |
| `userRole` | Ruolo utente (admin / user) |
| `dataRegistrazione` | Data registrazione |
| `deepseekApiKey` | API Key DeepSeek (solo dev) |
| `precisionQuote_quotes:v1` | Preventivi salvati |
| `precisionQuote_documents:v1` | Documenti unificati (QR, card, logo) |
| `userSettings_<email>` | Impostazioni utente (default color, VAT, theme) |
| `theme` | Tema corrente (light / dark) |
| `documentTheme` | Tema documento (minimal / corporate / creative) |

## Schema Database (Postgres)

### Tabella `users`

| Colonna | Tipo | Note |
|---------|------|------|
| `id` | serial PK | Auto-increment |
| `email` | varchar(255) | UNIQUE, NOT NULL |
| `password` | varchar(255) | NOT NULL |
| `username` | varchar(255) | NOT NULL |
| `gender` | varchar(50) | male / female / other |
| `role` | varchar(20) | admin / user (default user) |
| `tokens_used` | bigint | Token AI consumati |
| `token_limit` | bigint | Limite token (default 1.000.000) |
| `created_at` | timestamp | DEFAULT now() |

### Tabella `quotes`

| Colonna | Tipo | Note |
|---------|------|------|
| `id` | varchar(50) PK | Es. PRV-2026-042 |
| `user_email` | varchar(255) | FK users.email, NOT NULL |
| `title` | varchar(255) | Titolo preventivo |
| `client` | varchar(255) | Nome cliente |
| `date` | varchar(50) | Data preventivo |
| `intro` | text | Testo introduttivo |
| `color` | varchar(50) | Colore brand |
| `vat` | integer | DEFAULT 22 |
| `status` | varchar(50) | DEFAULT 'BOZZA' |
| `owner` | varchar(255) | |
| `options` | jsonb | Array opzioni |
| `clauses` | jsonb | Array clausole |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

## Sviluppo Database

```bash
# Genera una migrazione dopo aver modificato db/schema.ts
npm run db:generate

# Applica migrazioni al database Neon
DATABASE_URL="postgresql://..." npm run db:migrate

# Apri Drizzle Studio per vedere i dati
npm run db:studio
```

Note importanti sulle migration:

- Le migration vanno applicate puntando al database Neon corretto (produzione / preview).
- Usa `drizzle-kit migrate` che applica solo le migration non ancora eseguite.
- Se il deploy segnala una tabella mancante, verifica che `DATABASE_URL` punti al database giusto.

## Deploy su Vercel

### Con Database (completo)

```bash
# Installa Vercel CLI
npx vercel login

# Deploy (collega il progetto)
npx vercel --prod
```

Vercel rileva automaticamente il progetto Vite, esegue `npm run build` e deploya la cartella `dist/` insieme alle Serverless Functions in `api/`.

### Variabili d'ambiente su Vercel

Dopo il deploy, vai su **Vercel Dashboard → Settings → Environment Variables** e aggiungi:

| Variabile | Valore | Scope |
|-----------|--------|-------|
| `DATABASE_URL` | `postgresql://...` da Neon | Production, Preview |
| `DEEPSEEK_API_KEY` | La tua chiave DeepSeek | Production, Preview |
| `ADMIN_PASSWORD` | Password admin (admin@gmail.com) | Production, Preview |

## Struttura file

```
SitoPreventivo/
├── App.tsx                    # AuthProvider, AuthContext, AppShell re-export
├── index.html
├── package.json               # react, react-router-dom, pdfmake, lucide-react, drizzle, zod
├── tsconfig.json              # TypeScript strict mode
├── vite.config.ts             # Porta 8000, React plugin
├── vercel.json                # SPA rewrites + API routing
├── AGENTS.md                  # Convenzioni progetto, regole test, lezioni apprese
├── spec/                      # Specifiche di fase
│   ├── spec-process-phase0-autosave-fix.md
│   ├── spec-tool-phase1-qr-code.md
│   ├── spec-design-phase2-business-card.md
│   ├── spec-tool-phase4-logo-builder.md  # ← fase corrente
│   └── ...
├── drizzle.config.ts          # Drizzle ORM config
├── drizzle/                   # Migrazioni database
├── api/
│   └── index.ts               # Vercel Serverless Function (REST API monolith)
├── db/
│   ├── schema.ts              # Schema Postgres (users + quotes + user_settings)
│   └── index.ts               # Drizzle client (Neon)
├── src/
│   ├── main.tsx               # BrowserRouter + Routes (multipage)
│   ├── contexts/
│   │   └── index.ts           # AuthContext + AppContext
│   ├── hooks/
│   │   ├── useAI.ts           # Hook AI per preventivi (streaming, token)
│   │   ├── useAICard.ts       # Hook AI per card (no tools, JSON round-trip)
│   │   ├── useCardAIFloating.tsx # Provider + hook stato AI panel mobile
│   │   ├── useCardPreviewZoom.ts # Hook zoom anteprima (50-150%)
│   │   ├── useMediaQuery.ts   # Hook responsive
│   │   ├── useRouteView.ts    # Bridge hook pathname ↔ view
│   │   └── useToast.ts        # Toast notifications
│   ├── pages/
│   │   ├── HomePage.tsx       # Landing page pubblica
│   │   ├── LoginPage.tsx      # Login/registrazione
│   │   ├── SettingsPage.tsx   # Cambio password, tema, ecc.
│   │   ├── AdminDashboard.tsx # Gestione utenti/token/chiave AI
│   │   ├── NotFoundPage.tsx   # 404
│   │   └── app/               # Page wrappers protetti da /app
│   │       ├── EditorPage.tsx
│   │       ├── CollectionPage.tsx
│   │       ├── QrPage.tsx
│   │       ├── CardPage.tsx
│   │       ├── LogoPage.tsx   # ← fase 4
│   │       ├── SettingsRoute.tsx
│   │       └── AdminPage.tsx
│   ├── components/
│   │   ├── AppShell.tsx       # Global state shell (Outlet)
│   │   ├── Layout.tsx         # Sidebar (Loghi, QR Code, Bigliettini, Editor, Collection, Settings, Admin)
│   │   ├── Topbar.tsx         # Salva/Esporta per view corrente
│   │   ├── EditorView.tsx     # AI panel + controlli
│   │   ├── QREditor.tsx       # Generatore QR Code
│   │   ├── CardEditor.tsx     # Editor bigliettini
│   │   ├── CardPreview.tsx    # Anteprima card (flexbox + CSS Grid mode)
│   │   ├── CardEditorTabs.tsx # Tab system per mobile
│   │   ├── MobileGridEditor.tsx # Grid editor mobile
│   │   ├── CardAIFab.tsx      # FAB AI floating (mobile)
│   │   ├── CardAIBottomSheet.tsx # Bottom sheet AI panel
│   │   ├── CardPreviewZoomControls.tsx
│   │   ├── LogoEditor.tsx     # ← fase 4: Logo Builder (tabs Builder + AI)
│   │   ├── BuilderPanel.tsx   # ← fase 4: form + lucide picker + live preview
│   │   ├── CollectionView.tsx # Griglia preventivi
│   │   ├── SaveDialog.tsx     # Modale nome personalizzato
│   │   ├── GlobalStyles.tsx   # Tutti i CSS
│   │   └── ...                # altri
│   ├── ai/
│   │   ├── promptUtils.ts     # AI helpers
│   │   ├── cardOrchestrator.ts # AI orchestrator per card
│   │   ├── cardMerge.ts       # Merge risposta AI → card
│   │   ├── aiCardInputSchema.ts
│   │   └── prompts/
│   │       ├── system.ts
│   │       ├── cardSystem.ts
│   │       └── cardContext.ts
│   └── utils/
│       ├── dataService.js     # API produzione / localStorage locale
│       ├── generatePDF.ts     # PDF preventivi con pdfmake
│       ├── cardGenerator.ts   # PDF/PNG/SVG export bigliettini
│       ├── qrGenerator.ts     # QR Code SVG/PNG generation
│       ├── logoGenerator.ts   # ← fase 4: SVG builder + sanitize + export PNG
│       ├── lucideIconPaths.ts # ← fase 4: path SVG icone lucide (auto-generato)
│       ├── documentSchemas.ts # Zod schema (quote, QR, card, logo, grid presets)
│       ├── documentThemes.ts
│       ├── quoteSchema.ts
│       ├── quoteTools.ts
│       └── logger.ts          # Client logger (sendBeacon → /api/logs)
└── scripts/
    └── extract-lucide-paths.mjs # ← fase 4: estrae path SVG da lucide-react
```

## Sviluppo

```bash
npm run dev        # Dev server su :8000
npm run build      # Build produzione in /dist
npm run preview    # Preview del build
npm run test       # Vitest (76 file, 850+ test)
npm run typecheck  # tsc --noEmit
```

## Roadmap

| Fase | Stato | Descrizione |
|------|-------|-------------|
| 0 — Auto-save fix | ✅ | Reset timer su modifiche quote |
| 1 — QR Code | ✅ | 7 tipi, stili, logo overlay, export SVG/PNG |
| 2 — Bigliettini | ✅ | 3 layout, 3 formati, AI Design Mode, grid editor |
| 2.1 — Card polish | ✅ | Collision detection BLOCK, logo in grid (~30%), backGrid separato, showGrid toggle, AI merge protection, template Giovanni con foto+logo trasparente |
| 3 — Volantino | ⏭️ **skipped** | Rimandato per prioritizzare il Logo Builder (vedi AGENTS.md) |
| 4 — **Logo Builder** | ✅ | SVG builder templated, 48 icone lucide, 4 template settore, 3 layout, export SVG + PNG 512/1024/2048 |
| 5 — Tier System | ⏳ pending | Watermark free, unlock code |
| 6 — Unified Collection | ⏳ pending | Visualizzazione documenti misti (preventivi, QR, card, logo) |
| 7 — Polish | ⏳ pending | Ottimizzazioni finali |
