# PrecisionQuote - Preventivi Web Professionali

App React/Vite per creare preventivi multi-opzione per servizi digitali. Layout PDF professionale con 4 opzioni, IVA, acconto/saldo, clausole e riepilogo comparativo. Integrazione AI DeepSeek per modifiche rapide.

## Requisiti di sistema

- **Node.js** ≥ 18
- **npm** ≥ 9
- **Windows**: PowerShell con esecuzione script abilitata

## Installazione

```bash
# 1. Clona il repository
git clone https://github.com/giovi1998/SitoPreventivo.git
cd SitoPreventivo

# 2. Installa le dipendenze
npm install

# 3. Avvia il server di sviluppo
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
| **AI Co-Editor** | Modifica testi, prezzi, clausole con AI via prompt |
| **Log AI visibili** | Pannello log in tempo reale con risposta DeepSeek raw |
| **Riepilogo economico** | Tabella Imponibile / IVA / Totale per ogni opzione |
| **Acconto/Saldo** | 50% acconto sviluppo, 50% saldo a consegna |
| **Riepilogo comparativo** | Confronto tra tutte le opzioni |
| **Clausole** | Sezione personalizzabile con condizioni generali |
| **10 colori brand** | Palette di colori per personalizzare il documento |
| **PDF export** | Genera PDF con html2pdf.js (page-break gestiti) |
| **Collection** | Salva, duplica, modifica preventivi |
| **Autenticazione** | Login/registrazione con localStorage |
| **Responsive** | Layout adattivo desktop, tablet, mobile |

## AI Co-Editor (DeepSeek)

### Configurazione

1. Ottieni una API key da [platform.deepseek.com](https://platform.deepseek.com/) (fai ricarica)
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

### System prompt

L'AI riceve un system prompt strutturato con il contesto del preventivo, la struttura JSON esatta e regole (costi in €, ID mantenuti, descrizioni professionali).

## Layout Documento (PDF)

1. **Intestazione**: Titolo colorato, cliente, data, preparato da
2. **Testo introduttivo**: Descrizione progetto
3. **Opzioni** (ciascuna su nuova pagina):
   - Titolo opzione con descrizione
   - Tabella costi (sviluppo, dominio, hosting, manutenzione)
   - Riepilogo economico (Imponibile, IVA %, Totale)
   - Acconto 50% + Saldo 50%
4. **Clausole e condizioni generali** (nuova pagina)
5. **Riepilogo comparativo** (nuova pagina) — tipo sito, manutenzione, costi, totale primo anno
6. **Footer**: Validità 30 giorni

## Autenticazione

- **Registrazione**: salva `{ email, password, username, registrationDate }` in `localStorage['registeredUsers']`
- **Login**: verifica email+password contro `registeredUsers`
- **Logout**: cancella `authToken`, `userEmail`, `username`

### localStorage keys

| Chiave | Descrizione |
|--------|-------------|
| `registeredUsers` | Array JSON utenti registrati |
| `authToken` | Token sessione |
| `userEmail` | Email utente corrente |
| `username` | Username |
| `deepseekKey` | API Key DeepSeek (se configurata) |
| `precisionQuote_quotes` | Preventivi salvati |

## Deploy Netlify

### Dalla dashboard (trascina e rilascia)

1. Vai su [app.netlify.com](https://app.netlify.com)
2. Trascina la cartella `dist/` nella zona di drop
3. Fatto — il sito è live su `https://[nome].netlify.app`

### Dal repository GitHub

```bash
# Login
npx netlify login

# Init (collega progetto)
npx netlify init
# → Create & configure a new site
# → Scegli team
# → Build command: npm run build
# → Deploy directory: dist

# Deploy produzione
npx netlify deploy --prod
```

> Il file `netlify.toml` gestisce automaticamente il redirect SPA per React Router.

### Connessione automatica da GitHub (Netlify UI)

1. Su [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. Connetti il repository GitHub
3. Build settings si auto-compilano da `netlify.toml` (o imposta manualmente)
4. Deploy: **Build command** `npm run build`, **Publish directory** `dist`

## Struttura file

```
SitoPreventivo/
├── App.jsx                    # AuthProvider, state, AI, PDF export
├── index.html                 # Entry HTML
├── package.json               # Dipendenze
├── vite.config.js             # Porta 8000, React plugin
├── netlify.toml               # SPA redirect per Netlify
├── REQUIREMENTS.md            # Prerequisiti dettagliati
├── src/
│   ├── main.jsx               # BrowserRouter + ProtectedRoute
│   ├── pages/
│   │   ├── LoginPage.jsx      # Login/registrazione
│   │   └── NotFoundPage.jsx   # 404 custom
│   └── components/
│       ├── DocumentPreview.jsx # Layout PDF (forwardRef per html2pdf)
│       ├── EditorView.jsx     # AI panel + controlli manuali
│       ├── CollectionView.jsx # Griglia preventivi salvati
│       ├── Layout.jsx         # Sidebar navigazione
│       ├── Topbar.jsx         # Barra superiore (salva/esporta)
│       ├── GlobalStyles.jsx   # Tutti i CSS inline
│       └── Icon.jsx           # Icone SVG
```

## Sviluppo

```bash
# Dev server
npm run dev

# Build produzione
npm run build

# Preview build
npm run preview
```
