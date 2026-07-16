import React, { Suspense, lazy, useContext } from 'react';
import { AuthContext, AppContext } from '../../contexts';
import { useDocumentLoader } from '../../hooks/useDocumentLoader';

const LogoEditor = lazy(() => import('../../components/LogoEditor'));

export default function LogoPage() {
  const { user } = useContext(AuthContext);
  const ctx = useContext(AppContext) as any;
  const { initialDoc, onReset, onSaved } = useDocumentLoader({
    view: 'logo',
    documentType: 'logo',
    contextField: 'logoDocument',
  });
  const tier: 'free' | 'unlocked' = user?.email === 'admin@gmail.com'
    ? 'unlocked'
    : (ctx?.tier === 'unlocked' ? 'unlocked' : 'free');
  return (
    <Suspense fallback={<div className="view-loading"><div className="spinner" /></div>}>
      <LogoEditor userEmail={user?.email || ''} tier={tier} initialLogo={initialDoc} onReset={onReset} onSaved={onSaved} />
    </Suspense>
  );
}
