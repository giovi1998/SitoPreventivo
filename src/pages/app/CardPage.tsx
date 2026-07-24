import React, { Suspense, lazy, useContext } from 'react';
import { AuthContext, AppContext } from '../../contexts';
import { useDocumentLoader } from '../../hooks/useDocumentLoader';

const CardEditor = lazy(() => import('../../components/CardEditor'));

export default function CardPage() {
  const { user } = useContext(AuthContext);
  const ctx = useContext(AppContext) as any;
  const { initialDoc, onReset, onSaved } = useDocumentLoader({
    view: 'card',
    documentType: 'businessCard',
    contextField: 'cardDocument',
  });
  const tier: 'free' | 'unlocked' = user?.email === 'admin@gmail.com'
    ? 'unlocked'
    : (ctx?.tier === 'unlocked' ? 'unlocked' : 'free');
  return (
    <Suspense fallback={<div className="view-loading"><div className="spinner" /></div>}>
      <CardEditor
        userEmail={user?.email || ''}
        documentTheme={ctx.documentTheme}
        tier={tier}
        initialCard={initialDoc}
        onReset={onReset}
        onSaved={onSaved}
      />
    </Suspense>
  );
}
