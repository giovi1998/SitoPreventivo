import React from 'react';

export default function Topbar({ view, onSave, onExport }) {
  return (
    <header className="topbar">
      <div><p>{view === "editor" ? "Editor operativo" : "Raccolta preventivi"}</p><h1>{view === "editor" ? "Editor preventivo" : "Collection"}</h1></div>
      <div className="top-actions"><button onClick={onSave}>Salva</button><button className="primary" onClick={onExport}>Esporta PDF</button></div>
    </header>
  );
}
