import React, { useState, useContext } from 'react';
import { AuthContext } from '../../App';
import dataService from '../utils/dataService';

const pwRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

export default function SettingsPage() {
  const { user } = useContext(AuthContext);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setMsgType('');

    if (!oldPassword || !newPassword || !confirmPassword) {
      setMessage('Compila tutti i campi');
      setMsgType('error');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('Le nuove password non coincidono');
      setMsgType('error');
      return;
    }
    if (!pwRegex.test(newPassword)) {
      setMessage('Minimo 12 caratteri, almeno una maiuscola, una minuscola, un numero e un carattere speciale');
      setMsgType('error');
      return;
    }

    setLoading(true);
    const result = await dataService.changePassword(user.email, oldPassword, newPassword);
    setLoading(false);

    if (result.success) {
      setMessage('Password cambiata con successo');
      setMsgType('success');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setMessage(result.error || 'Errore durante il cambio password');
      setMsgType('error');
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>Impostazioni</h2>
        <span>Gestisci le tue credenziali di accesso</span>
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <div>
            <strong>Cambia password</strong>
            <span>La password deve avere almeno 12 caratteri, una maiuscola, una minuscola, un numero e un carattere speciale</span>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="settings-form">
          <div className="settings-field">
            <label>Password attuale</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Inserisci la password corrente"
              autoComplete="current-password"
            />
          </div>

          <div className="settings-field">
            <label>Nuova password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimo 12 caratteri, Aa1!"
              autoComplete="new-password"
            />
          </div>

          <div className="settings-field">
            <label>Conferma nuova password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ripeti la nuova password"
              autoComplete="new-password"
            />
          </div>

          {message && (
            <div className={`settings-msg ${msgType}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {msgType === 'success'
                  ? <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>
                  : <><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>
                }
              </svg>
              {message}
            </div>
          )}

          <button type="submit" className="settings-submit" disabled={loading}>
            {loading ? 'Salvataggio...' : 'Cambia password'}
          </button>
        </form>
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <div>
            <strong>Informazioni account</strong>
            <span>Dettagli del tuo profilo</span>
          </div>
        </div>
        <div className="settings-info">
          <div className="settings-info-row"><span>Email</span><b>{user?.email}</b></div>
          <div className="settings-info-row"><span>Username</span><b>{user?.username}</b></div>
          <div className="settings-info-row"><span>Ruolo</span><b className={`role-badge ${user?.role === 'admin' ? 'admin' : 'user'}`}>{user?.role}</b></div>
        </div>
      </div>

      <style>{`
        .settings-page{padding:28px;max-width:640px;font-family:ui-sans-serif,system-ui,sans-serif;color:#07111f}
        [data-theme="dark"] .settings-page{color:#e8eaf0}
        .settings-header{margin-bottom:28px}
        .settings-header h2{margin:0 0 6px;font-size:1.4rem;font-weight:800;letter-spacing:-.03em}
        .settings-header span{font-size:.85rem;color:#647086}
        [data-theme="dark"] .settings-header span{color:#8892a8}
        .settings-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:24px;margin-bottom:20px}
        [data-theme="dark"] .settings-card{background:#1a1d27;border-color:#2d3044}
        .settings-card-header{display:flex;align-items:flex-start;gap:12px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #f1f5f9}
        [data-theme="dark"] .settings-card-header{border-bottom-color:#2d3044}
        .settings-card-header svg{color:#0B57D0;flex-shrink:0;margin-top:2px}
        .settings-card-header strong{display:block;font-size:.95rem;font-weight:700;margin-bottom:2px}
        .settings-card-header span{font-size:.78rem;color:#647086;line-height:1.4}
        [data-theme="dark"] .settings-card-header span{color:#8892a8}
        .settings-form{display:grid;gap:16px}
        .settings-field{display:grid;gap:6px}
        .settings-field label{font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;font-weight:800;color:#647086}
        [data-theme="dark"] .settings-field label{color:#8892a8}
        .settings-field input{width:100%;height:46px;padding:0 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:.9rem;color:#07111f;background:#fff;outline:none;transition:border-color .2s,box-shadow .2s;box-sizing:border-box}
        [data-theme="dark"] .settings-field input{border-color:#2d3044;color:#e8eaf0;background:#1a1d27}
        .settings-field input:focus{border-color:#0B57D0;box-shadow:0 0 0 4px rgba(11,87,208,0.08)}
        .settings-field input::placeholder{color:#94a3b8}
        [data-theme="dark"] .settings-field input::placeholder{color:#5a6178}
        .settings-msg{display:flex;align-items:center;gap:8px;padding:12px 16px;border-radius:10px;font-size:.85rem;font-weight:500}
        .settings-msg.success{background:#f0fdf4;border:1px solid #bbf7d0;color:#11845b}
        [data-theme="dark"] .settings-msg.success{background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.2);color:#22c55e}
        .settings-msg.error{background:#fef2f2;border:1px solid #fecaca;color:#dc2626}
        [data-theme="dark"] .settings-msg.error{background:rgba(248,113,113,.1);border-color:rgba(248,113,113,.2);color:#f87171}
        .settings-submit{width:100%;height:48px;background:linear-gradient(135deg,#0B57D0,#1d4ed8);color:#fff;border:none;border-radius:10px;font-size:.95rem;font-weight:700;cursor:pointer;transition:transform .15s,box-shadow .15s;box-shadow:0 4px 14px rgba(11,87,208,0.3)}
        .settings-submit:hover{transform:translateY(-1px);box-shadow:0 8px 25px rgba(11,87,208,0.4)}
        .settings-submit:disabled{opacity:.6;cursor:not-allowed;transform:none}
        .settings-info{display:grid;gap:12px}
        .settings-info-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0}
        .settings-info-row span{font-size:.85rem;color:#647086}
        [data-theme="dark"] .settings-info-row span{color:#8892a8}
        .settings-info-row b{font-size:.9rem;font-weight:600}
        .role-badge{padding:2px 10px;border-radius:6px;font-size:.75rem;font-weight:700;text-transform:uppercase}
        .role-badge.admin{background:#e8f0fe;color:#0B57D0}
        [data-theme="dark"] .role-badge.admin{background:rgba(77,148,255,.1);color:#4d94ff}
        .role-badge.user{background:#f0f1f5;color:#666c7c}
        [data-theme="dark"] .role-badge.user{background:#22263a;color:#8892a8}
        @media(max-width:640px){.settings-page{padding:16px}}
      `}</style>
    </div>
  );
}
