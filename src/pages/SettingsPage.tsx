import React, { useState, useContext, useMemo } from 'react';
import { AuthContext } from '../contexts';
import dataService from '../utils/dataService';
import PasswordInput from '../components/PasswordInput';
import PasswordStrength, { evaluatePassword, EMPTY_RULES } from '../components/PasswordStrength';
import './SettingsPage.css';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

type Tab = 'security' | 'account';

export default function SettingsPage() {
  const { user } = useContext(AuthContext);
  const [tab, setTab] = useState<Tab>('security');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(false);

  const rules = useMemo(() => evaluatePassword(newPassword), [newPassword]);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = oldPassword.length > 0 && PASSWORD_REGEX.test(newPassword) && passwordsMatch && !loading;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!oldPassword || !newPassword || !confirmPassword) {
      setMessage({ text: 'Compila tutti i campi', type: 'error' });
      return;
    }
    if (!passwordsMatch) {
      setMessage({ text: 'Le nuove password non coincidono', type: 'error' });
      return;
    }
    if (!PASSWORD_REGEX.test(newPassword)) {
      setMessage({ text: 'La password non rispetta i requisiti di sicurezza', type: 'error' });
      return;
    }

    setLoading(true);
    const result = await dataService.changePassword(user!.email, oldPassword, newPassword);
    setLoading(false);

    if (result.success) {
      setMessage({ text: 'Password aggiornata con successo', type: 'success' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setMessage({ text: result.error || 'Errore durante il cambio password', type: 'error' });
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>Impostazioni</h2>
        <span>Gestisci le tue credenziali di accesso e il tuo profilo</span>
      </div>

      <div className="settings-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'security'}
          className={`settings-tab ${tab === 'security' ? 'active' : ''}`}
          onClick={() => setTab('security')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Sicurezza
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'account'}
          className={`settings-tab ${tab === 'account' ? 'active' : ''}`}
          onClick={() => setTab('account')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Account
        </button>
      </div>

      {tab === 'security' && (
        <div className="settings-card">
          <div className="settings-card-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <div>
              <strong>Cambia password</strong>
              <span>La password deve avere almeno 12 caratteri, una maiuscola, una minuscola, un numero e un carattere speciale</span>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="settings-form" noValidate>
            <PasswordInput
              id="old-password"
              label="Password attuale"
              value={oldPassword}
              onChange={setOldPassword}
              placeholder="Inserisci la password corrente"
              autoComplete="current-password"
            />

            <div>
              <PasswordInput
                id="new-password"
                label="Nuova password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="Minimo 12 caratteri, Aa1!"
                autoComplete="new-password"
                hasError={newPassword.length > 0 && !PASSWORD_REGEX.test(newPassword)}
              />
              <PasswordStrength rules={newPassword ? rules : EMPTY_RULES} password={newPassword} />
            </div>

            <PasswordInput
              id="confirm-password"
              label="Conferma nuova password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Ripeti la nuova password"
              autoComplete="new-password"
              hasError={confirmPassword.length > 0 && !passwordsMatch}
            />

            {message && (
              <div className={`settings-msg ${message.type}`} role="alert">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {message.type === 'success' ? (
                    <>
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </>
                  ) : (
                    <>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </>
                  )}
                </svg>
                {message.text}
              </div>
            )}

            <button type="submit" className="settings-submit" disabled={!canSubmit}>
              {loading ? 'Salvataggio…' : 'Cambia password'}
            </button>
          </form>
        </div>
      )}

      {tab === 'account' && (
        <div className="settings-card">
          <div className="settings-card-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <div>
              <strong>Informazioni account</strong>
              <span>Dettagli del tuo profilo</span>
            </div>
          </div>
          <div className="settings-info">
            <div className="settings-info-row"><span>Email</span><b>{user?.email || '—'}</b></div>
            <div className="settings-info-row"><span>Username</span><b>{user?.username || '—'}</b></div>
            <div className="settings-info-row"><span>Ruolo</span><b className={`role-badge ${user?.role === 'admin' ? 'admin' : 'user'}`}>{user?.role || 'user'}</b></div>
            {user?.dataRegistrazione && (
              <div className="settings-info-row"><span>Membro dal</span><b>{user.dataRegistrazione}</b></div>
            )}
            {user?.tokensUsed !== undefined && (
              <div className="settings-info-row"><span>Token AI usati</span><b>{user.tokensUsed.toLocaleString('it-IT')} / {user.tokenLimit?.toLocaleString('it-IT') || '∞'}</b></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
