import React from 'react';

export default function Layout({ children, view, setView, onLogout, user }) {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
              <path d="M8 10h16M8 16h12M8 22h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <strong>PrecisionQuote</strong>
            <small>Preventivi custom</small>
          </div>
        </div>

        <nav aria-label="Navigazione principale">
          <button className={view === "editor" ? "active" : ""} onClick={() => setView("editor")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Editor
          </button>
          <button className={view === "collection" ? "active" : ""} onClick={() => setView("collection")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            Collection
          </button>
          {user?.role === 'admin' && (
            <button className={view === "admin" ? "active" : ""} onClick={() => setView("admin")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              Admin
            </button>
          )}
        </nav>

        <div className="side-card">
          <div className="side-user">
            <div className="side-avatar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div>
              <b>Benvenuto{user ? `, ${user.username}` : ''}</b>
              <p>{user ? user.email : 'Non connesso'}</p>
            </div>
          </div>
          {user && (
            <>
              {user.注册Date && (
                <p style={{ fontSize: '.7rem', color: '#8896ab', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
                  Membro dal {user.注册Date}
                </p>
              )}
              <button onClick={onLogout} className="logout-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Logout
              </button>
            </>
          )}
          {!user && (
            <a href="/login" className="login-link">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              Login
            </a>
          )}
        </div>
      </aside>
      <section className="workspace" aria-live="polite">{children}</section>
    </main>
  );
}
