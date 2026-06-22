# PrecisionQuote — Preventivi Web Professionali

App React/Vite per creare preventivi multi-opzione per servizi digitali. Layout PDF professionale con 4 opzioni, IVA, acconto/saldo, clausole e riepilogo comparativo. Integrazione AI DeepSeek per modifiche rapide.

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
| `dataRegistrazione` | Data registrazione |
| `deepseekKey` | API Key DeepSeek (se configurata) |
| `precisionQuote_quotes` | Preventivi salvati |

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
├── App.jsx                    # AuthProvider, state, AI, PDF export
├── index.html
├── package.json               # react, react-router-dom, pdfmake, drizzle
├── vite.config.js             # Porta 8000, React plugin
├── vercel.json                # SPA rewrites + API routing
├── REQUIREMENTS.md            # Prerequisiti dettagliati
├── drizzle.config.ts          # Drizzle ORM config
├── drizzle/                   # Migrazioni database
├── api/
│   └── index.js               # Vercel Serverless Function (REST API)
├── db/
│   ├── schema.ts              # Schema Postgres (users + quotes + user_settings)
│   └── index.ts               # Drizzle client (Neon)
├── src/
│   ├── main.tsx               # BrowserRouter + ProtectedRoute
│   ├── pages/
│   │   ├── HomePage.jsx       # Landing page pubblica
│   │   ├── LoginPage.jsx      # Login/registrazione con sesso
│   │   ├── AdminDashboard.jsx # Gestione utenti, token, chiave AI
│   │   └── NotFoundPage.jsx   # 404 animato
│   ├── components/
│   │   ├── DocumentPreview.jsx # Layout PDF preview
│   │   ├── EditorView.jsx     # AI panel + controlli (sezioni collassabili)
│   │   ├── QREditor.tsx       # Generatore QR Code (URL, vCard, WiFi, SMS)
│   │   ├── CardEditor.tsx     # Editor bigliettini (3-col desktop, tabs mobile)
│   │   ├── CardPreview.tsx    # Anteprima card (flexbox + CSS Grid mode)
│   │   ├── CardEditorTabs.tsx # Tab system per mobile
│   │   ├── MobileGridEditor.tsx # Grid editor mobile (popup frecce)
│   │   ├── CardAIFab.tsx      # FAB AI floating (mobile)
│   │   ├── CardAIBottomSheet.tsx # Bottom sheet AI panel (mobile)
│   │   ├── CardPreviewZoomControls.tsx # Controlli zoom anteprima
│   │   ├── CollectionView.jsx # Griglia preventivi + stato
│   │   ├── SaveDialog.jsx     # Modale per nome personalizzato
│   │   ├── Layout.jsx         # Sidebar con icone
│   │   ├── Topbar.jsx         # Salva/Esporta (solo editor)
│   │   ├── GlobalStyles.jsx   # Tutti i CSS
│   │   └── Icon.jsx           # Icone SVG
│   ├── hooks/
│   │   ├── useAICard.ts       # Hook AI per card (streaming, token, error recovery)
│   │   ├── useMediaQuery.ts   # Hook responsive (breakpoint detection)
│   │   ├── useCardAIFloating.tsx # Provider + hook stato AI panel mobile
│   │   └── useCardPreviewZoom.ts # Hook zoom anteprima (50-150%)
│   ├── ai/
│   │   ├── cardOrchestrator.ts # AI orchestrator per card (no tools)
│   │   ├── cardMerge.ts       # Merge risposta AI → card (grid, style, text)
│   │   ├── aiCardInputSchema.ts # Zod schema input AI card
│   │   └── prompts/
│   │       ├── cardSystem.ts  # System prompt AI card
│   │       └── cardContext.ts # Context builder AI card
│   └── utils/
│       ├── dataService.js     # API produzione / localStorage locale
│       ├── generatePDF.ts     # PDF preventivi con pdfmake
│       ├── cardGenerator.ts   # PDF/PNG/SVG export bigliettini
│       ├── qrGenerator.ts     # QR Code SVG/PNG generation
│       └── documentSchemas.ts # Zod schema (quote, QR, card, grid presets)
```

## Sviluppo

```bash
npm run dev        # Dev server su :8000
npm run build      # Build produzione in /dist
npm run preview    # Preview del build
```
