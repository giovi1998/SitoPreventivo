import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Topbar from '../components/Topbar.jsx';
import { AppContext } from '../../App.jsx';
import { money } from '../constants.js';

export default function CollectionPage() {
  const { quotes, searchQuery, duplicateQuote, deleteQuote } = React.useContext(AppContext);
  const [statusFilter, setStatusFilter] = React.useState("Tutti gli stati");
  
  // Applica filtri
  const filteredQuotes = quotes.filter(q => {
    const matchesSearch = 
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.client && q.client.toLowerCase().includes(searchQuery.toLowerCase())) ||
      q.id.toLowerCase().includes(searchQuery.toLowerCase());
      
    if (statusFilter === "Tutti gli stati") return matchesSearch;
    
    // Normalizza "Bozze" dropdown a "Bozza" nel campo status del preventivo
    const filterNormal = statusFilter.toLowerCase() === "bozze" ? "bozza" : statusFilter.toLowerCase();
    return matchesSearch && q.status.toLowerCase() === filterNormal;
  });
  
  return (
    <>
      <Topbar badgeText="Workspace" />
      <section className="content">
        <div>
          <div className="collection-head">
            <div><h2>Collection</h2><p>Gestisci, rivedi, duplica o elimina i preventivi salvati.</p></div>
            <div className="filters">
              <select 
                aria-label="Filtra stato" 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option>Tutti gli stati</option>
                <option>Bozze</option>
                <option>Inviati</option>
                <option>Accettati</option>
              </select>
              <Link to="/" className="primary"><Icon name="plus" />Crea nuovo</Link>
            </div>
          </div>
          <div className="quote-list">
            {filteredQuotes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(255,255,255,.5)', borderRadius: '22px', border: '1px dashed var(--line)' }}>
                <p style={{ color: 'var(--muted)', fontSize: '1.1rem', margin: 0 }}>Nessun preventivo trovato.</p>
              </div>
            ) : (
              filteredQuotes.map(q => (
                <article className="collection-card" key={q.id}>
                  <span className={`status ${q.status.toLowerCase().replace(" ", "")}`}>{q.status}</span>
                  <div className="quote-title"><strong>{q.title}</strong><span>{q.id}</span></div>
                  <div>{q.client || "Nessun cliente"}<br /><span className="muted">{q.owner}</span></div>
                  <div className="muted">{q.date}<br /><strong>{money(q.total)}</strong></div>
                  <div className="actions">
                    <Link to={`/?id=${q.id}`} className="action"><Icon name="edit" />Modifica</Link>
                    <button className="action" onClick={() => duplicateQuote(q)}><Icon name="copy" />Duplica</button>
                    <button className="action" onClick={() => deleteQuote(q.id)}><Icon name="trash" />Elimina</button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </>
  );
}
