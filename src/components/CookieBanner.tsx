import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './CookieBanner.css';

const CONSENT_KEY = 'pq_cookie_consent:v1';

type Consent = 'accepted' | 'declined' | null;

function readConsent(): Consent {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'accepted' || v === 'declined' ? v : null;
  } catch {
    return null;
  }
}

export default function CookieBanner() {
  const [consent, setConsent] = useState<Consent>(null);

  useEffect(() => {
    setConsent(readConsent());
  }, []);

  if (consent !== null) return null;

  const choose = (value: 'accepted' | 'declined') => {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {
      /* storage pieno/bloccato: il banner resta, non crasha */
    }
    setConsent(value);
  };

  return (
    <div className="cookie-banner" role="region" aria-label="Consenso cookie">
      <p className="cookie-banner__text">
        Questo sito usa solo cookie tecnici e localStorage per il funzionamento dell'app.
        Nessun cookie di profilazione o tracciamento di terze parti. Leggi la{' '}
        <Link to="/privacy" className="cookie-banner__link">Privacy Policy</Link>.
      </p>
      <div className="cookie-banner__actions">
        <button type="button" className="cookie-banner__btn cookie-banner__btn--ghost" onClick={() => choose('declined')}>
          Rifiuta
        </button>
        <button type="button" className="cookie-banner__btn" onClick={() => choose('accepted')}>
          Accetta
        </button>
      </div>
    </div>
  );
}
