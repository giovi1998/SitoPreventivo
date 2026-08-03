import React, { Suspense, lazy, useContext } from 'react';
import { AuthContext, AppContext } from '../../contexts';
import { useDocumentLoader } from '../../hooks/useDocumentLoader';

const WebsiteEditor = lazy(() => import('../../components/WebsiteEditor'));

export default function WebsitePage() {
  const { user } = useContext(AuthContext);
  const ctx = useContext(AppContext) as any;
  const { initialDoc, onReset, onSaved } = useDocumentLoader({
    view: 'website',
    documentType: 'website',
    contextField: 'websiteDocument',
  });
  const tier: 'free' | 'unlocked' = user?.email === 'admin@gmail.com'
    ? 'unlocked'
    : (ctx?.tier === 'unlocked' ? 'unlocked' : 'free');
  return (
    <Suspense fallback={<div className="view-loading"><div className="spinner" /></div>}>
      <WebsiteEditor userEmail={user?.email || ''} tier={tier} initialWebsite={initialDoc as any} onReset={onReset} onSaved={onSaved} />
    </Suspense>
  );
}
