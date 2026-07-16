import React, { Suspense, lazy, useContext } from 'react';
import { AuthContext, AppContext } from '../../contexts';
import { useDocumentLoader } from '../../hooks/useDocumentLoader';

const QREditor = lazy(() => import('../../components/QREditor'));

export default function QrPage() {
  const { user } = useContext(AuthContext);
  const ctx = useContext(AppContext) as any;
  const { initialDoc, onReset, onSaved } = useDocumentLoader({
    view: 'qr',
    documentType: 'qrCode',
    contextField: 'qrDocument',
  });
  // Phase 5: admin → implicit unlocked, otherwise pull tier from context
  const tier: 'free' | 'unlocked' = user?.email === 'admin@gmail.com'
    ? 'unlocked'
    : (ctx?.tier === 'unlocked' ? 'unlocked' : 'free');
  return (
    <Suspense fallback={<div className="view-loading"><div className="spinner" /></div>}>
      <QREditor userEmail={user?.email || ''} tier={tier} initialQr={initialDoc} onReset={onReset} onSaved={onSaved} />
    </Suspense>
  );
}
