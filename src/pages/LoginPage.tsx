import React, { useState, useContext } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../../App';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(() => searchParams.get('register') === '1');
  const { login, register } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email || !password) {
      setError('Compila tutti i campi obbligatori');
      setLoading(false);
      return;
    }

    if (isRegister && !username) {
      setError('Inserisci un username');
      setLoading(false);
      return;
    }

    const result = (isRegister ? await register(email, password, username, gender) : await login(email, password)) as { success?: boolean; error?: string };
    if (result.success) {
      navigate('/app', { replace: true });
    } else {
      const hint = result.error?.includes('timeout') ? ' (verifica connessione o riprova)' :
        result.error?.includes('409') ? ' — account già esistente' :
        result.error?.includes('401') ? ' — credenziali errate' :
        '';
      setError(`${result.error}${hint}`);
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-brand-panel">
        <div className="auth-brand-content">
          <div className="auth-logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="white" fillOpacity="0.15"/>
              <path d="M8 10h16M8 16h12M8 22h8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="24" cy="22" r="4" fill="white" fillOpacity="0.3" stroke="white" strokeWidth="1.5"/>
            </svg>
          </div>
          <h1 className="auth-brand-name">Quickbrand</h1>
          <p className="auth-brand-tagline">Preventivi professionali in minuti, non in ore.</p>

          <div className="auth-features">
            <div className="auth-feature">
              <div className="auth-feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              </div>
              <div>
                <strong>Multi-opzione</strong>
                <span>4 opzioni per ogni preventivo</span>
              </div>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><path d="M12 6v6l4 2"/></svg>
              </div>
              <div>
                <strong>Esporta PDF</strong>
                <span>Layout professionale in un click</span>
              </div>
            </div>
            <div className="auth-feature">
              <div className="auth-feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <div>
                <strong>AI Integrata</strong>
                <span>Modifiche intelligenti con DeepSeek</span>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-dots">
          {Array.from({ length: 48 }, (_, i) => (
            <div key={i} className="auth-dot" style={{ animationDelay: `${(i % 8) * 0.15}s` }} />
          ))}
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-wrapper">
          <div className="auth-mobile-logo">
            <div className="auth-mobile-logo-icon">
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                <path d="M8 10h16M8 16h12M8 22h8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span>Quickbrand</span>
          </div>

          <div className="auth-form-header">
            <h2>{isRegister ? 'Crea il tuo account' : 'Bentornato'}</h2>
            <p>{isRegister ? 'Registrati per iniziare a creare preventivi' : 'Accedi per continuare a creare preventivi'}</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {isRegister && (
              <div className="auth-field">
                <label htmlFor="reg-username">Username</label>
                <div className="auth-input-wrap">
                  <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <input
                    id="reg-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Il tuo username"
                  />
                </div>
              </div>
            )}

            {isRegister && (
              <div className="auth-field">
                <label htmlFor="reg-gender">Sesso</label>
                <div className="auth-input-wrap">
                  <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="3"/><path d="M12 8v14M8 12h8"/></svg>
                  <select
                    id="reg-gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    style={{
                      width: '100%', height: '48px', padding: '0 44px',
                      border: '2px solid var(--line)', borderRadius: '12px',
                      fontSize: '.95rem', color: gender ? 'var(--ink)' : 'var(--muted-lt)',
                      background: 'var(--surface)', outline: 'none', cursor: 'pointer',
                      transition: 'border-color .2s, box-shadow .2s',
                    }}
                  >
                    <option value="">Seleziona sesso</option>
                    <option value="male">Maschio</option>
                    <option value="female">Femmina</option>
                    <option value="other">Altro</option>
                  </select>
                </div>
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="auth-email">Email</label>
              <div className="auth-input-wrap">
                <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="La tua email"
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="auth-password">Password</label>
              <div className="auth-input-wrap">
                <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="La tua password"
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="auth-error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                {error}
              </div>
            )}

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? (
                <span className="auth-spinner" />
              ) : (
                <>
                  {isRegister ? 'Crea account' : 'Accedi'}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <div className="auth-toggle">
              {isRegister ? 'Hai già un account?' : "Non hai un account?"}
              <button type="button" onClick={() => { setIsRegister(!isRegister); setError(''); }}>
                {isRegister ? 'Accedi' : 'Registrati'}
              </button>
            </div>
            <Link to="/" className="auth-back">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              Torna alla home
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        .auth-page{display:grid;grid-template-columns:1fr 1fr;min-height:100vh;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        .auth-brand-panel{background:linear-gradient(160deg,#082033 0%,#1A1A1A 50%,#0F0F0F 100%);color:#fff;display:flex;flex-direction:column;justify-content:center;padding:64px;position:relative;overflow:hidden}
        .auth-brand-content{position:relative;z-index:2;max-width:420px}
        .auth-logo{width:56px;height:56px;background:rgba(255,255,255,0.12);border-radius:16px;display:grid;place-items:center;margin-bottom:24px;backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.15)}
        .auth-brand-name{font-size:2rem;font-weight:900;letter-spacing:-0.04em;margin:0 0 12px}
        .auth-brand-tagline{font-size:1.05rem;color:rgba(255,255,255,0.7);margin:0 0 48px;line-height:1.5}
        .auth-features{display:grid;gap:20px}
        .auth-feature{display:flex;align-items:flex-start;gap:14px}
        .auth-feature-icon{width:40px;height:40px;background:rgba(255,255,255,0.1);border-radius:12px;display:grid;place-items:center;flex-shrink:0;color:rgba(255,255,255,0.9)}
        .auth-feature strong{display:block;font-size:.88rem;font-weight:700;margin-bottom:2px}
        .auth-feature span{font-size:.8rem;color:rgba(255,255,255,0.6);line-height:1.4}
        .auth-dots{position:absolute;inset:0;display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(6,1fr);gap:24px;padding:40px;opacity:0.08;z-index:1}
        .auth-dot{width:4px;height:4px;background:#fff;border-radius:50%;animation:pulse-dot 3s ease-in-out infinite}
        @keyframes pulse-dot{0%,100%{opacity:0.3;transform:scale(1)}50%{opacity:1;transform:scale(1.5)}}
        .auth-form-panel{background:#f8fafc;display:flex;align-items:center;justify-content:center;padding:40px}
        [data-theme="dark"] .auth-form-panel{background:var(--canvas)}
        .auth-form-wrapper{width:100%;max-width:380px}
        .auth-mobile-logo{display:none;align-items:center;gap:10px;margin-bottom:32px}
        .auth-mobile-logo-icon{width:40px;height:40px;background:var(--accent);border-radius:12px;display:grid;place-items:center}
        .auth-mobile-logo span{font-size:1.15rem;font-weight:800;color:#07111f}
        [data-theme="dark"] .auth-mobile-logo span{color:var(--ink)}
        .auth-form-header{margin-bottom:32px}
        .auth-form-header h2{margin:0 0 8px;font-size:1.75rem;font-weight:900;color:#07111f;letter-spacing:-0.03em}
        [data-theme="dark"] .auth-form-header h2{color:var(--ink)}
        .auth-form-header p{margin:0;font-size:.95rem;color:#647086;line-height:1.5}
        .auth-form{display:grid;gap:18px}
        .auth-field{display:grid;gap:6px}
        .auth-field label{font-size:.72rem;text-transform:uppercase;letter-spacing:0.1em;font-weight:800;color:#647086}
        [data-theme="dark"] .auth-field label{color:var(--muted)}
        .auth-input-wrap{position:relative;display:flex;align-items:center}
        .auth-input-icon{position:absolute;left:14px;color:#94a3b8;pointer-events:none;z-index:1}
        [data-theme="dark"] .auth-input-icon{color:var(--muted-lt)}
        .auth-input-wrap input{width:100%;height:48px;padding:0 44px 0 44px;border:2px solid #e2e8f0;border-radius:12px;font-size:.95rem;color:#07111f;background:#fff;outline:none;transition:border-color .2s,box-shadow .2s}
        [data-theme="dark"] .auth-input-wrap input{border-color:var(--line);color:var(--ink);background:var(--surface)}
        .auth-input-wrap input:focus{border-color:#E62020;box-shadow:0 0 0 4px rgba(230,32,32,0.10)}
        .auth-input-wrap input::placeholder{color:#94a3b8}
        [data-theme="dark"] .auth-input-wrap input::placeholder{color:var(--muted-lt)}
        .auth-eye-btn{position:absolute;right:8px;background:none;border:none;padding:8px;color:#94a3b8;cursor:pointer;display:grid;place-items:center;border-radius:8px;transition:color .15s}
        .auth-eye-btn:hover{color:#475569}
        .auth-error{display:flex;align-items:center;gap:8px;padding:12px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;color:#dc2626;font-size:.85rem;font-weight:500}
        [data-theme="dark"] .auth-error{background:var(--red-bg);border-color:var(--red-border);color:var(--red)}
        .auth-submit{width:100%;height:50px;background:#E62020;color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:transform .15s,box-shadow .15s;box-shadow:0 4px 14px rgba(230,32,32,0.28)}
        .auth-submit:hover{transform:translateY(-1px);box-shadow:0 8px 25px rgba(230,32,32,0.38)}
        .auth-submit:active{transform:translateY(0)}
        .auth-submit:disabled{opacity:0.6;cursor:not-allowed;transform:none}
        .auth-spinner{width:20px;height:20px;border:3px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:auth-spin .7s linear infinite}
        @keyframes auth-spin{to{transform:rotate(360deg)}}
        .auth-footer{margin-top:28px;display:flex;flex-direction:column;align-items:center;gap:16px}
        .auth-toggle{font-size:.9rem;color:#647086}
        [data-theme="dark"] .auth-toggle{color:var(--muted)}
        .auth-toggle button{background:none;border:none;color:#E62020;font-weight:700;cursor:pointer;padding:0 4px;font-size:.9rem;transition:color .15s}
        .auth-toggle button:hover{color:#B81818}
        .auth-back{display:inline-flex;align-items:center;gap:6px;color:#94a3b8;text-decoration:none;font-size:.85rem;font-weight:500;transition:color .15s}
        .auth-back:hover{color:#475569}
        @media(max-width:900px){
          .auth-page{grid-template-columns:1fr}
          .auth-brand-panel{display:none}
          .auth-mobile-logo{display:flex}
          .auth-form-panel{padding:24px}
        }
      `}</style>
    </div>
  );
}
