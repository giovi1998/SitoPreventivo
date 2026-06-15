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
| **AI Co-Editor** | Modifica testi, prezzi, clausole con AI via prompt (DeepSeek) |
| **Log AI visibili** | Pannello log in tempo reale con risposta DeepSeek raw |
| **PDF export** | Genera PDF con **pdfmake** — tabelle, page break, header/footers automatici |
| **Riepilogo economico** | Tabella Imponibile / IVA / Totale per ogni opzione |
| **Acconto/Saldo** | 50% acconto sviluppo, 50% saldo a consegna |
| **Riepilogo comparativo** | Confronto tra tutte le opzioni |
| **Clausole** | Sezione personalizzabile con condizioni generali |
| **10 colori brand** | Palette di colori per personalizzare il documento |
| **Collection** | Salva, duplica, elimina preventivi, cambia stato (BOZZA/INVIATO/ACCETTATO/RIFIUTATO) |
| **Autenticazione** | Login/registrazione con localStorage |
| **Responsive** | Layout adattivo desktop, tablet, mobile |

## AI Co-Editor (DeepSeek)

### Configurazione

1. Ottieni una API key da [platform.deepseek.com](https://platform.deepseek.com/) (serve credito)
2. Inseriscila nel campo **DeepSeek API Key** nel pannello AI a sinistra
3. Usa i pulsanti rapidi o scrivi un prompt personalizzato
4. Il log AI mostra in tempo reale: prompt inviato, risposta ricevuta, campi modificati

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

## Architettura Dati

**Ibrido Netlify Database + localStorage fallback:**
- Su Netlify: i dati vivono su **Netlify Database** (Postgres managed), accesso via **Netlify Functions**
- In locale/offline: tutto su **localStorage** (nessun cambio di codice, funziona identico)
- Il passaggio è trasparente — `dataService.js` prova l'API, se fallisce usa localStorage

### Admin predefinito

| Email | Password | Sesso |
|-------|----------|-------|
| `admin@gmail.com` | `admin` | male |

### localStorage keys

| Chiave | Descrizione |
|--------|-------------|
| `registeredUsers` | Array JSON utenti registrati |
| `authToken` | Token sessione |
| `userEmail` | Email utente corrente |
| `username` | Username |
| `注册Date` | Data registrazione |
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

# Applica migrazioni al DB locale (con netlify dev)
netlify database migrations apply

# Apri Drizzle Studio per vedere i dati
npm run db:studio
```

## Deploy Netlify

### Con Database

```bash
# Login
npx netlify login

# Init (crea database e collega)
npx netlify database init
# → Segui la procedura guidata

# Deploy
npx netlify deploy --prod
```

### Drag & Drop (solo frontend, senza DB)

```bash
npm run build
# Trascina dist/ su https://app.netlify.com
```

## Struttura file

```
SitoPreventivo/
├── App.jsx                    # AuthProvider, state, AI, PDF export
├── index.html
├── package.json               # react, react-router-dom, pdfmake, drizzle
├── vite.config.js             # Porta 8000, React plugin
├── netlify.toml               # SPA redirect + functions config
├── REQUIREMENTS.md            # Prerequisiti dettagliati
├── drizzle.config.ts          # Drizzle ORM config
├── db/
│   ├── schema.ts              # Schema Postgres (users + quotes)
│   └── index.ts               # Drizzle client
├── netlify/
│   ├── functions/
│   │   └── api.js             # REST API (CRUD users + quotes)
│   └── database/
│       └── migrations/        # Migrazioni automatiche
├── src/
│   ├── main.jsx               # BrowserRouter + ProtectedRoute
│   ├── pages/
│   │   ├── LoginPage.jsx      # Login/registrazione con sesso
│   │   └── NotFoundPage.jsx   # 404 animato
│   ├── components/
│   │   ├── DocumentPreview.jsx # Layout PDF preview
│   │   ├── EditorView.jsx     # AI panel + controlli manuali
│   │   ├── CollectionView.jsx # Griglia preventivi + stato
│   │   ├── Layout.jsx         # Sidebar con icone
│   │   ├── Topbar.jsx         # Salva/Esporta (solo editor)
│   │   ├── GlobalStyles.jsx   # Tutti i CSS
│   │   └── Icon.jsx           # Icone SVG
│   └── utils/
│       ├── dataService.js     # API localStorage ibrido
│       └── generatePDF.js     # PDF con pdfmake
```

## Sviluppo

```bash
npm run dev        # Dev server su :8000
npm run build      # Build produzione in /dist
npm run preview    # Preview del build
```
