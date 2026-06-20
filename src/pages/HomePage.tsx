import React from 'react';
import { Link } from 'react-router-dom';

interface HomePageProps {
  user: any;
}

export default function HomePage({ user }: HomePageProps) {
  return (
    <div className="home-page">
      <header className="home-header">
        <div className="home-header-inner">
          <div className="home-logo">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#0B57D0"/>
              <path d="M8 10h16M8 16h12M8 22h8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <span>PrecisionQuote</span>
          </div>
          <nav className="home-nav">
            {user ? (
              <Link to="/app" className="home-btn-primary">Vai all'App</Link>
            ) : (
              <>
                <Link to="/login" className="home-btn-ghost">Accedi</Link>
                <Link to="/login?register=1" className="home-btn-primary">Registrati</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="home-hero">
        <div className="home-hero-bg" />
        <div className="home-hero-content">
          <div className="home-hero-badge">Gratis per sempre</div>
          <h1>Preventivi professionali<br/>in minuti, non in ore.</h1>
          <p>Crea, personalizza e condividi preventivi multi-opzione con layout PDF professionale. Costi contenuti, zero abbonamenti.</p>
          {user ? (
            <Link to="/app" className="home-cta">Vai all'App →</Link>
          ) : (
            <Link to="/login?register=1" className="home-cta">Inizia gratis →</Link>
          )}
        </div>
      </section>

      <section className="home-features">
        <div className="home-feature-card">
          <div className="home-feature-icon" style={{ background: '#e8f0fe', color: '#0B57D0' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
          </div>
          <h3>4 Opzioni per Preventivo</h3>
          <p>Ogni preventivo contiene fino a 4 opzioni tariffarie, ognuna con costi una tantum e mensili, descrizione dettagliata e flag manutenzione.</p>
        </div>
        <div className="home-feature-card">
          <div className="home-feature-icon" style={{ background: '#fef3e2', color: '#ea580c' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          </div>
          <h3>Layout PDF Professionale</h3>
          <p>Esporta in PDF con layout elegante: opzioni, IVA, acconto, saldo, clausole e riepilogo comparativo. Zero problemi di page break.</p>
        </div>
        <div className="home-feature-card">
          <div className="home-feature-icon" style={{ background: '#e0f2e9', color: '#059669' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h3>AI Integrata</h3>
          <p>Modifica il preventivo con linguaggio naturale: "Rendi premium", "Applica sconto 10%", "Aggiungi clausola FAQ". Assistito da DeepSeek.</p>
        </div>
        <div className="home-feature-card">
          <div className="home-feature-icon" style={{ background: '#f3e8ff', color: '#7c3aed' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
          </div>
          <h3>Collection & Stati</h3>
          <p>Gestisci tutti i preventivi in un'unica collezione. Imposta stati BOZZA, INVIATO, ACCETTATO, RIFIUTATO. Duplica e apri in modifica con un click.</p>
        </div>
      </section>

      <section className="home-pricing">
        <h2>Costi Contenuti</h2>
        <div className="home-pricing-cards">
          <div className="home-pricing-card home-pricing-featured">
            <div className="home-pricing-glow" />
            <h3>Gratuito</h3>
            <div className="home-price"><span>€0</span> / forever</div>
            <ul>
              <li>Preventivi illimitati</li>
              <li>4 opzioni per preventivo</li>
              <li>Esportazione PDF</li>
              <li>AI DeepSeek (con chiave API)</li>
              <li>Collection e stati</li>
              <li>Nessun limite di utenti</li>
            </ul>
            {user ? (
              <Link to="/app" className="home-cta-secondary">Vai all'App</Link>
            ) : (
              <Link to="/login?register=1" className="home-cta-secondary">Registrati ora</Link>
            )}
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-footer-inner">
          <p>© 2026 PrecisionQuote. Tutti i diritti riservati.</p>
          <p style={{ color: '#94a3b8', fontSize: '.8rem', marginTop: '4px' }}>Sviluppato per uso personale — Giovanni Cidu</p>
        </div>
      </footer>

      <style>{`
        .home-page{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#07111f;background:#f8fafc;min-height:100vh}
        [data-theme="dark"] .home-page{color:#e8eaf0;background:#0f1117}
        .home-header{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(255,255,255,.85);backdrop-filter:blur(12px);border-bottom:1px solid #e2e8f0}
        [data-theme="dark"] .home-header{background:rgba(15,17,23,.85);border-bottom-color:#2d3044}
        .home-header-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:14px 24px}
        .home-logo{display:flex;align-items:center;gap:10px;font-weight:800;font-size:1.05rem;color:#07111f}
        [data-theme="dark"] .home-logo{color:#e8eaf0}
        .home-nav{display:flex;align-items:center;gap:12px}
        .home-btn-ghost{padding:8px 18px;border-radius:10px;font-weight:600;font-size:.9rem;color:#0B57D0;text-decoration:none;transition:background .2s}
        .home-btn-ghost:hover{background:#e8f0fe}
        [data-theme="dark"] .home-btn-ghost:hover{background:rgba(77,148,255,.1)}
        .home-btn-primary{padding:8px 18px;border-radius:10px;font-weight:600;font-size:.9rem;color:#fff;background:#0B57D0;text-decoration:none;transition:box-shadow .2s,transform .15s}
        .home-btn-primary:hover{box-shadow:0 4px 12px rgba(11,87,208,.3);transform:translateY(-1px)}
        .home-hero{position:relative;padding:160px 24px 110px;text-align:center;overflow:hidden}
        .home-hero-bg{position:absolute;inset:0;background:linear-gradient(160deg,#082033 0%,#0B57D0 50%,#3b82f6 100%);opacity:.06}
        [data-theme="dark"] .home-hero-bg{opacity:.1}
        .home-hero-content{position:relative;max-width:700px;margin:0 auto}
        .home-hero-badge{display:inline-block;padding:6px 16px;background:#e8f0fe;color:#0B57D0;border-radius:100px;font-size:.78rem;font-weight:700;letter-spacing:.02em;margin-bottom:24px}
        [data-theme="dark"] .home-hero-badge{background:rgba(77,148,255,.12);color:#4d94ff}
        .home-hero h1{font-size:3.2rem;font-weight:900;letter-spacing:-0.04em;line-height:1.12;margin:0 0 20px}
        .home-hero p{font-size:1.15rem;color:#475569;line-height:1.6;margin:0 0 36px;max-width:520px;margin-left:auto;margin-right:auto}
        [data-theme="dark"] .home-hero p{color:#8892a8}
        .home-cta{display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#0B57D0,#1d4ed8);color:#fff;border-radius:14px;font-weight:700;font-size:1.05rem;text-decoration:none;box-shadow:0 4px 20px rgba(11,87,208,.35);transition:transform .15s,box-shadow .2s}
        .home-cta:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(11,87,208,.45)}
        .home-features{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px;max-width:1100px;margin:0 auto;padding:0 24px 80px}
        .home-feature-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;transition:box-shadow .3s,transform .2s,border-color .3s}
        [data-theme="dark"] .home-feature-card{background:#1a1d27;border-color:#2d3044}
        .home-feature-card:hover{box-shadow:0 8px 24px rgba(0,0,0,.06);transform:translateY(-2px);border-color:#c7d2e0}
        [data-theme="dark"] .home-feature-card:hover{box-shadow:0 8px 24px rgba(0,0,0,.3);border-color:#3d4054}
        .home-feature-icon{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;margin-bottom:16px}
        .home-feature-card h3{font-size:1rem;font-weight:800;margin:0 0 8px}
        .home-feature-card p{font-size:.85rem;color:#647086;line-height:1.5;margin:0}
        [data-theme="dark"] .home-feature-card h3{color:#e8eaf0}
        [data-theme="dark"] .home-feature-card p{color:#8892a8}
        .home-pricing{padding:0 24px 80px;text-align:center}
        .home-pricing h2{font-size:2rem;font-weight:900;letter-spacing:-0.03em;margin:0 0 40px}
        .home-pricing-cards{display:flex;justify-content:center}
        .home-pricing-card{position:relative;background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:36px;max-width:360px;width:100%;text-align:left;overflow:hidden}
        [data-theme="dark"] .home-pricing-card{background:#1a1d27;border-color:#2d3044}
        .home-pricing-glow{position:absolute;inset:-2px;border-radius:22px;background:linear-gradient(135deg,#0B57D0,#3b82f6,#0B57D0);opacity:0;transition:opacity .3s;z-index:-1}
        .home-pricing-featured .home-pricing-glow{opacity:.5}
        .home-pricing-featured{border-color:transparent;box-shadow:0 0 0 1px #0B57D0,0 8px 24px rgba(11,87,208,.1)}
        .home-pricing-featured:hover .home-pricing-glow{opacity:.8}
        .home-pricing-card h3{font-size:1.2rem;font-weight:800;margin:0 0 8px}
        .home-price{font-size:.9rem;color:#647086;margin-bottom:20px}
        .home-price span{font-size:2.5rem;font-weight:900;color:#07111f}
        [data-theme="dark"] .home-price{color:#8892a8}
        [data-theme="dark"] .home-price span{color:#e8eaf0}
        .home-pricing-card ul{list-style:none;padding:0;margin:0 0 24px;display:grid;gap:12px}
        .home-pricing-card ul li{padding-left:24px;position:relative;font-size:.9rem;color:#475569}
        [data-theme="dark"] .home-pricing-card ul li{color:#8892a8}
        .home-pricing-card ul li::before{content:'';position:absolute;left:0;top:5px;width:14px;height:14px;background:#0B57D0;border-radius:50%;opacity:.15}
        .home-pricing-card ul li::after{content:'';position:absolute;left:4px;top:9px;width:6px;height:3px;border-left:2px solid #0B57D0;border-bottom:2px solid #0B57D0;transform:rotate(-45deg)}
        .home-cta-secondary{display:block;text-align:center;padding:12px;background:#e8f0fe;color:#0B57D0;border-radius:12px;font-weight:700;font-size:.95rem;text-decoration:none;transition:background .2s}
        .home-cta-secondary:hover{background:#d2e3fc}
        [data-theme="dark"] .home-cta-secondary{background:rgba(77,148,255,.1);color:#4d94ff}
        [data-theme="dark"] .home-cta-secondary:hover{background:rgba(77,148,255,.18)}
        .home-footer{border-top:1px solid #e2e8f0;padding:24px;text-align:center}
        [data-theme="dark"] .home-footer{border-top-color:#2d3044}
        .home-footer-inner{max-width:1100px;margin:0 auto;font-size:.85rem;color:#647086}
        [data-theme="dark"] .home-footer-inner{color:#8892a8}
        @keyframes heroGlow{0%,100%{opacity:.06}50%{opacity:.1}}
        .home-hero-bg{animation:heroGlow 4s ease-in-out infinite}
        @media(max-width:640px){
          .home-hero h1{font-size:2rem}
          .home-hero{padding:110px 20px 60px}
          .home-features{grid-template-columns:1fr;padding:0 20px 60px}
        }
      `}</style>
    </div>
  );
}
