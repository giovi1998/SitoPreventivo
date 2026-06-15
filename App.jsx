import React from 'react';
const { useMemo, useState, createContext, useContext } = React;

export const AppContext = createContext(null);

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentColor": "#0B57D0",
  "sidebarInk": "#082033",
  "canvasWarmth": "#F6F8FC",
  "documentScale": 0.92,
  "density": 1
}/*EDITMODE-END*/;

const PALETTE_PRESETS = [
  { name: "Operativo", value: "#0B57D0" },
  { name: "Verde firma", value: "#11845B" },
  { name: "Viola premium", value: "#6D3FD1" },
  { name: "Ambra", value: "#A66200" },
  { name: "Corallo", value: "#D64545" },
  { name: "Magenta", value: "#B83280" },
  { name: "Teal", value: "#0F766E" },
  { name: "Grafite", value: "#334155" },
  { name: "Indaco", value: "#4F46E5" },
  { name: "Oliva", value: "#5B7F22" }
];

const STYLE_PRESETS = [
  { name: "Moderno", note: "pulito, SaaS, leggibile" },
  { name: "Classico", note: "editoriale, serif, istituzionale" },
  { name: "Minimal", note: "molto bianco, pochi bordi" },
  { name: "Editoriale", note: "headline forte, ritmo premium" },
  { name: "Compatto", note: "più denso, approvazione rapida" },
  { name: "Tech", note: "accenti freddi e label tecniche" },
  { name: "Bold", note: "cover colorata e forte contrasto" },
  { name: "Soft", note: "superfici morbide e delicate" },
  { name: "Caldo", note: "tono consulenziale e umano" },
  { name: "Vintage", note: "carta, serif, dettagli classici" }
];

const SECTION_LIBRARY = [
  { title: "Obiettivo progetto", body: "Chiarire posizionamento, struttura e risultato atteso prima dell'avvio operativo." },
  { title: "Timeline", body: "Kickoff, prima bozza, revisione cliente, sviluppo finale e consegna documentazione." },
  { title: "Piani e pacchetti", body: "Possibilità di scegliere una versione essenziale, completa o premium in base al budget." },
  { title: "Materiali richiesti", body: "Logo, testi base, immagini, dati aziendali e accessi tecnici dove necessari." },
  { title: "Condizioni", body: "Preventivo valido 30 giorni, avvio dopo approvazione scritta e acconto del 40%." },
  { title: "Firme", body: "Spazio per conferma del cliente, data di approvazione e accettazione delle condizioni." },
  { title: "FAQ cliente", body: "Risposte rapide su tempi, revisioni, proprietà dei file e supporto post consegna." },
  { title: "Esclusioni", body: "Non include servizi fotografici, copywriting esteso o integrazioni non indicate nelle voci." },
  { title: "Garanzie", body: "Correzione bug inclusa per 30 giorni dalla pubblicazione del progetto." },
  { title: "Prossimi step", body: "Conferma proposta, invio materiali, call di kickoff e pianificazione attività." }
];

const FRANCESCA_SITE_ITEMS = [
  { id: 1, description: "Strategia e struttura sito", detail: "Call iniziale, obiettivi, alberatura pagine e scaletta contenuti per presentare al meglio Francesca.", qty: 1, rate: 260 },
  { id: 2, description: "Design UI responsive", detail: "Layout desktop/mobile per home, pagina servizi e contatti con stile coerente al personal brand.", qty: 1, rate: 420 },
  { id: 3, description: "Sviluppo sito vetrina", detail: "Realizzazione sito veloce e responsive con sezioni hero, servizi, chi sono, testimonianze e contatto.", qty: 1, rate: 680 },
  { id: 4, description: "Copy, SEO base e performance", detail: "Microcopy, titoli SEO, meta description, ottimizzazione immagini e controllo velocità iniziale.", qty: 1, rate: 220 },
  { id: 5, description: "Form contatto, privacy e consegna", detail: "Modulo richiesta informazioni, collegamento email, privacy/cookie essenziali e mini guida di gestione.", qty: 1, rate: 190 }
];

const withSectionIds = (sections) => sections.map((section, index) => ({ id: `sec-${index + 1}-${section.title.toLowerCase().replaceAll(" ", "-")}`, ...section }));

const FRANCESCA_SECTIONS = withSectionIds([
  { title: "Obiettivo per Francesca", body: "Creare un sito chiaro, elegante e credibile che presenti Francesca, spieghi i servizi e trasformi le visite in richieste di contatto." },
  { title: "Pagine incluse", body: "Home page, sezione servizi, profilo/chi sono, area fiducia con risultati o testimonianze, contatti e pagine privacy essenziali." },
  { title: "Timeline proposta", body: "Settimana 1: raccolta materiali e struttura. Settimana 2: design e revisione. Settimana 3: sviluppo, test e pubblicazione." },
  { title: "Materiali richiesti", body: "Logo se presente, palette preferita, testi grezzi, foto, riferimenti di stile e dati di contatto da pubblicare sul sito." },
  { title: "Condizioni", body: "Preventivo valido 30 giorni. Avvio con approvazione scritta e acconto del 40%; saldo alla consegna prima della pubblicazione definitiva." }
]);

const STARTER_QUOTE = {
  id: "PRV-2026-042",
  title: "Preventivo sito web per Francesca",
  client: "Francesca",
  contact: "Francesca",
  status: "Bozza",
  date: "26 mag 2026",
  owner: "Giovanni Cidu",
  intro: "Proposta per realizzare un sito professionale, responsive e facile da aggiornare, pensato per valorizzare il lavoro di Francesca e generare nuovi contatti.",
  note: "Validità offerta: 30 giorni. Dominio, hosting, shooting fotografico e testi estesi non sono inclusi salvo diversa indicazione.",
  vat: 22,
  color: "#6D3FD1",
  style: "Editoriale",
  styleId: "francesca-site",
  template: "sito-francesca",
  items: FRANCESCA_SITE_ITEMS,
  sections: FRANCESCA_SECTIONS
};

const money = (value) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(value || 0));
const cloneQuote = (quote, patch = {}) => ({ ...quote, items: quote.items.map((item) => ({ ...item })), sections: quote.sections.map((section) => ({ ...section })), ...patch });
const styleSlug = (style) => style.toLowerCase().replaceAll(" ", "-");

function App() {
  const [view, setView] = useState("editor");
  const [quote, setQuote] = useState(STARTER_QUOTE);
  const [quotes, setQuotes] = useState([
    STARTER_QUOTE,
    cloneQuote(STARTER_QUOTE, { id: "PRV-2026-038", title: "Restyling ristorante", client: "Trattoria Porta Nuova", status: "Inviato", color: "#0F766E", style: "Compatto" }),
    cloneQuote(STARTER_QUOTE, { id: "PRV-2026-032", title: "Landing evento wellness", client: "Alba Retreat", status: "Accettato", color: "#6D3FD1", style: "Minimal" })
  ]);
  const [aiText, setAiText] = useState("Prepara un preventivo per il sito web di Francesca con pagine, timeline, materiali richiesti e condizioni chiare");
  const [activity, setActivity] = useState("Pronto: modifica manuale o chiedi all'AI di cambiare davvero il preventivo.");

  const [searchQuery, setSearchQuery] = useState("");

  const subtotal = useMemo(() => quote.items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.rate || 0), 0), [quote.items]);
  const vatAmount = subtotal * Number(quote.vat || 0) / 100;
  const total = subtotal + vatAmount;

  const patch = (key, value) => setQuote((current) => ({ ...current, [key]: value }));
  const updateItem = (id, key, value) => setQuote((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, [key]: value } : item) }));
  const updateSection = (id, key, value) => setQuote((current) => ({ ...current, sections: current.sections.map((section) => section.id === id ? { ...section, [key]: value } : section) }));
  const addItem = () => setQuote((current) => ({ ...current, items: [...current.items, { id: Date.now(), description: "Nuova voce personalizzata", detail: "Scrivi cosa include questa attività e quando viene consegnata.", qty: 1, rate: 120 }] }));
  const removeItem = (id) => setQuote((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
  const addSection = (sectionInput) => {
    const section = typeof sectionInput === "string" ? SECTION_LIBRARY.find((item) => item.title === sectionInput) || { title: sectionInput, body: "Scrivi qui contenuto, condizioni o dettagli da mostrare nel preventivo." } : sectionInput;
    setQuote((current) => current.sections.some((item) => item.title === section.title) ? current : { ...current, sections: [...current.sections, { ...section, id: Date.now() }] });
  };
  const removeSection = (id) => setQuote((current) => ({ ...current, sections: current.sections.filter((section) => section.id !== id) }));

  const runAI = (mode = "custom") => {
    const prompt = aiText.toLowerCase();
    setQuote((current) => {
      let next = cloneQuote(current);

      if (mode === "premium" || prompt.includes("premium") || prompt.includes("autorevole")) {
        if (mode === "francesca" || prompt.includes("francesca") || prompt.includes("sito web")) {
          next = cloneQuote(STARTER_QUOTE, { id: current.id });
        }

        next.title = next.title.includes("Premium") ? next.title : `${next.title} Premium`;
        next.intro = "Proposta curata per presentare il progetto con un'immagine più autorevole, chiara e memorabile per il cliente finale.";
        next.color = "#6D3FD1";
        next.style = "Editoriale";
        next.sections = mergeSections(next.sections, [SECTION_LIBRARY[0], SECTION_LIBRARY[8]]);
      }
      if (mode === "timeline" || prompt.includes("timeline") || prompt.includes("step")) {
        next.sections = mergeSections(next.sections, [SECTION_LIBRARY[1], SECTION_LIBRARY[9]]);
      }
      if (mode === "compact" || prompt.includes("sintetico") || prompt.includes("compatto")) {
        next.style = "Compatto";
        next.note = "Versione sintetica pensata per approvazione rapida: contenuti essenziali, totale chiaro e prossima azione immediata.";
      }
      if (mode === "discount" || prompt.includes("sconto")) {
        next.items = next.items.map((item, index) => index === next.items.length - 1 ? { ...item, description: `${item.description} — sconto applicato`, rate: Math.max(0, Number(item.rate) - 70) } : item);
      }
      if (mode === "legal" || prompt.includes("condizioni")) {
        next.sections = mergeSections(next.sections, [SECTION_LIBRARY[4], SECTION_LIBRARY[7], SECTION_LIBRARY[5]]);
      }
      return next;
    });
    setActivity(`AI applicata: ${mode === "custom" ? "prompt interpretato" : mode}. Anteprima e campi manuali aggiornati.`);
  };

  const saveQuote = () => {
    setQuotes((current) => [cloneQuote(quote), ...current.filter((item) => item.id !== quote.id)]);
    setActivity("Preventivo salvato nella Collection.");
  };

  const duplicate = (saved) => {
    const copy = cloneQuote(saved, { id: `PRV-2026-${Math.floor(100 + Math.random() * 899)}`, title: `${saved.title} (copia)`, status: "Bozza" });
    setQuotes((current) => [copy, ...current]);
    setQuote(copy);
    setView("editor");
    setActivity("Preventivo duplicato e aperto nell'editor.");
  };

  const openQuote = (saved) => {
    setQuote(cloneQuote(saved));
    setView("editor");
    setActivity(`${saved.id} aperto in modifica.`);
  };

  return (
    <AppContext.Provider value={{ editingQuote: quote, setEditingQuote: setQuote, saveQuote, quotes }}>
      <main className="app-shell">
        <style>{css}</style>
        <Sidebar view={view} setView={setView} />
        <section className="workspace" aria-live="polite">
          <AppTopbar view={view} onSave={saveQuote} onExport={() => setActivity("Export PDF: pronto da collegare a html2pdf o pipeline server.")} />
          {view === "editor" ? (
            <EditorView
              quote={quote}
              subtotal={subtotal}
              vatAmount={vatAmount}
              total={total}
              aiText={aiText}
              setAiText={setAiText}
              activity={activity}
              patch={patch}
              updateItem={updateItem}
              removeItem={removeItem}
              addItem={addItem}
              updateSection={updateSection}
              removeSection={removeSection}
              addSection={addSection}
              runAI={runAI}
            />
          ) : (
            <CollectionView quotes={quotes.filter((item) => `${item.title} ${item.client} ${item.id}`.toLowerCase().includes(searchQuery.toLowerCase()))} activeId={quote.id} openQuote={openQuote} duplicate={duplicate} removeQuote={(id) => setQuotes((current) => current.filter((item) => item.id !== id))} />
          )}
        </section>
      </main>
    </AppContext.Provider>
  );
}

export default App;

function mergeSections(current, incoming) {
  const known = new Set(current.map((section) => section.title));
  const additions = incoming.filter((section) => !known.has(section.title)).map((section) => ({ ...section, id: Date.now() + Math.random() }));
  return [...current, ...additions];
}

function Sidebar({ view, setView }) {
  return (
    <aside className="sidebar">
      <div className="brand"><span>PQ</span><div><strong>PrecisionQuote</strong><small>Preventivi custom</small></div></div>
      <nav aria-label="Navigazione principale">
        <button className={view === "editor" ? "active" : ""} onClick={() => setView("editor")}>Editor</button>
        <button className={view === "collection" ? "active" : ""} onClick={() => setView("collection")}>Collection</button>
        <a href="/login" style={{ display: 'block', padding: '12px', background: 'transparent', color: '#cfe0f2', border: '1px solid rgba(255,255,255,.14)', borderRadius: '12px', textDecoration: 'none', textAlign: 'left', fontWeight: '850' }}>Login</a>
      </nav>
      <div className="side-card"><b>No dashboard</b><p>Solo flusso utile: crea, modifica con AI, salva e ritrova preventivi.</p></div>
    </aside>
  );
}

function AppTopbar({ view, onSave, onExport }) {
  return (
    <header className="topbar">
      <div><p>{view === "editor" ? "Editor operativo" : "Raccolta preventivi"}</p><h1>{view === "editor" ? "Editor preventivo" : "Collection"}</h1></div>
      <div className="top-actions"><button onClick={onSave}>Salva</button><button className="primary" onClick={onExport}>Esporta PDF</button></div>
    </header>
  );
}

function EditorView(props) {
  const { quote, subtotal, vatAmount, total, aiText, setAiText, activity, patch, updateItem, removeItem, addItem, updateSection, removeSection, addSection, runAI } = props;
  return (
    <div className="editor-grid">
      <section className="panel ai-panel" aria-labelledby="ai-title">
        <div className="panel-kicker">Claude Design mode</div>
        <h2 id="ai-title">AI che modifica il documento</h2>
        <p>Non è una chat finta: i pulsanti e il prompt cambiano campi, stile, colore, sezioni e prezzi visibili nell'anteprima.</p>
        <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} aria-label="Prompt modifica AI" />
        <div className="ai-actions">
          <button onClick={() => runAI("premium")}>Rendi premium</button>
            <button className="template-action" onClick={() => runAI("francesca")}>Template sito Francesca</button>

          <button onClick={() => runAI("timeline")}>Aggiungi timeline</button>
          <button onClick={() => runAI("compact")}>Compatta</button>
          <button onClick={() => runAI("discount")}>Sconto finale</button>
          <button onClick={() => runAI("legal")}>Condizioni legali</button>
        </div>
        <button className="primary wide" onClick={() => runAI()}>Applica prompt AI</button>
        <div className="activity-log"><span>Ultima azione</span><b>{activity}</b></div>
      </section>

      <section className="panel manual-panel" aria-labelledby="manual-title">
        <div className="panel-kicker">Controllo manuale completo</div>
        <h2 id="manual-title">Campi, box, stile e prezzi</h2>
        <ManualFields quote={quote} patch={patch} />
        <PresetControls quote={quote} patch={patch} />
        <LineItems quote={quote} updateItem={updateItem} removeItem={removeItem} addItem={addItem} />
        <SectionInspector quote={quote} updateSection={updateSection} removeSection={removeSection} addSection={addSection} />
      </section>

      <section className="preview-wrap" aria-label="Anteprima preventivo">
        <DocumentPreview quote={quote} subtotal={subtotal} vatAmount={vatAmount} total={total} />
      </section>
    </div>
  );
}

function ManualFields({ quote, patch }) {
  return (
    <div className="stack">
      <div className="form-grid">
        <label>Titolo preventivo<input value={quote.title} onChange={(e) => patch("title", e.target.value)} /></label>
        <label>Cliente<input value={quote.client} onChange={(e) => patch("client", e.target.value)} /></label>
        <label>Referente<input value={quote.contact} onChange={(e) => patch("contact", e.target.value)} /></label>
        <label>IVA %<input type="number" value={quote.vat} onChange={(e) => patch("vat", e.target.value)} /></label>
      </div>
      <label>Introduzione<textarea value={quote.intro} onChange={(e) => patch("intro", e.target.value)} /></label>
      <label>Note finali<textarea value={quote.note} onChange={(e) => patch("note", e.target.value)} /></label>
    </div>
  );
}

function PresetControls({ quote, patch }) {
  return (
    <div className="control-block">
      <h3>10 colori brand</h3>
      <div className="swatches">{PALETTE_PRESETS.map((color) => <button key={color.value} className={quote.color === color.value ? "selected" : ""} style={{ background: color.value }} onClick={() => patch("color", color.value)} aria-label={color.name} title={color.name} />)}</div>
      <h3>10 stili documento</h3>
      <div className="style-grid">{STYLE_PRESETS.map((style) => <button key={style.name} className={quote.style === style.name ? "selected-style" : ""} onClick={() => patch("style", style.name)}><b>{style.name}</b><small>{style.note}</small></button>)}</div>
    </div>
  );
}

function LineItems({ quote, updateItem, removeItem, addItem }) {
  return (
    <div className="control-block">
      <div className="section-head"><h3>Voci economiche</h3><button onClick={addItem}>+ Voce</button></div>
      {quote.items.map((item) => <article className="item-editor" key={item.id}><input value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} aria-label="Descrizione voce" /><textarea value={item.detail} onChange={(e) => updateItem(item.id, "detail", e.target.value)} aria-label="Dettaglio voce" /><div className="mini-row"><label>Qtà<input type="number" value={item.qty} onChange={(e) => updateItem(item.id, "qty", e.target.value)} /></label><label>Prezzo<input type="number" value={item.rate} onChange={(e) => updateItem(item.id, "rate", e.target.value)} /></label><button onClick={() => removeItem(item.id)}>Elimina</button></div></article>)}
    </div>
  );
}

function SectionInspector({ quote, updateSection, removeSection, addSection }) {
  return (
    <div className="control-block">
      <h3>Box e sezioni compilabili</h3>
      {quote.sections.map((section) => <article className="section-edit" key={section.id}><input value={section.title} onChange={(e) => updateSection(section.id, "title", e.target.value)} aria-label="Titolo sezione" /><textarea value={section.body} onChange={(e) => updateSection(section.id, "body", e.target.value)} aria-label="Testo sezione" /><button onClick={() => removeSection(section.id)}>Rimuovi box</button></article>)}
      <div className="chips">{SECTION_LIBRARY.map((section) => <button key={section.title} onClick={() => addSection(section)}>+ {section.title}</button>)}</div>
    </div>
  );
}

function DocumentPreview({ quote, subtotal, vatAmount, total }) {
  return (
    <article className={`document ${styleSlug(quote.style)}`} style={{ "--doc-accent": quote.color }}>
      <header><span>{quote.id}</span><strong>{quote.owner}</strong></header>
      <div className="doc-cover"><span>{quote.style}</span><h2>{quote.title}</h2><p>{quote.intro}</p></div>
      <div className="client-box"><span>Cliente</span><strong>{quote.client}</strong><small>{quote.contact}</small></div>
      <table><thead><tr><th>Voce</th><th>Q.tà</th><th>Prezzo</th><th>Totale</th></tr></thead><tbody>{quote.items.map((item) => <tr key={item.id}><td><strong>{item.description}</strong><small>{item.detail}</small></td><td>{item.qty}</td><td>{money(item.rate)}</td><td>{money(Number(item.qty || 0) * Number(item.rate || 0))}</td></tr>)}</tbody></table>
      <div className="totals"><p><span>Subtotale</span><b>{money(subtotal)}</b></p><p><span>IVA {quote.vat}%</span><b>{money(vatAmount)}</b></p><p className="grand"><span>Totale</span><b>{money(total)}</b></p></div>
      <div className="doc-sections">{quote.sections.map((section) => <div key={section.id}><strong>{section.title}</strong><p>{section.body}</p></div>)}</div>
      <footer>{quote.note}</footer>
    </article>
  );
}

function CollectionView({ quotes, activeId, openQuote, duplicate, removeQuote }) {
  return (
    <section className="collection-list" aria-label="Preventivi salvati">
      {quotes.map((saved) => {
        const subtotal = saved.items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.rate || 0), 0);
        const total = subtotal + subtotal * Number(saved.vat || 0) / 100;
        return <article className="collection-card" key={saved.id}><span>{saved.status}</span><strong>{saved.title}</strong><p>{saved.client}<small>{saved.id}{saved.id === activeId ? " · aperto" : ""}</small></p><b>{money(total)}</b><div><button onClick={() => openQuote(saved)}>Modifica</button><button onClick={() => duplicate(saved)}>Duplica</button><button onClick={() => removeQuote(saved.id)}>Elimina</button></div></article>;
      })}
    </section>
  );
}

const css = `
:root{--accent:var(--ocd-tweak-accent-color,#0B57D0);--sidebar:var(--ocd-tweak-sidebar-ink,#082033);--canvas:var(--ocd-tweak-canvas-warmth,#F6F8FC);--density:var(--ocd-tweak-density,1);--ink:#07111f;--muted:#647086;--line:#c8d0df;--surface:#fff;--green:#11845b;--amber:#a66200}*{box-sizing:border-box}html{background:var(--canvas)}body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:linear-gradient(135deg,var(--canvas),#eef3fb 54%,#ffffff);color:var(--ink)}button,input,textarea{font:inherit}button{border:1px solid var(--line);background:#fff;border-radius:12px;padding:.72rem .9rem;cursor:pointer;font-weight:850;color:var(--ink);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}button:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(8,32,51,.09)}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid color-mix(in srgb,var(--accent) 35%,transparent);outline-offset:2px}input,textarea{width:100%;border:1px solid var(--line);border-radius:12px;padding:.82rem;background:#fff;color:var(--ink)}textarea{min-height:84px;resize:vertical;line-height:1.45}label{display:grid;gap:.45rem;font-size:.74rem;text-transform:uppercase;letter-spacing:.08em;font-weight:900;color:var(--muted)}.app-shell{display:grid;grid-template-columns:280px 1fr;min-height:100vh}.sidebar{background:radial-gradient(circle at 10% 0%,rgba(255,255,255,.16),transparent 34%),var(--sidebar);color:#fff;padding:28px;display:flex;flex-direction:column;gap:28px}.brand{display:flex;align-items:center;gap:12px}.brand span{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:#fff;color:var(--sidebar);font-weight:950;letter-spacing:-.06em}.brand strong{display:block}.brand small{display:block;color:#b9c7d8;margin-top:2px}.sidebar nav{display:grid;gap:10px}.sidebar button{background:transparent;color:#cfe0f2;border-color:rgba(255,255,255,.14);text-align:left}.sidebar button.active{background:#fff;color:var(--sidebar)}.side-card{margin-top:auto;border:1px solid rgba(255,255,255,.14);border-radius:20px;padding:16px;color:#d6e2f1;background:rgba(255,255,255,.06)}.side-card p{margin:.5rem 0 0;line-height:1.45}.workspace{padding:calc(var(--density)*28px);overflow:hidden}.topbar{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:24px}.topbar p,.panel-kicker{margin:0;color:var(--muted);font-weight:900;text-transform:uppercase;letter-spacing:.1em;font-size:.74rem}.topbar h1{margin:.2rem 0 0;font-size:clamp(1.75rem,3vw,3rem);letter-spacing:-.055em;line-height:.98}.top-actions{display:flex;gap:10px}.primary{background:var(--accent);color:#fff;border-color:var(--accent)}.wide{width:100%}.editor-grid{display:grid;grid-template-columns:minmax(260px,.8fr) minmax(420px,1.1fr) minmax(540px,1.25fr);gap:18px;align-items:start}.panel,.preview-wrap,.collection-card{background:rgba(255,255,255,.88);border:1px solid rgba(200,208,223,.9);border-radius:22px;padding:22px;box-shadow:0 18px 45px rgba(8,32,51,.08);backdrop-filter:blur(16px)}.panel h2{margin:.3rem 0 8px;letter-spacing:-.035em}.panel h3{margin:20px 0 10px;letter-spacing:-.02em}.ai-panel p{color:var(--muted);line-height:1.45}.ai-actions,.chips{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.activity-log{margin-top:14px;padding:12px;border-radius:14px;background:#eef6ff;color:#0B57D0;display:grid;gap:4px}.activity-log span{text-transform:uppercase;font-size:.68rem;letter-spacing:.08em;font-weight:950}.activity-log b{line-height:1.35}.stack,.control-block{display:grid;gap:12px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.swatches{display:grid;grid-template-columns:repeat(10,1fr);gap:8px}.swatches button{height:34px;padding:0;border-radius:999px}.swatches .selected{outline:3px solid #111827;outline-offset:2px}.style-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.style-grid button{text-align:left;display:grid;gap:2px}.style-grid small{color:var(--muted);font-weight:700}.selected-style{background:#07111f;color:#fff;border-color:#07111f}.selected-style small{color:#cbd5e1}.section-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.item-editor,.section-edit{border:1px solid var(--line);border-radius:16px;padding:12px;background:#f9fbff;display:grid;gap:8px}.mini-row{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end}.preview-wrap{position:sticky;top:22px;overflow:auto}.document{--doc-accent:var(--accent);background:#fff;border-radius:18px;padding:42px;min-height:780px;box-shadow:0 28px 80px rgba(7,17,31,.14);transform:scale(var(--ocd-tweak-document-scale,.92));transform-origin:top center}.document header,.document footer{display:flex;justify-content:space-between;gap:20px;color:#6b7280;font-size:.85rem}.doc-cover{border-bottom:2px solid color-mix(in srgb,var(--doc-accent) 22%,#dce3ef);padding:28px 0 22px}.doc-cover span{color:var(--doc-accent);font-weight:950;text-transform:uppercase;letter-spacing:.12em;font-size:.72rem}.document h2{font-size:clamp(2rem,4vw,3.15rem);line-height:.98;margin:10px 0 12px;color:var(--doc-accent);letter-spacing:-.06em}.doc-cover p{font-size:1.07rem;line-height:1.58;max-width:62ch}.client-box{border-left:5px solid var(--doc-accent);background:#f6f8fc;padding:16px;margin:22px 0;display:grid;gap:4px}.client-box span{text-transform:uppercase;font-size:.72rem;color:#647086;font-weight:950}table{width:100%;border-collapse:collapse;margin-top:20px}th{text-align:left;color:#647086;text-transform:uppercase;font-size:.72rem;letter-spacing:.08em}td,th{padding:13px 8px;border-bottom:1px solid #dce3ef;vertical-align:top}td small{display:block;color:#647086;margin-top:4px;line-height:1.35}.totals{margin:20px 0 26px;margin-left:auto;max-width:290px}.totals p{display:flex;justify-content:space-between;margin:8px 0;gap:18px}.grand{font-size:1.25rem;color:var(--doc-accent);border-top:2px solid var(--doc-accent);padding-top:10px}.doc-sections{display:grid;grid-template-columns:1fr 1fr;gap:12px}.doc-sections div{border:1px solid #dce3ef;border-radius:14px;padding:14px}.doc-sections p{color:#647086;line-height:1.45}.document.classico,.document.vintage{font-family:Georgia,serif}.document.minimal{box-shadow:none;border:1px solid #dce3ef}.document.bold .doc-cover{background:var(--doc-accent);color:#fff;margin:-42px -42px 24px;padding:42px;border-radius:18px 18px 0 0}.document.bold .doc-cover span,.document.bold h2,.document.bold .doc-cover p{color:#fff}.document.soft{background:#fffdf8}.document.tech .doc-cover{border-bottom-style:dashed}.document.compatto{padding:32px}.document.compatto .doc-cover{padding:18px 0}.collection-list{display:grid;gap:14px}.collection-card{display:grid;grid-template-columns:120px 1.3fr 1fr 130px auto;gap:14px;align-items:center}.collection-card span{background:#eef6ff;color:#0B57D0;border-radius:999px;padding:6px 10px;font-weight:900;text-align:center}.collection-card p{margin:0;color:var(--muted);display:grid;gap:3px}.collection-card small{font-size:.75rem}.collection-card div{display:flex;gap:8px;flex-wrap:wrap}@media(max-width:1440px){.editor-grid{grid-template-columns:minmax(360px,1fr) minmax(420px,1.05fr)}.ai-panel{grid-column:1/-1}.preview-wrap{position:relative;top:auto}.document{transform:none}}@media(max-width:900px){.app-shell{grid-template-columns:1fr}.sidebar{position:sticky;top:0;z-index:2;flex-direction:row;align-items:center;padding:18px;overflow:auto}.sidebar nav{display:flex}.side-card{display:none}.editor-grid{grid-template-columns:1fr}.collection-card{grid-template-columns:1fr}.workspace{padding:20px}.document{min-width:0}}@media(max-width:680px){.topbar{align-items:flex-start;flex-direction:column}.form-grid,.doc-sections,.style-grid{grid-template-columns:1fr}.swatches{grid-template-columns:repeat(5,1fr)}.mini-row{grid-template-columns:1fr}.document{padding:24px}.document.bold .doc-cover{margin:-24px -24px 20px;padding:28px}.brand div{display:none}table{font-size:.88rem}td,th{padding:10px 5px}}
`;


