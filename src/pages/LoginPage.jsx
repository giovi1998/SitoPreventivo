import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Simulazione login (nessun backend reale)
    setTimeout(() => {
      if (email && password) {
        // Simula un token di autenticazione
        const fakeToken = btoa(`${email}:${Date.now()}`);
        localStorage.setItem('authToken', fakeToken);
        localStorage.setItem('userEmail', email);
        
        // Reindirizza alla home
        navigate('/', { replace: true });
      } else {
        setError('Inserisci email e password');
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '40px',
      background: 'linear-gradient(135deg, #F6F8FC, #eef3fb 54%, #ffffff)',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '40px',
        background: '#fff',
        borderRadius: '20px',
        boxShadow: '0 20px 40px rgba(8, 32, 51, 0.08)',
        border: '1px solid #c8d0df'
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'rgba(11, 87, 208, 0.1)',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 16px auto'
          }}>
            <Icon name="user" />
          </div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '900',
            color: '#07111f',
            margin: '0 0 8px 0'
          }}>Accesso</h1>
          <p style={{
            fontSize: '14px',
            color: '#647086',
            margin: 0
          }}>Accedi al tuo account PrecisionQuote</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '900',
              color: '#647086',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em'
            }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="La tua email"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #c8d0df',
                borderRadius: '12px',
                fontSize: '14px',
                color: '#07111f',
                background: '#fff',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '900',
              color: '#647086',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em'
            }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="La tua password"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #c8d0df',
                borderRadius: '12px',
                fontSize: '14px',
                color: '#07111f',
                background: '#fff',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '12px',
              color: '#dc2626',
              fontSize: '14px',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: loading ? '#94a3b8' : '#0B57D0',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '850',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'transform 0.16s ease, box-shadow 0.16s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {loading ? (
              <>
                <span style={{ animation: 'spin 1s linear infinite' }}>⟳</span>
                Accesso in corso...
              </>
            ) : (
              <>
                <Icon name="login" />
                Accedi
              </>
            )}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          textAlign: 'center'
        }}>
          <Link to="/" style={{
            color: '#647086',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '600'
          }}>
            ← Torna alla home
          </Link>
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