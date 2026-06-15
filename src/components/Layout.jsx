import React from 'react';

export default function Layout({ children, view, setView, onLogout, user }) {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span>PQ</span><div><strong>PrecisionQuote</strong><small>Preventivi custom</small></div></div>
        <nav aria-label="Navigazione principale">
          <button className={view === "editor" ? "active" : ""} onClick={() => setView("editor")}>Editor</button>
          <button className={view === "collection" ? "active" : ""} onClick={() => setView("collection")}>Collection</button>
        </nav>
        <div className="side-card">
          <b>Benvenuto{user ? `, ${user.username}` : ''}</b>
          <p>{user ? user.email : 'Non connesso'}</p>
          {user && <p style={{ fontSize: '.72rem', color: '#b9c7d8', marginTop: '8px' }}>Membro dal: {user.注册Date}</p>}
        </div>
        <div className="side-utility">
          {user && <button onClick={onLogout}>Logout</button>}
          {!user && <a href="/login" style={{ display: 'block', padding: '12px', background: 'transparent', color: '#cfe0f2', border: '1px solid rgba(255,255,255,.14)', borderRadius: '12px', textDecoration: 'none', textAlign: 'left', fontWeight: '850' }}>Login</a>}
        </div>
      </aside>
      <section className="workspace" aria-live="polite">{children}</section>
    </main>
  );
}
