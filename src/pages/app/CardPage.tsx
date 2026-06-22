import React, { Suspense, lazy, useContext } from 'react';
import { AuthContext, AppContext } from '../../contexts';

const CardEditor = lazy(() => import('../../components/CardEditor'));

export default function CardPage() {
  const { user } = useContext(AuthContext);
  const ctx = useContext(AppContext) as any;
  return (
    <Suspense fallback={<div className="view-loading"><div className="spinner" /></div>}>
      <CardEditor
        userEmail={user?.email || ''}
        documentTheme={ctx.documentTheme}
        tier={user?.role === 'admin' ? 'unlocked' : 'free'}
      />
    </Suspense>
  );
}
