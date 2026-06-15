import React from 'react';
import Icon from '../components/Icon.jsx';
import Topbar from '../components/Topbar.jsx';
import AuthorQuoteTemplate from '../components/AuthorQuoteTemplate.jsx';
import { AppContext } from '../../App.jsx';
import { sectionLibrary, COLORS, STYLES, initialItems, money } from '../constants.js';

export default function CreatePage() {
  const { editingQuote, setEditingQuote, saveQuote, quotes } = React.useContext(AppContext);
  const [tone, setTone] = React.useState("più premium");

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      const found = quotes.find(q => q.id === id);
      if (found) {
        setEditingQuote(found);
        return;
      }
    }
    
    // Inizializza un preventivo di default se vuoto o non specificato
    if (!editingQuote) {
      setEditingQuote({
        id: `PRV-2026-${Math.floor(100 + Math.random() * 900)}`,
        title: "Preventivo sito web professionale",
        client: "",
        owner: "Giovanni Cidu",
        status: "Bozza",
        date: new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }),
        items: initialItems,
        sections: ["Introduzione progetto", "Piani e pacchetti", "Materiali richiesti", "Condizioni", "Firme"],
        vat: 22,
        template: "standard",
        color: "#0B57D0",
        styleId: "standard"
      });
    }
  }, [window.location.search, quotes]);

  if (!editingQuote) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Caricamento preventivo...</div>;
  }

  const subtotal = editingQuote.items.reduce((sum, item) => sum + item.qty * item.rate, 0);
  const total = subtotal * (1 + editingQuote.vat / 100);

  const updateItem = (id, key, value) => {
    const updated = editingQuote.items.map(item => 
      item.id === id ? { ...item, [key]: key === "qty" || key === "rate" ? Number(value) : value } : item
    );
    setEditingQuote({ ...editingQuote, items: updated });
  };

  const addSection = (section) => {
    const currentSections = editingQuote.sections || [];
    const updated = currentSections.includes(section)
      ? currentSections.filter(s => s !== section)
      : [...currentSections, section];
    setEditingQuote({ ...editingQuote, sections: updated });
  };

  const handleAddNewSection = () => {
    const name = prompt("Inserisci il nome della nuova sezione:");
    if (name && name.trim()) {
      const currentSections = editingQuote.sections || [];
      if (!currentSections.includes(name.trim())) {
        setEditingQuote({
          ...editingQuote,
          sections: [...currentSections, name.trim()]
        });
      }
    }
  };

  const handleSave = () => {
    saveQuote({ ...editingQuote, total });
  };

  return (
    <>
      <Topbar badgeText="Draft" />
      <section className="content">
        <div className="create-grid">
          <aside className="assistant-panel">
            <div className="panel-section">
              <h2 className="panel-title"><Icon name="spark" />AI Assistant</h2>
              <div className="chat">
                <div className="bubble ai">Dimmi cosa vuoi cambiare: riscrivo descrizioni, aggiungo sezioni, adatto il tono e preparo il preventivo per l'esportazione.</div>
                <div className="bubble user">Rendi il documento {tone} e più chiaro per un cliente non tecnico.</div>
                <div className="prompt">
                  <input value={tone} onChange={(e) => setTone(e.target.value)} aria-label="Prompt AI" placeholder="Scrivi una richiesta..." />
                  <button className="send" aria-label="Invia prompt" onClick={() => alert("L'assistente AI è disattivato. Puoi personalizzare il preventivo usando i controlli manuali a destra o i preset di colore/stile.")}>↑</button>
                </div>
              </div>
            </div>
            
            <div className="panel-section">
              <h2 className="panel-title"><Icon name="palette" />Template base</h2>
              <div className="template-list">
                <button 
                  className={`template ${editingQuote.template === "standard" ? "active" : ""}`} 
                  onClick={() => setEditingQuote({ ...editingQuote, template: "standard" })}
                >Standard</button>
                <button 
                  className={`template ${editingQuote.template === "autore" ? "active" : ""}`} 
                  onClick={() => setEditingQuote({ ...editingQuote, template: "autore" })}
                >Sito Autore</button>
              </div>
            </div>

            <div className="panel-section">
              <h2 className="panel-title"><Icon name="palette" />Colore Brand</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                {COLORS.map(c => (
                  <button 
                    key={c.value} 
                    onClick={() => setEditingQuote({ ...editingQuote, color: c.value })}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: c.value,
                      border: editingQuote.color === c.value ? '3px solid #000' : '1px solid #ccc',
                      boxShadow: editingQuote.color === c.value ? '0 0 8px rgba(0,0,0,0.2)' : 'none',
                      cursor: 'pointer',
                      padding: 0
                    }}
                    title={c.name}
                    aria-label={`Imposta colore ${c.name}`}
                  />
                ))}
              </div>
              
              <h2 className="panel-title" style={{ marginTop: '16px' }}><Icon name="settings" />Stile Documento</h2>
              <select 
                value={editingQuote.styleId || "standard"} 
                onChange={(e) => setEditingQuote({ ...editingQuote, styleId: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '12px', border: '1px solid var(--line)' }}
                aria-label="Seleziona stile documento"
              >
                {STYLES.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="panel-section">
              <h2 className="panel-title"><Icon name="edit" />Content editor</h2>
              <div className="field"><label>Cliente</label><input value={editingQuote.client} onChange={(e) => setEditingQuote({ ...editingQuote, client: e.target.value })} /></div>
              <div className="field"><label>Data</label><input value={editingQuote.date} onChange={(e) => setEditingQuote({ ...editingQuote, date: e.target.value })} /></div>
              <div className="field"><label>Titolo preventivo</label><input value={editingQuote.title} onChange={(e) => setEditingQuote({ ...editingQuote, title: e.target.value })} /></div>
              <div className="field"><label>IVA %</label><input type="number" value={editingQuote.vat} onChange={(e) => setEditingQuote({ ...editingQuote, vat: Number(e.target.value) })} /></div>
            </div>
          </aside>
          
          <div className="canvas-wrap">
            <div className="editor-bar">
              <div><h2>Crea il tuo preventivo</h2><p>Modifica testi, prezzi, sezioni e stile con anteprima documento live.</p></div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="ghost" onClick={handleSave}><Icon name="copy" />Salva</button>
                <button className="primary" onClick={handleAddNewSection}><Icon name="plus" />Nuova sezione</button>
              </div>
            </div>
            
            <div className="doc-stage" aria-label="Anteprima preventivo" style={{ '--accent': editingQuote.color }}>
              {editingQuote.template === "autore" ? (
                <AuthorQuoteTemplate client={editingQuote.client} date={editingQuote.date} styleId={editingQuote.styleId} />
              ) : (
                <article className={`document style-${editingQuote.styleId}`}>
                  <div className="doc-topline" />
                  <div className="doc-head">
                    <div>
                      <h3>PREVENTIVO</h3>
                      <p>{editingQuote.title}</p>
                      <p className="muted">{editingQuote.id}</p>
                    </div>
                    <div className="company">
                      <strong>Giovanni Cidu</strong><br />
                      Soluzioni Digitali<br />
                      P.IVA IT00000000000
                    </div>
                  </div>
                  <div className="meta">
                    <div>
                      <span className="kicker">Preparato per</span>
                      <strong>{editingQuote.client || "Cliente"}</strong>
                      <span className="muted">Referente: Giovanni Cidu</span>
                    </div>
                    <div>
                      <span className="kicker">Data</span>
                      <strong>{editingQuote.date}</strong>
                    </div>
                    <div>
                      <span className="kicker">Validità</span>
                      <strong>30 giorni</strong>
                    </div>
                  </div>
                  <p className="intro">Realizzazione di una presenza web professionale, responsiva e facilmente aggiornabile. Il documento include attività operative, condizioni e materiali necessari per avviare il progetto senza ambiguità.</p>
                  
                  <table className="line-items">
                    <thead>
                      <tr>
                        <th>Descrizione</th>
                        <th className="num">Q.tà</th>
                        <th className="num">Tariffa</th>
                        <th className="num">Importo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editingQuote.items.map(item => (
                        <tr key={item.id}>
                          <td className="desc">
                            <strong>{item.description}</strong>
                            <span>{item.detail}</span>
                          </td>
                          <td className="num">{item.qty}</td>
                          <td className="num">{money(item.rate)}</td>
                          <td className="num">{money(item.qty * item.rate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  <div className="totals">
                    <div className="total-row">
                      <span>Subtotale</span>
                      <strong>{money(subtotal)}</strong>
                    </div>
                    <div className="total-row">
                      <span>IVA {editingQuote.vat}%</span>
                      <strong>{money(subtotal * editingQuote.vat / 100)}</strong>
                    </div>
                    <div className="total-row grand">
                      <span>Totale</span>
                      <strong>{money(total)}</strong>
                    </div>
                  </div>
                  
                  <div className="doc-sections">
                    {editingQuote.sections.map(s => (
                      <div className="doc-section" key={s}>
                        <strong>{s}</strong>
                        <br />Contenuto personalizzabile e riordinabile dal pannello laterale.
                      </div>
                    ))}
                  </div>
                  
                  <footer className="doc-foot">
                    <span>Giovanni Cidu • Soluzioni Digitali</span>
                    <span>Preventivo valido 30 giorni</span>
                  </footer>
                </article>
              )}
            </div>
          </div>
          
          <aside className="inspector" aria-label="Inspector preventivo">
            <section>
              <h2 className="panel-title"><Icon name="edit" />Voci economiche</h2>
              {editingQuote.items.map(item => (
                <div className="item-editor" key={item.id}>
                  <input value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} aria-label="Descrizione voce" />
                  <textarea value={item.detail} onChange={(e) => updateItem(item.id, "detail", e.target.value)} aria-label="Dettagli voce" />
                  <div className="row">
                    <input type="number" value={item.qty} onChange={(e) => updateItem(item.id, "qty", e.target.value)} aria-label="Quantità" />
                    <input type="number" value={item.rate} onChange={(e) => updateItem(item.id, "rate", e.target.value)} aria-label="Tariffa" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                      <strong>{money(item.qty * item.rate)}</strong>
                      <button 
                        onClick={() => {
                          const filtered = editingQuote.items.filter(i => i.id !== item.id);
                          setEditingQuote({ ...editingQuote, items: filtered });
                        }}
                        style={{ border: 'none', background: 'transparent', padding: '4px', cursor: 'pointer', color: 'var(--muted)' }}
                        title="Rimuovi voce"
                        aria-label="Rimuovi voce"
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <button 
                className="ghost" 
                onClick={() => {
                  const newId = editingQuote.items.length ? Math.max(...editingQuote.items.map(i => i.id)) + 1 : 1;
                  const newItem = { id: newId, description: "Nuova voce", detail: "Descrizione dettagliata...", qty: 1, rate: 100 };
                  setEditingQuote({ ...editingQuote, items: [...editingQuote.items, newItem] });
                }}
                style={{ width: '100%', marginTop: '10px', display: 'flex', gap: '8px', justifyContent: 'center' }}
              >
                <Icon name="plus" /> Aggiungi Voce
              </button>
            </section>
            
            <section>
              <h2 className="panel-title"><Icon name="plus" />Sezioni documento</h2>
              <div className="chips">
                {sectionLibrary.map(section => (
                  <button 
                    className="chip" 
                    key={section} 
                    onClick={() => addSection(section)}
                  >
                    {editingQuote.sections.includes(section) ? "✓ " : "+ "}
                    {section}
                  </button>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </>
  );
}
