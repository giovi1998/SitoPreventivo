import React from 'react';

export default function Topbar({ view, onSave, onExport }) {
  return (
    <header className="topbar">
      <div>
        <p>{view === "editor" ? "Editor operativo" : "Raccolta preventivi"}</p>
        <h1>{view === "editor" ? "Editor preventivo" : "Collection"}</h1>
      </div>
      {view === "editor" && (
        <div className="top-actions">
          <button onClick={onSave} className="top-btn-save">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Salva
          </button>
          <button className="top-btn-export" onClick={onExport}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Esporta PDF
          </button>
        </div>
      )}
    </header>
  );
}
