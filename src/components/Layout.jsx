import React from 'react';
import Icon from './Icon.jsx';
import GlobalStyles from './GlobalStyles.jsx';

export default function Layout({ children, view, setView, activity }) {
  return (
    <main className="app-shell">
      <GlobalStyles />
      <aside className="sidebar" aria-label="Navigazione principale">
        <div className="brand"><span>PQ</span><div><strong>PrecisionQuote</strong><small>Preventivi custom</small></div></div>
        <nav className="nav" aria-label="Sezioni prodotto">
          <button className={view === 'editor' ? 'active' : ''} onClick={() => setView('editor')}><Icon name="plus" />Editor</button>
          <button className={view === 'collection' ? 'active' : ''} onClick={() => setView('collection')}><Icon name="folder" />Collection</button>
        </nav>
        <div className="side-card"><b>No dashboard</b><p>Solo flusso utile: crea, modifica con AI, salva e ritrova preventivi.</p></div>
        <div className="side-utility"><button><Icon name="settings" />Manual controls</button><button><Icon name="spark" />AI modifier</button></div>
      </aside>
      <section className="workspace" aria-live="polite">{children}</section>
      {activity && <div className="toast">{activity}</div>}
    </main>
  );
}
