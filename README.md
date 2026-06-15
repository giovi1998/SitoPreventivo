# PrecisionQuote - Preventivi Custom

App web React per creare preventivi professionali multi-opzione per servizi digitali (siti web, consulenze, etc.). Layout documento identico a PDF professionale con opzioni commerciali, IVA, clausole e riepilogo comparativo.

## Funzionalità

- **Multi-opzione**: 4 opzioni predefinite (WordPress/su misura, con/senza manutenzione)
- **AI co-editor**: prompt rapidi per modificare layout, testi, prezzi e clausole
- **Riepilogo economico**: tabella Imponibile, IVA 22%, Totale per ogni opzione
- **Riepilogo comparativo**: confronto tra tutte le opzioni
- **Clausole e condizioni**: sezione personalizzabile
- **Esportazione PDF**: genera PDF identico all'anteprima con html2pdf.js
- **Autenticazione**: login/registrazione con salvataggio dati in localStorage
- **Collection**: lista preventivi salvati
- **10 colori brand** personalizzabili

## Avvio

```bash
npm install
npm run dev
```

Server su `http://localhost:8000`

> **Nota Windows**: se `npm run dev` fallisce, esegui una volta:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
> ```
> Poi riapri il terminale.

## Route

- `/` — Editor preventivo (protetto da login)
- `/login` — Pagina di accesso/registrazione
- `*` — Pagina 404

## AI Co-Editor

Il pannello AI usa **DeepSeek** (modello `deepseek-chat`) se configuri una API key, altrimenti mostra un avviso.

### Configurazione

1. Ottieni una API key da [platform.deepseek.com](https://platform.deepseek.com/)
2. Inseriscila nel campo **DeepSeek API Key** nel pannello AI dell'editor
3. La chiave viene salvata in `localStorage` e resta anche dopo il refresh

### Azioni rapide

| Azione | Cosa fa |
|---|---|
| ✨ Rendi premium | Descrioni più esclusive, colore viola, titolo premium |
| ❓ Aggiungi FAQ | Aggiunge sezione FAQ alle clausole |
| 💰 Sconto finale | -10% su tutte le opzioni |
| 📄 Semplifica | Riduce descrizioni e clausole |
| Prompt personalizzato | Modifica con AI qualsiasi aspetto del preventivo |

### Esempi di prompt

- "Rendi le descrizioni più tecniche e professionali"
- "Aggiungi una clausola sulla privacy e protezione dati"
- "Crea una opzione aggiuntiva con servizi premium"
- "Cambia il tono per un cliente non tecnico"

## Login/Registrazione

- **Registrazione**: salva email, password, username e data in `localStorage` (`registeredUsers`)
- **Login**: verifica che email e password corrispondano a un utente registrato
- **Logout**: rimuove i dati della sessione corrente

### Dati salvati in localStorage

| Chiave | Descrizione |
|---|---|
| `registeredUsers` | Array JSON di utenti registrati |
| `authToken` | Token di sessione |
| `userEmail` | Email utente corrente |
| `username` | Username |
| `注册Date` | Data registrazione |

## Struttura file

```
SitoPreventivo/
├── App.jsx                    # AuthProvider, state, runAI, routing
├── index.html
├── package.json
├── netlify.toml               # Config deploy Netlify
├── vite.config.js             # Porta 8000
├── src/
│   ├── main.jsx               # BrowserRouter + ProtectedRoute
│   ├── pages/
│   │   ├── LoginPage.jsx      # Login/registrazione
│   │   └── NotFoundPage.jsx   # 404
│   └── components/
│       ├── DocumentPreview.jsx # Layout PDF (4 opzioni, IVA, clausole)
│       ├── EditorView.jsx     # AI panel + controlli manuali
│       ├── CollectionView.jsx # Griglia preventivi salvati
│       ├── Layout.jsx         # Sidebar
│       ├── Topbar.jsx         # Salva/Esporta PDF
│       ├── GlobalStyles.jsx   # CSS completo
│       └── Icon.jsx           # Icone SVG
```

## PDF Export

```javascript
import('html2pdf.js').then(html2pdf => {
  html2pdf().set({ margin: 10, filename: 'preventivo.pdf' }).from(element).save();
});
```

Layout PDF:
1. Intestazione (titolo, cliente, data)
2. Testo introduttivo (SEO, pagamento)
3. Opzioni (costi, IVA, acconto/saldo)
4. Clausole e condizioni
5. Riepilogo comparativo
6. Footer validità 30 giorni

## Deploy Netlify

```bash
npx netlify login         # Autenticazione browser
npx netlify init          # Crea/link sito
npx netlify deploy --prod # Deploy produzione
```

Il `netlify.toml` include il redirect SPA per React Router.
