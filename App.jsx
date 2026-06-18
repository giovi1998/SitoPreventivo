import React, { lazy, Suspense } from 'react';
import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import GlobalStyles from './src/components/GlobalStyles.jsx';
import Layout from './src/components/Layout.jsx';
import Topbar from './src/components/Topbar.jsx';
import EditorView from './src/components/EditorView.jsx';
const CollectionView = lazy(() => import('./src/components/CollectionView.jsx'));
const AdminDashboard = lazy(() => import('./src/pages/AdminDashboard.jsx'));
import SettingsPage from './src/pages/SettingsPage.jsx';
import CollectionViewSkeleton from './src/components/CollectionViewSkeleton.jsx';
import SaveDialog from './src/components/SaveDialog.jsx';
import ToastContainer from './src/components/ToastContainer.jsx';
import ConfirmModal from './src/components/ConfirmModal.jsx';
import OnboardingModal from './src/components/OnboardingModal.jsx';
import dataService from './src/utils/dataService.js';

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

function generateId() {
  const year = new Date().getFullYear();
  const num = Math.floor(100 + Math.random() * 899);
  return `PRV-${year}-${num}`;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('authToken');
    const email = localStorage.getItem('userEmail');
    const username = localStorage.getItem('username');
    const regDate = localStorage.getItem('注册Date');
    const role = localStorage.getItem('userRole');
    if (token && email) {
      return { email, token, username: username || email.split('@')[0], 注册Date: regDate || new Date().toLocaleDateString('it-IT'), role: role || 'user' };
    }
    return null;
  });

  const register = async (email, password, username, gender) => {
    const result = await dataService.register(email, password, username, gender);
    if (result.success) {
      const uData = result.user || {};
      localStorage.setItem('authToken', btoa(`${email}:${Date.now()}`));
      localStorage.setItem('userEmail', email);
      localStorage.setItem('username', uData.username || username);
      localStorage.setItem('注册Date', uData.createdAt || new Date().toLocaleDateString('it-IT'));
      localStorage.setItem('userRole', uData.role || 'user');
      setUser({
        email,
        token: btoa(`${email}:${Date.now()}`),
        username: uData.username || username,
        gender: uData.gender || gender,
        role: uData.role || 'user',
        tokensUsed: uData.tokensUsed || 0,
        tokenLimit: uData.tokenLimit || 1000000,
        注册Date: uData.createdAt || new Date().toLocaleDateString('it-IT')
      });
    }
    return result;
  };

  const login = async (email, password) => {
    const result = await dataService.login(email, password);
    if (result.success) {
      const uData = result.user || {};
      localStorage.setItem('authToken', btoa(`${email}:${Date.now()}`));
      localStorage.setItem('userEmail', email);
      localStorage.setItem('username', uData.username || email.split('@')[0]);
      localStorage.setItem('注册Date', uData.createdAt || new Date().toLocaleDateString('it-IT'));
      localStorage.setItem('userRole', uData.role || 'user');
      setUser({
        email,
        token: btoa(`${email}:${Date.now()}`),
        username: uData.username || email.split('@')[0],
        gender: uData.gender,
        role: uData.role || 'user',
        tokensUsed: uData.tokensUsed || 0,
        tokenLimit: uData.tokenLimit || 1000000,
        注册Date: uData.createdAt || new Date().toLocaleDateString('it-IT')
      });
    }
    return result;
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('username');
    localStorage.removeItem('注册Date');
    localStorage.removeItem('userRole');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export default function App() {
  const [view, setView] = useState("editor");
  const [quote, setQuote] = useState(STARTER_QUOTE);
  const [quotes, setQuotes] = useState([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [aiText, setAiText] = useState("Rendi il preventivo più professionale e aggiungi dettagli tecnici");
  const [activity, setActivity] = useState("Pronto: modifica manualmente il preventivo.");
  const [aiModel, setAiModel] = useState('deepseek-chat');
  const [aiLogs, setAiLogs] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [lastSaveTime, setLastSaveTime] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [theme, setThemeState] = useState(() => localStorage.getItem('theme') || 'light');
  const { logout, user } = useContext(AuthContext);
  const previewRef = useRef(null);

  const addToast = useCallback((type, message) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const setTheme = useCallback((t) => {
    setThemeState(t);
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (user?.email) {
      dataService.getUserSettings(user.email).then(settings => {
        if (!settings.onboardingDone) setShowOnboarding(true);
      }).catch(() => {});
    }
  }, [user?.email]);

  const handleOnboardingComplete = async (settings) => {
    if (user?.email) {
      await dataService.saveUserSettings(user.email, settings);
      if (settings.defaultColor) setQuote(c => ({ ...c, color: settings.defaultColor }));
      if (settings.defaultVat !== undefined) setQuote(c => ({ ...c, vat: settings.defaultVat }));
    }
    setShowOnboarding(false);
    addToast('success', 'Benvenuto! Configurazione completata.');
  };

  useEffect(() => {
    if (user?.email) {
      dataService.getQuotes(user.email).then(({ quotes: loaded }) => {
        if (loaded && loaded.length > 0) {
          setQuotes(loaded);
        } else {
          setQuotes([STARTER_QUOTE]);
        }
      }).catch(() => setQuotes([STARTER_QUOTE]));
    }
  }, [user?.email]);

  const addLog = (type, msg) => setAiLogs(prev => [...prev.slice(-19), { type, msg, time: new Date().toLocaleTimeString('it-IT') }]);

  const markDirty = () => setIsDirty(true);

  const patch = (key, value) => { markDirty(); setQuote(c => ({ ...c, [key]: value })); };

  const updateOption = (id, key, value) => { markDirty(); setQuote(c => ({
    ...c,
    options: c.options.map(o => o.id === id ? { ...o, [key]: value } : o)
  })); };

  const updateOptions = (newOptions) => { markDirty(); setQuote(c => ({ ...c, options: newOptions })); };

  const addOption = () => { markDirty(); setQuote(c => ({
    ...c,
    options: [...c.options, {
      id: Date.now(),
      title: `OPZIONE ${c.options.length + 1} — Nuova opzione`,
      description: "Descrizione della nuova opzione...",
      oneTimeCost: 0,
      monthlyCost: 0,
      includesMaintenance: false
    }]
  })); };
  const removeOption = (id) => { markDirty(); setQuote(c => ({
    ...c,
    options: c.options.filter(o => o.id !== id)
  })); };

  const updateClause = (id, key, value) => { markDirty(); setQuote(c => ({
    ...c,
    clauses: c.clauses.map(cl => cl.id === id ? { ...cl, [key]: value } : cl)
  })); };
  const addClause = () => { markDirty(); setQuote(c => ({
    ...c,
    clauses: [...c.clauses, { id: `cl-${Date.now()}`, title: "Nuova clausola", body: "Contenuto della clausola..." }]
  })); };
  const removeClause = (id) => { markDirty(); setQuote(c => ({
    ...c,
    clauses: c.clauses.filter(cl => cl.id !== id)
  })); };

  const callDeepSeek = async (userPrompt) => {
    const profile = await dataService.getUserProfile(user?.email);
    if (profile.error) throw new Error(profile.error);
    if (profile.tokensUsed >= profile.tokenLimit) {
      throw new Error('Limite token AI raggiunto. Contatta l\'amministratore.');
    }

const systemPrompt = `Sei un esperto di preventivi web design professionisti.
Il tuo compito è modificare il JSON del preventivo in base alla richiesta dell'utente.

REGOLE FONDAMENTALI:
1. Restituisci SEMPRE un JSON valido e completo con TUTTI i campi
2. Mantieni gli stessi ID per opzioni e clausole esistenti
3. Se aggiungi nuovi elementi usa id numerici incrementali (max esistente + 1)
4. Le descrizioni devono essere professionali, persuasive e dettagliate
5. I costi sono in euro, arrotondati a interi
6. Puoi usare i tag [WARNING]testo avviso[/WARNING] e [INFO]testo info[/INFO] all'interno delle descrizioni (description, intro, body delle clausole) per evidenziare blocchi importanti. Questi verranno renderizzati come bellissimi riquadri colorati nel preventivo. Usa [WARNING] per rischi, manutenzione o responsabilità del cliente. Usa [INFO] per vantaggi inclusi o raccomandazioni.

STRUTTURA JSON (NON CAMBIARE):
{
  "title": "stringa",
  "client": "stringa",
  "date": "stringa",
  "intro": "stringa (usa \\n per a capo o tag [INFO]/[WARNING])",
  "color": "hex color",
  "vat": number,
  "options": [
    {
      "id": number,
      "title": "stringa",
      "description": "stringa dettagliata con benefit, deliverable e possibilmente tag [WARNING]/[INFO]",
      "oneTimeCost": number,
      "monthlyCost": number,
      "includesMaintenance": boolean
    }
  ],
  "clauses": [
    { "id": "stringa", "title": "stringa", "body": "stringa (può includere tag [WARNING]/[INFO])" }
  ]
}

CONTESTO TIPO:
- Opzione 1: WordPress/Sito esistente (costi bassi, sito già presente)
- Opzione 2: WordPress/Sito su misura (costi alti, sviluppo custom)
- Opzioni con manutenzione: costo mensile > 0
- Opzioni senza manutenzione: monthlyCost = 0. In questo caso aggiungi SEMPRE un tag [WARNING] indicando i rischi di sicurezza e gestione autonoma.
- Descrizioni: max 3-4 righe, includi deliverable concreti
- Clausole: garanzia, pagamenti, proprietà intellettuale, supporto`;

    const payload = {
      title: quote.title, client: quote.client, date: quote.date, intro: quote.intro, color: quote.color, vat: quote.vat,
      options: quote.options.map(o => ({ id: o.id, title: o.title, description: o.description, oneTimeCost: o.oneTimeCost, monthlyCost: o.monthlyCost, includesMaintenance: o.includesMaintenance })),
      clauses: quote.clauses.map(c => ({ id: c.id, title: c.title, body: c.body }))
    };

    addLog('info', `Prompt inviato: "${userPrompt.substring(0, 80)}..."`);
    addLog('info', `Preventivo: ${quote.options.length} opzioni, ${quote.clauses.length} clausole`);

    const result = await dataService.chatWithAI({
      model: aiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Preventivo attuale (JSON):\n${JSON.stringify(payload, null, 2)}\n\nRichiesta: ${userPrompt}\n\nRispondi SOLO con il JSON completo del preventivo modificato.` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7
    });

    if (result.error) throw new Error(result.error);

    const tokensUsed = result.usage?.total_tokens || 0;
    if (user?.email) dataService.trackTokens(user.email, tokensUsed);
    addLog('info', `Token usati: ${tokensUsed}`);
    const raw = result.choices[0].message.content;
    addLog('success', `Risposta ricevuta (${raw.length} chars)`);
    const reply = JSON.parse(raw);
    addLog('info', `Campi restituiti: ${Object.keys(reply).join(', ')}`);
    if (reply.options) addLog('info', `Opzioni restituite: ${reply.options.map(o => o.title).join(', ')}`);
    return reply;
  };

  const runAI = async (mode = "custom") => {
    const prompt = aiText.trim();
    if (!prompt && mode === "custom") { setActivity("💡 Scrivi un prompt per l'AI."); return; }

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
        markDirty();
        setActivity(`✅ DeepSeek: ${mode === "custom" ? "prompt applicato" : mode} con successo.`);
        addLog('success', 'Preventivo aggiornato con successo');
        addToast('success', `AI: ${mode === "custom" ? "prompt applicato" : mode}`);
      } catch (err) {
        console.error('DeepSeek error:', err);
        const hint = err.message?.includes('402') ? 'Credito DeepSeek esaurito. Ricarica su platform.deepseek.com' :
          err.message?.includes('401') ? 'Chiave API DeepSeek non valida. Contatta l\'amministratore.' :
          err.message?.includes('429') ? 'Troppe richieste a DeepSeek. Attendi qualche secondo e riprova.' :
          err.message?.includes('fetch') || err.message?.includes('NetworkError') ? 'Connessione a DeepSeek fallita. Verifica la tua connessione internet.' :
          null;
        setActivity(`❌ ${hint || err.message}`);
        addLog('error', hint || err.message);
        addToast('error', hint || err.message);
      }
  };

  const saveQuote = () => {
    setShowSaveDialog(true);
  };

  const handleQuickSave = () => {
    const autoName = `${quote.title} (auto)`;
    const saved = cloneQuote(quote, { title: autoName });
    setQuotes(c => [saved, ...c.filter(q => q.id !== quote.id)]);
    if (user?.email) dataService.saveQuote(user.email, saved);
    setIsDirty(false);
    setLastSaveTime(new Date());
    setActivity(`Preventivo salvato automaticamente.`);
    addToast('success', 'Preventivo salvato');
  };

  const handleSaveConfirmed = (customName) => {
    setShowSaveDialog(false);
    const saved = cloneQuote(quote, { title: customName });
    setQuotes(c => [saved, ...c.filter(q => q.id !== quote.id)]);
    if (user?.email) dataService.saveQuote(user.email, saved);
    setIsDirty(false);
    setLastSaveTime(new Date());
    setActivity(`Preventivo "${customName}" salvato nella Collection.`);
    addToast('success', `"${customName}" salvato`);
  };

  const duplicate = (saved) => {
    const today = new Date().toLocaleDateString('it-IT');
    const copy = cloneQuote(saved, {
      id: generateId(),
      title: `${saved.title} (copia)`,
      status: 'BOZZA',
      date: today
    });
    setQuotes(c => {
      const updated = [copy, ...c];
      if (user?.email) dataService.saveQuote(user.email, copy);
      return updated;
    });
    setQuote(copy);
    setView("editor");
    setIsDirty(true);
    setActivity("Preventivo duplicato.");
    addToast('success', 'Preventivo duplicato');
  };

  const saveAsTemplate = () => {
    const template = cloneQuote(quote, {
      id: generateId(),
      isTemplate: true,
      status: 'BOZZA',
      client: '',
    });
    setQuotes(c => {
      const updated = [template, ...c];
      if (user?.email) dataService.saveQuote(user.email, template);
      return updated;
    });
    addToast('success', 'Template salvato');
    setActivity('Template salvato nella Collection.');
  };

  const createFromTemplate = (template) => {
    const today = new Date().toLocaleDateString('it-IT');
    const newQuote = cloneQuote(template, {
      id: generateId(),
      isTemplate: false,
      client: '',
      date: today,
      status: 'BOZZA',
      shareToken: null,
      isShared: false,
    });
    setQuote(newQuote);
    setView("editor");
    setIsDirty(true);
    setActivity(`Nuovo preventivo creato da template "${template.title}".`);
    addToast('success', 'Template applicato');
  };

  const shareInfo = quote.shareToken ? {
    link: `${window.location.origin}/preventivo/${quote.shareToken}`,
    token: quote.shareToken,
  } : null;

  const toggleShare = (enabled) => {
    if (enabled) {
      const token = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      patch('isShared', true);
      patch('shareToken', token);
    } else {
      patch('isShared', false);
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if (!e.ctrlKey) return;
      if (e.key === 's') { e.preventDefault(); handleQuickSave(); }
      if (e.key === 'p') { e.preventDefault(); exportPDF(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [quote]);

  const openQuote = (saved) => {
    setQuote(cloneQuote(saved));
    setView("editor");
    setActivity(`${saved.id} aperto in modifica.`);
  };

  const updateQuoteStatus = (id, newStatus) => {
    setQuotes(c => c.map(q => q.id === id ? { ...q, status: newStatus } : q));
    if (user?.email) {
      const q = quotes.find(qq => qq.id === id);
      if (q) dataService.saveQuote(user.email, { ...q, status: newStatus });
    }
  };

  const exportPDF = async () => {
    setPdfLoading(true);
    setActivity("Generazione PDF in corso...");
    try {
      const { default: generatePDF } = await import('./src/utils/generatePDF.js');
      generatePDF(quote);
      setActivity("PDF esportato con successo!");
      addToast('success', 'PDF esportato');
    } catch (err) {
      console.error(err);
      setActivity("Errore durante l'esportazione PDF.");
      addToast('error', 'Errore esportazione PDF');
    }
    setPdfLoading(false);
  };

  return (
    <AppContext.Provider value={{ editingQuote: quote, setEditingQuote: setQuote, saveQuote, quotes }}>
      <GlobalStyles />
      <Layout view={view} setView={setView} onLogout={logout} user={user} theme={theme} setTheme={setTheme}>
        <Topbar
          view={view}
          onSave={saveQuote}
          onExport={exportPDF}
          lastSaveTime={lastSaveTime}
          isDirty={isDirty}
          pdfLoading={pdfLoading}
          onSaveAsTemplate={saveAsTemplate}
          theme={theme}
          setTheme={setTheme}
        />
        {view === "settings" ? (
          <SettingsPage />
        ) : view === "editor" ? (
          <EditorView
            quote={quote}
            aiText={aiText}
            setAiText={setAiText}
            activity={activity}
            patch={patch}
            updateOption={updateOption}
            updateOptions={updateOptions}
            addOption={addOption}
            removeOption={removeOption}
            updateClause={updateClause}
            addClause={addClause}
            removeClause={removeClause}
            runAI={runAI}
            aiModel={aiModel}
            setAiModel={setAiModel}
            previewRef={previewRef}
            aiLogs={aiLogs}
            isDirty={isDirty}
            saveQuote={handleQuickSave}
            shareInfo={shareInfo}
            toggleShare={toggleShare}
          />
        ) : view === "admin" ? (
          <Suspense fallback={<div className="view-loading"><div className="spinner" /></div>}>
            <AdminDashboard />
          </Suspense>
        ) : (
          <Suspense fallback={<CollectionViewSkeleton />}>
            <CollectionView
              quotes={quotes}
              activeId={quote.id}
              openQuote={openQuote}
              duplicate={duplicate}
              removeQuote={(id) => {
                setQuotes(c => c.filter(q => q.id !== id));
                if (user?.email) dataService.deleteQuote(id, user.email);
              }}
              onUpdateStatus={updateQuoteStatus}
              onDeleteRequest={(item) => setDeleteTarget(item)}
              setView={setView}
              createFromTemplate={createFromTemplate}
            />
          </Suspense>
        )}
      </Layout>
      <SaveDialog
        open={showSaveDialog}
        defaultName={quote.title}
        onSave={handleSaveConfirmed}
        onCancel={() => setShowSaveDialog(false)}
      />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <ConfirmModal
        open={!!deleteTarget}
        title="Elimina preventivo"
        message={deleteTarget ? `Stai per eliminare «${deleteTarget.title}». Non potrai recuperarlo.` : ''}
        confirmLabel="Elimina"
        confirmClass="danger"
        onConfirm={() => {
          if (deleteTarget) {
            setQuotes(c => c.filter(q => q.id !== deleteTarget.id));
            if (user?.email) dataService.deleteQuote(deleteTarget.id, user.email);
            addToast('success', 'Preventivo eliminato');
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
      {showOnboarding && <OnboardingModal onComplete={handleOnboardingComplete} />}
    </AppContext.Provider>
  );
}
