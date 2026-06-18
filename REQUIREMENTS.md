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
| **Su Netlify** | Netlify Database (Postgres) via API Functions |
| **Con `netlify dev`** | Postgres locale |
| **Solo `npm run dev`** | localStorage (fallback automatico) |
| **Offline** | localStorage (funziona sempre) |

L'app prova sempre prima l'API (`/.netlify/functions/api/...`). Se la chiamata fallisce (rete assente, funzione non disponibile), usa automaticamente localStorage.

### Password di default

Al primo avvio, l'admin `admin@gmail.com` viene creato con una password randomica stampata nella console del browser (in locale) o nei log Netlify (in produzione). Dopo il primo login, cambiala dalla Dashboard.

### Dati localStorage (fallback)

| Chiave | Descrizione |
|--------|-------------|
| `registeredUsers` | Array JSON utenti registrati |
| `authToken` | Token sessione |
| `userEmail` | Email utente corrente |
| `username` | Username |
| `注册Date` | Data registrazione |
| `deepseekKey` | API Key DeepSeek |
| `precisionQuote_quotes` | Preventivi salvati |

## Deploy su Netlify

### Opzione 1: Con Database (completo)

```powershell
npx netlify login
npx netlify database init    # Crea database + migrazione
npx netlify deploy --prod
```

### Opzione 2: Drag & Drop (solo frontend)

```powershell
npm run build
# Trascina dist/ su https://app.netlify.com
```

### Opzione 3: Da repository GitHub

1. Su [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. Connetti il repo `giovi1998/SitoPreventivo`
3. Netlify legge `netlify.toml` e imposta tutto
4. Ogni push su master fa deploy automatico

## Sviluppo Database

```powershell
# Genera migrazione dopo aver modificato db/schema.ts
npm run db:generate

# Applica migrazioni al DB locale
netlify database migrations apply

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
