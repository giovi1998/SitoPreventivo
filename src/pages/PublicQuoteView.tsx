import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import DocumentPreview from '../components/DocumentPreview';
import dataService from '../utils/dataService';
import quoteAdapter from '../utils/quoteAdapter';

export default function PublicQuoteView() {
  const { shareToken } = useParams();
  const [quote, setQuote] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    dataService.getPublicQuote(shareToken).then(({ quote: q, error: err }: any) => {
      if (err) setError(err);
      else setQuote(quoteAdapter.fromApi(q));
      setLoading(false);
    });
  }, [shareToken]);

  const downloadPdf = async () => {
    if (!quote) return;
    setPdfLoading(true);
    try {
      const { generatePDFBlob } = await import('../utils/generatePDF');
      const theme = (quote as any).documentTheme || 'corporate';
      const pdfBytes = await generatePDFBlob(quote, theme);
      const filename = `${(quote as any).quoteId || (quote as any).project?.title || 'preventivo'}_${(quote as any).client?.name || 'preventivo'}.pdf`;
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Errore generazione PDF:', err);
    } finally {
      setPdfLoading(false);
    }
  };

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
          <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: 'var(--ink)' }}>{quote.title || quote.project?.title}</h1>
          <button onClick={downloadPdf} disabled={pdfLoading} style={{
            display: 'inline-block', marginTop: '12px', padding: '10px 20px',
            background: (quote.color || quote.uiPreferences?.accentColor || 'var(--accent)'), color: '#fff',
            borderRadius: '8px', border: 'none', textDecoration: 'none', fontWeight: 700, fontSize: '.85rem',
            cursor: pdfLoading ? 'wait' : 'pointer', opacity: pdfLoading ? 0.7 : 1,
          }}>
            {pdfLoading ? 'Generazione...' : 'Scarica PDF'}
          </button>
        </div>
        <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,.06)', overflow: 'hidden' }}>
          <DocumentPreview quote={quote} />
        </div>
      </div>
    </div>
  );
}
