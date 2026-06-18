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
| **Autenticazione** | Login/registrazione con localStorage |
| **Responsive** | Layout adattivo desktop, tablet, mobile |

## AI Co-Editor (DeepSeek)

### Configurazione

1. **Produzione (Netlify)**: vai su **Netlify → Site settings → Environment variables** e aggiungi `DEEPSEEK_API_KEY` con scope **Functions**. La chiave viene letta solo dalla Netlify Function e non deve essere esposta come variabile `VITE_*`.
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

## Architettura Dati

**Separazione netta produzione/locale:**

| Ambiente | Storage |
|----------|---------|
| **Produzione** (Netlify) | Solo API → Netlify Database (Postgres) |
| **Locale** (`npm run dev`) | Solo localStorage |

La selezione è automatica in base all'hostname: `localhost` = localStorage, altrimenti = API.

### Variabili d'ambiente Netlify

In produzione il progetto deve leggere sempre le variabili iniettate da Netlify:

- `DEEPSEEK_API_KEY`: configurata in Netlify con scope **Functions**. Serve solo alla Function `/api/ai/chat`; il browser non la riceve mai.
- Database Netlify: viene collegato e gestito da Netlify Database. Non impostare manualmente `DATABASE_URL` a un database esterno nella build se vuoi usare il database del sito Netlify.

Per evitare deploy su database sbagliati:

1. Collega il database con `npx netlify database init` o dalla UI Netlify del sito corretto.
2. Lascia che `@netlify/database` e il comando Netlify Database usino le variabili generate dalla piattaforma.
3. Applica le migration solo con il sito Netlify collegato al database atteso.
4. Non stampare chiavi, URL database o token nei log: l'app mostra solo se una variabile è configurata.

### Sicurezza

- **Password hashate**: bcryptjs (12 rounds) su tutti gli endpoint
- **Rate limiting**: max 5 tentativi di login falliti per IP in 15 minuti (via Netlify Blobs)
- **Ownership check**: ogni operazione su preventivi verifica che l'email corrisponda al proprietario
- **Validazione input**: Zod su tutti gli endpoint (email, password, quote)
- **Criteri password**: 12+ caratteri, almeno una maiuscola, una minuscola, un numero, un carattere speciale
- **Security headers**: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, CSP
- **Admin**: password iniziale configurabile tramite variabile server-side e salvata solo come hash bcrypt

### Password di default

Al primo deploy, l'admin `admin@gmail.com` viene creato automaticamente. Per impostare o ruotare la password admin, configura la variabile d'ambiente server-side `ADMIN_INITIAL_PASSWORD` con una password che rispetti i requisiti di sicurezza; al seed successivo il database salva solo l'hash bcrypt.
Dopo il primo login, cambia la password dalla Dashboard Amministratore e rimuovi la variabile se non serve piu.

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

# Applica migrazioni usando il database collegato al sito Netlify corrente
netlify database migrations apply

# Apri Drizzle Studio per vedere i dati
npm run db:studio
```

Note importanti sulle migration:

- Le migration già applicate su Netlify non vanno rinominate, eliminate o modificate.
- Se una migration pendente deve rimuovere una tabella opzionale, usa SQL idempotente come `DROP TABLE IF EXISTS ...` per non bloccare ambienti che hanno già uno schema diverso.
- Se il deploy segnala una tabella mancante, verifica prima che il sito Netlify e il database collegato siano quelli corretti.

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
│   │   ├── HomePage.jsx       # Landing page pubblica
│   │   ├── LoginPage.jsx      # Login/registrazione con sesso
│   │   ├── AdminDashboard.jsx # Gestione utenti, token, chiave AI
│   │   └── NotFoundPage.jsx   # 404 animato
│   ├── components/
│   │   ├── DocumentPreview.jsx # Layout PDF preview
│   │   ├── EditorView.jsx     # AI panel + controlli (sezioni collassabili)
│   │   ├── CollectionView.jsx # Griglia preventivi + stato
│   │   ├── SaveDialog.jsx     # Modale per nome personalizzato
│   │   ├── Layout.jsx         # Sidebar con icone
│   │   ├── Topbar.jsx         # Salva/Esporta (solo editor)
│   │   ├── GlobalStyles.jsx   # Tutti i CSS
│   │   └── Icon.jsx           # Icone SVG
│   └── utils/
│       ├── dataService.js     # API produzione / localStorage locale
│       └── generatePDF.js     # PDF con pdfmake
```

## Sviluppo

```bash
npm run dev        # Dev server su :8000
npm run build      # Build produzione in /dist
npm run preview    # Preview del build
```
