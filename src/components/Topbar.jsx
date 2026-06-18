import React from 'react';

function formatTime(date) {
  return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export default function Topbar({ view, onSave, onExport, lastSaveTime, isDirty, pdfLoading, onSaveAsTemplate, theme, setTheme }) {
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  return (
    <header className="topbar">
      <div>
        <p>{view === "editor" ? "Editor operativo" : view === "admin" ? "Pannello di controllo" : view === "settings" ? "Gestione credenziali" : "Raccolta preventivi"}</p>
        <h1>{view === "editor" ? "Editor preventivo" : view === "admin" ? "Admin" : view === "settings" ? "Impostazioni" : "Collection"}</h1>
      </div>
      <div className="top-actions" style={{ alignItems: 'center' }}>
        {view === "editor" && (
          <>
            <div className="save-status" style={{ marginRight: '8px' }}>
              {isDirty ? (
                <span style={{ color: 'var(--amber)', fontSize: '.75rem', fontWeight: 600 }}>● Modifiche non salvate</span>
              ) : lastSaveTime ? (
                <span style={{ color: 'var(--green)', fontSize: '.75rem', fontWeight: 600 }}>● Salvato alle {formatTime(lastSaveTime)}</span>
              ) : null}
            </div>
            <button onClick={onSave} className="top-btn-save" title="Salva (Ctrl+S)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              <span>Salva</span>
            </button>
            {onSaveAsTemplate && (
              <button onClick={onSaveAsTemplate} className="top-btn-save" title="Salva come template">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                <span>Template</span>
              </button>
            )}
            <button className="top-btn-export" onClick={onExport} title="Esporta PDF (Ctrl+P)" disabled={pdfLoading}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>{pdfLoading ? 'Generazione...' : 'Esporta PDF'}</span>
            </button>
          </>
        )}
        <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'}>
          {theme === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          )}
        </button>
      </div>
    </header>
  );
}
