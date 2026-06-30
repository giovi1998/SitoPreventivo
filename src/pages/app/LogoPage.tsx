import React, { Suspense, lazy, useContext } from 'react';
import { AuthContext, AppContext } from '../../contexts';

const LogoEditor = lazy(() => import('../../components/LogoEditor'));

export default function LogoPage() {
  const { user } = useContext(AuthContext);
  const ctx = useContext(AppContext) as any;
  const tier: 'free' | 'unlocked' = user?.email === 'admin@gmail.com'
    ? 'unlocked'
    : (ctx?.tier === 'unlocked' ? 'unlocked' : 'free');
  return (
    <Suspense fallback={<div className="view-loading"><div className="spinner" /></div>}>
      <LogoEditor userEmail={user?.email || ''} tier={tier} />
    </Suspense>
  );
}
