import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="notfound-page">
      <div className="notfound-shapes">
        <div className="notfound-shape shape-1" />
        <div className="notfound-shape shape-2" />
        <div className="notfound-shape shape-3" />
        <div className="notfound-shape shape-4" />
        <div className="notfound-shape shape-5" />
      </div>

      <div className="notfound-content">
        <div className="notfound-number">
          <span className="digit-4a">4</span>
          <div className="notfound-circle">
            <svg viewBox="0 0 120 120" fill="none">
              <circle cx="60" cy="60" r="56" stroke="rgba(11,87,208,0.15)" strokeWidth="3" strokeDasharray="8 6"/>
              <circle cx="60" cy="60" r="40" stroke="rgba(11,87,208,0.08)" strokeWidth="2"/>
              <text x="60" y="68" textAnchor="middle" fill="#0B57D0" fontSize="36" fontWeight="900" fontFamily="ui-sans-serif,system-ui,sans-serif">?</text>
            </svg>
          </div>
          <span className="digit-4b">4</span>
        </div>

        <h1 className="notfound-title">Pagina persa nel vuoto</h1>
        <p className="notfound-desc">
          La pagina che cerchi non esiste, è stata spostata, o forse non è mai esistita.
          <br />Nessun preventivo può salvare questa situazione.
        </p>

        <div className="notfound-actions">
          <Link to="/" className="notfound-btn primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Torna alla home
          </Link>
          <button onClick={() => window.history.back()} className="notfound-btn secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Torna indietro
          </button>
        </div>

        <div className="notfound-footer">
          <p>Se pensi sia un errore, contatta <strong>Giovanni Cidu</strong></p>
        </div>
      </div>

      <style>{`
        .notfound-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#f8fafc 0%,#eef3fb 50%,#f1f5f9 100%);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;position:relative;overflow:hidden;padding:40px}
        [data-theme="dark"] .notfound-page{background:linear-gradient(160deg,#0f1117 0%,#1a1d27 50%,#151821 100%);color:#e8eaf0}
        .notfound-shapes{position:absolute;inset:0;pointer-events:none}
        .notfound-shape{position:absolute;border-radius:50%;opacity:0.06}
        .shape-1{width:400px;height:400px;background:#0B57D0;top:-100px;right:-80px;animation:float-shape 20s ease-in-out infinite}
        .shape-2{width:200px;height:200px;background:#3b82f6;bottom:-50px;left:-60px;animation:float-shape 15s ease-in-out infinite reverse}
        .shape-3{width:120px;height:120px;background:#0B57D0;top:30%;left:10%;animation:float-shape 18s ease-in-out infinite 2s}
        .shape-4{width:80px;height:80px;background:#60a5fa;top:20%;right:20%;animation:float-shape 12s ease-in-out infinite 1s}
        .shape-5{width:160px;height:160px;background:#1d4ed8;bottom:20%;right:10%;animation:float-shape 22s ease-in-out infinite 3s}
        @keyframes float-shape{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(20px,-30px) scale(1.05)}50%{transform:translate(-10px,20px) scale(0.95)}75%{transform:translate(15px,10px) scale(1.02)}}
        .notfound-content{text-align:center;position:relative;z-index:2;max-width:520px}
        .notfound-number{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:32px}
        .digit-4a,.digit-4b{font-size:8rem;font-weight:950;color:#07111f;line-height:1;letter-spacing:-0.04em;opacity:0.08}
        [data-theme="dark"] .digit-4a,[data-theme="dark"] .digit-4b{color:#e8eaf0}
        .notfound-circle{width:120px;height:120px;animation:spin-slow 12s linear infinite}
        .notfound-circle svg{width:100%;height:100%}
        @keyframes spin-slow{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .notfound-title{font-size:1.75rem;font-weight:900;color:#07111f;margin:0 0 16px;letter-spacing:-0.03em}
        [data-theme="dark"] .notfound-title{color:#e8eaf0}
        .notfound-desc{font-size:1rem;color:#647086;margin:0 0 40px;line-height:1.7}
        [data-theme="dark"] .notfound-desc{color:#8892a8}
        .notfound-actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
        .notfound-btn{display:inline-flex;align-items:center;gap:10px;padding:14px 28px;border-radius:14px;font-size:.95rem;font-weight:700;text-decoration:none;cursor:pointer;transition:transform .15s,box-shadow .15s,border-color .15s}
        .notfound-btn.primary{background:#0B57D0;color:#fff;border:2px solid #0B57D0;box-shadow:0 4px 14px rgba(11,87,208,0.25)}
        .notfound-btn.primary:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(11,87,208,0.35)}
        .notfound-btn.secondary{background:#fff;color:#475569;border:2px solid #e2e8f0}
        [data-theme="dark"] .notfound-btn.secondary{background:#1a1d27;color:#8892a8;border-color:#2d3044}
        .notfound-btn.secondary:hover{border-color:#0B57D0;color:#0B57D0;transform:translateY(-2px)}
        .notfound-footer{margin-top:48px;padding:16px 24px;background:rgba(255,255,255,0.7);border-radius:14px;border:1px solid #e2e8f0;backdrop-filter:blur(12px);display:inline-block}
        [data-theme="dark"] .notfound-footer{background:rgba(26,29,39,0.7);border-color:#2d3044}
        .notfound-footer p{margin:0;font-size:.88rem;color:#647086}
        [data-theme="dark"] .notfound-footer p{color:#8892a8}
        .notfound-footer strong{color:#07111f}
        [data-theme="dark"] .notfound-footer strong{color:#e8eaf0}
        @media(max-width:600px){
          .digit-4a,.digit-4b{font-size:5rem}
          .notfound-circle{width:80px;height:80px}
          .notfound-title{font-size:1.35rem}
          .notfound-desc{font-size:.9rem}
          .notfound-actions{flex-direction:column;align-items:stretch}
          .notfound-btn{justify-content:center}
        }
      `}</style>
    </div>
  );
}
