# PrecisionQuote — Prerequisiti e Setup

## Requisiti di Sistema

| Componente | Versione minima | Note |
|------------|----------------|------|
| **Node.js** | 18.x | Consigliato 20+ |
| **npm** | 9.x | In bundle con Node.js |
| **Git** | 2.x | Per clonare il repo |
| **Browser** | Moderno | Chrome/Firefox/Edge/Safari ultima versione |
| **OS** | Windows/macOS/Linux | Testato su Windows 11 |

## Installazione Passo-Passo

### 1. Verifica strumenti

```powershell
node --version   # deve essere ≥ 18
npm --version    # deve essere ≥ 9
git --version
```

### 2. Clona e installa

```powershell
git clone https://github.com/giovi1998/SitoPreventivo.git
cd SitoPreventivo
npm install
```

### 3. Avvia

```powershell
npm run dev
```

Apri `http://localhost:8000`

### 4. (Solo Windows) Policy di esecuzione

```powershell
# PowerShell come Amministratore
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

## Primo Avvio

1. Vai su `http://localhost:8000`
2. **Registrati**: inserisci email, username, password
3. **Login**: accedi con le credenziali
4. Per usare l'AI:
   - Ottieni API key da [platform.deepseek.com](https://platform.deepseek.com/)
   - Inseriscila nel campo "DeepSeek API Key"
   - Usa i pulsanti rapidi o scrivi un prompt

## Dipendenze

| Pacchetto | Scopo |
|-----------|-------|
| `react` + `react-dom` | Framework UI |
| `react-router-dom` | Routing SPA |
| `pdfmake` | Generazione PDF da dati JSON (zero canvas) |
| `vite` + `@vitejs/plugin-react` | Bundler e dev server |

### Rimosso

- `html2pdf.js` — sostituito da pdfmake

## Archiviazione Dati (Ibrido)

| Situazione | Dove vanno i dati |
|------------|-------------------|
| **Su Vercel** | Neon Postgres via Vercel Serverless Function (`/api`) |
| **Solo `npm run dev`** | localStorage (fallback automatico) |
| **Offline** | localStorage (funziona sempre) |

L'app in produzione chiama l'API su `/api/*`. In locale (`localhost`) usa esclusivamente localStorage.

### Password di default

L'admin `admin@gmail.com` viene autenticato direttamente dalla variabile d'ambiente server-side `ADMIN_PASSWORD` (locale: `VITE_ADMIN_PASSWORD`). Non viene mai salvato su database.

### Dati localStorage (fallback)

| Chiave | Descrizione |
|--------|-------------|
| `registeredUsers` | Array JSON utenti registrati |
| `authToken` | Token sessione |
| `userEmail` | Email utente corrente |
| `username` | Username |
| `dataRegistrazione` | Data registrazione |
| `deepseekKey` | API Key DeepSeek |
| `precisionQuote_quotes` | Preventivi salvati |

## Deploy su Vercel

### Opzione 1: Con Database (completo)

```powershell
npx vercel login
npx vercel --prod
```

Vercel rileva automaticamente il progetto Vite e deploya sia il frontend che le API.

### Opzione 2: Da repository GitHub

1. Su [vercel.com](https://vercel.com) → **Add New Project** → **Import Git Repository**
2. Connetti il repo `giovi1998/SitoPreventivo`
3. Vercel rileva automaticamente Vite e configura build
4. Aggiungi le variabili d'ambiente su **Settings → Environment Variables**:
   - `DATABASE_URL` — connection string Neon
   - `DEEPSEEK_API_KEY` — chiave DeepSeek
5. Ogni push sul branch collegato fa deploy automatico

## Sviluppo Database

```powershell
# Genera migrazione dopo aver modificato db/schema.ts
npm run db:generate

# Applica migrazioni al database Neon
$env:DATABASE_URL="postgresql://..." ; npm run db:migrate

# Apri interfaccia dati
npm run db:studio
```

## Comandi utili

```powershell
npm run dev        # Dev server su :8000
npm run build      # Build produzione in /dist
npm run preview    # Preview del build
```

## Risoluzione Problemi

| Problema | Soluzione |
|----------|-----------|
| `npm run dev` fallisce | Esegui `Set-ExecutionPolicy` come admin |
| Build fallisce | Cancella `node_modules` e `npm install` |
| DeepSeek 402 | Account senza credito — ricarica su platform.deepseek.com |
| PDF non si esporta | Controlla console F12 per errori pdfmake |
| CSS non caricato | Hard refresh (Ctrl+F5) |
| Pagina bianca | Controlla console del browser per errori |
