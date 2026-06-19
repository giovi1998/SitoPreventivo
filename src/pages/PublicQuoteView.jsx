import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import DocumentPreview from '../components/DocumentPreview';
import dataService from '../utils/dataService.js';

export default function PublicQuoteView() {
  const { shareToken } = useParams();
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    dataService.getPublicQuote(shareToken).then(({ quote: q, error: err }) => {
      if (err) setError(err);
      else setQuote(q);
      setLoading(false);
    });
  }, [shareToken]);

  if (loading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: 'var(--canvas)' }}>
        <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px', animation: 'pulse 1s infinite' }}>⏳</div>
          <p>Caricamento preventivo...</p>
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: 'var(--canvas)', padding: '20px' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.3 }}>🔒</div>
          <h2 style={{ margin: '0 0 8px', color: 'var(--ink)' }}>Preventivo non disponibile</h2>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '.9rem' }}>Il link potrebbe essere scaduto o il preventivo non è più condiviso.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--canvas)', padding: '24px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <p style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)', fontWeight: 800, margin: '0 0 4px' }}>Preventivo condiviso</p>
          <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: 'var(--ink)' }}>{quote.title}</h1>
        </div>
        <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,.06)', overflow: 'hidden' }}>
          <DocumentPreview quote={quote} />
        </div>
      </div>
    </div>
  );
}
