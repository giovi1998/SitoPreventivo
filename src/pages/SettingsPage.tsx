import React, { useState, useContext, useMemo, useEffect, useCallback } from 'react';
import { AuthContext } from '../contexts';
import dataService from '../utils/dataService';
import PasswordInput from '../components/PasswordInput';
import PasswordStrength, { evaluatePassword, EMPTY_RULES } from '../components/PasswordStrength';
import { maskUnlockCode } from '../utils/watermark';
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

  // Tier state (Phase 5)
  const [tier, setTier] = useState<'free' | 'unlocked' | 'loading'>('loading');
  const [documentCount, setDocumentCount] = useState<number>(0);
  const [documentLimit, setDocumentLimit] = useState<number | null>(null);
  const [unlockCode, setUnlockCode] = useState<string | null>(null);
  const [unlockedAt, setUnlockedAt] = useState<string | null>(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemMessage, setRedeemMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const refreshTier = useCallback(async () => {
    if (!user?.email) return;
    if (user.email === 'admin@gmail.com') {
      setTier('unlocked');
      setDocumentLimit(null);
      return;
    }
    const res: any = await dataService.getUserTier(user.email);
    if (res && !res.error) {
      setTier(res.tier === 'unlocked' ? 'unlocked' : 'free');
      setDocumentCount(res.documentCount || 0);
      setDocumentLimit(res.documentLimit ?? null);
    }
  }, [user?.email]);

  useEffect(() => {
    if (tab === 'account') refreshTier();
  }, [tab, refreshTier]);

  // When tier becomes unlocked (and not admin), fetch unlockCode + unlockedAt
  useEffect(() => {
    if (tier === 'unlocked' && user?.email && user.email !== 'admin@gmail.com') {
      dataService.getUserSettings(user.email).then((settings: any) => {
        if (settings && !settings.error) {
          setUnlockCode(settings.unlockCode || null);
          setUnlockedAt(settings.unlockedAt || null);
        }
      }).catch(() => { /* ignore */ });
    }
  }, [tier, user?.email]);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !redeemCode.trim()) return;
    setRedeemBusy(true);
    setRedeemMessage(null);
    const result: any = await dataService.redeemUnlockCode(user.email, redeemCode.trim());
    setRedeemBusy(false);
    if (result?.error) {
      setRedeemMessage({ text: result.error, type: 'error' });
      return;
    }
    if (result?.tier === 'unlocked') {
      setRedeemMessage({ text: 'Codice riscattato! Sbloccato.', type: 'success' });
      setRedeemCode('');
      await refreshTier();
      // Pull unlockCode + unlockedAt from userSettings
      const settings: any = await dataService.getUserSettings(user.email);
      if (settings) {
        setUnlockCode(settings.unlockCode || null);
        setUnlockedAt(settings.unlockedAt || null);
      }
    }
  };

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
        <>
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
              <div className="settings-info-row"><span>Email</span><b>{user?.email || ':'}</b></div>
              <div className="settings-info-row"><span>Username</span><b>{user?.username || ':'}</b></div>
              <div className="settings-info-row"><span>Ruolo</span><b className={`role-badge ${user?.role === 'admin' ? 'admin' : 'user'}`}>{user?.role || 'user'}</b></div>
              {user?.dataRegistrazione && (
                <div className="settings-info-row"><span>Membro dal</span><b>{user.dataRegistrazione}</b></div>
              )}
              {user?.tokensUsed !== undefined && (
                <div className="settings-info-row"><span>Token AI usati</span><b>{user.tokensUsed.toLocaleString('it-IT')} / {user.tokenLimit?.toLocaleString('it-IT') || '∞'}</b></div>
              )}
            </div>
          </div>

          {/* Phase 5, Il mio account (stato tier + redeem) */}
          <div className="settings-card" data-testid="settings-tier-card">
            <div className="settings-card-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <div>
                <strong>Il mio account</strong>
                <span>Piano e stato sblocco</span>
              </div>
            </div>

            <div className="settings-info" data-testid="settings-tier-info">
              <div className="settings-info-row">
                <span>Piano</span>
                <b data-testid="settings-tier-value">
                  {tier === 'loading' ? ':' : tier === 'unlocked' ? 'Sbloccato' : 'Free'}
                </b>
              </div>
              {tier === 'free' && documentLimit !== null && (
                <div className="settings-info-row">
                  <span>Documenti salvati</span>
                  <b data-testid="settings-doc-count">{documentCount} / {documentLimit}</b>
                </div>
              )}
              {tier === 'unlocked' && user?.role !== 'admin' && (
                <>
                  {unlockCode && (
                    <div className="settings-info-row">
                      <span>Codice sbloccato</span>
                      <b data-testid="settings-unlock-code">{maskUnlockCode(unlockCode)}</b>
                    </div>
                  )}
                  {unlockedAt && (
                    <div className="settings-info-row">
                      <span>Sbloccato il</span>
                      <b>{new Date(unlockedAt).toLocaleDateString('it-IT')}</b>
                    </div>
                  )}
                </>
              )}
            </div>

            {tier === 'free' && user?.role !== 'admin' && (
              <form onSubmit={handleRedeem} className="settings-form" data-testid="settings-redeem-form">
                <label htmlFor="settings-redeem-input" className="settings-form-label">
                  Hai un codice sbloccato? Riscattalo qui sotto.
                </label>
                <input
                  id="settings-redeem-input"
                  type="text"
                  className="settings-form-input"
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value)}
                  placeholder="PQ-XXXXXXXX-XXXXXXXX-XXXXXXXX"
                  disabled={redeemBusy}
                  data-testid="settings-redeem-input"
                  autoComplete="off"
                />
                {redeemMessage && (
                  <div
                    className={`settings-msg ${redeemMessage.type}`}
                    role="alert"
                    data-testid="settings-redeem-message"
                  >
                    {redeemMessage.text}
                  </div>
                )}
                <button
                  type="submit"
                  className="settings-submit"
                  disabled={redeemBusy || !redeemCode.trim()}
                  data-testid="settings-redeem-submit"
                >
                  {redeemBusy ? 'Riscatto…' : 'Riscatta codice'}
                </button>
                <p className="settings-form-hint">
                  Suggerimento: in locale puoi usare <code>TEST-UNLOCK</code>.
                </p>
              </form>
            )}

            {tier === 'unlocked' && user?.role === 'admin' && (
              <p className="settings-form-hint">L'account amministratore è sempre sbloccato.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
