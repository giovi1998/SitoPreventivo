import React from 'react';
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import GlobalStyles from './src/components/GlobalStyles.jsx';
import Layout from './src/components/Layout.jsx';
import Topbar from './src/components/Topbar.jsx';
import EditorView from './src/components/EditorView.jsx';
import CollectionView from './src/components/CollectionView.jsx';

export const AppContext = createContext(null);
export const AuthContext = createContext(null);

const DEFAULT_OPTIONS = [
  {
    id: 1,
    title: "OPZIONE 1 — Sito Vetrina WordPress · Con Manutenzione",
    description: "Sito vetrina professionale realizzato con WordPress, comprensivo di: pagina \"Chi sei\", sezione libri pubblicati con foto e descrizione, link ai social, ottimizzazione SEO base.",
    oneTimeCost: 750,
    monthlyCost: 50,
    includesMaintenance: true
  },
  {
    id: 2,
    title: "OPZIONE 2 — Sito Vetrina WordPress · Senza Manutenzione",
    description: "Stessa realizzazione dell'Opzione 1. Dominio e hosting sono a carico della cliente con gestione autonoma.",
    oneTimeCost: 950,
    monthlyCost: 0,
    includesMaintenance: false
  },
  {
    id: 3,
    title: "OPZIONE 3 — Sito Vetrina su Misura (HTML/CSS/JS) · Con Manutenzione",
    description: "Sito vetrina professionale sviluppato su misura in HTML, CSS e JavaScript. Include: pagina \"Chi sei\", sezione libri con foto e descrizione, link ai social, ottimizzazione SEO base.",
    oneTimeCost: 550,
    monthlyCost: 50,
    includesMaintenance: true
  },
  {
    id: 4,
    title: "OPZIONE 4 — Sito Vetrina su Misura (HTML/CSS/JS) · Senza Manutenzione",
    description: "Stessa realizzazione dell'Opzione 3. Dominio e hosting sono a carico della cliente con gestione autonoma.",
    oneTimeCost: 700,
    monthlyCost: 0,
    includesMaintenance: false
  }
];

const DEFAULT_CLAUSES = [
  {
    id: "cl-1",
    title: "Fornitura materiali",
    body: "La cliente si impegna a fornire tutti i contenuti necessari alla realizzazione del sito (testi, foto, descrizioni dei libri, loghi, link social) entro 7 giorni lavorativi dall'avvio del progetto. Eventuali ritardi nella fornitura dei materiali comporteranno uno slittamento proporzionale della data di consegna stimata, senza responsabilità da parte dello sviluppatore."
  },
  {
    id: "cl-2",
    title: "Consegna stimata",
    body: "La consegna del sito è stimata entro 3–4 settimane dalla ricezione di tutti i materiali e del pagamento dell'acconto. I tempi possono variare in caso di richieste aggiuntive rispetto a quanto concordato."
  },
  {
    id: "cl-3",
    title: "Revisioni incluse",
    body: "Il preventivo include 2 round di revisione su grafica e contenuti durante la fase di sviluppo. Ulteriori modifiche richieste prima della consegna saranno quotate separatamente."
  },
  {
    id: "cl-4",
    title: "Proprietà del sito",
    body: "Il sito e tutti i suoi elementi diventeranno di piena proprietà della cliente solo a saldo completato. In caso di mancato pagamento entro i termini, lo sviluppatore si riserva il diritto di non pubblicare o di sospendere il sito."
  }
];

const STARTER_QUOTE = {
  id: "PRV-2026-042",
  title: "PREVENTIVI SITO WEB",
  client: "Francesca",
  contact: "Francesca",
  status: "Bozza",
  date: "20 maggio 2026",
  owner: "Giovanni Cidu",
  intro: "Tutti i preventivi includono ottimizzazione SEO base (meta tag, titoli, descrizioni, sitemap).\nModalità di pagamento: 50% di acconto all'avvio del progetto, saldo entro 30 giorni dalla consegna.",
  note: "",
  vat: 22,
  color: "#0B57D0",
  style: "Editoriale",
  options: DEFAULT_OPTIONS,
  clauses: DEFAULT_CLAUSES
};

const money = (value) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(value || 0));
const cloneQuote = (q, patch = {}) => ({
  ...q,
  options: q.options.map(o => ({ ...o })),
  clauses: q.clauses.map(c => ({ ...c })),
  ...patch
});

function getUsers() {
  try { return JSON.parse(localStorage.getItem('registeredUsers') || '[]'); } catch { return []; }
}

function saveUser(email, password, username) {
  const users = getUsers();
  users.push({ email, password, username, regDate: new Date().toLocaleDateString('it-IT') });
  localStorage.setItem('registeredUsers', JSON.stringify(users));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const email = localStorage.getItem('userEmail');
    const username = localStorage.getItem('username');
    const regDate = localStorage.getItem('注册Date');
    if (token && email) {
      setUser({ email, token, username: username || email.split('@')[0], 注册Date: regDate || new Date().toLocaleDateString('it-IT') });
    }
    setLoading(false);
  }, []);

  const register = (email, password, username) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (!email || !password) {
          resolve({ success: false, error: 'Inserisci email e password' });
          return;
        }
        const users = getUsers();
        if (users.find(u => u.email === email)) {
          resolve({ success: false, error: 'Email già registrata' });
          return;
        }
        saveUser(email, password, username || email.split('@')[0]);
        const fakeToken = btoa(`${email}:${Date.now()}`);
        const regDate = new Date().toLocaleDateString('it-IT');
        localStorage.setItem('authToken', fakeToken);
        localStorage.setItem('userEmail', email);
        localStorage.setItem('username', username || email.split('@')[0]);
        localStorage.setItem('注册Date', regDate);
        setUser({ email, token: fakeToken, username: username || email.split('@')[0], 注册Date: regDate });
        resolve({ success: true });
      }, 800);
    });
  };

  const login = (email, password) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (!email || !password) {
          resolve({ success: false, error: 'Inserisci email e password' });
          return;
        }
        const users = getUsers();
        const found = users.find(u => u.email === email);
        if (!found) {
          resolve({ success: false, error: 'Nessun account trovato con questa email' });
          return;
        }
        if (found.password !== password) {
          resolve({ success: false, error: 'Password errata' });
          return;
        }
        const fakeToken = btoa(`${email}:${Date.now()}`);
        localStorage.setItem('authToken', fakeToken);
        localStorage.setItem('userEmail', email);
        localStorage.setItem('username', found.username);
        localStorage.setItem('注册Date', found.regDate);
        setUser({ email, token: fakeToken, username: found.username, 注册Date: found.regDate });
        resolve({ success: true });
      }, 800);
    });
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('username');
    localStorage.removeItem('注册Date');
    setUser(null);
  };

  if (loading) return <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>Caricamento...</div>;

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export default function App() {
  const [view, setView] = useState("editor");
  const [quote, setQuote] = useState(STARTER_QUOTE);
  const [quotes, setQuotes] = useState([
    STARTER_QUOTE,
    cloneQuote(STARTER_QUOTE, { id: "PRV-2026-038", title: "Restyling ristorante", client: "Trattoria Porta Nuova", status: "Inviato", color: "#0F766E" }),
    cloneQuote(STARTER_QUOTE, { id: "PRV-2026-032", title: "Landing evento wellness", client: "Alba Retreat", status: "Accettato", color: "#6D3FD1" })
  ]);
  const [aiText, setAiText] = useState("Rendi il preventivo più professionale e aggiungi dettagli tecnici");
  const [activity, setActivity] = useState("Pronto: modifica manualmente il preventivo.");
  const [searchQuery, setSearchQuery] = useState("");
  const [deepseekKey, setDeepseekKey] = useState(() => localStorage.getItem('deepseekKey') || '');
  const [aiLogs, setAiLogs] = useState([]);
  const { logout, user } = useContext(AuthContext);
  const previewRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('deepseekKey', deepseekKey);
  }, [deepseekKey]);

  const addLog = (type, msg) => setAiLogs(prev => [...prev.slice(-19), { type, msg, time: new Date().toLocaleTimeString('it-IT') }]);

  const patch = (key, value) => setQuote(c => ({ ...c, [key]: value }));

  const updateOption = (id, key, value) => setQuote(c => ({
    ...c,
    options: c.options.map(o => o.id === id ? { ...o, [key]: value } : o)
  }));
  const addOption = () => setQuote(c => ({
    ...c,
    options: [...c.options, {
      id: Date.now(),
      title: `OPZIONE ${c.options.length + 1} — Nuova opzione`,
      description: "Descrizione della nuova opzione...",
      oneTimeCost: 0,
      monthlyCost: 0,
      includesMaintenance: false
    }]
  }));
  const removeOption = (id) => setQuote(c => ({
    ...c,
    options: c.options.filter(o => o.id !== id)
  }));

  const updateClause = (id, key, value) => setQuote(c => ({
    ...c,
    clauses: c.clauses.map(cl => cl.id === id ? { ...cl, [key]: value } : cl)
  }));
  const addClause = () => setQuote(c => ({
    ...c,
    clauses: [...c.clauses, { id: `cl-${Date.now()}`, title: "Nuova clausola", body: "Contenuto della clausola..." }]
  }));
  const removeClause = (id) => setQuote(c => ({
    ...c,
    clauses: c.clauses.filter(cl => cl.id !== id)
  }));

  const callDeepSeek = async (userPrompt) => {
    const systemPrompt = `Sei un esperto di preventivi web design professionisti.
Il tuo compito è modificare il JSON del preventivo in base alla richiesta dell'utente.

REGOLE FONDAMENTALI:
1. Restituisci SEMPRE un JSON valido e completo con TUTTI i campi
2. Mantieni gli stessi ID per opzioni e clausole esistenti
3. Se aggiungi nuovi elementi usa id numerici incrementali (max esistente + 1)
4. Le descrizioni devono essere professionali, persuasive e dettagliate
5. I costi sono in euro, arrotondati a interi

STRUTTURA JSON (NON CAMBIARE):
{
  "title": "stringa",
  "client": "stringa",
  "date": "stringa",
  "intro": "stringa (usa \\n per a capo)",
  "color": "hex color",
  "vat": number,
  "options": [
    {
      "id": number,
      "title": "stringa",
      "description": "stringa dettagliata con benefit e deliverable",
      "oneTimeCost": number,
      "monthlyCost": number,
      "includesMaintenance": boolean
    }
  ],
  "clauses": [
    { "id": "stringa", "title": "stringa", "body": "stringa" }
  ]
}

CONTESTO TIPO:
- Opzione 1: WordPress/Sito esistente (costi bassi, sito già presente)
- Opzione 2: WordPress/Sito su misura (costi alti, sviluppo custom)
- Opzioni con manutenzione: costo mensile > 0
- Opzioni senza manutenzione: monthlyCost = 0
- Descrizioni: max 3-4 righe, includi deliverable concreti
- Clausole: garanzia, pagamenti, proprietà intellettuale, supporto`;

    const payload = {
      title: quote.title, client: quote.client, date: quote.date, intro: quote.intro, color: quote.color, vat: quote.vat,
      options: quote.options.map(o => ({ id: o.id, title: o.title, description: o.description, oneTimeCost: o.oneTimeCost, monthlyCost: o.monthlyCost, includesMaintenance: o.includesMaintenance })),
      clauses: quote.clauses.map(c => ({ id: c.id, title: c.title, body: c.body }))
    };

    addLog('info', `Prompt inviato: "${userPrompt.substring(0, 80)}..."`);
    addLog('info', `Preventivo: ${quote.options.length} opzioni, ${quote.clauses.length} clausole`);

    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${deepseekKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Preventivo attuale (JSON):\n${JSON.stringify(payload, null, 2)}\n\nRichiesta: ${userPrompt}\n\nRispondi SOLO con il JSON completo del preventivo modificato.` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7
      })
    });
    if (!res.ok) {
      const errBody = await res.text();
      addLog('error', `DeepSeek ${res.status}: ${errBody.substring(0, 120)}`);
      throw new Error(`DeepSeek error: ${res.status}`);
    }
    const data = await res.json();
    const raw = data.choices[0].message.content;
    addLog('success', `Risposta ricevuta (${raw.length} chars)`);
    const reply = JSON.parse(raw);
    addLog('info', `Campi restituiti: ${Object.keys(reply).join(', ')}`);
    if (reply.options) addLog('info', `Opzioni restituite: ${reply.options.map(o => o.title).join(', ')}`);
    return reply;
  };

  const runAI = async (mode = "custom") => {
    const prompt = aiText.trim();
    if (!prompt && mode === "custom") { setActivity("💡 Scrivi un prompt per l'AI."); return; }

    if (deepseekKey) {
      setActivity("🤖 Chiamata DeepSeek in corso...");
      try {
        const prompts = {
          premium: "Rendi il preventivo premium: descrizioni più esclusive, colore viola, titolo con 'Edizione Premium'.",
          faq: "Aggiungi una clausola 'FAQ cliente' con domande frequenti su tempi, revisioni, proprietà dei file e supporto. Mantieni tutte le altre clausole esistenti.",
          discount: "Applica uno sconto del 10% su tutti i costi una tantum delle opzioni. Mantieni tutto il resto invariato.",
          simple: "Semplifica il documento: riduci le descrizioni delle opzioni all'essenziale, mantieni solo le prime 2 clausole.",
          custom: prompt
        };
        const userPrompt = prompts[mode] || prompt;
        addLog('info', `Modalità: ${mode}`);
        const modified = await callDeepSeek(userPrompt);

        setQuote(c => {
          const mergeOptions = (modified.options || []).map(mo => {
            const existing = c.options.find(o => o.id === mo.id);
            return existing ? { ...existing, ...mo } : { ...mo, id: mo.id || Date.now() };
          });
          const mergeClauses = (modified.clauses || []).map(mc => {
            const existing = c.clauses.find(cl => cl.id === mc.id);
            return existing ? { ...existing, ...mc } : mc;
          });
          const newQuote = {
            ...c,
            title: modified.title || c.title,
            intro: modified.intro || c.intro,
            color: modified.color || c.color,
            options: mergeOptions.length > 0 ? mergeOptions : c.options,
            clauses: mergeClauses.length > 0 ? mergeClauses : c.clauses
          };
          addLog('success', `Applicato: "${newQuote.title}" | Colore: ${newQuote.color}`);
          addLog('info', `Opzioni finali: ${newQuote.options.map(o => `${o.title} (€${o.oneTimeCost})`).join(' | ')}`);
          return newQuote;
        });
        setActivity(`✅ DeepSeek: ${mode === "custom" ? "prompt applicato" : mode} con successo.`);
        addLog('success', 'Preventivo aggiornato con successo');
      } catch (err) {
        console.error('DeepSeek error:', err);
        setActivity(`❌ Errore DeepSeek: ${err.message}`);
      }
    } else {
      setActivity("⚠️ Nessuna chiave API DeepSeek configurata. Inseriscila nel campo sopra.");
    }
  };

  const saveQuote = () => {
    setQuotes(c => [cloneQuote(quote), ...c.filter(q => q.id !== quote.id)]);
    setActivity("Preventivo salvato nella Collection.");
  };

  const duplicate = (saved) => {
    const copy = cloneQuote(saved, { id: `PRV-2026-${Math.floor(100 + Math.random() * 899)}`, title: `${saved.title} (copia)`, status: "Bozza" });
    setQuotes(c => [copy, ...c]);
    setQuote(copy);
    setView("editor");
    setActivity("Preventivo duplicato.");
  };

  const openQuote = (saved) => {
    setQuote(cloneQuote(saved));
    setView("editor");
    setActivity(`${saved.id} aperto in modifica.`);
  };

  const exportPDF = async () => {
    setActivity("Generazione PDF in corso...");
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = previewRef.current;
      if (!element) { setActivity("Errore: preview non trovato."); return; }
      await html2pdf().set({
        margin: [10, 10, 10, 10],
        filename: `${quote.id}_${quote.client || 'preventivo'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, windowHeight: 1123, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      }).from(element).save();
      setActivity("PDF esportato con successo!");
    } catch (err) {
      console.error(err);
      setActivity("Errore durante l'esportazione PDF.");
    }
  };

  return (
    <AppContext.Provider value={{ editingQuote: quote, setEditingQuote: setQuote, saveQuote, quotes }}>
      <GlobalStyles />
      <Layout view={view} setView={setView} onLogout={logout} user={user}>
        <Topbar view={view} onSave={saveQuote} onExport={exportPDF} />
        {view === "editor" ? (
          <EditorView
            quote={quote}
            aiText={aiText}
            setAiText={setAiText}
            activity={activity}
            patch={patch}
            updateOption={updateOption}
            addOption={addOption}
            removeOption={removeOption}
            updateClause={updateClause}
            addClause={addClause}
            removeClause={removeClause}
            runAI={runAI}
            deepseekKey={deepseekKey}
            setDeepseekKey={setDeepseekKey}
            previewRef={previewRef}
            aiLogs={aiLogs}
          />
        ) : (
          <CollectionView
            quotes={quotes.filter(q => `${q.title} ${q.client} ${q.id}`.toLowerCase().includes(searchQuery.toLowerCase()))}
            activeId={quote.id}
            openQuote={openQuote}
            duplicate={duplicate}
            removeQuote={(id) => setQuotes(c => c.filter(q => q.id !== id))}
          />
        )}
      </Layout>
    </AppContext.Provider>
  );
}
