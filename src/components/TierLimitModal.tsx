import React, { useState } from 'react';
import dataService from '../utils/dataService';

interface TierLimitModalProps {
  open: boolean;
  userEmail: string;
  onClose: () => void;
  onRedeemed?: (tier: 'free' | 'unlocked') => void;
}

// Email di contatto per lo sblocco (vedi AGENTS.md "Admin User"). Quando
// l'utente free raggiunge il limite, gli offriamo due strade: (1)
// riscatta un codice pacchetto (TierLimitModal → redeemUnlockCode),
// oppure (2) contatta via email per richiedere lo sblocco manuale.
// L'admin può anche sbloccare l'utente da `/admin/unlock-user`.
const SUPPORT_EMAIL = 'webdevcagliari@gmail.com';
const SUPPORT_SUBJECT = 'Richiesta%20sblocco%20Quickbrand';

export default function TierLimitModal({ open, userEmail, onClose, onRedeemed }: TierLimitModalProps) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRedeemForm, setShowRedeemForm] = useState(false);

  if (!open) return null;

  const handleRedeem = async () => {
    if (!code.trim()) {
      setError('Inserisci un codice.');
      return;
    }
    setBusy(true);
    setError(null);
    const result: any = await dataService.redeemUnlockCode(userEmail, code.trim());
    setBusy(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    const newTier = result?.tier === 'unlocked' ? 'unlocked' : 'free';
    if (onRedeemed) onRedeemed(newTier);
    onClose();
  };

  const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${SUPPORT_SUBJECT}&body=${encodeURIComponent(`Ciao,\nuso l'account ${userEmail} e ho raggiunto il limite di documenti del piano free.\nVorrei sbloccare il piano completo.\n\nGrazie.`)}`;

  return (
    <div className="tier-limit-overlay" onClick={onClose} role="presentation">
      <div
        className="tier-limit-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tier-limit-title"
      >
        <h3 id="tier-limit-title">Limite piano free raggiunto</h3>
        <p>
          Hai raggiunto il limite di 10 documenti nel piano free. Sblocca
          documenti illimitati e rimuovi il watermark riscattando un codice
          pacchetto, oppure contattaci per richiedere lo sblocco.
        </p>

        {!showRedeemForm ? (
          <div className="tier-limit-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowRedeemForm(true)}
              data-testid="tier-limit-show-redeem"
            >
              Inserisci codice sbloccato
            </button>
            <a
              className="btn-secondary"
              href={mailtoHref}
              data-testid="tier-limit-contact"
            >
              ✉️ Contattaci per sblocco
            </a>
            <button
              type="button"
              className="btn-ghost"
              onClick={onClose}
              data-testid="tier-limit-close"
            >
              Chiudi
            </button>
          </div>
        ) : (
          <div className="tier-limit-redeem">
            <label htmlFor="tier-limit-code" className="tier-limit-label">
              Codice sblocco pacchetto
            </label>
            <input
              id="tier-limit-code"
              type="text"
              className="tier-limit-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="PQ-XXXXXXXX-XXXXXXXX-XXXXXXXX"
              disabled={busy}
              data-testid="tier-limit-input"
              autoComplete="off"
            />
            {error && <p className="tier-limit-error" role="alert" data-testid="tier-limit-error">{error}</p>}
            <div className="tier-limit-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={handleRedeem}
                disabled={busy}
                data-testid="tier-limit-submit"
              >
                {busy ? 'Riscatto...' : 'Riscatta'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => { setShowRedeemForm(false); setError(null); }}
                disabled={busy}
              >
                Annulla
              </button>
            </div>
            <p className="tier-limit-hint">
              Suggerimento per test locale: usa <code>TEST-UNLOCK</code>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
