import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../App.jsx';
import Icon from '../components/Icon.jsx';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const { login, register } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
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

    const result = isRegister ? await register(email, password, username) : await login(email, password);
    if (result.success) {
      navigate('/', { replace: true });
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '24px',
      background: '#F7F8FA',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '375px',
        background: '#FFFFFF',
        borderRadius: '40px',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)'
      }}>
        {/* Status bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 24px 4px',
          fontSize: '14px',
          fontWeight: '600',
          color: '#1A1A2E'
        }}>
          <span>9:41</span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <div style={{ width: '16px', height: '10px', background: '#1A1A2E', borderRadius: '2px', position: 'relative' }}>
              <div style={{ position: 'absolute', right: '-3px', top: '2px', width: '4px', height: '4px', borderRadius: '50%', background: '#1A1A2E' }} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: '#0B57D0',
              borderRadius: '14px',
              margin: '0 auto 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name="spark" />
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1A1A2E', letterSpacing: '-0.02em' }}>PrecisionQuote</div>
          </div>

          {/* Header */}
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1A1A2E', letterSpacing: '-0.02em', marginBottom: '8px' }}>
              {isRegister ? 'Crea il tuo account' : 'Bentornato'}
            </h1>
            <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: '1.5' }}>
              {isRegister ? 'Registrati per iniziare a creare preventivi' : 'Accedi per continuare a creare preventivi'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Username field (only for register) */}
            {isRegister && (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Il tuo username"
                  style={{
                    width: '100%',
                    height: '48px',
                    padding: '0 16px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '12px',
                    fontSize: '16px',
                    color: '#1A1A2E',
                    background: '#F9FAFB',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            {/* Email field */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="La tua email"
                style={{
                  width: '100%',
                  height: '48px',
                  padding: '0 16px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '12px',
                  fontSize: '16px',
                  color: '#1A1A2E',
                  background: '#F9FAFB',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Password field */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="La tua password"
                  style={{
                    width: '100%',
                    height: '48px',
                    padding: '0 48px 0 16px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '12px',
                    fontSize: '16px',
                    color: '#1A1A2E',
                    background: '#F9FAFB',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    padding: '8px',
                    cursor: 'pointer',
                    color: '#6B7280'
                  }}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div style={{
                padding: '12px 16px',
                background: '#FEE2E2',
                borderRadius: '12px',
                color: '#DC2626',
                fontSize: '14px',
                textAlign: 'center'
              }}>
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                height: '48px',
                background: loading ? '#9CA3AF' : '#0B57D0',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background 0.2s'
              }}
            >
              {loading ? (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="32" strokeDashoffset="32" />
                  </svg>
                  Accesso in corso...
                </>
              ) : (
                <>
                  <Icon name="login" />
                  {isRegister ? 'Registrati' : 'Accedi'}
                </>
              )}
            </button>
          </form>

          {/* Links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'center' }}>
            {!isRegister && (
              <a href="#" style={{ color: '#0B57D0', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
                Password dimenticata?
              </a>
            )}
            <div style={{ fontSize: '14px', color: '#6B7280' }}>
              {isRegister ? 'Hai già un account? ' : "Non hai un account? "}
              <button
                type="button"
                onClick={() => { setIsRegister(!isRegister); setError(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0B57D0',
                  fontWeight: '600',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '14px'
                }}
              >
                {isRegister ? 'Accedi' : 'Registrati'}
              </button>
            </div>
          </div>

          {/* Back to home */}
          <div style={{ textAlign: 'center' }}>
            <Link to="/" style={{ color: '#6B7280', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
              ← Torna alla home
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
