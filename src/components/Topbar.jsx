import React from 'react';
import Icon from './Icon.jsx';

export default function Topbar({ view, searchQuery, setSearchQuery, onSave, onExport }) {
  const isEditor = view === 'editor';
  return (
    <header className="topbar">
      <div><p>{isEditor ? 'Editor operativo' : 'Raccolta preventivi'}</p><h1>{isEditor ? 'Editor preventivo' : 'Collection'}</h1></div>
      <div className="top-actions">
        <input className="search" aria-label="Cerca preventivi" placeholder="Cerca preventivi, clienti, sezioni..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        {isEditor && <button onClick={onSave}>Salva</button>}
        <button className="primary" onClick={onExport}><Icon name="download" />Esporta PDF</button>
      </div>
    </header>
  );
}
