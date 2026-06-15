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

Apri un terminale (PowerShell su Windows, bash su Mac/Linux):

```powershell
node --version   # deve essere ≥ 18
npm --version    # deve essere ≥ 9
git --version    # deve funzionare
```

### 2. Clona il repository

```powershell
git clone https://github.com/giovi1998/SitoPreventivo.git
cd SitoPreventivo
```

### 3. Installa dipendenze

```powershell
npm install
```

Questo installa:
- `react` + `react-dom` — framework UI
- `react-router-dom` — routing SPA
- `html2pdf.js` — esportazione PDF lato client
- `vite` + `@vitejs/plugin-react` — bundler e dev server

### 4. Avvia il dev server

```powershell
npm run dev
```

Apri il browser su `http://localhost:8000`

### 5. (Solo Windows) Policy di esecuzione

Se il comando sopra fallisce con errori di permessi:

```powershell
# Apri PowerShell come Amministratore
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force

# Riavvia il terminale e riprova
npm run dev
```

## Primo Avvio

1. Vai su `http://localhost:8000` — vedrai la pagina di login
2. **Registrati**: inserisci email, username, password
3. **Login**: accedi con le credenziali appena create
4. Sei nell'editor. Per usare l'AI:
   - Ottieni una API key da [https://platform.deepseek.com](https://platform.deepseek.com/)
   - Inseriscila nel campo "DeepSeek API Key" (pannello sinistro)
   - Usa i pulsanti rapidi o scrivi un prompt personalizzato

## Deploy su Netlify

### Opzione 1: Drag & Drop (veloce)

```powershell
# Build del progetto
npm run build
```

Trascina la cartella `dist/` su [app.netlify.com](https://app.netlify.com)

### Opzione 2: CLI Netlify

```powershell
# Login Netlify (apre il browser)
npx netlify login

# Inizializza sito
npx netlify init
# → "Create & configure a new site"
# → Scegli team
# → Build command: npm run build
# → Deploy directory: dist

# Deploy produzione
npx netlify deploy --prod
```

### Opzione 3: Da repository GitHub

1. Carica il progetto su GitHub
2. Su [app.netlify.com](https://app.netlify.com) → "Add new site" → "Import an existing project"
3. Connetti il repository
4. Netlify rileva automaticamente `netlify.toml` con i settaggi corretti
5. Il sito si builda e deploya automaticamente a ogni push

## Comandi utili

```powershell
npm run dev        # Avvia dev server su :8000
npm run build      # Build produzione in /dist
npm run preview    # Preview del build
npx vite build     # Build alternativo
```

## Risoluzione Problemi

| Problema | Soluzione |
|----------|-----------|
| `npm run dev` fallisce | Esegui `Set-ExecutionPolicy` come admin |
| Build fallisce | Cancella `node_modules` e `npm install` |
| DeepSeek 402 | Account senza credito — ricarica su platform.deepseek.com |
| CSS non caricato | Hard refresh (Ctrl+F5) |
| Pagina bianca | Controlla console del browser per errori |
