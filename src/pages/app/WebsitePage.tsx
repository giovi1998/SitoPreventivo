import React, { Suspense, lazy, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { AuthContext, AppContext } from '../../contexts';
import { useDocumentLoader } from '../../hooks/useDocumentLoader';

const WebsiteEditor = lazy(() => import('../../components/WebsiteEditor'));

export default function WebsitePage() {
  const { user } = useContext(AuthContext);
  const ctx = useContext(AppContext) as any;
  const { initialDoc, loading, onReset, onSaved } = useDocumentLoader({
    view: 'website',
    documentType: 'website',
    contextField: 'websiteDocument',
  });
  const tier: 'free' | 'unlocked' = user?.email === 'admin@gmail.com'
    ? 'unlocked'
    : (ctx?.tier === 'unlocked' ? 'unlocked' : 'free');

  // Fallback chiaro se il docId punta a un documento cancellato/non trovato:
  // evita di passare `null` a WebsiteEditor e far crashare su `.html`.
  const { docId } = useParams<{ docId: string }>();
  if (docId && !loading && initialDoc === null) {
    return (
      <div className="view-loading">
        <h2>Sito non trovato</h2>
        <p>Il documento <code>{docId}</code> non esiste o è stato eliminato.</p>
        <button className="btn-primary" onClick={() => onReset()}>Crea nuovo sito</button>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="view-loading"><div className="spinner" /></div>}>
      <WebsiteEditor userEmail={user?.email || ''} tier={tier} initialWebsite={initialDoc as any} onReset={onReset} onSaved={onSaved} />
    </Suspense>
  );
}
